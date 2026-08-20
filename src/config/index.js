"use strict";

/*
=========================================================
HEAVY LUX CARD
CONFIG
=========================================================
*/

const GAME = {
    DECK_SIZE: 36,
    MAX_PLAYERS_PER_ROOM: 2,
    STARTING_HAND_SIZE: 6,
    MAX_ATTACK_CARDS: 6,
    DISCONNECT_GRACE_MS: 2 * 60 * 1000
};


const CARDS = {
    SUITS: [
        "♠",
        "♥",
        "♦",
        "♣"
    ],

    RANKS: [
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
        "A"
    ],

    VALUES: {
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        "J": 11,
        "Q": 12,
        "K": 13,
        "A": 14
    }
};


const ECONOMY = {
    STAKES: [
        100,
        250,
        500,
        1000,
        2000,
        5000,
        10000,
        50000
    ],

    DEFAULT_BALANCE: 1000,

    XP_WIN: 100,
    XP_LOSS: 25,
    XP_DRAW: 50,

    LEVEL_BASE_XP: 500
};


const ROOMS = {
    ID_LENGTH: 6,
    MAX_PLAYERS:
        GAME.MAX_PLAYERS_PER_ROOM
};


const SERVER = {
    PORT:
        Number(
            process.env.PORT || 10000
        ),

    HOST:
        process.env.HOST ||
        "0.0.0.0"
};


const TELEGRAM = {
    MAX_AGE_SECONDS:
        24 * 60 * 60
};


const CONFIG = {
    GAME,
    CARDS,
    ECONOMY,
    ROOMS,
    SERVER,
    TELEGRAM
};


/*
=========================================================
LEGACY / SHORT ALIASES
=========================================================
*/

const {
    DECK_SIZE,
    MAX_PLAYERS_PER_ROOM,
    STARTING_HAND_SIZE,
    MAX_ATTACK_CARDS,
    DISCONNECT_GRACE_MS
} = GAME;


const {
    SUITS,
    RANKS,
    VALUES
} = CARDS;


const {
    STAKES,
    DEFAULT_BALANCE,
    XP_WIN,
    XP_LOSS,
    XP_DRAW,
    LEVEL_BASE_XP
} = ECONOMY;


const {
    ID_LENGTH
} = ROOMS;


const {
    PORT,
    HOST
} = SERVER;


const {
    MAX_AGE_SECONDS:
        TELEGRAM_MAX_AGE_SECONDS
} = TELEGRAM;


/*
=========================================================
VALIDATION
=========================================================
*/

function validateConfig() {

    if (
        SUITS.length *
        RANKS.length !==
        DECK_SIZE
    ) {
        throw new Error(
            "Invalid deck configuration"
        );
    }


    if (
        MAX_PLAYERS_PER_ROOM !== 2
    ) {
        throw new Error(
            "Durak requires exactly 2 players"
        );
    }


    if (
        STARTING_HAND_SIZE !== 6
    ) {
        throw new Error(
            "Starting hand must contain 6 cards"
        );
    }


    if (
        MAX_ATTACK_CARDS !== 6
    ) {
        throw new Error(
            "Maximum attack must be 6 cards"
        );
    }


    if (
        !Array.isArray(STAKES) ||
        STAKES.length === 0
    ) {
        throw new Error(
            "No stakes configured"
        );
    }

    return true;
}


validateConfig();


module.exports = {

    CONFIG,

    GAME,
    CARDS,
    ECONOMY,
    ROOMS,
    SERVER,
    TELEGRAM,

    DECK_SIZE,
    MAX_PLAYERS:
        MAX_PLAYERS_PER_ROOM,
    MAX_PLAYERS_PER_ROOM,
    STARTING_HAND_SIZE,
    MAX_ATTACK_CARDS,
    DISCONNECT_GRACE_MS,

    SUITS,
    RANKS,
    VALUES,

    STAKES,
    DEFAULT_BALANCE,
    XP_WIN,
    XP_LOSS,
    XP_DRAW,
    LEVEL_BASE_XP,

    ID_LENGTH,

    PORT,
    HOST,

    TELEGRAM_MAX_AGE_SECONDS,

    validateConfig

};
