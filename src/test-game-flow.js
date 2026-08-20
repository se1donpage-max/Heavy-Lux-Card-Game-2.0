"use strict";

/*
=========================================================
HEAVY LUX CARD
FULL GAME FLOW SMOKE TEST
=========================================================
*/

const rooms = require("./game/rooms");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

console.log("================================");
console.log("HEAVY LUX FULL GAME FLOW TEST");
console.log("================================");

rooms.clearRooms();

const player1 = {
    playerId: "flow-player-1",
    name: "Flow Player 1",
    socketId: "flow-socket-1",
    roomId: null
};

const player2 = {
    playerId: "flow-player-2",
    name: "Flow Player 2",
    socketId: "flow-socket-2",
    roomId: null
};


/*
=========================================================
1. CREATE ROOM
=========================================================
*/

const created = rooms.createRoom(
    player1,
    100
);

assert(
    created.ok,
    created.error || "Room creation failed"
);

assert(
    created.room,
    "Created room is missing"
);

const roomId = created.room.id;

console.log(
    "[1] Room created:",
    roomId
);


/*
=========================================================
2. JOIN PLAYER 2
=========================================================
*/

const joined = rooms.joinRoom(
    player2,
    roomId
);

assert(
    joined.ok,
    joined.error || "Player 2 could not join"
);

assert(
    joined.started === true,
    "Game did not start"
);

const room = rooms.getRoom(roomId);

assert(
    room,
    "Room disappeared after game start"
);

assert(
    room.status === "playing",
    "Room is not playing"
);

console.log(
    "[2] Game started: OK"
);


/*
=========================================================
3. INITIAL GAME STATE
=========================================================
*/

assert(
    room.players.length === 2,
    "Game must contain two players"
);

assert(
    room.players[0].hand.length === 6,
    "Player 1 should have six cards"
);

assert(
    room.players[1].hand.length === 6,
    "Player 2 should have six cards"
);

assert(
    room.deck.length === 24,
    "Deck should contain 24 cards"
);

assert(
    room.trumpSuit,
    "Trump suit missing"
);

assert(
    room.attackerId,
    "Attacker missing"
);

assert(
    room.defenderId,
    "Defender missing"
);

console.log("[3] Initial state: OK");


/*
=========================================================
4. CHECK ENGINE API
=========================================================
*/

const engine = room.engine;

assert(
    engine,
    "Room engine is missing"
);

console.log(
    "[4] Engine attached: OK"
);


/*
=========================================================
5. PUBLIC STATE
=========================================================
*/

const publicState =
    rooms.getPublicState(
        room,
        player1.playerId
    );

assert(
    publicState,
    "Public state missing"
);

assert(
    publicState.roomId === room.id,
    "Public state room ID mismatch"
);

assert(
    Array.isArray(publicState.hand),
    "Public hand is not an array"
);

assert(
    publicState.hand.length === 6,
    "Public hand should contain six cards"
);

console.log(
    "[5] Public state: OK"
);


/*
=========================================================
6. ATTACKER / DEFENDER
=========================================================
*/

const attacker =
    room.players.find(
        player =>
            player.playerId === room.attackerId
    );

const defender =
    room.players.find(
        player =>
            player.playerId === room.defenderId
    );

assert(
    attacker,
    "Attacker player object missing"
);

assert(
    defender,
    "Defender player object missing"
);

assert(
    attacker.playerId !== defender.playerId,
    "Attacker and defender must be different"
);

console.log(
    "[6] Roles: OK"
);


/*
=========================================================
7. FIND VALID ATTACK CARD
=========================================================
*/

let attackCard = null;

if (
    Array.isArray(attacker.hand) &&
    attacker.hand.length > 0
) {
    attackCard = attacker.hand[0];
}

assert(
    attackCard,
    "Could not find attack card"
);

console.log(
    "[7] Attack card found:",
    attackCard
);


/*
=========================================================
8. ENGINE METHOD DISCOVERY
=========================================================
*/

const engineMethods = Object.keys(
    engine
).filter(
    key =>
        typeof engine[key] === "function"
);

console.log(
    "[8] Engine methods:",
    engineMethods.join(", ")
);


/*
=========================================================
9. BASIC ROOM INTEGRITY
=========================================================
*/

assert(
    room.attackerId === attacker.playerId,
    "Attacker ID mismatch"
);

assert(
    room.defenderId === defender.playerId,
    "Defender ID mismatch"
);

assert(
    room.players.every(
        player =>
            Array.isArray(player.hand)
    ),
    "Every player must have a hand"
);

console.log(
    "[9] Room integrity: OK"
);


/*
=========================================================
10. FINAL SNAPSHOT
=========================================================
*/

console.log("\nGAME SNAPSHOT");

console.log(
    "Room:",
    room.id
);

console.log(
    "Status:",
    room.status
);

console.log(
    "Trump:",
    room.trumpSuit
);

console.log(
    "Attacker:",
    room.attackerId
);

console.log(
    "Defender:",
    room.defenderId
);

console.log(
    "Player 1 cards:",
    attacker.hand.length
);

console.log(
    "Player 2 cards:",
    defender.hand.length
);

console.log(
    "Deck:",
    room.deck.length
);


/*
=========================================================
SUCCESS
=========================================================
*/

rooms.clearRooms();

console.log("\n================================");
console.log("FULL GAME FLOW TEST PASSED");
console.log("================================");
