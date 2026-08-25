"use strict";

const { createDeck, shuffle, canBeat } = require("./cards");

const STAKES = Object.freeze([100, 250, 500, 1000, 2500, 5000, 10000]);
const HAND_SIZE = 6;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 3;

function playerById(game, id) { return game.players.find(p => p.id === id) || null; }
function nextIndex(game, id) { const i = game.players.findIndex(p => p.id === id); return (i + 1) % game.players.length; }
function nextPlayerId(game, id, predicate = () => true) {
  for (let step = 1; step <= game.players.length; step++) {
    const p = game.players[(game.players.findIndex(x => x.id === id) + step) % game.players.length];
    if (predicate(p)) return p.id;
  }
  return null;
}
function tableRanks(game) {
  const ranks = new Set();
  for (const pair of game.table) { ranks.add(pair.attack.rank); if (pair.defense) ranks.add(pair.defense.rank); }
  return ranks;
}
function removeCard(hand, cardId) {
  const index = hand.findIndex(c => c.id === cardId);
  return index < 0 ? null : hand.splice(index, 1)[0];
}
function activeAttackers(game) { return game.players.filter(p => p.id !== game.defenderId && !p.finished); }
function allCovered(game) { return game.table.length > 0 && game.table.every(pair => !!pair.defense); }
function canThrowNow(game, playerId) {
  if (playerId === game.defenderId) return false;
  const p = playerById(game, playerId);
  if (!p || p.finished || game.table.length >= game.attackLimit) return false;
  if (game.table.length === 0) return p.hand.length > 0;
  const ranks = tableRanks(game);
  return p.hand.some(c => ranks.has(c.rank));
}

function createGame({ id, playerIds, stake }) {
  if (!Array.isArray(playerIds) || playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) throw new Error("В игре должно быть 2 или 3 игрока");
  if (!STAKES.includes(Number(stake))) throw new Error("Недопустимая ставка");
  return {
    id, stake: Number(stake), status: "WAITING", phase: "WAITING", players: playerIds.map(id => ({ id, hand: [], finished: false, finishPosition: null })),
    deck: [], trumpCard: null, trumpSuit: null, table: [], discard: [], attackerId: null, defenderId: null, turnId: null,
    roundNumber: 0, attackLimit: 0, winnerId: null, loserId: null, startedAt: null, finishedAt: null
  };
}

function dealInitial(game) {
  game.deck = shuffle(createDeck());
  game.trumpCard = game.deck[game.deck.length - 1];
  game.trumpSuit = game.trumpCard.suit;
  for (let i = 0; i < HAND_SIZE; i++) for (const p of game.players) p.hand.push(game.deck.pop());
  let starter = null;
  let lowest = Infinity;
  for (const p of game.players) {
    for (const c of p.hand) if (c.suit === game.trumpSuit && c.value < lowest) { lowest = c.value; starter = p; }
  }
  if (!starter) starter = game.players[Math.floor(Math.random() * game.players.length)];
  game.attackerId = starter.id;
  game.defenderId = game.players[nextIndex(game, starter.id)].id;
  game.turnId = starter.id;
  game.phase = "ATTACK";
  game.status = "PLAYING";
  game.roundNumber = 1;
  game.startedAt = Date.now();
}

function drawUp(game) {
  const start = game.players.findIndex(p => p.id === game.attackerId);
  const order = game.players.map((_, i) => game.players[(start + i) % game.players.length]);
  for (const p of order) while (p.hand.length < HAND_SIZE && game.deck.length) p.hand.push(game.deck.pop());
}

function getAvailableAttacks(game, playerId) {
  if (game.status !== "PLAYING" || game.phase !== "DEFENSE" && game.phase !== "ATTACK") return [];
  if (playerId === game.defenderId || game.turnId !== playerId) return [];
  const p = playerById(game, playerId); if (!p || p.finished) return [];
  if (game.table.length === 0) return [...p.hand];
  if (game.table.length >= game.attackLimit) return [];
  const ranks = tableRanks(game);
  return p.hand.filter(c => ranks.has(c.rank));
}

function getAvailableDefenses(game, playerId) {
  if (game.status !== "PLAYING" || game.phase !== "DEFENSE" || game.defenderId !== playerId || game.turnId !== playerId) return [];
  const pair = game.table.find(x => !x.defense); if (!pair) return [];
  const p = playerById(game, playerId); if (!p) return [];
  return p.hand.filter(c => canBeat(pair.attack, c, game.trumpSuit));
}

function validate(game, playerId) {
  if (game.status !== "PLAYING") throw new Error("Партия не активна");
  if (game.turnId !== playerId) throw new Error("Сейчас ход другого игрока");
}

function playAttack(game, playerId, cardId) {
  validate(game, playerId);
  if (playerId === game.defenderId) throw new Error("Защищающийся не может подкидывать");
  const available = getAvailableAttacks(game, playerId);
  if (!available.some(c => c.id === cardId)) throw new Error("Этой картой сейчас нельзя ходить");
  const p = playerById(game, playerId);
  const card = removeCard(p.hand, cardId);
  game.table.push({ attack: card, defense: null });
  if (game.table.length === 1) game.attackLimit = Math.min(HAND_SIZE, playerById(game, game.defenderId).hand.length);
  game.phase = "DEFENSE";
  game.turnId = game.defenderId;
  return checkFinish(game);
}

function defend(game, playerId, cardId) {
  validate(game, playerId);
  const options = getAvailableDefenses(game, playerId);
  if (!options.some(c => c.id === cardId)) throw new Error("Этой картой нельзя отбить эту карту");
  const p = playerById(game, playerId);
  const pair = game.table.find(x => !x.defense);
  pair.defense = removeCard(p.hand, cardId);
  const nextAttacker = nextPlayerId(game, playerId, p => canThrowNow(game, p.id));
  game.turnId = nextAttacker || game.attackerId;
  return checkFinish(game);
}

function take(game, playerId) {
  validate(game, playerId);
  if (playerId !== game.defenderId || game.phase !== "DEFENSE") throw new Error("Сейчас нельзя брать карты");
  const defender = playerById(game, playerId);
  for (const pair of game.table) { defender.hand.push(pair.attack); if (pair.defense) defender.hand.push(pair.defense); }
  game.discard.push(...game.table.flatMap(x => [x.attack, x.defense].filter(Boolean)));
  game.table = [];
  const oldAttacker = game.attackerId;
  const oldDefender = game.defenderId;
  const attackerStillActive = !playerById(game, oldAttacker)?.finished;
  const nextAttacker = attackerStillActive ? oldAttacker : nextPlayerId(game, oldAttacker, p => !p.finished);
  game.attackerId = nextAttacker;
  game.defenderId = nextPlayerId(game, oldDefender, p => !p.finished && p.id !== game.attackerId);
  game.turnId = game.attackerId;
  game.phase = "ATTACK";
  game.roundNumber++;
  drawUp(game);
  return checkFinish(game);
}

function endAttack(game, playerId) {
  validate(game, playerId);
  if (playerId === game.defenderId || !allCovered(game)) throw new Error("Атака ещё не может быть завершена");
  game.discard.push(...game.table.flatMap(x => [x.attack, x.defense].filter(Boolean)));
  game.table = [];
  const oldDefender = game.defenderId;
  const nextAttacker = !playerById(game, oldDefender)?.finished ? oldDefender : nextPlayerId(game, oldDefender, p => !p.finished);
  game.attackerId = nextAttacker;
  game.defenderId = nextPlayerId(game, nextAttacker, p => !p.finished && p.id !== nextAttacker);
  game.turnId = game.attackerId;
  game.phase = "ATTACK";
  game.roundNumber++;
  drawUp(game);
  return checkFinish(game);
}

function checkFinish(game) {
  if (game.status !== "PLAYING") return game;
  if (game.deck.length === 0) {
    for (const p of game.players) if (!p.finished && p.hand.length === 0) {
      p.finished = true;
      p.finishPosition = game.players.filter(x => x.finishPosition !== null).length + 1;
    }
    const active = game.players.filter(p => !p.finished);
    if (active.length <= 1) {
      if (active.length === 1) { active[0].finished = true; active[0].finishPosition = game.players.length; }
      const ordered = [...game.players].sort((a,b) => (a.finishPosition ?? 999) - (b.finishPosition ?? 999));
      game.winnerId = ordered[0]?.id || null;
      game.loserId = ordered[ordered.length - 1]?.id || null;
      game.status = "FINISHED"; game.phase = "FINISHED"; game.turnId = null; game.finishedAt = Date.now();
    }
  }
  return game;
}

function ensureRoles(game, preferredAttackerId = null) {
  const active = game.players.filter(p => !p.finished);
  if (!active.length) return;
  let attacker = active.find(p => p.id === preferredAttackerId) || active.find(p => p.id === game.attackerId) || active[0];
  let defender = active.find(p => p.id === game.defenderId && p.id !== attacker.id) || active.find(p => p.id !== attacker.id) || null;
  game.attackerId = attacker.id;
  game.defenderId = defender?.id || null;
  game.turnId = attacker.id;
}

function stateForPlayer(game, playerId) {
  const me = playerById(game, playerId);
  return {
    id: game.id, status: game.status, phase: game.phase, stake: game.stake, trumpSuit: game.trumpSuit, trumpCard: game.trumpCard,
    deckCount: game.deck.length, table: game.table, attackerId: game.attackerId, defenderId: game.defenderId, turnId: game.turnId,
    roundNumber: game.roundNumber, winnerId: game.winnerId, loserId: game.loserId,
    players: game.players.map(p => ({ id: p.id, handCount: p.hand.length, finished: p.finished, finishPosition: p.finishPosition })),
    myHand: me?.hand || [], availableAttacks: getAvailableAttacks(game, playerId), availableDefenses: getAvailableDefenses(game, playerId),
    canTake: game.status === "PLAYING" && game.phase === "DEFENSE" && game.defenderId === playerId && game.turnId === playerId,
    canEndAttack: game.status === "PLAYING" && game.phase === "DEFENSE" && game.turnId === playerId && playerId !== game.defenderId && allCovered(game)
  };
}

module.exports = { STAKES, HAND_SIZE, createGame, dealInitial, playAttack, defend, take, endAttack, stateForPlayer, playerById, getAvailableAttacks, getAvailableDefenses };
