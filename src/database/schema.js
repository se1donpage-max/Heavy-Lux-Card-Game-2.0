"use strict";

/*
=========================================================
HEAVY LUX CARD
DATABASE SCHEMA
=========================================================

ЕДИНАЯ СХЕМА БАЗЫ ДАННЫХ

Основные сущности:

players
vehicles
properties
plates

game_sessions
game_settlements
game_transactions

ВАЖНО:

- schema.js отвечает только за структуру БД;
- игровая логика находится в game/;
- кошелёк находится в economy/wallet.js;
- завершение денежной части игры находится
  в economy/settlement.js.

=========================================================
*/

const {
    query
} = require("./db");


/*
=========================================================
HELPERS
=========================================================
*/

/*
 * Выполнить SQL.
 *
 * Оставлено отдельной функцией, чтобы схема была
 * читаемой и при необходимости можно было централизованно
 * добавить логирование миграций.
 */
async function run(
    sql
) {

    await query(
        sql
    );

}


/*
=========================================================
INITIALIZE DATABASE
=========================================================
*/

async function initializeDatabase() {

    console.log(
        "[DATABASE] Initializing schema..."
    );


    /*
    =====================================================
    PLAYERS
    =====================================================
    */

    await run(`
        CREATE TABLE IF NOT EXISTS players (

            telegram_id TEXT PRIMARY KEY,

            player_id TEXT UNIQUE NOT NULL,

            name TEXT NOT NULL
                DEFAULT 'Player',

            username TEXT,

            balance BIGINT NOT NULL
                DEFAULT 1000,

            reserved_balance BIGINT NOT NULL
                DEFAULT 0,

            xp BIGINT NOT NULL
                DEFAULT 0,

            level INTEGER NOT NULL
                DEFAULT 1,

            games_played INTEGER NOT NULL
                DEFAULT 0,

            wins INTEGER NOT NULL
                DEFAULT 0,

            losses INTEGER NOT NULL
                DEFAULT 0,

            draws INTEGER NOT NULL
                DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    PLAYERS MIGRATIONS
    -----------------------------------------------------
    */

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        reserved_balance BIGINT
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        xp BIGINT
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        level INTEGER
        NOT NULL DEFAULT 1
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        games_played INTEGER
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        wins INTEGER
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        losses INTEGER
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        draws INTEGER
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    `);

    await run(`
        ALTER TABLE players
        ADD COLUMN IF NOT EXISTS
        updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    `);


    /*
    =====================================================
    VEHICLES
    =====================================================
    */

    await run(`
        CREATE TABLE IF NOT EXISTS vehicles (

            id BIGSERIAL PRIMARY KEY,

            player_id TEXT NOT NULL,

            model TEXT NOT NULL,

            price BIGINT NOT NULL
                DEFAULT 0,

            color TEXT,

            plate TEXT,

            mileage NUMERIC(12,2) NOT NULL
                DEFAULT 0,

            fuel NUMERIC(6,2) NOT NULL
                DEFAULT 100,

            condition NUMERIC(6,2) NOT NULL
                DEFAULT 100,

            tuning JSONB NOT NULL
                DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    =====================================================
    PROPERTIES
    =====================================================
    */

    await run(`
        CREATE TABLE IF NOT EXISTS properties (

            id BIGSERIAL PRIMARY KEY,

            player_id TEXT,

            type TEXT NOT NULL,

            name TEXT NOT NULL,

            price BIGINT NOT NULL
                DEFAULT 0,

            data JSONB NOT NULL
                DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    =====================================================
    PLATES
    =====================================================
    */

    await run(`
        CREATE TABLE IF NOT EXISTS plates (

            id BIGSERIAL PRIMARY KEY,

            player_id TEXT,

            plate TEXT UNIQUE NOT NULL,

            price BIGINT NOT NULL
                DEFAULT 0,

            data JSONB NOT NULL
                DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    =====================================================
    GAME SESSIONS
    =====================================================
    */

    await run(`
        CREATE TABLE IF NOT EXISTS game_sessions (

            game_id TEXT PRIMARY KEY,

            room_id TEXT UNIQUE NOT NULL,

            state JSONB NOT NULL,

            status TEXT NOT NULL
                DEFAULT 'waiting',

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    =====================================================
    GAME SETTLEMENTS
    =====================================================

    Одна запись = одно финансовое закрытие игры.

    game_id PRIMARY KEY гарантирует, что одна игра
    не будет закрыта дважды на уровне БД.

    status:

        pending
        processing
        settled
        cancelled
        failed
    */

    await run(`
        CREATE TABLE IF NOT EXISTS game_settlements (

            game_id TEXT PRIMARY KEY,

            status TEXT NOT NULL
                DEFAULT 'pending',

            winner_player_id TEXT,

            loser_player_id TEXT,

            stake BIGINT NOT NULL
                DEFAULT 0,

            winner_amount BIGINT NOT NULL
                DEFAULT 0,

            loser_amount BIGINT NOT NULL
                DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            settled_at TIMESTAMPTZ,

            updated_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    -----------------------------------------------------
    SETTLEMENT MIGRATIONS
    -----------------------------------------------------
    */

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        status TEXT
        NOT NULL DEFAULT 'pending'
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        winner_player_id TEXT
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        loser_player_id TEXT
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        stake BIGINT
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        winner_amount BIGINT
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        loser_amount BIGINT
        NOT NULL DEFAULT 0
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        settled_at TIMESTAMPTZ
    `);

    await run(`
        ALTER TABLE game_settlements
        ADD COLUMN IF NOT EXISTS
        updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    `);


    /*
    =====================================================
    GAME TRANSACTIONS
    =====================================================

    Неизменяемый журнал денежных операций.

    transaction_id UNIQUE защищает от повторной записи
    одной и той же операции.

    type может содержать, например:

        reserve
        release_reserve
        transfer_out
        transfer_in
        settlement
        refund
        reward
    */

    await run(`
        CREATE TABLE IF NOT EXISTS game_transactions (

            id BIGSERIAL PRIMARY KEY,

            transaction_id TEXT UNIQUE NOT NULL,

            game_id TEXT NOT NULL,

            player_id TEXT NOT NULL,

            type TEXT NOT NULL,

            amount BIGINT NOT NULL
                DEFAULT 0,

            balance_before BIGINT NOT NULL
                DEFAULT 0,

            balance_after BIGINT NOT NULL
                DEFAULT 0,

            metadata JSONB NOT NULL
                DEFAULT '{}'::jsonb,

            created_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW()
        )
    `);


    /*
    =====================================================
    INDEXES
    =====================================================
    */

    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_players_player_id
        ON players(player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_players_username
        ON players(username)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_vehicles_player_id
        ON vehicles(player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_vehicles_plate
        ON vehicles(plate)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_properties_player_id
        ON properties(player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_properties_type
        ON properties(type)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_plates_player_id
        ON plates(player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_sessions_status
        ON game_sessions(status)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_sessions_updated_at
        ON game_sessions(updated_at)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_settlements_status
        ON game_settlements(status)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_settlements_winner
        ON game_settlements(winner_player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_settlements_loser
        ON game_settlements(loser_player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_transactions_game_id
        ON game_transactions(game_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_transactions_player_id
        ON game_transactions(player_id)
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
        idx_game_transactions_created_at
        ON game_transactions(created_at)
    `);


    /*
    =====================================================
    DATA NORMALIZATION
    =====================================================
    */

    await run(`
        UPDATE players
        SET
            balance = COALESCE(balance, 0),
            reserved_balance = COALESCE(
                reserved_balance,
                0
            ),
            xp = COALESCE(xp, 0),
            level = COALESCE(level, 1),
            games_played = COALESCE(
                games_played,
                0
            ),
            wins = COALESCE(wins, 0),
            losses = COALESCE(losses, 0),
            draws = COALESCE(draws, 0),
            updated_at = COALESCE(
                updated_at,
                NOW()
            )
    `);


    await run(`
        UPDATE game_settlements
        SET
            status = COALESCE(
                status,
                'pending'
            ),
            stake = COALESCE(
                stake,
                0
            ),
            winner_amount = COALESCE(
                winner_amount,
                0
            ),
            loser_amount = COALESCE(
                loser_amount,
                0
            ),
            updated_at = COALESCE(
                updated_at,
                NOW()
            )
    `);


    await run(`
        UPDATE game_sessions
        SET
            updated_at = COALESCE(
                updated_at,
                NOW()
            )
    `);


    /*
    =====================================================
    SAFETY CHECKS
    =====================================================

    Эти ограничения добавляем только если их ещё нет.

    Используем отдельные DO-блоки PostgreSQL, чтобы
    существующая БД не падала при повторном запуске.
    */

    await run(`
        DO $$
        BEGIN

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname =
                    'players_balance_non_negative'
            ) THEN

                ALTER TABLE players
                ADD CONSTRAINT
                    players_balance_non_negative
                CHECK (
                    balance >= 0
                );

            END IF;

        END
        $$;
    `);


    await run(`
        DO $$
        BEGIN

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname =
                    'players_reserved_balance_non_negative'
            ) THEN

                ALTER TABLE players
                ADD CONSTRAINT
                    players_reserved_balance_non_negative
                CHECK (
                    reserved_balance >= 0
                );

            END IF;

        END
        $$;
    `);


    /*
    =====================================================
    FOREIGN KEYS
    =====================================================

    Для уже существующих проектов не добавляем FK
    автоматически: если в старой БД есть исторические
    записи без соответствующего игрока, миграция может
    остановить запуск всего сервера.

    Связи будут добавлены отдельной безопасной миграцией
    после проверки существующих данных.

    =====================================================
    */

    console.log(
        "[DATABASE] Schema initialized successfully"
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
