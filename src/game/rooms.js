"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOMS / LOBBY MANAGER
=========================================================

Отвечает за:

- создание комнат;
- список комнат;
- вход игроков;
- выход игроков;
- переподключение;
- ограничение количества игроков;
- запуск game.js;
- хранение авторитетного состояния игры;
- удаление пустых комнат.

Этот модуль НЕ знает ничего о:

- Socket.IO;
- Telegram;
- HTTP;
- балансах;
- XP;
- рейтинге;
- интерфейсе.

Socket.IO только вызывает функции этого модуля.
=========================================================
*/

const crypto = require("crypto");

const {
    MIN_PLAYERS,
    MAX_PLAYERS
} = require("./config");

const {
    createGame,
    startGame,
    getGameState,
    getPlayer,
    getActivePlayers,
    GAME_STATUS
} = require("./game");


/*
=========================================================
ROOM STATUS
=========================================================
*/

const ROOM_STATUS = Object.freeze({

    WAITING: "WAITING",

    PLAYING: "PLAYING",

    FINISHED: "FINISHED"

});


/*
=========================================================
ROOMS STORAGE
=========================================================
*/

const rooms = new Map();


/*
=========================================================
CONSTANTS
=========================================================
*/

const ROOM_ID_LENGTH = 6;


/*
=========================================================
GENERATE ROOM ID
=========================================================
*/

function generateRoomId() {

    let roomId;

    do {

        roomId =
            crypto
                .randomBytes(4)
                .toString("hex")
                .slice(0, ROOM_ID_LENGTH)
                .toUpperCase();

    } while (
        rooms.has(roomId)
    );

    return roomId;

}


/*
=========================================================
VALIDATE PLAYER ID
=========================================================
*/

function validatePlayerId(playerId) {

    if (
        typeof playerId !== "string" ||
        playerId.length === 0
    ) {
        throw new Error(
            "Invalid playerId"
        );
    }

}


/*
=========================================================
CREATE ROOM
=========================================================

Создаёт новую пустую комнату.

Игрок автоматически становится
первым игроком комнаты.
=========================================================
*/

function createRoom(playerId) {

    validatePlayerId(playerId);

    /*
    Один игрок не может одновременно
    находиться в нескольких комнатах.
    */

    const existing =
        findRoomByPlayerId(playerId);

    if (existing) {

        throw new Error(
            "Player is already in a room"
        );

    }

    const roomId =
        generateRoomId();

    const game =
        createGame({

            gameId:
                roomId,

            playerIds:
                [playerId]

        });

    /*
    ВАЖНО:

    createGame() требует минимум
    MIN_PLAYERS игроков.

    Поэтому для комнаты ожидания
    создаём game только после того,
    как набралось необходимое
    количество игроков.

    Здесь game пока не используется
    как запущенная партия.
    */

    const room = {

        roomId,

        status:
            ROOM_STATUS.WAITING,

        players: [

            {

                playerId,

                connected: true,

                joinedAt:
                    Date.now(),

                socketId:
                    null

            }

        ],

        game: null,

        createdAt:
            Date.now(),

        startedAt:
            null,

        finishedAt:
            null

    };

    /*
    Убираем созданную временную игру.

    Она была создана только потому,
    что game.js является авторитетным
    объектом партии и требует
    playerIds.

    Реальная game создаётся,
    когда комната заполнена.
    */

    room.game = null;

    rooms.set(
        roomId,
        room
    );

    return room;

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function joinRoom(
    roomId,
    playerId
) {

    validatePlayerId(playerId);

    if (
        typeof roomId !== "string" ||
        roomId.length === 0
    ) {
        throw new Error(
            "Invalid roomId"
        );
    }

    const normalizedRoomId =
        roomId.trim().toUpperCase();

    const room =
        rooms.get(
            normalizedRoomId
        );

    if (!room) {

        throw new Error(
            "Room not found"
        );

    }

    /*
    Игрок уже находится
    в этой комнате.

    Это не ошибка.

    Возвращаем существующую
    запись.
    */

    const existingPlayer =
        room.players.find(
            player =>
                player.playerId ===
                playerId
        );

    if (existingPlayer) {

        existingPlayer.connected =
            true;

        return room;

    }

    /*
    Нельзя войти в завершённую
    или играющую комнату новым
    игроком.
    */

    if (
        room.status !==
        ROOM_STATUS.WAITING
    ) {

        throw new Error(
            "Room is not accepting new players"
        );

    }

    /*
    Один игрок —
    одна комната.
    */

    const currentRoom =
        findRoomByPlayerId(playerId);

    if (currentRoom) {

        throw new Error(
            "Player is already in another room"
        );

    }

    /*
    Проверяем максимальное
    количество игроков.
    */

    if (
        room.players.length >=
        MAX_PLAYERS
    ) {

        throw new Error(
            "Room is full"
        );

    }

    room.players.push({

        playerId,

        connected: true,

        joinedAt:
            Date.now(),

        socketId:
            null

    });

    /*
    Если игроков достаточно —
    запускаем игру.
    */

    if (
        room.players.length >=
        MIN_PLAYERS
    ) {

        startRoomGame(room);

    }

    return room;

}


/*
=========================================================
START ROOM GAME
=========================================================
*/

function startRoomGame(room) {

    if (!room) {

        throw new Error(
            "Room is required"
        );

    }

    if (
        room.status !==
        ROOM_STATUS.WAITING
    ) {

        throw new Error(
            "Room is not waiting"
        );

    }

    if (
        room.players.length <
        MIN_PLAYERS
    ) {

        throw new Error(
            "Not enough players"
        );

    }

    if (
        room.players.length >
        MAX_PLAYERS
    ) {

        throw new Error(
            "Too many players"
        );

    }

    /*
    Получаем ID игроков
    в фиксированном порядке.
    */

    const playerIds =
        room.players.map(
            player =>
                player.playerId
        );

    /*
    Создаём авторитетную игру.
    */

    const game =
        createGame({

            gameId:
                room.roomId,

            playerIds

        });

    /*
    Запускаем раздачу,
    определение козыря,
    первого атакующего
    и остальные механики game.js.
    */

    startGame(game);

    room.game =
        game;

    room.status =
        ROOM_STATUS.PLAYING;

    room.startedAt =
        Date.now();

    return room;

}


/*
=========================================================
LEAVE ROOM
=========================================================

Игрок покидает комнату ожидания.

Если игра уже началась,
игрок НЕ удаляется из game.players.

Вместо этого он помечается
как disconnected.

Это важно для будущего
переподключения.
=========================================================
*/

function leaveRoom(
    roomId,
    playerId
) {

    validatePlayerId(playerId);

    const room =
        getRoom(roomId);

    if (!room) {
        return null;
    }

    const playerIndex =
        room.players.findIndex(
            player =>
                player.playerId ===
                playerId
        );

    if (
        playerIndex === -1
    ) {

        return room;

    }

    /*
    Если игра уже идёт,
    сохраняем игрока.
    */

    if (
        room.status ===
        ROOM_STATUS.PLAYING
    ) {

        room.players[
            playerIndex
        ].connected = false;

        room.players[
            playerIndex
        ].socketId = null;

        /*
        Синхронизируем состояние
        game.js.
        */

        if (room.game) {

            const gamePlayer =
                getPlayer(
                    room.game,
                    playerId
                );

            if (gamePlayer) {

                gamePlayer.connected =
                    false;

            }

        }

        return room;

    }

    /*
    В лобби игрок действительно
    удаляется из комнаты.
    */

    room.players.splice(
        playerIndex,
        1
    );

    /*
    Если комната стала пустой —
    удаляем её.
    */

    if (
        room.players.length === 0
    ) {

        rooms.delete(
            room.roomId
        );

        return null;

    }

    return room;

}


/*
=========================================================
DISCONNECT PLAYER
=========================================================

Используется Socket.IO при
физическом отключении соединения.

Игрок остаётся в комнате,
но становится disconnected.
=========================================================
*/

function disconnectPlayer(
    playerId
) {

    validatePlayerId(playerId);

    const room =
        findRoomByPlayerId(playerId);

    if (!room) {
        return null;
    }

    const roomPlayer =
        room.players.find(
            player =>
                player.playerId ===
                playerId
        );

    if (roomPlayer) {

        roomPlayer.connected =
            false;

        roomPlayer.socketId =
            null;

    }

    /*
    Если игра идёт —
    обновляем game.js.
    */

    if (room.game) {

        const gamePlayer =
            getPlayer(
                room.game,
                playerId
            );

        if (gamePlayer) {

            gamePlayer.connected =
                false;

        }

    }

    /*
    Если это лобби и игрок
    отключился — пока оставляем
    его в комнате.

    Это позволяет обработать
    reconnect.
    */

    return room;

}


/*
=========================================================
RECONNECT PLAYER
=========================================================
*/

function reconnectPlayer(
    roomId,
    playerId
) {

    validatePlayerId(playerId);

    const room =
        getRoom(roomId);

    if (!room) {

        throw new Error(
            "Room not found"
        );

    }

    const roomPlayer =
        room.players.find(
            player =>
                player.playerId ===
                playerId
        );

    if (!roomPlayer) {

        throw new Error(
            "Player is not a member of this room"
        );

    }

    roomPlayer.connected =
        true;

    /*
    Синхронизируем game.js.
    */

    if (room.game) {

        const gamePlayer =
            getPlayer(
                room.game,
                playerId
        );

        if (gamePlayer) {

            gamePlayer.connected =
                true;

        }

    }

    return room;

}


/*
=========================================================
SET SOCKET ID
=========================================================
*/

function setPlayerSocket(
    playerId,
    socketId
) {

    validatePlayerId(playerId);

    if (
        typeof socketId !== "string" ||
        socketId.length === 0
    ) {

        throw new Error(
            "Invalid socketId"
        );

    }

    const room =
        findRoomByPlayerId(playerId);

    if (!room) {
        return null;
    }

    const player =
        room.players.find(
            item =>
                item.playerId ===
                playerId
        );

    if (player) {

        player.socketId =
            socketId;

        player.connected =
            true;

    }

    return room;

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(roomId) {

    if (
        typeof roomId !== "string" ||
        roomId.length === 0
    ) {

        return null;

    }

    return (
        rooms.get(
            roomId.trim().toUpperCase()
        ) || null
    );

}


/*
=========================================================
GET ROOM BY PLAYER
=========================================================
*/

function findRoomByPlayerId(
    playerId
) {

    if (
        typeof playerId !== "string" ||
        playerId.length === 0
    ) {

        return null;

    }

    for (const room of rooms.values()) {

        if (
            room.players.some(
                player =>
                    player.playerId ===
                    playerId
            )
        ) {

            return room;

        }

    }

    return null;

}


/*
=========================================================
GET ALL ROOMS
=========================================================
*/

function getRooms() {

    return Array.from(
        rooms.values()
    );

}


/*
=========================================================
GET LOBBY
=========================================================

Возвращает только комнаты,
к которым можно присоединиться.

Внутренний game object
не раскрывается.
=========================================================
*/

function getLobby() {

    return getRooms()
        .filter(
            room =>
                room.status ===
                ROOM_STATUS.WAITING
        )
        .map(
            room =>
                ({
                    roomId:
                        room.roomId,

                    status:
                        room.status,

                    players:
                        room.players.length,

                    minPlayers:
                        MIN_PLAYERS,

                    maxPlayers:
                        MAX_PLAYERS,

                    createdAt:
                        room.createdAt
                })
        );

}


/*
=========================================================
GET ROOM STATE
=========================================================
*/

function getRoomState(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return null;
    }

    const state = {

        roomId:
            room.roomId,

        status:
            room.status,

        players:
            room.players.map(
                player =>
                    ({

                        playerId:
                            player.playerId,

                        connected:
                            player.connected,

                        joinedAt:
                            player.joinedAt

                    })
            ),

        createdAt:
            room.createdAt,

        startedAt:
            room.startedAt,

        finishedAt:
            room.finishedAt

    };

    /*
    Если игра уже существует,
    добавляем безопасное состояние.
    */

    if (room.game) {

        state.game =
            getGameState(
                room.game
            );

    } else {

        state.game = null;

    }

    return state;

}


/*
=========================================================
GET PLAYER GAME
=========================================================
*/

function getPlayerGame(
    roomId,
    playerId
) {

    const room =
        getRoom(roomId);

    if (!room) {
        return null;
    }

    if (!room.game) {
        return null;
    }

    const player =
        getPlayer(
            room.game,
            playerId
        );

    if (!player) {
        return null;
    }

    return room.game;

}


/*
=========================================================
GET GAME
=========================================================
*/

function getRoomGame(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return null;
    }

    return room.game || null;

}


/*
=========================================================
IS PLAYER IN ROOM
=========================================================
*/

function isPlayerInRoom(
    roomId,
    playerId
) {

    const room =
        getRoom(roomId);

    if (!room) {
        return false;
    }

    return room.players.some(
        player =>
            player.playerId ===
            playerId
    );

}


/*
=========================================================
IS ROOM FULL
=========================================================
*/

function isRoomFull(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return false;
    }

    return (
        room.players.length >=
        MAX_PLAYERS
    );

}


/*
=========================================================
IS ROOM READY
=========================================================
*/

function isRoomReady(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return false;
    }

    return (
        room.status ===
        ROOM_STATUS.WAITING &&
        room.players.length >=
        MIN_PLAYERS
    );

}


/*
=========================================================
UPDATE ROOM STATUS
=========================================================

Синхронизация статуса комнаты
с game.js.

Вызывается server.js после
игрового действия.
=========================================================
*/

function syncRoomStatus(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return null;
    }

    if (!room.game) {
        return room;
    }

    /*
    Если игра закончилась —
    комната становится FINISHED.
    */

    if (
        room.game.status ===
        GAME_STATUS.FINISHED
    ) {

        room.status =
            ROOM_STATUS.FINISHED;

        room.finishedAt =
            room.game.finishedAt ||
            Date.now();

    }

    return room;

}


/*
=========================================================
REMOVE ROOM
=========================================================
*/

function removeRoom(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {
        return false;
    }

    rooms.delete(
        room.roomId
    );

    return true;

}


/*
=========================================================
CLEAN EMPTY ROOMS
=========================================================
*/

function cleanupEmptyRooms() {

    const removed = [];

    for (const room of rooms.values()) {

        /*
        Удаляем только комнаты
        ожидания, в которых вообще
        нет игроков.
        */

        if (
            room.status ===
                ROOM_STATUS.WAITING &&
            room.players.length === 0
        ) {

            rooms.delete(
                room.roomId
            );

            removed.push(
                room.roomId
            );

        }

    }

    return removed;

}


/*
=========================================================
ROOM COUNT
=========================================================
*/

function getRoomCount() {

    return rooms.size;

}


/*
=========================================================
PLAYER COUNT
=========================================================
*/

function getPlayerCount() {

    let count = 0;

    for (const room of rooms.values()) {

        count +=
            room.players.length;

    }

    return count;

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    ROOM_STATUS,

    createRoom,

    joinRoom,

    startRoomGame,

    leaveRoom,

    disconnectPlayer,

    reconnectPlayer,

    setPlayerSocket,

    getRoom,

    findRoomByPlayerId,

    getRooms,

    getLobby,

    getRoomState,

    getPlayerGame,

    getRoomGame,

    isPlayerInRoom,

    isRoomFull,

    isRoomReady,

    syncRoomStatus,

    removeRoom,

    cleanupEmptyRooms,

    getRoomCount,

    getPlayerCount

};
