"use strict";

/*
=========================================================
HEAVY LUX CARD
CONFIG
=========================================================
*/

const CONFIG = {

    /*
    =====================================================
    GAME
    =====================================================
    */

    GAME: {

        /*
        Дурак 36 карт
        */

        DECK_SIZE: 36,

        MAX_PLAYERS: 2,

        STARTING_HAND_SIZE: 6,

        MAX_ATTACK_CARDS: 6,

        /*
        Продолжительность reconnect grace period.
        Используем позже в Socket.IO layer.
        */

        RECONNECT_TIMEOUT_MS:
            60 * 1000

    },


    /*
    =====================================================
    CARDS
    =====================================================
    */

    CARDS: {

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

        /*
        Значения карт для сравнения
        */

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

    },


    /*
    =====================================================
    ECONOMY
    =====================================================
    */

    ECONOMY: {

        /*
        Допустимые ставки игры.

        ВАЖНО:
        этот массив должен соответствовать
        рабочей версии проекта.

        Если в старом server.js список ставок
        отличается — позже синхронизируем
        его с архивом.
        */

        STAKES: [

            100,
            500,
            1_000,
            5_000,
            10_000,
            50_000,
            100_000

        ]

    },


    /*
    =====================================================
    ROOMS
    =====================================================
    */

    ROOMS: {

        MAX_PLAYERS:
            2,

        ID_LENGTH:
            6

    },


    /*
    =====================================================
    SERVER
    =====================================================
    */

    SERVER: {

        PORT:
            Number(
                process.env.PORT
            ) || 10000,

        HOST:
            process.env.HOST ||
            "0.0.0.0"

    }

};


/*
=========================================================
LEGACY / SHORT ALIASES
=========================================================

Оставляем их специально.

Это позволит постепенно переносить старый
server.js, не переписывая весь проект за один раз.
=========================================================
*/

const {

    DECK_SIZE,
    MAX_PLAYERS,
    STARTING_HAND_SIZE,
    MAX_ATTACK_CARDS,
    RECONNECT_TIMEOUT_MS

} = CONFIG.GAME;


const {

    SUITS,
    RANKS,
    VALUES

} = CONFIG.CARDS;


const {

    STAKES

} = CONFIG.ECONOMY;


const {

    ID_LENGTH

} = CONFIG.ROOMS;


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
            `Invalid deck size: expected ${DECK_SIZE}, calculated ${calculatedDeckSize}`
        );

    }


    /*
    -----------------------------------------------------
    PLAYERS
    -----------------------------------------------------
    */

    if (
        MAX_PLAYERS !==
        2
    ) {

        errors.push(
            "Durak room must contain exactly 2 players"
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
    ROOM ID
    -----------------------------------------------------
    */

    if (
        ID_LENGTH < 4
    ) {

        errors.push(
            "ROOM ID is too short"
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
        STAKES.length === 0
    ) {

        errors.push(
            "No game stakes configured"
        );

    }


    /*
    -----------------------------------------------------
    THROW
    -----------------------------------------------------
    */

    if (
        errors.length > 0
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
VALIDATE ON STARTUP
=========================================================
*/

validateConfig();


/*
=========================================================
EXPORT
=========================================================
*/

module.exports = {

    CONFIG,

    /*
    Game
    */

    DECK_SIZE,

    MAX_PLAYERS,

    STARTING_HAND_SIZE,

    MAX_ATTACK_CARDS,

    RECONNECT_TIMEOUT_MS,

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

    /*
    Rooms
    */

    ID_LENGTH,

    /*
    Validation
    */

    validateConfig

};
