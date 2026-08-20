"use strict";

/*
=========================================================
HEAVY LUX CARD
DATABASE SCHEMA
=========================================================
*/

const { query } = require("./db");


/*
=========================================================
INITIALIZE DATABASE
=========================================================
*/

async function initializeDatabase() {

    /*
    -----------------------------------------------------
    PLAYERS
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS players (
            telegram_id TEXT PRIMARY KEY,

            player_id TEXT UNIQUE NOT NULL,

            name TEXT NOT NULL DEFAULT 'Player',

            username TEXT,

            balance BIGINT NOT NULL DEFAULT 1000,

            reserved_balance BIGINT NOT NULL DEFAULT 0,

            xp BIGINT NOT NULL DEFAULT 0,

            level INTEGER NOT NULL DEFAULT 1,

            games_played INTEGER NOT NULL DEFAULT 0,

            wins INTEGER NOT NULL DEFAULT 0,

            losses INTEGER NOT NULL DEFAULT 0,

            draws INTEGER NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    VEHICLES
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id BIGSERIAL PRIMARY KEY,

            player_id TEXT NOT NULL,

            model TEXT NOT NULL,

            price BIGINT NOT NULL DEFAULT 0,

            color TEXT,

            plate TEXT,

            mileage NUMERIC(12,2) NOT NULL DEFAULT 0,

            fuel NUMERIC(6,2) NOT NULL DEFAULT 100,

            condition NUMERIC(6,2) NOT NULL DEFAULT 100,

            tuning JSONB NOT NULL DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    PROPERTIES
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS properties (
            id BIGSERIAL PRIMARY KEY,

            player_id TEXT,

            type TEXT NOT NULL,

            name TEXT NOT NULL,

            price BIGINT NOT NULL DEFAULT 0,

            data JSONB NOT NULL DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    PLATES
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS plates (
            id BIGSERIAL PRIMARY KEY,

            player_id TEXT,

            plate TEXT UNIQUE NOT NULL,

            price BIGINT NOT NULL DEFAULT 0,

            data JSONB NOT NULL DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    GAME SESSIONS
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            game_id TEXT PRIMARY KEY,

            room_id TEXT UNIQUE NOT NULL,

            state JSONB NOT NULL,

            status TEXT NOT NULL DEFAULT 'waiting',

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    GAME SETTLEMENTS
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS game_settlements (
            game_id TEXT PRIMARY KEY,

            status TEXT NOT NULL DEFAULT 'pending',

            winner_player_id TEXT,

            loser_player_id TEXT,

            stake BIGINT NOT NULL DEFAULT 0,

            winner_amount BIGINT NOT NULL DEFAULT 0,

            loser_amount BIGINT NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            settled_at TIMESTAMPTZ,

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    GAME TRANSACTIONS
    -----------------------------------------------------
    */

    await query(`
        CREATE TABLE IF NOT EXISTS game_transactions (
            id BIGSERIAL PRIMARY KEY,

            transaction_id TEXT UNIQUE NOT NULL,

            game_id TEXT NOT NULL,

            player_id TEXT NOT NULL,

            type TEXT NOT NULL,

            amount BIGINT NOT NULL DEFAULT 0,

            balance_before BIGINT NOT NULL DEFAULT 0,

            balance_after BIGINT NOT NULL DEFAULT 0,

            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    INDEXES
    -----------------------------------------------------
    */

    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_vehicles_player_id
        ON vehicles(player_id)
    `);


    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_properties_player_id
        ON properties(player_id)
    `);


    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_plates_player_id
        ON plates(player_id)
    `);


    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_game_sessions_status
        ON game_sessions(status)
    `);


    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_game_transactions_game_id
        ON game_transactions(game_id)
    `);


    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_game_transactions_player_id
        ON game_transactions(player_id)
    `);


    /*
    -----------------------------------------------------
    MIGRATIONS FOR EXISTING DATABASES
    -----------------------------------------------------
    */

    await query(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    `);


    /*
    -----------------------------------------------------
    NORMALIZE EXISTING NULL VALUES
    -----------------------------------------------------
    */

    await query(`
        UPDATE game_settlements
        SET updated_at = NOW()
        WHERE updated_at IS NULL
    `);


    /*
    -----------------------------------------------------
    DONE
    -----------------------------------------------------
    */

    console.log(
        "[DATABASE] Schema initialized"
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    initializeDatabase

};
