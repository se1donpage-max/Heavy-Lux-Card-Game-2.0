"use strict";

/*
=========================================================
HEAVY LUX CARD
SERVER.JS
=========================================================

Express
HTTP
Socket.IO
Durak 36 cards
2 players per room
No AI
Authoritative server
Reconnect
Profiles
Economy
Rooms

IMPORTANT:
config.js
engine.js
rooms/manager.js

не требуют изменений.
=========================================================
*/

const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");
const path = require("path");

const { Server } = require("socket.io");

const config = require("./config");

const {
    PORT,
    HOST,
    STAKES,
    DEFAULT_BALANCE,
    XP_WIN,
    XP_LOSS,
    XP_DRAW,
    LEVEL_BASE_XP
} = config;

const rooms = require("./rooms/manager");


/*
=========================================================
APP
=========================================================
*/

const app = express();

const httpServer =
    http.createServer(app);


app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/*
=========================================================
STATIC
=========================================================
*/

const publicPath =
    path.join(
        __dirname,
        "public"
    );

app.use(
    express.static(
        publicPath
    )
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
                origin: true,
                credentials: true
            },

            transports: [
                "websocket",
                "polling"
            ],

            pingInterval:
                25000,

            pingTimeout:
                20000,

            maxHttpBufferSize:
                1e6
        }
    );


/*
=========================================================
PLAYER STORAGE
=========================================================
*/

const players =
    new Map();


/*
=========================================================
UTILITY
=========================================================
*/

function safeString(
    value,
    fallback = ""
) {

    if (
        value === undefined ||
        value === null
    ) {

        return fallback;

    }

    return String(value).trim();

}


function createPlayerId() {

    return (
        "p_" +
        crypto
            .randomBytes(12)
            .toString("hex")
    );

}


function normalizeName(
    name
) {

    const value =
        safeString(
            name,
            "Игрок"
        );

    if (!value) {

        return "Игрок";

    }

    return value
        .slice(0, 24);

}


function normalizeStake(
    stake
) {

    const value =
        Number(stake);

    if (
        !Number.isFinite(value)
    ) {

        return 0;

    }

    return value;

}


/*
=========================================================
LEVEL
=========================================================
*/

function getLevelProgress(
    player
) {

    const xp =
        Math.max(
            0,
            Number(
                player.xp || 0
            )
        );

    const base =
        Math.max(
            1,
            Number(
                LEVEL_BASE_XP || 500
            )
        );

    const level =
        Math.floor(
            xp / base
        ) + 1;

    const current =
        xp % base;

    return {

        level,

        xp,

        currentXp:
            current,

        nextLevelXp:
            base,

        progress:
            Math.min(
                1,
                current / base
            )

    };

}


/*
=========================================================
CREATE PLAYER
=========================================================
*/

function createPlayer(
    data = {}
) {

    const playerId =
        safeString(
            data.playerId
        ) ||
        createPlayerId();

    const player = {

        playerId,

        telegramId:
            data.telegramId ||
            null,

        name:
            normalizeName(
                data.name
            ),

        username:
            safeString(
                data.username
            ) || null,

        balance:
            Number.isFinite(
                Number(data.balance)
            )
                ? Number(data.balance)
                : DEFAULT_BALANCE,

        xp:
            Number.isFinite(
                Number(data.xp)
            )
                ? Number(data.xp)
                : 0,

        stats: {

            games:
                Number(
                    data.stats &&
                    data.stats.games || 0
                ),

            wins:
                Number(
                    data.stats &&
                    data.stats.wins || 0
                ),

            losses:
                Number(
                    data.stats &&
                    data.stats.losses || 0
                ),

            draws:
                Number(
                    data.stats &&
                    data.stats.draws || 0
                )

        },

        roomId:
            null,

        socketId:
            null,

        connected:
            false,

        createdAt:
            data.createdAt ||
            Date.now(),

        lastSeenAt:
            Date.now()

    };

    return player;

}


/*
=========================================================
GET / CREATE PLAYER
=========================================================
*/

function getOrCreatePlayer(
    data = {}
) {

    let playerId =
        safeString(
            data.playerId
        );

    if (
        playerId &&
        players.has(playerId)
    ) {

        const player =
            players.get(
                playerId
            );

        if (data.name) {

            player.name =
                normalizeName(
                    data.name
                );

        }

        if (data.username !== undefined) {

            player.username =
                safeString(
                    data.username
                ) || null;

        }

        if (data.telegramId !== undefined) {

            player.telegramId =
                data.telegramId || null;

        }

        player.lastSeenAt =
            Date.now();

        return player;

    }


    const player =
        createPlayer(
            data
        );

    players.set(
        player.playerId,
        player
    );

    return player;

}


/*
=========================================================
PLAYER STATE
=========================================================
*/

function getPlayer(
    playerId
) {

    if (!playerId) {

        return null;

    }

    return (
        players.get(
            String(playerId)
        ) ||
        null
    );

}


/*
=========================================================
PROFILE
=========================================================
*/

function getPublicProfile(
    player
) {

    if (!player) {

        return null;

    }

    const level =
        getLevelProgress(
            player
        );

    return {

        playerId:
            player.playerId,

        telegramId:
            player.telegramId,

        name:
            player.name,

        username:
            player.username,

        wallet:
            player.balance,

        balance:
            player.balance,

        xp:
            player.xp,

        level,

        stats: {

            games:
                player.stats.games,

            wins:
                player.stats.wins,

            losses:
                player.stats.losses,

            draws:
                player.stats.draws

        },

        roomId:
            player.roomId

    };

}


/*
=========================================================
SETTLEMENT
=========================================================
*/

function applySettlement(
    room,
    winnerId,
    loserId,
    settlement
) {

    if (!room) {

        return;

    }

    const stake =
        Number(
            room.stake || 0
        );

    const winner =
        getPlayer(
            winnerId
        );

    const loser =
        getPlayer(
            loserId
        );


    /*
    -----------------------------------------------------
    DRAW
    -----------------------------------------------------
    */

    if (
        settlement === "draw"
    ) {

        for (
            const player
            of room.players
        ) {

            const profile =
                getPlayer(
                    player.playerId
                );

            if (!profile) {
                continue;
            }

            profile.stats.games += 1;
            profile.stats.draws += 1;
            profile.xp += XP_DRAW;

        }

        return;

    }


    /*
    -----------------------------------------------------
    WIN / FORFEIT
    -----------------------------------------------------
    */

    if (winner) {

        winner.stats.games += 1;
        winner.stats.wins += 1;
        winner.xp += XP_WIN;

        if (stake > 0) {

            winner.balance +=
                stake;

        }

    }


    if (loser) {

        loser.stats.games += 1;
        loser.stats.losses += 1;
        loser.xp += XP_LOSS;

        if (stake > 0) {

            loser.balance =
                Math.max(
                    0,
                    loser.balance - stake
                );

        }

    }

}


/*
=========================================================
TRACK ROOM RESULT
=========================================================
*/

const settledRooms =
    new Set();


function settleRoom(
    room
) {

    if (!room) {

        return;

    }

    if (
        room.status !== "finished"
    ) {

        return;

    }

    if (
        settledRooms.has(
            room.id
        )
    ) {

        return;

    }

    settledRooms.add(
        room.id
    );

    applySettlement(
        room,
        room.winnerId,
        room.loserId,
        room.settlement
    );

}


/*
=========================================================
ROOM STATE
=========================================================
*/

function getRoomPublicState(
    room,
    playerId
) {

    if (!room) {

        return null;

    }

    return rooms.getPublicState(
        room,
        playerId
    );

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

    for (
        const roomPlayer
        of room.players
    ) {

        const player =
            getPlayer(
                roomPlayer.playerId
            );

        if (!player) {
            continue;
        }

        if (!player.socketId) {
            continue;
        }

        const socket =
            io.sockets.sockets.get(
                player.socketId
            );

        if (!socket) {
            continue;
        }

        socket.emit(
            "room_state",
            getRoomPublicState(
                room,
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
    player
) {

    if (!player) {

        return;

    }

    if (!player.socketId) {

        return;

    }

    const socket =
        io.sockets.sockets.get(
            player.socketId
        );

    if (!socket) {

        return;

    }

    socket.emit(
        "profile",
        getPublicProfile(
            player
        )
    );

}


/*
=========================================================
ROOM LIST
=========================================================
*/

function emitRoomList() {

    io.emit(
        "rooms",
        rooms.getPublicRoomList()
    );

}


/*
=========================================================
SEND ERROR
=========================================================
*/

function sendError(
    socket,
    error
) {

    socket.emit(
        "error_message",
        {
            ok: false,
            error:
                safeString(
                    error,
                    "Произошла ошибка."
                )
        }
    );

}


/*
=========================================================
VALIDATE STAKE
=========================================================
*/

function isValidStake(
    stake
) {

    return STAKES.includes(
        Number(stake)
    );

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

function handleCreateRoom(
    socket,
    data
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    if (player.roomId) {

        sendError(
            socket,
            "Вы уже находитесь в комнате."
        );

        return;

    }


    const stake =
        normalizeStake(
            data &&
            data.stake
        );


    if (
        !isValidStake(
            stake
        )
    ) {

        sendError(
            socket,
            "Недопустимая ставка."
        );

        return;

    }


    if (
        player.balance <
        stake
    ) {

        sendError(
            socket,
            "Недостаточно средств."
        );

        return;

    }


    const result =
        rooms.createRoom(
            {
                player,
                playerId:
                    player.playerId,
                name:
                    player.name,
                socketId:
                    socket.id,
                stake
            }
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    socket.join(
        result.room.id
    );


    socket.emit(
        "room_created",
        {
            ok: true,
            room:
                rooms.getRoomSummary(
                    result.room
                )
        }
    );


    emitRoomState(
        result.room
    );

    emitRoomList();

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function handleJoinRoom(
    socket,
    data
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    const roomId =
        safeString(
            data &&
            data.roomId
        ).toUpperCase();


    if (!roomId) {

        sendError(
            socket,
            "Не указан ID комнаты."
        );

        return;

    }


    const room =
        rooms.getRoom(
            roomId
        );


    if (!room) {

        sendError(
            socket,
            "Комната не найдена."
        );

        return;

    }


    if (
        player.roomId &&
        String(
            player.roomId
        ) !== room.id
    ) {

        sendError(
            socket,
            "Вы уже находитесь в другой комнате."
        );

        return;

    }


    if (
        player.balance <
        Number(room.stake || 0)
    ) {

        sendError(
            socket,
            "Недостаточно средств."
        );

        return;

    }


    const result =
        rooms.joinRoom(
            {
                player,
                roomId:
                    room.id,
                playerId:
                    player.playerId,
                name:
                    player.name,
                socketId:
                    socket.id
            }
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    socket.join(
        room.id
    );


    socket.emit(
        "room_joined",
        {
            ok: true,
            room:
                rooms.getRoomSummary(
                    room
                ),
            reconnected:
                Boolean(
                    result.reconnected
                )
        }
    );


    if (result.started) {

        /*
        Ставка списывается только
        при фактическом старте.
        */

        const stake =
            Number(
                room.stake || 0
            );

        for (
            const roomPlayer
            of room.players
        ) {

            const profile =
                getPlayer(
                    roomPlayer.playerId
                );

            if (profile) {

                profile.balance =
                    Math.max(
                        0,
                        profile.balance - stake
                    );

            }

        }

    }


    emitRoomState(
        room
    );

    emitProfile(
        player
    );

    emitRoomList();

}


/*
=========================================================
RECONNECT
=========================================================
*/

function handleReconnect(
    socket,
    data
) {

    const playerId =
        safeString(
            data &&
            data.playerId
        );

    const roomId =
        safeString(
            data &&
            data.roomId
        );


    if (!playerId) {

        sendError(
            socket,
            "Не указан playerId."
        );

        return;

    }


    const player =
        getPlayer(
            playerId
        );


    if (!player) {

        sendError(
            socket,
            "Игрок не найден."
        );

        return;

    }


    if (!roomId) {

        player.socketId =
            socket.id;

        player.connected =
            true;

        player.lastSeenAt =
            Date.now();

        socket.player =
            player;

        emitProfile(
            player
        );

        return;

    }


    const result =
        rooms.reconnectPlayer(
            {
                player,
                roomId,
                playerId,
                socketId:
                    socket.id,
                name:
                    player.name
            }
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    player.socketId =
        socket.id;

    player.connected =
        true;

    player.roomId =
        result.room.id;

    player.lastSeenAt =
        Date.now();

    socket.player =
        player;

    socket.join(
        result.room.id
    );


    socket.emit(
        "reconnected",
        {
            ok: true,
            roomId:
                result.room.id,
            gameStarted:
                result.gameStarted
        }
    );


    emitProfile(
        player
    );

    emitRoomState(
        result.room
    );

}


/*
=========================================================
LEAVE ROOM
=========================================================
*/

function handleLeaveRoom(
    socket
) {

    const player =
        socket.player;

    if (!player) {
        return;
    }


    if (!player.roomId) {

        socket.emit(
            "left_room",
            {
                ok: true
            }
        );

        return;

    }


    const room =
        rooms.getRoom(
            player.roomId
        );


    if (!room) {

        player.roomId =
            null;

        socket.emit(
            "left_room",
            {
                ok: true
            }
        );

        return;

    }


    const result =
        rooms.leaveRoom(
            player,
            "leave"
        );


    socket.leave(
        room.id
    );


    if (
        result.finished
    ) {

        settleRoom(
            room
        );

    }


    player.roomId =
        null;

    player.socketId =
        socket.id;


    socket.emit(
        "left_room",
        {
            ok: true
        }
    );


    emitRoomState(
        room
    );

    emitProfile(
        player
    );

    emitRoomList();

}


/*
=========================================================
ATTACK
=========================================================
*/

function handleAttack(
    socket,
    data
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    const room =
        rooms.getRoom(
            player.roomId
        );

    if (!room) {

        sendError(
            socket,
            "Вы не находитесь в комнате."
        );

        return;

    }


    const cardId =
        safeString(
            data &&
            (
                data.cardId ||
                data.id
            )
        );


    if (!cardId) {

        sendError(
            socket,
            "Не указана карта."
        );

        return;

    }


    const result =
        room.engine.attackCard(
            player.playerId,
            cardId
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    emitRoomState(
        room
    );

}


/*
=========================================================
DEFEND
=========================================================
*/

function handleDefend(
    socket,
    data
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    const room =
        rooms.getRoom(
            player.roomId
        );

    if (!room) {

        sendError(
            socket,
            "Вы не находитесь в комнате."
        );

        return;

    }


    const attackId =
        safeString(
            data &&
            (
                data.attackId ||
                data.attackCardId
            )
        );

    const defenseId =
        safeString(
            data &&
            (
                data.defenseId ||
                data.cardId
            )
        );


    const result =
        room.engine.defendCard(
            player.playerId,
            attackId,
            defenseId
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    emitRoomState(
        room
    );

}


/*
=========================================================
TAKE
=========================================================
*/

function handleTake(
    socket
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    const room =
        rooms.getRoom(
            player.roomId
        );

    if (!room) {

        sendError(
            socket,
            "Вы не находитесь в комнате."
        );

        return;

    }


    const result =
        room.engine.takeCards(
            player.playerId
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    if (result.gameOver) {

        settleRoom(
            room
        );

    }


    emitRoomState(
        room
    );

    emitProfile(
        player
    );

}


/*
=========================================================
BITO
=========================================================
*/

function handleBito(
    socket
) {

    const player =
        socket.player;

    if (!player) {

        sendError(
            socket,
            "Игрок не авторизован."
        );

        return;

    }


    const room =
        rooms.getRoom(
            player.roomId
        );

    if (!room) {

        sendError(
            socket,
            "Вы не находитесь в комнате."
        );

        return;

    }


    const result =
        room.engine.bito(
            player.playerId
        );


    if (!result.ok) {

        sendError(
            socket,
            result.error
        );

        return;

    }


    if (result.gameOver) {

        settleRoom(
            room
        );

    }


    emitRoomState(
        room
    );


    const winner =
        getPlayer(
            room.winnerId
        );

    const loser =
        getPlayer(
            room.loserId
        );


    emitProfile(
        winner
    );

    emitProfile(
        loser
    );

}


/*
=========================================================
ROOM STATE REQUEST
=========================================================
*/

function handleRoomState(
    socket
) {

    const player =
        socket.player;

    if (!player) {
        return;
    }


    const room =
        rooms.getRoom(
            player.roomId
        );


    if (!room) {

        socket.emit(
            "room_state",
            null
        );

        return;

    }


    socket.emit(
        "room_state",
        getRoomPublicState(
            room,
            player.playerId
        )
    );

}


/*
=========================================================
PROFILE REQUEST
=========================================================
*/

function handleProfile(
    socket
) {

    const player =
        socket.player;

    if (!player) {
        return;
    }

    emitProfile(
        player
    );

}


/*
=========================================================
ROOMS REQUEST
=========================================================
*/

function handleRooms(
    socket
) {

    socket.emit(
        "rooms",
        rooms.getPublicRoomList()
    );

}


/*
=========================================================
AUTH / IDENTIFICATION
=========================================================
*/

function identifySocket(
    socket,
    data = {}
) {

    const player =
        getOrCreatePlayer(
            {
                playerId:
                    data.playerId,
                telegramId:
                    data.telegramId,
                name:
                    data.name,
                username:
                    data.username
            }
        );


    /*
    -----------------------------------------------------
    OLD SOCKET
    -----------------------------------------------------
    */

    if (
        player.socketId &&
        player.socketId !== socket.id
    ) {

        const oldSocket =
            io.sockets.sockets.get(
                player.socketId
            );

        if (oldSocket) {

            oldSocket.emit(
                "session_replaced"
            );

        }

    }


    player.socketId =
        socket.id;

    player.connected =
        true;

    player.lastSeenAt =
        Date.now();


    socket.player =
        player;


    socket.emit(
        "authenticated",
        {
            ok: true,

            playerId:
                player.playerId,

            profile:
                getPublicProfile(
                    player
                )
        }
    );


    emitProfile(
        player
    );


    /*
    -----------------------------------------------------
    AUTO REJOIN
    -----------------------------------------------------
    */

    if (player.roomId) {

        const room =
            rooms.getRoom(
                player.roomId
            );


        if (room) {

            const result =
                rooms.reconnectPlayer(
                    {
                        player,
                        roomId:
                            room.id,
                        playerId:
                            player.playerId,
                        socketId:
                            socket.id,
                        name:
                            player.name
                    }
                );


            if (result.ok) {

                socket.join(
                    room.id
                );


                socket.emit(
                    "reconnected",
                    {
                        ok: true,

                        roomId:
                            room.id,

                        gameStarted:
                            room.status ===
                            "playing"
                    }
                );


                emitRoomState(
                    room
                );

            }

        }

    }

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
            `[SOCKET] connected ${socket.id}`
        );


        /*
        -------------------------------------------------
        AUTH
        -------------------------------------------------
        */

        socket.on(
            "auth",
            data => {

                try {

                    identifySocket(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[AUTH]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка авторизации."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        RECONNECT
        -------------------------------------------------
        */

        socket.on(
            "reconnect_player",
            data => {

                try {

                    handleReconnect(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[RECONNECT]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка восстановления соединения."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        ROOMS
        -------------------------------------------------
        */

        socket.on(
            "get_rooms",
            () => {

                handleRooms(
                    socket
                );

            }
        );


        socket.on(
            "rooms",
            () => {

                handleRooms(
                    socket
                );

            }
        );


        /*
        -------------------------------------------------
        CREATE ROOM
        -------------------------------------------------
        */

        socket.on(
            "create_room",
            data => {

                try {

                    handleCreateRoom(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[CREATE ROOM]",
                        error
                    );

                    sendError(
                        socket,
                        "Не удалось создать комнату."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        JOIN ROOM
        -------------------------------------------------
        */

        socket.on(
            "join_room",
            data => {

                try {

                    handleJoinRoom(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[JOIN ROOM]",
                        error
                    );

                    sendError(
                        socket,
                        "Не удалось войти в комнату."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        LEAVE
        -------------------------------------------------
        */

        socket.on(
            "leave_room",
            () => {

                try {

                    handleLeaveRoom(
                        socket
                    );

                } catch (error) {

                    console.error(
                        "[LEAVE ROOM]",
                        error
                    );

                    sendError(
                        socket,
                        "Не удалось выйти из комнаты."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        GAME STATE
        -------------------------------------------------
        */

        socket.on(
            "get_room_state",
            () => {

                handleRoomState(
                    socket
                );

            }
        );


        socket.on(
            "room_state",
            () => {

                handleRoomState(
                    socket
                );

            }
        );


        /*
        -------------------------------------------------
        PROFILE
        -------------------------------------------------
        */

        socket.on(
            "get_profile",
            () => {

                handleProfile(
                    socket
                );

            }
        );


        /*
        -------------------------------------------------
        ATTACK
        -------------------------------------------------
        */

        socket.on(
            "attack",
            data => {

                try {

                    handleAttack(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[ATTACK]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка атаки."
                    );

                }

            }
        );


        socket.on(
            "attack_card",
            data => {

                try {

                    handleAttack(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[ATTACK CARD]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка атаки."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        DEFENSE
        -------------------------------------------------
        */

        socket.on(
            "defend",
            data => {

                try {

                    handleDefend(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[DEFEND]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка защиты."
                    );

                }

            }
        );


        socket.on(
            "defend_card",
            data => {

                try {

                    handleDefend(
                        socket,
                        data || {}
                    );

                } catch (error) {

                    console.error(
                        "[DEFEND CARD]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка защиты."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        TAKE
        -------------------------------------------------
        */

        socket.on(
            "take",
            () => {

                try {

                    handleTake(
                        socket
                    );

                } catch (error) {

                    console.error(
                        "[TAKE]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка взятия карт."
                    );

                }

            }
        );


        socket.on(
            "take_cards",
            () => {

                try {

                    handleTake(
                        socket
                    );

                } catch (error) {

                    console.error(
                        "[TAKE CARDS]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка взятия карт."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        BITO
        -------------------------------------------------
        */

        socket.on(
            "bito",
            () => {

                try {

                    handleBito(
                        socket
                    );

                } catch (error) {

                    console.error(
                        "[BITO]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка БИТО."
                    );

                }

            }
        );


        socket.on(
            "beat",
            () => {

                try {

                    handleBito(
                        socket
                    );

                } catch (error) {

                    console.error(
                        "[BEAT]",
                        error
                    );

                    sendError(
                        socket,
                        "Ошибка БИТО."
                    );

                }

            }
        );


        /*
        -------------------------------------------------
        DISCONNECT
        -------------------------------------------------
        */

        socket.on(
            "disconnect",
            reason => {

                try {

                    const player =
                        socket.player;


                    if (!player) {

                        console.log(
                            `[SOCKET] disconnected ${socket.id} (${reason})`
                        );

                        return;

                    }


                    player.connected =
                        false;

                    player.lastSeenAt =
                        Date.now();


                    const room =
                        rooms.getRoom(
                            player.roomId
                        );


                    if (!room) {

                        player.socketId =
                            null;

                        return;

                    }


                    /*
                    -------------------------------------------------
                    WAITING
                    -------------------------------------------------
                    */

                    if (
                        room.status ===
                        "waiting"
                    ) {

                        rooms.disconnectPlayer(
                            player
                        );

                        player.socketId =
                            null;

                        emitRoomState(
                            room
                        );

                        emitRoomList();

                        return;

                    }


                    /*
                    -------------------------------------------------
                    ACTIVE GAME
                    -------------------------------------------------
                    */

                    if (
                        room.status ===
                        "playing"
                    ) {

                        /*
                        Не удаляем игрока мгновенно.
                        Даём ему шанс переподключиться.
                        */

                        player.socketId =
                            null;

                        room.disconnectTimer =
                            setTimeout(
                                () => {

                                    if (
                                        room.status !==
                                        "playing"
                                    ) {

                                        return;

                                    }


                                    const current =
                                        getPlayer(
                                            player.playerId
                                        );


                                    if (
                                        current &&
                                        !current.connected
                                    ) {

                                        const result =
                                            rooms.forfeitPlayer(
                                                room,
                                                player.playerId,
                                                "disconnect"
                                            );


                                        if (
                                            result.ok
                                        ) {

                                            settleRoom(
                                                room
                                            );

                                            emitRoomState(
                                                room
                                            );

                                            emitProfile(
                                                getPlayer(
                                                    room.winnerId
                                                )
                                            );

                                            emitProfile(
                                                getPlayer(
                                                    room.loserId
                                                )
                                            );

                                        }

                                    }

                                },
                                config.DISCONNECT_GRACE_MS
                            );

                    }


                    console.log(
                        `[SOCKET] disconnected ${socket.id} (${reason})`
                    );

                } catch (error) {

                    console.error(
                        "[DISCONNECT]",
                        error
                    );

                }

            }
        );

    }
);


/*
=========================================================
HTTP ROUTES
=========================================================
*/

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                publicPath,
                "index.html"
            ),
            error => {

                if (error) {

                    res.json(
                        {
                            ok: true,
                            service:
                                "Heavy Lux Card",
                            socket:
                                "ready"
                        }
                    );

                }

            }
        );

    }
);


app.get(
    "/health",
    (
        req,
        res
    ) => {

        res.json(
            {

                ok: true,

                service:
                    "Heavy Lux Card",

                server:
                    "online",

                socket:
                    "ready",

                rooms:
                    rooms.roomCount(),

                players:
                    players.size,

                time:
                    Date.now()

            }
        );

    }
);


app.get(
    "/api/config",
    (
        req,
        res
    ) => {

        res.json(
            {

                ok: true,

                game: {

                    deckSize:
                        config.DECK_SIZE,

                    maxPlayers:
                        config.MAX_PLAYERS,

                    startingHand:
                        config.STARTING_HAND_SIZE,

                    maxAttack:
                        config.MAX_ATTACK_CARDS

                },

                stakes:
                    STAKES

            }
        );

    }
);


app.get(
    "/api/rooms",
    (
        req,
        res
    ) => {

        res.json(
            {

                ok: true,

                rooms:
                    rooms.getPublicRoomList()

            }
        );

    }
);


/*
=========================================================
ERROR HANDLER
=========================================================
*/

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "[HTTP ERROR]",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res.status(
            500
        ).json(
            {
                ok: false,
                error:
                    "Internal server error"
            }
        );

    }
);


/*
=========================================================
START
=========================================================
*/

httpServer.listen(
    PORT,
    HOST,
    () => {

        console.log(
            `Server started on port ${PORT}`
        );

        console.log(
            "Socket.IO: ready"
        );

        console.log(
            "Durak 36 cards: ready"
        );

        console.log(
            `Max players per room: ${config.MAX_PLAYERS}`
        );

        console.log(
            `Starting hand: ${config.STARTING_HAND_SIZE}`
        );

        console.log(
            `Max attack cards: ${config.MAX_ATTACK_CARDS}`
        );

        console.log(
            `Real players only: ${config.MAX_PLAYERS === 2}`
        );

    }
);


/*
=========================================================
PROCESS SAFETY
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

    players,

    rooms

};
