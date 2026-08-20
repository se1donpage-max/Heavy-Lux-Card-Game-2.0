"use strict";

/*
=========================================================
HEAVY LUX CARD
DATABASE
PLAYERS REPOSITORY
=========================================================

Ответственность:

- поиск игрока;
- создание игрока;
- безопасный get-or-create;
- профиль;
- баланс;
- XP / уровень;
- игровая статистика.

Деньги НЕ изменяются здесь напрямую.

Для денежных операций используется:
    src/economy/wallet.js

=========================================================
*/

const {
    query
} = require("./db");


/*
=========================================================
NORMALIZE ID
=========================================================
*/

function normalizeId(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return null;

    }

    const id =
        String(
            value
        ).trim();

    return id || null;

}


/*
=========================================================
NORMALIZE NAME
=========================================================
*/

function normalizeName(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "Player";

    }

    const name =
        String(
            value
        ).trim();

    return (
        name ||
        "Player"
    );

}


/*
=========================================================
NORMALIZE USERNAME
=========================================================
*/

function normalizeUsername(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return null;

    }

    const username =
        String(
            value
        ).trim();

    return (
        username ||
        null
    );

}


/*
=========================================================
GET PLAYER BY TELEGRAM ID
=========================================================
*/

async function getPlayerByTelegramId(
    telegramId
) {

    const id =
        normalizeId(
            telegramId
        );

    if (!id) {

        return null;

    }

    const result =
        await query(
            `
            SELECT *
            FROM players
            WHERE telegram_id = $1
            LIMIT 1
            `,
            [
                id
            ]
        );

    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
GET PLAYER BY PLAYER ID
=========================================================
*/

async function getPlayerById(
    playerId
) {

    const id =
        normalizeId(
            playerId
        );

    if (!id) {

        return null;

    }

    const result =
        await query(
            `
            SELECT *
            FROM players
            WHERE player_id = $1
            LIMIT 1
            `,
            [
                id
            ]
        );

    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
CREATE PLAYER
=========================================================
*/

async function createPlayer(
    {
        telegramId,
        playerId,
        name = "Player",
        username = null
    } = {}
) {

    const telegram =
        normalizeId(
            telegramId
        );

    const player =
        normalizeId(
            playerId
        );

    if (!telegram) {

        throw new Error(
            "telegramId is required"
        );

    }

    if (!player) {

        throw new Error(
            "playerId is required"
        );

    }


    const result =
        await query(
            `
            INSERT INTO players (
                telegram_id,
                player_id,
                name,
                username
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            RETURNING *
            `,
            [
                telegram,

                player,

                normalizeName(
                    name
                ),

                normalizeUsername(
                    username
                )
            ]
        );

    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
GET OR CREATE PLAYER
=========================================================

Ключевой момент:

INSERT ... ON CONFLICT DO NOTHING

Защищает от ситуации:

socket #1:
    SELECT -> нет игрока

socket #2:
    SELECT -> нет игрока

socket #1:
    INSERT

socket #2:
    INSERT -> UNIQUE ERROR

После INSERT повторно читаем игрока.

=========================================================
*/

async function getOrCreatePlayer(
    {
        telegramId,
        playerId,
        name = "Player",
        username = null
    } = {}
) {

    const telegram =
        normalizeId(
            telegramId
        );

    const player =
        normalizeId(
            playerId
        );

    if (!telegram) {

        throw new Error(
            "telegramId is required"
        );

    }

    if (!player) {

        throw new Error(
            "playerId is required"
        );

    }


    /*
    -----------------------------------------------------
    СНАЧАЛА ПРОБУЕМ НАЙТИ ПО TELEGRAM
    -----------------------------------------------------
    */

    const existing =
        await getPlayerByTelegramId(
            telegram
        );

    if (existing) {

        /*
         * Если игрок уже существует,
         * playerId из нового подключения
         * НЕ перезаписываем.
         */

        return existing;

    }


    /*
    -----------------------------------------------------
    ATOMIC INSERT
    -----------------------------------------------------
    */

    const inserted =
        await query(
            `
            INSERT INTO players (
                telegram_id,
                player_id,
                name,
                username
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            ON CONFLICT (
                telegram_id
            )
            DO NOTHING
            RETURNING *
            `,
            [
                telegram,

                player,

                normalizeName(
                    name
                ),

                normalizeUsername(
                    username
                )
            ]
        );


    if (
        inserted.rows[0]
    ) {

        return inserted.rows[0];

    }


    /*
    -----------------------------------------------------
    КОНФЛИКТ СОЗДАНИЯ
    -----------------------------------------------------

    Другой запрос успел создать игрока.
    Получаем уже существующую запись.
    -----------------------------------------------------
    */

    const createdByOtherRequest =
        await getPlayerByTelegramId(
            telegram
        );

    if (
        createdByOtherRequest
    ) {

        return createdByOtherRequest;

    }


    throw new Error(
        "Failed to create or load player"
    );

}


/*
=========================================================
UPDATE PLAYER PROFILE
=========================================================
*/

async function updatePlayerProfile(
    playerId,
    {
        name,
        username
    } = {}
) {

    const id =
        normalizeId(
            playerId
        );

    if (!id) {

        throw new Error(
            "playerId is required"
        );

    }


    /*
    COALESCE здесь не позволяет
    случайно заменить существующее значение
    на NULL, если параметр не передан.
    */

    const result =
        await query(
            `
            UPDATE players
            SET

                name =
                    CASE
                        WHEN $2::text IS NULL
                            THEN name
                        ELSE $2::text
                    END,

                username =
                    CASE
                        WHEN $3::text IS NULL
                            THEN username
                        ELSE $3::text
                    END,

                updated_at =
                    NOW()

            WHERE player_id = $1

            RETURNING *
            `,
            [
                id,

                name === undefined
                    ? null
                    : normalizeName(
                        name
                    ),

                username === undefined
                    ? null
                    : normalizeUsername(
                        username
                    )
            ]
        );


    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
GET BALANCE
=========================================================
*/

async function getBalance(
    playerId
) {

    const id =
        normalizeId(
            playerId
        );

    if (!id) {

        return null;

    }


    const result =
        await query(
            `
            SELECT
                player_id,
                balance,
                reserved_balance
            FROM players
            WHERE player_id = $1
            LIMIT 1
            `,
            [
                id
            ]
        );


    const player =
        result.rows[0];


    if (!player) {

        return null;

    }


    return {

        playerId:
            player.player_id,

        balance:
            Number(
                player.balance
            ),

        reservedBalance:
            Number(
                player.reserved_balance
            ),

        availableBalance:
            Number(
                player.balance
            ) -
            Number(
                player.reserved_balance
            )

    };

}


/*
=========================================================
UPDATE XP / LEVEL / STATISTICS
=========================================================
*/

async function updatePlayerProgress(
    playerId,
    {
        xp,
        level,
        gamesPlayed,
        wins,
        losses,
        draws
    } = {}
) {

    const id =
        normalizeId(
            playerId
        );

    if (!id) {

        throw new Error(
            "playerId is required"
        );

    }


    const result =
        await query(
            `
            UPDATE players
            SET

                xp =
                    COALESCE(
                        $2::bigint,
                        xp
                    ),

                level =
                    COALESCE(
                        $3::integer,
                        level
                    ),

                games_played =
                    COALESCE(
                        $4::integer,
                        games_played
                    ),

                wins =
                    COALESCE(
                        $5::integer,
                        wins
                    ),

                losses =
                    COALESCE(
                        $6::integer,
                        losses
                    ),

                draws =
                    COALESCE(
                        $7::integer,
                        draws
                    ),

                updated_at =
                    NOW()

            WHERE player_id = $1

            RETURNING *
            `,
            [
                id,

                xp === undefined
                    ? null
                    : Number(xp),

                level === undefined
                    ? null
                    : Number(level),

                gamesPlayed === undefined
                    ? null
                    : Number(
                        gamesPlayed
                    ),

                wins === undefined
                    ? null
                    : Number(wins),

                losses === undefined
                    ? null
                    : Number(losses),

                draws === undefined
                    ? null
                    : Number(draws)
            ]
        );


    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
INCREMENT GAME STATISTICS
=========================================================

Используем атомарные SQL-инкременты.

Это лучше, чем:

SELECT
+
JS + 1
+
UPDATE

потому что два одновременных завершения игры
не смогут потерять одно из изменений.

=========================================================
*/

async function incrementPlayerStats(
    playerId,
    {
        gamesPlayed = 0,
        wins = 0,
        losses = 0,
        draws = 0,
        xp = 0
    } = {}
) {

    const id =
        normalizeId(
            playerId
        );

    if (!id) {

        throw new Error(
            "playerId is required"
        );

    }


    const games =
        Number(
            gamesPlayed
        );

    const winCount =
        Number(
            wins
        );

    const lossCount =
        Number(
            losses
        );

    const drawCount =
        Number(
            draws
        );

    const xpAmount =
        Number(
            xp
        );


    if (
        !Number.isSafeInteger(games) ||
        !Number.isSafeInteger(winCount) ||
        !Number.isSafeInteger(lossCount) ||
        !Number.isSafeInteger(drawCount) ||
        !Number.isSafeInteger(xpAmount)
    ) {

        throw new Error(
            "Invalid player statistics"
        );

    }


    if (
        games < 0 ||
        winCount < 0 ||
        lossCount < 0 ||
        drawCount < 0 ||
        xpAmount < 0
    ) {

        throw new Error(
            "Player statistics cannot be negative"
        );

    }


    const result =
        await query(
            `
            UPDATE players
            SET

                games_played =
                    games_played + $2,

                wins =
                    wins + $3,

                losses =
                    losses + $4,

                draws =
                    draws + $5,

                xp =
                    xp + $6,

                updated_at =
                    NOW()

            WHERE player_id = $1

            RETURNING *
            `,
            [
                id,

                games,

                winCount,

                lossCount,

                drawCount,

                xpAmount
            ]
        );


    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
GET FULL PLAYER
=========================================================
*/

async function getPlayerProfile(
    playerId
) {

    const player =
        await getPlayerById(
            playerId
        );


    if (!player) {

        return null;

    }


    const balance =
        Number(
            player.balance
        );

    const reservedBalance =
        Number(
            player.reserved_balance
        );


    return {

        playerId:
            player.player_id,

        telegramId:
            player.telegram_id,

        name:
            player.name,

        username:
            player.username,

        balance,

        reservedBalance,

        availableBalance:
            balance -
            reservedBalance,

        xp:
            Number(
                player.xp
            ),

        level:
            Number(
                player.level
            ),

        gamesPlayed:
            Number(
                player.games_played
            ),

        wins:
            Number(
                player.wins
            ),

        losses:
            Number(
                player.losses
            ),

        draws:
            Number(
                player.draws
            ),

        createdAt:
            player.created_at,

        updatedAt:
            player.updated_at

    };

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    getPlayerByTelegramId,

    getPlayerById,

    createPlayer,

    getOrCreatePlayer,

    updatePlayerProfile,

    getBalance,

    updatePlayerProgress,

    incrementPlayerStats,

    getPlayerProfile

};
