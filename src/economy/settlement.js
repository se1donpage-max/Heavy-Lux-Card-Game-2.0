"use strict";

/*
=========================================================
HEAVY LUX CARD
ECONOMY
GAME SETTLEMENT
=========================================================

ОТВЕТСТВЕННОСТЬ:

1. Атомарное завершение игры.
2. Работа с зарезервированными ставками.
3. Победа / поражение.
4. Ничья.
5. Форфейт.
6. Защита от повторной выплаты.
7. Полный финансовый журнал.
8. Все операции выполняются в одной PostgreSQL
   транзакции.

ВАЖНО:

reserveBalance() НЕ уменьшает balance.
Он только увеличивает reserved_balance.

Поэтому при завершении:

WIN:
    balance игрока - stake
    reserved_balance игрока - stake

    balance победителя + общий pot

DRAW:
    balance не меняется
    reserved_balance обоих - stake

Таким образом:

Победитель:
    + stake

Проигравший:
    - stake

Ничья:
    0

=========================================================
*/

const crypto = require("crypto");

const {
    withTransaction
} = require("../database/db");


/*
=========================================================
CONSTANTS
=========================================================
*/

const SETTLEMENT_STATUS_PENDING =
    "pending";

const SETTLEMENT_STATUS_SETTLED =
    "settled";

const SETTLEMENT_STATUS_FAILED =
    "failed";


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

    return String(value);

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


function normalizeStake(
    value
) {

    const stake =
        toSafeInteger(
            value
        );

    if (
        stake < 0
    ) {

        throw new Error(
            "Invalid stake"
        );

    }

    return stake;

}


/*
=========================================================
GET SETTLEMENT
=========================================================
*/

async function getSettlement(
    gameId
) {

    const normalizedGameId =
        normalizeId(
            gameId
        );

    if (!normalizedGameId) {

        return null;

    }


    return withTransaction(
        async client => {

            const result =
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
                        created_at,
                        settled_at,
                        updated_at
                    FROM game_settlements
                    WHERE game_id = $1
                    LIMIT 1
                    `,
                    [
                        normalizedGameId
                    ]
                );


            const row =
                result.rows[0];

            if (!row) {

                return null;

            }


            return {

                gameId:
                    row.game_id,

                status:
                    row.status,

                winnerPlayerId:
                    row.winner_player_id,

                loserPlayerId:
                    row.loser_player_id,

                stake:
                    Number(
                        row.stake
                    ),

                winnerAmount:
                    Number(
                        row.winner_amount
                    ),

                loserAmount:
                    Number(
                        row.loser_amount
                    ),

                createdAt:
                    row.created_at,

                settledAt:
                    row.settled_at,

                updatedAt:
                    row.updated_at

            };

        }
    );

}


/*
=========================================================
LOCK / GET GAME SETTLEMENT
=========================================================
*/

async function getLockedSettlement(
    client,
    gameId
) {

    const result =
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
                created_at,
                settled_at,
                updated_at
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


    return (
        result.rows[0] ||
        null
    );

}


/*
=========================================================
CREATE PENDING SETTLEMENT
=========================================================
*/

async function createSettlement(
    {
        gameId,
        winnerPlayerId = null,
        loserPlayerId = null,
        stake = 0
    } = {}
) {

    const normalizedGameId =
        normalizeId(
            gameId
        );

    if (!normalizedGameId) {

        throw new Error(
            "gameId is required"
        );

    }


    const winnerId =
        normalizeId(
            winnerPlayerId
        );

    const loserId =
        normalizeId(
            loserPlayerId
        );

    const normalizedStake =
        normalizeStake(
            stake
        );


    if (
        winnerId &&
        loserId &&
        winnerId === loserId
    ) {

        throw new Error(
            "Winner and loser cannot be the same player"
        );

    }


    return withTransaction(
        async client => {

            const existing =
                await getLockedSettlement(
                    client,
                    normalizedGameId
                );


            if (existing) {

                return {

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


            const result =
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
                        $2,
                        $3,
                        $4,
                        $5,
                        0,
                        0
                    )
                    RETURNING
                        game_id,
                        status,
                        winner_player_id,
                        loser_player_id,
                        stake,
                        winner_amount,
                        loser_amount
                    `,
                    [
                        normalizedGameId,

                        SETTLEMENT_STATUS_PENDING,

                        winnerId,

                        loserId,

                        normalizedStake
                    ]
                );


            const row =
                result.rows[0];


            return {

                gameId:
                    row.game_id,

                status:
                    row.status,

                winnerPlayerId:
                    row.winner_player_id,

                loserPlayerId:
                    row.loser_player_id,

                stake:
                    Number(
                        row.stake
                    ),

                winnerAmount:
                    Number(
                        row.winner_amount
                    ),

                loserAmount:
                    Number(
                        row.loser_amount
                    )

            };

        }
    );

}


/*
=========================================================
LOCK PLAYERS
=========================================================
*/

async function lockPlayers(
    client,
    playerIds
) {

    const ids =
        [
            ...new Set(
                playerIds
                    .filter(Boolean)
                    .map(
                        normalizeId
                    )
            )
        ].sort();


    if (
        ids.length === 0
    ) {

        return new Map();

    }


    const result =
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


    return new Map(
        result.rows.map(
            player => [
                String(
                    player.player_id
                ),
                player
            ]
        )
    );

}


/*
=========================================================
SETTLEMENT TRANSACTION LOG
=========================================================
*/

async function writeTransaction(
    client,
    {
        gameId,
        playerId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        metadata = {}
    }
) {

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
            $4,
            $5,
            $6,
            $7,
            $8::jsonb
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

            String(
                type
            ),

            amount,

            balanceBefore,

            balanceAfter,

            JSON.stringify(
                metadata
            )
        ]
    );


    return transactionId;

}


/*
=========================================================
SETTLE GAME
=========================================================

result:

WIN:

winner:
    balance + stake
    reserved_balance - stake

loser:
    balance - stake
    reserved_balance - stake

DRAW:

both:
    reserved_balance - stake

FORFEIT:

same as WIN.

=========================================================
*/

async function settleGame(
    {
        gameId,
        winnerPlayerId = null,
        loserPlayerId = null,
        stake = 0,
        result = "win"
    } = {}
) {

    const normalizedGameId =
        normalizeId(
            gameId
        );

    if (!normalizedGameId) {

        throw new Error(
            "gameId is required"
        );

    }


    const normalizedWinnerId =
        normalizeId(
            winnerPlayerId
        );

    const normalizedLoserId =
        normalizeId(
            loserPlayerId
        );


    const normalizedResult =
        String(
            result ||
            "win"
        ).toLowerCase();


    if (
        ![
            "win",
            "draw",
            "forfeit"
        ].includes(
            normalizedResult
        )
    ) {

        throw new Error(
            "Invalid settlement result"
        );

    }


    if (
        normalizedResult === "draw"
    ) {

        if (
            normalizedWinnerId ||
            normalizedLoserId
        ) {

            throw new Error(
                "Draw cannot have winner or loser"
            );

        }

    } else {

        if (
            !normalizedWinnerId ||
            !normalizedLoserId
        ) {

            throw new Error(
                "Winner and loser are required"
            );

        }


        if (
            normalizedWinnerId ===
            normalizedLoserId
        ) {

            throw new Error(
                "Winner and loser cannot be the same player"
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

            let settlement =
                await getLockedSettlement(
                    client,
                    normalizedGameId
                );


            if (
                settlement &&
                settlement.status ===
                    SETTLEMENT_STATUS_SETTLED
            ) {

                return {

                    ok: true,

                    alreadySettled:
                        true,

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
                        )

                };

            }


            const normalizedStake =
                settlement
                    ? Number(
                        settlement.stake
                    )
                    : normalizeStake(
                        stake
                    );


            /*
            -------------------------------------------------
            CREATE SETTLEMENT IF NEEDED
            -------------------------------------------------
            */

            if (!settlement) {

                const insertResult =
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
                            $2,
                            $3,
                            $4,
                            $5,
                            0,
                            0
                        )
                        RETURNING
                            game_id,
                            status,
                            winner_player_id,
                            loser_player_id,
                            stake,
                            winner_amount,
                            loser_amount
                        `,
                        [
                            normalizedGameId,

                            SETTLEMENT_STATUS_PENDING,

                            normalizedWinnerId,

                            normalizedLoserId,

                            normalizedStake
                        ]
                    );


                settlement =
                    insertResult.rows[0];

            }


            /*
            -------------------------------------------------
            -------------------------------------------------
            IMPORTANT:
            Existing pending settlement is authoritative.
            -------------------------------------------------
            -------------------------------------------------
            */

            const winnerId =
                settlement.winner_player_id
                    ? String(
                        settlement.winner_player_id
                    )
                    : null;

            const loserId =
                settlement.loser_player_id
                    ? String(
                        settlement.loser_player_id
                    )
                    : null;


            const settlementResult =
                winnerId ||
                loserId
                    ? "win"
                    : "draw";


            /*
            -------------------------------------------------
            LOCK PLAYERS
            -------------------------------------------------
            */

            const playerIds = [];

            if (winnerId) {
                playerIds.push(
                    winnerId
                );
            }

            if (loserId) {
                playerIds.push(
                    loserId
                );
            }


            const players =
                await lockPlayers(
                    client,
                    playerIds
                );


            /*
            -------------------------------------------------
            VALIDATE PLAYERS
            -------------------------------------------------
            */

            if (
                winnerId &&
                !players.has(
                    winnerId
                )
            ) {

                throw new Error(
                    "Winner player not found"
                );

            }


            if (
                loserId &&
                !players.has(
                    loserId
                )
            ) {

                throw new Error(
                    "Loser player not found"
                );

            }


            /*
            -------------------------------------------------
            DRAW
            -------------------------------------------------
            */

            if (
                settlementResult ===
                "draw"
            ) {

                const playerIdsForDraw =
                    [
                        ...players.keys()
                    ];


                const transactionIds = [];


                for (
                    const playerId
                    of playerIdsForDraw
                ) {

                    const player =
                        players.get(
                            playerId
                        );


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
                        normalizedStake
                    ) {

                        throw new Error(
                            `Reserved balance is insufficient for player ${playerId}`
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
                                playerId,

                                normalizedStake
                            ]
                        );


                    const updated =
                        updatedResult.rows[0];


                    const transactionId =
                        await writeTransaction(
                            client,
                            {

                                gameId:
                                    normalizedGameId,

                                playerId,

                                type:
                                    "settlement_draw",

                                amount:
                                    normalizedStake,

                                balanceBefore:
                                    balance,

                                balanceAfter:
                                    Number(
                                        updated.balance
                                    ),

                                metadata: {

                                    result:
                                        "draw",

                                    reservedBefore:
                                        reserved,

                                    reservedAfter:
                                        Number(
                                            updated.reserved_balance
                                        )

                                }

                            }
                        );


                    transactionIds.push(
                        transactionId
                    );

                }


                await client.query(
                    `
                    UPDATE game_settlements
                    SET
                        status = $2,
                        winner_amount = 0,
                        loser_amount = 0,
                        settled_at = NOW(),
                        updated_at = NOW()
                    WHERE game_id = $1
                    `,
                    [
                        normalizedGameId,

                        SETTLEMENT_STATUS_SETTLED
                    ]
                );


                return {

                    ok: true,

                    alreadySettled:
                        false,

                    gameId:
                        normalizedGameId,

                    status:
                        SETTLEMENT_STATUS_SETTLED,

                    result:
                        "draw",

                    winnerPlayerId:
                        null,

                    loserPlayerId:
                        null,

                    stake:
                        normalizedStake,

                    winnerAmount:
                        0,

                    loserAmount:
                        0,

                    transactionIds

                };

            }


            /*
            -------------------------------------------------
            WIN / FORFEIT
            -------------------------------------------------
            */

            const winner =
                players.get(
                    winnerId
                );

            const loser =
                players.get(
                    loserId
                );


            const winnerBalance =
                Number(
                    winner.balance
                );

            const loserBalance =
                Number(
                    loser.balance
                );

            const winnerReserved =
                Number(
                    winner.reserved_balance
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
                normalizedStake
            ) {

                throw new Error(
                    "Winner reserved balance is insufficient"
                );

            }


            if (
                loserReserved <
                normalizedStake
            ) {

                throw new Error(
                    "Loser reserved balance is insufficient"
                );

            }


            /*
            -------------------------------------------------
            CHECK SAFE BALANCE
            -------------------------------------------------
            */

            if (
                loserBalance <
                normalizedStake
            ) {

                throw new Error(
                    "Loser balance is insufficient"
                );

            }


            /*
            -------------------------------------------------
            WINNER:
                remove own reservation
                receive entire pot
            -------------------------------------------------

            winner net:
                - own stake + 2*stake
                = +stake
            */

            const winnerUpdate =
                await client.query(
                    `
                    UPDATE players
                    SET
                        balance =
                            balance - $2 + $3,

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
                        winnerId,

                        normalizedStake,

                        normalizedStake * 2
                    ]
                );


            const updatedWinner =
                winnerUpdate.rows[0];


            /*
            -------------------------------------------------
            LOSER:
                lose stake
                remove reservation
            -------------------------------------------------
            */

            const loserUpdate =
                await client.query(
                    `
                    UPDATE players
                    SET
                        balance =
                            balance - $2,

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
                        loserId,

                        normalizedStake
                    ]
                );


            const updatedLoser =
                loserUpdate.rows[0];


            /*
            -------------------------------------------------
            FINANCIAL LOG
            -------------------------------------------------
            */

            const winnerTransactionId =
                await writeTransaction(
                    client,
                    {

                        gameId:
                            normalizedGameId,

                        playerId:
                            winnerId,

                        type:
                            normalizedResult ===
                            "forfeit"
                                ? "settlement_forfeit_win"
                                : "settlement_win",

                        amount:
                            normalizedStake,

                        balanceBefore:
                            winnerBalance,

                        balanceAfter:
                            Number(
                                updatedWinner.balance
                            ),

                        metadata: {

                            result:
                                normalizedResult,

                            ownStake:
                                normalizedStake,

                            pot:
                                normalizedStake * 2,

                            reservedBefore:
                                winnerReserved,

                            reservedAfter:
                                Number(
                                    updatedWinner.reserved_balance
                                ),

                            loserPlayerId:
                                loserId

                        }

                    }
                );


            const loserTransactionId =
                await writeTransaction(
                    client,
                    {

                        gameId:
                            normalizedGameId,

                        playerId:
                            loserId,

                        type:
                            normalizedResult ===
                            "forfeit"
                                ? "settlement_forfeit_loss"
                                : "settlement_loss",

                        amount:
                            normalizedStake,

                        balanceBefore:
                            loserBalance,

                        balanceAfter:
                            Number(
                                updatedLoser.balance
                            ),

                        metadata: {

                            result:
                                normalizedResult,

                            stake:
                                normalizedStake,

                            reservedBefore:
                                loserReserved,

                            reservedAfter:
                                Number(
                                    updatedLoser.reserved_balance
                                ),

                            winnerPlayerId:
                                winnerId

                        }

                    }
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
                    status = $2,

                    winner_player_id = $3,

                    loser_player_id = $4,

                    stake = $5,

                    winner_amount = $6,

                    loser_amount = $7,

                    settled_at = NOW(),

                    updated_at = NOW()

                WHERE game_id = $1
                `,
                [
                    normalizedGameId,

                    SETTLEMENT_STATUS_SETTLED,

                    winnerId,

                    loserId,

                    normalizedStake,

                    normalizedStake,

                    normalizedStake
                ]
            );


            return {

                ok: true,

                alreadySettled:
                    false,

                gameId:
                    normalizedGameId,

                status:
                    SETTLEMENT_STATUS_SETTLED,

                result:
                    normalizedResult,

                winnerPlayerId:
                    winnerId,

                loserPlayerId:
                    loserId,

                stake:
                    normalizedStake,

                winnerAmount:
                    normalizedStake,

                loserAmount:
                    normalizedStake,

                transactionIds: [

                    winnerTransactionId,

                    loserTransactionId

                ],

                balances: {

                    winner:
                        Number(
                            updatedWinner.balance
                        ),

                    loser:
                        Number(
                            updatedLoser.balance
                        )

                }

            };

        }
    );

}


/*
=========================================================
SETTLE WIN
=========================================================
*/

async function settleWin(
    gameId,
    winnerPlayerId,
    loserPlayerId,
    stake
) {

    return settleGame({

        gameId,

        winnerPlayerId,

        loserPlayerId,

        stake,

        result:
            "win"

    });

}


/*
=========================================================
SETTLE DRAW
=========================================================
*/

async function settleDraw(
    gameId,
    playerIds,
    stake
) {

    if (
        !Array.isArray(
            playerIds
        ) ||
        playerIds.length !== 2
    ) {

        throw new Error(
            "Draw requires exactly two players"
        );

    }


    /*
     * Для ничьей settlement хранит
     * winner/loser = NULL.
     *
     * Поэтому сначала создаём settlement
     * с двумя игроками через отдельный
     * атомарный метод ниже.
     */

    return withTransaction(
        async client => {

            const normalizedGameId =
                normalizeId(
                    gameId
                );

            const normalizedStake =
                normalizeStake(
                    stake
                );


            if (!normalizedGameId) {

                throw new Error(
                    "gameId is required"
                );

            }


            let settlement =
                await getLockedSettlement(
                    client,
                    normalizedGameId
                );


            if (
                settlement &&
                settlement.status ===
                    SETTLEMENT_STATUS_SETTLED
            ) {

                return {

                    ok: true,

                    alreadySettled:
                        true,

                    gameId:
                        settlement.game_id,

                    status:
                        settlement.status

                };

            }


            if (!settlement) {

                const result =
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
                            $2,
                            NULL,
                            NULL,
                            $3,
                            0,
                            0
                        )
                        RETURNING
                            game_id,
                            status,
                            stake
                        `,
                        [
                            normalizedGameId,

                            SETTLEMENT_STATUS_PENDING,

                            normalizedStake
                        ]
                    );


                settlement =
                    result.rows[0];

            }


            const ids =
                [
                    ...new Set(
                        playerIds.map(
                            normalizeId
                        )
                    )
                ];


            if (
                ids.length !== 2 ||
                ids.includes(null)
            ) {

                throw new Error(
                    "Draw requires exactly two valid players"
                );

            }


            const players =
                await lockPlayers(
                    client,
                    ids
                );


            if (
                players.size !== 2
            ) {

                throw new Error(
                    "One or both players not found"
                );

            }


            const transactionIds = [];


            for (
                const playerId
                of ids.sort()
            ) {

                const player =
                    players.get(
                        playerId
                    );


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
                    normalizedStake
                ) {

                    throw new Error(
                        `Reserved balance is insufficient for player ${playerId}`
                    );

                }


                const updateResult =
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
                            playerId,

                            normalizedStake
                        ]
                    );


                const updated =
                    updateResult.rows[0];


                const transactionId =
                    await writeTransaction(
                        client,
                        {

                            gameId:
                                normalizedGameId,

                            playerId,

                            type:
                                "settlement_draw",

                            amount:
                                normalizedStake,

                            balanceBefore:
                                balance,

                            balanceAfter:
                                Number(
                                    updated.balance
                                ),

                            metadata: {

                                result:
                                    "draw",

                                reservedBefore:
                                    reserved,

                                reservedAfter:
                                    Number(
                                        updated.reserved_balance
                                    )

                            }

                        }
                    );


                transactionIds.push(
                    transactionId
                );

            }


            await client.query(
                `
                UPDATE game_settlements
                SET
                    status = $2,
                    winner_amount = 0,
                    loser_amount = 0,
                    settled_at = NOW(),
                    updated_at = NOW()
                WHERE game_id = $1
                `,
                [
                    normalizedGameId,

                    SETTLEMENT_STATUS_SETTLED
                ]
            );


            return {

                ok: true,

                alreadySettled:
                    false,

                gameId:
                    normalizedGameId,

                status:
                    SETTLEMENT_STATUS_SETTLED,

                result:
                    "draw",

                stake:
                    normalizedStake,

                transactionIds

            };

        }
    );

}


/*
=========================================================
RELEASE STAKE
=========================================================

Отдельный безопасный helper.

Используется для отменённой игры,
когда ставки были зарезервированы,
но игра не должна рассчитываться как
win/loss/draw.

=========================================================
*/

async function releaseGameStake(
    gameId,
    playerIds,
    stake
) {

    const normalizedGameId =
        normalizeId(
            gameId
        );

    if (!normalizedGameId) {

        throw new Error(
            "gameId is required"
        );

    }


    if (
        !Array.isArray(
            playerIds
        ) ||
        playerIds.length === 0
    ) {

        throw new Error(
            "playerIds are required"
        );

    }


    const normalizedStake =
        normalizeStake(
            stake
        );


    return withTransaction(
        async client => {

            const settlement =
                await getLockedSettlement(
                    client,
                    normalizedGameId
                );


            if (
                settlement &&
                settlement.status ===
                    SETTLEMENT_STATUS_SETTLED
            ) {

                return {

                    ok: false,

                    alreadySettled:
                        true,

                    gameId:
                        normalizedGameId

                };

            }


            const ids =
                [
                    ...new Set(
                        playerIds
                            .map(
                                normalizeId
                            )
                            .filter(Boolean)
                    )
                ].sort();


            const players =
                await lockPlayers(
                    client,
                    ids
                );


            if (
                players.size !==
                ids.length
            ) {

                throw new Error(
                    "One or more players not found"
                );

            }


            const transactionIds = [];


            for (
                const playerId
                of ids
            ) {

                const player =
                    players.get(
                        playerId
                    );


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
                    normalizedStake
                ) {

                    throw new Error(
                        `Reserved balance is insufficient for player ${playerId}`
                    );

                }


                const updateResult =
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
                            playerId,

                            normalizedStake
                        ]
                    );


                const updated =
                    updateResult.rows[0];


                const transactionId =
                    await writeTransaction(
                        client,
                        {

                            gameId:
                                normalizedGameId,

                            playerId,

                            type:
                                "game_cancel_release",

                            amount:
                                normalizedStake,

                            balanceBefore:
                                balance,

                            balanceAfter:
                                Number(
                                    updated.balance
                                ),

                            metadata: {

                                reservedBefore:
                                    reserved,

                                reservedAfter:
                                    Number(
                                        updated.reserved_balance
                                    )

                            }

                        }
                    );


                transactionIds.push(
                    transactionId
                );

            }


            /*
            -------------------------------------------------
            Создаём settlement как settled,
            чтобы отмену нельзя было провести
            повторно.
            -------------------------------------------------
            */

            await client.query(
                `
                INSERT INTO game_settlements (
                    game_id,
                    status,
                    winner_player_id,
                    loser_player_id,
                    stake,
                    winner_amount,
                    loser_amount,
                    settled_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    NULL,
                    NULL,
                    $3,
                    0,
                    0,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (game_id)
                DO UPDATE SET
                    status = EXCLUDED.status,
                    settled_at = NOW(),
                    updated_at = NOW()
                `,
                [
                    normalizedGameId,

                    SETTLEMENT_STATUS_SETTLED,

                    normalizedStake
                ]
            );


            return {

                ok: true,

                alreadySettled:
                    false,

                gameId:
                    normalizedGameId,

                status:
                    SETTLEMENT_STATUS_SETTLED,

                result:
                    "cancelled",

                stake:
                    normalizedStake,

                transactionIds

            };

        }
    );

}


/*
=========================================================
FAIL SETTLEMENT
=========================================================
*/

async function markSettlementFailed(
    gameId
) {

    const normalizedGameId =
        normalizeId(
            gameId
        );

    if (!normalizedGameId) {

        throw new Error(
            "gameId is required"
        );

    }


    return withTransaction(
        async client => {

            await client.query(
                `
                UPDATE game_settlements
                SET
                    status = $2,
                    updated_at = NOW()
                WHERE game_id = $1
                  AND status = $3
                `,
                [
                    normalizedGameId,

                    SETTLEMENT_STATUS_FAILED,

                    SETTLEMENT_STATUS_PENDING
                ]
            );


            return {

                ok: true,

                gameId:
                    normalizedGameId,

                status:
                    SETTLEMENT_STATUS_FAILED

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

    createSettlement,

    settleGame,

    settleWin,

    settleDraw,

    releaseGameStake,

    markSettlementFailed

};
