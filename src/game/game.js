"use strict";

/*
=========================================================
HEAVY LUX CARD
GAME ENGINE
=========================================================

36 КАРТ
2–3 ИГРОКА
ПОДКИДНОЙ
БЕЗ ПЕРЕВОДА

Этот модуль управляет состоянием
конкретной партии.

Он использует:

cards.js
deck.js
rules.js

Он НЕ знает ничего о:

- Socket.IO
- Telegram
- комнатах
- HC
- XP
- рейтинге
- интерфейсе
=========================================================
*/

const {
    createShuffledDeck,
    drawCard,
    getTrumpSuit
} = require("./deck");

const {
    isCard
} = require("./cards");

const {
    MIN_PLAYERS,
    MAX_PLAYERS,
    HAND_SIZE,
    canAttack,
    canAddAttackCard,
    canDefend,
    canTake,
    canEndAttack,
    getDefendableCards
} = require("./rules");


/*
=========================================================
GAME STATUS
=========================================================
*/

const GAME_STATUS = Object.freeze({

    WAITING: "WAITING",

    PLAYING: "PLAYING",

    FINISHED: "FINISHED"

});


/*
=========================================================
PHASES
=========================================================
*/

const PHASE = Object.freeze({

    ATTACK: "ATTACK",

    DEFENSE: "DEFENSE",

    FINISHED: "FINISHED"

});


/*
=========================================================
CREATE PLAYER
=========================================================
*/

function createPlayer(playerId) {

    if (
        typeof playerId !== "string" ||
        playerId.length === 0
    ) {
        throw new Error(
            "Invalid playerId"
        );
    }

    return {

        playerId,

        hand: [],

        connected: true,

        eliminated: false

    };
}


/*
=========================================================
CREATE GAME
=========================================================
*/

function createGame({
    gameId,
    playerIds
}) {

    if (
        typeof gameId !== "string" ||
        gameId.length === 0
    ) {
        throw new Error(
            "Invalid gameId"
        );
    }

    if (!Array.isArray(playerIds)) {
        throw new Error(
            "playerIds must be an array"
        );
    }

    if (
        playerIds.length < MIN_PLAYERS ||
        playerIds.length > MAX_PLAYERS
    ) {
        throw new Error(
            `Game requires ${MIN_PLAYERS}-${MAX_PLAYERS} players`
        );
    }

    if (
        new Set(playerIds).size !==
        playerIds.length
    ) {
        throw new Error(
            "Duplicate playerId"
        );
    }

    const players =
        playerIds.map(
            playerId =>
                createPlayer(playerId)
        );

    return {

        gameId,

        status:
            GAME_STATUS.WAITING,

        phase:
            null,

        players,

        deck: [],

        trumpCard: null,

        trumpSuit: null,

        discard: [],

        table: [],

        attackerId: null,

        defenderId: null,

        turnPlayerId: null,

        round: 0,

        winnerId: null,

        loserId: null,

        createdAt:
            Date.now(),

        finishedAt:
            null

    };
}


/*
=========================================================
GET PLAYER
=========================================================
*/

function getPlayer(
    game,
    playerId
) {

    return game.players.find(
        player =>
            player.playerId === playerId
    ) || null;
}


/*
=========================================================
GET ACTIVE PLAYERS
=========================================================
*/

function getActivePlayers(game) {

    return game.players.filter(
        player =>
            !player.eliminated
    );
}


/*
=========================================================
GET PLAYER INDEX
=========================================================
*/

function getPlayerIndex(
    game,
    playerId
) {

    return game.players.findIndex(
        player =>
            player.playerId === playerId
    );
}


/*
=========================================================
GET NEXT ACTIVE PLAYER
=========================================================
*/

function getNextActivePlayer(
    game,
    playerId
) {

    const activePlayers =
        getActivePlayers(game);

    if (
        activePlayers.length === 0
    ) {
        return null;
    }

    const index =
        activePlayers.findIndex(
            player =>
                player.playerId === playerId
        );

    if (index === -1) {
        return activePlayers[0];
    }

    return (
        activePlayers[
            (index + 1) %
            activePlayers.length
        ]
    );
}


/*
=========================================================
START GAME
=========================================================
*/

function startGame(game) {

    if (!game) {
        throw new Error(
            "Game is required"
        );
    }

    if (
        game.status !==
        GAME_STATUS.WAITING
    ) {
        throw new Error(
            "Game has already started"
        );
    }

    if (
        game.players.length <
        MIN_PLAYERS
    ) {
        throw new Error(
            "Not enough players"
        );
    }

    if (
        game.players.length >
        MAX_PLAYERS
    ) {
        throw new Error(
            "Too many players"
        );
    }


    /*
    Создаём новую колоду.
    */

    game.deck =
        createShuffledDeck();


    /*
    =====================================================
    ПЕРВОНАЧАЛЬНАЯ РАЗДАЧА
    =====================================================
    */

    for (const player of game.players) {

        player.hand = [];

        for (
            let i = 0;
            i < HAND_SIZE;
            i++
        ) {

            const card =
                drawCard(
                    game.deck
                );

            if (!card) {
                throw new Error(
                    "Deck ended during initial deal"
                );
            }

            player.hand.push(card);

        }

    }


    /*
    =====================================================
    ОПРЕДЕЛЯЕМ КОЗЫРЬ
    =====================================================

    После раздачи верхняя карта
    оставшейся колоды определяет козырь.

    Важно:
    она остаётся частью колоды
    и будет последней картой добора.
    */

    if (
        game.deck.length === 0
    ) {
        throw new Error(
            "No trump card available"
        );
    }

    game.trumpCard =
        game.deck[
            game.deck.length - 1
        ];

    game.trumpSuit =
        getTrumpSuit(
            game.trumpCard
        );


    /*
    =====================================================
    ПЕРВЫЙ АТАКУЮЩИЙ
    =====================================================

    Ищем игрока с младшим козырем.
    */

    const firstAttacker =
        findFirstAttacker(game);

    if (!firstAttacker) {
        throw new Error(
            "Unable to determine first attacker"
        );
    }


    game.status =
        GAME_STATUS.PLAYING;

    game.phase =
        PHASE.ATTACK;

    game.round = 1;

    game.attackerId =
        firstAttacker.playerId;

    game.defenderId =
        getNextActivePlayer(
            game,
            firstAttacker.playerId
        ).playerId;

    game.turnPlayerId =
        firstAttacker.playerId;

    return game;
}


/*
=========================================================
FIND FIRST ATTACKER
=========================================================

Игрок с самым младшим козырем
начинает игру.

Если козырей несколько —
сравниваем их достоинство.
=========================================================
*/

function findFirstAttacker(game) {

    let result = null;

    for (const player of game.players) {

        for (const card of player.hand) {

            if (
                card.suit !==
                game.trumpSuit
            ) {
                continue;
            }

            if (
                !result ||
                card.value <
                result.card.value
            ) {

                result = {

                    player,

                    card

                };

            }

        }

    }

    return result
        ? result.player
        : null;
}


/*
=========================================================
FIND CARD IN HAND
=========================================================
*/

function findCardInHand(
    player,
    cardId
) {

    return player.hand.find(
        card =>
            card.id === cardId
    ) || null;
}


/*
=========================================================
REMOVE CARD FROM HAND
=========================================================
*/

function removeCardFromHand(
    player,
    cardId
) {

    const index =
        player.hand.findIndex(
            card =>
                card.id === cardId
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
GET CURRENT ATTACK CARD
=========================================================

Во время защиты новая атакующая карта
может быть добавлена после предыдущей.

Для текущего действия защиты
нужна последняя карта на столе,
которая ещё не была побита.

Для упрощённой структуры стола
храним пары:

{
    attack: Card,
    defense: Card | null
}
=========================================================
*/

function getCurrentAttackPair(game) {

    for (
        let i =
            game.table.length - 1;
        i >= 0;
        i--
    ) {

        const pair =
            game.table[i];

        if (
            pair.defense === null
        ) {
            return pair;
        }

    }

    return null;
}


/*
=========================================================
GET TABLE CARDS
=========================================================
*/

function getTableCards(game) {

    const cards = [];

    for (const pair of game.table) {

        cards.push(
            pair.attack
        );

        if (pair.defense) {

            cards.push(
                pair.defense
            );

        }

    }

    return cards;
}


/*
=========================================================
PLAY FIRST ATTACK CARD
=========================================================
*/

function playFirstAttackCard(
    game,
    playerId,
    cardId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    if (
        game.phase !==
        PHASE.ATTACK
    ) {
        throw new Error(
            "Game is not in attack phase"
        );
    }

    if (
        game.turnPlayerId !==
        playerId
    ) {
        throw new Error(
            "It is not this player's turn"
        );
    }

    if (
        game.attackerId !==
        playerId
    ) {
        throw new Error(
            "Player is not the attacker"
        );
    }

    const player =
        getPlayer(
            game,
            playerId
        );

    if (!player) {
        throw new Error(
            "Player not found"
        );
    }

    const card =
        findCardInHand(
            player,
            cardId
        );

    if (!card) {
        throw new Error(
            "Card is not in player's hand"
        );
    }

    if (!canAttack(card)) {
        throw new Error(
            "Card cannot be used for attack"
        );
    }

    removeCardFromHand(
        player,
        cardId
    );

    game.table.push({

        attack: card,

        defense: null

    });

    game.phase =
        PHASE.DEFENSE;

    game.turnPlayerId =
        game.defenderId;

    return game;
}


/*
=========================================================
ADD ATTACK CARD
=========================================================
*/

function addAttackCard(
    game,
    playerId,
    cardId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    /*
    Подкидывать может любой активный
    игрок, кроме защищающегося.
    */

    if (
        playerId ===
        game.defenderId
    ) {
        throw new Error(
            "Defender cannot attack"
        );
    }

    const player =
        getPlayer(
            game,
            playerId
        );

    if (!player) {
        throw new Error(
            "Player not found"
        );
    }

    const card =
        findCardInHand(
            player,
            cardId
        );

    if (!card) {
        throw new Error(
            "Card is not in player's hand"
        );
    }

    const defender =
        getPlayer(
            game,
            game.defenderId
        );

    if (!defender) {
        throw new Error(
            "Defender not found"
        );
    }

    const tableCards =
        getTableCards(game);

    /*
    На столе должна уже находиться
    хотя бы одна карта.
    */

    if (
        tableCards.length === 0
    ) {
        throw new Error(
            "No attack exists"
        );
    }

    if (
        !canAddAttackCard(
            card,
            tableCards,
            defender.hand.length
        )
    ) {
        throw new Error(
            "Card cannot be added to attack"
        );
    }

    removeCardFromHand(
        player,
        cardId
    );

    game.table.push({

        attack: card,

        defense: null

    });

    game.phase =
        PHASE.DEFENSE;

    game.turnPlayerId =
        game.defenderId;

    return game;
}


/*
=========================================================
DEFEND
=========================================================
*/

function defend(
    game,
    playerId,
    cardId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    if (
        game.phase !==
        PHASE.DEFENSE
    ) {
        throw new Error(
            "Game is not in defense phase"
        );
    }

    if (
        game.defenderId !==
        playerId
    ) {
        throw new Error(
            "Player is not defender"
        );
    }

    if (
        game.turnPlayerId !==
        playerId
    ) {
        throw new Error(
            "It is not this player's turn"
        );
    }

    const defender =
        getPlayer(
            game,
            playerId
        );

    if (!defender) {
        throw new Error(
            "Defender not found"
        );
    }

    const pair =
        getCurrentAttackPair(game);

    if (!pair) {
        throw new Error(
            "No card to defend"
        );
    }

    const defendingCard =
        findCardInHand(
            defender,
            cardId
        );

    if (!defendingCard) {
        throw new Error(
            "Card is not in player's hand"
        );
    }

    if (
        !canDefend(
            pair.attack,
            defendingCard,
            game.trumpSuit
        )
    ) {
        throw new Error(
            "Card cannot beat attacking card"
        );
    }

    removeCardFromHand(
        defender,
        cardId
    );

    pair.defense =
        defendingCard;


    /*
    =====================================================
    ВСЕ КАРТЫ НА СТОЛЕ ПОБИТЫ?
    =====================================================
    */

    const hasUnbeatenAttack =
        getCurrentAttackPair(game);

    if (
        !hasUnbeatenAttack
    ) {

        game.turnPlayerId =
            game.attackerId;

        return game;

    }


    game.turnPlayerId =
        game.defenderId;

    return game;
}


/*
=========================================================
TAKE CARDS
=========================================================
*/

function takeCards(
    game,
    playerId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    if (
        game.phase !==
        PHASE.DEFENSE
    ) {
        throw new Error(
            "Game is not in defense phase"
        );
    }

    if (
        game.defenderId !==
        playerId
    ) {
        throw new Error(
            "Player is not defender"
        );
    }

    const defender =
        getPlayer(
            game,
            playerId
        );

    if (!defender) {
        throw new Error(
            "Defender not found"
        );
    }

    if (
        !canTake(
            getTableCards(game),
            true
        )
    ) {
        throw new Error(
            "Cannot take cards"
        );
    }


    /*
    Все карты со стола
    уходят в руку защитника.
    */

    for (const pair of game.table) {

        defender.hand.push(
            pair.attack
        );

        if (pair.defense) {

            defender.hand.push(
                pair.defense
            );

        }

    }

    game.table = [];


    /*
    После взятия защитник
    не становится следующим атакующим.

    Следующим атакует игрок
    слева от защитника.
    */

    const nextAttacker =
        getNextActivePlayer(
            game,
            game.defenderId
        );

    if (!nextAttacker) {
        throw new Error(
            "Unable to determine next attacker"
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    game.defenderId =
        getNextActivePlayer(
            game,
            nextAttacker.playerId
        ).playerId;

    game.phase =
        PHASE.ATTACK;

    game.turnPlayerId =
        game.attackerId;

    return finishRound(game);
}


/*
=========================================================
END ATTACK
=========================================================
*/

function endAttack(
    game,
    playerId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    if (
        game.phase !==
        PHASE.DEFENSE
    ) {
        throw new Error(
            "Game is not in defense phase"
        );
    }

    if (
        game.attackerId !==
        playerId
    ) {
        throw new Error(
            "Player is not attacker"
        );
    }

    if (
        !canEndAttack(
            getTableCards(game),
            true
        )
    ) {
        throw new Error(
            "Attack cannot be finished"
        );
    }

    /*
    Если осталась непобитая карта,
    защитник не может быть объявлен
    успешно защитившимся.
    */

    if (
        getCurrentAttackPair(game)
    ) {
        throw new Error(
            "All attack cards must be defended first"
        );
    }


    /*
    Все карты успешно побиты.
    */

    for (const pair of game.table) {

        game.discard.push(
            pair.attack
        );

        if (pair.defense) {

            game.discard.push(
                pair.defense
            );

        }

    }

    game.table = [];


    /*
    После успешной защиты
    следующим атакующим становится
    игрок слева от текущего защитника.
    */

    const nextAttacker =
        getNextActivePlayer(
            game,
            game.defenderId
        );

    if (!nextAttacker) {
        throw new Error(
            "Unable to determine next attacker"
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    const nextDefender =
        getNextActivePlayer(
            game,
            nextAttacker.playerId
        );

    if (!nextDefender) {
        throw new Error(
            "Unable to determine next defender"
        );
    }

    game.defenderId =
        nextDefender.playerId;

    game.phase =
        PHASE.ATTACK;

    game.turnPlayerId =
        game.attackerId;

    return finishRound(game);
}


/*
=========================================================
FINISH ROUND
=========================================================
*/

function finishRound(game) {

    /*
    Проверяем окончание партии
    до добора.
    */

    updateEliminatedPlayers(game);

    if (
        checkGameFinished(game)
    ) {
        return game;
    }


    /*
    Добор происходит по порядку:
    атакующий → следующие игроки.
    */

    drawCardsForRound(game);


    /*
    После добора снова проверяем
    окончание партии.
    */

    updateEliminatedPlayers(game);

    checkGameFinished(game);

    return game;
}


/*
=========================================================
DRAW CARDS FOR ROUND
=========================================================
*/

function drawCardsForRound(game) {

    const startPlayerId =
        game.attackerId;

    let currentId =
        startPlayerId;

    for (
        let i = 0;
        i < game.players.length;
        i++
    ) {

        const player =
            getPlayer(
                game,
                currentId
            );

        if (
            player &&
            !player.eliminated
        ) {

            while (
                player.hand.length <
                HAND_SIZE &&
                game.deck.length > 0
            ) {

                const card =
                    drawCard(
                        game.deck
                    );

                if (!card) {
                    break;
                }

                player.hand.push(card);

            }

        }

        const next =
            getNextActivePlayer(
                game,
                currentId
            );

        if (!next) {
            break;
        }

        currentId =
            next.playerId;

    }
}


/*
=========================================================
UPDATE ELIMINATED PLAYERS
=========================================================
*/

function updateEliminatedPlayers(game) {

    /*
    Игрок не может быть выведен
    из игры, пока колода ещё содержит
    карты.

    В классическом Дураке игрок,
    избавившийся от карт,
    считается вышедшим только
    когда больше нет возможности
    добрать карты.
    */

    if (
        game.deck.length > 0
    ) {
        return;
    }

    for (const player of game.players) {

        if (
            player.hand.length === 0
        ) {

            player.eliminated = true;

        }

    }
}


/*
=========================================================
CHECK GAME FINISHED
=========================================================
*/

function checkGameFinished(game) {

    const activePlayers =
        getActivePlayers(game);

    /*
    Для 2 игроков:
    если один остался с картами,
    а другой вышел — оставшийся
    проиграл.
    */

    if (
        activePlayers.length <= 1
    ) {

        const loser =
            activePlayers[0] || null;

        const winner =
            game.players.find(
                player =>
                    player !== loser &&
                    player.hand.length === 0
            ) || null;

        game.status =
            GAME_STATUS.FINISHED;

        game.phase =
            PHASE.FINISHED;

        game.winnerId =
            winner
                ? winner.playerId
                : null;

        game.loserId =
            loser
                ? loser.playerId
                : null;

        game.finishedAt =
            Date.now();

        return true;
    }

    return false;
}


/*
=========================================================
GET POSSIBLE DEFENSES
=========================================================
*/

function getPossibleDefenses(
    game,
    playerId
) {

    if (
        game.defenderId !==
        playerId
    ) {
        return [];
    }

    const defender =
        getPlayer(
            game,
            playerId
        );

    if (!defender) {
        return [];
    }

    const pair =
        getCurrentAttackPair(game);

    if (!pair) {
        return [];
    }

    return getDefendableCards(
        defender.hand,
        pair.attack,
        game.trumpSuit
    );
}


/*
=========================================================
GET GAME STATE
=========================================================

Внутреннее состояние игры.

Позже Socket.IO будет создавать
безопасное публичное состояние
отдельно для каждого игрока.
=========================================================
*/

function getGameState(game) {

    return {

        gameId:
            game.gameId,

        status:
            game.status,

        phase:
            game.phase,

        players:
            game.players.map(
                player => ({

                    playerId:
                        player.playerId,

                    handSize:
                        player.hand.length,

                    connected:
                        player.connected,

                    eliminated:
                        player.eliminated

                })
            ),

        deckSize:
            game.deck.length,

        trumpSuit:
            game.trumpSuit,

        table:
            game.table,

        attackerId:
            game.attackerId,

        defenderId:
            game.defenderId,

        turnPlayerId:
            game.turnPlayerId,

        round:
            game.round,

        winnerId:
            game.winnerId,

        loserId:
            game.loserId

    };
}


/*
=========================================================
EXPORTS
=========================================================
*/

module.exports = {

    GAME_STATUS,

    PHASE,

    createPlayer,

    createGame,

    startGame,

    getPlayer,

    getActivePlayers,

    getNextActivePlayer,

    playFirstAttackCard,

    addAttackCard,

    defend,

    takeCards,

    endAttack,

    getCurrentAttackPair,

    getTableCards,

    getPossibleDefenses,

    getGameState

};
