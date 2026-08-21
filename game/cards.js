"use strict";

const SUITS = Object.freeze(["♠", "♥", "♦", "♣"]);
const SUIT_NAMES = Object.freeze({
  "♠": "spades",
  "♥": "hearts",
  "♦": "diamonds",
  "♣": "clubs",
});
const RANKS = Object.freeze(["6", "7", "8", "9", "10", "J", "Q", "K", "A"]);
const VALUES = Object.freeze({
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit}_${rank}`,
      suit,
      suitName: SUIT_NAMES[suit],
      rank,
      value: VALUES[rank],
    }))
  );
}

function shuffle(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isTrump(card, trumpSuit) {
  return Boolean(card && card.suit === trumpSuit);
}
function canBeat(attacker, defender, trumpSuit) {
  if (!attacker || !defender) return false;
  if (defender.suit === attacker.suit) return defender.value > attacker.value;
  return isTrump(defender, trumpSuit) && !isTrump(attacker, trumpSuit);
}

module.exports = {
  SUITS,
  SUIT_NAMES,
  RANKS,
  VALUES,
  createDeck,
  shuffle,
  isTrump,
  canBeat,
};
