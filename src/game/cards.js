"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME
CARDS
=========================================================
*/

const crypto = require("crypto");

const {
    CONFIG
} = require("../config");


/*
=========================================================
CREATE ID
=========================================================
*/

function createCardId() {

    return crypto
        .randomBytes(8)
        .toString("hex");

}


/*
=========================================================
CARD VALUES
=========================================================
*/

function getCardValue(
    rank
) {

    return (
        CONFIG.CARDS.VALUES[rank] ??
        0
    );

}


/*
=========================================================
CREATE CARD
=========================================================
*/

function createCard(
    suit,
    rank
) {

    return {

        id:
            createCardId(),

        suit,

        rank,

        value:
            getCardValue(
                rank
            ),

        name:
            `${rank}${suit}`

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
        of CONFIG.CARDS.SUITS
    ) {

        for (
            const rank
            of CONFIG.CARDS.RANKS
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

function shuffleDeck(
    deck
) {

    const result =
        Array.isArray(deck)
            ? [...deck]
            : [];


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

    return shuffleDeck(
        createDeck()
    );

}


/*
=========================================================
TRUMP
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
        deck[deck.length - 1]
            ?.suit ||
        null
    );

}


/*
=========================================================
CARD CAN BEAT CARD
=========================================================
*/

function canBeat(
    attackingCard,
    defendingCard,
    trumpSuit
) {

    if (
        !attackingCard ||
        !defendingCard ||
        !trumpSuit
    ) {

        return false;

    }


    /*
    -----------------------------------------------------
    SAME SUIT
    -----------------------------------------------------
    */

    if (
        attackingCard.suit ===
        defendingCard.suit
    ) {

        return (
            defendingCard.value >
            attackingCard.value
        );

    }


    /*
    -----------------------------------------------------
    TRUMP
    -----------------------------------------------------
    */

    if (
        defendingCard.suit ===
        trumpSuit
    ) {

        return (
            attackingCard.suit !==
            trumpSuit
        );

    }


    /*
    -----------------------------------------------------
    NON-TRUMP CANNOT BEAT TRUMP
    -----------------------------------------------------
    */

    return false;

}


/*
=========================================================
GET CARD BY ID
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
                card &&
                card.id ===
                cardId
        ) ||
        null
    );

}


/*
=========================================================
REMOVE CARD BY ID
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
                card &&
                card.id ===
                cardId
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


    const next =
        [
            ...cards
        ];


    const [
        card
    ] =
        next.splice(
            index,
            1
        );


    return {

        card,

        cards: next

    };

}


/*
=========================================================
GET RANK
=========================================================
*/

function getRank(
    card
) {

    return (
        card?.rank ||
        null
    );

}


/*
=========================================================
GET SUIT
=========================================================
*/

function getSuit(
    card
) {

    return (
        card?.suit ||
        null
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
FIND LOWEST CARD
=========================================================
*/

function findLowestCard(
    cards,
    trumpSuit
) {

    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        return null;

    }


    const sorted =
        [...cards]
            .sort(
                (
                    a,
                    b
                ) => {

                    const aTrump =
                        isTrump(
                            a,
                            trumpSuit
                        )
                            ? 1
                            : 0;

                    const bTrump =
                        isTrump(
                            b,
                            trumpSuit
                        )
                            ? 1
                            : 0;


                    if (
                        aTrump !==
                        bTrump
                    ) {

                        return (
                            aTrump -
                            bTrump
                        );

                    }


                    return (
                        a.value -
                        b.value
                    );

                }
            );


    return (
        sorted[0] ||
        null
    );

}


/*
=========================================================
GET UNIQUE RANKS
=========================================================
*/

function getUniqueRanks(
    cards
) {

    if (
        !Array.isArray(cards)
    ) {

        return [];

    }


    return [
        ...new Set(
            cards
                .filter(Boolean)
                .map(
                    card =>
                        card.rank
                )
        )
    ];

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
        CONFIG.GAME.DECK_SIZE
    ) {

        return false;

    }


    const ids =
        new Set();


    for (
        const card
        of deck
    ) {

        if (
            !card ||
            !card.id ||
            !card.suit ||
            !card.rank
        ) {

            return false;

        }


        if (
            ids.has(card.id)
        ) {

            return false;

        }


        ids.add(
            card.id
        );

    }


    return true;

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    createCard,

    createDeck,

    shuffleDeck,

    createShuffledDeck,

    getTrumpSuit,

    canBeat,

    findCardById,

    removeCardById,

    getCardValue,

    getRank,

    getSuit,

    isTrump,

    findLowestCard,

    getUniqueRanks,

    isValidDeck

};
