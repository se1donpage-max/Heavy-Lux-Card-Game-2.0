"use strict";

/*
=========================================================
HEAVY LUX CARD
ECONOMY
WALLET
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
GET WALLET
=========================================================
*/

async function getWallet(
    playerId
) {

    return withTransaction(
        async client => {

            const result =
                await client.query(
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
                        String(
                            playerId
                        )
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
                    )

            };

        }
    );

}


/*
=========================================================
RESERVE BALANCE
=========================================================
*/

async function reserveBalance(
    playerId,
    amount,
    gameId
) {

    const value =
        toSafeInteger(
            amount
        );

    if (
        value <= 0
    ) {

        throw new Error(
            "Invalid reservation amount"
        );

    }

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK PLAYER
            -------------------------------------------------
            */

            const playerResult =
                await client.query(
                    `
                    SELECT
                        player_id,
                        balance,
                        reserved_balance
                    FROM players
                    WHERE player_id = $1
                    FOR UPDATE
                    `,
                    [
                        String(
                            playerId
                        )
                    ]
                );

            const player =
                playerResult.rows[0];

            if (!player) {

                throw new Error(
                    "Player not found"
                );

            }


            const balance =
                Number(
                    player.balance
                );

            const reserved =
                Number(
                    player.reserved_balance
                );


            /*
            -------------------------------------------------
            CHECK AVAILABLE BALANCE
            -------------------------------------------------
            */

            const available =
                balance -
                reserved;

            if (
                available <
                value
            ) {

                throw new Error(
                    "Insufficient available balance"
                );

            }


            /*
            -------------------------------------------------
            UPDATE RESERVED BALANCE
            -------------------------------------------------
            */

            const updatedResult =
                await client.query(
                    `
                    UPDATE players
                    SET
                        reserved_balance =
                            reserved_balance + $2,

                        updated_at =
                            NOW()

                    WHERE player_id = $1

                    RETURNING
                        player_id,
                        balance,
                        reserved_balance
                    `,
                    [
                        String(
                            playerId
                        ),

                        value
                    ]
                );


            const updated =
                updatedResult.rows[0];


            /*
            -------------------------------------------------
            TRANSACTION LOG
            -------------------------------------------------
            */

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
                    'reserve',
                    $4,
                    $5,
                    $5,
                    $6::jsonb
                )
                `,
                [
                    transactionId,

                    String(
                        gameId
                    ),

                    String(
                        playerId
                    ),

                    value,

                    balance,

                    JSON.stringify({
                        reservedBefore:
                            reserved,

                        reservedAfter:
                            Number(
                                updated.reserved_balance
                            )
                    })
                ]
            );


            return {

                transactionId,

                playerId:
                    updated.player_id,

                balance:
                    Number(
                        updated.balance
                    ),

                reservedBalance:
                    Number(
                        updated.reserved_balance
                    ),

                reservedAmount:
                    value

            };

        }
    );

}


/*
=========================================================
RELEASE RESERVED BALANCE
=========================================================
*/

async function releaseReservedBalance(
    playerId,
    amount,
    gameId
) {

    const value =
        toSafeInteger(
            amount
        );

    if (
        value <= 0
    ) {

        throw new Error(
            "Invalid release amount"
        );

    }

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }


    return withTransaction(
        async client => {

            const playerResult =
                await client.query(
                    `
                    SELECT
                        player_id,
                        balance,
                        reserved_balance
                    FROM players
                    WHERE player_id = $1
                    FOR UPDATE
                    `,
                    [
                        String(
                            playerId
                        )
                    ]
                );

            const player =
                playerResult.rows[0];

            if (!player) {

                throw new Error(
                    "Player not found"
                );

            }


            const balance =
                Number(
                    player.balance
                );

            const reserved =
                Number(
                    player.reserved_balance
                );


            if (
                reserved <
                value
            ) {

                throw new Error(
                    "Reserved balance is insufficient"
                );

            }


            const updatedResult =
                await client.query(
                    `
                    UPDATE players
                    SET
                        reserved_balance =
                            reserved_balance - $2,

                        updated_at =
                            NOW()

                    WHERE player_id = $1

                    RETURNING
                        player_id,
                        balance,
                        reserved_balance
                    `,
                    [
                        String(
                            playerId
                        ),

                        value
                    ]
                );


            const updated =
                updatedResult.rows[0];


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
                    'release_reserve',
                    $4,
                    $5,
                    $5,
                    $6::jsonb
                )
                `,
                [
                    transactionId,

                    String(
                        gameId
                    ),

                    String(
                        playerId
                    ),

                    value,

                    balance,

                    JSON.stringify({
                        reservedBefore:
                            reserved,

                        reservedAfter:
                            Number(
                                updated.reserved_balance
                            )
                    })
                ]
            );


            return {

                transactionId,

                playerId:
                    updated.player_id,

                balance:
                    Number(
                        updated.balance
                    ),

                reservedBalance:
                    Number(
                        updated.reserved_balance
                    ),

                releasedAmount:
                    value

            };

        }
    );

}


/*
=========================================================
TRANSFER / PAYOUT
=========================================================
*/

async function transferBalance(
    fromPlayerId,
    toPlayerId,
    amount,
    gameId
) {

    const value =
        toSafeInteger(
            amount
        );

    if (
        value <= 0
    ) {

        throw new Error(
            "Invalid transfer amount"
        );

    }

    if (!gameId) {

        throw new Error(
            "gameId is required"
        );

    }

    if (
        String(fromPlayerId) ===
        String(toPlayerId)
    ) {

        throw new Error(
            "Cannot transfer to the same player"
        );

    }


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK PLAYERS IN DETERMINISTIC ORDER
            -------------------------------------------------
            */

            const ids = [
                String(fromPlayerId),
                String(toPlayerId)
            ].sort();


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
                playersResult.rows.length !== 2
            ) {

                throw new Error(
                    "One or both players not found"
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


            const sender =
                players.get(
                    String(
                        fromPlayerId
                    )
                );

            const receiver =
                players.get(
                    String(
                        toPlayerId
                    )
                );


            const senderBalance =
                Number(
                    sender.balance
                );

            const senderReserved =
                Number(
                    sender.reserved_balance
                );

            const receiverBalance =
                Number(
                    receiver.balance
                );


            /*
            -------------------------------------------------
            AVAILABLE BALANCE
            -------------------------------------------------
            */

            const available =
                senderBalance -
                senderReserved;


            if (
                available <
                value
            ) {

                throw new Error(
                    "Insufficient available balance"
                );

            }


            /*
            -------------------------------------------------
            UPDATE SENDER
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET
                    balance =
                        balance - $2,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        fromPlayerId
                    ),

                    value
                ]
            );


            /*
            -------------------------------------------------
            UPDATE RECEIVER
            -------------------------------------------------
            */

            await client.query(
                `
                UPDATE players
                SET
                    balance =
                        balance + $2,

                    updated_at =
                        NOW()

                WHERE player_id = $1
                `,
                [
                    String(
                        toPlayerId
                    ),

                    value
                ]
            );


            /*
            -------------------------------------------------
            LOG SENDER
            -------------------------------------------------
            */

            const senderTransactionId =
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
                    'transfer_out',
                    $4,
                    $5,
                    $6,
                    $7::jsonb
                )
                `,
                [
                    senderTransactionId,

                    String(
                        gameId
                    ),

                    String(
                        fromPlayerId
                    ),

                    value,

                    senderBalance,

                    senderBalance - value,

                    JSON.stringify({
                        toPlayerId:
                            String(
                                toPlayerId
                            )
                    })
                ]
            );


            /*
            -------------------------------------------------
            LOG RECEIVER
            -------------------------------------------------
            */

            const receiverTransactionId =
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
                    'transfer_in',
                    $4,
                    $5,
                    $6,
                    $7::jsonb
                )
                `,
                [
                    receiverTransactionId,

                    String(
                        gameId
                    ),

                    String(
                        toPlayerId
                    ),

                    value,

                    receiverBalance,

                    receiverBalance + value,

                    JSON.stringify({
                        fromPlayerId:
                            String(
                                fromPlayerId
                            )
                    })
                ]
            );


            return {

                amount:
                    value,

                from: {

                    playerId:
                        String(
                            fromPlayerId
                        ),

                    balance:
                        senderBalance -
                        value

                },

                to: {

                    playerId:
                        String(
                            toPlayerId
                        ),

                    balance:
                        receiverBalance +
                        value

                },

                transactionIds: [

                    senderTransactionId,

                    receiverTransactionId

                ]

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

    getWallet,

    reserveBalance,

    releaseReservedBalance,

    transferBalance

};
