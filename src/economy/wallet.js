"use strict";

/*
=========================================================
HEAVY LUX CARD
ECONOMY
WALLET
=========================================================

Ответственность:

- получение кошелька;
- резервирование средств;
- освобождение резерва;
- перевод средств;
- журналирование денежных операций.

ВАЖНО:

wallet.js НЕ определяет победителя игры.

Финальное закрытие игры выполняет:

    src/economy/settlement.js

Все изменения денег выполняются внутри PostgreSQL
transaction + row locking.

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


function toSafeInteger(
    value
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isSafeInteger(
            number
        )
    ) {

        return null;

    }

    return number;

}


function requirePositiveAmount(
    amount
) {

    const value =
        toSafeInteger(
            amount
        );

    if (
        value === null ||
        value <= 0
    ) {

        throw new Error(
            "Amount must be a positive safe integer"
        );

    }

    return value;

}


function requireGameId(
    gameId
) {

    const id =
        normalizeId(
            gameId
        );

    if (!id) {

        throw new Error(
            "gameId is required"
        );

    }

    return id;

}


function requirePlayerId(
    playerId
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

    return id;

}


/*
=========================================================
GET WALLET
=========================================================

Чтение не требует BEGIN/COMMIT.

=========================================================
*/

async function getWallet(
    playerId
) {

    const id =
        requirePlayerId(
            playerId
        );


    const result =
        await withTransaction(
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
                        LIMIT 1
                        `,
                        [
                            id
                        ]
                    );


                const player =
                    playerResult.rows[0];


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

                    balance,

                    reservedBalance,

                    availableBalance:
                        balance -
                        reservedBalance

                };

            }
        );


    return result;

}


/*
=========================================================
RESERVE BALANCE
=========================================================

Резерв НЕ уменьшает balance.

Например:

balance = 1000
reserved = 0

reserve 300

balance = 1000
reserved = 300
available = 700

=========================================================
*/

async function reserveBalance(
    playerId,
    amount,
    gameId
) {

    const id =
        requirePlayerId(
            playerId
        );

    const value =
        requirePositiveAmount(
            amount
        );

    const game =
        requireGameId(
            gameId
        );


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK PLAYER
            -------------------------------------------------
            */

            const result =
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
                        id
                    ]
                );


            const player =
                result.rows[0];


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
            UPDATE RESERVE
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
                        id,
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

                    game,

                    id,

                    value,

                    balance,

                    JSON.stringify({

                        reservedBefore:
                            reserved,

                        reservedAfter:
                            Number(
                                updated.reserved_balance
                            ),

                        availableBefore:
                            available,

                        availableAfter:
                            Number(
                                updated.balance
                            ) -
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

                availableBalance:
                    Number(
                        updated.balance
                    ) -
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

Возвращает сумму из reserved_balance
в доступный баланс.

Сам balance при этом НЕ меняется.

=========================================================
*/

async function releaseReservedBalance(
    playerId,
    amount,
    gameId
) {

    const id =
        requirePlayerId(
            playerId
        );

    const value =
        requirePositiveAmount(
            amount
        );

    const game =
        requireGameId(
            gameId
        );


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
                    FOR UPDATE
                    `,
                    [
                        id
                    ]
                );


            const player =
                result.rows[0];


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
                        id,
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

                    game,

                    id,

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

                availableBalance:
                    Number(
                        updated.balance
                    ) -
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
TRANSFER BALANCE
=========================================================

Обычный перевод доступных средств.

ВАЖНО:

sender.balance - sender.reserved_balance
должен быть >= amount.

Получатель получает amount.

=========================================================
*/

async function transferBalance(
    fromPlayerId,
    toPlayerId,
    amount,
    gameId
) {

    const fromId =
        requirePlayerId(
            fromPlayerId
        );

    const toId =
        requirePlayerId(
            toPlayerId
        );

    const value =
        requirePositiveAmount(
            amount
        );

    const game =
        requireGameId(
            gameId
        );


    if (
        fromId ===
        toId
    ) {

        throw new Error(
            "Cannot transfer to the same player"
        );

    }


    return withTransaction(
        async client => {

            /*
            -------------------------------------------------
            LOCK PLAYERS
            -------------------------------------------------

            Сортировка ID предотвращает deadlock,
            если два перевода происходят одновременно
            в противоположных направлениях.
            */

            const ids = [
                fromId,
                toId
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
                playersResult.rows.length !==
                2
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
                    fromId
                );

            const receiver =
                players.get(
                    toId
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

            const
