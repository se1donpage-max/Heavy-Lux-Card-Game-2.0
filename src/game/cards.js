"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME
CARDS
36 CARD DECK
DURAK
=========================================================

36 карт:

6  7  8  9  10  J  Q  K  A
×
4 масти

Порядок старшинства:
6 < 7 < 8 < 9 < 10 < J < Q < K < A

Козырь бьёт любую некозырную карту.
Козырь бьётся только более старшим козырем.

=========================================================
*/


/*
=========================================================
CONSTANTS
=========================================================
*/

const SUITS = [
    "hearts",
    "diamonds",
    "clubs",
    "spades"
];


const SUIT_SYMBOLS = {

    hearts:
        "♥",

    diamonds:
        "♦",

    clubs:
        "♣",

    spades:
        "♠"

};


const SUIT_NAMES = {

    hearts:
        "Червы",

    diamonds:
        "Бубны",

    clubs:
        "Трефы",

    spades:
        "Пики"

};


const RANKS = [

    {
        rank: "6",
        value: 6
    },

    {
        rank: "7",
        value: 7
    },

    {
        rank: "8",
        value: 8
    },

    {
        rank: "9",
        value: 9
    },

    {
        rank: "10",
        value: 10
    },

    {
        rank: "J",
        value: 11
    },

    {
        rank: "Q",
        value: 12
    },

    {
        rank: "K",
        value: 13
    },

    {
        rank: "A",
        value: 14
    }

];


const DECK_SIZE =
    SUITS.length *
    RANKS.length;


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
            const rankData
            of RANKS
        ) {

            deck.push({

                id:
                    `${rankData.rank}_${suit}`,

                suit,

                suitSymbol:
                    SUIT_SYMBOLS[suit],

                suitName:
                    SUIT_NAMES[suit],

                rank:
                    rankData.rank,

                value:
                    rankData.value

            });

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

    /*
     * Fisher-Yates.
     *
     * Никаких sort(() => Math.random() - 0.5),
     * потому что это даёт плохое распределение.
     */

    for (
        let i = deck.length - 1;
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

    const deck =
        createDeck();


    shuffleDeck(
        deck
    );


    return deck;

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


    /*
     * Последняя карта колоды
     * является открытым козырем.
     *
     * В движке эта карта уже остаётся
     * частью колоды и берётся последней.
     */

    const trumpCard =
        deck[deck.length - 1];


    return (
        trumpCard &&
        trumpCard.suit
            ? trumpCard.suit
            : null
    );

}


/*
=========================================================
CARD RANK
=========================================================
*/

function getCardValue(
    card
) {

    if (!card) {

        return null;

    }


    const value =
        Number(
            card.value
        );


    if (
        Number.isFinite(value)
    ) {

        return value;

    }


    /*
     * Защита от старого формата карты,
     * где могло использоваться rank.
     */

    const rank =
        String(
            card.rank ||
            ""
        ).toUpperCase();


    const found =
        RANKS.find(
            item =>
                item.rank === rank
        );


    return found
        ? found.value
        : null;

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

    if (
        !card ||
        !trumpSuit
    ) {

        return false;

    }


    return (
        String(card.suit) ===
        String(trumpSuit)
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


    const attackSuit =
        String(
            attackCard.suit
        );

    const defenseSuit =
        String(
            defenseCard.suit
        );


    const attackValue =
        getCardValue(
            attackCard
        );

    const defenseValue =
        getCardValue(
            defenseCard
        );


    if (
        attackValue === null ||
        defenseValue === null
    ) {

        return false;

    }


    const attackIsTrump =
        isTrump(
            attackCard,
            trumpSuit
        );


    const defenseIsTrump =
        isTrump(
            defenseCard,
            trumpSuit
        );


    /*
    -----------------------------------------------------
    SAME SUIT
    -----------------------------------------------------
    */

    if (
        attackSuit ===
        defenseSuit
    ) {

        return (
            defenseValue >
            attackValue
        );

    }


    /*
    -----------------------------------------------------
    NON-TRUMP ATTACK
    -----------------------------------------------------
    */

    if (
        !attackIsTrump &&
        defenseIsTrump
    ) {

        return true;

    }


    /*
    -----------------------------------------------------
    TRUMP CANNOT BE BEATEN
    *unless higher trump — handled above by same suit
    -----------------------------------------------------
    */

    return false;

}


/*
=========================================================
COMPARE CARDS
=========================================================
*/

function compareCards(
    first,
    second
) {

    const firstValue =
        getCardValue(
            first
        );

    const secondValue =
        getCardValue(
            second
        );


    if (
        firstValue === null &&
        secondValue === null
    ) {

        return 0;

    }


    if (
        firstValue === null
    ) {

        return -1;

    }


    if (
        secondValue === null
    ) {

        return 1;

    }


    if (
        firstValue <
        secondValue
    ) {

        return -1;

    }


    if (
        firstValue >
        secondValue
    ) {

        return 1;

    }


    return 0;

}


/*
=========================================================
GET LOWEST TRUMP
=========================================================
*/

function getLowestTrump(
    hand,
    trumpSuit
) {

    if (
        !Array.isArray(hand) ||
        !trumpSuit
    ) {

        return null;

    }


    const trumps =
        hand.filter(
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
                !lowest
            ) {

                return card;

            }


            return (
                getCardValue(card) <
                getCardValue(lowest)
                    ? card
                    : lowest
            );

        },
        null
    );

}


/*
=========================================================
VALIDATE CARD
=========================================================
*/

function isValidCard(
    card
) {

    if (
        !card ||
        typeof card !==
            "object"
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


    const value =
        getCardValue(
            card
        );


    if (
        !Number.isInteger(
            value
        )
    ) {

        return false;

    }


    return (
        value >= 6 &&
        value <= 14
    );

}


/*
=========================================================
DECK VALIDATION
=========================================================
*/

function validateDeck(
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


    const ids =
        new Set();


    for (
        const card
        of deck
    ) {

        if (
            !isValidCard(
                card
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

    }


    return true;

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    SUITS,

    SUIT_SYMBOLS,

    SUIT_NAMES,

    RANKS,

    DECK_SIZE,

    createDeck,

    shuffleDeck,

    createShuffledDeck,

    getTrumpSuit,

    getCardValue,

    isTrump,

    canBeat,

    compareCards,

    getLowestTrump,

    isValidCard,

    validateDeck

};
