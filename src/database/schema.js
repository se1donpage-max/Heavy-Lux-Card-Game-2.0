"use strict";

/*
=========================================================
HEAVY LUX CARD
ECONOMY
GAME SETTLEMENT
=========================================================

НАЗНАЧЕНИЕ:

1. Зафиксировать результат игры.
2. Безопасно обработать ставку.
3. Работать внутри PostgreSQL transaction.
4. Не допускать двойной выплаты.
5. Победитель получает весь банк.
6. При ничьей ставки возвращаются обоим.
7. Все изменения записываются в game_transactions.

ВАЖНО:

На момент начала игры stake каждого игрока
должен находиться в reserved_balance.

При победе:

    winner:
        reserved_balance -= stake
        balance += stake * 2

    loser:
        reserved_balance -= stake
        balance не меняется

При ничьей:

    оба:
        reserved_balance -= stake
        balance += stake

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


function toSafeInteger(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    if (
        !Number.isSafeInteger(
            number
        )
    ) {

        return fallback;

    }

    return number;

}


/*
=========================================================
VALIDATE GAME RESULT
=========================================================
*/

function validateSettlementResult(
    result
) {

    if (
        result !== "win" &&
        result !== "draw" &&
        result !== "forfeit"
    ) {

        throw new Error(
            "Invalid settlement result"
        );

    }

}


/*
=========================================================
GET SETTLEMENT
=========================================================
*/

async function getSettlement(
    gameId
) {

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }


    const result =
        await withTransaction(
            async client => {

                const queryResult =
                    await client.query(
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

                return (
                    queryResult.rows[0] ||
                    null
                );

            }
        );


    if (!result) {

        return null;

    }


    return {

        gameId:
            result.game_id,

        status:
            result.status,

        winnerPlayerId:
            result.winner_player_id,

        loserPlayerId:
            result.loser_player_id,

        stake:
            Number(
                result.stake
            ),

        winnerAmount:
            Number(
                result.winner_amount
            ),

        loserAmount:
            Number(
                result.loser_amount
            ),

        createdAt:
            result.created_at,

        settledAt:
            result.settled_at,

        updatedAt:
            result.updated_at

    };

}


/*
=========================================================
SETTLE GAME
=========================================================
*/

async function settleGame(
    {
        gameId,
        winnerPlayerId = null,
        loserPlayerId = null,
        stake,
        result = "win"
    }
) {

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }


    validateSettlementResult(
        result
    );


    const value =
        toSafeInteger(
            stake
        );


    if (
        value < 0
    ) {

        throw new Error(
            "Invalid stake"
        );

    }


    if (
        result === "win" ||
        result === "forfeit"
    ) {

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

    }


    if (
        result === "draw"
    ) {

        if (
            !winnerPlayerId &&
            !loserPlayerId
        ) {

            throw new Error(
                "Players are required for draw settlement"
            );

        }

    }


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK / CREATE SETTLEMENT
            -------------------------------------------------
            */

            const existingResult =
                await client.query(
                    `
                    SELECT
                        *
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
                existingResult.rows[0];


            /*
            -------------------------------------------------
            ALREADY SETTLED
            -------------------------------------------------
            */

            if (
                existing &&
                existing.status ===
                    "settled"
            ) {

                return {

                    ok: true,

                    alreadySettled:
                        true,

                    gameId:
                        existing.game_id,

                    status:
                        existing.status,

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
                        )

                };

            }


            /*
            -------------------------------------------------
            CREATE PENDING SETTLEMENT
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
                        'pending',
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

                        winnerPlayerId
                            ? String(
                                winnerPlayerId
                            )
                            : null,

                        loserPlayerId
                            ? String(
                                loserPlayerId
                            )
                            : null,

                        value
                    ]
                );

            }


            /*
            -------------------------------------------------
            DRAW
            -------------------------------------------------
            */

            if (
                result === "draw"
            ) {

                /*
                 * Для ничьей нам нужны
                 * оба игрока.
                 */

                if (
                    !winnerPlayerId ||
                    !loserPlayerId
                ) {

                    throw new Error(
                        "Both players are required for draw"
                    );

                }


                const ids = [

                    String(
                        winnerPlayerId
                    ),

                    String(
                        loserPlayerId
                    )

                ].sort();


                /*
                 * Блокируем обоих игроков.
                 */

                const playersResult =
                    await client.query(
                        `
                        SELECT
                            player_id,
                            balance,
                            reserved_balance
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
                    playersResult.rows.length !==
                    2
                ) {

                    throw new Error(
                        "Both players must exist"
                    );

                }


                const players =
                    new Map(
                        playersResult.rows.map(
                            player => [
                                String(
                                    player.player_id
                                ),
                                player
                            ]
                        )
                    );


                const first =
                    players.get(
                        String(
                            winnerPlayerId
                        )
                    );

                const second =
                    players.get(
                        String(
                            loserPlayerId
                        )
                    );


                /*
                 * Проверяем наличие
                 * зарезервированной ставки.
                 */

                if (
                    Number(
                        first.reserved_balance
                    ) <
                    value
                ) {

                    throw new Error(
                        "First player reserved balance is insufficient"
                    );

                }


                if (
                    Number(
                        second.reserved_balance
                    ) <
                    value
                ) {

                    throw new Error(
                        "Second player reserved balance is insufficient"
                    );

                }


                /*
                 * Возвращаем ставку первому игроку.
                 */

                await client.query(
                    `
                    UPDATE players
                    SET
                        balance =
                            balance + $2,

                        reserved_balance =
                            reserved_balance - $2,

                        updated_at =
                            NOW()

                    WHERE player_id = $1
                    `,
                    [
                        String(
                            winnerPlayerId
                        ),

                        value
                    ]
                );


                /*
                 * Возвращаем ставку второму игроку.
                 */

                await client.query(
                    `
                    UPDATE players
                    SET
                        balance =
                            balance + $2,

                        reserved_balance =
                            reserved_balance - $2,

                        updated_at =
                            NOW()

                    WHERE player_id = $1
                    `,
                    [
                        String(
                            loserPlayerId
                        ),

                        value
                    ]
                );


                /*
                 * Лог первого игрока.
                 */

                const firstTransactionId =
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
                        'draw_refund',
                        $4,
                        $5,
                        $6,
                        $7::jsonb
                    )
                    `,
                    [
                        firstTransactionId,

                        String(
                            gameId
                        ),

                        String(
                            winnerPlayerId
                        ),

                        value,

                        Number(
                            first.balance
                        ),

                        Number(
                            first.balance
                        ) + value,

                        JSON.stringify({

                            reason:
                                "draw",

                            reservedBefore:
                                Number(
                                    first.reserved_balance
                                ),

                            reservedAfter:
                                Number(
                                    first.reserved_balance
                                ) - value

                        })
                    ]
                );


                /*
                 * Лог второго игрока.
                 */

                const secondTransactionId =
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
                        'draw_refund',
                        $4,
                        $5,
                        $6,
                        $7::jsonb
                    )
                    `,
                    [
                        secondTransactionId,

                        String(
                            gameId
                        ),

                        String(
                            loserPlayerId
                        ),

                        value,

                        Number(
                            second.balance
                        ),

                        Number(
                            second.balance
                        ) + value,

                        JSON.stringify({

                            reason:
                                "draw",

                            reservedBefore:
                                Number(
                                    second.reserved_balance
                                ),

                            reservedAfter:
                                Number(
                                    second.reserved_balance
                                ) - value

                        })
                    ]
                );


                /*
                 * Финализируем settlement.
                 */

                const updateResult =
                    await client.query(
                        `
                        UPDATE game_settlements
                        SET
                            status = 'settled',

                            winner_player_id =
                                NULL,

                            loser_player_id =
                                NULL,

                            stake =
                                $2,

                            winner_amount =
                                $2,

                            loser_amount =
                                $2,

                            settled_at =
                                NOW(),

                            updated_at =
                                NOW()

                        WHERE game_id = $1

                        RETURNING *
                        `,
                        [
                            String(
                                gameId
                            ),

                            value
                        ]
                    );


                const settlement =
                    updateResult.rows[0];


                return {

                    ok: true,

                    alreadySettled:
                        false,

                    gameId:
                        settlement.game_id,

                    status:
                        settlement.status,

                    result:
                        "draw",

                    winnerPlayerId:
                        null,

                    loserPlayerId:
                        null,

                    stake:
                        value,

                    winnerAmount:
                        value,

                    loserAmount:
                        value,

                    transactionIds: [

                        firstTransactionId,

                        secondTransactionId

                    ]

                };

            }


            /*
            -------------------------------------------------
            WIN / FORFEIT
            -------------------------------------------------
            */

            const ids = [

                String(
                    winnerPlayerId
                ),

                String(
                    loserPlayerId
                )

            ].sort();


            /*
             * Блокируем обоих игроков
             * в одинаковом порядке.
             *
             * Это предотвращает deadlock.
             */

            const playersResult =
                await client.query(
                    `
                    SELECT
                        player_id,
                        balance,
                        reserved_balance
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
                playersResult.rows.length !==
                2
            ) {

                throw new Error(
                    "Both players must exist"
                );

            }


            const players =
                new Map(
                    playersResult.rows.map(
                        player => [
                            String(
                                player.player_id
                            ),
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


            const winnerBalance =
                Number(
                    winner.balance
                );

            const winnerReserved =
                Number(
                    winner.reserved_balance
                );

            const loserBalance =
                Number(
                    loser.balance
                );

            const loserReserved =
                Number(
                    loser.reserved_balance
                );


            /*
            -------------------------------------------------
            CHECK RESERVED STAKES
            -------------------------------------------------
            */

            if (
                winnerReserved <
                value
            ) {

                throw new Error(
                    "Winner reserved balance is insufficient"
                );

            }


            if (
                loserReserved <
                value
            ) {

                throw new Error(
                    "Loser reserved balance is insufficient"
                );

            }


            /*
            -------------------------------------------------
            POT
            -------------------------------------------------
            */

            const pot =
                value * 2;


            /*
            -------------------------------------------------
            PAY WINNER
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET
                    balance =
                        balance + $2,

                    reserved_balance =
                        reserved_balance - $3,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        winnerPlayerId
                    ),

                    pot,

                    value
                ]
            );


            /*
            -------------------------------------------------
            REMOVE LOSER RESERVE
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET
                    reserved_balance =
                        reserved_balance - $2,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        loserPlayerId
                    ),

                    value
                ]
            );


            /*
            -------------------------------------------------
            WINNER TRANSACTION
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

                    pot,

                    winnerBalance,

                    winnerBalance + pot,

                    JSON.stringify({

                        result:
                            result,

                        stake:
                            value,

                        pot:
                            pot,

                        opponentId:
                            String(
                                loserPlayerId
                            ),

                        reservedBefore:
                            winnerReserved,

                        reservedAfter:
                            winnerReserved - value

                    })
                ]
            );


            /*
            -------------------------------------------------
            LOSER TRANSACTION
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

                    value,

                    loserBalance,

                    loserBalance,

                    JSON.stringify({

                        result:
                            result,

                        stake:
                            value,

                        opponentId:
                            String(
                                winnerPlayerId
                            ),

                        reservedBefore:
                            loserReserved,

                        reservedAfter:
                            loserReserved - value

                    })
                ]
            );


            /*
            -------------------------------------------------
            UPDATE SETTLEMENT
            -------------------------------------------------
            */

            const updateResult =
                await client.query(
                    `
                    UPDATE game_settlements
                    SET
                        status = 'settled',

                        winner_player_id =
                            $2,

                        loser_player_id =
                            $3,

                        stake =
                            $4,

                        winner_amount =
                            $5,

                        loser_amount =
                            0,

                        settled_at =
                            NOW(),

                        updated_at =
                            NOW()

                    WHERE game_id = $1

                    RETURNING *
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

                        value,

                        pot
                    ]
                );


            const settlement =
                updateResult.rows[0];


            return {

                ok: true,

                alreadySettled:
                    false,

                gameId:
                    settlement.game_id,

                status:
                    settlement.status,

                result:
                    result,

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

                transactionIds: [

                    winnerTransactionId,

                    loserTransactionId

                ]

            };

        }
    );

}


/*
=========================================================
CANCEL / RELEASE GAME
=========================================================

Используется, если игра была создана,
ставки зарезервированы, но игра отменена
до начала нормального результата.

Например:

    игрок создал комнату;
    второй игрок не вошёл;
    игра отменена;
    ставки нужно вернуть.

=========================================================
*/

async function cancelSettlement(
    {
        gameId,
        playerIds = [],
        stake
    }
) {

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }


    const value =
        toSafeInteger(
            stake
        );


    if (
        value <= 0
    ) {

        throw new Error(
            "Invalid stake"
        );

    }


    const uniquePlayerIds =
        [
            ...new Set(
                playerIds.map(
                    id =>
                        String(id)
                )
            )
        ];


    if (
        uniquePlayerIds.length === 0
    ) {

        throw new Error(
            "No players provided"
        );

    }


    return withTransaction(
        async client => {

            const settlementResult =
                await client.query(
                    `
                    SELECT
                        *
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


            const settlement =
                settlementResult.rows[0];


            if (
                settlement &&
                settlement.status ===
                    "settled"
            ) {

                return {

                    ok: true,

                    alreadySettled:
                        true,

                    gameId:
                        String(
                            gameId
                        )

                };

            }


            const playersResult =
                await client.query(
                    `
                    SELECT
                        player_id,
                        balance,
                        reserved_balance
                    FROM players
                    WHERE player_id = ANY($1::text[])
                    ORDER BY player_id
                    FOR UPDATE
                    `,
                    [
                        uniquePlayerIds
                    ]
                );


            const returnedPlayers = [];


            for (
                const player
                of playersResult.rows
            ) {

                const reserved =
                    Number(
                        player.reserved_balance
                    );

                if (
                    reserved <
                    value
                ) {

                    throw new Error(
                        `Reserved balance is insufficient for player ${player.player_id}`
                    );

                }


                const balance =
                    Number(
                        player.balance
                    );


                await client.query(
                    `
                    UPDATE players
                    SET
                        balance =
                            balance + $2,

                        reserved_balance =
                            reserved_balance - $2,

                        updated_at =
                            NOW()

                    WHERE player_id = $1
                    `,
                    [
                        String(
                            player.player_id
                        ),

                        value
                    ]
                );


                const transactionId =
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
                        'cancel_refund',
                        $4,
                        $5,
                        $6,
                        $7::jsonb
                    )
                    `,
                    [
                        transactionId,

                        String(
                            gameId
                        ),

                        String(
                            player.player_id
                        ),

                        value,

                        balance,

                        balance + value,

                        JSON.stringify({

                            reason:
                                "game_cancelled",

                            reservedBefore:
                                reserved,

                            reservedAfter:
                                reserved - value

                        })
                    ]
                );


                returnedPlayers.push({

                    playerId:
                        String(
                            player.player_id
                        ),

                    amount:
                        value,

                    transactionId

                });

            }


            /*
            -------------------------------------------------
            SETTLEMENT
            -------------------------------------------------
            */

            if (settlement) {

                await client.query(
                    `
                    UPDATE game_settlements
                    SET
                        status = 'cancelled',

                        updated_at =
                            NOW(),

                        settled_at =
                            NOW()

                    WHERE game_id = $1
                    `,
                    [
                        String(
                            gameId
                        )
                    ]
                );

            } else {

                await client.query(
                    `
                    INSERT INTO game_settlements (
                        game_id,
                        status,
                        stake,
                        winner_amount,
                        loser_amount,
                        settled_at
                    )
                    VALUES (
                        $1,
                        'cancelled',
                        $2,
                        0,
                        0,
                        NOW()
                    )
                    `,
                    [
                        String(
                            gameId
                        ),

                        value
                    ]
                );

            }


            return {

                ok: true,

                alreadySettled:
                    false,

                gameId:
                    String(
                        gameId
                    ),

                status:
                    "cancelled",

                returnedPlayers

            };

        }
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    getSettlement,

    settleGame,

    cancelSettlement

};
