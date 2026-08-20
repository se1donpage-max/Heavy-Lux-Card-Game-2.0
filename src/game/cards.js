"use strict";

/*
=========================================================
HEAVY LUX CARD
CARDS
=========================================================
*/

const crypto = require("crypto");

const {
    SUITS,
    RANKS,
    VALUES,
    DECK_SIZE
} = require("../config");


/*
=========================================================
CREATE CARD
=========================================================
*/

function createCard(
    suit,
    rank
) {

    if (
        !SUITS.includes(suit)
    ) {
        throw new Error(
            `Invalid suit: ${suit}`
        );
    }


    if (
        !RANKS.includes(rank)
    ) {
        throw new Error(
            `Invalid rank: ${rank}`
        );
    }


    return {

        id:
            crypto
                .randomBytes(8)
                .toString("hex"),

        suit,

        rank,

        value:
            VALUES[rank]

    };

}


/*
=========================================================
CREATE DECK
=========================================================
*/

function createDeck() {

    const deck = [];


    for (
        const suit
        of SUITS
    ) {

        for (
            const rank
            of RANKS
        ) {

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
SHUFFLE
=========================================================
*/

function shuffle(
    deck
) {

    const result = [
        ...deck
    ];


    for (
        let i =
            result.length - 1;

        i > 0;

        i--
    ) {

        const j =
            crypto.randomInt(
                i + 1
            );


        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];

    }


    return result;

}


/*
=========================================================
CREATE SHUFFLED DECK
=========================================================
*/

function createShuffledDeck() {

    return shuffle(
        createDeck()
    );

}


/*
=========================================================
IS TRUMP
=========================================================
*/

function isTrump(
    card,
    trumpSuit
) {

    return Boolean(

        card &&

        trumpSuit &&

        card.suit ===
            trumpSuit

    );

}


/*
=========================================================
CAN BEAT
=========================================================
*/

function canBeat(
    attackCard,
    defenseCard,
    trumpSuit
) {

    if (
        !attackCard ||
        !defenseCard ||
        !trumpSuit
    ) {

        return false;

    }


    /*
    Same suit:
    higher value wins.
    */

    if (
        attackCard.suit ===
        defenseCard.suit
    ) {

        return (
            defenseCard.value >
            attackCard.value
        );

    }


    /*
    Different suits:
    only trump can beat
    a non-trump card.
    */

    if (
        defenseCard.suit ===
        trumpSuit
    ) {

        return (
            attackCard.suit !==
            trumpSuit
        );

    }


    return false;

}


/*
=========================================================
GET TRUMP SUIT
=========================================================
*/

function getTrumpSuit(
    deck
) {

    if (
        !Array.isArray(deck) ||
        deck.length === 0
    ) {

        return null;

    }


    return (
        deck[
            deck.length - 1
        ]?.suit ||
        null
    );

}


/*
=========================================================
FIND CARD
=========================================================
*/

function findCardById(
    cards,
    cardId
) {

    if (
        !Array.isArray(cards)
    ) {

        return null;

    }


    return (
        cards.find(
            card =>
                String(card.id) ===
                String(cardId)
        ) ||
        null
    );

}


/*
=========================================================
REMOVE CARD
=========================================================
*/

function removeCardById(
    cards,
    cardId
) {

    if (
        !Array.isArray(cards)
    ) {

        return {

            card: null,

            cards: []

        };

    }


    const index =
        cards.findIndex(
            card =>
                String(card.id) ===
                String(cardId)
        );


    if (
        index === -1
    ) {

        return {

            card: null,

            cards: [
                ...cards
            ]

        };

    }


    const result = [
        ...cards
    ];


    const card =
        result.splice(
            index,
            1
        )[0];


    return {

        card,

        cards:
            result

    };

}


/*
=========================================================
VALIDATE DECK
=========================================================
*/

function isValidDeck(
    deck
) {

    if (
        !Array.isArray(deck)
    ) {

        return false;

    }


    if (
        deck.length !==
        DECK_SIZE
    ) {

        return false;

    }


    const combinations =
        new Set();


    for (
        const card
        of deck
    ) {

        if (
            !card ||
            !card.id ||
            !SUITS.includes(card.suit) ||
            !RANKS.includes(card.rank)
        ) {

            return false;

        }


        const key =
            `${card.suit}:${card.rank}`;


        if (
            combinations.has(key)
        ) {

            return false;

        }


        combinations.add(key);


        if (
            card.value !==
            VALUES[card.rank]
        ) {

            return false;

        }

    }


    return (
        combinations.size ===
        DECK_SIZE
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    createCard,

    createDeck,

    shuffle,

    shuffleDeck:
        shuffle,

    createShuffledDeck,

    isTrump,

    canBeat,

    getTrumpSuit,

    findCardById,

    removeCardById,

    isValidDeck

};
