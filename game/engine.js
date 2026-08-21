"use strict";

const { createDeck, shuffle, canBeat } = require("./cards");

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 3;
const HAND_SIZE = 6;
const MAX_STAKE = 10000;
const STAKES = Object.freeze([100, 250, 500, 1000, 2500, 5000, 10000]);

function nextIndex(players, index) {
  return (index + 1) % players.length;
}
function playerById(game, id) {
  return game.players.find((p) => p.id === id) || null;
}
function activePlayers(game) {
  return game.players.filter((p) => !p.finished);
}

function createGame({ id, playerIds, stake }) {
  if (
    !Array.isArray(playerIds) ||
    playerIds.length < MIN_PLAYERS ||
    playerIds.length > MAX_PLAYERS
  )
    throw new Error("Игра должна содержать 2 или 3 игроков");
  if (!STAKES.includes(stake) || stake > MAX_STAKE)
    throw new Error("Недопустимая ставка");
  const players = playerIds.map((id) => ({
    id,
    hand: [],
    finished: false,
    finishPosition: null,
  }));
  return {
    id,
    stake,
    status: "WAITING",
    phase: null,
    players,
    deck: [],
    trumpCard: null,
    trumpSuit: null,
    table: [],
    discard: [],
    attackerId: null,
    defenderId: null,
    turnId: null,
    attackLimit: 0,
    roundNumber: 0,
    winnerId: null,
    loserId: null,
    startedAt: null,
    finishedAt: null,
  };
}

function dealInitial(game) {
  const deck = shuffle(createDeck());
  game.deck = deck;
  game.trumpCard = deck[deck.length - 1];
  game.trumpSuit = game.trumpCard.suit;
  for (let i = 0; i < 6; i++)
    for (const p of game.players) p.hand.push(game.deck.pop());
  // lowest trump starts; if nobody has trump, random player starts.
  let candidates = game.players.filter((p) =>
    p.hand.some((c) => c.suit === game.trumpSuit)
  );
  let starter = candidates[0];
  if (candidates.length)
    starter = candidates.reduce((best, p) => {
      const low = Math.min(
        ...p.hand.filter((c) => c.suit === game.trumpSuit).map((c) => c.value)
      );
      const bestLow = Math.min(
        ...best.hand
          .filter((c) => c.suit === game.trumpSuit)
          .map((c) => c.value)
      );
      return low < bestLow ? p : best;
    });
  if (!starter)
    starter = game.players[Math.floor(Math.random() * game.players.length)];
  const idx = game.players.indexOf(starter);
  game.attackerId = starter.id;
  game.defenderId = game.players[nextIndex(game.players, idx)].id;
  game.turnId = game.attackerId;
  game.phase = "ATTACK";
  game.status = "PLAYING";
  game.startedAt = Date.now();
  game.roundNumber = 1;
  game.attackLimit = 0;
}

function drawUp(game) {
  // Standard order: attacker, defender, then remaining players clockwise.
  const order = [];
  const start = game.players.findIndex((p) => p.id === game.attackerId);
  for (let i = 0; i < game.players.length; i++)
    order.push(game.players[(start + i) % game.players.length]);
  for (const p of order) {
    while (p.hand.length < HAND_SIZE && game.deck.length)
      p.hand.push(game.deck.pop());
  }
}

function tableRanks(game) {
  const s = new Set();
  for (const pair of game.table) {
    s.add(pair.attack.rank);
    if (pair.defense) s.add(pair.defense.rank);
  }
  return s;
}

function getAvailableAttacks(game, playerId) {
  const p = playerById(game, playerId);
  if (!p || game.status !== "PLAYING" || game.attackerId !== playerId)
    return [];
  if (
    game.phase === "ATTACK" &&
    game.turnId === playerId &&
    game.table.length === 0
  )
    return [...p.hand];
  if (game.phase !== "DEFENSE" || game.turnId !== playerId) return [];
  if (game.table.length >= game.attackLimit) return [];
  const ranks = tableRanks(game);
  return p.hand.filter((c) => ranks.has(c.rank));
}

function getAvailableDefenses(game, playerId) {
  if (
    game.status !== "PLAYING" ||
    game.defenderId !== playerId ||
    game.phase !== "DEFENSE" ||
    game.turnId !== playerId
  )
    return [];
  const pair = game.table.find((x) => !x.defense);
  if (!pair) return [];
  const p = playerById(game, playerId);
  return p.hand.filter((c) => canBeat(pair.attack, c, game.trumpSuit));
}

function removeCard(hand, cardId) {
  const i = hand.findIndex((c) => c.id === cardId);
  if (i < 0) return null;
  return hand.splice(i, 1)[0];
}

function validateTurn(game, playerId) {
  if (game.status !== "PLAYING") throw new Error("Партия не активна");
  if (game.turnId !== playerId) throw new Error("Сейчас не ваш ход");
}

function playAttack(game, playerId, cardId) {
  validateTurn(game, playerId);
  const p = playerById(game, playerId);
  if (!p || p.finished) throw new Error("Игрок недоступен");
  if (game.phase === "ATTACK" && game.table.length !== 0)
    throw new Error("Сейчас нельзя начинать новую атаку");
  if (game.phase === "DEFENSE" && game.table.length >= game.attackLimit)
    throw new Error("Лимит подкидывания достигнут");
  const available = getAvailableAttacks(game, playerId);
  if (!available.some((c) => c.id === cardId))
    throw new Error("Этой картой нельзя ходить сейчас");
  const card = removeCard(p.hand, cardId);
  game.table.push({ attack: card, defense: null });
  if (game.table.length === 1)
    game.attackLimit = Math.min(
      HAND_SIZE,
      game.players.find((x) => x.id === game.defenderId).hand.length
    );
  game.phase = "DEFENSE";
  game.turnId = game.defenderId;
  return game;
}

function defend(game, playerId, cardId) {
  validateTurn(game, playerId);
  const options = getAvailableDefenses(game, playerId);
  if (!options.some((c) => c.id === cardId))
    throw new Error("Этой картой нельзя отбить");
  const p = playerById(game, playerId);
  const pair = game.table.find((x) => !x.defense);
  pair.defense = removeCard(p.hand, cardId);
  game.turnId = game.attackerId;
  return game;
}

function take(game, playerId) {
  validateTurn(game, playerId);
  if (game.defenderId !== playerId || game.phase !== "DEFENSE")
    throw new Error("Сейчас нельзя брать карты");
  for (const pair of game.table) {
    game.deck.length >= 0;
    const a = pair.attack;
    const d = pair.defense;
    const p = playerById(game, playerId);
    p.hand.push(a);
    if (d) p.hand.push(d);
  }
  game.discard.push(
    ...game.table.flatMap((x) => [x.attack, x.defense].filter(Boolean))
  );
  game.table = [];
  const oldDef = game.defenderId;
  const defIndex = game.players.findIndex((p) => p.id === oldDef);
  game.attackerId = game.attackerId;
  game.defenderId = game.players[nextIndex(game.players, defIndex)].id;
  game.turnId = game.attackerId;
  game.phase = "ATTACK";
  game.roundNumber++;
  drawUp(game);
  return checkFinish(game);
}

function endAttack(game, playerId) {
  validateTurn(game, playerId);
  if (game.attackerId !== playerId || game.phase !== "DEFENSE")
    throw new Error("Атакующий не может закончить сейчас");
  if (game.table.length === 0 || game.table.some((x) => !x.defense))
    throw new Error("Сначала завершите защиту");
  game.discard.push(
    ...game.table.flatMap((x) => [x.attack, x.defense].filter(Boolean))
  );
  game.table = [];
  const oldDef = game.defenderId;
  game.attackerId = oldDef;
  const idx = game.players.findIndex((p) => p.id === oldDef);
  game.defenderId = game.players[nextIndex(game.players, idx)].id;
  game.turnId = game.attackerId;
  game.phase = "ATTACK";
  game.roundNumber++;
  drawUp(game);
  return checkFinish(game);
}

function checkFinish(game) {
  if (game.deck.length === 0) {
    const unfinished = game.players.filter(
      (p) => p.hand.length > 0 && !p.finished
    );
    for (const p of game.players.filter(
      (p) => !p.finished && p.hand.length === 0
    )) {
      p.finished = true;
      p.finishPosition =
        game.players.filter((x) => x.finishPosition !== null).length + 1;
    }
    if (
      game.players.length === 2 &&
      game.players.some((p) => p.hand.length === 0)
    ) {
      game.status = "FINISHED";
      game.phase = "FINISHED";
      game.winnerId = game.players.find((p) => p.hand.length === 0)?.id || null;
      game.loserId =
        game.players.find((p) => p.id !== game.winnerId)?.id || null;
      game.finishedAt = Date.now();
      return game;
    }
    if (unfinished.length <= 1) {
      for (const p of game.players.filter((p) => !p.finished)) {
        p.finished = true;
        p.finishPosition =
          game.players.filter((x) => x.finishPosition !== null).length + 1;
      }
      const ordered = [...game.players].sort(
        (a, b) => a.finishPosition - b.finishPosition
      );
      game.winnerId = ordered[0]?.id || null;
      game.loserId = ordered[ordered.length - 1]?.id || null;
      game.status = "FINISHED";
      game.phase = "FINISHED";
      game.finishedAt = Date.now();
    }
  }
  return game;
}

function stateForPlayer(game, playerId) {
  const me = playerById(game, playerId);
  return {
    id: game.id,
    status: game.status,
    phase: game.phase,
    stake: game.stake,
    trumpSuit: game.trumpSuit,
    trumpCard: game.trumpCard,
    deckCount: game.deck.length,
    table: game.table,
    attackerId: game.attackerId,
    defenderId: game.defenderId,
    turnId: game.turnId,
    roundNumber: game.roundNumber,
    winnerId: game.winnerId,
    loserId: game.loserId,
    players: game.players.map((p) => ({
      id: p.id,
      handCount: p.hand.length,
      finished: p.finished,
      finishPosition: p.finishPosition,
    })),
    myHand: me ? me.hand : [],
    availableAttacks: getAvailableAttacks(game, playerId),
    availableDefenses: getAvailableDefenses(game, playerId),
    canTake:
      game.status === "PLAYING" &&
      game.phase === "DEFENSE" &&
      game.defenderId === playerId &&
      game.turnId === playerId,
    canEndAttack:
      game.status === "PLAYING" &&
      game.phase === "DEFENSE" &&
      game.attackerId === playerId &&
      game.turnId === playerId &&
      game.table.length > 0 &&
      !game.table.some((x) => !x.defense),
  };
}

module.exports = {
  STAKES,
  MAX_STAKE,
  HAND_SIZE,
  createGame,
  dealInitial,
  playAttack,
  defend,
  take,
  endAttack,
  stateForPlayer,
  playerById,
};
