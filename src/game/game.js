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

        eliminated: false,

        /*
        Порядковый номер выхода из игры.

        null = ещё не выбыл.
        */

        finishPosition: null

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

        /*
        Основной атакующий текущего захода.

        Для 2 игроков это единственный атакующий.

        Для 3 игроков это первый игрок,
        но подкидывать могут и остальные.
        */

        attackerId: null,

        /*
        Игрок, который сейчас защищается.
        */

        defenderId: null,

        /*
        Кто сейчас должен сделать действие.
        */

        turnPlayerId: null,

        /*
        Фиксированный лимит карт текущего захода.

        НЕ меняется после начала захода.
        */

        attackLimit: 0,

        round: 0,

        winnerId: null,

        loserId: null,

        /*
        Защищённый флаг.
        Server сможет безопасно вызвать
        processGameFinished повторно,
        не изменяя игровой результат.
        */

        resultProcessed: false,

        /*
        Порядок выбывания.
        */

        finishOrder: [],

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

    if (!game) {
        return null;
    }

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

    if (!game) {
        return [];
    }

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
GET NEXT ATTACKER
=========================================================

Ищет следующего активного игрока,
который НЕ является защитником.

Это важно для 3 игроков.

Например:

A = атакующий
B = защитник
C = третий игрок

После защиты B:

C получает право подкинуть.

После защиты C:

A получает право подкинуть.

=========================================================
*/

function getNextAttacker(
    game,
    playerId
) {

    const activePlayers =
        getActivePlayers(game);

    if (
        activePlayers.length < 2
    ) {
        return null;
    }

    const startIndex =
        activePlayers.findIndex(
            player =>
                player.playerId === playerId
        );

    let start =
        startIndex >= 0
            ? startIndex
            : 0;

    for (
        let offset = 1;
        offset <= activePlayers.length;
        offset++
    ) {

        const candidate =
            activePlayers[
                (start + offset) %
                activePlayers.length
            ];

        if (
            candidate.playerId !==
            game.defenderId
        ) {
            return candidate;
        }

    }

    return null;

}


/*
=========================================================
GET ATTACKERS
=========================================================
*/

function getAttackers(game) {

    if (!game) {
        return [];
    }

    return getActivePlayers(game).filter(
        player =>
            player.playerId !==
            game.defenderId
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

    if (!player) {
        return null;
    }

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

    if (!player) {
        return null;
    }

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
GET ATTACK CARDS
=========================================================
*/

function getAttackCards(game) {

    return game.table
        .filter(
            pair =>
                pair &&
                pair.attack
        )
        .map(
            pair =>
                pair.attack
        );

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
            pair &&
            pair.attack &&
            pair.defense
    );

}


/*
=========================================================
FIND FIRST ATTACKER
=========================================================

Игрок с младшим козырем.

Если козырей ни у кого нет —
первый игрок.
=========================================================
*/

function findFirstAttacker(game) {

    let result = null;

    for (const player of game.players) {

        for (const card of player.hand) {

            if (
                !isCard(card)
            ) {
                continue;
            }

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

    if (
        !Array.isArray(game.deck) ||
        game.deck.length !== 36
    ) {
        throw new Error(
            "Invalid 36-card deck"
        );
    }

    game.table = [];

    game.discard = [];

    game.trumpCard = null;

    game.trumpSuit = null;

    game.round = 1;

    game.resultProcessed = false;

    game.finishOrder = [];

    /*
    Раздача по 6 карт.
    */

    for (const player of game.players) {

        player.hand = [];

        player.eliminated = false;

        player.finishPosition = null;

        player.connected = true;

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

    Карта остаётся в колоде.
    */

    game.trumpCard =
        game.deck[
            game.deck.length - 1
        ];

    game.trumpSuit =
        getTrumpSuit(
            game.trumpCard
        );

    if (!game.trumpSuit) {
        throw new Error(
            "Unable to determine trump suit"
        );
    }

    /*
    Первый атакующий.
    */

    let firstAttacker =
        findFirstAttacker(game);

    if (!firstAttacker) {
        firstAttacker =
            game.players[0];
    }

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

    game.status =
        GAME_STATUS.PLAYING;

    game.phase =
        PHASE.ATTACK;

    game.attackerId =
        firstAttacker.playerId;

    game.defenderId =
        defender.playerId;

    game.turnPlayerId =
        firstAttacker.playerId;

    /*
    До первого захода лимит
    ещё не зафиксирован.
    */

    game.attackLimit = 0;

    return game;

}


/*
=========================================================
PREPARE NEW ATTACK
=========================================================
*/

function prepareNewAttack(game) {

    if (
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        throw new Error(
            "Game is not active"
        );
    }

    const attacker =
        getPlayer(
            game,
            game.attackerId
        );

    const defender =
        getPlayer(
            game,
            game.defenderId
        );

    if (!attacker) {
        throw new Error(
            "Attacker not found"
        );
    }

    if (!defender) {
        throw new Error(
            "Defender not found"
        );
    }

    if (
        attacker.eliminated
    ) {
        throw new Error(
            "Attacker is eliminated"
        );
    }

    if (
        defender.eliminated
    ) {
        throw new Error(
            "Defender is eliminated"
        );
    }

    game.table = [];

    /*
    Лимит фиксируется один раз —
    в начале захода.

    После этого он НЕ меняется.
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

    return game;

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
        game.attackerId !==
        playerId
    ) {
        throw new Error(
            "Player is not the main attacker"
        );
    }

    if (
        game.turnPlayerId !==
        playerId
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

    /*
    Теперь ход защитника.
    */

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
    Если есть ещё непобитая карта,
    защитник продолжает защищаться.

    Это важно:
    нельзя передавать ход атакующим,
    пока последний атакующий не побит.
    */

    if (
        getCurrentAttackPair(game)
    ) {

        game.phase =
            PHASE.DEFENSE;

        game.turnPlayerId =
            game.defenderId;

        return game;

    }

    /*
    Всё побито.

    Теперь право подкинуть получает
    следующий атакующий.

    Для 2 игроков это снова
    первоначальный атакующий.

    Для 3 игроков это будет
    третий игрок, затем первый.
    */

    const nextAttacker =
        getNextAttacker(
            game,
            game.defenderId
        );

    if (!nextAttacker) {

        game.turnPlayerId =
            game.attackerId;

        return game;

    }

    game.phase =
        PHASE.DEFENSE;

    game.turnPlayerId =
        nextAttacker.playerId;

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
    Защитник никогда не атакует
    в рамках текущего захода.
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
    Если предыдущая карта ещё
    не отбита — атаковать нельзя.
    */

    if (
        getCurrentAttackPair(game)
    ) {
        throw new Error(
            "Current attack must be defended first"
        );
    }

    /*
    Только игрок, которому сейчас
    передано право подкидывать.
    */

    if (
        game.turnPlayerId !==
        playerId
    ) {
        throw new Error(
            "It is not this player's attack turn"
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

    if (
        player.eliminated
    ) {
        throw new Error(
            "Eliminated player cannot attack"
        );
    }

    /*
    На первом заходе подкинуть
    может только основной атакующий.
    */

    if (
        game.table.length === 0 &&
        playerId !== game.attackerId
    ) {
        throw new Error(
            "Only main attacker can start attack"
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
            game.table,
            game.attackLimit
        )
    ) {
        throw new Error(
            "Card cannot be added to attack"
        );
    }

    /*
    Удаляем карту только после
    полной проверки.
    */

    removeCardFromHand(
        player,
        cardId
    );

    game.table.push({

        attack: card,

        defense: null

    });

    /*
    После подкидывания снова
    защищается тот же игрок.
    */

    game.phase =
        PHASE.DEFENSE;

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

    /*
    В rules.js canTake должен запрещать
    взятие полностью отбитого стола.
    */

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
    Защитник забирает ВСЕ карты.
    */

    for (const pair of game.table) {

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

    game.table = [];

    /*
    После взятия текущий защитник
    НЕ становится атакующим.

    Следующим атакует игрок слева
    от защитника.
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

    /*
    Новый защитник — игрок слева
    от нового атакующего.
    */

    const nextDefender =
        getNextActivePlayer(
            game,
            nextAttacker.playerId
        );

    if (!nextDefender) {
        return finishGameAfterRound(
            game
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    game.defenderId =
        nextDefender.playerId;

    game.round += 1;

    /*
    Сначала добор.
    */

    drawCardsForRound(game);

    /*
    Проверяем, кто выбыл.
    */

    updateEliminatedPlayers(game);

    if (
        checkGameFinished(game)
    ) {
        return game;
    }

    /*
    Удаляем выбывших из возможных
    участников и выбираем новый заход.
    */

    normalizeTurnPlayers(game);

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

    /*
    Завершить атаку может любой
    активный атакующий.

    Но только тот, чей сейчас ход.
    */

    if (
        playerId ===
        game.defenderId
    ) {
        throw new Error(
            "Defender cannot end attack"
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

    /*
    Нельзя закончить заход,
    пока есть непобитая карта.
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
    Все карты идут в сброс.
    */

    for (const pair of game.table) {

        if (pair.attack) {

            game.discard.push(
                pair.attack
            );

        }

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

    const nextDefender =
        getNextActivePlayer(
            game,
            nextAttacker.playerId
        );

    if (!nextDefender) {
        return finishGameAfterRound(
            game
        );
    }

    game.attackerId =
        nextAttacker.playerId;

    game.defenderId =
        nextDefender.playerId;

    game.round += 1;

    /*
    Добор после отбоя.
    */

    drawCardsForRound(game);

    updateEliminatedPlayers(game);

    if (
        checkGameFinished(game)
    ) {
        return game;
    }

    normalizeTurnPlayers(game);

    prepareNewAttack(game);

    return game;

}


/*
=========================================================
DRAW CARDS
=========================================================

Порядок добора:

1. атакующий;
2. остальные активные игроки
   по кругу.

Каждый добирает до 6.

Добор происходит только из
фактически оставшейся колоды.
=========================================================
*/

function drawCardsForRound(game) {

    if (
        game.deck.length === 0
    ) {
        return;
    }

    const activePlayers =
        getActivePlayers(game);

    if (
        activePlayers.length === 0
    ) {
        return;
    }

    const order = [];

    /*
    Первый — текущий атакующий.
    */

    const attacker =
        getPlayer(
            game,
            game.attackerId
        );

    if (
        attacker &&
        !attacker.eliminated
    ) {
        order.push(attacker);
    }

    /*
    Затем остальные игроки
    по кругу.
    */

    let current =
        attacker;

    if (!current) {
        current =
            activePlayers[0];
    }

    for (
        let i = 0;
        i < activePlayers.length;
        i++
    ) {

        current =
            getNextActivePlayer(
                game,
                current.playerId
            );

        if (!current) {
            break;
        }

        if (
            order.some(
                player =>
                    player.playerId ===
                    current.playerId
            )
        ) {
            break;
        }

        order.push(current);

    }

    /*
    Добор каждого игрока до 6.
    */

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

Игрок с 0 картами считается
выбывшим только после того,
как закончилась колода.

Это важно.

Пока в колоде ещё есть карты,
нулевая рука не означает окончательный
проигрыш.
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
            player.eliminated
        ) {
            continue;
        }

        if (
            player.hand.length === 0
        ) {

            player.eliminated = true;

            player.finishPosition =
                game.finishOrder.length + 1;

            game.finishOrder.push(
                player.playerId
            );

        }

    }

}


/*
=========================================================
NORMALIZE TURN PLAYERS
=========================================================
*/

function normalizeTurnPlayers(game) {

    const activePlayers =
        getActivePlayers(game);

    if (
        activePlayers.length === 0
    ) {
        game.attackerId = null;
        game.defenderId = null;
        game.turnPlayerId = null;
        return;
    }

    /*
    Если текущий атакующий выбыл,
    выбираем следующего.
    */

    const attacker =
        getPlayer(
            game,
            game.attackerId
        );

    if (
        !attacker ||
        attacker.eliminated
    ) {

        const next =
            getNextActivePlayer(
                game,
                game.defenderId
            );

        game.attackerId =
            next
                ? next.playerId
                : activePlayers[0].playerId;

    }

    /*
    Защитник не может совпадать
    с атакующим.
    */

    let defender =
        getPlayer(
            game,
            game.defenderId
        );

    if (
        !defender ||
        defender.eliminated ||
        defender.playerId === game.attackerId
    ) {

        defender =
            getNextActivePlayer(
                game,
                game.attackerId
            );

        game.defenderId =
            defender
                ? defender.playerId
                : null;

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
    Пока колода не закончилась,
    окончательная классификация
    невозможна.
    */

    if (
        game.deck.length > 0
    ) {
        return false;
    }

    updateEliminatedPlayers(game);

    const activePlayers =
        getActivePlayers(game);

    /*
    Все кроме одного выбыли.
    */

    if (
        activePlayers.length <= 1
    ) {

        const loser =
            activePlayers.length === 1
                ? activePlayers[0]
                : null;

        /*
        Последний оставшийся игрок —
        проигравший.

        Игроки, которые вышли раньше,
        являются победителями/занявшими места.
        Для текущего API winnerId оставляем
        последнего выбывшего победителя.
        */

        let winnerId = null;

        if (
            game.finishOrder.length > 0
        ) {

            winnerId =
                game.finishOrder[
                    game.finishOrder.length - 1
                ];

        }

        /*
        Если по какой-либо причине
        победитель не определён,
        берём первого выбывшего.
        */

        if (!winnerId) {

            winnerId =
                game.players.find(
                    player =>
                        player.eliminated
                )?.playerId ||
                null;

        }

        game.status =
            GAME_STATUS.FINISHED;

        game.phase =
            PHASE.FINISHED;

        game.winnerId =
            winnerId;

        game.loserId =
            loser
                ? loser.playerId
                : null;

        game.finishedAt =
            Date.now();

        game.turnPlayerId =
            null;

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
        game.phase !==
        PHASE.DEFENSE
    ) {
        return [];
    }

    if (
        game.defenderId !==
        playerId
    ) {
        return [];
    }

    if (
        game.turnPlayerId !==
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
        game.phase !==
        PHASE.ATTACK &&
        game.phase !==
        PHASE.DEFENSE
    ) {
        return [];
    }

    if (
        playerId ===
        game.defenderId
    ) {
        return [];
    }

    if (
        game.turnPlayerId !==
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
    Первый заход.
    */

    if (
        game.table.length === 0
    ) {

        if (
            playerId !==
            game.attackerId
        ) {
            return [];
        }

        return player.hand.filter(
            card =>
                canAttack(card)
        );

    }

    /*
    Непобитая карта блокирует
    подкидывание.
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
                game.table,
                game.attackLimit
            )
    );

}


/*
=========================================================
GET GAME STATE
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
                        player.eliminated,

                    finishPosition:
                        player.finishPosition

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
            game.loserId,

        finishOrder:
            [...game.finishOrder]

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

    getNextAttacker,

    getAttackers,

    playFirstAttackCard,

    addAttackCard,

    defend,

    takeCards,

    endAttack,

    getCurrentAttackPair,

    getTableCards,

    getAttackCards,

    isAttackFullyDefended,

    getPossibleDefenses,

    getPossibleAttacks,

    getGameState

};
