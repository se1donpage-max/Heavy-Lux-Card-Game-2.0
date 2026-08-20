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

        throw new Error(
            message
        );

    }

}


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
CLEAN START
=========================================================
*/

rooms.clearRooms();


assert(
    rooms.getRooms().length === 0,
    "Rooms are not empty before test"
);


console.log(
    "\n[1] Empty storage: OK"
);


/*
=========================================================
PLAYERS
=========================================================
*/

const player1 = {

    playerId:
        "player-1",

    name:
        "Player 1",

    socketId:
        "socket-1",

    roomId:
        null

};


const player2 = {

    playerId:
        "player-2",

    name:
        "Player 2",

    socketId:
        "socket-2",

    roomId:
        null

};


console.log(
    "[2] Players created: OK"
);


/*
=========================================================
CREATE ROOM
=========================================================
*/

const created =
    rooms.createRoom(
        player1,
        100
    );


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


assert(
    player1.roomId ===
    created.room.id,
    "Player 1 roomId was not assigned"
);


const roomId =
    created.room.id;


console.log(
    "[3] Room created:",
    roomId
);


/*
=========================================================
ROOM LOOKUP
=========================================================
*/

const room =
    rooms.getRoom(
        roomId
    );


assert(
    room,
    "Room lookup failed"
);


assert(
    room.id === roomId,
    "Room ID mismatch"
);


console.log(
    "[4] Room lookup: OK"
);


/*
=========================================================
WAITING ROOMS
=========================================================
*/

const waiting =
    rooms.getWaitingRooms();


assert(
    waiting.length === 1,
    "Expected one waiting room"
);


assert(
    waiting[0].id === roomId,
    "Waiting room ID mismatch"
);


console.log(
    "[5] Waiting rooms: OK"
);


/*
=========================================================
JOIN SECOND PLAYER
=========================================================
*/

const joined =
    rooms.joinRoom(
        player2,
        roomId
    );


assert(
    joined.ok,
    joined.error ||
    "Second player could not join"
);


assert(
    joined.room,
    "Joined room missing"
);


assert(
    joined.room.players.length === 2,
    "Room should contain two players"
);


assert(
    player2.roomId === roomId,
    "Player 2 roomId was not assigned"
);


assert(
    joined.started === true,
    "Game should start automatically"
);


assert(
    joined.room.status === "playing",
    "Room should be playing"
);


console.log(
    "[6] Second player joined: OK"
);


/*
=========================================================
GAME STATE
=========================================================
*/

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
    "[7] Game state: OK"
);


/*
=========================================================
ROOM PLAYER
=========================================================
*/

const roomPlayer =
    rooms.getRoomPlayer(
        player1
    );


assert(
    roomPlayer,
    "Room player lookup failed"
);


assert(
    roomPlayer.playerId ===
    "player-1",
    "Room player ID mismatch"
);


assert(
    roomPlayer.name ===
    "Player 1",
    "Room player name mismatch"
);


console.log(
    "[8] Room player lookup: OK"
);


/*
=========================================================
OTHER PLAYER
=========================================================
*/

const other =
    rooms.getOtherPlayer(
        room,
        "player-1"
    );


assert(
    other,
    "Other player not found"
);


assert(
    other.playerId ===
    "player-2",
    "Other player mismatch"
);


console.log(
    "[9] Other player lookup: OK"
);


/*
=========================================================
ROOM SUMMARY
=========================================================
*/

const summary =
    rooms.getRoomSummary(
        room
    );


assert(
    summary,
    "Room summary missing"
);


assert(
    summary.id === roomId,
    "Summary room ID mismatch"
);


assert(
    summary.playersCount === 2,
    "Summary player count mismatch"
);


assert(
    summary.maxPlayers === 2,
    "Summary max players mismatch"
);


assert(
    summary.stake === 100,
    "Summary stake mismatch"
);


console.log(
    "[10] Room summary: OK"
);


/*
=========================================================
PUBLIC ROOM LIST
=========================================================
*/

const publicRooms =
    rooms.getPublicRoomList();


assert(
    Array.isArray(
        publicRooms
    ),
    "Public room list is not an array"
);


/*
Игра уже началась,
поэтому waiting list должен быть пустым.
*/

assert(
    publicRooms.length === 0,
    "Playing room should not be in waiting list"
);


console.log(
    "[11] Public room list: OK"
);


/*
=========================================================
DISCONNECT
=========================================================
*/

const disconnected =
    rooms.disconnectPlayer(
        player1
    );


assert(
    disconnected.ok,
    disconnected.error ||
    "Disconnect failed"
);


assert(
    player1.socketId === null,
    "Player socket should be cleared"
);


const disconnectedRoomPlayer =
    rooms.getRoomPlayer(
        player1
    );


assert(
    disconnectedRoomPlayer,
    "Disconnected room player missing"
);


assert(
    disconnectedRoomPlayer.connected === false,
    "Room player should be disconnected"
);


console.log(
    "[12] Disconnect handling: OK"
);


/*
=========================================================
RECONNECT
=========================================================
*/

const reconnected =
    rooms.reconnectPlayer(
        player1,
        "socket-1-new"
    );


assert(
    reconnected.ok,
    reconnected.error ||
    "Reconnect failed"
);


assert(
    player1.socketId ===
    "socket-1-new",
    "Socket ID was not restored"
);


const reconnectedRoomPlayer =
    rooms.getRoomPlayer(
        player1
    );


assert(
    reconnectedRoomPlayer.connected === true,
    "Room player should be connected"
);


assert(
    reconnectedRoomPlayer.socketId ===
    "socket-1-new",
    "Room socket ID mismatch"
);


console.log(
    "[13] Reconnection: OK"
);


/*
=========================================================
LEAVE / FORFEIT
=========================================================
*/

const leaveResult =
    rooms.leaveRoom(
        player1,
        "test"
    );


assert(
    leaveResult.ok,
    leaveResult.error ||
    "Leave room failed"
);


assert(
    room.status ===
    "finished",
    "Leaving active game should finish it"
);


assert(
    room.winnerId ===
    "player-2",
    "Player 2 should win after forfeit"
);


assert(
    room.loserId ===
    "player-1",
    "Player 1 should lose after forfeit"
);


assert(
    player1.roomId === null,
    "Player 1 roomId should be cleared"
);


console.log(
    "[14] Forfeit handling: OK"
);


/*
=========================================================
CLEAR
=========================================================
*/

rooms.clearRooms();


assert(
    rooms.getRooms().length === 0,
    "Rooms were not cleared"
);


console.log(
    "[15] Clear rooms: OK"
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
