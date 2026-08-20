"use strict";

/*
=========================================================
HEAVY LUX CARD
CARDS
=========================================================

36 КАРТ:

6  7  8  9  10  J  Q  K  A

МАСТИ:

SPADES
HEARTS
DIAMONDS
CLUBS

РЕЖИМ:

ПОДКИДНОЙ ДУРАК
БЕЗ ПЕРЕВОДА
=========================================================
*/


/*
=========================================================
SUITS
=========================================================
*/

const SUITS = Object.freeze([
    "SPADES",
    "HEARTS",
    "DIAMONDS",
    "CLUBS"
]);


/*
=========================================================
RANKS
=========================================================
*/

const RANKS = Object.freeze([
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A"
]);


/*
=========================================================
CARD VALUES
=========================================================

Используются только для определения старшинства
внутри одной масти.

6 < 7 < 8 < 9 < 10 < J < Q < K < A
=========================================================
*/

const RANK_VALUES = Object.freeze({

    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,

    "J": 11,
    "Q": 12,
    "K": 13,
    "A": 14

});


/*
=========================================================
CREATE CARD
=========================================================
*/

function createCard(suit, rank) {

    if (!SUITS.includes(suit)) {
        throw new Error(
            `Invalid card suit: ${suit}`
        );
    }

    if (!RANKS.includes(rank)) {
        throw new Error(
            `Invalid card rank: ${rank}`
        );
    }

    return Object.freeze({

        id: `${suit}_${rank}`,

        suit,

        rank,

        value:
            RANK_VALUES[rank]

    });
}


/*
=========================================================
CREATE FULL 36-CARD DECK
=========================================================
*/

function createDeck() {

    const deck = [];

    for (const suit of SUITS) {

        for (const rank of RANKS) {

            deck.push(
                createCard(
                    suit,
                    rank
                )
            );

        }

    }

    return deck;
}


/*
=========================================================
IS CARD
=========================================================
*/

function isCard(card) {

    if (!card || typeof card !== "object") {
        return false;
    }

    if (!SUITS.includes(card.suit)) {
        return false;
    }

    if (!RANKS.includes(card.rank)) {
        return false;
    }

    if (
        card.value !==
        RANK_VALUES[card.rank]
    ) {
        return false;
    }

    if (
        card.id !==
        `${card.suit}_${card.rank}`
    ) {
        return false;
    }

    return true;
}


/*
=========================================================
IS SAME RANK
=========================================================
*/

function isSameRank(cardA, cardB) {

    if (
        !isCard(cardA) ||
        !isCard(cardB)
    ) {
        return false;
    }

    return (
        cardA.rank ===
        cardB.rank
    );
}


/*
=========================================================
IS SAME SUIT
=========================================================
*/

function isSameSuit(cardA, cardB) {

    if (
        !isCard(cardA) ||
        !isCard(cardB)
    ) {
        return false;
    }

    return (
        cardA.suit ===
        cardB.suit
    );
}


/*
=========================================================
IS TRUMP
=========================================================
*/

function isTrump(card, trumpSuit) {

    if (!isCard(card)) {
        return false;
    }

    if (!SUITS.includes(trumpSuit)) {
        return false;
    }

    return (
        card.suit === trumpSuit
    );
}


/*
=========================================================
CAN BEAT
=========================================================

Проверяет:

defendingCard
может побить
attackingCard

Правила:

1. Одинаковая масть + старше
2. Козырь бьёт некозырь
3. Козырь бьёт козырь только если старше
=========================================================
*/

function canBeat(
    attackingCard,
    defendingCard,
    trumpSuit
) {

    if (
        !isCard(attackingCard) ||
        !isCard(defendingCard)
    ) {
        return false;
    }

    if (!SUITS.includes(trumpSuit)) {
        return false;
    }


    /*
    Нельзя побить карту
    самой собой.
    */

    if (
        attackingCard.id ===
        defendingCard.id
    ) {
        return false;
    }


    const attackingTrump =
        isTrump(
            attackingCard,
            trumpSuit
        );

    const defendingTrump =
        isTrump(
            defendingCard,
            trumpSuit
        );


    /*
    Козырь против некозыря.
    */

    if (
        defendingTrump &&
        !attackingTrump
    ) {
        return true;
    }


    /*
    Некозырь не может
    побить козырь.
    */

    if (
        !defendingTrump &&
        attackingTrump
    ) {
        return false;
    }


    /*
    Разные масти.

    Если обе карты либо козырные,
    либо некозырные, масть должна
    совпадать.
    */

    if (
        attackingCard.suit !==
        defendingCard.suit
    ) {
        return false;
    }


    /*
    Одна масть —
    проверяем старшинство.
    */

    return (
        defendingCard.value >
        attackingCard.value
    );
}


/*
=========================================================
GET CARD DISPLAY NAME
=========================================================
*/

function getCardDisplayName(card) {

    if (!isCard(card)) {
        throw new Error(
            "Invalid card"
        );
    }

    const suitSymbols = {

        SPADES: "♠",
        HEARTS: "♥",
        DIAMONDS: "♦",
        CLUBS: "♣"

    };

    return (
        `${card.rank}${suitSymbols[card.suit]}`
    );
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    SUITS,

    RANKS,

    RANK_VALUES,

    createCard,

    createDeck,

    isCard,

    isSameRank,

    isSameSuit,

    isTrump,

    canBeat,

    getCardDisplayName

};
