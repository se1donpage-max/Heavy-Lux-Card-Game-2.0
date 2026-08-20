"use strict";

/*
=========================================================
HEAVY LUX CARD
DATABASE
PLAYERS REPOSITORY
=========================================================
*/

const {
    query
} = require("./db");


/*
=========================================================
CREATE / GET PLAYER
=========================================================
*/

async function getPlayerByTelegramId(
    telegramId
) {

    const result =
        await query(
            `
            SELECT *
            FROM players
            WHERE telegram_id = $1
            LIMIT 1
            `,
            [
                String(
                    telegramId
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
GET PLAYER BY PLAYER ID
=========================================================
*/

async function getPlayerById(
    playerId
) {

    const result =
        await query(
            `
            SELECT *
            FROM players
            WHERE player_id = $1
            LIMIT 1
            `,
            [
                String(
                    playerId
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
CREATE PLAYER
=========================================================
*/

async function createPlayer(
    {
        telegramId,
        playerId,
        name = "Player",
        username = null
    }
) {

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
                String(
                    telegramId
                ),

                String(
                    playerId
                ),

                String(
                    name ||
                    "Player"
                ),

                username
                    ? String(username)
                    : null
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
*/

async function getOrCreatePlayer(
    {
        telegramId,
        playerId,
        name = "Player",
        username = null
    }
) {

    let player =
        await getPlayerByTelegramId(
            telegramId
        );

    if (player) {

        return player;

    }


    player =
        await createPlayer(
            {
                telegramId,
                playerId,
                name,
                username
            }
        );

    return player;

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

    const result =
        await query(
            `
            UPDATE players
            SET
                name =
                    COALESCE(
                        $2,
                        name
                    ),

                username =
                    COALESCE(
                        $3,
                        username
                    ),

                updated_at =
                    NOW()

            WHERE player_id = $1

            RETURNING *
            `,
            [
                String(
                    playerId
                ),

                name === undefined
                    ? null
                    : String(name),

                username === undefined
                    ? null
                    : String(username)
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

    const result =
        await query(
            `
            SELECT
                balance,
                reserved_balance
            FROM players
            WHERE player_id = $1
            LIMIT 1
            `,
            [
                String(
                    playerId
                )
            ]
        );

    if (
        !result.rows[0]
    ) {

        return null;

    }

    return {

        balance:
            Number(
                result.rows[0].balance
            ),

        reservedBalance:
            Number(
                result.rows[0].reserved_balance
            )

    };

}


/*
=========================================================
UPDATE XP / LEVEL
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

    const result =
        await query(
            `
            UPDATE players
            SET

                xp =
                    COALESCE(
                        $2,
                        xp
                    ),

                level =
                    COALESCE(
                        $3,
                        level
                    ),

                games_played =
                    COALESCE(
                        $4,
                        games_played
                    ),

                wins =
                    COALESCE(
                        $5,
                        wins
                    ),

                losses =
                    COALESCE(
                        $6,
                        losses
                    ),

                draws =
                    COALESCE(
                        $7,
                        draws
                    ),

                updated_at =
                    NOW()

            WHERE player_id = $1

            RETURNING *
            `,
            [
                String(
                    playerId
                ),

                xp === undefined
                    ? null
                    : Number(xp),

                level === undefined
                    ? null
                    : Number(level),

                gamesPlayed === undefined
                    ? null
                    : Number(gamesPlayed),

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


    return {

        playerId:
            player.player_id,

        telegramId:
            player.telegram_id,

        name:
            player.name,

        username:
            player.username,

        balance:
            Number(
                player.balance
            ),

        reservedBalance:
            Number(
                player.reserved_balance
            ),

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

    getPlayerProfile

};
