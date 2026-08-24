"use strict";

const SUITS = Object.freeze(["♠", "♥", "♦", "♣"]);
const SUIT_NAMES = Object.freeze({
  "♠": "Пики",
  "♥": "Червы",
  "♦": "Бубны",
  "♣": "Трефы",
});
const RANKS = Object.freeze([6, 7, 8, 9, 10, "J", "Q", "K", "A"]);
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
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS) {
      deck.push({ id: `${suit}${rank}`, suit, rank, value: VALUES[rank] });
    }
  return deck;
}

function shuffle(input) {
  const deck = [...input];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function canBeat(attack, defense, trumpSuit) {
  if (!attack || !defense) return false;
  if (attack.suit === defense.suit) return defense.value > attack.value;
  return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}

module.exports = {
  SUITS,
  SUIT_NAMES,
  RANKS,
  VALUES,
  createDeck,
  shuffle,
  canBeat,
};
