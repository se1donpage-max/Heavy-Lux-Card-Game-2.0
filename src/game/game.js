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

Авторитетное состояние партии.

Этот модуль НЕ знает ничего о:

- Socket.IO
- Telegram
- комнатах
- балансе
- XP
- рейтинге
- интерфейсе

Он отвечает только за игровую механику.
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
    getDefendableCards,
    getMaxAttackCards
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
PHASE
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

    return {

        gameId,

        status:
            GAME_STATUS.WAITING,

        phase:
            null,

        players:
            playerIds.map(
                playerId =>
                    createPlayer(playerId)
            ),

        deck: [],

        trumpCard: null,

        trumpSuit: null,

        /*
        Пары:

        {
            attack: Card,
            defense: Card | null
        }
        */

        table: [],

        discard: [],

        attackerId: null,

        defenderId: null,

        turnPlayerId: null,

        /*
        Лимит карт текущего захода.

        Фиксируется в момент начала
        атаки и НЕ меняется после
        того, как защитник получает
        карты.
        */

        attackLimit: 0,

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

    return (
        game.players.find(
            player =>
                player.playerId === playerId
        ) || null
    );
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
FIND CARD IN HAND
=========================================================
*/

function findCardInHand(
    player,
    cardId
) {

    return (
        player.hand.find(
            card =>
                card.id === cardId
        ) || null
    );
}


/*
=========================================================
REMOVE CARD
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
GET TABLE CARDS
=========================================================
*/

function getTableCards(game) {

    const cards = [];

    for (const pair of game.table) {

        if (pair.attack) {
            cards.push(pair.attack);
        }

        if (pair.defense) {
            cards.push(pair.defense);
        }

    }

    return cards;
}


/*
=========================================================
GET UNBEATEN ATTACK
=========================================================
*/

function getCurrentAttackPair(game) {

    for (
        let i = game.table.length - 1;
        i >= 0;
        i--
    ) {

        const pair =
            game.table[i];

        if (
            pair &&
            pair.attack &&
            !pair.defense
        ) {
            return pair;
        }

    }

    return null;
}


/*
=========================================================
IS ATTACK COMPLETELY DEFENDED
=========================================================
*/

function isAttackFullyDefended(game) {

    if (
        game.table.length === 0
    ) {
        return false;
    }

    return game.table.every(
        pair =>
            pair.defense !== null
    );
}


/*
=========================================================
FIND FIRST ATTACKER
=========================================================

Игрок с младшим козырем.
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
        game.players.length < MIN_PLAYERS ||
        game.players.length > MAX_PLAYERS
    ) {
        throw new Error(
            "Invalid player count"
        );
    }

    /*
    Новая колода.
    */

    game.deck =
        createShuffledDeck();

    game.table = [];

    game.discard = [];

    game.trumpCard = null;

    game.trumpSuit = null;

    game.round = 1;

    /*
    Раздаём по 6 карт.
    */

    for (const player of game.players) {

        player.hand = [];

        player.eliminated = false;

        for (
            let i = 0;
            i < HAND_SIZE;
            i++
        ) {

            const card =
                drawCard(game.deck);

            if (!card) {
                throw new Error(
                    "Deck ended during deal"
                );
            }

            player.hand.push(card);

        }

    }

    /*
    Верхняя карта оставшейся колоды
    определяет козырь.

    Она остаётся в колоде.
    */

    game.trumpCard =
        game.deck[
            game.deck.length - 1
        ];

    game.trumpSuit =
        getTrumpSuit(
            game.trumpCard
        );

    /*
    Ищем первого атакующего.
    */

    let firstAttacker =
        findFirstAttacker(game);

    /*
    Теоретически козырей может
    не оказаться в руках.

    Тогда первым становится
    первый игрок.
    */

    if (!firstAttacker) {

        firstAttacker =
            game.players[0];

    }

    game.status =
        GAME_STATUS.PLAYING;

    game.phase =
        PHASE.ATTACK;

    game.attackerId =
        firstAttacker.playerId;

    const defender =
        getNextActivePlayer(
            game,
            firstAttacker.playerId
        );

    if (!defender) {
        throw new Error(
            "Unable to determine defender"
        );
    }

    game.defenderId =
        defender.playerId;

    game.turnPlayerId =
        firstAttacker.playerId;

    game.attackLimit =
        0;

    return game;
}


/*
=========================================================
START NEW ATTACK
=========================================================
*/

function prepareNewAttack(game) {

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

    game.table = [];

    /*
    Ключевой момент:

    лимит фиксируется ДО атаки.
    */

    game.attackLimit =
        getMaxAttackCards(
            defender.hand.length
        );

    if (
        game.attackLimit <= 0
    ) {
        throw new Error(
            "Defender has no cards"
        );
    }

    game.phase =
        PHASE.ATTACK;

    game.turnPlayerId =
        game.attackerId;
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
        game.attackerId !== playerId ||
        game.turnPlayerId !== playerId
    ) {
        throw new Error(
            "Player cannot attack now"
        );
    }

    if (
        game.table.length !== 0
    ) {
        throw new Error(
            "First attack card already exists"
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
            "Invalid attack card"
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
            "Not defense phase"
        );
    }

    if (
        game.defenderId !== playerId ||
        game.turnPlayerId !== playerId
    ) {
        throw new Error(
            "Player cannot defend now"
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

    const card =
        findCardInHand(
            defender,
            cardId
        );

    if (!card) {
        throw new Error(
            "Card is not in player's hand"
        );
    }

    if (
        !canDefend(
            pair.attack,
            card,
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
        card;

    /*
    После отбоя игрок остаётся
    защитником текущего захода.

    Теперь атакующие могут подкинуть.
    */

    game.turnPlayerId =
        game.attackerId;

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

    if (
        game.phase !==
        PHASE.DEFENSE
    ) {
        throw new Error(
            "Not defense phase"
        );
    }

    /*
    Защитник не может подкидывать.
    */

    if (
        playerId ===
        game.defenderId
    ) {
        throw new Error(
            "Defender cannot attack"
        );
    }

    /*
    Подкинуть можно только
    когда предыдущая карта уже отбита.

    Если есть непобитая карта —
    ход защитника.
    */

    if (
        getCurrentAttackPair(game)
    ) {
        throw new Error(
            "Current attack must be defended first"
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

    /*
    В классическом подкидном
    подкидывать могут атакующий
    и другие игроки, кроме защитника.

    Но в нашей модели сначала
    даём право основному атакующему.
    */

    if (
        playerId !==
        game.attackerId
    ) {
        throw new Error(
            "Only attacker can add attack cards"
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

    const tableCards =
        getTableCards(game);

    if (
        !canAddAttackCard(
            card,
            tableCards,
            game.attackLimit
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
            "Not defense phase"
        );
    }

    if (
        game.defenderId !== playerId ||
        game.turnPlayerId !== playerId
    ) {
        throw new Error(
            "Player cannot take cards now"
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
            game.table,
            true
        )
    ) {
        throw new Error(
            "Cannot take cards"
        );
    }

    /*
    Защитник забирает ВСЕ карты
    со стола — и атакующие,
    и уже побитые.
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
    После взятия защитник НЕ становится
    следующим атакующим.

    Атакующим становится игрок
    слева от защитника.
    */

    const nextAttacker =
        getNextActivePlayer(
            game,
            game.defenderId
        );

    if (!nextAttacker) {
        return finishGameAfterRound(
            game
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    const nextDefender =
        getNextActivePlayer(
            game,
            game.attackerId
        );

    if (!nextDefender) {
        return finishGameAfterRound(
            game
        );
    }

    game.defenderId =
        nextDefender.playerId;

    game.round += 1;

    /*
    Добор происходит после
    завершения захода.
    */

    drawCardsForRound(game);

    updateEliminatedPlayers(game);

    if (
        checkGameFinished(game)
    ) {
        return game;
    }

    prepareNewAttack(game);

    return game;
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
            "Not defense phase"
        );
    }

    if (
        playerId !==
        game.attackerId
    ) {
        throw new Error(
            "Player is not attacker"
        );
    }

    /*
    Нельзя закончить атаку,
    если осталась непобитая карта.
    */

    if (
        getCurrentAttackPair(game)
    ) {
        throw new Error(
            "All attack cards must be defended first"
        );
    }

    if (
        !canEndAttack(
            game.table,
            true
        )
    ) {
        throw new Error(
            "Attack cannot be finished"
        );
    }

    /*
    Все карты отправляются
    в сброс.
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
    Следующий атакующий —
    игрок слева от текущего защитника.
    */

    const nextAttacker =
        getNextActivePlayer(
            game,
            game.defenderId
        );

    if (!nextAttacker) {
        return finishGameAfterRound(
            game
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    const nextDefender =
        getNextActivePlayer(
            game,
            game.attackerId
        );

    if (!nextDefender) {
        return finishGameAfterRound(
            game
        );
    }

    game.defenderId =
        nextDefender.playerId;

    game.round += 1;

    /*
    Добор после успешной защиты.
    */

    drawCardsForRound(game);

    updateEliminatedPlayers(game);

    if (
        checkGameFinished(game)
    ) {
        return game;
    }

    prepareNewAttack(game);

    return game;
}


/*
=========================================================
DRAW CARDS
=========================================================

Порядок:

1. атакующий
2. следующий игрок
3. следующий игрок

Каждый добирает до 6.
=========================================================
*/

function drawCardsForRound(game) {

    if (
        game.deck.length === 0
    ) {
        return;
    }

    const order = [];

    let current =
        getPlayer(
            game,
            game.attackerId
        );

    if (!current) {
        return;
    }

    for (
        let i = 0;
        i < game.players.length;
        i++
    ) {

        if (
            current &&
            !current.eliminated
        ) {
            order.push(current);
        }

        current =
            getNextActivePlayer(
                game,
                current.playerId
            );

        if (!current) {
            break;
        }

    }

    for (const player of order) {

        while (
            player.hand.length < HAND_SIZE &&
            game.deck.length > 0
        ) {

            const card =
                drawCard(game.deck);

            if (!card) {
                break;
            }

            player.hand.push(card);

        }

    }
}


/*
=========================================================
UPDATE ELIMINATED PLAYERS
=========================================================

Пока колода не пуста,
игрок с 0 картами ещё не считается
окончательно вышедшим.

Когда колода закончилась,
игрок с 0 картами выходит.
=========================================================
*/

function updateEliminatedPlayers(game) {

    if (
        game.deck.length > 0
    ) {
        return;
    }

    for (const player of game.players) {

        if (
            !player.eliminated &&
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

    if (
        game.status ===
        GAME_STATUS.FINISHED
    ) {
        return true;
    }

    /*
    При закончившейся колоде
    определяем игроков без карт.
    */

    updateEliminatedPlayers(game);

    const activePlayers =
        getActivePlayers(game);

    /*
    В игре должен остаться
    максимум один игрок с картами.
    */

    if (
        activePlayers.length <= 1
    ) {

        const loser =
            activePlayers[0] || null;

        const winners =
            game.players.filter(
                player =>
                    player.eliminated
            );

        const winner =
            winners.length > 0
                ? winners[winners.length - 1]
                : null;

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
FINISH GAME AFTER ROUND
=========================================================
*/

function finishGameAfterRound(game) {

    updateEliminatedPlayers(game);

    checkGameFinished(game);

    return game;
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
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        return [];
    }

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
GET POSSIBLE ATTACKS
=========================================================
*/

function getPossibleAttacks(
    game,
    playerId
) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        return [];
    }

    if (
        game.attackerId !==
        playerId
    ) {
        return [];
    }

    const player =
        getPlayer(
            game,
            playerId
        );

    if (!player) {
        return [];
    }

    /*
    Первая атака.
    */

    if (
        game.table.length === 0
    ) {

        return player.hand.filter(
            card =>
                canAttack(card)
        );

    }

    /*
    Если есть непобитая карта,
    подкинуть нельзя.
    */

    if (
        getCurrentAttackPair(game)
    ) {
        return [];
    }

    return player.hand.filter(
        card =>
            canAddAttackCard(
                card,
                getTableCards(game),
                game.attackLimit
            )
    );
}


/*
=========================================================
GET GAME STATE
=========================================================

Внутреннее состояние.

Позже server.js создаст
безопасную персональную версию
для каждого клиента.
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

        attackLimit:
            game.attackLimit,

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

    getPossibleAttacks,

    getGameState

};
