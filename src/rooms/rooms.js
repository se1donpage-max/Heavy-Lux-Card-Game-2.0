"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOM MANAGER
=========================================================

RESPONSIBILITIES:

- create room
- join room
- get room
- get room player
- leave room
- reconnect player
- disconnect player
- list waiting rooms
- cleanup empty rooms

DOES NOT HANDLE:

- Socket.IO
- PostgreSQL
- Telegram
- direct balance mutations
- settlement

GAME LOGIC:
delegated to src/game/engine.js
=========================================================
*/

const crypto = require("crypto");

const {
    CONFIG
} = require("../config");

const {
    createGameState,
    createRoomPlayer,
    startGame,
    finishByForfeit
} = require("../game/engine");


/*
=========================================================
CONSTANTS
=========================================================
*/

const MAX_PLAYERS_PER_ROOM =
    CONFIG.GAME.MAX_PLAYERS;


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

function createRoomId() {

    let roomId;

    do {

        roomId =
            crypto
                .randomBytes(4)
                .toString("hex")
                .slice(0, 6)
                .toUpperCase();

    } while (
        rooms.has(roomId)
    );


    return roomId;

}


/*
=========================================================
SAFE ROOM ID
=========================================================
*/

function safeRoomId(
    roomId
) {

    return String(
        roomId || ""
    )
        .trim()
        .toUpperCase()
        .slice(0, 20);

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(
    roomId
) {

    const safeId =
        safeRoomId(
            roomId
        );


    return (
        rooms.get(
            safeId
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
                "waiting"
        );

}


/*
=========================================================
ROOM PLAYER BY ID
=========================================================
*/

function roomPlayerById(
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
                ) ===
                String(
                    playerId
                )
        ) ||
        null
    );

}


/*
=========================================================
OTHER PLAYER
=========================================================
*/

function otherPlayer(
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
ROOM PLAYER FROM PLAYER OBJECT
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
PLAYER ROOM ID
=========================================================
*/

function getPlayerRoomId(
    player
) {

    return (
        player?.roomId ||
        null
    );

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

/*
wallet = {
    hasAvailableMoney(player, amount)
}

Это dependency injection.

rooms.js не знает,
как именно хранится баланс.
*/

function createRoom(
    player,
    requestedStake,
    wallet = {}
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


    const stake =
        Number(
            requestedStake
        );


    if (
        !Number.isFinite(
            stake
        ) ||
        !CONFIG.ECONOMY.STAKES.includes(
            stake
        )
    ) {

        return {

            ok: false,

            error:
                "Выберите корректную ставку."

        };

    }


    /*
    -----------------------------------------------------
    BALANCE CHECK
    -----------------------------------------------------
    */

    if (
        typeof wallet.hasAvailableMoney ===
        "function"
    ) {

        const available =
            wallet.hasAvailableMoney(
                player,
                stake
            );


        if (!available) {

            return {

                ok: false,

                error:
                    `Недостаточно средств. Нужно ${stake.toLocaleString("ru-RU")}.`

            };

        }

    }


    /*
    -----------------------------------------------------
    ROOM
    -----------------------------------------------------
    */

    const roomId =
        createRoomId();


    const room =
        createGameState({

            roomId,

            stake,

            players: []

        });


    /*
    -----------------------------------------------------
    FIRST PLAYER
    -----------------------------------------------------
    */

    room.players.push(
        createRoomPlayer({

            playerId:
                player.playerId,

            name:
                player.name,

            socketId:
                player.socketId,

            connected:
                true

        })
    );


    rooms.set(
        room.id,
        room
    );


    player.roomId =
        room.id;


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
    roomId,
    wallet = {}
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    roomId =
        safeRoomId(
            roomId
        );


    if (!roomId) {

        return {

            ok: false,

            error:
                "Введите код комнаты."

        };

    }


    if (player.roomId) {

        return {

            ok: false,

            error:
                "Вы уже находитесь в комнате."

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
        room.players.length >=
        MAX_PLAYERS_PER_ROOM
    ) {

        return {

            ok: false,

            error:
                "Комната уже заполнена."

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


    /*
    -----------------------------------------------------
    BALANCE CHECK
    -----------------------------------------------------
    */

    if (
        typeof wallet.hasAvailableMoney ===
        "function"
    ) {

        const available =
            wallet.hasAvailableMoney(
                player,
                room.stake
            );


        if (!available) {

            return {

                ok: false,

                error:
                    `Недостаточно средств для входа в игру на ${room.stake.toLocaleString("ru-RU")}.`

            };

        }

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
                player.socketId,

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
    */

    const started =
        startGame(
            room
        );


    if (!started.ok) {

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


        return started;

    }


    return {

        ok: true,

        room

    };

}


/*
=========================================================
START ROOM
=========================================================
*/

function startRoom(
    roomId
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


    return startGame(
        room
    );

}


/*
=========================================================
UPDATE SOCKET
=========================================================
*/

function updateSocket(
    player,
    socketId
) {

    if (!player) {

        return false;

    }


    const room =
        getRoomPlayer(
            player
        );


    if (!room) {

        return false;

    }


    room.socketId =
        socketId ||
        null;

    room.connected =
        true;


    player.socketId =
        socketId ||
        null;


    return true;

}


/*
=========================================================
DISCONNECT PLAYER
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
        getRoomPlayer(
            player
        );


    if (!room) {

        return {

            ok: true,

            room: null

        };

    }


    room.connected =
        false;

    room.socketId =
        null;


    player.socketId =
        null;


    return {

        ok: true,

        room:
            getRoom(
                player.roomId
            )

    };

}


/*
=========================================================
RECONNECT PLAYER
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
                "Комната больше не существует."

        };

    }


    const roomPlayer =
        roomPlayerById(
            room,
            player.playerId
        );


    if (!roomPlayer) {

        player.roomId =
            null;

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


    roomPlayer.name =
        player.name ||
        roomPlayer.name;


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
LEAVE ROOM
=========================================================
*/

function leaveRoom(
    player,
    options = {}
) {

    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    const roomId =
        player.roomId;


    if (!roomId) {

        return {

            ok: true,

            room: null

        };

    }


    const room =
        getRoom(
            roomId
        );


    if (!room) {

        player.roomId =
            null;

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


    if (!roomPlayer) {

        player.roomId =
            null;

        return {

            ok: true,

            room

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

        const forfeit =
            finishByForfeit(
                room,
                player.playerId,
                options.reason ||
                    "leave"
            );


        player.roomId =
            null;


        return {

            ok:
                forfeit.ok,

            room,

            finished:
                forfeit.ok,

            winnerId:
                forfeit.winnerId ||
                null,

            loserId:
                forfeit.loserId ||
                null

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
REMOVE PLAYER FROM ROOM
=========================================================
*/

function removePlayerFromRoom(
    playerId,
    roomId
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
DELETE ROOM
=========================================================
*/

function deleteRoom(
    roomId
) {

    const room =
        getRoom(
            roomId
        );


    if (!room) {

        return false;

    }


    return rooms.delete(
        room.id
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
        -------------------------------------------------
        EMPTY ROOM
        -------------------------------------------------
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

            continue;

        }


        /*
        -------------------------------------------------
        FINISHED ROOM
        -------------------------------------------------

        Пока НЕ удаляем сразу.

        server.js / settlement должен
        решить, когда комната окончательно
        освобождается.
        -------------------------------------------------
        */

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
            MAX_PLAYERS_PER_ROOM,

        players:
            room.players.map(
                player => ({

                    playerId:
                        player.playerId,

                    name:
                        player.name,

                    connected:
                        player.connected

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

    return getRooms()
        .filter(
            room =>
                room.status ===
                    "waiting" &&
                room.players.length <
                    MAX_PLAYERS_PER_ROOM
        )
        .map(
            getRoomSummary
        );

}


/*
=========================================================
RESET
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

    getRoom,

    getRooms,

    getWaitingRooms,

    getPublicRoomList,

    getRoomSummary,

    roomPlayerById,

    otherPlayer,

    getRoomPlayer,

    getPlayerRoomId,

    createRoom,

    joinRoom,

    startRoom,

    updateSocket,

    disconnectPlayer,

    reconnectPlayer,

    leaveRoom,

    removePlayerFromRoom,

    deleteRoom,

    cleanupRooms,

    clearRooms,

    safeRoomId,

    createRoomId

};
