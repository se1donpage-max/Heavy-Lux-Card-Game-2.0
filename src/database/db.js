"use strict";

/*
=========================================================
HEAVY LUX CARD
DATABASE CONNECTION
=========================================================
*/

const { Pool } = require("pg");

const {
    CONFIG
} = require("../config");


/*
=========================================================
DATABASE CONFIG
=========================================================
*/

const databaseUrl =
    CONFIG.DATABASE.URL;


if (
    CONFIG.SERVER.NODE_ENV === "production" &&
    !databaseUrl
) {

    throw new Error(
        "DATABASE_URL is required in production"
    );

}


/*
=========================================================
POOL
=========================================================
*/

const pool =
    new Pool({

        connectionString:
            databaseUrl || undefined,

        ssl:
            CONFIG.DATABASE.SSL
                ? {
                    rejectUnauthorized:
                        false
                }
                : false,

        max:
            Number(
                process.env.DB_POOL_MAX ||
                10
            ),

        idleTimeoutMillis:
            Number(
                process.env.DB_IDLE_TIMEOUT ||
                30000
            ),

        connectionTimeoutMillis:
            Number(
                process.env.DB_CONNECTION_TIMEOUT ||
                10000
            )

    });


/*
=========================================================
ERROR HANDLER
=========================================================
*/

pool.on(
    "error",
    error => {

        console.error(
            "[DATABASE] Unexpected idle client error:",
            error
        );

    }
);


/*
=========================================================
QUERY
=========================================================
*/

async function query(
    text,
    params = []
) {

    return pool.query(
        text,
        params
    );

}


/*
=========================================================
GET CLIENT
=========================================================
*/

async function getClient() {

    return pool.connect();

}


/*
=========================================================
TRANSACTION HELPER
=========================================================
*/

async function withTransaction(
    callback
) {

    const client =
        await getClient();

    try {

        await client.query(
            "BEGIN"
        );

        const result =
            await callback(
                client
            );

        await client.query(
            "COMMIT"
        );

        return result;

    } catch (error) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch (
            rollbackError
        ) {

            console.error(
                "[DATABASE] Rollback failed:",
                rollbackError
            );

        }

        throw error;

    } finally {

        client.release();

    }

}


/*
=========================================================
HEALTH CHECK
=========================================================
*/

async function checkDatabase() {

    const result =
        await query(
            "SELECT NOW() AS now"
        );

    return {
        ok: true,
        now:
            result.rows[0]?.now ||
            null
    };

}


/*
=========================================================
CLOSE DATABASE
=========================================================
*/

async function closeDatabase() {

    await pool.end();

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    pool,

    query,

    getClient,

    withTransaction,

    checkDatabase,

    closeDatabase

};
