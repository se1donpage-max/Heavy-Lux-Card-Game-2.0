"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE
=========================================================

Источник игровой механики:
Heavy-Lux-Card-Game-main/server.js

ENGINE НЕ отвечает за:

- Socket.IO
- PostgreSQL
- Telegram
- баланс
- резервирование денег
- settlement
- XP

ENGINE отвечает только за состояние и механику игры.
=========================================================
*/

const {
    DECK_SIZE,
    MAX_PLAYERS,
    STARTING_HAND_SIZE,
    MAX_ATTACK_CARDS,
    SUITS,
    RANKS,
    VALUES
} = require("../config");

const {
    createShuffledDeck,
    canBeat: cardCanBeat,
    getTrumpSuit
} = require("./cards");


/*
=========================================================
CREATE ROOM GAME STATE
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

        stakesReserved:
            false,

        settled:
            false,

        settlement:
            null,

        payout:
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
CREATE ROOM PLAYER
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
        ) || null
    );

}


/*
=========================================================
ROOM PLAYER
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
        ) || null
    );

}


/*
=========================================================
CARD FIND
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
        ) || null
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

    if (index === -1) {
        return null;
    }

    return player.hand.splice(
        index,
        1
    )[0];

}


/*
=========================================================
CARD LABEL
=========================================================
*/

function cardLabel(
    card
) {

    if (!card) {
        return "";
    }

    return `${card.rank}${card.suit}`;

}


/*
=========================================================
CAN BEAT
=========================================================
*/

function canBeat(
    attackCard,
    defenseCard,
    trumpSuit
) {

    return cardCanBeat(
        attackCard,
        defenseCard,
        trumpSuit
    );

}


/*
=========================================================
VALID ATTACK CARD
=========================================================
*/

function validAttackCard(
    room,
    card
) {

    if (!room || !card) {
        return false;
    }


    /*
    -----------------------------------------------------
    FIRST ATTACK
    -----------------------------------------------------
    */

    if (
        room.table.length === 0
    ) {

        return true;

    }


    /*
    -----------------------------------------------------
    ALL RANKS ALREADY ON TABLE
    -----------------------------------------------------
    */

    const allowedValues =
        new Set();


    for (
        const pair
        of room.table
    ) {

        if (pair.attack) {

            allowedValues.add(
                pair.attack.value
            );

        }

        if (pair.defense) {

            allowedValues.add(
                pair.defense.value
            );

        }

    }


    return allowedValues.has(
        card.value
    );

}


/*
=========================================================
MAX TABLE CARDS
=========================================================
*/

function maxTableCards(
    room
) {

    return Math.max(

        0,

        Math.min(

            MAX_ATTACK_CARDS,

            Number(
                room.roundMaxCards || 0
            )

        )

    );

}


/*
=========================================================
START NEW ATTACK ROUND
=========================================================
*/

function startNewAttackRound(
    room
) {

    const defender =
        roomPlayerById(
            room,
            room.defenderId
        );

    if (!defender) {

        room.roundMaxCards =
            0;

        return;

    }


    room.roundMaxCards =
        Math.min(
            MAX_ATTACK_CARDS,
            defender.hand.length
        );

}


/*
=========================================================
START GAME
=========================================================
*/

function startGame(
    room
) {

    if (
        !room ||
        room.players.length !==
            MAX_PLAYERS
    ) {

        return {

            ok: false,

            error:
                "Для начала нужны два игрока."

        };

    }


    room.status =
        "playing";

    room.phase =
        "attack";

    room.startedAt =
        Date.now();

    room.finishedAt =
        null;

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

    room.settled =
        false;

    room.settlement =
        null;

    room.payout =
        0;


    /*
    -----------------------------------------------------
    RESET HANDS
    -----------------------------------------------------
    */

    room.players.forEach(
        player => {

            player.hand =
                [];

            player.connected =
                true;

        }
    );


    /*
    -----------------------------------------------------
    DEAL
    -----------------------------------------------------

    Original server:
    по одной карте каждому игроку
    до 6 карт.
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i < STARTING_HAND_SIZE;

        i++
    ) {

        for (
            const player
            of room.players
        ) {

            if (
                room.deck.length > 0
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
    FIRST ATTACKER
    -----------------------------------------------------

    Игрок с младшим козырем.
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
    Если козырей на руках нет,
    сохраняем поведение архива:
    начинает первый игрок.
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


    startNewAttackRound(
        room
    );


    room.moves.push({

        type:
            "game_start",

        playerId:
            attacker.playerId,

        timestamp:
            Date.now()

    });


    return {

        ok: true

    };

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


    if (
        room.phase !==
            "attack" &&
        room.phase !==
            "bito"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя атаковать."

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


    const maxCards =
        maxTableCards(
            room
        );


    if (
        room.table.length >=
        maxCards
    ) {

        return {

            ok: false,

            error:
                "Достигнут максимум карт на столе."

        };

    }


    /*
    Предыдущая карта должна быть отбита
    перед новым подкидыванием.
    */

    if (
        room.table.length > 0 &&
        room.table.some(
            pair =>
                !pair.defense
        )
    ) {

        return {

            ok: false,

            error:
                "Сначала нужно отбить предыдущую карту."

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
                "Этой карты нет у вас."

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
                "Такую карту нельзя подкинуть."

        };

    }


    const removed =
        removeCard(
            player,
            cardId
        );


    if (!removed) {

        return {

            ok: false,

            error:
                "Не удалось взять карту из руки."

        };

    }


    room.table.push({

        attack:
            removed,

        defense:
            null

    });


    room.phase =
        "defense";


    room.moves.push({

        type:
            "attack",

        playerId,

        card:
            cardLabel(
                removed
            ),

        timestamp:
            Date.now()

    });


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
                item.attack.id ===
                    attackId &&
                !item.defense
        );


    if (!pair) {

        return {

            ok: false,

            error:
                "Эта карта уже отбита или не существует."

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
                "Этой карты нет у вас."

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
                "Этой картой нельзя отбить."

        };

    }


    const removed =
        removeCard(
            player,
            defenseId
        );


    if (!removed) {

        return {

            ok: false,

            error:
                "Не удалось взять карту из руки."

        };

    }


    pair.defense =
        removed;


    room.moves.push({

        type:
            "defend",

        playerId,

        attack:
            cardLabel(
                pair.attack
            ),

        card:
            cardLabel(
                removed
            ),

        timestamp:
            Date.now()

    });


    const allDefended =
        room.table.length > 0 &&
        room.table.every(
            item =>
                !!item.defense
        );


    room.phase =
        allDefended
            ? "bito"
            : "defense";


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


    if (
        room.phase !==
        "defense"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя брать карты."

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


    const defender =
        roomPlayerById(
            room,
            playerId
        );


    if (!defender) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


    let takenCount =
        0;


    for (
        const pair
        of room.table
    ) {

        if (pair.attack) {

            defender.hand.push(
                pair.attack
            );

            takenCount++;

        }


        if (pair.defense) {

            defender.hand.push(
                pair.defense
            );

            takenCount++;

        }

    }


    room.moves.push({

        type:
            "take",

        playerId,

        cards:
            takenCount,

        timestamp:
            Date.now()

    });


    room.table =
        [];


    /*
    После взятия атакующий
    остаётся атакующим.
    */

    room.phase =
        "draw";


    drawCards(
        room
    );


    const gameOver =
        checkGameOver(
            room
        );


    if (gameOver) {

        return {

            ok: true,

            gameOver: true

        };

    }


    startNewAttackRound(
        room
    );


    room.phase =
        "attack";


    return {

        ok: true,

        gameOver: false

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


    if (
        room.phase !==
        "bito"
    ) {

        return {

            ok: false,

            error:
                "Пока нельзя нажать БИТО."

        };

    }


    if (
        room.attackerId !==
        playerId
    ) {

        return {

            ok: false,

            error:
                "Только атакующий может нажать БИТО."

        };

    }


    const allDefended =
        room.table.length > 0 &&
        room.table.every(
            pair =>
                !!pair.defense
        );


    if (!allDefended) {

        return {

            ok: false,

            error:
                "Не все карты отбиты."

        };

    }


    room.moves.push({

        type:
            "bito",

        playerId,

        timestamp:
            Date.now()

    });


    room.table =
        [];


    const oldAttacker =
        room.attackerId;

    const oldDefender =
        room.defenderId;


    room.attackerId =
        oldDefender;

    room.defenderId =
        oldAttacker;


    room.phase =
        "draw";


    drawCards(
        room
    );


    const gameOver =
        checkGameOver(
            room
        );


    if (gameOver) {

        return {

            ok: true,

            gameOver: true

        };

    }


    startNewAttackRound(
        room
    );


    room.phase =
        "attack";


    return {

        ok: true,

        gameOver: false

    };

}


/*
=========================================================
DRAW CARDS
=========================================================
*/

function drawCards(
    room
) {

    if (
        !room ||
        room.deck.length === 0
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


    /*
    В оригинале:
    сначала атакующий,
    затем защитник.
    */

    const order = [

        attacker,

        defender

    ];


    for (
        const player
        of order
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
CHECK GAME OVER
=========================================================
*/

function checkGameOver(
    room
) {

    if (!room) {
        return false;
    }


    /*
    Пока колода не закончилась,
    пустая рука не означает победу.
    */

    if (
        room.deck.length > 0
    ) {

        return false;

    }


    const emptyPlayers =
        room.players.filter(
            player =>
                player.hand.length === 0
        );


    /*
    -----------------------------------------------------
    DRAW
    -----------------------------------------------------
    */

    if (
        emptyPlayers.length === 2
    ) {

        finishGame(
            room,
            null,
            null,
            "draw"
        );

        return true;

    }


    /*
    -----------------------------------------------------
    WINNER
    -----------------------------------------------------
    */

    if (
        emptyPlayers.length === 1
    ) {

        const winner =
            emptyPlayers[0];

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
FINISH GAME
=========================================================
*/

function finishGame(
    room,
    winnerId,
    loserId,
    settlementType
) {

    room.status =
        "finished";

    room.phase =
        "finished";

    room.winnerId =
        winnerId || null;

    room.loserId =
        loserId || null;

    room.attackerId =
        null;

    room.defenderId =
        null;

    room.finishedAt =
        Date.now();


    room.settlement =
        settlementType;

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


    room.moves.push({

        type:
            "forfeit",

        playerId:
            loserId,

        reason,

        timestamp:
            Date.now()

    });


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

        loserId

    };

}


/*
=========================================================
ROOM SERIALIZATION
=========================================================
*/

function getPublicGameState(
    room,
    playerId
) {

    if (!room) {
        return null;
    }


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

        pot:
            room.pot,

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

        roundMaxCards:
            room.roundMaxCards,

        table:
            room.table.map(
                pair => ({

                    attack:
                        pair.attack
                            ? {
                                id:
                                    pair.attack.id,

                                suit:
                                    pair.attack.suit,

                                rank:
                                    pair.attack.rank,

                                value:
                                    pair.attack.value
                            }
                            : null,

                    defense:
                        pair.defense
                            ? {
                                id:
                                    pair.defense.id,

                                suit:
                                    pair.defense.suit,

                                rank:
                                    pair.defense.rank,

                                value:
                                    pair.defense.value
                            }
                            : null

                })
            ),

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

        deckCount:
            room.deck.length,

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
VALIDATE ENGINE CONFIG
=========================================================
*/

function validateEngineConfig() {

    if (
        SUITS.length !== 4
    ) {

        throw new Error(
            "Durak requires 4 suits."
        );

    }


    if (
        RANKS.length !== 9
    ) {

        throw new Error(
            "Durak 36 requires 9 ranks."
        );

    }


    if (
        DECK_SIZE !== 36
    ) {

        throw new Error(
            "Durak deck must contain 36 cards."
        );

    }

}


/*
=========================================================
STARTUP
=========================================================
*/

validateEngineConfig();


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    createGameState,

    createRoomPlayer,

    startGame,

    startNewAttackRound,

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

    maxTableCards,

    canBeat,

    getPublicGameState

};
