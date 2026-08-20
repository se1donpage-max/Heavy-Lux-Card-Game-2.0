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

server.js работает с этим модулем
через публичные методы ниже.

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

    return {

        playerId,

        name:
            typeof name === "string"
                ? name
                : null,

        username:
            typeof username === "string"
                ? username
                : null,

        telegramId:
            typeof telegramId === "string"
                ? telegramId
                : null,

        connected:
            true,

        ready:
            false,

        joinedAt:
            Date.now(),

        lastSeenAt:
            Date.now()

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

    /*
    Один игрок не может
    находиться сразу
    в нескольких комнатах.
    */

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


    /*
    Нельзя входить
    в завершённую игру.
    */

    if (
        room.status !==
        ROOM_STATUS.LOBBY
    ) {

        throw new Error(
            "Room is not available"
        );

    }


    /*
    Проверяем, не находится ли
    игрок уже в этой комнате.
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

        /*
        Это может быть
        переподключение.

        Восстанавливаем игрока.
        */

        existingPlayer.connected =
            true;

        existingPlayer.lastSeenAt =
            Date.now();

        if (
            typeof name === "string" &&
            name.trim()
        ) {

            existingPlayer.name =
                name.trim();

        }

        if (
            typeof username === "string"
        ) {

            existingPlayer.username =
                username;

        }

        if (
            typeof telegramId === "string"
        ) {

            existingPlayer.telegramId =
                telegramId;

        }

        return room;

    }


    /*
    Игрок не должен
    находиться в другой комнате.
    */

    if (
        hasPlayer(
            playerId
        )
    ) {

        throw new Error(
            "Player is already in a room"
        );

    }


    /*
    Проверяем лимит.
    */

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


    /*
    Во время игры server.js
    не позволяет использовать
    leaveRoom.

    Здесь дополнительная
    защита тоже остаётся.
    */

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
    назначаем нового хоста.
    */

    if (
        room.hostPlayerId ===
        playerId
    ) {

        if (
            room.players.length > 0
        ) {

            room.hostPlayerId =
                room.players[0].playerId;

        }

    }


    /*
    Если игроков не осталось —
    удаляем комнату.
    */

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


    /*
    Все игроки должны
    быть подключены.
    */

    for (
        const player of room.players
    ) {

        if (
            !player.connected
        ) {

            return false;

        }

    }


    /*
    Все игроки должны
    быть готовы.
    */

    for (
        const player of room.players
    ) {

        if (
            !player.ready
        ) {

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


    /*
    Только хост
    может запускать игру.
    */

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


    /*
    Создаём игровые данные
    из игроков комнаты.

    game.js остаётся
    авторитетным игровым движком.
    */

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
        room.game.status ===
        "finished"
    ) {

        room.status =
            ROOM_STATUS.FINISHED;

        room.finishedAt =
            Date.now();

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
    Игрок автоматически
    становится неготовым.

    Это особенно важно
    для лобби.

    */

    player.ready =
        false;


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

Никогда не отдаём game,
telegramId и другие внутренние
данные.

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

        /*
        В публичном лобби показываем
        только комнаты, в которые
        ещё можно войти.
        */

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

        /*
        Удаляем только полностью
        пустые комнаты.

        Отключённых игроков
        не удаляем — они могут
        переподключиться.
        */

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
