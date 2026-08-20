"use strict";

/*
=========================================================
HEAVY LUX CARD
CARD ENGINE
36 CARDS
=========================================================
*/

const {
    CONFIG
} = require("../config");


const {
    SUITS,
    RANKS,
    VALUES
} = CONFIG.CARDS;


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
            `${rank}${suit}`,

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
FISHER-YATES
=========================================================
*/

function shuffle(
    cards
) {

    const deck =
        Array.isArray(cards)
            ? [...cards]
            : [];

    for (
        let i =
            deck.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            deck[i],
            deck[j]
        ] = [
            deck[j],
            deck[i]
        ];

    }

    return deck;

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

    if (!card) {
        return false;
    }

    return (
        card.suit ===
        trumpSuit
    );

}


/*
=========================================================
CAN BEAT
=========================================================
CARD A = DEFENDING CARD
CARD B = ATTACKING CARD
=========================================================
*/

function canBeat(
    defendingCard,
    attackingCard,
    trumpSuit
) {

    if (
        !defendingCard ||
        !attackingCard ||
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
        defendingCard.suit ===
        attackingCard.suit
    ) {

        return (
            Number(defendingCard.value) >
            Number(attackingCard.value)
        );

    }


    /*
    -----------------------------------------------------
    TRUMP BEATS NON-TRUMP
    -----------------------------------------------------
    */

    if (
        defendingCard.suit ===
        trumpSuit &&
        attackingCard.suit !==
        trumpSuit
    ) {

        return true;

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
GET LOWEST TRUMP
=========================================================
*/

function getLowestTrump(
    cards,
    trumpSuit
) {

    if (
        !Array.isArray(cards)
    ) {

        return null;

    }

    const trumps =
        cards.filter(
            card =>
                isTrump(
                    card,
                    trumpSuit
                )
        );

    if (
        trumps.length === 0
    ) {

        return null;

    }

    return trumps.reduce(
        (
            lowest,
            card
        ) => {

            if (
                !lowest ||
                Number(card.value) <
                Number(lowest.value)
            ) {

                return card;

            }

            return lowest;

        },
        null
    );

}


/*
=========================================================
FIND CARD BY ID
=========================================================
*/

function findCard(
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

function removeCard(
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

    const nextCards =
        [
            ...cards
        ];

    const [
        card
    ] =
        nextCards.splice(
            index,
            1
        );

    return {

        card,

        cards:
            nextCards

    };

}


/*
=========================================================
HAS CARD
=========================================================
*/

function hasCard(
    cards,
    cardId
) {

    return (
        Array.isArray(cards) &&
        cards.some(
            card =>
                card &&
                card.id ===
                cardId
        )
    );

}


/*
=========================================================
GET CARD VALUE
=========================================================
*/

function getCardValue(
    card
) {

    if (!card) {
        return 0;
    }

    if (
        Number.isFinite(
            Number(card.value)
        )
    ) {

        return Number(
            card.value
        );

    }

    return (
        VALUES[card.rank] ||
        0
    );

}


/*
=========================================================
GET CARDS OF RANK
=========================================================
*/

function getCardsOfRank(
    cards,
    rank
) {

    if (
        !Array.isArray(cards)
    ) {

        return [];

    }

    return cards.filter(
        card =>
            card &&
            card.rank ===
            rank
    );

}


/*
=========================================================
GET RANKS ON TABLE
=========================================================
*/

function getRanksOnTable(
    table
) {

    if (
        !Array.isArray(table)
    ) {

        return [];

    }

    const ranks =
        table
            .map(
                item => {

                    if (
                        item &&
                        item.rank
                    ) {

                        return item.rank;

                    }

                    if (
                        item &&
                        item.card &&
                        item.card.rank
                    ) {

                        return item.card.rank;

                    }

                    return null;

                }
            )
            .filter(Boolean);

    return [
        ...new Set(
            ranks
        )
    ];

}


/*
=========================================================
CAN ATTACK WITH CARD
=========================================================
A CARD MAY BE PLAYED ON ATTACK IF ITS RANK EXISTS
ON THE TABLE.
=========================================================
*/

function canAttackWithCard(
    card,
    table
) {

    if (!card) {
        return false;
    }

    const ranks =
        getRanksOnTable(
            table
        );

    /*
    -----------------------------------------------------
    EMPTY TABLE
    -----------------------------------------------------
    */

    if (
        ranks.length === 0
    ) {

        return true;

    }

    return ranks.includes(
        card.rank
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

    createShuffledDeck,

    shuffle,

    isTrump,

    canBeat,

    getLowestTrump,

    findCard,

    removeCard,

    hasCard,

    getCardValue,

    getCardsOfRank,

    getRanksOnTable,

    canAttackWithCard

};
