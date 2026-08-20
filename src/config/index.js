"use strict";

/*
=========================================================
HEAVY LUX CARD
CONFIGURATION
=========================================================
*/

const CONFIG = {

    APP: {
        NAME: "Heavy Lux Card",
        VERSION: "8.2.0"
    },


    /*
    =====================================================
    SERVER
    =====================================================
    */

    SERVER: {

        PORT:
            Number(
                process.env.PORT ||
                10000
            ),

        HOST:
            process.env.HOST ||
            "0.0.0.0",

        NODE_ENV:
            process.env.NODE_ENV ||
            "development",

        TEST_MODE:
            String(
                process.env.TEST_MODE ||
                "false"
            ).toLowerCase() === "true",

        TELEGRAM_BOT_TOKEN:
            process.env.TELEGRAM_BOT_TOKEN ||
            ""

    },


    /*
    =====================================================
    DATABASE
    =====================================================
    */

    DATABASE: {

        URL:
            process.env.DATABASE_URL ||
            "",

        SSL:
            process.env.DATABASE_SSL !== "false"

    },


    /*
    =====================================================
    SOCKET.IO
    =====================================================
    */

    SOCKET: {

        PING_INTERVAL:
            Number(
                process.env.SOCKET_PING_INTERVAL ||
                25000
            ),

        PING_TIMEOUT:
            Number(
                process.env.SOCKET_PING_TIMEOUT ||
                20000
            ),

        CONNECT_TIMEOUT:
            Number(
                process.env.SOCKET_CONNECT_TIMEOUT ||
                20000
            ),

        MAX_HTTP_BUFFER_SIZE:
            Number(
                process.env.SOCKET_MAX_HTTP_BUFFER_SIZE ||
                1e6
            )

    },


    /*
    =====================================================
    GAME
    =====================================================
    */

    GAME: {

        MAX_PLAYERS:
            2,

        STARTING_HAND_SIZE:
            6,

        MAX_ATTACK_CARDS:
            6,

        DECK_SIZE:
            36,

        DISCONNECT_GRACE_MS:
            2 * 60 * 1000,

        TELEGRAM_AUTH_MAX_AGE_MS:
            24 * 60 * 60 * 1000

    },


    /*
    =====================================================
    ECONOMY
    =====================================================
    */

    ECONOMY: {

        DEFAULT_BALANCE:
            1000,

        MIN_STAKE:
            100,

        MAX_STAKE:
            50000,

        STAKES: [
            100,
            250,
            500,
            1000,
            2000,
            5000,
            10000,
            50000
        ]

    },


    /*
    =====================================================
    XP
    =====================================================
    */

    XP: {

        WIN:
            100,

        LOSS:
            25,

        DRAW:
            50,

        LEVEL_BASE_XP:
            500

    },


    /*
    =====================================================
    VEHICLES
    =====================================================
    */

    VEHICLES: {

        DEFAULT_PRICE:
            100000,

        MIN_PRICE:
            1000,

        MAX_PRICE:
            100000000

    },


    /*
    =====================================================
    PLATES
    =====================================================
    */

    PLATES: {

        DEFAULT_PRICE:
            25000,

        MIN_PRICE:
            100,

        MAX_PRICE:
            100000000

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

    }

};


/*
=========================================================
LEVEL
=========================================================
*/

function getLevelProgress(
    xp
) {

    const safeXp =
        Math.max(
            0,
            Number(xp) || 0
        );


    const level =
        Math.max(
            1,
            Math.floor(
                safeXp /
                CONFIG.XP.LEVEL_BASE_XP
            ) + 1
        );


    const currentLevelXp =
        (
            level - 1
        ) *
        CONFIG.XP.LEVEL_BASE_XP;


    const nextLevelXp =
        level *
        CONFIG.XP.LEVEL_BASE_XP;


    const progressXp =
        safeXp -
        currentLevelXp;


    const requiredXp =
        nextLevelXp -
        currentLevelXp;


    const progress =
        requiredXp > 0
            ? Math.min(
                100,
                Math.floor(
                    (
                        progressXp /
                        requiredXp
                    ) * 100
                )
            )
            : 100;


    return {

        level,

        xp:
            safeXp,

        currentLevelXp,

        nextLevelXp,

        progressXp,

        requiredXp,

        progress

    };

}


function getLevelFromXP(
    xp
) {

    return getLevelProgress(
        xp
    ).level;

}


function getXPForLevel(
    level
) {

    const safeLevel =
        Math.max(
            1,
            Number(level) || 1
        );


    return (
        (
            safeLevel - 1
        ) *
        CONFIG.XP.LEVEL_BASE_XP
    );

}


/*
=========================================================
STAKE
=========================================================
*/

function isValidStake(
    stake
) {

    const value =
        Number(stake);


    if (
        !Number.isFinite(
            value
        )
    ) {

        return false;

    }


    return CONFIG.ECONOMY.STAKES
        .includes(value);

}


function getAvailableStakes() {

    return [
        ...CONFIG.ECONOMY.STAKES
    ];

}


/*
=========================================================
MONEY
=========================================================
*/

function money(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return 0;

    }


    return Math.max(
        0,
        Math.floor(number)
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    CONFIG,

    money,

    getLevelProgress,

    getLevelFromXP,

    getXPForLevel,

    isValidStake,

    getAvailableStakes

};
