"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOMS / LOBBY MANAGER
=========================================================

Отвечает за:

- создание комнат
- публичное лобби
- подключение игроков
- выход игроков
- готовность
- старт игры
- поиск комнаты игрока
- переподключение
- состояние комнат
- очистку пустых комнат

Игровая логика находится в:

./game.js

=========================================================
*/

const crypto = require("crypto");

const {
    createGameState
} = require("./game");


/*
=========================================================
CONSTANTS
=========================================================
*/

const ROOM_STATUS = Object.freeze({

    LOBBY:
        "lobby",

    PLAYING:
        "playing",

    FINISHED:
        "finished"

});


const MIN_PLAYERS = 2;

const MAX_PLAYERS = 3;


/*
=========================================================
ROOM STORAGE
=========================================================
*/

const roomsMap =
    new Map();


/*
=========================================================
ROOM ID
=========================================================
*/

function generateRoomId() {

    let roomId;

    do {

        roomId =
            crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase();

    } while (
        roomsMap.has(roomId)
    );

    return roomId;

}


/*
=========================================================
PLAYER ID
=========================================================
*/

function normalizePlayerId(
    playerId
) {

    if (
        typeof playerId !== "string"
    ) {
        return null;
    }

    const value =
        playerId.trim();

    if (
        value.length === 0
    ) {
        return null;
    }

    return value.slice(
        0,
        100
    );

}


/*
=========================================================
PLAYER DATA
=========================================================
*/

function createRoomPlayer({
    playerId,
    name,
    username,
    telegramId
}) {

    const now =
        Date.now();

    return {

        playerId,

        name:
            typeof name === "string"
                ? name.trim().slice(0, 100)
                : null,

        username:
            typeof username === "string"
                ? username.trim().slice(0, 100)
                : null,

        telegramId:
            typeof telegramId === "string"
                ? telegramId.trim().slice(0, 100)
                : null,

        connected:
            true,

        ready:
            false,

        joinedAt:
            now,

        lastSeenAt:
            now

    };

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

function createRoom({
    playerId,
    name,
    username,
    telegramId
}) {

    playerId =
        normalizePlayerId(
            playerId
        );

    if (!playerId) {

        throw new Error(
            "playerId is required"
        );

    }

    if (
        hasPlayer(
            playerId
        )
    ) {

        throw new Error(
            "Player is already in a room"
        );

    }


    const roomId =
        generateRoomId();


    const player =
        createRoomPlayer({

            playerId,

            name,

            username,

            telegramId

        });


    const room = {

        roomId,

        status:
            ROOM_STATUS.LOBBY,

        hostPlayerId:
            playerId,

        players: [
            player
        ],

        game:
            null,

        createdAt:
            Date.now(),

        startedAt:
            null,

        finishedAt:
            null

    };


    roomsMap.set(
        roomId,
        room
    );


    console.log(
        `[ROOMS] Room created: ${roomId}`
    );


    return room;

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(
    roomId
) {

    if (
        typeof roomId !== "string"
    ) {
        return null;
    }

    return roomsMap.get(
        roomId.trim()
    ) || null;

}


/*
=========================================================
GET ROOM COUNT
=========================================================
*/

function getRoomCount() {

    return roomsMap.size;

}


/*
=========================================================
GET ONLINE PLAYER COUNT
=========================================================
*/

function getOnlinePlayerCount() {

    let count = 0;

    for (
        const room of roomsMap.values()
    ) {

        for (
            const player of room.players
        ) {

            if (
                player.connected
            ) {

                count++;

            }

        }

    }

    return count;

}


/*
=========================================================
GET PLAYER ROOM
=========================================================
*/

function getPlayerRoom(
    playerId
) {

    playerId =
        normalizePlayerId(
            playerId
        );

    if (!playerId) {
        return null;
    }

    for (
        const room of roomsMap.values()
    ) {

        const player =
            room.players.find(
                p =>
                    p.playerId ===
                    playerId
            );

        if (player) {
            return room;
        }

    }

    return null;

}


/*
=========================================================
HAS PLAYER
=========================================================
*/

function hasPlayer(
    playerId
) {

    return Boolean(
        getPlayerRoom(
            playerId
        )
    );

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function joinRoom(
    roomId,
    {
        playerId,
        name,
        username,
        telegramId
    }
) {

    playerId =
        normalizePlayerId(
            playerId
        );

    if (!playerId) {

        throw new Error(
            "playerId is required"
        );

    }


    const room =
        getRoom(
            roomId
        );


    if (!room) {

        throw new Error(
            "Room not found"
        );

    }


    if (
        room.status !==
        ROOM_STATUS.LOBBY
    ) {

        throw new Error(
            "Room is not available"
        );

    }


    /*
    Игрок уже находится
    в этой комнате.

    Используем как reconnect.
    */

    const existingPlayer =
        room.players.find(
            player =>
                player.playerId ===
                playerId
        );


    if (
        existingPlayer
    ) {

        existingPlayer.connected =
            true;

        existingPlayer.lastSeenAt =
            Date.now();

        if (
            typeof name === "string" &&
            name.trim()
        ) {

            existingPlayer.name =
                name.trim().slice(0, 100);

        }

        if (
            typeof username === "string"
        ) {

            existingPlayer.username =
                username.trim().slice(0, 100);

        }

        if (
            typeof telegramId === "string"
        ) {

            existingPlayer.telegramId =
                telegramId.trim().slice(0, 100);

        }

        return room;

    }


    /*
    Нельзя войти в другую
    комнату, если игрок
    уже где-то находится.
    */

    const currentRoom =
        getPlayerRoom(
            playerId
        );

    if (currentRoom) {

        throw new Error(
            "Player is already in a room"
        );

    }


    if (
        room.players.length >=
        MAX_PLAYERS
    ) {

        throw new Error(
            "Room is full"
        );

    }


    const player =
        createRoomPlayer({

            playerId,

            name,

            username,

            telegramId

        });


    room.players.push(
        player
    );


    console.log(
        `[ROOMS] Player ${playerId} joined room ${room.roomId}`
    );


    return room;

}


/*
=========================================================
LEAVE ROOM
=========================================================
*/

function leaveRoom(
    playerId
) {

    playerId =
        normalizePlayerId(
            playerId
        );

    if (!playerId) {

        throw new Error(
            "playerId is required"
        );

    }


    const room =
        getPlayerRoom(
            playerId
        );


    if (!room) {
        return null;
    }


    if (
        room.status ===
        ROOM_STATUS.PLAYING
    ) {

        throw new Error(
            "Cannot leave an active game"
        );

    }


    const index =
        room.players.findIndex(
            player =>
                player.playerId ===
                playerId
        );


    if (
        index === -1
    ) {
        return room;
    }


    room.players.splice(
        index,
        1
    );


    /*
    Если вышел хост —
    назначаем нового.
    */

    if (
        room.hostPlayerId ===
        playerId
    ) {

        room.hostPlayerId =
            room.players.length > 0
                ? room.players[0].playerId
                : null;

    }


    if (
        room.players.length === 0
    ) {

        roomsMap.delete(
            room.roomId
        );

        console.log(
            `[ROOMS] Empty room deleted: ${room.roomId}`
        );

        return null;

    }


    console.log(
        `[ROOMS] Player ${playerId} left room ${room.roomId}`
    );


    return room;

}


/*
=========================================================
SET READY
=========================================================
*/

function setReady(
    roomId,
    playerId,
    ready
) {

    const room =
        getRoom(
            roomId
        );

    if (!room) {

        throw new Error(
            "Room not found"
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

    const player =
        room.players.find(
            p =>
                p.playerId ===
                playerId
        );

    if (!player) {

        throw new Error(
            "Player is not in this room"
        );

    }

    player.ready =
        Boolean(
            ready
        );

    player.lastSeenAt =
        Date.now();

    return room;

}


/*
=========================================================
TOGGLE READY
=========================================================
*/

function toggleReady(
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );

    if (!room) {

        throw new Error(
            "Room not found"
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

    const player =
        room.players.find(
            p =>
                p.playerId ===
                playerId
        );

    if (!player) {

        throw new Error(
            "Player is not in this room"
        );

    }

    player.ready =
        !player.ready;

    player.lastSeenAt =
        Date.now();

    return room;

}


/*
=========================================================
CAN START ROOM
=========================================================
*/

function canStartRoom(
    room
) {

    if (!room) {
        return false;
    }

    if (
        room.status !==
        ROOM_STATUS.LOBBY
    ) {
        return false;
    }

    if (
        room.players.length <
        MIN_PLAYERS
    ) {
        return false;
    }

    if (
        room.players.length >
        MAX_PLAYERS
    ) {
        return false;
    }


    for (
        const player of room.players
    ) {

        if (!player.connected) {
            return false;
        }

        if (!player.ready) {
            return false;
        }

    }


    return true;

}


/*
=========================================================
START ROOM
=========================================================
*/

function startRoom(
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );

    if (!room) {

        throw new Error(
            "Room not found"
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

    if (
        room.hostPlayerId !==
        playerId
    ) {

        throw new Error(
            "Only host can start the game"
        );

    }

    if (
        !canStartRoom(
            room
        )
    ) {

        throw new Error(
            "Room is not ready to start"
        );

    }


    const gamePlayers =
        room.players.map(
            player => ({

                playerId:
                    player.playerId,

                name:
                    player.name,

                username:
                    player.username,

                telegramId:
                    player.telegramId

            })
        );


    let game;

    try {

        game =
            createGameState({
                players:
                    gamePlayers
            });

    } catch (error) {

        console.error(
            "[ROOMS] Game creation error:",
            error
        );

        throw new Error(
            `Cannot create game: ${error.message}`
        );

    }


    if (!game) {

        throw new Error(
            "Game engine returned empty state"
        );

    }


    room.game =
        game;

    room.status =
        ROOM_STATUS.PLAYING;

    room.startedAt =
        Date.now();

    room.finishedAt =
        null;


    console.log(
        `[ROOMS] Game started in room ${room.roomId}`
    );


    return room;

}


/*
=========================================================
UPDATE ROOM STATUS
=========================================================
*/

function updateRoomStatus(
    room
) {

    if (!room) {
        return null;
    }


    if (
        room.game &&
        room.game.status === "finished"
    ) {

        if (
            room.status !==
            ROOM_STATUS.FINISHED
        ) {

            room.status =
                ROOM_STATUS.FINISHED;

            room.finishedAt =
                Date.now();

        }

    }


    return room;

}


/*
=========================================================
DISCONNECT PLAYER
=========================================================
*/

function disconnectPlayer(
    playerId
) {

    const room =
        getPlayerRoom(
            playerId
        );

    if (!room) {
        return null;
    }


    const player =
        room.players.find(
            p =>
                p.playerId ===
                playerId
        );

    if (!player) {
        return room;
    }


    player.connected =
        false;

    player.lastSeenAt =
        Date.now();


    /*
    В лобби disconnected игрок
    больше не считается ready.

    В активной игре ready уже
    не имеет значения.
    */

    if (
        room.status ===
        ROOM_STATUS.LOBBY
    ) {

        player.ready =
            false;

    }


    return room;

}


/*
=========================================================
RECONNECT PLAYER
=========================================================
*/

function reconnectPlayer(
    playerId
) {

    const room =
        getPlayerRoom(
            playerId
        );

    if (!room) {
        return null;
    }


    const player =
        room.players.find(
            p =>
                p.playerId ===
                playerId
        );

    if (!player) {
        return null;
    }


    player.connected =
        true;

    player.lastSeenAt =
        Date.now();


    return room;

}


/*
=========================================================
PUBLIC ROOM VIEW
=========================================================
*/

function getPublicRoom(
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
            MIN_PLAYERS,

        maxPlayers:
            MAX_PLAYERS,

        players:
            room.players.map(
                player => ({

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

                })
            ),

        canStart:
            canStartRoom(
                room
            )

    };

}


/*
=========================================================
GET PUBLIC ROOMS
=========================================================
*/

function getPublicRooms() {

    const result = [];


    for (
        const room of roomsMap.values()
    ) {

        if (
            room.status !==
            ROOM_STATUS.LOBBY
        ) {
            continue;
        }

        if (
            room.players.length >=
            MAX_PLAYERS
        ) {
            continue;
        }

        result.push(
            getPublicRoom(
                room
            )
        );

    }


    return result;

}


/*
=========================================================
CLEANUP EMPTY ROOMS
=========================================================
*/

function cleanupEmptyRooms() {

    const deleted = [];


    for (
        const [
            roomId,
            room
        ] of roomsMap.entries()
    ) {

        if (
            room.players.length === 0
        ) {

            roomsMap.delete(
                roomId
            );

            deleted.push(
                roomId
            );

        }

    }


    return deleted;

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    rooms: {

        createRoom,

        getRoom,

        getRoomCount,

        getOnlinePlayerCount,

        getPlayerRoom,

        hasPlayer,

        joinRoom,

        leaveRoom,

        setReady,

        toggleReady,

        canStartRoom,

        startRoom,

        updateRoomStatus,

        disconnectPlayer,

        reconnectPlayer,

        getPublicRooms,

        cleanupEmptyRooms

    },

    ROOM_STATUS

};
