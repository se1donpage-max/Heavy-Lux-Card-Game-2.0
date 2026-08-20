"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE
=========================================================
*/

const {
    DECK_SIZE,
    MAX_PLAYERS,
    STARTING_HAND_SIZE,
    MAX_ATTACK_CARDS
} = require("../config");

const {
    createShuffledDeck,
    getTrumpSuit,
    canBeat
} = require("./cards");


/*
=========================================================
CREATE GAME STATE
=========================================================
*/

function createGameState({
    roomId,
    stake,
    players = []
}) {

    return {

        id:
            roomId,

        stake:
            Number(stake),

        pot:
            0,

        players,

        status:
            "waiting",

        phase:
            "waiting",

        deck: [],

        trumpSuit:
            null,

        attackerId:
            null,

        defenderId:
            null,

        roundMaxCards:
            0,

        table: [],

        moves: [],

        winnerId:
            null,

        loserId:
            null,

        settlement:
            null,

        createdAt:
            Date.now(),

        startedAt:
            null,

        finishedAt:
            null

    };

}


/*
=========================================================
CREATE PLAYER
=========================================================
*/

function createRoomPlayer({
    playerId,
    name,
    socketId = null,
    connected = true
}) {

    return {

        playerId,

        name:
            name || "",

        socketId,

        connected,

        hand: []

    };

}


/*
=========================================================
PLAYER LOOKUP
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
                String(player.playerId) ===
                String(playerId)
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
                String(player.playerId) !==
                String(playerId)
        ) ||
        null
    );

}


/*
=========================================================
FIND CARD
=========================================================
*/

function findCard(
    player,
    cardId
) {

    if (
        !player ||
        !Array.isArray(player.hand)
    ) {

        return null;

    }


    return (
        player.hand.find(
            card =>
                String(card.id) ===
                String(cardId)
        ) ||
        null
    );

}


/*
=========================================================
REMOVE CARD
=========================================================
*/

function removeCard(
    player,
    cardId
) {

    if (
        !player ||
        !Array.isArray(player.hand)
    ) {

        return null;

    }


    const index =
        player.hand.findIndex(
            card =>
                String(card.id) ===
                String(cardId)
        );


    if (
        index === -1
    ) {

        return null;

    }


    return player.hand.splice(
        index,
        1
    )[0];

}


/*
=========================================================
START GAME
=========================================================
*/

function startGame(
    room
) {

    if (!room) {

        return {

            ok: false,

            error:
                "Комната не найдена."

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


    room.deck =
        createShuffledDeck();


    room.table =
        [];

    room.moves =
        [];

    room.winnerId =
        null;

    room.loserId =
        null;

    room.settlement =
        null;


    /*
    -----------------------------------------------------
    RESET HANDS
    -----------------------------------------------------
    */

    for (
        const player
        of room.players
    ) {

        player.hand =
            [];

    }


    /*
    -----------------------------------------------------
    DEAL SIX EACH
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i <
            STARTING_HAND_SIZE;

        i++
    ) {

        for (
            const player
            of room.players
        ) {

            if (
                room.deck.length
            ) {

                player.hand.push(
                    room.deck.pop()
                );

            }

        }

    }


    /*
    -----------------------------------------------------
    TRUMP
    -----------------------------------------------------
    */

    room.trumpSuit =
        getTrumpSuit(
            room.deck
        );


    /*
    -----------------------------------------------------
    FIND LOWEST TRUMP
    -----------------------------------------------------
    */

    let attacker =
        null;

    let lowestTrump =
        null;


    for (
        const player
        of room.players
    ) {

        for (
            const card
            of player.hand
        ) {

            if (
                card.suit !==
                room.trumpSuit
            ) {

                continue;

            }


            if (
                !lowestTrump ||
                card.value <
                    lowestTrump.value
            ) {

                lowestTrump =
                    card;

                attacker =
                    player;

            }

        }

    }


    /*
    Если ни у кого нет козыря,
    используем первого игрока.
    */

    if (!attacker) {

        attacker =
            room.players[0];

    }


    const defender =
        otherPlayer(
            room,
            attacker.playerId
        );


    room.attackerId =
        attacker.playerId;

    room.defenderId =
        defender
            ? defender.playerId
            : null;


    room.status =
        "playing";

    room.phase =
        "attack";

    room.startedAt =
        Date.now();


    room.roundMaxCards =
        Math.min(

            MAX_ATTACK_CARDS,

            defender
                ? defender.hand.length
                : 0

        );


    return {

        ok: true

    };

}


/*
=========================================================
VALID ATTACK
=========================================================
*/

function validAttackCard(
    room,
    card
) {

    if (
        !room ||
        !card
    ) {

        return false;

    }


    if (
        room.table.length === 0
    ) {

        return true;

    }


    const values =
        new Set();


    for (
        const pair
        of room.table
    ) {

        if (pair.attack) {

            values.add(
                pair.attack.value
            );

        }

        if (pair.defense) {

            values.add(
                pair.defense.value
            );

        }

    }


    return values.has(
        card.value
    );

}


/*
=========================================================
ATTACK
=========================================================
*/

function attackCard(
    room,
    playerId,
    cardId
) {

    if (
        !room ||
        room.status !==
            "playing"
    ) {

        return {

            ok: false,

            error:
                "Игра не идёт."

        };

    }


    if (
        room.attackerId !==
        playerId
    ) {

        return {

            ok: false,

            error:
                "Сейчас ход противника."

        };

    }


    if (
        room.phase !==
            "attack"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя атаковать."

        };

    }


    if (
        room.table.length >=
        room.roundMaxCards
    ) {

        return {

            ok: false,

            error:
                "Достигнут максимум карт."

        };

    }


    const player =
        roomPlayerById(
            room,
            playerId
        );


    const card =
        findCard(
            player,
            cardId
        );


    if (!card) {

        return {

            ok: false,

            error:
                "Карта не найдена."

        };

    }


    if (
        !validAttackCard(
            room,
            card
        )
    ) {

        return {

            ok: false,

            error:
                "Эту карту нельзя подкинуть."

        };

    }


    removeCard(
        player,
        cardId
    );


    room.table.push({

        attack:
            card,

        defense:
            null

    });


    room.phase =
        "defense";


    return {

        ok: true

    };

}


/*
=========================================================
DEFENSE
=========================================================
*/

function defendCard(
    room,
    playerId,
    attackId,
    defenseId
) {

    if (
        !room ||
        room.status !==
            "playing"
    ) {

        return {

            ok: false,

            error:
                "Игра не идёт."

        };

    }


    if (
        room.phase !==
        "defense"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя отбиваться."

        };

    }


    if (
        room.defenderId !==
        playerId
    ) {

        return {

            ok: false,

            error:
                "Сейчас ход противника."

        };

    }


    const pair =
        room.table.find(
            item =>
                item.attack &&
                String(
                    item.attack.id
                ) ===
                    String(
                        attackId
                    ) &&
                !item.defense
        );


    if (!pair) {

        return {

            ok: false,

            error:
                "Карта атаки не найдена."

        };

    }


    const player =
        roomPlayerById(
            room,
            playerId
        );


    const defense =
        findCard(
            player,
            defenseId
        );


    if (!defense) {

        return {

            ok: false,

            error:
                "Карта не найдена."

        };

    }


    if (
        !canBeat(
            pair.attack,
            defense,
            room.trumpSuit
        )
    ) {

        return {

            ok: false,

            error:
                "Этой картой нельзя отбиться."

        };

    }


    removeCard(
        player,
        defenseId
    );


    pair.defense =
        defense;


    const allDefended =
        room.table.every(
            item =>
                Boolean(
                    item.defense
                )
        );


    if (
        allDefended
    ) {

        room.phase =
            "bito";

    }


    return {

        ok: true

    };

}


/*
=========================================================
TAKE
=========================================================
*/

function takeCards(
    room,
    playerId
) {

    if (
        !room ||
        room.status !==
            "playing"
    ) {

        return {

            ok: false,

            error:
                "Игра не идёт."

        };

    }


    if (
        room.defenderId !==
        playerId
    ) {

        return {

            ok: false,

            error:
                "Только защитник может взять карты."

        };

    }


    if (
        room.phase !==
        "defense"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя взять карты."

        };

    }


    const defender =
        roomPlayerById(
            room,
            playerId
        );


    const hasUnbeaten =
        room.table.some(
            pair =>
                !pair.defense
        );


    if (!hasUnbeaten) {

        return {

            ok: false,

            error:
                "Все карты отбиты. Нажмите БИТО."

        };

    }


    for (
        const pair
        of room.table
    ) {

        if (pair.attack) {

            defender.hand.push(
                pair.attack
            );

        }

        if (pair.defense) {

            defender.hand.push(
                pair.defense
            );

        }

    }


    room.table =
        [];

    room.phase =
        "draw";


    drawCards(
        room
    );


    if (
        checkGameOver(room)
    ) {

        return {

            ok: true,

            gameOver:
                true

        };

    }


    room.roundMaxCards =
        Math.min(

            MAX_ATTACK_CARDS,

            defender.hand.length

        );


    room.phase =
        "attack";


    return {

        ok: true,

        gameOver:
            false

    };

}


/*
=========================================================
BITO
=========================================================
*/

function bito(
    room,
    playerId
) {

    if (
        !room ||
        room.status !==
            "playing"
    ) {

        return {

            ok: false,

            error:
                "Игра не идёт."

        };

    }


    if (
        room.phase !==
        "bito"
    ) {

        return {

            ok: false,

            error:
                "Нельзя нажать БИТО."

        };

    }


    if (
        room.attackerId !==
        playerId
    ) {

        return {

            ok: false,

            error:
                "Неверный игрок."

        };

    }


    const allDefended =
        room.table.length > 0 &&
        room.table.every(
            pair =>
                Boolean(
                    pair.defense
                )
        );


    if (!allDefended) {

        return {

            ok: false,

            error:
                "Не все карты отбиты."

        };

    }


    room.table =
        [];


    const oldAttacker =
        room.attackerId;

    room.attackerId =
        room.defenderId;

    room.defenderId =
        oldAttacker;


    room.phase =
        "draw";


    drawCards(
        room
    );


    if (
        checkGameOver(room)
    ) {

        return {

            ok: true,

            gameOver:
                true

        };

    }


    const defender =
        roomPlayerById(
            room,
            room.defenderId
        );


    room.roundMaxCards =
        Math.min(

            MAX_ATTACK_CARDS,

            defender
                ? defender.hand.length
                : 0

        );


    room.phase =
        "attack";


    return {

        ok: true,

        gameOver:
            false

    };

}


/*
=========================================================
DRAW
=========================================================
*/

function drawCards(
    room
) {

    if (
        !room ||
        !room.deck.length
    ) {

        return;

    }


    const attacker =
        roomPlayerById(
            room,
            room.attackerId
        );

    const defender =
        roomPlayerById(
            room,
            room.defenderId
        );


    for (
        const player
        of [
            attacker,
            defender
        ]
    ) {

        if (!player) {
            continue;
        }


        while (
            player.hand.length <
                STARTING_HAND_SIZE &&
            room.deck.length > 0
        ) {

            player.hand.push(
                room.deck.pop()
            );

        }

    }

}


/*
=========================================================
GAME OVER
=========================================================
*/

function checkGameOver(
    room
) {

    if (
        !room ||
        room.deck.length > 0
    ) {

        return false;

    }


    const empty =
        room.players.filter(
            player =>
                player.hand.length === 0
        );


    if (
        empty.length === 2
    ) {

        finishGame(
            room,
            null,
            null,
            "draw"
        );

        return true;

    }


    if (
        empty.length === 1
    ) {

        const winner =
            empty[0];

        const loser =
            otherPlayer(
                room,
                winner.playerId
            );


        finishGame(

            room,

            winner.playerId,

            loser
                ? loser.playerId
                : null,

            "win"

        );

        return true;

    }


    return false;

}


/*
=========================================================
FINISH
=========================================================
*/

function finishGame(
    room,
    winnerId,
    loserId,
    settlement
) {

    room.status =
        "finished";

    room.phase =
        "finished";

    room.winnerId =
        winnerId;

    room.loserId =
        loserId;

    room.settlement =
        settlement;

    room.finishedAt =
        Date.now();

}


/*
=========================================================
FORFEIT
=========================================================
*/

function finishByForfeit(
    room,
    loserId,
    reason = "leave"
) {

    const winner =
        otherPlayer(
            room,
            loserId
        );


    if (!winner) {

        return {

            ok: false,

            error:
                "Победитель не найден."

        };

    }


    finishGame(

        room,

        winner.playerId,

        loserId,

        "forfeit"

    );


    return {

        ok: true,

        winnerId:
            winner.playerId,

        loserId,

        reason

    };

}


/*
=========================================================
PUBLIC STATE
=========================================================
*/

function getPublicGameState(
    room,
    playerId
) {

    const self =
        roomPlayerById(
            room,
            playerId
        );

    const opponent =
        otherPlayer(
            room,
            playerId
        );


    return {

        roomId:
            room.id,

        stake:
            room.stake,

        status:
            room.status,

        phase:
            room.phase,

        trumpSuit:
            room.trumpSuit,

        attackerId:
            room.attackerId,

        defenderId:
            room.defenderId,

        deckCount:
            room.deck.length,

        hand:
            self
                ? self.hand
                : [],

        handCount:
            self
                ? self.hand.length
                : 0,

        opponent:
            opponent
                ? {

                    playerId:
                        opponent.playerId,

                    name:
                        opponent.name,

                    handCount:
                        opponent.hand.length

                }
                : null,

        table:
            room.table,

        winnerId:
            room.winnerId,

        loserId:
            room.loserId,

        settlement:
            room.settlement

    };

}


/*
=========================================================
CONFIG CHECK
=========================================================
*/

if (
    DECK_SIZE !== 36 ||
    MAX_PLAYERS !== 2 ||
    STARTING_HAND_SIZE !== 6 ||
    MAX_ATTACK_CARDS !== 6
) {

    throw new Error(
        "Invalid Heavy Lux game configuration"
    );

}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    createGameState,

    createRoomPlayer,

    startGame,

    attackCard,

    defendCard,

    takeCards,

    bito,

    drawCards,

    checkGameOver,

    finishGame,

    finishByForfeit,

    roomPlayerById,

    otherPlayer,

    findCard,

    removeCard,

    validAttackCard,

    getPublicGameState

};
