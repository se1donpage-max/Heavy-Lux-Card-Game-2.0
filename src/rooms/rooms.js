"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOM MANAGER
=========================================================

Ответственность этого файла:

- создание комнат;
- поиск комнат;
- вход/выход игроков;
- подключение socket;
- отключение socket;
- очистка пустых комнат;
- запуск игры через engine;
- получение публичного состояния.

Игровые правила находятся в engine.js.
Карты находятся в cards.js.
Конфигурация находится в config/index.js.
=========================================================
*/

const crypto = require("crypto");

const {
    MAX_PLAYERS,
    STAKES,
    DISCONNECT_GRACE_MS,
    ID_LENGTH
} = require("../config");

const {
    createGameState,
    createRoomPlayer,
    startGame,
    roomPlayerById,
    finishByForfeit,
    getPublicGameState
} = require("./engine");


/*
=========================================================
ROOM STORAGE
=========================================================
*/

const rooms =
    new Map();


/*
=========================================================
ROOM ID
=========================================================
*/

function generateRoomId() {

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let id = "";


    for (
        let i = 0;
        i < ID_LENGTH;
        i++
    ) {

        const index =
            crypto.randomInt(
                alphabet.length
            );

        id +=
            alphabet[index];

    }


    return id;

}


/*
=========================================================
UNIQUE ROOM ID
=========================================================
*/

function generateUniqueRoomId() {

    let id;


    do {

        id =
            generateRoomId();

    } while (
        rooms.has(id)
    );


    return id;

}


/*
=========================================================
NORMALIZE STAKE
=========================================================
*/

function normalizeStake(
    stake
) {

    const value =
        Number(stake);


    if (
        !Number.isFinite(value)
    ) {

        return null;

    }


    if (
        !STAKES.includes(value)
    ) {

        return null;

    }


    return value;

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

function createRoom({
    playerId,
    name,
    socketId = null,
    stake
}) {

    if (!playerId) {

        return {

            ok: false,

            error:
                "Не указан playerId."

        };

    }


    const normalizedStake =
        normalizeStake(
            stake
        );


    if (
        normalizedStake === null
    ) {

        return {

            ok: false,

            error:
                "Недопустимая ставка."

        };

    }


    /*
    -----------------------------------------------------
    CHECK PLAYER ALREADY IN ROOM
    -----------------------------------------------------
    */

    const existing =
        findRoomByPlayer(
            playerId
        );


    if (existing) {

        return {

            ok: false,

            error:
                "Игрок уже находится в комнате.",

            room:
                existing

        };

    }


    const roomId =
        generateUniqueRoomId();


    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected:
                Boolean(socketId)

        });


    const room =
        createGameState({

            roomId,

            stake:
                normalizedStake,

            players: [
                player
            ]

        });


    room.hostId =
        playerId;


    room.createdAt =
        Date.now();


    room.updatedAt =
        Date.now();


    rooms.set(
        roomId,
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
            String(roomId).toUpperCase()
        ) ||
        null
    );

}


/*
=========================================================
FIND ROOM BY PLAYER
=========================================================
*/

function findRoomByPlayer(
    playerId
) {

    if (!playerId) {
        return null;
    }


    for (
        const room
        of rooms.values()
    ) {

        if (
            room.players.some(
                player =>
                    String(
                        player.playerId
                    ) ===
                    String(
                        playerId
                    )
            )
        ) {

            return room;

        }

    }


    return null;

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

function joinRoom({
    roomId,
    playerId,
    name,
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


    /*
    -----------------------------------------------------
    EXISTING PLAYER
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
            socketId;

        existing.connected =
            Boolean(socketId);

        existing.disconnectedAt =
            null;


        room.updatedAt =
            Date.now();


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
                "Игра в этой комнате уже началась."

        };

    }


    /*
    -----------------------------------------------------
    PLAYER ALREADY IN ANOTHER ROOM
    -----------------------------------------------------
    */

    const anotherRoom =
        findRoomByPlayer(
            playerId
        );


    if (anotherRoom) {

        return {

            ok: false,

            error:
                "Игрок уже находится в другой комнате."

        };

    }


    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected:
                Boolean(socketId)

        });


    room.players.push(
        player
    );


    room.updatedAt =
        Date.now();


    /*
    -----------------------------------------------------
    AUTO START
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


        if (!result.ok) {

            /*
            Откатываем игрока,
            если запуск игры не удался.
            */

            room.players.pop();

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

        reconnected:
            false,

        gameStarted

    };

}


/*
=========================================================
REMOVE PLAYER
=========================================================
*/

function removePlayer(
    roomId,
    playerId,
    {
        forfeit = true
    } = {}
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


    /*
    -----------------------------------------------------
    PLAYING
    -----------------------------------------------------
    */

    if (
        room.status ===
        "playing" &&
        forfeit
    ) {

        const result =
            finishByForfeit(
                room,
                playerId,
                "leave"
            );


        room.updatedAt =
            Date.now();


        return {

            ...result,

            room

        };

    }


    /*
    -----------------------------------------------------
    WAITING / FINISHED
    -----------------------------------------------------
    */

    const index =
        room.players.findIndex(
            item =>
                String(
                    item.playerId
                ) ===
                String(
                    playerId
                )
        );


    if (
        index !== -1
    ) {

        room.players.splice(
            index,
            1
        );

    }


    /*
    -----------------------------------------------------
    HOST TRANSFER
    -----------------------------------------------------
    */

    if (
        room.hostId ===
        playerId
    ) {

        room.hostId =
            room.players[0]
                ? room.players[0].playerId
                : null;

    }


    room.updatedAt =
        Date.now();


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

    }


    return {

        ok: true,

        room

    };

}


/*
=========================================================
DISCONNECT PLAYER
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

    player.disconnectedAt =
        Date.now();


    room.updatedAt =
        Date.now();


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

            waiting:
                true

        };

    }


    /*
    -----------------------------------------------------
    PLAYING
    -----------------------------------------------------

    НЕ удаляем игрока сразу.

    Даём время переподключиться.
    -----------------------------------------------------
    */

    if (
        room.status ===
        "playing"
    ) {

        return {

            ok: true,

            room,

            waitingReconnect:
                true,

            reconnectDeadline:
                Date.now() +
                DISCONNECT_GRACE_MS

        };

    }


    return {

        ok: true,

        room

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
    socketId,
    name
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
        socketId;

    player.disconnectedAt =
        null;


    if (name) {

        player.name =
            name;

    }


    room.updatedAt =
        Date.now();


    return {

        ok: true,

        room,

        player,

        gameState:
            room.status ===
            "playing"
                ? getPublicGameState(
                    room,
                    playerId
                )
                : null

    };

}


/*
=========================================================
FIND ROOM BY SOCKET
=========================================================
*/

function findRoomBySocket(
    socketId
) {

    if (!socketId) {
        return null;
    }


    for (
        const room
        of rooms.values()
    ) {

        if (
            room.players.some(
                player =>
                    player.socketId ===
                    socketId
            )
        ) {

            return room;

        }

    }


    return null;

}


/*
=========================================================
GET PLAYER
=========================================================
*/

function getPlayer(
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
LIST ROOMS
=========================================================
*/

function listRooms() {

    return Array.from(
        rooms.values()
    ).map(
        room => ({

            roomId:
                room.id,

            stake:
                room.stake,

            players:
                room.players.length,

            maxPlayers:
                MAX_PLAYERS,

            status:
                room.status,

            createdAt:
                room.createdAt

        })
    );

}


/*
=========================================================
PUBLIC ROOM
=========================================================
*/

function getPublicRoom(
    room,
    playerId = null
) {

    if (!room) {
        return null;
    }


    return {

        roomId:
            room.id,

        stake:
            room.stake,

        status:
            room.status,

        phase:
            room.phase,

        hostId:
            room.hostId,

        players:
            room.players.map(
                player => ({

                    playerId:
                        player.playerId,

                    name:
                        player.name,

                    connected:
                        player.connected,

                    handCount:
                        player.hand.length

                })
            ),

        game:
            playerId
                ? getPublicGameState(
                    room,
                    playerId
                )
                : null

    };

}


/*
=========================================================
CLEAN DISCONNECTED PLAYERS
=========================================================
*/

function cleanupDisconnected() {

    const now =
        Date.now();


    const removed = [];


    for (
        const room
        of rooms.values()
    ) {

        /*
        -------------------------------------------------
        PLAYING ROOMS
        -------------------------------------------------
        */

        if (
            room.status ===
            "playing"
        ) {

            for (
                const player
                of room.players
            ) {

                if (
                    player.connected ||
                    !player.disconnectedAt
                ) {

                    continue;

                }


                const expired =
                    now -
                    player.disconnectedAt >=
                    DISCONNECT_GRACE_MS;


                if (!expired) {
                    continue;
                }


                const result =
                    finishByForfeit(
                        room,
                        player.playerId,
                        "disconnect"
                    );


                room.updatedAt =
                    now;


                removed.push({

                    roomId:
                        room.id,

                    playerId:
                        player.playerId,

                    result

                });

            }


            continue;

        }


        /*
        -------------------------------------------------
        WAITING ROOMS
        -------------------------------------------------
        */

        if (
            room.status ===
            "waiting"
        ) {

            const stalePlayers =
                room.players.filter(
                    player =>
                        !player.connected &&
                        player.disconnectedAt &&
                        now -
                            player.disconnectedAt >=
                            DISCONNECT_GRACE_MS
                );


            for (
                const player
                of stalePlayers
            ) {

                const index =
                    room.players.indexOf(
                        player
                    );


                if (
                    index !== -1
                ) {

                    room.players.splice(
                        index,
                        1
                    );

                }


                removed.push({

                    roomId:
                        room.id,

                    playerId:
                        player.playerId,

                    reason:
                        "disconnect"

                });

            }


            if (
                room.hostId &&
                !room.players.some(
                    player =>
                        player.playerId ===
                        room.hostId
                )
            ) {

                room.hostId =
                    room.players[0]
                        ? room.players[0].playerId
                        : null;

            }


            if (
                room.players.length === 0
            ) {

                rooms.delete(
                    room.id
                );

            }

        }

    }


    return removed;

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
CLEAR ALL ROOMS
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

    createRoom,

    getRoom,

    findRoomByPlayer,

    findRoomBySocket,

    joinRoom,

    removePlayer,

    disconnectPlayer,

    reconnectPlayer,

    getPlayer,

    listRooms,

    getPublicRoom,

    cleanupDisconnected,

    roomCount,

    clearRooms

};
