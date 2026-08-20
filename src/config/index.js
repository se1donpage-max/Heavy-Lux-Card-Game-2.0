"use strict";

/*
=========================================================
HEAVY LUX CARD
CONFIG
=========================================================
*/

/*
=========================================================
GAME
=========================================================
*/

const GAME = {

    DECK_SIZE: 36,

    MAX_PLAYERS: 2,

    STARTING_HAND_SIZE: 6,

    MAX_ATTACK_CARDS: 6,

    DISCONNECT_GRACE_MS:
        2 * 60 * 1000

};


/*
=========================================================
CARDS
=========================================================
*/

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


/*
=========================================================
ECONOMY
=========================================================
*/

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

    DEFAULT_BALANCE:
        1000,

    XP_WIN:
        100,

    XP_LOSS:
        25,

    XP_DRAW:
        50,

    LEVEL_BASE_XP:
        500

};


/*
=========================================================
ROOMS
=========================================================
*/

const ROOMS = {

    MAX_PLAYERS:
        GAME.MAX_PLAYERS,

    ID_LENGTH:
        6

};


/*
=========================================================
SERVER
=========================================================
*/

const SERVER = {

    PORT:
        Number(
            process.env.PORT ||
            10000
        ),

    HOST:
        process.env.HOST ||
        "0.0.0.0"

};


/*
=========================================================
TELEGRAM
=========================================================
*/

const TELEGRAM = {

    MAX_AGE_SECONDS:
        24 * 60 * 60

};


/*
=========================================================
UNIFIED CONFIG
=========================================================
*/

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
LEGACY ALIASES
=========================================================

Они нужны для постепенного переноса старого server.js
без изменения игровой логики.
=========================================================
*/

const {

    DECK_SIZE,
    MAX_PLAYERS,
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

    MAX_PLAYERS: MAX_ROOM_PLAYERS,
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

    const errors = [];


    /*
    -----------------------------------------------------
    DECK
    -----------------------------------------------------
    */

    const calculatedDeckSize =
        SUITS.length *
        RANKS.length;


    if (
        calculatedDeckSize !==
        DECK_SIZE
    ) {

        errors.push(
            `Deck size mismatch: ${calculatedDeckSize} !== ${DECK_SIZE}`
        );

    }


    /*
    -----------------------------------------------------
    PLAYERS
    -----------------------------------------------------
    */

    if (
        MAX_PLAYERS !== 2
    ) {

        errors.push(
            "MAX_PLAYERS must be 2"
        );

    }


    /*
    -----------------------------------------------------
    HAND
    -----------------------------------------------------
    */

    if (
        STARTING_HAND_SIZE <= 0
    ) {

        errors.push(
            "STARTING_HAND_SIZE must be greater than 0"
        );

    }


    /*
    -----------------------------------------------------
    ATTACK
    -----------------------------------------------------
    */

    if (
        MAX_ATTACK_CARDS <= 0
    ) {

        errors.push(
            "MAX_ATTACK_CARDS must be greater than 0"
        );

    }


    /*
    -----------------------------------------------------
    STAKES
    -----------------------------------------------------
    */

    if (
        !Array.isArray(
            STAKES
        ) ||
        STAKES.length !== 8
    ) {

        errors.push(
            "Expected exactly 8 game stakes"
        );

    }


    /*
    -----------------------------------------------------
    DEFAULT BALANCE
    -----------------------------------------------------
    */

    if (
        DEFAULT_BALANCE < 0
    ) {

        errors.push(
            "DEFAULT_BALANCE cannot be negative"
        );

    }


    /*
    -----------------------------------------------------
    XP
    -----------------------------------------------------
    */

    if (
        XP_WIN < 0 ||
        XP_LOSS < 0 ||
        XP_DRAW < 0 ||
        LEVEL_BASE_XP <= 0
    ) {

        errors.push(
            "Invalid XP configuration"
        );

    }


    /*
    -----------------------------------------------------
    ROOM ID
    -----------------------------------------------------
    */

    if (
        ID_LENGTH < 4
    ) {

        errors.push(
            "ROOM ID length is too short"
        );

    }


    /*
    -----------------------------------------------------
    THROW
    -----------------------------------------------------
    */

    if (
        errors.length
    ) {

        throw new Error(
            "Invalid Heavy Lux configuration:\n" +
            errors
                .map(
                    error =>
                        `- ${error}`
                )
                .join("\n")
        );

    }


    return true;

}


/*
=========================================================
STARTUP VALIDATION
=========================================================
*/

validateConfig();


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    CONFIG,

    /*
    Unified sections
    */

    GAME,

    CARDS,

    ECONOMY,

    ROOMS,

    SERVER,

    TELEGRAM,

    /*
    Game
    */

    DECK_SIZE,

    MAX_PLAYERS,

    STARTING_HAND_SIZE,

    MAX_ATTACK_CARDS,

    DISCONNECT_GRACE_MS,

    /*
    Cards
    */

    SUITS,

    RANKS,

    VALUES,

    /*
    Economy
    */

    STAKES,

    DEFAULT_BALANCE,

    XP_WIN,

    XP_LOSS,

    XP_DRAW,

    LEVEL_BASE_XP,

    /*
    Rooms
    */

    MAX_ROOM_PLAYERS,

    ID_LENGTH,

    /*
    Server
    */

    PORT,

    HOST,

    /*
    Telegram
    */

    TELEGRAM_MAX_AGE_SECONDS,

    /*
    Validation
    */

    validateConfig

};
