"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE 2.0
AUTHORITATIVE DURAK ENGINE
36 CARDS
2 PLAYERS
NO AI
=========================================================

ЛОГИКА:

1. Начало:
   - 36 карт
   - по 6 карт каждому
   - определяется козырь
   - первый ход у игрока с младшим козырем

2. Атака:
   - атакующий кладёт карту
   - защитник отбивается

3. После успешного отбивания:
   - если есть место для следующей атаки:
     атакующий снова может подкинуть
   - если все карты отбиты:
     атакующий может нажать БИТО

4. БИТО:
   - стол очищается
   - сначала карты добирает предыдущий атакующий
   - затем предыдущий защитник
   - роли меняются

5. ВЗЯТЬ:
   - защитник забирает все карты со стола
   - атакующий остаётся атакующим
   - сначала добирает атакующий
   - затем защитник

6. Когда колода закончилась:
   - игрок с пустой рукой может победить
   - если пустые руки у обоих одновременно — ничья

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

        roomId:
            roomId,

        stake:
            Number(stake || 0),

        pot:
            0,

        players,

        status:
            "waiting",

        /*
         * Возможные фазы:
         *
         * waiting
         * attack
         * defense
         * finished
         */
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
         * атак в текущем заходе.
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
    name,
    socketId = null,
    connected = true
}) {

    return {

        playerId,

        name:
            name || "Игрок",

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

    if (!room) {
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
    DEAL 6 EACH
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
                Number(card.value) <
                Number(lowestTrump.value)
            ) {

                lowestTrump =
                    card;

                attacker =
                    player;

            }

        }

    }


    /*
    Если козырей нет —
    первый игрок.
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


    /*
     * Максимум атак определяется
     * количеством карт защитника
     * НА НАЧАЛО захода.
     */
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


    /*
     * Первая карта может быть любой.
     */

    if (
        room.table.length === 0
    ) {
        return true;
    }


    /*
     * Подкидывать можно только
     * достоинства, уже находящиеся
     * на столе.
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
                Number(
                    pair.attack.value
                )
            );

        }

        if (
            pair.defense
        ) {

            values.add(
                Number(
                    pair.defense.value
                )
            );

        }

    }


    return values.has(
        Number(
            card.value
        )
    );

}


/*
=========================================================
CAN BITE
=========================================================
*/

function allCardsDefended(
    room
) {

    return (
        Array.isArray(
            room.table
        ) &&
        room.table.length > 0 &&
        room.table.every(
            pair =>
                Boolean(
                    pair.defense
                )
        )
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


    /*
     * Только атакующий.
     */

    if (
        String(room.attackerId) !==
        String(playerId)
    ) {

        return {
            ok: false,
            error:
                "Сейчас ход противника."
        };

    }


    /*
     * Атаковать можно только
     * в фазе атаки.
     */

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


    /*
     * Максимум атак.
     */

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


    /*
     * Проверяем возможность
     * подкидывания.
     */

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


    /*
     * Удаляем карту из руки.
     */

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


    /*
     * Добавляем на стол.
     */

    room.table.push({

        attack:
            removed,

        defense:
            null

    });


    /*
     * Теперь защищается
     * второй игрок.
     */

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


    /*
     * Защищаться можно только
     * в defense.
     */

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


    /*
     * Только защитник.
     */

    if (
        String(room.defenderId) !==
        String(playerId)
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


    /*
     * Проверяем реальное правило
     * отбивания.
     */

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


    /*
     * Удаляем карту защиты.
     */

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
     * КЛЮЧЕВОЙ МОМЕНТ:
     *
     * После успешного отбивания
     * атакующий получает возможность
     * либо:
     *
     * 1. подкинуть ещё карту
     * 2. нажать БИТО
     *
     * Если ещё есть место —
     * возвращаем фазу attack.
     */

    if (
        room.table.length <
        room.roundMaxCards
    ) {

        room.phase =
            "attack";

    } else {

        /*
         * Максимум достигнут.
         * Все карты отбиты —
         * остаётся только БИТО.
         */
        room.phase =
            "attack";

    }


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


    /*
     * Только защитник.
     */

    if (
        String(room.defenderId) !==
        String(playerId)
    ) {

        return {
            ok: false,
            error:
                "Только защитник может взять карты."
        };

    }


    /*
     * Только во время защиты.
     */

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

    if (!defender) {

        return {
            ok: false,
            error:
                "Игрок не найден."
        };

    }


    /*
     * Должна быть хотя бы
     * одна неотбитая карта.
     */

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


    /*
     * Забираем абсолютно всё
     * со стола.
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


    room.table = [];


    /*
     * Запоминаем текущие роли.
     *
     * Они НЕ меняются.
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
     * Сначала добирает атакующий,
     * потом защитник.
     */

    drawCardsInOrder(
        room,
        [
            attacker,
            currentDefender
        ]
    );


    /*
     * Проверяем окончание игры.
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
     * Атакующий НЕ меняется.
     */

    room.phase =
        "attack";


    /*
     * Новый максимум зависит
     * от текущего защитника.
     */

    room.roundMaxCards =
        Math.min(
            MAX_ATTACK_CARDS,
            currentDefender
                ? currentDefender.hand.length
                : 0
        );


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


    /*
     * БИТО может нажать атакующий.
     */

    if (
        String(room.attackerId) !==
        String(playerId)
    ) {

        return {
            ok: false,
            error:
                "Только атакующий может нажать БИТО."
        };

    }


    /*
     * БИТО доступно только
     * когда все карты отбиты.
     */

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


    /*
     * Запоминаем старые роли.
     */

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
     * Очищаем стол.
     */

    room.table = [];


    /*
     * ВАЖНО:
     *
     * При успешном отбивании
     * сначала добирает предыдущий
     * атакующий, затем предыдущий
     * защитник.
     */

    drawCardsInOrder(
        room,
        [
            oldAttacker,
            oldDefender
        ]
    );


    /*
     * Проверяем окончание игры.
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
     * Теперь роли меняются.
     *
     * Старый защитник становится
     * новым атакующим.
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


    for (
        const player
        of players
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

    if (!room) {
        return false;
    }


    /*
     * Пока колода не закончилась,
     * наличие пустой руки само по себе
     * не завершает игру.
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
     * Оба закончили одновременно.
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
     * Один закончил.
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


    /*
     * Не позволяем второй раз
     * завершить уже завершённую игру.
     */

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


    const hasUnbeaten =
        room.table.some(
            pair =>
                !pair.defense
        );


    const defended =
        allCardsDefended(
            room
        );


    /*
     * Важно:
     * если table пустой,
     * БИТО нельзя нажимать.
     */

    const canBito =
        room.status === "playing" &&
        room.phase === "attack" &&
        isAttacker &&
        defended;


    const canAttack =
        room.status === "playing" &&
        room.phase === "attack" &&
        isAttacker &&
        room.table.length <
            room.roundMaxCards;


    const canTake =
        room.status === "playing" &&
        room.phase === "defense" &&
        isDefender &&
        hasUnbeaten;


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

            turnText =
                canBito
                    ? "Ваш ход — атакуйте или нажмите БИТО"
                    : "Ваш ход — атакуйте";

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
            self
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
                        opponent.hand.length,

                    handCount:
                        opponent.hand.length

                }
                : null,

        table:
            room.table,

        canAttack,

        canDefend:
            room.status ===
            "playing" &&
            room.phase ===
            "defense" &&
            isDefender,

        canTake,

        canBito,

        allDefended:
            defended,

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
