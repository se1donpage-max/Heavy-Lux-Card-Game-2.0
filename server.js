"use strict";

/*
=========================================================
HEAVY LUX CARD
SERVER
=========================================================

ONLINE SERVER + SOCKET.IO + LOBBY

Отвечает за:

- HTTP server
- Express
- Socket.IO
- онлайн-лобби
- комнаты
- подключение игроков
- переподключение
- готовность
- старт игры
- игровые действия
- синхронизацию состояния

Игровая механика находится в:

./game.js

Комнаты и лобби находятся в:

./rooms.js

=========================================================
*/

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const {
    rooms,
    ROOM_STATUS
} = require("./rooms");

const {
    GAME_STATUS,
    PHASE,

    getPlayer,
    getGameState,
    getPossibleAttacks,
    getPossibleDefenses,

    playFirstAttackCard,
    addAttackCard,
    defend,
    takeCards,
    endAttack
} = require("./game");


/*
=========================================================
CONFIG
=========================================================
*/

const PORT =
    Number(process.env.PORT) ||
    10000;

const CLIENT_ORIGIN =
    process.env.CLIENT_ORIGIN ||
    "*";


/*
=========================================================
EXPRESS
=========================================================
*/

const app =
    express();

app.use(
    cors({
        origin: CLIENT_ORIGIN === "*"
            ? true
            : CLIENT_ORIGIN
    })
);

app.use(
    express.json()
);


/*
=========================================================
HTTP SERVER
=========================================================
*/

const httpServer =
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
        httpServer,
        {
            cors: {

                origin:
                    CLIENT_ORIGIN === "*"
                        ? "*"
                        : CLIENT_ORIGIN,

                methods: [
                    "GET",
                    "POST"
                ],

                credentials:
                    CLIENT_ORIGIN !== "*"

            },

            transports: [
                "websocket",
                "polling"
            ]

        }
    );


/*
=========================================================
BASIC HTTP ROUTES
=========================================================
*/

app.get(
    "/",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "Heavy Lux Card",

            status:
                "online",

            socket:
                "ready",

            rooms:
                rooms.getRoomCount(),

            online:
                rooms.getOnlinePlayerCount()

        });

    }
);


app.get(
    "/health",
    (req, res) => {

        res.json({

            ok: true,

            status:
                "healthy",

            rooms:
                rooms.getRoomCount(),

            online:
                rooms.getOnlinePlayerCount(),

            timestamp:
                Date.now()

        });

    }
);


/*
=========================================================
UTILITY
=========================================================
*/


function normalizeString(
    value,
    maxLength = 100
) {

    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const result =
        value.trim();

    if (
        result.length === 0
    ) {
        return null;
    }

    return result.slice(
        0,
        maxLength
    );

}


function requirePlayerId(
    socket
) {

    if (
        typeof socket.data.playerId !==
        "string" ||
        socket.data.playerId.length === 0
    ) {

        throw new Error(
            "Player is not authenticated"
        );

    }

    return socket.data.playerId;

}


function sendError(
    socket,
    code,
    message
) {

    socket.emit(
        "error_message",
        {

            code,

            message

        }
    );

}


function getSocketRoom(
    socket
) {

    const roomId =
        socket.data.roomId;

    if (!roomId) {
        return null;
    }

    return rooms.getRoom(
        roomId
    );

}


/*
=========================================================
PLAYER VIEW
=========================================================

Никогда не отправляем клиенту
внутренний объект player.

=========================================================
*/

function getPlayerView(
    player
) {

    if (!player) {
        return null;
    }

    return {

        playerId:
            player.playerId,

        name:
            player.name,

        username:
            player.username,

        connected:
            player.connected,

        ready:
            player.ready

    };

}


/*
=========================================================
LOBBY STATE
=========================================================
*/

function getLobbyState(
    room
) {

    if (!room) {
        return null;
    }

    return {

        roomId:
            room.roomId,

        status:
            room.status,

        hostPlayerId:
            room.hostPlayerId,

        playerCount:
            room.players.length,

        minPlayers:
            2,

        maxPlayers:
            3,

        players:
            room.players.map(
                getPlayerView
            ),

        canStart:
            rooms.canStartRoom(
                room
            )

    };

}


/*
=========================================================
PLAYER GAME STATE
=========================================================

Очень важно:

getGameState() не содержит
чужие руки.

Но конкретному игроку
мы отдельно отправляем
его собственную руку.

=========================================================
*/

function getPrivateGameState(
    room,
    playerId
) {

    if (
        !room ||
        !room.game
    ) {
        return null;
    }

    const game =
        room.game;

    const player =
        getPlayer(
            game,
            playerId
        );

    if (!player) {
        return null;
    }

    const state =
        getGameState(
            game
        );

    state.myPlayerId =
        playerId;

    state.myHand =
        player.hand;

    state.myHandSize =
        player.hand.length;

    state.possibleAttacks =
        getPossibleAttacks(
            game,
            playerId
        );

    state.possibleDefenses =
        getPossibleDefenses(
            game,
            playerId
        );

    /*
    Может ли игрок взять карты.
    */

    state.canTake =
        game.phase === PHASE.DEFENSE &&
        game.defenderId === playerId &&
        game.turnPlayerId === playerId;

    /*
    Может ли игрок закончить атаку.
    */

    state.canEndAttack =
        game.phase === PHASE.DEFENSE &&
        game.defenderId !== playerId &&
        game.turnPlayerId === playerId &&
        game.currentAttackPlayerId === playerId;

    return state;

}


/*
=========================================================
JOIN SOCKET ROOM
=========================================================
*/

function joinSocketRoom(
    socket,
    room
) {

    if (!room) {
        return;
    }

    /*
    Если socket уже находится
    в другой socket-комнате —
    выходим из неё.
    */

    const oldRoomId =
        socket.data.roomId;

    if (
        oldRoomId &&
        oldRoomId !== room.roomId
    ) {

        socket.leave(
            oldRoomId
        );

    }

    socket.join(
        room.roomId
    );

    socket.data.roomId =
        room.roomId;

}


/*
=========================================================
EMIT LOBBY STATE
=========================================================
*/

function emitLobbyState(
    room
) {

    if (!room) {
        return;
    }

    const state =
        getLobbyState(
            room
        );

    io.to(
        room.roomId
    ).emit(
        "lobby_state",
        state
    );

}


/*
=========================================================
EMIT GAME STATES
=========================================================

Каждому игроку отправляется
его собственная рука.

=========================================================
*/

function emitGameStates(
    room
) {

    if (
        !room ||
        !room.game
    ) {
        return;
    }

    for (
        const player of room.players
    ) {

        const state =
            getPrivateGameState(
                room,
                player.playerId
            );

        if (!state) {
            continue;
        }

        io.to(
            room.roomId
        )
        .emit(
            "game_state",
            {
                targetPlayerId:
                    player.playerId,

                state
            }
        );

    }

}


/*
=========================================================
EMIT PERSONAL GAME STATE
=========================================================
*/

function emitPersonalGameState(
    playerId
) {

    const room =
        rooms.getPlayerRoom(
            playerId
        );

    if (
        !room ||
        !room.game
    ) {
        return;
    }

    const state =
        getPrivateGameState(
            room,
            playerId
        );

    if (!state) {
        return;
    }

    /*
    Находим все sockets
    данного playerId.

    Это позволяет поддержать
    переподключение.
    */

    for (
        const socket of io.sockets.sockets.values()
    ) {

        if (
            socket.data.playerId ===
            playerId
        ) {

            socket.emit(
                "game_state",
                {
                    targetPlayerId:
                        playerId,

                    state
                }
            );

        }

    }

}


/*
=========================================================
EMIT ALL PERSONAL GAME STATES
=========================================================
*/

function emitAllGameStates(
    room
) {

    if (!room) {
        return;
    }

    for (
        const player of room.players
    ) {

        emitPersonalGameState(
            player.playerId
        );

    }

}


/*
=========================================================
EMIT ROOM STATE
=========================================================
*/

function emitRoomState(
    room
) {

    if (!room) {
        return;
    }

    if (
        room.status ===
        ROOM_STATUS.LOBBY
    ) {

        emitLobbyState(
            room
        );

        return;

    }

    if (
        room.status ===
        ROOM_STATUS.PLAYING ||
        room.status ===
        ROOM_STATUS.FINISHED
    ) {

        io.to(
            room.roomId
        ).emit(
            "room_state",
            {
                roomId:
                    room.roomId,

                status:
                    room.status,

                hostPlayerId:
                    room.hostPlayerId,

                players:
                    room.players.map(
                        getPlayerView
                    )
            }
        );

        emitAllGameStates(
            room
        );

    }

}


/*
=========================================================
PUBLIC ROOMS
=========================================================
*/

function emitPublicRooms() {

    io.emit(
        "rooms_list",
        rooms.getPublicRooms()
    );

}


/*
=========================================================
JOIN ROOM NOTIFICATION
=========================================================
*/

function emitPlayerJoined(
    room,
    player
) {

    if (!room || !player) {
        return;
    }

    io.to(
        room.roomId
    ).emit(
        "player_joined",
        {

            player:
                getPlayerView(
                    player
                )

        }
    );

}


/*
=========================================================
PLAYER LEFT NOTIFICATION
=========================================================
*/

function emitPlayerLeft(
    room,
    playerId
) {

    if (!room) {
        return;
    }

    io.to(
        room.roomId
    ).emit(
        "player_left",
        {

            playerId

        }
    );

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
            `[SOCKET] Connected: ${socket.id}`
        );


        /*
        =================================================
        AUTH
        =================================================
        */

        socket.on(
            "auth",
            data => {

                try {

                    if (
                        socket.data.playerId
                    ) {

                        throw new Error(
                            "Player is already authenticated"
                        );

                    }

                    if (!data) {

                        throw new Error(
                            "Auth data is required"
                        );

                    }

                    const playerId =
                        normalizeString(
                            data.playerId,
                            100
                        );

                    if (!playerId) {

                        throw new Error(
                            "playerId is required"
                        );

                    }

                    const name =
                        normalizeString(
                            data.name,
                            100
                        );

                    const username =
                        normalizeString(
                            data.username,
                            100
                        );

                    const telegramId =
                        normalizeString(
                            data.telegramId,
                            100
                        );

                    socket.data.playerId =
                        playerId;

                    socket.data.name =
                        name;

                    socket.data.username =
                        username;

                    socket.data.telegramId =
                        telegramId;

                    /*
                    Проверяем существующую
                    комнату игрока.

                    Это важно для
                    переподключения.
                    */

                    const existingRoom =
                        rooms.getPlayerRoom(
                            playerId
                        );

                    if (existingRoom) {

                        const player =
                            getPlayer(
                                existingRoom.game ||
                                {
                                    players:
                                        []
                                },
                                playerId
                            );

                        /*
                        Если это комната
                        лобби — просто сообщаем,
                        что игрок уже числится
                        в ней.

                        Если игра идёт —
                        тоже позволяем
                        восстановиться.
                        */

                        const roomPlayer =
                            existingRoom.players.find(
                                p =>
                                    p.playerId ===
                                    playerId
                            );

                        if (
                            roomPlayer
                        ) {

                            roomPlayer.connected =
                                true;

                            roomPlayer.lastSeenAt =
                                Date.now();

                            joinSocketRoom(
                                socket,
                                existingRoom
                            );

                            socket.emit(
                                "auth_success",
                                {

                                    playerId,

                                    roomId:
                                        existingRoom.roomId,

                                    reconnected:
                                        true

                                }
                            );

                            emitRoomState(
                                existingRoom
                            );

                            return;

                        }

                    }

                    socket.emit(
                        "auth_success",
                        {

                            playerId,

                            roomId:
                                null,

                            reconnected:
                                false

                        }
                    );

                } catch (error) {

                    console.error(
                        "[AUTH ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "AUTH_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        GET ROOMS
        =================================================
        */

        socket.on(
            "rooms_list",
            () => {

                socket.emit(
                    "rooms_list",
                    rooms.getPublicRooms()
                );

            }
        );


        /*
        =================================================
        CREATE ROOM
        =================================================
        */

        socket.on(
            "create_room",
            () => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    /*
                    Нельзя создать
                    вторую комнату.
                    */

                    if (
                        rooms.hasPlayer(
                            playerId
                        )
                    ) {

                        throw new Error(
                            "Player is already in a room"
                        );

                    }

                    const room =
                        rooms.createRoom({

                            playerId,

                            name:
                                socket.data.name,

                            username:
                                socket.data.username,

                            telegramId:
                                socket.data.telegramId

                        });

                    joinSocketRoom(
                        socket,
                        room
                    );

                    socket.emit(
                        "room_created",
                        {

                            roomId:
                                room.roomId,

                            hostPlayerId:
                                room.hostPlayerId

                        }
                    );

                    emitRoomState(
                        room
                    );

                    emitPublicRooms();

                    console.log(
                        `[ROOM] Created ${room.roomId} by ${playerId}`
                    );

                } catch (error) {

                    console.error(
                        "[CREATE ROOM ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "CREATE_ROOM_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        JOIN ROOM
        =================================================
        */

        socket.on(
            "join_room",
            data => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    if (!data) {

                        throw new Error(
                            "Room data is required"
                        );

                    }

                    const roomId =
                        normalizeString(
                            data.roomId,
                            100
                        );

                    if (!roomId) {

                        throw new Error(
                            "roomId is required"
                        );

                    }

                    const room =
                        rooms.joinRoom(
                            roomId,
                            {

                                playerId,

                                name:
                                    socket.data.name,

                                username:
                                    socket.data.username,

                                telegramId:
                                    socket.data.telegramId

                            }
                        );

                    joinSocketRoom(
                        socket,
                        room
                    );

                    const player =
                        room.players.find(
                            p =>
                                p.playerId ===
                                playerId
                        );

                    socket.emit(
                        "room_joined",
                        {

                            roomId:
                                room.roomId,

                            playerId,

                            hostPlayerId:
                                room.hostPlayerId

                        }
                    );

                    emitPlayerJoined(
                        room,
                        player
                    );

                    emitRoomState(
                        room
                    );

                    emitPublicRooms();

                    console.log(
                        `[ROOM] ${playerId} joined ${room.roomId}`
                    );

                } catch (error) {

                    console.error(
                        "[JOIN ROOM ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "JOIN_ROOM_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        LEAVE ROOM
        =================================================
        */

        socket.on(
            "leave_room",
            () => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    const room =
                        rooms.getPlayerRoom(
                            playerId
                        );

                    if (!room) {

                        socket.emit(
                            "room_left",
                            {

                                roomId:
                                    null

                            }
                        );

                        return;

                    }

                    const roomId =
                        room.roomId;

                    /*
                    Нельзя просто выйти
                    из активной игры.

                    Здесь оставляем
                    игрока в комнате,
                    чтобы game.js сохранил
                    авторитетное состояние.

                    Для полного выхода
                    во время игры потребуется
                    отдельная политика
                    surrender/disconnect.
                    */

                    if (
                        room.status ===
                        ROOM_STATUS.PLAYING
                    ) {

                        throw new Error(
                            "Cannot leave an active game"
                        );

                    }

                    rooms.leaveRoom(
                        playerId
                    );

                    socket.leave(
                        roomId
                    );

                    socket.data.roomId =
                        null;

                    socket.emit(
                        "room_left",
                        {

                            roomId

                        }
                    );

                    emitPlayerLeft(
                        room,
                        playerId
                    );

                    if (
                        rooms.getRoom(
                            roomId
                        )
                    ) {

                        emitRoomState(
                            rooms.getRoom(
                                roomId
                            )
                        );

                    }

                    emitPublicRooms();

                    console.log(
                        `[ROOM] ${playerId} left ${roomId}`
                    );

                } catch (error) {

                    console.error(
                        "[LEAVE ROOM ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "LEAVE_ROOM_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        READY
        =================================================
        */

        socket.on(
            "ready",
            data => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    const room =
                        getSocketRoom(
                            socket
                        );

                    if (!room) {

                        throw new Error(
                            "Player is not in a room"
                        );

                    }

                    if (
                        room.status !==
                        ROOM_STATUS.LOBBY
                    ) {

                        throw new Error(
                            "Room is not in lobby"
                        );

                    }

                    const ready =
                        data &&
                        typeof data.ready ===
                        "boolean"
                            ? data.ready
                            : true;

                    rooms.setReady(
                        room.roomId,
                        playerId,
                        ready
                    );

                    emitRoomState(
                        room
                    );

                } catch (error) {

                    console.error(
                        "[READY ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "READY_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        TOGGLE READY
        =================================================
        */

        socket.on(
            "toggle_ready",
            () => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    const room =
                        getSocketRoom(
                            socket
                        );

                    if (!room) {

                        throw new Error(
                            "Player is not in a room"
                        );

                    }

                    rooms.toggleReady(
                        room.roomId,
                        playerId
                    );

                    emitRoomState(
                        room
                    );

                } catch (error) {

                    console.error(
                        "[TOGGLE READY ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "TOGGLE_READY_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        START GAME
        =================================================
        */

        socket.on(
            "start_game",
            () => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    const room =
                        getSocketRoom(
                            socket
                        );

                    if (!room) {

                        throw new Error(
                            "Player is not in a room"
                        );

                    }

                    const startedRoom =
                        rooms.startRoom(
                            room.roomId,
                            playerId
                        );

                    /*
                    Сначала сообщаем всем,
                    что лобби закончено.
                    */

                    io.to(
                        startedRoom.roomId
                    ).emit(
                        "game_started",
                        {

                            roomId:
                                startedRoom.roomId

                        }
                    );

                    /*
                    Теперь отправляем
                    игровые состояния.
                    */

                    emitRoomState(
                        startedRoom
                    );

                    emitPublicRooms();

                    console.log(
                        `[GAME] Started ${startedRoom.roomId}`
                    );

                } catch (error) {

                    console.error(
                        "[START GAME ERROR]",
                        error
                    );

                    sendError(
                        socket,
                        "START_GAME_ERROR",
                        error.message
                    );

                }

            }
        );


        /*
        =================================================
        PLAY FIRST ATTACK CARD
        =================================================
        */

        socket.on(
            "play_first_attack",
            data => {

                handleGameAction(
                    socket,
                    data,
                    "play_first_attack",
                    (
                        game,
                        playerId,
                        cardId
                    ) => {

                        playFirstAttackCard(
                            game,
                            playerId,
                            cardId
                        );

                    }
                );

            }
        );


        /*
        =================================================
        ADD ATTACK CARD
        =================================================
        */

        socket.on(
            "add_attack",
            data => {

                handleGameAction(
                    socket,
                    data,
                    "add_attack",
                    (
                        game,
                        playerId,
                        cardId
                    ) => {

                        addAttackCard(
                            game,
                            playerId,
                            cardId
                        );

                    }
                );

            }
        );


        /*
        =================================================
        DEFEND
        =================================================
        */

        socket.on(
            "defend",
            data => {

                handleGameAction(
                    socket,
                    data,
                    "defend",
                    (
                        game,
                        playerId,
                        cardId
                    ) => {

                        defend(
                            game,
                            playerId,
                            cardId
                        );

                    }
                );

            }
        );


        /*
        =================================================
        TAKE
        =================================================
        */

        socket.on(
            "take_cards",
            () => {

                handleGameAction(
                    socket,
                    {},
                    "take_cards",
                    (
                        game,
                        playerId
                    ) => {

                        takeCards(
                            game,
                            playerId
                        );

                    }
                );

            }
        );


        /*
        =================================================
        END ATTACK
        =================================================
        */

        socket.on(
            "end_attack",
            () => {

                handleGameAction(
                    socket,
                    {},
                    "end_attack",
                    (
                        game,
                        playerId
                    ) => {

                        endAttack(
                            game,
                            playerId
                        );

                    }
                );

            }
        );


        /*
        =================================================
        GET CURRENT ROOM
        =================================================
        */

        socket.on(
            "get_room_state",
            () => {

                try {

                    const playerId =
                        requirePlayerId(
                            socket
                        );

                    const room =
                        rooms.getPlayerRoom(
                            playerId
                        );

                    if (!room) {

                        socket.emit(
                            "room_state",
                            null
                        );

                        return;

                    }

                    joinSocketRoom(
                        socket,
                        room
                    );

                    emitPersonalStateToSocket(
                        socket,
                        room
                    );

                } catch (error) {

                    sendError(
                        socket,
                        "ROOM_STATE_ERROR",
                        error.message
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

                try {

                    const playerId =
                        socket.data.playerId;

                    if (!playerId) {

                        console.log(
                            `[SOCKET] Disconnected ${socket.id}: ${reason}`
                        );

                        return;

                    }

                    const room =
                        rooms.getPlayerRoom(
                            playerId
                        );

                    if (!room) {

                        console.log(
                            `[SOCKET] ${playerId} disconnected: ${reason}`
                        );

                        return;

                    }

                    /*
                    Помечаем игрока
                    disconnected.

                    НЕ удаляем его
                    моментально.
                    */

                    rooms.disconnectPlayer(
                        playerId
                    );

                    /*
                    Уведомляем комнату.
                    */

                    io.to(
                        room.roomId
                    ).emit(
                        "player_connection",
                        {

                            playerId,

                            connected:
                                false

                        }
                    );

                    emitRoomState(
                        room
                    );

                    console.log(
                        `[SOCKET] ${playerId} disconnected from ${room.roomId}: ${reason}`
                    );

                } catch (error) {

                    console.error(
                        "[DISCONNECT ERROR]",
                        error
                    );

                }

            }
        );

    }
);


/*
=========================================================
GAME ACTION HANDLER
=========================================================

Единая точка входа для игровых
действий.

Все проверки выполняет game.js.

server.js не решает:

- можно ли ходить;
- можно ли бить;
- можно ли подкидывать;
- можно ли брать.

Это решает game.js.

=========================================================
*/

function handleGameAction(
    socket,
    data,
    actionName,
    action
) {

    try {

        const playerId =
            requirePlayerId(
                socket
            );

        const room =
            getSocketRoom(
                socket
            );

        if (!room) {

            throw new Error(
                "Player is not in a room"
            );

        }

        if (
            room.status !==
            ROOM_STATUS.PLAYING
        ) {

            throw new Error(
                "Game is not active"
            );

        }

        if (!room.game) {

            throw new Error(
                "Game state not found"
            );

        }

        /*
        Никогда не принимаем
        playerId из клиента.

        Используем только
        socket.data.playerId.
        */

        const cardId =
            data &&
            typeof data.cardId ===
            "string"
                ? data.cardId
                : null;

        action(
            room.game,
            playerId,
            cardId
        );

        /*
        После действия обновляем
        статус комнаты.

        Это важно для окончания игры.
        */

        rooms.updateRoomStatus(
            room
        );

        /*
        Отправляем подтверждение
        конкретного действия.
        */

        socket.emit(
            "action_success",
            {

                action:
                    actionName

            }
        );

        /*
        Отправляем новое состояние.
        */

        emitRoomState(
            room
        );

        /*
        Если игра завершилась —
        отдельное событие.
        */

        if (
            room.game.status ===
            GAME_STATUS.FINISHED
        ) {

            io.to(
                room.roomId
            ).emit(
                "game_finished",
                {

                    roomId:
                        room.roomId,

                    winnerId:
                        room.game.winnerId,

                    loserId:
                        room.game.loserId,

                    finishOrder:
                        room.game.finishOrder

                }
            );

        }

    } catch (error) {

        console.error(
            `[GAME ACTION ERROR] ${actionName}`,
            error
        );

        sendError(
            socket,
            "GAME_ACTION_ERROR",
            error.message
        );

    }

}


/*
=========================================================
SEND STATE TO SINGLE SOCKET
=========================================================
*/

function emitPersonalStateToSocket(
    socket,
    room
) {

    if (!room) {
        return;
    }

    if (
        room.status ===
        ROOM_STATUS.LOBBY
    ) {

        socket.emit(
            "lobby_state",
            getLobbyState(
                room
            )
        );

        return;

    }

    socket.emit(
        "room_state",
        {

            roomId:
                room.roomId,

            status:
                room.status,

            hostPlayerId:
                room.hostPlayerId,

            players:
                room.players.map(
                    getPlayerView
                )

        }
    );

    if (room.game) {

        const playerId =
            socket.data.playerId;

        const state =
            getPrivateGameState(
                room,
                playerId
            );

        if (state) {

            socket.emit(
                "game_state",
                {

                    targetPlayerId:
                        playerId,

                    state

                }
            );

        }

    }

}


/*
=========================================================
CLEANUP
=========================================================

Периодически удаляем только
реально пустые комнаты.

Отключённых игроков намеренно
не удаляем автоматически здесь,
потому что они могут
переподключиться.

=========================================================
*/

setInterval(
    () => {

        try {

            const deleted =
                rooms.cleanupEmptyRooms();

            if (
                deleted.length > 0
            ) {

                console.log(
                    `[ROOM CLEANUP] Deleted: ${deleted.join(", ")}`
                );

                emitPublicRooms();

            }

        } catch (error) {

            console.error(
                "[ROOM CLEANUP ERROR]",
                error
            );

        }

    },
    60 * 1000
);


/*
=========================================================
SERVER START
=========================================================
*/

httpServer.listen(
    PORT,
    () => {

        console.log(
            "================================================="
        );

        console.log(
            "HEAVY LUX CARD"
        );

        console.log(
            "ONLINE SERVER"
        );

        console.log(
            "================================================="
        );

        console.log(
            `Server started on port ${PORT}`
        );

        console.log(
            "Socket.IO: ready"
        );

        console.log(
            "Lobby: ready"
        );

        console.log(
            "Rooms: ready"
        );

        console.log(
            "Game engine: ready"
        );

        console.log(
            "================================================="
        );

    }
);


/*
=========================================================
PROCESS ERROR HANDLERS
=========================================================
*/

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[UNCAUGHT EXCEPTION]",
            error
        );

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[UNHANDLED REJECTION]",
            error
        );

    }
);


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    app,

    httpServer,

    io,

    rooms

};
