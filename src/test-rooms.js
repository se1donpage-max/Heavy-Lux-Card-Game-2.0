"use strict";

/*
=========================================================
HEAVY LUX CARD
ROOMS SMOKE TEST
=========================================================
*/

const rooms = require("./game/rooms");


function assert(
    condition,
    message
) {

    if (!condition) {
        throw new Error(message);
    }

}


/*
=========================================================
START
=========================================================
*/

console.log(
    "================================"
);

console.log(
    "HEAVY LUX ROOMS SMOKE TEST"
);

console.log(
    "================================"
);


/*
=========================================================
CLEAN
=========================================================
*/

rooms.clearRooms();


assert(
    rooms.roomCount() === 0,
    "Rooms are not empty before test"
);

console.log(
    "\n[1] Empty storage: OK"
);


/*
=========================================================
CREATE ROOM
=========================================================
*/

const created =
    rooms.createRoom({

        playerId:
            "player-1",

        name:
            "Player 1",

        socketId:
            "socket-1",

        stake:
            100

    });


assert(
    created.ok,
    created.error ||
    "Room creation failed"
);


assert(
    created.room,
    "Room object missing"
);


assert(
    created.room.players.length === 1,
    "Room should contain one player"
);


assert(
    created.room.status === "waiting",
    "New room should be waiting"
);


const roomId =
    created.room.id;


console.log(
    "[2] Room created:",
    roomId
);


/*
=========================================================
DUPLICATE PLAYER
=========================================================
*/

const duplicate =
    rooms.createRoom({

        playerId:
            "player-1",

        name:
            "Player 1",

        socketId:
            "socket-duplicate",

        stake:
            100

    });


assert(
    !duplicate.ok,
    "Duplicate player should be rejected"
);


console.log(
    "[3] Duplicate player protection: OK"
);


/*
=========================================================
JOIN SECOND PLAYER
=========================================================
*/

const joined =
    rooms.joinRoom({

        roomId,

        playerId:
            "player-2",

        name:
            "Player 2",

        socketId:
            "socket-2"

    });


assert(
    joined.ok,
    joined.error ||
    "Second player could not join"
);


assert(
    joined.room.players.length === 2,
    "Room should contain two players"
);


assert(
    joined.gameStarted === true,
    "Game should start automatically"
);


assert(
    joined.room.status === "playing",
    "Room should be playing"
);


console.log(
    "[4] Second player joined: OK"
);


/*
=========================================================
GAME STATE
=========================================================
*/

const room =
    rooms.getRoom(
        roomId
    );


assert(
    room,
    "Room disappeared after starting"
);


assert(
    room.players.length === 2,
    "Game must have two players"
);


assert(
    room.players[0].hand.length === 6,
    "Player 1 must have six cards"
);


assert(
    room.players[1].hand.length === 6,
    "Player 2 must have six cards"
);


assert(
    room.deck.length === 24,
    "Deck must contain 24 cards"
);


assert(
    room.trumpSuit,
    "Trump suit is missing"
);


assert(
    room.attackerId,
    "Attacker is missing"
);


assert(
    room.defenderId,
    "Defender is missing"
);


console.log(
    "[5] Game state: OK"
);


/*
=========================================================
PUBLIC ROOM STATE
=========================================================
*/

const publicState =
    rooms.getPublicRoom(
        room,
        "player-1"
    );


assert(
    publicState,
    "Public room state missing"
);


assert(
    publicState.roomId === roomId,
    "Public room ID mismatch"
);


assert(
    publicState.players.length === 2,
    "Public state should contain two players"
);


assert(
    publicState.game,
    "Public game state missing"
);


assert(
    publicState.game.hand.length === 6,
    "Public hand should contain six cards"
);


console.log(
    "[6] Public room state: OK"
);


/*
=========================================================
SOCKET LOOKUP
=========================================================
*/

const socketRoom =
    rooms.findRoomBySocket(
        "socket-1"
    );


assert(
    socketRoom,
    "Room not found by socket"
);


assert(
    socketRoom.id === roomId,
    "Socket room mismatch"
);


console.log(
    "[7] Socket lookup: OK"
);


/*
=========================================================
PLAYER LOOKUP
=========================================================
*/

const player =
    rooms.getPlayer(
        roomId,
        "player-1"
    );


assert(
    player,
    "Player lookup failed"
);


assert(
    player.name === "Player 1",
    "Player name mismatch"
);


console.log(
    "[8] Player lookup: OK"
);


/*
=========================================================
DISCONNECT
=========================================================
*/

const disconnected =
    rooms.disconnectPlayer(
        roomId,
        "player-1"
    );


assert(
    disconnected.ok,
    disconnected.error ||
    "Disconnect failed"
);


assert(
    player.connected === false,
    "Player should be disconnected"
);


assert(
    player.disconnectedAt,
    "Disconnect timestamp missing"
);


assert(
    room.status === "playing",
    "Game should remain active after disconnect"
);


console.log(
    "[9] Disconnect handling: OK"
);


/*
=========================================================
RECONNECT
=========================================================
*/

const reconnected =
    rooms.reconnectPlayer({

        roomId,

        playerId:
            "player-1",

        socketId:
            "socket-1-new",

        name:
            "Player 1"

    });


assert(
    reconnected.ok,
    reconnected.error ||
    "Reconnect failed"
);


assert(
    player.connected === true,
    "Player should be connected"
);


assert(
    player.socketId === "socket-1-new",
    "Socket ID was not updated"
);


assert(
    player.disconnectedAt === null,
    "Disconnect timestamp should be cleared"
);


assert(
    reconnected.gameState,
    "Reconnect game state missing"
);


console.log(
    "[10] Reconnection: OK"
);


/*
=========================================================
ROOM LIST
=========================================================
*/

const list =
    rooms.listRooms();


assert(
    Array.isArray(list),
    "Room list is not an array"
);


assert(
    list.length === 1,
    "Expected exactly one room"
);


assert(
    list[0].roomId === roomId,
    "Room list ID mismatch"
);


assert(
    list[0].players === 2,
    "Room list player count mismatch"
);


console.log(
    "[11] Room list: OK"
);


/*
=========================================================
REMOVE / FINISH
=========================================================
*/

const removed =
    rooms.removePlayer(
        roomId,
        "player-1",
        {
            forfeit:
                true
        }
    );


assert(
    removed.ok,
    removed.error ||
    "Player removal failed"
);


assert(
    room.status === "finished",
    "Forfeit should finish the game"
);


assert(
    room.winnerId === "player-2",
    "Remaining player should be winner"
);


assert(
    room.loserId === "player-1",
    "Removed player should be loser"
);


console.log(
    "[12] Forfeit handling: OK"
);


/*
=========================================================
CLEAR
=========================================================
*/

rooms.clearRooms();


assert(
    rooms.roomCount() === 0,
    "Rooms were not cleared"
);


console.log(
    "[13] Clear rooms: OK"
);


/*
=========================================================
SUCCESS
=========================================================
*/

console.log(
    "\n================================"
);

console.log(
    "ROOMS SMOKE TEST PASSED"
);

console.log(
    "================================"
);
