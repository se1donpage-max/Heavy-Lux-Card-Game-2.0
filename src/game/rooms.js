"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOMS / LOBBY MANAGER
=========================================================

Этот модуль отвечает только за:

- создание комнат;
- удаление комнат;
- поиск комнат;
- вход игроков;
- выход игроков;
- лобби;
- готовность игроков;
- запуск игры;
- переподключение игроков;
- связь комнаты с game.js.

Этот модуль НЕ знает ничего о:

- Socket.IO;
- Telegram;
- балансе;
- XP;
- рейтинге;
- интерфейсе.

Игровая механика находится в:

./game.js

=========================================================
*/

const crypto = require("crypto");

const {
    MIN_PLAYERS,
    MAX_PLAYERS
} = require("./rules");

const {
    createGame,
    startGame,
    GAME_STATUS
} = require("./game");


/*
=========================================================
ROOM STATUS
=========================================================
*/

const ROOM_STATUS = Object.freeze({

    LOBBY: "LOBBY",

    PLAYING: "PLAYING",

    FINISHED: "FINISHED"

});


/*
=========================================================
ROOM PLAYER
=========================================================
*/

function createRoomPlayer({
    playerId,
    name = null,
    username = null,
    telegramId = null
}) {

    if (
        typeof playerId !== "string" ||
        playerId.length === 0
    ) {
        throw new Error(
            "Invalid playerId"
        );
    }

    return {

        playerId,

        name,

        username,

        telegramId,

        /*
        Игрок подключён к комнате.
        */

        connected: true,

        /*
        Готов ли игрок к старту.

        Важно:

        Для создания игры все игроки
        должны быть ready.
        */

        ready: false,

        /*
        Время входа.
        */

        joinedAt:
            Date.now(),

        /*
        Время последнего подключения.
        */

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
    roomId = null,
    hostPlayer
}) {

    if (!hostPlayer) {
        throw new Error(
            "hostPlayer is required"
        );
    }

    const player =
        createRoomPlayer(
            hostPlayer
        );

    const id =
        roomId ||
        generateRoomId();

    return {

        roomId: id,

        /*
        Комната начинается
        в лобби.
        */

        status:
            ROOM_STATUS.LOBBY,

        /*
        Первый игрок —
        создатель комнаты.
        */

        hostPlayerId:
            player.playerId,

        /*
        Игроки комнаты.

        Максимум 3.
        */

        players: [
            player
        ],

        /*
        Игровой движок.

        Пока игра не запущена —
        null.
        */

        game: null,

        /*
        Служебные timestamps.
        */

        createdAt:
            Date.now(),

        startedAt:
            null,

        finishedAt:
            null

    };

}


/*
=========================================================
GENERATE ROOM ID
=========================================================
*/

function generateRoomId() {

    return crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

}


/*
=========================================================
ROOM MANAGER
=========================================================

Основной объект управления всеми
комнатами сервера.
=========================================================
*/

class RoomManager {

    constructor() {

        /*
        Map:

        roomId → room
        */

        this.rooms =
            new Map();

        /*
        playerId → roomId

        Позволяет быстро определить,
        в какой комнате находится игрок.
        */

        this.playerRooms =
            new Map();

    }


    /*
    =====================================================
    CREATE ROOM
    =====================================================
    */

    createRoom(playerData) {

        if (!playerData) {
            throw new Error(
                "Player data is required"
            );
        }

        const playerId =
            playerData.playerId;

        if (
            typeof playerId !== "string" ||
            playerId.length === 0
        ) {
            throw new Error(
                "Invalid playerId"
            );
        }

        /*
        Игрок не может находиться
        одновременно в двух комнатах.
        */

        if (
            this.playerRooms.has(playerId)
        ) {
            throw new Error(
                "Player is already in a room"
            );
        }

        let roomId;

        /*
        Практически исключаем
        повторение ID.
        */

        do {

            roomId =
                generateRoomId();

        } while (
            this.rooms.has(roomId)
        );

        const room =
            createRoom({

                roomId,

                hostPlayer:
                    playerData

            });

        this.rooms.set(
            roomId,
            room
        );

        this.playerRooms.set(
            playerId,
            roomId
        );

        return room;

    }


    /*
    =====================================================
    GET ROOM
    =====================================================
    */

    getRoom(roomId) {

        if (
            typeof roomId !== "string"
        ) {
            return null;
        }

        return (
            this.rooms.get(roomId) ||
            null
        );

    }


    /*
    =====================================================
    GET PLAYER ROOM
    =====================================================
    */

    getPlayerRoom(playerId) {

        if (
            typeof playerId !== "string"
        ) {
            return null;
        }

        const roomId =
            this.playerRooms.get(
                playerId
            );

        if (!roomId) {
            return null;
        }

        return this.getRoom(
            roomId
        );

    }


    /*
    =====================================================
    HAS PLAYER IN ROOM
    =====================================================
    */

    hasPlayer(playerId) {

        return this.playerRooms.has(
            playerId
        );

    }


    /*
    =====================================================
    GET PLAYER
    =====================================================
    */

    getPlayer(
        room,
        playerId
    ) {

        if (!room) {
            return null;
        }

        return (
            room.players.find(
                player =>
                    player.playerId ===
                    playerId
            ) ||
            null
        );

    }


    /*
    =====================================================
    JOIN ROOM
    =====================================================
    */

    joinRoom(
        roomId,
        playerData
    ) {

        const room =
            this.getRoom(
                roomId
            );

        if (!room) {
            throw new Error(
                "Room not found"
            );
        }

        /*
        В работающую игру
        через обычный join входить нельзя.

        Для этого существует
        reconnectPlayer().
        */

        if (
            room.status !==
            ROOM_STATUS.LOBBY
        ) {
            throw new Error(
                "Room is not in lobby"
            );
        }

        if (!playerData) {
            throw new Error(
                "Player data is required"
            );
        }

        const playerId =
            playerData.playerId;

        if (
            typeof playerId !== "string" ||
            playerId.length === 0
        ) {
            throw new Error(
                "Invalid playerId"
            );
        }

        /*
        Игрок уже где-то находится.
        */

        const existingRoom =
            this.getPlayerRoom(
                playerId
            );

        if (existingRoom) {

            /*
            Если это та же комната —
            просто возвращаем игрока.
            */

            if (
                existingRoom.roomId ===
                room.roomId
            ) {

                const existingPlayer =
                    this.getPlayer(
                        room,
                        playerId
                    );

                if (existingPlayer) {

                    existingPlayer.connected =
                        true;

                    existingPlayer.lastSeenAt =
                        Date.now();

                    return room;

                }

            }

            throw new Error(
                "Player is already in another room"
            );

        }

        /*
        Проверяем лимит игроков.
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
            createRoomPlayer(
                playerData
            );

        room.players.push(
            player
        );

        this.playerRooms.set(
            playerId,
            room.roomId
        );

        return room;

    }


    /*
    =====================================================
    RECONNECT PLAYER
    =====================================================

    Позволяет игроку вернуться
    в свою комнату.

    Важно:

    reconnect не создаёт нового игрока.
    =====================================================
    */

    reconnectPlayer(
        roomId,
        playerId
    ) {

        const room =
            this.getRoom(
                roomId
            );

        if (!room) {
            throw new Error(
                "Room not found"
            );
        }

        const player =
            this.getPlayer(
                room,
                playerId
            );

        if (!player) {
            throw new Error(
                "Player is not a member of this room"
            );
        }

        player.connected =
            true;

        player.lastSeenAt =
            Date.now();

        /*
        Восстанавливаем индекс.
        */

        this.playerRooms.set(
            playerId,
            room.roomId
        );

        return room;

    }


    /*
    =====================================================
    DISCONNECT PLAYER
    =====================================================

    Игрок не удаляется моментально.

    Это важно для переподключения.
    =====================================================
    */

    disconnectPlayer(
        playerId
    ) {

        const room =
            this.getPlayerRoom(
                playerId
            );

        if (!room) {
            return null;
        }

        const player =
            this.getPlayer(
                room,
                playerId
            );

        if (!player) {
            return null;
        }

        player.connected =
            false;

        player.lastSeenAt =
            Date.now();

        /*
        В лобби отключённый игрок
        остаётся участником комнаты.

        Это позволяет ему
        переподключиться.
        */

        return room;

    }


    /*
    =====================================================
    LEAVE ROOM
    =====================================================

    Полностью удаляет игрока
    из комнаты.

    Это отличается от disconnect.
    =====================================================
    */

    leaveRoom(
        playerId
    ) {

        const room =
            this.getPlayerRoom(
                playerId
            );

        if (!room) {
            return null;
        }

        const index =
            room.players.findIndex(
                player =>
                    player.playerId ===
                    playerId
            );

        if (index === -1) {

            this.playerRooms.delete(
                playerId
            );

            return room;

        }

        room.players.splice(
            index,
            1
        );

        this.playerRooms.delete(
            playerId
        );

        /*
        Если игроков не осталось —
        удаляем комнату.
        */

        if (
            room.players.length === 0
        ) {

            this.deleteRoom(
                room.roomId
            );

            return null;

        }

        /*
        Если вышел хост —
        передаём хостство следующему
        игроку.

        В приоритете подключённый
        игрок.
        */

        if (
            room.hostPlayerId ===
            playerId
        ) {

            const nextHost =
                room.players.find(
                    player =>
                        player.connected
                ) ||
                room.players[0];

            room.hostPlayerId =
                nextHost.playerId;

        }

        /*
        Если комната ещё в лобби,
        ничего больше делать не нужно.
        */

        return room;

    }


    /*
    =====================================================
    SET READY
    =====================================================
    */

    setReady(
        roomId,
        playerId,
        ready
    ) {

        const room =
            this.getRoom(
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
            this.getPlayer(
                room,
                playerId
            );

        if (!player) {
            throw new Error(
                "Player not found in room"
            );
        }

        if (!player.connected) {
            throw new Error(
                "Disconnected player cannot ready"
            );
        }

        player.ready =
            Boolean(ready);

        return room;

    }


    /*
    =====================================================
    TOGGLE READY
    =====================================================
    */

    toggleReady(
        roomId,
        playerId
    ) {

        const room =
            this.getRoom(
                roomId
            );

        if (!room) {
            throw new Error(
                "Room not found"
            );
        }

        const player =
            this.getPlayer(
                room,
                playerId
            );

        if (!player) {
            throw new Error(
                "Player not found in room"
            );
        }

        return this.setReady(
            roomId,
            playerId,
            !player.ready
        );

    }


    /*
    =====================================================
    ARE PLAYERS READY
    =====================================================

    Для старта нужны:

    минимум 2 игрока;
    максимум 3;
    все подключены;
    все готовы.
    =====================================================
    */

    arePlayersReady(room) {

        if (!room) {
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

        return room.players.every(
            player =>
                player.connected &&
                player.ready
        );

    }


    /*
    =====================================================
    CAN START ROOM
    =====================================================
    */

    canStartRoom(room) {

        if (!room) {
            return false;
        }

        if (
            room.status !==
            ROOM_STATUS.LOBBY
        ) {
            return false;
        }

        return this.arePlayersReady(
            room
        );

    }


    /*
    =====================================================
    START ROOM
    =====================================================
    */

    startRoom(
        roomId,
        playerId
    ) {

        const room =
            this.getRoom(
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
                "Room has already started"
            );
        }

        /*
        Только хост может
        запустить комнату.
        */

        if (
            room.hostPlayerId !==
            playerId
        ) {
            throw new Error(
                "Only room host can start the game"
            );
        }

        /*
        Проверяем игроков.
        */

        if (
            !this.canStartRoom(room)
        ) {
            throw new Error(
                "Not enough ready players"
            );
        }

        /*
        Передаём игроков
        в игровой движок.
        */

        const playerIds =
            room.players.map(
                player =>
                    player.playerId
            );

        const game =
            createGame({

                gameId:
                    room.roomId,

                playerIds

            });

        /*
        Запускаем игру.
        */

        startGame(
            game
        );

        room.game =
            game;

        room.status =
            ROOM_STATUS.PLAYING;

        room.startedAt =
            Date.now();

        /*
        После старта готовность
        больше не имеет значения.
        */

        for (
            const player of room.players
        ) {

            player.ready =
                false;

        }

        return room;

    }


    /*
    =====================================================
    FINISH ROOM
    =====================================================
    */

    updateRoomStatus(room) {

        if (!room) {
            return null;
        }

        if (
            room.game &&
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
    =====================================================
    GET LOBBY STATE
    =====================================================
    */

    getLobbyState(room) {

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
                            player.ready,

                        joinedAt:
                            player.joinedAt

                    })
                ),

            playerCount:
                room.players.length,

            minPlayers:
                MIN_PLAYERS,

            maxPlayers:
                MAX_PLAYERS,

            canStart:
                this.canStartRoom(
                    room
                )

        };

    }


    /*
    =====================================================
    GET ROOM STATE
    =====================================================

    Универсальное безопасное
    состояние комнаты.
    =====================================================
    */

    getRoomState(roomId) {

        const room =
            this.getRoom(
                roomId
            );

        if (!room) {
            return null;
        }

        this.updateRoomStatus(
            room
        );

        const state = {

            roomId:
                room.roomId,

            status:
                room.status,

            hostPlayerId:
                room.hostPlayerId,

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
                            player.ready,

                        joinedAt:
                            player.joinedAt

                    })
                ),

            playerCount:
                room.players.length,

            minPlayers:
                MIN_PLAYERS,

            maxPlayers:
                MAX_PLAYERS

        };

        /*
        Если игра уже запущена,
        добавляем безопасное состояние
        game engine.
        */

        if (
            room.game
        ) {

            const {
                getGameState
            } = require("./game");

            state.game =
                getGameState(
                    room.game
                );

        }

        return state;

    }


    /*
    =====================================================
    GET ALL ROOMS
    =====================================================
    */

    getAllRooms() {

        return Array.from(
            this.rooms.values()
        );

    }


    /*
    =====================================================
    GET LOBBY ROOMS
    =====================================================
    */

    getLobbyRooms() {

        return this.getAllRooms()
            .filter(
                room =>
                    room.status ===
                    ROOM_STATUS.LOBBY
            );

    }


    /*
    =====================================================
    GET PUBLIC ROOM LIST
    =====================================================

    Без внутренних данных.
    =====================================================
    */

    getPublicRooms() {

        return this.getLobbyRooms()
            .map(
                room => ({

                    roomId:
                        room.roomId,

                    playerCount:
                        room.players.length,

                    maxPlayers:
                        MAX_PLAYERS,

                    hostPlayerId:
                        room.hostPlayerId,

                    status:
                        room.status,

                    canJoin:
                        room.players.length <
                        MAX_PLAYERS

                })
            );

    }


    /*
    =====================================================
    DELETE ROOM
    =====================================================
    */

    deleteRoom(roomId) {

        const room =
            this.getRoom(
                roomId
            );

        if (!room) {
            return false;
        }

        /*
        Удаляем игроков
        из индекса комнат.
        */

        for (
            const player of room.players
        ) {

            this.playerRooms.delete(
                player.playerId
            );

        }

        /*
        Удаляем комнату.
        */

        this.rooms.delete(
            roomId
        );

        return true;

    }


    /*
    =====================================================
    REMOVE EMPTY ROOMS
    =====================================================
    */

    cleanupEmptyRooms() {

        const deleted = [];

        for (
            const room of this.rooms.values()
        ) {

            if (
                room.players.length === 0
            ) {

                deleted.push(
                    room.roomId
                );

            }

        }

        for (
            const roomId of deleted
        ) {

            this.deleteRoom(
                roomId
            );

        }

        return deleted;

    }


    /*
    =====================================================
    GET ROOM COUNT
    =====================================================
    */

    getRoomCount() {

        return this.rooms.size;

    }


    /*
    =====================================================
    GET ONLINE PLAYER COUNT
    =====================================================
    */

    getOnlinePlayerCount() {

        let count = 0;

        for (
            const room of this.rooms.values()
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

}


/*
=========================================================
SINGLE ROOM MANAGER
=========================================================

Один экземпляр используется
всей серверной частью.
=========================================================
*/

const rooms =
    new RoomManager();


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    ROOM_STATUS,

    createRoomPlayer,

    createRoom,

    generateRoomId,

    RoomManager,

    rooms

};
