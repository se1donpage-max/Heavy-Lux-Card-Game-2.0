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

const engine = require("./engine");

const {
    createGameState,
    createRoomPlayer,
    startGame,
    finishByForfeit,
    roomPlayerById,
    otherPlayer,
    getPublicGameState
} = engine;


/*
=========================================================
ROOM STORAGE
=========================================================
*/

const rooms = new Map();


/*
=========================================================
ROOM ENGINE
=========================================================
*/

function createRoomEngine(room) {

    return {

        startGame:
            () =>
                startGame(room),

        attackCard:
            (playerId, cardId) =>
                engine.attackCard(
                    room,
                    playerId,
                    cardId
                ),

        defendCard:
            (
                playerId,
                attackId,
                defenseId
            ) =>
                engine.defendCard(
                    room,
                    playerId,
                    attackId,
                    defenseId
                ),

        takeCards:
            playerId =>
                engine.takeCards(
                    room,
                    playerId
                ),

        bito:
            playerId =>
                engine.bito(
                    room,
                    playerId
                ),

        drawCards:
            () =>
                engine.drawCards(
                    room
                ),

        checkGameOver:
            () =>
                engine.checkGameOver(
                    room
                ),

        finishGame:
            (
                winnerId,
                loserId,
                settlement
            ) =>
                engine.finishGame(
                    room,
                    winnerId,
                    loserId,
                    settlement
                ),

        finishByForfeit:
            (
                loserId,
                reason
            ) =>
                engine.finishByForfeit(
                    room,
                    loserId,
                    reason
                ),

        getPublicState:
            playerId =>
                engine.getPublicGameState(
                    room,
                    playerId
                )

    };

}


/*
=========================================================
GENERATE ROOM ID
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
NORMALIZE PLAYER
=========================================================
*/

function normalizePlayer(
    player,
    fallbackSocketId = null
) {

    if (!player) {
        return null;
    }

    return {

        playerId:
            player.playerId,

        name:
            player.name || "",

        socketId:
            player.socketId ||
            fallbackSocketId ||
            null,

        connected:
            player.connected !== false,

        hand:
            Array.isArray(player.hand)
                ? player.hand
                : [],

        roomId:
            player.roomId ||
            null

    };

}


/*
=========================================================
SYNC PLAYER
=========================================================
*/

function syncExternalPlayer(
    externalPlayer,
    roomPlayer,
    roomId
) {

    if (
        !externalPlayer ||
        !roomPlayer
    ) {
        return;
    }

    externalPlayer.roomId =
        roomId;

    externalPlayer.socketId =
        roomPlayer.socketId;

    externalPlayer.connected =
        roomPlayer.connected;

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

/*
Поддерживаются оба варианта:

createRoom({
    roomId,
    stake,
    playerId,
    name,
    socketId
})

и:

createRoom(
    player,
    stake
)
*/

function createRoom(
    options,
    legacyStake = 0
) {

    let externalPlayer = null;

    let roomId = null;

    let stake = 0;

    let playerId = null;

    let name = "";

    let socketId = null;


    /*
    -----------------------------------------------------
    LEGACY API
    createRoom(player, stake)
    -----------------------------------------------------
    */

    if (
        options &&
        typeof options === "object" &&
        options.playerId &&
        !Object.prototype.hasOwnProperty.call(
            options,
            "stake"
        )
    ) {

        externalPlayer =
            options;

        stake =
            Number(
                legacyStake || 0
            );

        playerId =
            options.playerId;

        name =
            options.name || "";

        socketId =
            options.socketId || null;

    }

    /*
    -----------------------------------------------------
    OBJECT API
    createRoom({...})
    -----------------------------------------------------
    */

    else if (
        options &&
        typeof options === "object"
    ) {

        externalPlayer =
            options.player || null;

        roomId =
            options.roomId || null;

        stake =
            Number(
                options.stake || 0
            );

        playerId =
            options.playerId ||
            (
                externalPlayer
                    ? externalPlayer.playerId
                    : null
            );

        name =
            options.name ||
            (
                externalPlayer
                    ? externalPlayer.name
                    : ""
            ) ||
            "";

        socketId =
            options.socketId ||
            (
                externalPlayer
                    ? externalPlayer.socketId
                    : null
            ) ||
            null;

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
    PREVENT PLAYER IN MULTIPLE ROOMS
    -----------------------------------------------------
    */

    if (
        externalPlayer &&
        externalPlayer.roomId
    ) {

        const existingRoom =
            getRoom(
                externalPlayer.roomId
            );

        if (existingRoom) {

            return {

                ok: false,

                error:
                    "Игрок уже находится в комнате.",

                room:
                    existingRoom

            };

        }

    }


    const id =
        roomId ||
        generateRoomId();


    if (
        rooms.has(id)
    ) {

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


    /*
    -----------------------------------------------------
    PRESERVE EXTERNAL PLAYER REFERENCE
    -----------------------------------------------------
    */

    if (externalPlayer) {

        player.externalPlayer =
            externalPlayer;

    }


    const room =
        createGameState({

            roomId:
                id,

            stake,

            players: [
                player
            ]

        });


    /*
    -----------------------------------------------------
    ATTACH ENGINE
    -----------------------------------------------------
    */

    room.engine =
        createRoomEngine(
            room
        );


    /*
    -----------------------------------------------------
    STORE
    -----------------------------------------------------
    */

    rooms.set(
        id,
        room
    );


    /*
    -----------------------------------------------------
    ASSIGN ROOM ID
    -----------------------------------------------------
    */

    if (externalPlayer) {

        externalPlayer.roomId =
            id;

        externalPlayer.connected =
            true;

    }


    return {

        ok: true,

        room,

        player,

        started:
            false,

        gameStarted:
            false,

        reconnected:
            false

    };

}


/*
=========================================================
GET ROOM
=========================================================
*/

function getRoom(
    roomIdOrPlayer
) {

    if (!roomIdOrPlayer) {
        return null;
    }


    /*
    getRoom(player)
    */

    if (
        typeof roomIdOrPlayer ===
        "object"
    ) {

        if (
            roomIdOrPlayer.roomId
        ) {

            return (
                rooms.get(
                    String(
                        roomIdOrPlayer.roomId
                    )
                ) ||
                null
            );

        }

        return null;

    }


    return (
        rooms.get(
            String(
                roomIdOrPlayer
            )
        ) ||
        null
    );

}


/*
=========================================================
GET ROOMS
=========================================================
*/

function getRooms() {

    return Array.from(
        rooms.values()
    );

}


/*
=========================================================
GET ALL ROOMS
=========================================================
*/

function getAllRooms() {

    return getRooms();

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
HAS ROOM
=========================================================
*/

function hasRoom(
    roomId
) {

    return rooms.has(
        String(
            roomId
        )
    );

}


/*
=========================================================
JOIN ROOM
=========================================================
*/

/*
Поддерживаются:

joinRoom(player, roomId)

joinRoom({
    roomId,
    playerId,
    name,
    socketId
})
*/

function joinRoom(
    options,
    legacyRoomId = null
) {

    let externalPlayer = null;

    let roomId = null;

    let playerId = null;

    let name = "";

    let socketId = null;


    /*
    -----------------------------------------------------
    LEGACY
    -----------------------------------------------------
    */

    if (
        options &&
        typeof options === "object" &&
        options.playerId
    ) {

        externalPlayer =
            options;

        roomId =
            legacyRoomId ||
            options.roomId ||
            options.roomId;

        playerId =
            options.playerId;

        name =
            options.name || "";

        socketId =
            options.socketId || null;

    }

    /*
    -----------------------------------------------------
    OBJECT API
    -----------------------------------------------------
    */

    else if (
        options &&
        typeof options === "object"
    ) {

        externalPlayer =
            options.player || null;

        roomId =
            options.roomId;

        playerId =
            options.playerId ||
            (
                externalPlayer
                    ? externalPlayer.playerId
                    : null
            );

        name =
            options.name ||
            (
                externalPlayer
                    ? externalPlayer.name
                    : ""
            ) ||
            "";

        socketId =
            options.socketId ||
            (
                externalPlayer
                    ? externalPlayer.socketId
                    : null
            ) ||
            null;

    }


    if (
        !roomId
    ) {

        return {

            ok: false,

            error:
                "Не указана комната."

        };

    }


    if (!playerId) {

        return {

            ok: false,

            error:
                "Не указан игрок."

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


    /*
    -----------------------------------------------------
    ALREADY IN ANOTHER ROOM
    -----------------------------------------------------
    */

    if (
        externalPlayer &&
        externalPlayer.roomId &&
        String(
            externalPlayer.roomId
        ) !==
        String(room.id)
    ) {

        return {

            ok: false,

            error:
                "Игрок уже находится в другой комнате."

        };

    }


    /*
    -----------------------------------------------------
    EXISTING PLAYER / RECONNECT
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


        syncExternalPlayer(
            externalPlayer,
            existing,
            room.id
        );


        return {

            ok: true,

            room,

            player:
                existing,

            reconnected:
                true,

            started:
                room.status ===
                "playing",

            gameStarted:
                room.status ===
                "playing"

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


    if (externalPlayer) {

        player.externalPlayer =
            externalPlayer;

    }


    room.players.push(
        player
    );


    /*
    -----------------------------------------------------
    ASSIGN ROOM ID
    -----------------------------------------------------
    */

    if (externalPlayer) {

        externalPlayer.roomId =
            room.id;

        externalPlayer.connected =
            true;

    }


    /*
    -----------------------------------------------------
    START GAME
    -----------------------------------------------------
    */

    let started =
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

            room.players.pop();


            if (externalPlayer) {

                externalPlayer.roomId =
                    null;

            }


            return {

                ok: false,

                error:
                    result.error ||
                    "Не удалось начать игру."

            };

        }


        started =
            true;

    }


    return {

        ok: true,

        room,

        player,

        reconnected:
            false,

        started,

        gameStarted:
            started

    };

}


/*
=========================================================
GET ROOM PLAYER
=========================================================
*/

/*
Поддерживаются:

getRoomPlayer(player)

getRoomPlayer(room, playerId)

getRoomPlayer(roomId, playerId)
*/

function getRoomPlayer(
    first,
    second = null
) {

    let room = null;

    let playerId = null;


    if (
        first &&
        typeof first === "object" &&
        first.players
    ) {

        room =
            first;

        playerId =
            second;

    }

    else if (
        first &&
        typeof first === "object"
    ) {

        playerId =
            first.playerId;

        room =
            getRoom(
                first.roomId
            );

    }

    else {

        room =
            getRoom(
                first
            );

        playerId =
            second;

    }


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
GET OTHER PLAYER
=========================================================
*/

/*
Поддерживаются:

getOtherPlayer(room, playerId)

getOtherPlayer(roomId, playerId)
*/

function getOtherPlayer(
    first,
    second
) {

    let room = null;

    let playerId = null;


    if (
        first &&
        typeof first === "object" &&
        first.players
    ) {

        room =
            first;

        playerId =
            second;

    }

    else {

        room =
            getRoom(
                first
            );

        playerId =
            second;

    }


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
GET PUBLIC STATE
=========================================================
*/

function getPublicState(
    roomOrPlayer,
    playerId = null
) {

    let room = null;

    let id = null;


    if (
        roomOrPlayer &&
        typeof roomOrPlayer === "object" &&
        roomOrPlayer.players
    ) {

        room =
            roomOrPlayer;

        id =
            playerId;

    }

    else if (
        roomOrPlayer &&
        typeof roomOrPlayer === "object"
    ) {

        room =
            getRoom(
                roomOrPlayer.roomId
            );

        id =
            roomOrPlayer.playerId;

    }

    else {

        room =
            getRoom(
                roomOrPlayer
            );

        id =
            playerId;

    }


    if (!room) {
        return null;
    }


    return getPublicGameState(
        room,
        id
    );

}


/*
=========================================================
GET GAME STATE
=========================================================
*/

function getGameState(
    roomId,
    playerId
) {

    return getPublicState(
        roomId,
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

        id:
            room.id,

        roomId:
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
WAITING ROOMS
=========================================================
*/

function getWaitingRooms() {

    return Array.from(
        rooms.values()
    )
    .filter(
        room =>
            room.status ===
            "waiting" &&
            room.players.length <
            MAX_PLAYERS
    )
    .map(
        room =>
            getRoomSummary(
                room
            )
    );

}


/*
=========================================================
PUBLIC ROOM LIST
=========================================================
*/

function getPublicRoomList() {

    return getWaitingRooms();

}


/*
=========================================================
PUBLIC ROOMS
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
DISCONNECT PLAYER
=========================================================
*/

/*
Поддерживаются:

disconnectPlayer(player)

disconnectPlayer(roomId, playerId)
*/

function disconnectPlayer(
    first,
    second = null
) {

    let room = null;

    let playerId = null;

    let externalPlayer = null;


    if (
        first &&
        typeof first === "object"
    ) {

        externalPlayer =
            first;

        playerId =
            first.playerId;

        room =
            getRoom(
                first.roomId
            );

    }

    else {

        room =
            getRoom(
                first
            );

        playerId =
            second;

    }


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


    if (externalPlayer) {

        externalPlayer.connected =
            false;

        externalPlayer.socketId =
            null;

    }


    /*
    -----------------------------------------------------
    WAITING
    -----------------------------------------------------
    */

    if (
        room.status ===
        "waiting"
    ) {

        return {

            ok: true,

            room,

            player,

            disconnected:
                true,

            finished:
                false

        };

    }


    /*
    -----------------------------------------------------
    PLAYING
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

            ok:
                result.ok,

            room,

            player,

            disconnected:
                true,

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

        player,

        disconnected:
            true,

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

/*
Поддерживаются:

reconnectPlayer(player, socketId)

reconnectPlayer({
    roomId,
    playerId,
    socketId,
    name
})
*/

function reconnectPlayer(
    options,
    legacySocketId = null
) {

    let externalPlayer = null;

    let roomId = null;

    let playerId = null;

    let socketId = null;

    let name = null;


    if (
        options &&
        typeof options === "object"
    ) {

        externalPlayer =
            options;

        roomId =
            options.roomId;

        playerId =
            options.playerId;

        socketId =
            legacySocketId ||
            options.socketId ||
            null;

        name =
            options.name ??
            null;

    }


    if (!roomId) {

        return {

            ok: false,

            error:
                "Игрок не привязан к комнате."

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


    if (socketId) {

        player.socketId =
            socketId;

    }


    if (name !== null) {

        player.name =
            name;

    }


    syncExternalPlayer(
        externalPlayer,
        player,
        room.id
    );


    return {

        ok: true,

        room,

        player,

        reconnected:
            true

    };

}


/*
=========================================================
LEAVE ROOM
=========================================================
*/

/*
Поддерживается:

leaveRoom(player, reason)

leaveRoom(roomId, playerId, reason)
*/

function leaveRoom(
    first,
    second = "leave",
    third = null
) {

    let externalPlayer = null;

    let room = null;

    let playerId = null;

    let reason = "leave";


    if (
        first &&
        typeof first === "object"
    ) {

        externalPlayer =
            first;

        room =
            getRoom(
                first.roomId
            );

        playerId =
            first.playerId;

        reason =
            second ||
            "leave";

    }

    else {

        room =
            getRoom(
                first
            );

        playerId =
            second;

        reason =
            third ||
            "leave";

    }


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
    ACTIVE GAME = FORFEIT
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
                reason
            );


        if (externalPlayer) {

            externalPlayer.roomId =
                null;

            externalPlayer.socketId =
                null;

            externalPlayer.connected =
                false;

        }


        player.roomId =
            null;

        player.connected =
            false;

        player.socketId =
            null;


        return {

            ok:
                result.ok,

            room,

            winnerId:
                result.winnerId ||
                null,

            loserId:
                result.loserId ||
                playerId,

            reason

        };

    }


    /*
    -----------------------------------------------------
    WAITING ROOM
    -----------------------------------------------------
    */

    const index =
        room.players.findIndex(
            current =>
                String(
                    current.playerId
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


    if (externalPlayer) {

        externalPlayer.roomId =
            null;

        externalPlayer.socketId =
            null;

        externalPlayer.connected =
            false;

    }


    if (room.players.length === 0) {

        rooms.delete(
            room.id
        );

        return {

            ok: true,

            room:
                null,

            removed:
                true

        };

    }


    return {

        ok: true,

        room,

        removed:
            false

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


    return leaveRoom(
        roomId,
        playerId,
        "remove"
    );

}


/*
=========================================================
FORFEIT PLAYER
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
DELETE ROOM
=========================================================
*/

function deleteRoom(
    roomId
) {

    return rooms.delete(
        String(
            roomId
        )
    );

}


/*
=========================================================
CLEAR ROOMS
=========================================================
*/

function clearRooms() {

    /*
    Сбрасываем roomId
    у внешних игроков.
    */

    for (
        const room
        of rooms.values()
    ) {

        for (
            const player
            of room.players
        ) {

            if (
                player.externalPlayer
            ) {

                player.externalPlayer.roomId =
                    null;

                player.externalPlayer.socketId =
                    null;

                player.externalPlayer.connected =
                    false;

            }

        }

    }


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

    getRooms,

    getAllRooms,

    roomCount,

    hasRoom,

    joinRoom,

    disconnectPlayer,

    reconnectPlayer,

    leaveRoom,

    removePlayer,

    forfeitPlayer,

    reconnect:
        reconnectPlayer,

    getRoomPlayer,

    getOtherPlayer,

    getGameState,

    getPublicState,

    getRoomSummary,

    getWaitingRooms,

    getPublicRoomList,

    getPublicRooms,

    clearRooms,

    deleteRoom

};
