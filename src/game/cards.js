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
    SUITS,
    RANKS,
    VALUES,
    DECK_SIZE
} = require("../config");


/*
=========================================================
CREATE CARD ID
=========================================================
*/

function createCardId() {

    return crypto
        .randomBytes(8)
        .toString("hex");

}


/*
=========================================================
CARD VALUE
=========================================================
*/

function getCardValue(
    rank
) {

    return (
        VALUES[rank] ??
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

    if (
        !SUITS.includes(
            suit
        )
    ) {

        throw new Error(
            `Invalid card suit: ${suit}`
        );

    }


    if (
        !RANKS.includes(
            rank
        )
    ) {

        throw new Error(
            `Invalid card rank: ${rank}`
        );

    }


    return {

        id:
            createCardId(),

        suit,

        rank,

        value:
            getCardValue(
                rank
            )

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

function shuffleDeck(
    deck
) {

    if (
        !Array.isArray(
            deck
        )
    ) {

        return [];

    }


    const result =
        [...deck];


    /*
    Fisher-Yates.

    crypto.randomInt используется вместо
    Math.random(), чтобы перемешивание было
    качественным и непредсказуемым.
    */

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
TRUMP SUIT
=========================================================
*/

function getTrumpSuit(
    deck
) {

    if (
        !Array.isArray(
            deck
        ) ||
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
CAN BEAT
=========================================================

Durak rules:

1. Same suit:
   higher card beats lower card.

2. Trump beats non-trump.

3. Non-trump cannot beat trump.

4. Trump beats trump only if
   trump card has higher value.
=========================================================
*/

function canBeat(
    attackingCard,
    defendingCard,
    trumpSuit
) {

    if (
        !attackingCard ||
        !defendingCard
    ) {

        return false;

    }


    if (
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
    DEFENDING CARD IS TRUMP
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
    ATTACKING CARD IS TRUMP
    -----------------------------------------------------

    Another non-trump card cannot beat it.
    -----------------------------------------------------
    */

    return false;

}


/*
=========================================================
FIND CARD BY ID
=========================================================
*/

function findCardById(
    cards,
    cardId
) {

    if (
        !Array.isArray(
            cards
        )
    ) {

        return null;

    }


    return (
        cards.find(
            card =>
                card &&
                String(
                    card.id
                ) ===
                String(
                    cardId
                )
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
        !Array.isArray(
            cards
        )
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
                String(
                    card.id
                ) ===
                String(
                    cardId
                )
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


    const card =
        next.splice(
            index,
            1
        )[0];


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
        !Array.isArray(
            cards
        ) ||
        cards.length === 0
    ) {

        return null;

    }


    let lowest =
        null;


    for (
        const card
        of cards
    ) {

        if (!card) {

            continue;

        }


        if (!lowest) {

            lowest =
                card;

            continue;

        }


        const cardIsTrump =
            isTrump(
                card,
                trumpSuit
            );

        const lowestIsTrump =
            isTrump(
                lowest,
                trumpSuit
            );


        /*
        Non-trump is always lower
        than trump.
        */

        if (
            cardIsTrump !==
            lowestIsTrump
        ) {

            if (
                !cardIsTrump
            ) {

                lowest =
                    card;

            }

            continue;

        }


        if (
            card.value <
            lowest.value
        ) {

            lowest =
                card;

        }

    }


    return lowest;

}


/*
=========================================================
GET UNIQUE CARD VALUES
=========================================================
*/

function getUniqueRanks(
    cards
) {

    if (
        !Array.isArray(
            cards
        )
    ) {

        return [];

    }


    return [
        ...new Set(
            cards
                .filter(
                    Boolean
                )
                .map(
                    card =>
                        card.value
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
        !Array.isArray(
            deck
        )
    ) {

        return false;

    }


    if (
        deck.length !==
        DECK_SIZE
    ) {

        return false;

    }


    const ids =
        new Set();


    const combinations =
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
            !SUITS.includes(
                card.suit
            )
        ) {

            return false;

        }


        if (
            !RANKS.includes(
                card.rank
            )
        ) {

            return false;

        }


        if (
            ids.has(
                card.id
            )
        ) {

            return false;

        }


        ids.add(
            card.id
        );


        const combination =
            `${card.suit}:${card.rank}`;


        if (
            combinations.has(
                combination
            )
        ) {

            return false;

        }


        combinations.add(
            combination
        );


        if (
            card.value !==
            getCardValue(
                card.rank
            )
        ) {

            return false;

        }

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
