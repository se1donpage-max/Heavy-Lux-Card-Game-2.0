"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOMS MANAGER
=========================================================
*/

const {
    MAX_PLAYERS
} = require("../config");

const {
    createGameState,
    createRoomPlayer,
    startGame,
    finishByForfeit,
    roomPlayerById,
    otherPlayer,
    getPublicGameState
} = require("./engine");


/*
=========================================================
ROOM STORAGE
=========================================================
*/

const rooms = new Map();


/*
=========================================================
ROOM ID
=========================================================
*/

function generateRoomId() {

    let id;

    do {

        id =
            Math.random()
                .toString(16)
                .slice(2, 8)
                .toUpperCase();

    } while (
        rooms.has(id)
    );

    return id;
}


/*
=========================================================
CREATE ROOM
=========================================================
*/

function createRoom({
    roomId = null,
    stake = 0,
    playerId,
    name = "",
    socketId = null
}) {

    if (!playerId) {

        return {

            ok: false,

            error:
                "Не указан игрок."

        };

    }


    const id =
        roomId ||
        generateRoomId();


    if (rooms.has(id)) {

        return {

            ok: false,

            error:
                "Комната с таким ID уже существует."

        };

    }


    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected: true

        });


    const room =
        createGameState({

            roomId: id,

            stake,

            players: [
                player
            ]

        });


    rooms.set(
        id,
        room
    );


    return {

        ok: true,

        room

    };

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(
    roomId
) {

    if (!roomId) {
        return null;
    }


    return (
        rooms.get(
            String(roomId)
        ) ||
        null
    );

}


/*
=========================================================
ROOM EXISTS
=========================================================
*/

function hasRoom(
    roomId
) {

    return rooms.has(
        String(roomId)
    );

}


/*
=========================================================
ROOM COUNT
=========================================================
*/

function roomCount() {

    return rooms.size;

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function joinRoom({
    roomId,
    playerId,
    name = "",
    socketId = null
}) {

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


    if (!playerId) {

        return {

            ok: false,

            error:
                "Не указан игрок."

        };

    }


    /*
    -----------------------------------------------------
    PLAYER ALREADY IN ROOM
    -----------------------------------------------------
    */

    const existing =
        roomPlayerById(
            room,
            playerId
        );


    if (existing) {

        existing.name =
            name ||
            existing.name;

        existing.socketId =
            socketId ||
            existing.socketId;

        existing.connected =
            true;


        return {

            ok: true,

            room,

            player:
                existing,

            reconnected:
                true

        };

    }


    /*
    -----------------------------------------------------
    ROOM FULL
    -----------------------------------------------------
    */

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
    GAME ALREADY STARTED
    -----------------------------------------------------
    */

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


    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected: true

        });


    room.players.push(
        player
    );


    /*
    -----------------------------------------------------
    START GAME AUTOMATICALLY
    -----------------------------------------------------
    */

    let gameStarted =
        false;


    if (
        room.players.length ===
        MAX_PLAYERS
    ) {

        const result =
            startGame(
                room
            );


        if (
            !result.ok
        ) {

            /*
            Если старт не удался,
            удаляем добавленного игрока.
            */

            room.players =
                room.players.filter(
                    p =>
                        String(
                            p.playerId
                        ) !==
                        String(
                            playerId
                        )
                );


            return {

                ok: false,

                error:
                    result.error ||
                    "Не удалось начать игру."

            };

        }


        gameStarted =
            true;

    }


    return {

        ok: true,

        room,

        player,

        reconnected: false,

        gameStarted

    };

}


/*
=========================================================
LEAVE / DISCONNECT
=========================================================
*/

function disconnectPlayer(
    roomId,
    playerId
) {

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


    const player =
        roomPlayerById(
            room,
            playerId
        );


    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    player.connected =
        false;

    player.socketId =
        null;


    /*
    -----------------------------------------------------
    WAITING ROOM
    -----------------------------------------------------
    */

    if (
        room.status ===
        "waiting"
    ) {

        return {

            ok: true,

            room,

            disconnected: true,

            finished: false

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
                playerId,
                "disconnect"
            );


        return {

            ok: result.ok,

            room,

            disconnected: true,

            finished:
                result.ok,

            winnerId:
                result.winnerId ||
                null,

            loserId:
                result.loserId ||
                playerId

        };

    }


    return {

        ok: true,

        room,

        disconnected: true,

        finished:
            room.status ===
            "finished"

    };

}


/*
=========================================================
RECONNECT PLAYER
=========================================================
*/

function reconnectPlayer({
    roomId,
    playerId,
    socketId = null,
    name = null
}) {

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


    const player =
        roomPlayerById(
            room,
            playerId
        );


    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден в комнате."

        };

    }


    player.connected =
        true;

    player.socketId =
        socketId ||
        player.socketId;


    if (name !== null) {

        player.name =
            name;

    }


    return {

        ok: true,

        room,

        player,

        reconnected: true

    };

}


/*
=========================================================
REMOVE PLAYER
=========================================================
*/

function removePlayer(
    roomId,
    playerId
) {

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


    const index =
        room.players.findIndex(
            player =>
                String(
                    player.playerId
                ) ===
                String(
                    playerId
                )
        );


    if (
        index === -1
    ) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    room.players.splice(
        index,
        1
    );


    /*
    Если игроков больше нет,
    удаляем комнату.
    */

    if (
        room.players.length === 0
    ) {

        rooms.delete(
            room.id
        );

    }


    return {

        ok: true,

        room:
            room.players.length > 0
                ? room
                : null

    };

}


/*
=========================================================
FORFEIT
=========================================================
*/

function forfeitPlayer(
    roomId,
    playerId,
    reason = "leave"
) {

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
        "playing"
    ) {

        return {

            ok: false,

            error:
                "Игра не идёт."

        };

    }


    const result =
        finishByForfeit(
            room,
            playerId,
            reason
        );


    return {

        ...result,

        room

    };

}


/*
=========================================================
ROOM PLAYER
=========================================================
*/

function getRoomPlayer(
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );


    if (!room) {
        return null;
    }


    return roomPlayerById(
        room,
        playerId
    );

}


/*
=========================================================
OTHER PLAYER
=========================================================
*/

function getOtherPlayer(
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );


    if (!room) {
        return null;
    }


    return otherPlayer(
        room,
        playerId
    );

}


/*
=========================================================
ROOM GAME STATE
=========================================================
*/

function getGameState(
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );


    if (!room) {
        return null;
    }


    return getPublicGameState(
        room,
        playerId
    );

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

        /*
        -------------------------------------------------
        BASIC
        -------------------------------------------------
        */

        id:
            room.id,

        roomId:
            room.id,

        stake:
            room.stake,


        /*
        -------------------------------------------------
        STATUS
        -------------------------------------------------
        */

        status:
            room.status,

        phase:
            room.phase,


        /*
        -------------------------------------------------
        PLAYERS
        -------------------------------------------------
        */

        playersCount:
            room.players.length,

        playerCount:
            room.players.length,

        maxPlayers:
            MAX_PLAYERS,


        /*
        -------------------------------------------------
        PLAYER DATA
        -------------------------------------------------
        */

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


        /*
        -------------------------------------------------
        GAME
        -------------------------------------------------
        */

        startedAt:
            room.startedAt,

        finishedAt:
            room.finishedAt

    };

}


/*
=========================================================
WAITING ROOMS
=========================================================
*/

function getWaitingRooms() {

    const result = [];


    for (
        const room
        of rooms.values()
    ) {

        if (
            room.status !==
            "waiting"
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
            getRoomSummary(
                room
            )
        );

    }


    return result;

}


/*
=========================================================
PUBLIC ROOM LIST
=========================================================
*/

function getPublicRooms() {

    return Array.from(
        rooms.values()
    ).map(
        room =>
            getRoomSummary(
                room
            )
    );

}


/*
=========================================================
CLEAR ROOMS
=========================================================
*/

function clearRooms() {

    rooms.clear();

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
        String(roomId)
    );

}


/*
=========================================================
ALL ROOMS
=========================================================
*/

function getAllRooms() {

    return Array.from(
        rooms.values()
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    createRoom,

    getRoom,

    hasRoom,

    roomCount,

    joinRoom,

    disconnectPlayer,

    reconnectPlayer,

    removePlayer,

    forfeitPlayer,

    getRoomPlayer,

    getOtherPlayer,

    getGameState,

    getRoomSummary,

    getWaitingRooms,

    getPublicRooms,

    clearRooms,

    deleteRoom,

    getAllRooms

};
