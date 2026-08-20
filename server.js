"use strict";

/*
=========================================================
HEAVY LUX CARD
SERVER
=========================================================

Express
HTTP
Socket.IO
Авторизация
Профиль
Лобби
Игровые комнаты
Классический подкидной Дурак

36 карт
2–3 игрока
Без перевода

Авторитетная игровая логика находится в:

src/game/game.js
src/game/rules.js
src/game/cards.js
src/game/deck.js

SERVER НЕ доверяет клиенту.
=========================================================
*/

const path = require("path");
const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");


/*
=========================================================
GAME ENGINE
=========================================================
*/

const {
    createGame,
    startGame,
    getPlayer,
    getGameState,
    playFirstAttackCard,
    addAttackCard,
    defend,
    takeCards,
    endAttack
} = require("./src/game/game");


const {
    GAME_STATUS
} = require("./src/game/game");


/*
=========================================================
CONFIG
=========================================================
*/

const PORT =
    Number(process.env.PORT) ||
    10000;

const HOST =
    "0.0.0.0";

const PUBLIC_DIR =
    path.join(
        __dirname,
        "public"
    );

const INDEX_FILE =
    path.join(
        PUBLIC_DIR,
        "index.html"
    );


const MIN_PLAYERS = 2;

const MAX_PLAYERS = 3;

const STARTING_BALANCE = 20000;

const DEFAULT_RATING = 1000;

const DEFAULT_LEVEL = 1;

const DEFAULT_XP = 0;


/*
=========================================================
EXPRESS
=========================================================
*/

const app =
    express();


app.disable(
    "x-powered-by"
);


app.use(
    express.json({
        limit: "1mb"
    })
);


app.use(
    express.urlencoded({
        extended: false
    })
);


/*
=========================================================
HTTP SERVER
=========================================================
*/

const server =
    http.createServer(
        app
    );


/*
=========================================================
SOCKET.IO
=========================================================
*/

const io =
    new Server(
        server,
        {
            cors: {
                origin: true,
                credentials: true
            },

            transports: [
                "websocket",
                "polling"
            ],

            connectionStateRecovery: {
                maxDisconnectionDuration:
                    2 * 60 * 1000,

                skipMiddlewares:
                    true
            }
        }
    );


/*
=========================================================
IN-MEMORY DATA
=========================================================

На данном этапе данные живут
в памяти процесса.

Для production позже можно
перенести это в PostgreSQL/Redis.
=========================================================
*/


const players =
    new Map();


const sockets =
    new Map();


const lobbies =
    new Map();


const games =
    new Map();


/*
=========================================================
UTILS
=========================================================
*/

function createId(
    prefix
) {

    return (
        prefix +
        "_" +
        crypto
            .randomBytes(8)
            .toString("hex")
    );

}


function normalizeString(
    value,
    fallback = ""
) {

    if (
        typeof value !==
        "string"
    ) {
        return fallback;
    }

    const result =
        value.trim();

    return result ||
        fallback;

}


function toNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return fallback;
    }

    return number;

}


function getLevelFromXP(
    xp
) {

    const value =
        Math.max(
            0,
            Number(xp) || 0
        );

    return (
        Math.floor(
            value / 1000
        ) + 1
    );

}


function getRankName(
    rating
) {

    const value =
        Number(rating) || 0;

    if (
        value >= 1800
    ) {
        return "ЭЛИТА";
    }

    if (
        value >= 1600
    ) {
        return "МАСТЕР";
    }

    if (
        value >= 1400
    ) {
        return "ВЕТЕРАН";
    }

    if (
        value >= 1200
    ) {
        return "ОПЫТНЫЙ";
    }

    return "НОВИЧОК";

}


/*
=========================================================
CREATE PLAYER PROFILE
=========================================================
*/

function createProfile({
    playerId,
    telegramId = null,
    name = "Игрок",
    username = ""
}) {

    return {

        playerId,

        telegramId,

        name:
            name ||
            "Игрок",

        username:
            username ||
            "",

        balance:
            STARTING_BALANCE,

        xp:
            DEFAULT_XP,

        level:
            DEFAULT_LEVEL,

        rating:
            DEFAULT_RATING,

        stats: {

            wins: 0,

            losses: 0,

            games: 0

        },

        cars: [],

        plates: [],

        property: [],

        businesses: [],

        activeCarId: null,

        activePlateId: null,

        createdAt:
            Date.now(),

        updatedAt:
            Date.now()

    };

}


/*
=========================================================
GET / CREATE PLAYER
=========================================================
*/

function getOrCreatePlayer({
    playerId,
    telegramId,
    name,
    username
}) {

    const id =
        normalizeString(
            playerId
        );

    if (!id) {

        throw new Error(
            "playerId is required"
        );

    }


    let player =
        players.get(id);


    if (!player) {

        player =
            createProfile({
                playerId:
                    id,

                telegramId:
                    telegramId ??
                    null,

                name:
                    name ||
                    "Игрок",

                username:
                    username ||
                    ""
            });


        players.set(
            id,
            player
        );

        return player;

    }


    if (
        telegramId !== undefined &&
        telegramId !== null
    ) {

        player.telegramId =
            telegramId;

    }


    if (name) {

        player.name =
            name;

    }


    if (username) {

        player.username =
            username;

    }


    player.updatedAt =
        Date.now();


    return player;

}


/*
=========================================================
SAFE PROFILE
=========================================================
*/

function getSafeProfile(
    player
) {

    if (!player) {
        return null;
    }


    return {

        playerId:
            player.playerId,

        telegramId:
            player.telegramId,

        name:
            player.name,

        username:
            player.username,

        balance:
            player.balance,

        xp:
            player.xp,

        level: {

            level:
                player.level,

            xp:
                player.xp

        },

        rating:
            player.rating,

        stats: {

            wins:
                player.stats.wins,

            losses:
                player.stats.losses,

            games:
                player.stats.games

        },

        rank:
            getRankName(
                player.rating
            ),

        cars:
            player.cars,

        plates:
            player.plates,

        property:
            player.property,

        businesses:
            player.businesses,

        activeCarId:
            player.activeCarId,

        activePlateId:
            player.activePlateId

    };

}


/*
=========================================================
HEALTH
=========================================================
*/

app.get(
    "/health",
    (_req, res) => {

        res.status(
            200
        ).json({

            ok: true,

            service:
                "heavy-lux-card",

            version:
                "2.0.2",

            socket:
                true,

            players:
                players.size,

            lobbies:
                lobbies.size,

            games:
                games.size

        });

    }
);


/*
=========================================================
FRONTEND
=========================================================
*/

app.use(
    express.static(
        PUBLIC_DIR,
        {
            index:
                "index.html",

            fallthrough:
                true,

            maxAge:
                process.env.NODE_ENV ===
                "production"
                    ? "1h"
                    : 0
        }
    )
);


/*
=========================================================
SPA FALLBACK
=========================================================
*/

app.get(
    /^(?!\/socket\.io)(?!\/health).*/,
    (_req, res) => {

        res.sendFile(
            INDEX_FILE
        );

    }
);


/*
=========================================================
LOBBY SERIALIZATION
=========================================================
*/

function serializeLobby(
    lobby
) {

    return {

        id:
            lobby.id,

        lobbyId:
            lobby.id,

        name:
            lobby.name,

        mode:
            lobby.mode,

        deckSize:
            36,

        bet:
            lobby.bet,

        maxPlayers:
            lobby.maxPlayers,

        playersCount:
            lobby.playerIds.length,

        currentPlayers:
            lobby.playerIds.length,

        players:
            lobby.playerIds.map(
                playerId => {

                    const player =
                        players.get(
                            playerId
                        );

                    return {

                        playerId,

                        name:
                            player?.name ||
                            "Игрок",

                        username:
                            player?.username ||
                            ""

                    };

                }
            ),

        status:
            lobby.status,

        createdAt:
            lobby.createdAt

    };

}


/*
=========================================================
GET LOBBIES
=========================================================
*/

function getPublicLobbies() {

    return Array
        .from(
            lobbies.values()
        )
        .filter(
            lobby =>
                lobby.status ===
                "waiting"
        )
        .map(
            serializeLobby
        );

}


/*
=========================================================
BROADCAST LOBBIES
=========================================================
*/

function broadcastLobbies() {

    io.emit(
        "lobbies",
        getPublicLobbies()
    );

}


/*
=========================================================
PLAYER ROOM
=========================================================
*/

function getPlayerLobby(
    playerId
) {

    for (
        const lobby of
        lobbies.values()
    ) {

        if (
            lobby.playerIds.includes(
                playerId
            )
        ) {

            return lobby;

        }

    }

    return null;

}


/*
=========================================================
PLAYER GAME
=========================================================
*/

function getPlayerGame(
    playerId
) {

    for (
        const game of
        games.values()
    ) {

        if (
            game.players.some(
                player =>
                    player.playerId ===
                    playerId
            )
        ) {

            return game;

        }

    }

    return null;

}


/*
=========================================================
GAME SOCKET ROOM
=========================================================
*/

function getGameSocketRoom(
    gameId
) {

    return `game:${gameId}`;

}


/*
=========================================================
PUBLIC GAME STATE
=========================================================
*/

function serializeGameForPlayer(
    game,
    playerId
) {

    const ownPlayer =
        getPlayer(
            game,
            playerId
        );


    if (!ownPlayer) {
        return null;
    }


    const lobby =
        lobbies.get(
            game.gameId
        );


    const playersState =
        game.players.map(
            player => ({

                playerId:
                    player.playerId,

                name:
                    players.get(
                        player.playerId
                    )?.name ||
                    "Игрок",

                username:
                    players.get(
                        player.playerId
                    )?.username ||
                    "",

                handSize:
                    player.hand.length,

                cardsCount:
                    player.hand.length,

                connected:
                    player.connected,

                eliminated:
                    player.eliminated

            })
        );


    /*
    Никогда не отправляем
    чужие карты.
    */

    return {

        gameId:
            game.gameId,

        roomId:
            game.gameId,

        lobbyId:
            game.gameId,

        roomName:
            lobby?.name ||
            "HEAVY ROOM",

        bet:
            lobby?.bet ||
            0,

        status:
            game.status,

        phase:
            game.phase,

        round:
            game.round,

        trumpSuit:
            game.trumpSuit,

        trump:
            game.trumpSuit,

        deckSize:
            game.deck.length,

        players:
            playersState,

        hand:
            ownPlayer.hand,

        playerHand:
            ownPlayer.hand,

        table:
            game.table,

        tableCards:
            game.table,

        attackerId:
            game.attackerId,

        defenderId:
            game.defenderId,

        turnPlayerId:
            game.turnPlayerId,

        attackLimit:
            game.attackLimit,

        winnerId:
            game.winnerId,

        loserId:
            game.loserId

    };

}


/*
=========================================================
EMIT GAME STATE
=========================================================
*/

function emitGameState(
    game
) {

    for (
        const player of
        game.players
    ) {

        const socketId =
            sockets.get(
                player.playerId
            );


        if (!socketId) {
            continue;
        }


        const socket =
            io.sockets.sockets.get(
                socketId
            );


        if (!socket) {
            continue;
        }


        socket.emit(
            "gameState",
            serializeGameForPlayer(
                game,
                player.playerId
            )
        );

    }

}


/*
=========================================================
EMIT PROFILE
=========================================================
*/

function emitProfile(
    socket,
    player
) {

    socket.emit(
        "profile",
        getSafeProfile(
            player
        )
    );

}


/*
=========================================================
AUTH
=========================================================
*/

function authenticate(
    socket,
    payload = {}
) {

    const telegramUser =
        payload.user ||
        null;


    let playerId =
        normalizeString(
            payload.playerId
        );


    let telegramId =
        payload.telegramId ??
        telegramUser?.id ??
        null;


    /*
    Telegram user.
    */

    if (
        telegramId !== null &&
        telegramId !== undefined
    ) {

        playerId =
            String(
                telegramId
            );

    }


    /*
    Browser guest.
    */

    if (!playerId) {

        playerId =
            createId(
                "guest"
            );

    }


    const name =
        normalizeString(
            telegramUser?.first_name ||
            telegramUser?.username ||
            payload.name,
            "Игрок"
        );


    const username =
        normalizeString(
            telegramUser?.username ||
            payload.username
        );


    const player =
        getOrCreatePlayer({

            playerId,

            telegramId,

            name,

            username

        });


    socket.data.playerId =
        player.playerId;

    socket.data.authenticated =
        true;


    sockets.set(
        player.playerId,
        socket.id
    );


    emitProfile(
        socket,
        player
    );


    socket.emit(
        "authSuccess",
        {

            ok: true,

            player:
                getSafeProfile(
                    player
                )

        }
    );


    socket.emit(
        "authenticated",
        {

            ok: true,

            playerId:
                player.playerId

        }
    );


    return player;

}


/*
=========================================================
REQUIRE AUTH
=========================================================
*/

function requirePlayer(
    socket
) {

    const playerId =
        socket.data.playerId;


    if (!playerId) {

        throw new Error(
            "Игрок не авторизован"
        );

    }


    const player =
        players.get(
            playerId
        );


    if (!player) {

        throw new Error(
            "Игрок не найден"
        );

    }


    return player;

}


/*
=========================================================
ERROR MESSAGE
=========================================================
*/

function normalizeErrorMessage(
    error
) {

    if (
        error instanceof Error
    ) {

        return error.message;

    }


    if (
        typeof error ===
        "string"
    ) {

        return error;

    }


    return "Неизвестная ошибка";

}


/*
=========================================================
SERVER ERROR
=========================================================
*/

function sendActionError(
    socket,
    error
) {

    const message =
        normalizeErrorMessage(
            error
        );


    console.error(
        `[ACTION ERROR] ${message}`
    );


    socket.emit(
        "actionError",
        message
    );

}


/*
=========================================================
CREATE LOBBY
=========================================================
*/

function createLobby(
    socket,
    payload = {}
) {

    const player =
        requirePlayer(
            socket
        );


    const existingLobby =
        getPlayerLobby(
            player.playerId
        );


    if (existingLobby) {

        throw new Error(
            "Вы уже находитесь в комнате"
        );

    }


    const playerCount =
        Math.min(
            MAX_PLAYERS,
            Math.max(
                MIN_PLAYERS,
                parseInt(
                    payload.players,
                    10
                ) || 2
            )
        );


    const bet =
        Math.max(
            0,
            Math.floor(
                toNumber(
                    payload.bet,
                    100
                )
            )
        );


    if (
        player.balance <
        bet
    ) {

        throw new Error(
            "Недостаточно HC для ставки"
        );

    }


    const lobbyId =
        createId(
            "room"
        );


    const lobby = {

        id:
            lobbyId,

        name:
            "Heavy Room",

        mode:
            "ПОДКИДНОЙ",

        bet,

        maxPlayers:
            playerCount,

        playerIds: [
            player.playerId
        ],

        status:
            "waiting",

        createdAt:
            Date.now(),

        gameId:
            null

    };


    lobbies.set(
        lobbyId,
        lobby
    );


    socket.join(
        `lobby:${lobbyId}`
    );


    socket.emit(
        "lobbyCreated",
        serializeLobby(
            lobby
        )
    );


    socket.emit(
        "roomState",
        {

            roomId:
                lobby.id,

            lobbyId:
                lobby.id,

            status:
                lobby.status,

            players:
                lobby.playerIds,

            maxPlayers:
                lobby.maxPlayers,

            bet:
                lobby.bet

        }
    );


    broadcastLobbies();


    return lobby;

}


/*
=========================================================
JOIN LOBBY
=========================================================
*/

function joinLobby(
    socket,
    payload = {}
) {

    const player =
        requirePlayer(
            socket
        );


    const lobbyId =
        normalizeString(
            payload.lobbyId ||
            payload.id
        );


    if (!lobbyId) {

        throw new Error(
            "Не указан ID комнаты"
        );

    }


    const lobby =
        lobbies.get(
            lobbyId
        );


    if (!lobby) {

        throw new Error(
            "Комната не найдена"
        );

    }


    if (
        lobby.status !==
        "waiting"
    ) {

        throw new Error(
            "Игра уже началась"
        );

    }


    if (
        lobby.playerIds.includes(
            player.playerId
        )
    ) {

        socket.join(
            `lobby:${lobby.id}`
        );

        return lobby;

    }


    if (
        lobby.playerIds.length >=
        lobby.maxPlayers
    ) {

        throw new Error(
            "Комната заполнена"
        );

    }


    if (
        player.balance <
        lobby.bet
    ) {

        throw new Error(
            "Недостаточно HC для ставки"
        );

    }


    const existingLobby =
        getPlayerLobby(
            player.playerId
        );


    if (existingLobby) {

        throw new Error(
            "Вы уже находитесь в другой комнате"
        );

    }


    lobby.playerIds.push(
        player.playerId
    );


    socket.join(
        `lobby:${lobby.id}`
    );


    io.to(
        `lobby:${lobby.id}`
    ).emit(
        "roomState",
        {

            roomId:
                lobby.id,

            lobbyId:
                lobby.id,

            status:
                lobby.status,

            players:
                lobby.playerIds,

            maxPlayers:
                lobby.maxPlayers,

            bet:
                lobby.bet

        }
    );


    socket.emit(
        "lobbyJoined",
        serializeLobby(
            lobby
        )
    );


    broadcastLobbies();


    if (
        lobby.playerIds.length >=
        lobby.maxPlayers
    ) {

        startLobbyGame(
            lobby
        );

    }


    return lobby;

}


/*
=========================================================
QUICK MATCH
=========================================================
*/

function quickMatch(
    socket,
    payload = {}
) {

    const player =
        requirePlayer(
            socket
        );


    const requestedPlayers =
        Math.min(
            MAX_PLAYERS,
            Math.max(
                MIN_PLAYERS,
                parseInt(
                    payload.players,
                    10
                ) || 2
            )
        );


    const requestedBet =
        Math.max(
            0,
            Math.floor(
                toNumber(
                    payload.bet,
                    100
                )
            )
        );


    const available =
        Array
            .from(
                lobbies.values()
            )
            .find(
                lobby =>
                    lobby.status ===
                        "waiting" &&

                    lobby.maxPlayers ===
                        requestedPlayers &&

                    lobby.bet ===
                        requestedBet &&

                    lobby.playerIds.length <
                        lobby.maxPlayers
            );


    if (available) {

        return joinLobby(
            socket,
            {
                lobbyId:
                    available.id
            }
        );

    }


    return createLobby(
        socket,
        {

            players:
                requestedPlayers,

            bet:
                requestedBet

        }
    );

}


/*
=========================================================
START LOBBY GAME
=========================================================
*/

function startLobbyGame(
    lobby
) {

    if (
        !lobby
    ) {
        return;
    }


    if (
        lobby.status !==
        "waiting"
    ) {
        return;
    }


    if (
        lobby.playerIds.length <
        MIN_PLAYERS
    ) {
        return;
    }


    lobby.status =
        "playing";


    const game =
        createGame({

            gameId:
                lobby.id,

            playerIds:
                lobby.playerIds

        });


    startGame(
        game
    );


    lobby.gameId =
        game.gameId;


    games.set(
        game.gameId,
        game
    );


    for (
        const playerId of
        lobby.playerIds
    ) {

        const socketId =
            sockets.get(
                playerId
            );


        if (!socketId) {
            continue;
        }


        const playerSocket =
            io.sockets.sockets.get(
                socketId
            );


        if (!playerSocket) {
            continue;
        }


        playerSocket.join(
            getGameSocketRoom(
                game.gameId
            )
        );


        playerSocket.emit(
            "gameStarted",
            {

                gameStarted:
                    true,

                roomId:
                    game.gameId,

                lobbyId:
                    game.gameId

            }
        );

    }


    emitGameState(
        game
    );


    broadcastLobbies();


    console.log(
        `[GAME] started ${game.gameId}`
    );

}


/*
=========================================================
UPDATE PLAYER STATS
=========================================================
*/

function finalizeGameProfiles(
    game
) {

    if (
        !game ||
        game.status !==
        GAME_STATUS.FINISHED
    ) {

        return;

    }


    for (
        const gamePlayer of
        game.players
    ) {

        const profile =
            players.get(
                gamePlayer.playerId
            );


        if (!profile) {
            continue;
        }


        profile.stats.games +=
            1;


        if (
            game.winnerId ===
            profile.playerId
        ) {

            profile.stats.wins +=
                1;

            profile.xp +=
                100;

            profile.rating +=
                25;

        }
        else if (
            game.loserId ===
            profile.playerId
        ) {

            profile.stats.losses +=
                1;

            profile.xp +=
                25;

            profile.rating =
                Math.max(
                    0,
                    profile.rating -
                        20
                );

        }


        profile.level =
            getLevelFromXP(
                profile.xp
            );


        profile.updatedAt =
            Date.now();


        const socketId =
            sockets.get(
                profile.playerId
            );


        if (socketId) {

            const socket =
                io.sockets.sockets.get(
                    socketId
                );


            if (socket) {

                emitProfile(
                    socket,
                    profile
                );

            }

        }

    }

}


/*
=========================================================
PROCESS GAME RESULT
=========================================================
*/

function processGameFinished(
    game
) {

    if (
        !game
    ) {
        return;
    }


    if (
        game.status !==
        GAME_STATUS.FINISHED
    ) {

        return;

    }


    finalizeGameProfiles(
        game
    );


    const lobby =
        lobbies.get(
            game.gameId
        );


    if (lobby) {

        lobby.status =
            "finished";

    }


    emitGameState(
        game
    );

}


/*
=========================================================
PLAY CARD
=========================================================
*/

function handlePlayCard(
    socket,
    payload = {}
) {

    const player =
        requirePlayer(
            socket
        );


    const game =
        getPlayerGame(
            player.playerId
        );


    if (!game) {

        throw new Error(
            "Вы не находитесь в игре"
        );

    }


    const cardId =
        normalizeString(
            payload.cardId ||
            payload.card
        );


    if (!cardId) {

        throw new Error(
            "Карта не указана"
        );

    }


    /*
    Первый заход.
    */

    if (
        game.table.length === 0 &&
        game.phase === "ATTACK"
    ) {

        playFirstAttackCard(
            game,
            player.playerId,
            cardId
        );

    }
    else if (
        game.phase === "DEFENSE" &&
        game.defenderId ===
            player.playerId
    ) {

        /*
        Защитник.
        */

        defend(
            game,
            player.playerId,
            cardId
        );

    }
    else {

        /*
        Подкидывание.
        */

        addAttackCard(
            game,
            player.playerId,
            cardId
        );

    }


    emitGameState(
        game
    );


    if (
        game.status ===
        GAME_STATUS.FINISHED
    ) {

        processGameFinished(
            game
        );

    }

}


/*
=========================================================
TAKE CARDS
=========================================================
*/

function handleTakeCards(
    socket
) {

    const player =
        requirePlayer(
            socket
        );


    const game =
        getPlayerGame(
            player.playerId
        );


    if (!game) {

        throw new Error(
            "Вы не находитесь в игре"
        );

    }


    takeCards(
        game,
        player.playerId
    );


    emitGameState(
        game
    );


    if (
        game.status ===
        GAME_STATUS.FINISHED
    ) {

        processGameFinished(
            game
        );

    }

}


/*
=========================================================
END ATTACK
=========================================================
*/

function handleEndAttack(
    socket
) {

    const player =
        requirePlayer(
            socket
        );


    const game =
        getPlayerGame(
            player.playerId
        );


    if (!game) {

        throw new Error(
            "Вы не находитесь в игре"
        );

    }


    endAttack(
        game,
        player.playerId
    );


    emitGameState(
        game
    );


    if (
        game.status ===
        GAME_STATUS.FINISHED
    ) {

        processGameFinished(
            game
        );

    }

}


/*
=========================================================
GARAGE
=========================================================
*/

function getGarage(
    player
) {

    return {

        cars:
            player.cars,

        plates:
            player.plates,

        activeCarId:
            player.activeCarId,

        activePlateId:
            player.activePlateId

    };

}


/*
=========================================================
MARKET
=========================================================
*/

function getMarket() {

    return [

        {

            id:
                "market_bmw_m5",

            type:
                "car",

            name:
                "BMW M5",

            plate:
                "А777АА77",

            price:
                1950000

        },

        {

            id:
                "market_mercedes_e63",

            type:
                "car",

            name:
                "Mercedes E63",

            plate:
                "У429РО77",

            price:
                2350000

        }

    ];

}


/*
=========================================================
SOCKET CONNECTION
=========================================================
*/

io.on(
    "connection",
    socket => {

        console.log(
            `[Socket.IO] connected: ${socket.id}`
        );


        socket.emit(
            "connectionReady",
            {

                ok: true,

                socketId:
                    socket.id

            }
        );


        /*
        =================================================
        AUTH
        =================================================
        */

        socket.on(
            "auth",
            (
                payload,
                callback
            ) => {

                try {

                    const player =
                        authenticate(
                            socket,
                            payload
                        );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: true,

                            player:
                                getSafeProfile(
                                    player
                                )
                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        GET PROFILE
        =================================================
        */

        socket.on(
            "getProfile",
            () => {

                try {

                    const player =
                        requirePlayer(
                            socket
                        );


                    emitProfile(
                        socket,
                        player
                    );

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );

                }

            }
        );


        /*
        =================================================
        CREATE LOBBY
        =================================================
        */

        socket.on(
            "createLobby",
            (
                payload,
                callback
            ) => {

                try {

                    const lobby =
                        createLobby(
                            socket,
                            payload
                        );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: true,

                            lobby:
                                serializeLobby(
                                    lobby
                                )

                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        GET LOBBIES
        =================================================
        */

        socket.on(
            "getLobbies",
            () => {

                socket.emit(
                    "lobbies",
                    getPublicLobbies()
                );


                socket.emit(
                    "lobbyList",
                    getPublicLobbies()
                );

            }
        );


        /*
        =================================================
        JOIN LOBBY
        =================================================
        */

        socket.on(
            "joinLobby",
            (
                payload,
                callback
            ) => {

                try {

                    const lobby =
                        joinLobby(
                            socket,
                            payload
                        );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: true,

                            lobby:
                                serializeLobby(
                                    lobby
                                )

                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        QUICK MATCH
        =================================================
        */

        socket.on(
            "quickMatch",
            (
                payload,
                callback
            ) => {

                try {

                    const lobby =
                        quickMatch(
                            socket,
                            payload
                        );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: true,

                            lobby:
                                serializeLobby(
                                    lobby
                                )

                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        GAME PLAY
        =================================================
        */

        socket.on(
            "playCard",
            (
                payload,
                callback
            ) => {

                try {

                    handlePlayCard(
                        socket,
                        payload
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: true
                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        TAKE
        =================================================
        */

        socket.on(
            "takeCards",
            (
                _payload,
                callback
            ) => {

                try {

                    handleTakeCards(
                        socket
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: true
                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        END ATTACK
        =================================================
        */

        socket.on(
            "endAttack",
            (
                _payload,
                callback
            ) => {

                try {

                    handleEndAttack(
                        socket
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({
                            ok: true
                        });

                    }

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );


                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback({

                            ok: false,

                            message:
                                normalizeErrorMessage(
                                    error
                                )

                        });

                    }

                }

            }
        );


        /*
        =================================================
        GET GARAGE
        =================================================
        */

        socket.on(
            "getGarage",
            () => {

                try {

                    const player =
                        requirePlayer(
                            socket
                        );


                    socket.emit(
                        "garage",
                        getGarage(
                            player
                        )
                    );

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );

                }

            }
        );


        /*
        =================================================
        GET MARKET
        =================================================
        */

        socket.on(
            "getMarket",
            () => {

                socket.emit(
                    "market",
                    getMarket()
                );

            }
        );


        /*
        =================================================
        PLAYER INFO
        =================================================
        */

        socket.on(
            "getPlayerInfo",
            payload => {

                try {

                    requirePlayer(
                        socket
                    );


                    const targetId =
                        normalizeString(
                            payload?.playerId
                        );


                    if (!targetId) {

                        throw new Error(
                            "Игрок не указан"
                        );

                    }


                    const target =
                        players.get(
                            targetId
                        );


                    if (!target) {

                        throw new Error(
                            "Игрок не найден"
                        );

                    }


                    socket.emit(
                        "playerInfo",
                        {

                            playerId:
                                target.playerId,

                            name:
                                target.name,

                            username:
                                target.username,

                            level:
                                target.level,

                            rating:
                                target.rating,

                            stats:
                                target.stats,

                            carsCount:
                                target.cars.length

                        }
                    );

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );

                }

            }
        );


        /*
        =================================================
        QUICK MESSAGE
        =================================================
        */

        socket.on(
            "quickMessage",
            payload => {

                try {

                    const player =
                        requirePlayer(
                            socket
                        );


                    const game =
                        getPlayerGame(
                            player.playerId
                        );


                    if (!game) {
                        return;
                    }


                    const allowed = [

                        "Спасибо за игру!",

                        "Хорошей игры!",

                        "Охх…",

                        "Скорее!"

                    ];


                    const text =
                        normalizeString(
                            payload?.text
                        );


                    if (
                        !allowed.includes(
                            text
                        )
                    ) {

                        return;

                    }


                    io.to(
                        getGameSocketRoom(
                            game.gameId
                        )
                    ).emit(
                        "quickMessage",
                        {

                            playerId:
                                player.playerId,

                            text

                        }
                    );

                }
                catch (error) {

                    sendActionError(
                        socket,
                        error
                    );

                }

            }
        );


        /*
        =================================================
        DISCONNECT
        =================================================
        */

        socket.on(
            "disconnect",
            reason => {

                const playerId =
                    socket.data.playerId;


                if (playerId) {

                    const player =
                        players.get(
                            playerId
                        );


                    if (player) {

                        const game =
                            getPlayerGame(
                                playerId
                            );


                        if (game) {

                            const gamePlayer =
                                getPlayer(
                                    game,
                                    playerId
                                );


                            if (
                                gamePlayer
                            ) {

                                gamePlayer.connected =
                                    false;

                            }


                            emitGameState(
                                game
                            );

                        }

                    }


                    if (
                        sockets.get(
                            playerId
                        ) ===
                        socket.id
                    ) {

                        sockets.delete(
                            playerId
                        );

                    }

                }


                console.log(
                    `[Socket.IO] disconnected: ${socket.id} (${reason})`
                );

            }
        );

    }
);


/*
=========================================================
PROCESS ERRORS
=========================================================
*/

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[uncaughtException]",
            error
        );

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[unhandledRejection]",
            error
        );

    }
);


/*
=========================================================
START SERVER
=========================================================
*/

server.listen(
    PORT,
    HOST,
    () => {

        console.log(
            "================================================="
        );

        console.log(
            "HEAVY LUX CARD"
        );

        console.log(
            "================================================="
        );

        console.log(
            `Server started on ${HOST}:${PORT}`
        );

        console.log(
            `Frontend directory: ${PUBLIC_DIR}`
        );

        console.log(
            `Index file: ${INDEX_FILE}`
        );

        console.log(
            "Socket.IO: ready"
        );

        console.log(
            "Game Engine: ready"
        );

        console.log(
            "36 cards: ready"
        );

        console.log(
            "Players: 2-3"
        );

        console.log(
            "Mode: Подкидной"
        );

        console.log(
            "================================================="
        );

    }
);


/*
=========================================================
GRACEFUL SHUTDOWN
=========================================================
*/

let shuttingDown =
    false;


function shutdown(
    signal
) {

    if (
        shuttingDown
    ) {

        return;

    }


    shuttingDown =
        true;


    console.log(
        `Received ${signal}. Shutting down...`
    );


    io.close(
        () => {

            server.close(
                () => {

                    process.exit(
                        0
                    );

                }
            );

        }
    );


    setTimeout(
        () => {

            process.exit(
                0
            );

        },
        10000
    ).unref();

}


process.on(
    "SIGTERM",
    () => {

        shutdown(
            "SIGTERM"
        );

    }
);


process.on(
    "SIGINT",
    () => {

        shutdown(
            "SIGINT"
        );

    }
);
