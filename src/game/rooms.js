"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOM MANAGER
=========================================================

Отвечает за:

- создание комнат
- вход в комнаты
- выход из комнат
- disconnect
- reconnect
- поиск комнат
- хранение комнат
- подключение game engine
- игровой API комнаты

Игровая механика находится в:
src/game/engine.js
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
    roomPlayerById,
    attackCard,
    defendCard,
    takeCards,
    bito,
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

function createRoomId() {

    let roomId;

    do {

        roomId =
            crypto
                .randomBytes(4)
                .toString("hex")
                .slice(0, ID_LENGTH)
                .toUpperCase();

    } while (
        rooms.has(roomId)
    );

    return roomId;
}


/*
=========================================================
NORMALIZE ROOM ID
=========================================================
*/

function normalizeRoomId(roomId) {

    return String(roomId || "")
        .trim()
        .toUpperCase();
}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(roomId) {

    const normalized =
        normalizeRoomId(roomId);

    if (!normalized) {
        return null;
    }

    return (
        rooms.get(normalized) ||
        null
    );
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
ROOM COUNT
=========================================================
*/

function roomCount() {

    return rooms.size;
}


/*
=========================================================
GET WAITING ROOMS
=========================================================
*/

function getWaitingRooms() {

    return getRooms().filter(
        room =>
            room.status === "waiting" &&
            room.players.length < MAX_PLAYERS
    );
}


/*
=========================================================
GET ROOM PLAYER
=========================================================
*/

function getRoomPlayer(player) {

    if (
        !player ||
        !player.roomId
    ) {
        return null;
    }

    const room =
        getRoom(player.roomId);

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
GET PLAYER BY ID
=========================================================
*/

function getPlayerInRoom(
    room,
    playerId
) {

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
    room,
    playerId
) {

    if (!room) {
        return null;
    }

    return (
        room.players.find(
            player =>
                String(player.playerId) !==
                String(playerId)
        ) ||
        null
    );
}


/*
=========================================================
ATTACH ENGINE
=========================================================

ВАЖНО:

test-game-flow.js ожидает:

room.engine

Поэтому engine всегда создаётся
после создания комнаты и после reconnect.
=========================================================
*/

function attachRoomEngine(room) {

    if (!room) {
        return null;
    }

    room.engine = {

        /*
        -------------------------------------------------
        ATTACK
        -------------------------------------------------
        */

        attackCard(
            playerId,
            cardId
        ) {

            return attackCard(
                room,
                playerId,
                cardId
            );
        },


        /*
        -------------------------------------------------
        DEFEND
        -------------------------------------------------
        */

        defendCard(
            playerId,
            attackId,
            defenseId
        ) {

            return defendCard(
                room,
                playerId,
                attackId,
                defenseId
            );
        },


        /*
        -------------------------------------------------
        TAKE
        -------------------------------------------------
        */

        takeCards(
            playerId
        ) {

            return takeCards(
                room,
                playerId
            );
        },


        /*
        -------------------------------------------------
        BITO
        -------------------------------------------------
        */

        bito(
            playerId
        ) {

            return bito(
                room,
                playerId
            );
        },


        /*
        -------------------------------------------------
        PUBLIC STATE
        -------------------------------------------------
        */

        getPublicState(
            playerId
        ) {

            return getPublicGameState(
                room,
                playerId
            );
        },


        /*
        -------------------------------------------------
        STATE ALIAS
        -------------------------------------------------
        */

        getState(
            playerId
        ) {

            return getPublicGameState(
                room,
                playerId
            );
        }

    };

    return room;
}


/*
=========================================================
ENSURE ENGINE
=========================================================
*/

function ensureRoomEngine(room) {

    if (!room) {
        return null;
    }

    if (
        !room.engine ||
        typeof room.engine !== "object"
    ) {

        attachRoomEngine(room);
    }

    return room.engine;
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
            error: "Игрок не найден."
        };
    }


    if (player.roomId) {

        return {
            ok: false,
            error:
                "Вы уже находитесь в комнате."
        };
    }


    const numericStake =
        Number(stake);


    if (
        !Number.isFinite(numericStake) ||
        !STAKES.includes(numericStake)
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
            stake: numericStake,
            players: []
        });


    /*
    -----------------------------------------------------
    ENGINE
    -----------------------------------------------------
    */

    attachRoomEngine(room);


    /*
    -----------------------------------------------------
    FIRST PLAYER
    -----------------------------------------------------
    */

    const roomPlayer =
        createRoomPlayer({

            playerId:
                player.playerId,

            name:
                player.name || "",

            socketId:
                player.socketId || null,

            connected:
                true
        });


    room.players.push(
        roomPlayer
    );


    /*
    -----------------------------------------------------
    SAVE
    -----------------------------------------------------
    */

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
            error: "Игрок не найден."
        };
    }


    if (player.roomId) {

        return {
            ok: false,
            error:
                "Вы уже находитесь в комнате."
        };
    }


    const normalizedRoomId =
        normalizeRoomId(roomId);


    if (!normalizedRoomId) {

        return {
            ok: false,
            error:
                "Введите код комнаты."
        };
    }


    const room =
        getRoom(normalizedRoomId);


    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    if (
        room.status !== "waiting"
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
    DUPLICATE PLAYER CHECK
    -----------------------------------------------------
    */

    if (
        roomPlayerById(
            room,
            player.playerId
        )
    ) {

        return {
            ok: false,
            error:
                "Игрок уже находится в комнате."
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
                player.name || "",

            socketId:
                player.socketId || null,

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
        startGame(room);


    if (!started.ok) {

        room.players.pop();

        player.roomId =
            null;

        return started;
    }


    /*
    -----------------------------------------------------
    MAKE SURE ENGINE EXISTS
    -----------------------------------------------------
    */

    attachRoomEngine(room);


    return {

        ok: true,

        room,

        started: true

    };
}


/*
=========================================================
START ROOM MANUALLY
=========================================================
*/

function startRoom(roomId) {

    const room =
        getRoom(roomId);

    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    if (
        room.status !== "waiting"
    ) {

        return {
            ok: false,
            error:
                "Комната уже запущена."
        };
    }


    if (
        room.players.length !==
        MAX_PLAYERS
    ) {

        return {
            ok: false,
            error:
                "Для начала игры нужны два игрока."
        };
    }


    const result =
        startGame(room);


    if (!result.ok) {
        return result;
    }


    attachRoomEngine(room);


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
        getRoom(player.roomId);


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
        room.status === "playing"
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
                String(current.playerId) !==
                String(player.playerId)
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

Игрок НЕ удаляется из комнаты.

Это важно для reconnect.
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


    if (!player.roomId) {

        return {
            ok: true,
            room: null
        };
    }


    const room =
        getRoom(player.roomId);


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


    if (roomPlayer) {

        roomPlayer.connected =
            false;

        roomPlayer.socketId =
            null;
    }


    player.socketId =
        null;


    /*
    -----------------------------------------------------
    KEEP ENGINE
    -----------------------------------------------------
    */

    ensureRoomEngine(room);


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
        getRoom(player.roomId);


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
        socketId || null;


    player.socketId =
        socketId || null;


    /*
    -----------------------------------------------------
    RESTORE ENGINE
    -----------------------------------------------------
    */

    attachRoomEngine(room);


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
                String(player.playerId) !==
                String(playerId)
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

function deleteRoom(roomId) {

    return rooms.delete(
        normalizeRoomId(roomId)
    );
}


/*
=========================================================
CLEAR ROOMS
=========================================================
*/

function clearRooms() {

    rooms.clear();

    return true;
}


/*
=========================================================
CLEANUP ROOMS
=========================================================
*/

function cleanupRooms() {

    const removed = [];


    for (
        const room
        of rooms.values()
    ) {

        /*
        Empty room
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
        Finished room
        */

        if (
            room.status === "finished"
        ) {

            /*
            Не удаляем комнату,
            если она ещё содержит игроков.

            Это позволяет клиентам получить
            финальный результат игры.
            */
            continue;
        }
    }


    return removed;
}


/*
=========================================================
ROOM SUMMARY
=========================================================
*/

function getRoomSummary(room) {

    if (!room) {
        return null;
    }


    return {

        roomId:
            room.id,

        id:
            room.id,

        stake:
            room.stake,

        status:
            room.status,

        phase:
            room.phase,

        playerCount:
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

function getPublicRooms() {

    return getRooms().map(
        room =>
            getRoomSummary(room)
    );
}


/*
=========================================================
PUBLIC GAME STATE
=========================================================
*/

function getPublicState(
    room,
    playerId
) {

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
ENGINE ACCESS
=========================================================
*/

function getRoomEngine(roomId) {

    const room =
        getRoom(roomId);


    if (!room) {
        return null;
    }


    return ensureRoomEngine(room);
}


/*
=========================================================
ROOM GAME ACTION
=========================================================
*/

function roomAttack(
    roomId,
    playerId,
    cardId
) {

    const room =
        getRoom(roomId);


    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    const engine =
        ensureRoomEngine(room);


    return engine.attackCard(
        playerId,
        cardId
    );
}


function roomDefend(
    roomId,
    playerId,
    attackId,
    defenseId
) {

    const room =
        getRoom(roomId);


    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    const engine =
        ensureRoomEngine(room);


    return engine.defendCard(
        playerId,
        attackId,
        defenseId
    );
}


function roomTake(
    roomId,
    playerId
) {

    const room =
        getRoom(roomId);


    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    const engine =
        ensureRoomEngine(room);


    return engine.takeCards(
        playerId
    );
}


function roomBito(
    roomId,
    playerId
) {

    const room =
        getRoom(roomId);


    if (!room) {

        return {
            ok: false,
            error:
                "Комната не найдена."
        };
    }


    const engine =
        ensureRoomEngine(room);


    return engine.bito(
        playerId
    );
}


/*
=========================================================
VALIDATION
=========================================================
*/

function hasPlayer(
    room,
    playerId
) {

    return Boolean(
        roomPlayerById(
            room,
            playerId
        )
    );
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    /*
    Storage
    */

    rooms,

    roomCount,

    clearRooms,

    getRooms,

    getRoom,

    getWaitingRooms,

    getPublicRooms,


    /*
    Room lifecycle
    */

    createRoom,

    joinRoom,

    startRoom,

    leaveRoom,

    deleteRoom,

    cleanupRooms,


    /*
    Players
    */

    getRoomPlayer,

    getPlayerInRoom,

    getOtherPlayer,

    hasPlayer,

    removePlayer,


    /*
    Connection
    */

    disconnectPlayer,

    reconnectPlayer,


    /*
    Engine
    */

    attachRoomEngine,

    ensureRoomEngine,

    getRoomEngine,


    /*
    Game actions
    */

    roomAttack,

    roomDefend,

    roomTake,

    roomBito,


    /*
    State
    */

    getRoomSummary,

    getPublicState,

    normalizeRoomId

};
