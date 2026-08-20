""use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE
AUTHORITATIVE DURAK ENGINE
=========================================================

ПРАВИЛА:

- 36 карт
- 2 живых игрока
- по 6 карт на старте
- определяется козырь
- первый ход у игрока с младшим козырем
- атакующий может подкидывать карты
- защитник может отбиваться или брать
- после полного отбивания атакующий нажимает БИТО
- после БИТО роли меняются
- при ВЗЯТЬ атакующий остаётся атакующим
- добор: сначала атакующий, затем защитник
- максимум атаки = количество карт защитника
  на начало текущего захода, но не более 6
- после окончания колоды игрок с пустой рукой
  может закончить игру
- если оба игрока закончили одновременно — ничья
- AI отсутствует
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
    canBeat,
    getCardValue
} = require("./cards");


/*
=========================================================
CREATE GAME STATE
=========================================================
*/

function createGameState({
    roomId,
    stake = 0,
    players = []
}) {

    const normalizedStake =
        Number(stake);


    return {

        id:
            String(roomId),

        roomId:
            String(roomId),

        stake:
            Number.isSafeInteger(
                normalizedStake
            ) &&
            normalizedStake >= 0
                ? normalizedStake
                : 0,

        pot:
            0,

        players:
            Array.isArray(players)
                ? players
                : [],

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

        /*
         * Максимальное количество
         * атакующих карт в текущем заходе.
         */
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
CREATE ROOM PLAYER
=========================================================
*/

function createRoomPlayer({
    playerId,
    name = "Игрок",
    socketId = null,
    connected = true
}) {

    return {

        playerId:
            String(playerId),

        name:
            String(
                name ||
                "Игрок"
            ),

        socketId,

        connected:
            Boolean(
                connected
            ),

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


/*
=========================================================
OTHER PLAYER
=========================================================
*/

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
        !Array.isArray(
            player.hand
        )
    ) {

        return null;

    }


    return (
        player.hand.find(
            card =>
                String(
                    card.id
                ) ===
                String(
                    cardId
                )
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
        !Array.isArray(
            player.hand
        )
    ) {

        return null;

    }


    const index =
        player.hand.findIndex(
            card =>
                String(
                    card.id
                ) ===
                String(
                    cardId
                )
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
ADD MOVE
=========================================================
*/

function addMove(
    room,
    type,
    playerId,
    data = {}
) {

    if (
        !room ||
        !Array.isArray(
            room.moves
        )
    ) {

        return;

    }


    room.moves.push({

        type,

        playerId:
            String(
                playerId
            ),

        timestamp:
            Date.now(),

        ...data

    });

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
        room.status !==
            "waiting"
    ) {

        return {

            ok: false,

            error:
                "Игра уже запущена."

        };

    }


    if (
        !Array.isArray(
            room.players
        ) ||
        room.players.length !==
            MAX_PLAYERS
    ) {

        return {

            ok: false,

            error:
                "Для начала игры нужны два игрока."

        };

    }


    /*
    -----------------------------------------------------
    RESET
    -----------------------------------------------------
    */

    room.deck =
        createShuffledDeck();

    room.table = [];

    room.moves = [];

    room.winnerId =
        null;

    room.loserId =
        null;

    room.settlement =
        null;

    room.finishedAt =
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

        player.hand = [];

    }


    /*
    -----------------------------------------------------
    DEAL
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
        getTrumpSuit(
            room.deck
        );


    if (
        !room.trumpSuit
    ) {

        return {

            ok: false,

            error:
                "Не удалось определить козырную масть."

        };

    }


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
                getCardValue(card) <
                getCardValue(
                    lowestTrump
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


    if (!defender) {

        return {

            ok: false,

            error:
                "Не удалось определить защитника."

        };

    }


    room.attackerId =
        attacker.playerId;

    room.defenderId =
        defender.playerId;


    room.status =
        "playing";

    room.phase =
        "attack";

    room.startedAt =
        Date.now();


    room.roundMaxCards =
        Math.min(
            MAX_ATTACK_CARDS,
            defender.hand.length
        );


    addMove(
        room,
        "game_start",
        attacker.playerId,
        {

            trumpSuit:
                room.trumpSuit

        }
    );


    return {

        ok: true,

        attackerId:
            room.attackerId,

        defenderId:
            room.defenderId,

        trumpSuit:
            room.trumpSuit

    };

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

    if (
        !room ||
        !card
    ) {

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
    ALL VALUES ON TABLE
    -----------------------------------------------------

    Можно подкинуть карту любого достоинства,
    которое уже присутствует среди атакующих
    или защитных карт.
    */

    const values =
        new Set();


    for (
        const pair
        of room.table
    ) {

        if (
            pair.attack
        ) {

            values.add(
                getCardValue(
                    pair.attack
                )
            );

        }

        if (
            pair.defense
        ) {

            values.add(
                getCardValue(
                    pair.defense
                )
            );

        }

    }


    return values.has(
        getCardValue(
            card
        )
    );

}


/*
=========================================================
ALL CARDS DEFENDED
=========================================================
*/

function allCardsDefended(
    room
) {

    if (
        !room ||
        !Array.isArray(
            room.table
        ) ||
        room.table.length === 0
    ) {

        return false;

    }


    return room.table.every(
        pair =>
            Boolean(
                pair &&
                pair.attack &&
                pair.defense
            )
    );

}


/*
=========================================================
HAS UNBEATEN CARD
=========================================================
*/

function hasUnbeatenCard(
    room
) {

    if (
        !room ||
        !Array.isArray(
            room.table
        )
    ) {

        return false;

    }


    return room.table.some(
        pair =>
            pair &&
            pair.attack &&
            !pair.defense
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


    if (!player) {

        return {

            ok: false,

            error:
                "Игрок не найден."

        };

    }


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


    const removed =
        removeCard(
            player,
            cardId
        );


    if (!removed) {

        return {

            ok: false,

            error:
                "Не удалось убрать карту из руки."

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


    addMove(
        room,
        "attack",
        playerId,
        {

            cardId:
                removed.id

        }
    );


    return {

        ok: true,

        card:
            removed

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
                item &&
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


    const defense =
        findCard(
            defender,
            defenseId
        );


    if (!defense) {

        return {

            ok: false,

            error:
                "Карта защиты не найдена."

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


    const removed =
        removeCard(
            defender,
            defenseId
        );


    if (!removed) {

        return {

            ok: false,

            error:
                "Не удалось убрать карту защиты."

        };

    }


    pair.defense =
        removed;


    /*
    -----------------------------------------------------
    AFTER SUCCESSFUL DEFENSE
    -----------------------------------------------------

    Если ещё можно подкинуть —
    атакующий получает право атаковать.

    Если максимум достигнут —
    атакующий всё равно получает фазу attack,
    но сможет только нажать БИТО.
    */

    room.phase =
        "attack";


    addMove(
        room,
        "defense",
        playerId,
        {

            attackId:
                pair.attack.id,

            defenseId:
                removed.id

        }
    );


    return {

        ok: true,

        card:
            removed,

        allDefended:
            allCardsDefended(
                room
            )

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


    if (
        !hasUnbeatenCard(
            room
        )
    ) {

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


    /*
    -----------------------------------------------------
    SAVE CURRENT ROLES
    -----------------------------------------------------
    */

    const attacker =
        roomPlayerById(
            room,
            room.attackerId
        );


    const currentDefender =
        roomPlayerById(
            room,
            room.defenderId
        );


    /*
    -----------------------------------------------------
    TAKE EVERYTHING
    -----------------------------------------------------
    */

    let takenCount =
        0;


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

            takenCount++;

        }


        if (
            pair.defense
        ) {

            defender.hand.push(
                pair.defense
            );

            takenCount++;

        }

    }


    room.table = [];


    /*
    -----------------------------------------------------
    DRAW
    -----------------------------------------------------

    При ВЗЯТЬ:
    1. старый атакующий
    2. старый защитник
    */

    drawCardsInOrder(
        room,
        [
            attacker,
            currentDefender
        ]
    );


    addMove(
        room,
        "take",
        playerId,
        {

            cards:
                takenCount

        }
    );


    /*
    -----------------------------------------------------
    CHECK GAME OVER
    -----------------------------------------------------
    */

    if (
        checkGameOver(
            room
        )
    ) {

        return {

            ok: true,

            gameOver: true

        };

    }


    /*
    -----------------------------------------------------
    ATTACKER STAYS THE SAME
    -----------------------------------------------------
    */

    room.phase =
        "attack";


    room.roundMaxCards =
        Math.min(
            MAX_ATTACK_CARDS,
            currentDefender
                ? currentDefender.hand.length
                : 0
        );


    return {

        ok: true,

        gameOver: false,

        taken:
            takenCount

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


    if (
        room.phase !==
            "attack"
    ) {

        return {

            ok: false,

            error:
                "Сейчас нельзя нажать БИТО."

        };

    }


    if (
        !allCardsDefended(
            room
        )
    ) {

        return {

            ok: false,

            error:
                "Не все карты отбиты."

        };

    }


    const oldAttacker =
        roomPlayerById(
            room,
            room.attackerId
        );


    const oldDefender =
        roomPlayerById(
            room,
            room.defenderId
        );


    /*
    -----------------------------------------------------
    CLEAR TABLE
    -----------------------------------------------------
    */

    room.table = [];


    /*
    -----------------------------------------------------
    DRAW ORDER
    -----------------------------------------------------

    Сначала старый атакующий,
    затем старый защитник.
    */

    drawCardsInOrder(
        room,
        [
            oldAttacker,
            oldDefender
        ]
    );


    addMove(
        room,
        "bito",
        playerId
    );


    /*
    -----------------------------------------------------
    CHECK GAME OVER
    -----------------------------------------------------
    */

    if (
        checkGameOver(
            room
        )
    ) {

        return {

            ok: true,

            gameOver: true

        };

    }


    /*
    -----------------------------------------------------
    CHANGE ROLES
    -----------------------------------------------------
    */

    room.attackerId =
        oldDefender
            ? oldDefender.playerId
            : null;


    room.defenderId =
        oldAttacker
            ? oldAttacker.playerId
            : null;


    const newDefender =
        roomPlayerById(
            room,
            room.defenderId
        );


    room.roundMaxCards =
        Math.min(
            MAX_ATTACK_CARDS,
            newDefender
                ? newDefender.hand.length
                : 0
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

function drawCardsInOrder(
    room,
    players
) {

    if (
        !room ||
        !Array.isArray(
            players
        )
    ) {

        return;

    }


    /*
    * Если один и тот же игрок
    * каким-то образом передан дважды,
    * добираем его только один раз.
    */

    const processed =
        new Set();


    for (
        const player
        of players
    ) {

        if (
            !player ||
            processed.has(
                String(
                    player.playerId
                )
            )
        ) {

            continue;

        }


        processed.add(
            String(
                player.playerId
            )
        );


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

    if (!room) {

        return false;

    }


    /*
    * Пока в колоде есть карты,
    * пустая рука ещё не означает
    * окончательную победу.
    */

    if (
        room.deck.length > 0
    ) {

        return false;

    }


    const emptyPlayers =
        room.players.filter(
            player =>
                Array.isArray(
                    player.hand
                ) &&
                player.hand.length === 0
        );


    /*
    -----------------------------------------------------
    BOTH EMPTY
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
    ONE EMPTY
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
    settlement
) {

    if (!room) {

        return;

    }


    if (
        room.status ===
        "finished"
    ) {

        return;

    }


    room.status =
        "finished";

    room.phase =
        "finished";

    room.winnerId =
        winnerId
            ? String(winnerId)
            : null;

    room.loserId =
        loserId
            ? String(loserId)
            : null;

    room.settlement =
        settlement || null;

    room.finishedAt =
        Date.now();


    addMove(
        room,
        "game_finished",
        winnerId ||
            loserId ||
            "system",
        {

            winnerId:
                room.winnerId,

            loserId:
                room.loserId,

            settlement:
                room.settlement

        }
    );

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
        room.status ===
        "finished"
    ) {

        return {

            ok: false,

            error:
                "Игра уже завершена."

        };

    }


    const loser =
        roomPlayerById(
            room,
            loserId
        );


    if (!loser) {

        return {

            ok: false,

            error:
                "Проигравший игрок не найден."

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


    finishGame(
        room,

        winner.playerId,

        loser.playerId,

        "forfeit"
    );


    return {

        ok: true,

        winnerId:
            winner.playerId,

        loserId:
            loser.playerId,

        reason:
            String(
                reason ||
                "leave"
            )

    };

}


/*
=========================================================
PUBLIC TABLE
=========================================================
*/

function getPublicTable(
    room
) {

    if (
        !room ||
        !Array.isArray(
            room.table
        )
    ) {

        return [];

    }


    return room.table.map(
        pair => ({

            attack:
                pair.attack
                    ? {
                        id:
                            pair.attack.id,

                        suit:
                            pair.attack.suit,

                        suitSymbol:
                            pair.attack.suitSymbol,

                        suitName:
                            pair.attack.suitName,

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

                        suitSymbol:
                            pair.defense.suitSymbol,

                        suitName:
                            pair.defense.suitName,

                        rank:
                            pair.defense.rank,

                        value:
                            pair.defense.value
                    }
                    : null

        })
    );

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


    const isAttacker =
        String(
            room.attackerId
        ) ===
        String(
            playerId
        );


    const isDefender =
        String(
            room.defenderId
        ) ===
        String(
            playerId
        );


    const defended =
        allCardsDefended(
            room
        );


    const hasUnbeaten =
        hasUnbeatenCard(
            room
        );


    /*
    -----------------------------------------------------
    ACTIONS
    -----------------------------------------------------
    */

    const canBito =
        room.status ===
            "playing" &&
        room.phase ===
            "attack" &&
        isAttacker &&
        defended;


    const canAttack =
        room.status ===
            "playing" &&
        room.phase ===
            "attack" &&
        isAttacker &&
        room.table.length <
            room.roundMaxCards;


    const canTake =
        room.status ===
            "playing" &&
        room.phase ===
            "defense" &&
        isDefender &&
        hasUnbeaten;


    const canDefend =
        room.status ===
            "playing" &&
        room.phase ===
            "defense" &&
        isDefender;


    /*
    -----------------------------------------------------
    TURN
    -----------------------------------------------------
    */

    let turn =
        "WAITING";


    if (
        room.status ===
        "playing"
    ) {

        if (
            isAttacker
        ) {

            turn =
                "YOUR_TURN";

        } else if (
            isDefender
        ) {

            turn =
                "OPPONENT_TURN";

        }

    }


    /*
    -----------------------------------------------------
    TURN TEXT
    -----------------------------------------------------
    */

    let turnText =
        "Ожидание игрока";


    if (
        room.status ===
        "playing"
    ) {

        if (
            room.phase ===
                "attack" &&
            isAttacker
        ) {

            if (
                canBito
            ) {

                turnText =
                    "Ваш ход — атакуйте или нажмите БИТО";

            } else if (
                canAttack
            ) {

                turnText =
                    "Ваш ход — атакуйте";

            } else {

                turnText =
                    "Нажмите БИТО";

            }

        } else if (
            room.phase ===
                "defense" &&
            isDefender
        ) {

            turnText =
                "Ваш ход — отбивайтесь или берите";

        } else {

            turnText =
                "Ход противника";

        }

    }


    return {

        roomId:
            room.roomId,

        stake:
            room.stake,

        pot:
            room.pot,

        status:
            room.status,

        phase:
            room.phase,

        turn,

        turnText,

        trumpSuit:
            room.trumpSuit,

        attackerId:
            room.attackerId,

        defenderId:
            room.defenderId,

        roundMaxCards:
            room.roundMaxCards,

        deckCount:
            room.deck.length,

        hand:
            self &&
            Array.isArray(
                self.hand
            )
                ? self.hand
                : [],

        handCount:
            self
                ? self.hand.length
                : 0,

        me:
            self
                ? {

                    playerId:
                        self.playerId,

                    name:
                        self.name,

                    cardsCount:
                        self.hand.length

                }
                : null,

        opponent:
            opponent
                ? {

                    playerId:
                        opponent.playerId,

                    name:
                        opponent.name,

                    cardsCount:
                        opponent.hand.length

                }
                : null,

        table:
            getPublicTable(
                room
            ),

        canAttack,

        canDefend,

        canTake,

        canBito,

        allDefended:
            defended,

        hasUnbeaten,

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
CONFIGURATION CHECK
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

    drawCards:
        room =>
            drawCardsInOrder(
                room,
                room
                    ? [
                        roomPlayerById(
                            room,
                            room.attackerId
                        ),

                        roomPlayerById(
                            room,
                            room.defenderId
                        )
                    ]
                    : []
            ),

    checkGameOver,

    finishGame,

    finishByForfeit,

    roomPlayerById,

    otherPlayer,

    getPublicGameState

};
