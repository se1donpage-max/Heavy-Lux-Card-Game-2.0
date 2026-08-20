"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE
DURAK 36
=========================================================

PURE GAME LOGIC

ENGINE DOES NOT KNOW ABOUT:
- Socket.IO
- Express
- PostgreSQL
- Telegram
- wallet
- database
- UI

ENGINE IS RESPONSIBLE FOR:
- game state
- deck
- trump
- hands
- attack
- defense
- take
- bito
- draw
- game over
- winner
- loser
=========================================================
*/

const {
    CONFIG
} = require("../config");

const {
    createShuffledDeck,
    canBeat,
    findCardById,
    removeCardById
} = require("./cards");


/*
=========================================================
CONSTANTS
=========================================================
*/

const MAX_PLAYERS =
    CONFIG.GAME.MAX_PLAYERS;

const HAND_SIZE =
    CONFIG.GAME.STARTING_HAND_SIZE;

const MAX_ATTACK_CARDS =
    CONFIG.GAME.MAX_ATTACK_CARDS;


/*
=========================================================
ROOM PLAYER
=========================================================
*/

function createRoomPlayer(
    player
) {

    return {

        playerId:
            String(
                player.playerId
            ),

        name:
            player.name ||
            "Игрок",

        socketId:
            player.socketId ||
            null,

        connected:
            player.connected !== false,

        hand: []

    };

}


/*
=========================================================
CREATE ROOM STATE
=========================================================
*/

function createGameState({
    roomId,
    stake,
    players = []
}) {

    return {

        id:
            String(
                roomId
            ),

        stake:
            Number(
                stake
            ) || 0,

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

        players:
            players.map(
                createRoomPlayer
            ),

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
BASIC HELPERS
=========================================================
*/

function getRoomPlayer(
    room,
    playerId
) {

    if (
        !room ||
        !Array.isArray(
            room.players
        )
    ) {

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


function otherPlayer(
    room,
    playerId
) {

    if (
        !room ||
        !Array.isArray(
            room.players
        )
    ) {

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


function getPlayerCount(
    room
) {

    return Array.isArray(
        room?.players
    )
        ? room.players.length
        : 0;

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
        getPlayerCount(room) !==
        MAX_PLAYERS
    ) {

        return {

            ok: false,

            error:
                "Для начала нужны два игрока."

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

    for (
        const player
        of room.players
    ) {

        player.hand = [];

        player.connected =
            true;

    }


    /*
    -----------------------------------------------------
    DEAL
    -----------------------------------------------------

    По одной карте каждому,
    как в исходном server.js.
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i < HAND_SIZE;

        i++
    ) {

        for (
            const player
            of room.players
        ) {

            if (
                room.deck.length === 0
            ) {

                break;

            }

            player.hand.push(
                room.deck.pop()
            );

        }

    }


    /*
    -----------------------------------------------------
    TRUMP
    -----------------------------------------------------
    */

    room.trumpSuit =
        room.deck.length > 0
            ? room.deck[
                room.deck.length - 1
            ].suit
            : null;


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
                card.suit ===
                room.trumpSuit &&
                (
                    !lowestTrump ||
                    card.value <
                    lowestTrump.value
                )
            ) {

                lowestTrump =
                    card;

                attacker =
                    player;

            }

        }

    }


    /*
    -----------------------------------------------------
    FALLBACK
    -----------------------------------------------------
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
ROUND LIMIT
=========================================================
*/

function startNewAttackRound(
    room
) {

    const defender =
        getRoomPlayer(
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


function maxTableCards(
    room
) {

    return Math.max(
        0,

        Math.min(
            MAX_ATTACK_CARDS,

            Number(
                room.roundMaxCards ||
                0
            )
        )
    );

}


/*
=========================================================
CARD HELPERS
=========================================================
*/

function findPlayerCard(
    room,
    playerId,
    cardId
) {

    const player =
        getRoomPlayer(
            room,
            playerId
        );


    if (!player) {

        return null;

    }


    return findCardById(
        player.hand,
        cardId
    );

}


function removePlayerCard(
    room,
    playerId,
    cardId
) {

    const player =
        getRoomPlayer(
            room,
            playerId
        );


    if (!player) {

        return null;

    }


    const result =
        removeCardById(
            player.hand,
            cardId
        );


    if (!result.card) {

        return null;

    }


    player.hand =
        result.cards;


    return result.card;

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
VALID ATTACK CARD
=========================================================
*/

function validAttackCard(
    room,
    card
) {

    if (!card) {

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
    ALL RANKS CURRENTLY ON TABLE
    -----------------------------------------------------
    */

    const allowedValues =
        new Set();


    for (
        const pair
        of room.table
    ) {

        if (
            pair.attack
        ) {

            allowedValues.add(
                pair.attack.value
            );

        }


        if (
            pair.defense
        ) {

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
        room.phase !== "attack" &&
        room.phase !== "bito"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя атаковать."

        };

    }


    if (
        String(
            room.attackerId
        ) !==
        String(
            playerId
        )
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
    -----------------------------------------------------
    PREVIOUS ATTACK MUST BE DEFENDED
    -----------------------------------------------------
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


    const card =
        findPlayerCard(
            room,
            playerId,
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
        removePlayerCard(
            room,
            playerId,
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

        playerId:
            String(
                playerId
            ),

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
        String(
            room.defenderId
        ) !==
        String(
            playerId
        )
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


    const defense =
        findPlayerCard(
            room,
            playerId,
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
        removePlayerCard(
            room,
            playerId,
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

        playerId:
            String(
                playerId
            ),

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
TAKE CARDS
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
        String(
            room.defenderId
        ) !==
        String(
            playerId
        )
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
        getRoomPlayer(
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


    /*
    -----------------------------------------------------
    TAKE EVERYTHING FROM TABLE
    -----------------------------------------------------
    */

    for (
        const pair
        of room.table
    ) {

        if (
            pair.attack
        ) {

            defender.hand.push(
                pair.attack
            );

        }


        if (
            pair.defense
        ) {

            defender.hand.push(
                pair.defense
            );

        }

    }


    const takenCards =
        room.table.reduce(
            (
                count,
                pair
            ) => {

                return (
                    count +

                    (
                        pair.attack
                            ? 1
                            : 0
                    ) +

                    (
                        pair.defense
                            ? 1
                            : 0
                    )
                );

            },

            0
        );


    room.moves.push({

        type:
            "take",

        playerId:
            String(
                playerId
            ),

        cards:
            takenCards,

        timestamp:
            Date.now()

    });


    room.table =
        [];


    /*
    -----------------------------------------------------
    ATTACKER REMAINS ATTACKER
    -----------------------------------------------------
    */

    room.phase =
        "draw";


    drawCards(
        room
    );


    room.phase =
        "attack";


    startNewAttackRound(
        room
    );


    return {

        ok: true,

        gameOver:
            checkGameOver(
                room
            )

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
        String(
            room.attackerId
        ) !==
        String(
            playerId
        )
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

        playerId:
            String(
                playerId
            ),

        timestamp:
            Date.now()

    });


    room.table =
        [];


    /*
    -----------------------------------------------------
    ROLES SWITCH
    -----------------------------------------------------
    */

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


    room.phase =
        "attack";


    startNewAttackRound(
        room
    );


    return {

        ok: true,

        gameOver:
            checkGameOver(
                room
            )

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
        room.deck.length === 0
    ) {

        return;

    }


    const attacker =
        getRoomPlayer(
            room,
            room.attackerId
        );

    const defender =
        getRoomPlayer(
            room,
            room.defenderId
        );


    /*
    -----------------------------------------------------
    ATTACKER FIRST
    -----------------------------------------------------
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
                HAND_SIZE &&

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

Returns:

false
true

and mutates room state.
Settlement itself remains outside
the game engine.
=========================================================
*/

function checkGameOver(
    room
) {

    if (!room) {

        return false;

    }


    /*
    -----------------------------------------------------
    DECK STILL HAS CARDS
    -----------------------------------------------------
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

        room.status =
            "finished";

        room.phase =
            "finished";

        room.winnerId =
            null;

        room.loserId =
            null;

        room.attackerId =
            null;

        room.defenderId =
            null;

        room.finishedAt =
            Date.now();


        room.moves.push({

            type:
                "draw",

            timestamp:
                Date.now()

        });


        return true;

    }


    /*
    -----------------------------------------------------
    NO WINNER YET
    -----------------------------------------------------
    */

    if (
        emptyPlayers.length !== 1
    ) {

        return false;

    }


    /*
    -----------------------------------------------------
    WINNER
    -----------------------------------------------------
    */

    const winner =
        emptyPlayers[0];


    const loser =
        otherPlayer(
            room,
            winner.playerId
        );


    room.status =
        "finished";

    room.phase =
        "finished";

    room.winnerId =
        winner.playerId;

    room.loserId =
        loser
            ? loser.playerId
            : null;

    room.attackerId =
        null;

    room.defenderId =
        null;

    room.finishedAt =
        Date.now();


    room.moves.push({

        type:
            "finish",

        playerId:
            winner.playerId,

        timestamp:
            Date.now()

    });


    return true;

}


/*
=========================================================
FORCE WIN
=========================================================

Used later for:
- leave room
- disconnect timeout
=========================================================
*/

function finishByForfeit(
    room,
    loserId,
    reason = "forfeit"
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
                "Игра уже завершена."

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


    room.status =
        "finished";

    room.phase =
        "finished";

    room.winnerId =
        winner.playerId;

    room.loserId =
        String(
            loserId
        );

    room.attackerId =
        null;

    room.defenderId =
        null;

    room.finishedAt =
        Date.now();


    room.moves.push({

        type:
            reason,

        playerId:
            winner.playerId,

        timestamp:
            Date.now()

    });


    return {

        ok: true,

        winnerId:
            winner.playerId,

        loserId:
            String(
                loserId
            )

    };

}


/*
=========================================================
SERIALIZATION
=========================================================
*/

function serializeCard(
    card
) {

    if (!card) {

        return null;

    }


    return {

        id:
            card.id,

        suit:
            card.suit,

        rank:
            card.rank,

        value:
            card.value

    };

}


/*
=========================================================
GAME STATE FOR CLIENT
=========================================================
*/

function getGameState(
    room,
    playerId
) {

    if (!room) {

        return null;

    }


    const me =
        getRoomPlayer(
            room,
            playerId
        );

    const opponent =
        otherPlayer(
            room,
            playerId
        );


    let turn =
        "WAITING";


    if (
        room.status ===
        "playing"
    ) {

        if (
            room.phase === "attack" ||
            room.phase === "bito"
        ) {

            turn =
                String(
                    room.attackerId
                ) ===
                String(
                    playerId
                )
                    ? "YOUR_TURN"
                    : "OPPONENT_TURN";

        }


        if (
            room.phase ===
            "defense"
        ) {

            turn =
                String(
                    room.defenderId
                ) ===
                String(
                    playerId
                )
                    ? "YOUR_TURN"
                    : "OPPONENT_TURN";

        }

    }


    const table =
        room.table.map(
            pair => ({

                attack:
                    serializeCard(
                        pair.attack
                    ),

                defense:
                    pair.defense
                        ? serializeCard(
                            pair.defense
                        )
                        : null

            })
        );


    const canTake =
        room.status ===
            "playing" &&

        room.phase ===
            "defense" &&

        String(
            room.defenderId
        ) ===
        String(
            playerId
        ) &&

        room.table.some(
            pair =>
                !pair.defense
        );


    const canBito =
        room.status ===
            "playing" &&

        room.phase ===
            "bito" &&

        String(
            room.attackerId
        ) ===
        String(
            playerId
        ) &&

        room.table.length > 0 &&

        room.table.every(
            pair =>
                !!pair.defense
        );


    const canAttack =
        room.status ===
            "playing" &&

        String(
            room.attackerId
        ) ===
        String(
            playerId
        ) &&

        (
            room.phase === "attack" ||
            room.phase === "bito"
        ) &&

        room.table.length <
            maxTableCards(
                room
            ) &&

        (
            room.table.length === 0 ||

            room.table.every(
                pair =>
                    !!pair.defense
            )
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

        turn,

        attackerId:
            room.attackerId,

        defenderId:
            room.defenderId,

        trumpSuit:
            room.trumpSuit,

        deckCount:
            room.deck.length,

        roundMaxCards:
            room.roundMaxCards,

        hand:
            me
                ? me.hand.map(
                    serializeCard
                )
                : [],

        opponent:
            opponent
                ? {

                    playerId:
                        opponent.playerId,

                    name:
                        opponent.name,

                    connected:
                        opponent.connected,

                    cardsCount:
                        opponent.hand.length

                }
                : null,

        table,

        canAttack,

        canTake,

        canBito,

        moves:
            room.moves.slice(
                -30
            ),

        winnerId:
            room.winnerId ||
            null,

        loserId:
            room.loserId ||
            null,

        settlement:
            room.settlement ||
            null,

        payout:
            room.payout ||
            0,

        me: {

            playerId:
                String(
                    playerId
                ),

            name:
                me
                    ? me.name
                    : "Игрок"

        }

    };

}


/*
=========================================================
VALIDATE GAME STATE
=========================================================
*/

function validateGameState(
    room
) {

    if (!room) {

        return {

            ok: false,

            errors: [
                "Room is missing"
            ]

        };

    }


    const errors = [];


    /*
    -----------------------------------------------------
    PLAYERS
    -----------------------------------------------------
    */

    if (
        !Array.isArray(
            room.players
        )
    ) {

        errors.push(
            "players must be an array"
        );

    }


    /*
    -----------------------------------------------------
    DECK
    -----------------------------------------------------
    */

    if (
        !Array.isArray(
            room.deck
        )
    ) {

        errors.push(
            "deck must be an array"
        );

    }


    /*
    -----------------------------------------------------
    TABLE
    -----------------------------------------------------
    */

    if (
        !Array.isArray(
            room.table
        )
    ) {

        errors.push(
            "table must be an array"
        );

    }


    /*
    -----------------------------------------------------
    PLAYER HANDS
    -----------------------------------------------------
    */

    if (
        Array.isArray(
            room.players
        )
    ) {

        for (
            const player
            of room.players
        ) {

            if (
                !Array.isArray(
                    player.hand
                )
            ) {

                errors.push(
                    `Player ${player.playerId} has invalid hand`
                );

            }

        }

    }


    /*
    -----------------------------------------------------
    TABLE PAIRS
    -----------------------------------------------------
    */

    if (
        Array.isArray(
            room.table
        )
    ) {

        for (
            const pair
            of room.table
        ) {

            if (
                !pair ||
                !pair.attack
            ) {

                errors.push(
                    "Invalid table pair"
                );

            }

        }

    }


    /*
    -----------------------------------------------------
    RETURN
    -----------------------------------------------------
    */

    return {

        ok:
            errors.length === 0,

        errors

    };

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

    startNewAttackRound,

    maxTableCards,

    getRoomPlayer,

    otherPlayer,

    findPlayerCard,

    removePlayerCard,

    validAttackCard,

    attackCard,

    defendCard,

    takeCards,

    bito,

    drawCards,

    checkGameOver,

    finishByForfeit,

    getGameState,

    serializeCard,

    validateGameState

};
