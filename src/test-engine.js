"use strict";

const config = require("./config");
const cards = require("./game/cards");
const engine = require("./game/engine");

console.log("=== HEAVY LUX ENGINE SMOKE TEST ===");

console.log("\n[1] CONFIG");

console.log("DECK_SIZE:", config.DECK_SIZE);
console.log("MAX_PLAYERS:", config.MAX_PLAYERS);
console.log("STARTING_HAND_SIZE:", config.STARTING_HAND_SIZE);
console.log("MAX_ATTACK_CARDS:", config.MAX_ATTACK_CARDS);

if (config.DECK_SIZE !== 36) {
    throw new Error("DECK_SIZE != 36");
}

if (config.MAX_PLAYERS !== 2) {
    throw new Error("MAX_PLAYERS != 2");
}

if (config.STARTING_HAND_SIZE !== 6) {
    throw new Error("STARTING_HAND_SIZE != 6");
}

if (config.MAX_ATTACK_CARDS !== 6) {
    throw new Error("MAX_ATTACK_CARDS != 6");
}


console.log("\n[2] CARDS");

const deck = cards.createDeck();

console.log("Deck:", deck.length);

if (deck.length !== 36) {
    throw new Error(
        `Expected 36 cards, got ${deck.length}`
    );
}

if (!cards.isValidDeck(deck)) {
    throw new Error(
        "Deck validation failed"
    );
}

const shuffled =
    cards.createShuffledDeck();

if (shuffled.length !== 36) {
    throw new Error(
        "Shuffled deck length != 36"
    );
}

console.log(
    "Deck validation: OK"
);

console.log(
    "Shuffled deck: OK"
);


console.log("\n[3] PLAYERS");

const player1 =
    engine.createRoomPlayer({
        playerId: "player-1",
        name: "Player 1"
    });

const player2 =
    engine.createRoomPlayer({
        playerId: "player-2",
        name: "Player 2"
    });

console.log(
    "Players created: OK"
);


console.log("\n[4] GAME STATE");

const room =
    engine.createGameState({
        roomId: "TEST01",
        stake: 100,
        players: [
            player1,
            player2
        ]
    });

if (!room) {
    throw new Error(
        "Game state was not created"
    );
}

console.log(
    "Room created:",
    room.id
);


console.log("\n[5] START GAME");

const start =
    engine.startGame(room);

if (!start.ok) {
    throw new Error(
        start.error ||
        "startGame failed"
    );
}

console.log(
    "Game started: OK"
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
    player1.hand.length
);

console.log(
    "Player 2 cards:",
    player2.hand.length
);

console.log(
    "Deck remaining:",
    room.deck.length
);


if (player1.hand.length !== 6) {
    throw new Error(
        "Player 1 does not have 6 cards"
    );
}

if (player2.hand.length !== 6) {
    throw new Error(
        "Player 2 does not have 6 cards"
    );
}

if (room.deck.length !== 24) {
    throw new Error(
        `Expected 24 cards, got ${room.deck.length}`
    );
}

if (!room.trumpSuit) {
    throw new Error(
        "Trump suit is missing"
    );
}

if (!room.attackerId) {
    throw new Error(
        "Attacker is missing"
    );
}

if (!room.defenderId) {
    throw new Error(
        "Defender is missing"
    );
}


console.log("\n[6] PUBLIC STATE");

const publicState =
    engine.getPublicGameState(
        room,
        room.attackerId
    );

if (!publicState) {
    throw new Error(
        "Public state was not generated"
    );
}

console.log(
    "Public state: OK"
);


console.log("\n================================");
console.log("SMOKE TEST PASSED");
console.log("================================");
