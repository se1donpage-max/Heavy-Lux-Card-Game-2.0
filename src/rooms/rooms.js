"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOM MANAGER
=========================================================

Отвечает только за:

- создание комнат
- вход в комнаты
- выход
- reconnect
- disconnect
- поиск комнат
- хранение комнат

Игровая механика находится в:
src/game/engine.js

Экономика находится отдельно.
=========================================================
*/

const crypto = require("crypto");

const {
    MAX_PLAYERS,
    STAKES,
    ID_LENGTH
} = require("../config");

const {
    createGameState,
    createRoomPlayer,
    startGame,
    finishByForfeit,
    roomPlayerById
} = require("../game/engine");


/*
=========================================================
STORAGE
=========================================================
*/

const rooms =
    new Map();


/*
=========================================================
ROOM ID
=========================================================
*/

function createRoomId() {

    let id;

    do {

        id =
            crypto
                .randomBytes(4)
                .toString("hex")
                .slice(
                    0,
                    ID_LENGTH
                )
                .toUpperCase();

    } while (
        rooms.has(id)
    );


    return id;

}


/*
=========================================================
NORMALIZE ROOM ID
=========================================================
*/

function normalizeRoomId(
    roomId
) {

    return String(
        roomId || ""
    )
        .trim()
        .toUpperCase();

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(
    roomId
) {

    return (
        rooms.get(
            normalizeRoomId(
                roomId
            )
        ) ||
        null
    );

}


/*
=========================================================
GET ALL ROOMS
=========================================================
*/

function getRooms() {

    return [
        ...rooms.values()
    ];

}


/*
=========================================================
GET WAITING ROOMS
=========================================================
*/

function getWaitingRooms() {

    return getRooms()
        .filter(
            room =>
                room.status ===
                    "waiting" &&
                room.players.length <
                    MAX_PLAYERS
        );

}


/*
=========================================================
GET ROOM PLAYER
=========================================================
*/

function getRoomPlayer(
    player
) {

    if (
        !player ||
        !player.roomId
    ) {

        return null;

    }


    const room =
        getRoom(
            player.roomId
        );


    if (!room) {

        return null;

    }


    return roomPlayerById(
        room,
        player.playerId
    );

}


/*
=========================================================
OTHER PLAYER
=========================================================
*/

function getOtherPlayer(
    room,
    playerId
) {

    if (!room) {

        return null;

    }


    return (
        room.players.find(
            player =>
                String(
                    player.playerId
                ) !==
                String(
                    playerId
                )
        ) ||
        null
    );

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

function createRoom(
    player,
    stake
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    if (player.roomId) {

        return {

            ok: false,

            error:
                "Вы уже находитесь в комнате."

        };

    }


    stake =
        Number(stake);


    if (
        !Number.isFinite(
            stake
        ) ||
        !STAKES.includes(
            stake
        )
    ) {

        return {

            ok: false,

            error:
                "Некорректная ставка."

        };

    }


    const roomId =
        createRoomId();


    const room =
        createGameState({

            roomId,

            stake,

            players: []

        });


    const roomPlayer =
        createRoomPlayer({

            playerId:
                player.playerId,

            name:
                player.name,

            socketId:
                player.socketId ||
                null,

            connected:
                true

        });


    room.players.push(
        roomPlayer
    );


    rooms.set(
        roomId,
        room
    );


    player.roomId =
        roomId;


    return {

        ok: true,

        room

    };

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function joinRoom(
    player,
    roomId
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    if (player.roomId) {

        return {

            ok: false,

            error:
                "Вы уже находитесь в комнате."

        };

    }


    roomId =
        normalizeRoomId(
            roomId
        );


    if (!roomId) {

        return {

            ok: false,

            error:
                "Введите код комнаты."

        };

    }


    const room =
        getRoom(
            roomId
        );


    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    if (
        room.status !==
        "waiting"
    ) {

        return {

            ok: false,

            error:
                "Игра уже началась."

        };

    }


    if (
        room.players.length >=
        MAX_PLAYERS
    ) {

        return {

            ok: false,

            error:
                "Комната заполнена."

        };

    }


    /*
    -----------------------------------------------------
    ADD PLAYER
    -----------------------------------------------------
    */

    const roomPlayer =
        createRoomPlayer({

            playerId:
                player.playerId,

            name:
                player.name,

            socketId:
                player.socketId ||
                null,

            connected:
                true

        });


    room.players.push(
        roomPlayer
    );


    player.roomId =
        room.id;


    /*
    -----------------------------------------------------
    START GAME
    -----------------------------------------------------

    ВАЖНО:

    Здесь пока НЕ резервируем деньги.

    Экономика будет подключена
    отдельным settlement/wallet layer.

    Engine отвечает только за игру.
    -----------------------------------------------------
    */

    const started =
        startGame(
            room
        );


    if (!started.ok) {

        room.players.pop();

        player.roomId =
            null;


        return started;

    }


    return {

        ok: true,

        room,

        started: true

    };

}


/*
=========================================================
LEAVE ROOM
=========================================================
*/

function leaveRoom(
    player,
    reason = "leave"
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    if (!player.roomId) {

        return {

            ok: true,

            room: null

        };

    }


    const room =
        getRoom(
            player.roomId
        );


    if (!room) {

        player.roomId =
            null;

        return {

            ok: true,

            room: null

        };

    }


    /*
    -----------------------------------------------------
    ACTIVE GAME
    -----------------------------------------------------
    */

    if (
        room.status ===
        "playing"
    ) {

        const result =
            finishByForfeit(
                room,
                player.playerId,
                reason
            );


        player.roomId =
            null;


        return {

            ...result,

            room

        };

    }


    /*
    -----------------------------------------------------
    WAITING ROOM
    -----------------------------------------------------
    */

    room.players =
        room.players.filter(
            current =>
                String(
                    current.playerId
                ) !==
                String(
                    player.playerId
                )
        );


    player.roomId =
        null;


    /*
    -----------------------------------------------------
    DELETE EMPTY ROOM
    -----------------------------------------------------
    */

    if (
        room.players.length === 0
    ) {

        rooms.delete(
            room.id
        );

        return {

            ok: true,

            room: null

        };

    }


    return {

        ok: true,

        room

    };

}


/*
=========================================================
DISCONNECT
=========================================================
*/

function disconnectPlayer(
    player
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    const room =
        getRoom(
            player.roomId
        );


    if (!room) {

        return {

            ok: true,

            room: null

        };

    }


    const roomPlayer =
        roomPlayerById(
            room,
            player.playerId
        );


    if (roomPlayer) {

        roomPlayer.connected =
            false;

        roomPlayer.socketId =
            null;

    }


    player.socketId =
        null;


    return {

        ok: true,

        room

    };

}


/*
=========================================================
RECONNECT
=========================================================
*/

function reconnectPlayer(
    player,
    socketId
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    if (!player.roomId) {

        return {

            ok: false,

            error:
                "Игрок не находится в комнате."

        };

    }


    const room =
        getRoom(
            player.roomId
        );


    if (!room) {

        player.roomId =
            null;

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    const roomPlayer =
        roomPlayerById(
            room,
            player.playerId
        );


    if (!roomPlayer) {

        return {

            ok: false,

            error:
                "Игрок не найден в комнате."

        };

    }


    roomPlayer.connected =
        true;

    roomPlayer.socketId =
        socketId ||
        null;


    player.socketId =
        socketId ||
        null;


    return {

        ok: true,

        room

    };

}


/*
=========================================================
REMOVE PLAYER
=========================================================
*/

function removePlayer(
    room,
    playerId
) {

    if (!room) {

        return false;

    }


    const before =
        room.players.length;


    room.players =
        room.players.filter(
            player =>
                String(
                    player.playerId
                ) !==
                String(
                    playerId
                )
        );


    return (
        room.players.length !==
        before
    );

}


/*
=========================================================
DELETE ROOM
=========================================================
*/

function deleteRoom(
    roomId
) {

    return rooms.delete(
        normalizeRoomId(
            roomId
        )
    );

}


/*
=========================================================
CLEANUP
=========================================================
*/

function cleanupRooms() {

    const removed = [];


    for (
        const room
        of rooms.values()
    ) {

        /*
        Пустые комнаты удаляем.
        */

        if (
            room.players.length === 0
        ) {

            rooms.delete(
                room.id
            );

            removed.push(
                room.id
            );

        }

    }


    return removed;

}


/*
=========================================================
ROOM SUMMARY
=========================================================
*/

function getRoomSummary(
    room
) {

    if (!room) {

        return null;

    }


    return {

        id:
            room.id,

        stake:
            room.stake,

        pot:
            room.pot,

        status:
            room.status,

        phase:
            room.phase,

        playersCount:
            room.players.length,

        maxPlayers:
            MAX_PLAYERS,

        players:
            room.players.map(
                player => ({

                    playerId:
                        player.playerId,

                    name:
                        player.name,

                    connected:
                        Boolean(
                            player.connected
                        )

                })
            ),

        createdAt:
            room.createdAt,

        startedAt:
            room.startedAt,

        finishedAt:
            room.finishedAt

    };

}


/*
=========================================================
PUBLIC ROOM LIST
=========================================================
*/

function getPublicRoomList() {

    return getWaitingRooms()
        .map(
            getRoomSummary
        );

}


/*
=========================================================
CLEAR
=========================================================
*/

function clearRooms() {

    rooms.clear();

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    rooms,

    createRoom,

    joinRoom,

    leaveRoom,

    getRoom,

    getRooms,

    getWaitingRooms,

    getPublicRoomList,

    getRoomSummary,

    getRoomPlayer,

    getOtherPlayer,

    roomPlayerById,

    disconnectPlayer,

    reconnectPlayer,

    removePlayer,

    deleteRoom,

    cleanupRooms,

    clearRooms,

    createRoomId,

    normalizeRoomId

};
