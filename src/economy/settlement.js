"use strict";

/*
=========================================================
HEAVY LUX CARD
ECONOMY
GAME SETTLEMENT
=========================================================
*/

const crypto = require("crypto");

const {
    withTransaction
} = require("../database/db");


/*
=========================================================
HELPERS
=========================================================
*/

function makeTransactionId() {

    return crypto.randomUUID();

}


function toAmount(value) {

    const amount =
        Number(value);

    if (
        !Number.isSafeInteger(amount) ||
        amount < 0
    ) {

        throw new Error(
            "Invalid settlement amount"
        );

    }

    return amount;

}


/*
=========================================================
SETTLE GAME
=========================================================
*/

async function settleGame({
    gameId,
    winnerPlayerId,
    loserPlayerId,
    stake
}) {

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }

    if (!winnerPlayerId) {

        throw new Error(
            "winnerPlayerId is required"
        );

    }

    if (!loserPlayerId) {

        throw new Error(
            "loserPlayerId is required"
        );

    }

    if (
        String(winnerPlayerId) ===
        String(loserPlayerId)
    ) {

        throw new Error(
            "Winner and loser cannot be the same player"
        );

    }


    const amount =
        toAmount(stake);


    if (amount <= 0) {

        throw new Error(
            "Stake must be greater than zero"
        );

    }


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK / CHECK SETTLEMENT
            -------------------------------------------------
            */

            const settlementResult =
                await client.query(
                    `
                    SELECT
                        game_id,
                        status,
                        winner_player_id,
                        loser_player_id,
                        stake,
                        winner_amount,
                        loser_amount,
                        settled_at
                    FROM game_settlements
                    WHERE game_id = $1
                    FOR UPDATE
                    `,
                    [
                        String(
                            gameId
                        )
                    ]
                );


            const existing =
                settlementResult.rows[0];


            /*
            -------------------------------------------------
            IDEMPOTENCY
            -------------------------------------------------
            */

            if (
                existing &&
                existing.status ===
                "settled"
            ) {

                return {

                    alreadySettled:
                        true,

                    gameId:
                        existing.game_id,

                    winnerPlayerId:
                        existing.winner_player_id,

                    loserPlayerId:
                        existing.loser_player_id,

                    stake:
                        Number(
                            existing.stake
                        ),

                    winnerAmount:
                        Number(
                            existing.winner_amount
                        ),

                    loserAmount:
                        Number(
                            existing.loser_amount
                        ),

                    settledAt:
                        existing.settled_at

                };

            }


            /*
            -------------------------------------------------
            CREATE / RESET SETTLEMENT RECORD
            -------------------------------------------------
            */

            if (!existing) {

                await client.query(
                    `
                    INSERT INTO game_settlements (
                        game_id,
                        status,
                        winner_player_id,
                        loser_player_id,
                        stake,
                        winner_amount,
                        loser_amount
                    )
                    VALUES (
                        $1,
                        'processing',
                        $2,
                        $3,
                        $4,
                        0,
                        0
                    )
                    `,
                    [
                        String(
                            gameId
                        ),

                        String(
                            winnerPlayerId
                        ),

                        String(
                            loserPlayerId
                        ),

                        amount
                    ]
                );

            } else {

                await client.query(
                    `
                    UPDATE game_settlements
                    SET
                        status = 'processing',

                        winner_player_id = $2,

                        loser_player_id = $3,

                        stake = $4,

                        updated_at =
                            COALESCE(
                                updated_at,
                                NOW()
                            )

                    WHERE game_id = $1
                    `,
                    [
                        String(
                            gameId
                        ),

                        String(
                            winnerPlayerId
                        ),

                        String(
                            loserPlayerId
                        ),

                        amount
                    ]
                );

            }


            /*
            -------------------------------------------------
            LOCK BOTH PLAYERS
            -------------------------------------------------
            */

            const ids = [
                String(winnerPlayerId),
                String(loserPlayerId)
            ].sort();


            const playersResult =
                await client.query(
                    `
                    SELECT
                        player_id,
                        balance,
                        reserved_balance,
                        xp,
                        level,
                        games_played,
                        wins,
                        losses,
                        draws
                    FROM players
                    WHERE player_id = ANY($1::text[])
                    ORDER BY player_id
                    FOR UPDATE
                    `,
                    [
                        ids
                    ]
                );


            if (
                playersResult.rows.length !== 2
            ) {

                throw new Error(
                    "Winner or loser not found"
                );

            }


            const players =
                new Map(
                    playersResult.rows.map(
                        player => [
                            player.player_id,
                            player
                        ]
                    )
                );


            const winner =
                players.get(
                    String(
                        winnerPlayerId
                    )
                );

            const loser =
                players.get(
                    String(
                        loserPlayerId
                    )
                );


            /*
            -------------------------------------------------
            CHECK RESERVED FUNDS
            -------------------------------------------------
            */

            const loserReserved =
                Number(
                    loser.reserved_balance
                );


            if (
                loserReserved <
                amount
            ) {

                throw new Error(
                    "Loser reserved balance is insufficient"
                );

            }


            const winnerReserved =
                Number(
                    winner.reserved_balance
                );


            if (
                winnerReserved <
                amount
            ) {

                throw new Error(
                    "Winner reserved balance is insufficient"
                );

            }


            /*
            -------------------------------------------------
            MONEY
            -------------------------------------------------

            Each player reserved the stake.

            We release the reservation and give the
            winning stake back plus the losing stake.

            Result:

            winner:
                balance + stake
                reserved - stake

            loser:
                balance unchanged
                reserved - stake

            -------------------------------------------------
            */

            const winnerBalanceBefore =
                Number(
                    winner.balance
                );

            const loserBalanceBefore =
                Number(
                    loser.balance
                );


            const winnerBalanceAfter =
                winnerBalanceBefore +
                amount;


            const loserBalanceAfter =
                loserBalanceBefore;


            /*
            -------------------------------------------------
            UPDATE WINNER
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET

                    balance =
                        balance + $2,

                    reserved_balance =
                        reserved_balance - $2,

                    games_played =
                        games_played + 1,

                    wins =
                        wins + 1,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        winnerPlayerId
                    ),

                    amount
                ]
            );


            /*
            -------------------------------------------------
            UPDATE LOSER
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET

                    reserved_balance =
                        reserved_balance - $2,

                    games_played =
                        games_played + 1,

                    losses =
                        losses + 1,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        loserPlayerId
                    ),

                    amount
                ]
            );


            /*
            -------------------------------------------------
            TRANSACTION: WINNER
            -------------------------------------------------
            */

            const winnerTransactionId =
                makeTransactionId();


            await client.query(
                `
                INSERT INTO game_transactions (
                    transaction_id,
                    game_id,
                    player_id,
                    type,
                    amount,
                    balance_before,
                    balance_after,
                    metadata
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'game_win',
                    $4,
                    $5,
                    $6,
                    $7::jsonb
                )
                `,
                [
                    winnerTransactionId,

                    String(
                        gameId
                    ),

                    String(
                        winnerPlayerId
                    ),

                    amount,

                    winnerBalanceBefore,

                    winnerBalanceAfter,

                    JSON.stringify({

                        loserPlayerId:
                            String(
                                loserPlayerId
                            ),

                        stake:
                            amount

                    })
                ]
            );


            /*
            -------------------------------------------------
            TRANSACTION: LOSER
            -------------------------------------------------
            */

            const loserTransactionId =
                makeTransactionId();


            await client.query(
                `
                INSERT INTO game_transactions (
                    transaction_id,
                    game_id,
                    player_id,
                    type,
                    amount,
                    balance_before,
                    balance_after,
                    metadata
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    'game_loss',
                    $4,
                    $5,
                    $6,
                    $7::jsonb
                )
                `,
                [
                    loserTransactionId,

                    String(
                        gameId
                    ),

                    String(
                        loserPlayerId
                    ),

                    -amount,

                    loserBalanceBefore,

                    loserBalanceAfter,

                    JSON.stringify({

                        winnerPlayerId:
                            String(
                                winnerPlayerId
                            ),

                        stake:
                            amount

                    })
                ]
            );


            /*
            -------------------------------------------------
            MARK SETTLED
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE game_settlements
                SET

                    status =
                        'settled',

                    winner_player_id =
                        $2,

                    loser_player_id =
                        $3,

                    stake =
                        $4,

                    winner_amount =
                        $4,

                    loser_amount =
                        0,

                    settled_at =
                        NOW(),

                    updated_at =
                        NOW()

                WHERE game_id = $1
                `,
                [
                    String(
                        gameId
                    ),

                    String(
                        winnerPlayerId
                    ),

                    String(
                        loserPlayerId
                    ),

                    amount
                ]
            );


            /*
            -------------------------------------------------
            RESULT
            -------------------------------------------------
            */

            return {

                alreadySettled:
                    false,

                gameId:
                    String(
                        gameId
                    ),

                winnerPlayerId:
                    String(
                        winnerPlayerId
                    ),

                loserPlayerId:
                    String(
                        loserPlayerId
                    ),

                stake:
                    amount,

                winnerAmount:
                    amount,

                loserAmount:
                    0,

                transactions: {

                    winner:
                        winnerTransactionId,

                    loser:
                        loserTransactionId

                },

                balances: {

                    winner:
                        winnerBalanceAfter,

                    loser:
                        loserBalanceAfter

                }

            };

        }
    );

}


/*
=========================================================
GET SETTLEMENT
=========================================================
*/

async function getSettlement(
    gameId
) {

    const {
        query
    } = require(
        "../database/db"
    );


    const result =
        await query(
            `
            SELECT
                *
            FROM game_settlements
            WHERE game_id = $1
            LIMIT 1
            `,
            [
                String(
                    gameId
                )
            ]
        );


    if (
        !result.rows[0]
    ) {

        return null;

    }


    const settlement =
        result.rows[0];


    return {

        gameId:
            settlement.game_id,

        status:
            settlement.status,

        winnerPlayerId:
            settlement.winner_player_id,

        loserPlayerId:
            settlement.loser_player_id,

        stake:
            Number(
                settlement.stake
            ),

        winnerAmount:
            Number(
                settlement.winner_amount
            ),

        loserAmount:
            Number(
                settlement.loser_amount
            ),

        createdAt:
            settlement.created_at,

        settledAt:
            settlement.settled_at

    };

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    settleGame,

    getSettlement

};
