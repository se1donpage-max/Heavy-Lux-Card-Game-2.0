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
                engine.startGame(
                    room
                ),

        attackCard:
            (
                playerId,
                cardId
            ) =>
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
                reason = "leave"
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
GET ROOM
=========================================================
*/

function getRoom(
    roomOrId
) {

    if (!roomOrId) {

        return null;

    }


    /*
    -----------------------------------------------------
    PLAYER OBJECT
    -----------------------------------------------------
    */

    if (
        typeof roomOrId ===
        "object"
    ) {

        if (
            roomOrId.id &&
            rooms.has(
                String(
                    roomOrId.id
                )
            )
        ) {

            return rooms.get(
                String(
                    roomOrId.id
                )
            );

        }


        if (
            roomOrId.roomId
        ) {

            return (
                rooms.get(
                    String(
                        roomOrId.roomId
                    )
                ) ||
                null
            );

        }


        return null;

    }


    /*
    -----------------------------------------------------
    ROOM ID
    -----------------------------------------------------
    */

    return (
        rooms.get(
            String(
                roomOrId
            )
        ) ||
        null
    );

}


/*
=========================================================
SYNC EXTERNAL PLAYER
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
        roomId || null;

    externalPlayer.socketId =
        roomPlayer.socketId || null;

    externalPlayer.connected =
        roomPlayer.connected !== false;

}


/*
=========================================================
FIND EXTERNAL PLAYER
=========================================================
*/

function findExternalPlayer(
    room,
    playerId
) {

    if (!room) {

        return null;

    }


    const roomPlayer =
        roomPlayerById(
            room,
            playerId
        );


    if (!roomPlayer) {

        return null;

    }


    return (
        roomPlayer.externalPlayer ||
        null
    );

}


/*
=========================================================
CREATE ROOM
=========================================================
*/

/*
Поддерживается:

createRoom(player, stake)

и:

createRoom({
    playerId,
    name,
    socketId,
    stake
})
*/

function createRoom(
    options,
    legacyStake = 0
) {

    let externalPlayer =
        null;

    let playerId =
        null;

    let name =
        "";

    let socketId =
        null;

    let stake =
        0;

    let roomId =
        null;


    /*
    -----------------------------------------------------
    LEGACY:
    createRoom(player, stake)
    -----------------------------------------------------
    */

    if (
        options &&
        typeof options === "object" &&
        options.playerId
    ) {

        externalPlayer =
            options;

        playerId =
            options.playerId;

        name =
            options.name || "";

        socketId =
            options.socketId || null;

        stake =
            Number(
                legacyStake || 0
            );

    }


    /*
    -----------------------------------------------------
    OBJECT:
    createRoom({...})
    -----------------------------------------------------
    */

    else if (
        options &&
        typeof options === "object"
    ) {

        externalPlayer =
            options.player || null;

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

        stake =
            Number(
                options.stake || 0
            );

        roomId =
            options.roomId || null;

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


        /*
        Если roomId устарел —
        очищаем его.
        */

        externalPlayer.roomId =
            null;

    }


    /*
    -----------------------------------------------------
    ROOM ID
    -----------------------------------------------------
    */

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


    /*
    -----------------------------------------------------
    CREATE ROOM PLAYER
    -----------------------------------------------------
    */

    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected:
                true

        });


    /*
    -----------------------------------------------------
    SAVE EXTERNAL PLAYER
    -----------------------------------------------------
    */

    if (externalPlayer) {

        player.externalPlayer =
            externalPlayer;

    }


    /*
    -----------------------------------------------------
    CREATE GAME STATE
    -----------------------------------------------------
    */

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
    ASSIGN PLAYER ROOM ID
    -----------------------------------------------------
    */

    if (externalPlayer) {

        externalPlayer.roomId =
            id;

        externalPlayer.socketId =
            socketId;

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
JOIN ROOM
=========================================================
*/

/*
Поддерживается:

joinRoom(player, roomId)

и:

joinRoom({
    player,
    roomId
})

и:

joinRoom({
    playerId,
    roomId,
    name,
    socketId
})
*/

function joinRoom(
    options,
    legacyRoomId = null
) {

    let externalPlayer =
        null;

    let roomId =
        null;

    let playerId =
        null;

    let name =
        "";

    let socketId =
        null;


    /*
    -----------------------------------------------------
    LEGACY:
    joinRoom(player, roomId)
    -----------------------------------------------------
    */

    if (
        options &&
        typeof options === "object" &&
        options.playerId
    ) {

        externalPlayer =
            options;

        playerId =
            options.playerId;

        name =
            options.name || "";

        socketId =
            options.socketId || null;

        roomId =
            legacyRoomId ||
            options.roomId ||
            null;

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
            options.roomId || null;

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


    if (!roomId) {

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
    PLAYER IN ANOTHER ROOM
    -----------------------------------------------------
    */

    if (
        externalPlayer &&
        externalPlayer.roomId &&
        String(
            externalPlayer.roomId
        ) !==
        String(
            room.id
        )
    ) {

        const anotherRoom =
            getRoom(
                externalPlayer.roomId
            );


        if (anotherRoom) {

            return {

                ok: false,

                error:
                    "Игрок уже находится в другой комнате.",

                room:
                    anotherRoom

            };

        }


        externalPlayer.roomId =
            null;

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


    /*
    -----------------------------------------------------
    CREATE PLAYER
    -----------------------------------------------------
    */

    const player =
        createRoomPlayer({

            playerId,

            name,

            socketId,

            connected:
                true

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

        externalPlayer.socketId =
            socketId;

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
            !result ||
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
                    result &&
                    result.error
                        ? result.error
                        : "Не удалось начать игру."

            };

        }


        started =
            true;

    }


    return {

        ok: true,

        room,

        player,

        started,

        gameStarted:
            started,

        reconnected:
            false

    };

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


function getAllRooms() {

    return getRooms();

}


function roomCount() {

    return rooms.size;

}


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
GET ROOM PLAYER
=========================================================
*/

function getRoomPlayer(
    roomOrPlayer,
    playerId = null
) {

    const room =
        getRoom(
            roomOrPlayer
        );


    if (!room) {

        return null;

    }


    /*
    getRoomPlayer(player)
    */

    if (
        typeof roomOrPlayer ===
        "object" &&
        roomOrPlayer.playerId
    ) {

        return roomPlayerById(
            room,
            roomOrPlayer.playerId
        );

    }


    /*
    getRoomPlayer(room, playerId)
    */

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

function getOtherPlayer(
    roomOrPlayer,
    playerId = null
) {

    const room =
        getRoom(
            roomOrPlayer
        );


    if (!room) {

        return null;

    }


    /*
    getOtherPlayer(player)
    */

    if (
        typeof roomOrPlayer ===
        "object" &&
        roomOrPlayer.playerId &&
        !playerId
    ) {

        return otherPlayer(
            room,
            roomOrPlayer.playerId
        );

    }


    /*
    getOtherPlayer(room, playerId)
    */

    return otherPlayer(
        room,
        playerId
    );

}


/*
=========================================================
PUBLIC GAME STATE
=========================================================
*/

function getPublicState(
    roomOrId,
    playerId
) {

    const room =
        getRoom(
            roomOrId
        );


    if (!room) {

        return null;

    }


    return getPublicGameState(
        room,
        playerId
    );

}


function getGameState(
    roomOrId,
    playerId
) {

    return getPublicState(
        roomOrId,
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
                        player.connected !== false

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

    return getRooms()
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
Совместимость со старым API.
*/

function getPublicRooms() {

    return getWaitingRooms();

}


/*
=========================================================
DISCONNECT PLAYER
=========================================================
*/

/*
Поддерживается:

disconnectPlayer(player)

и:

disconnectPlayer(roomId, playerId)
*/

function disconnectPlayer(
    roomOrPlayer,
    playerId = null
) {

    const room =
        getRoom(
            roomOrPlayer
        );


    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    let actualPlayerId =
        playerId;


    if (
        typeof roomOrPlayer ===
        "object" &&
        roomOrPlayer.playerId
    ) {

        actualPlayerId =
            roomOrPlayer.playerId;

    }


    const player =
        roomPlayerById(
            room,
            actualPlayerId
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
    SYNC EXTERNAL PLAYER
    -----------------------------------------------------
    */

    if (
        player.externalPlayer
    ) {

        player.externalPlayer.socketId =
            null;

        player.externalPlayer.connected =
            false;

    }


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

            disconnected:
                true,

            finished:
                false

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
                actualPlayerId,
                "disconnect"
            );


        return {

            ok:
                result.ok,

            room,

            disconnected:
                true,

            finished:
                result.ok,

            winnerId:
                result.winnerId ||
                null,

            loserId:
                result.loserId ||
                actualPlayerId

        };

    }


    return {

        ok: true,

        room,

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
Поддерживается:

reconnectPlayer(player, socketId)

и:

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

    let externalPlayer =
        null;

    let roomId =
        null;

    let playerId =
        null;

    let socketId =
        null;

    let name =
        null;


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
            options.roomId ||
            null;

        playerId =
            options.playerId;

        socketId =
            legacySocketId ||
            null;

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
            options.roomId ||
            (
                externalPlayer
                    ? externalPlayer.roomId
                    : null
            );

        playerId =
            options.playerId ||
            (
                externalPlayer
                    ? externalPlayer.playerId
                    : null
            );

        socketId =
            options.socketId ||
            (
                externalPlayer
                    ? externalPlayer.socketId
                    : null
            );

        name =
            options.name ||
            null;

    }


    if (!roomId) {

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


    if (
        name !== null
    ) {

        player.name =
            name;

    }


    syncExternalPlayer(
        externalPlayer ||
        player.externalPlayer ||
        null,

        player,

        room.id
    );


    return {

        ok: true,

        room,

        player,

        reconnected:
            true,

        gameStarted:
            room.status ===
            "playing"

    };

}


/*
=========================================================
LEAVE ROOM
=========================================================
*/

/*
Выход из активной игры =
автоматический forfeit.

Для waiting комнаты игрок просто удаляется.
*/

function leaveRoom(
    roomOrPlayer,
    reason = "leave"
) {

    const room =
        getRoom(
            roomOrPlayer
        );


    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    let playerId =
        null;

    let externalPlayer =
        null;


    if (
        typeof roomOrPlayer ===
        "object" &&
        roomOrPlayer.playerId
    ) {

        playerId =
            roomOrPlayer.playerId;

        externalPlayer =
            roomOrPlayer;

    }


    const roomPlayer =
        roomPlayerById(
            room,
            playerId
        );


    if (!roomPlayer) {

        return {

            ok: false,

            error:
                "Игрок не найден."

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
                reason
            );


        if (
            externalPlayer
        ) {

            externalPlayer.roomId =
                null;

        }


        if (
            roomPlayer.externalPlayer
        ) {

            roomPlayer.externalPlayer.roomId =
                null;

        }


        roomPlayer.connected =
            false;

        roomPlayer.socketId =
            null;


        if (
            externalPlayer
        ) {

            externalPlayer.socketId =
                null;

            externalPlayer.connected =
                false;

        }


        return {

            ...result,

            ok:
                result.ok,

            room,

            finished:
                result.ok

        };

    }


    /*
    -----------------------------------------------------
    WAITING ROOM
    -----------------------------------------------------
    */

    if (
        room.status ===
        "waiting"
    ) {

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
            index !== -1
        ) {

            room.players.splice(
                index,
                1
            );

        }


        if (
            externalPlayer
        ) {

            externalPlayer.roomId =
                null;

            externalPlayer.socketId =
                null;

        }


        if (
            room.players.length === 0
        ) {

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
                true,

            finished:
                false

        };

    }


    /*
    -----------------------------------------------------
    ALREADY FINISHED
    -----------------------------------------------------
    */

    if (
        externalPlayer
    ) {

        externalPlayer.roomId =
            null;

    }


    return {

        ok: true,

        room,

        finished:
            room.status ===
            "finished"

    };

}


/*
=========================================================
FORFEIT PLAYER
=========================================================
*/

function forfeitPlayer(
    roomOrPlayer,
    playerId = null,
    reason = "leave"
) {

    const room =
        getRoom(
            roomOrPlayer
        );


    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    let actualPlayerId =
        playerId;


    if (
        typeof roomOrPlayer ===
        "object" &&
        roomOrPlayer.playerId
    ) {

        actualPlayerId =
            roomOrPlayer.playerId;

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
            actualPlayerId,
            reason
        );


    return {

        ...result,

        room

    };

}


/*
=========================================================
REMOVE PLAYER
=========================================================
*/

function removePlayer(
    roomOrId,
    playerId = null
) {

    const room =
        getRoom(
            roomOrId
        );


    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

        };

    }


    let actualPlayerId =
        playerId;


    if (
        typeof roomOrId ===
        "object" &&
        roomOrId.playerId
    ) {

        actualPlayerId =
            roomOrId.playerId;

    }


    const index =
        room.players.findIndex(
            player =>
                String(
                    player.playerId
                ) ===
                String(
                    actualPlayerId
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


    const removed =
        room.players.splice(
            index,
            1
        )[0];


    if (
        removed.externalPlayer
    ) {

        removed.externalPlayer.roomId =
            null;

    }


    if (
        room.players.length === 0
    ) {

        rooms.delete(
            room.id
        );

        return {

            ok: true,

            room:
                null,

            removed

        };

    }


    return {

        ok: true,

        room,

        removed

    };

}


/*
=========================================================
CLEAR ROOMS
=========================================================
*/

function clearRooms() {

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

            }

        }

    }


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

    const room =
        getRoom(
            roomId
        );


    if (!room) {

        return false;

    }


    for (
        const player
        of room.players
    ) {

        if (
            player.externalPlayer
        ) {

            player.externalPlayer.roomId =
                null;

        }

    }


    return rooms.delete(
        String(
            roomId
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
    Rooms
    */

    createRoom,

    getRoom,

    getRooms,

    getAllRooms,

    roomCount,

    hasRoom,


    /*
    Players
    */

    joinRoom,

    getRoomPlayer,

    getOtherPlayer,

    disconnectPlayer,

    reconnectPlayer,

    leaveRoom,

    forfeitPlayer,

    removePlayer,


    /*
    Game
    */

    getGameState,

    getPublicState,


    /*
    Lists
    */

    getRoomSummary,

    getWaitingRooms,

    getPublicRoomList,

    getPublicRooms,


    /*
    Maintenance
    */

    clearRooms,

    deleteRoom

};
