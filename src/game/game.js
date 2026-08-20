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

Он отвечает только за:

- лобби;
- состав игроков;
- игровую механику;
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
        Порядковый номер выхода
        из партии.

        1 = первый вышел
        2 = второй вышел
        и т.д.

        null = ещё не выбыл.
        */

        finishPosition: null

    };

}


/*
=========================================================
CREATE GAME / LOBBY
=========================================================

Игра создаётся как лобби.

В лобби может находиться:

1–3 игрока.

Но начать игру можно только
при достижении MIN_PLAYERS.

Для текущего проекта:

MIN_PLAYERS = 2
MAX_PLAYERS = 3
=========================================================
*/

function createGame({
    gameId,
    playerIds = []
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

    /*
    Лобби не может быть пустым.

    Комната создаётся конкретным
    первым игроком.
    */

    if (
        playerIds.length < 1 ||
        playerIds.length > MAX_PLAYERS
    ) {
        throw new Error(
            `Lobby requires 1-${MAX_PLAYERS} players`
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

        /*
        Пока игроков меньше MIN_PLAYERS,
        состояние WAITING.

        Даже если игроков уже 2–3,
        игра всё равно остаётся WAITING
        до явного startGame().
        */

        status:
            GAME_STATUS.WAITING,

        phase:
            null,

        players:
            playerIds.map(
                playerId =>
                    createPlayer(playerId)
            ),

        /*
        =====================================================
        LOBBY
        =====================================================
        */

        lobby: {

            /*
            Время создания лобби.
            */

            createdAt:
                Date.now(),

            /*
            Время последнего изменения
            состава игроков.
            */

            updatedAt:
                Date.now()

        },

        /*
        =====================================================
        GAME
        =====================================================
        */

        /*
        Оставшаяся колода.
        */

        deck: [],

        /*
        Открытая козырная карта.
        */

        trumpCard: null,

        trumpSuit: null,

        /*
        Стол.

        Каждая запись:

        {
            attack: Card,
            defense: Card | null
        }
        */

        table: [],

        /*
        Сброшенные карты.
        */

        discard: [],

        /*
        Основной атакующий
        текущего захода.
        */

        attackerId: null,

        /*
        Игрок, который защищается.
        */

        defenderId: null,

        /*
        Игрок, которому принадлежит
        текущее право подкидывать.
        */

        currentAttackPlayerId: null,

        /*
        Кто должен совершить
        действие прямо сейчас.
        */

        turnPlayerId: null,

        /*
        Зафиксированный лимит
        количества атакующих карт
        текущего захода.
        */

        attackLimit: 0,

        /*
        Номер захода.
        */

        round: 0,

        /*
        Результат партии.
        */

        winnerId: null,

        loserId: null,

        /*
        Защита от повторной
        обработки результата.
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
CAN START GAME
=========================================================
*/

function canStartGame(game) {

    if (!game) {
        return false;
    }

    if (
        game.status !==
        GAME_STATUS.WAITING
    ) {
        return false;
    }

    return (
        game.players.length >= MIN_PLAYERS &&
        game.players.length <= MAX_PLAYERS
    );

}


/*
=========================================================
ADD PLAYER TO LOBBY
=========================================================
*/

function addPlayer(
    game,
    playerId
) {

    if (!game) {
        throw new Error(
            "Game is required"
        );
    }

    if (
        typeof playerId !== "string" ||
        playerId.length === 0
    ) {
        throw new Error(
            "Invalid playerId"
        );
    }

    /*
    Добавлять можно только
    в существующее лобби.
    */

    if (
        game.status !==
        GAME_STATUS.WAITING
    ) {
        throw new Error(
            "Game is not in lobby"
        );
    }

    /*
    Проверяем максимальное
    количество игроков.
    */

    if (
        game.players.length >=
        MAX_PLAYERS
    ) {
        throw new Error(
            "Lobby is full"
        );
    }

    /*
    Один playerId не может
    находиться в комнате дважды.
    */

    if (
        getPlayer(
            game,
            playerId
        )
    ) {
        throw new Error(
            "Player is already in lobby"
        );
    }

    const player =
        createPlayer(
            playerId
        );

    game.players.push(
        player
    );

    /*
    Обновляем время изменения
    лобби.
    */

    if (game.lobby) {

        game.lobby.updatedAt =
            Date.now();

    }

    return player;

}


/*
=========================================================
REMOVE PLAYER FROM LOBBY
=========================================================

Удалять игроков можно только
до начала партии.

Если удаляется последний игрок,
сам engine НЕ удаляет объект игры.

Это делает room/server layer.

Здесь просто остаётся players = [].
=========================================================
*/

function removePlayer(
    game,
    playerId
) {

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
            "Player cannot leave after game start"
        );
    }

    const index =
        game.players.findIndex(
            player =>
                player.playerId ===
                playerId
        );

    if (index === -1) {
        throw new Error(
            "Player is not in lobby"
        );
    }

    const removedPlayer =
        game.players.splice(
            index,
            1
        )[0];

    if (game.lobby) {

        game.lobby.updatedAt =
            Date.now();

    }

    return removedPlayer;

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
                player.playerId ===
                playerId
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

Возвращает следующего активного игрока
по кругу.

Порядок игроков фиксирован
порядком добавления в lobby.
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
                player.playerId ===
                playerId
        );

    /*
    Если исходный игрок уже выбыл
    или не найден, берём первого
    активного.
    */

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
                player.playerId ===
                playerId
        );

    const start =
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
REMOVE CARD FROM HAND
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

    if (
        !game ||
        !Array.isArray(game.table)
    ) {
        return [];
    }

    const cards = [];

    for (const pair of game.table) {

        if (!pair) {
            continue;
        }

        if (pair.attack) {
            cards.push(
                pair.attack
            );
        }

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
GET ATTACK CARDS
=========================================================
*/

function getAttackCards(game) {

    if (
        !game ||
        !Array.isArray(game.table)
    ) {
        return [];
    }

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
GET CURRENT UNBEATEN ATTACK
=========================================================
*/

function getCurrentAttackPair(game) {

    if (
        !game ||
        !Array.isArray(game.table)
    ) {
        return null;
    }

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
        !game ||
        !Array.isArray(game.table)
    ) {
        return false;
    }

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
*/

function findFirstAttacker(game) {

    let result = null;

    for (const player of game.players) {

        for (const card of player.hand) {

            if (!isCard(card)) {
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

    /*
    ВАЖНО:

    В лобби может быть 1 игрок,
    но стартовать можно только
    когда собрано 2–3 игрока.
    */

    if (
        !canStartGame(game)
    ) {
        throw new Error(
            `Game requires ${MIN_PLAYERS}-${MAX_PLAYERS} players to start`
        );
    }

    /*
    Создаём новую колоду.
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

    /*
    Полный сброс игрового состояния.
    */

    game.table = [];

    game.discard = [];

    game.trumpCard = null;

    game.trumpSuit = null;

    game.round = 1;

    game.winnerId = null;

    game.loserId = null;

    game.resultProcessed = false;

    game.finishOrder = [];

    game.finishedAt = null;

    game.currentAttackPlayerId = null;

    game.turnPlayerId = null;

    game.attackerId = null;

    game.defenderId = null;

    game.attackLimit = 0;

    /*
    Подготовка игроков.
    */

    for (const player of game.players) {

        player.hand = [];

        player.eliminated = false;

        player.finishPosition = null;

        player.connected = true;

    }

    /*
    Раздаём по 6 карт каждому.
    */

    for (const player of game.players) {

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

            player.hand.push(
                card
            );

        }

    }

    /*
    Последняя карта оставшейся
    колоды определяет козырь.

    Она НЕ извлекается.
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
    Определяем первого атакующего.
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

    game.currentAttackPlayerId =
        firstAttacker.playerId;

    game.turnPlayerId =
        firstAttacker.playerId;

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

    if (attacker.eliminated) {
        throw new Error(
            "Attacker is eliminated"
        );
    }

    if (defender.eliminated) {
        throw new Error(
            "Defender is eliminated"
        );
    }

    if (
        attacker.playerId ===
        defender.playerId
    ) {
        throw new Error(
            "Attacker and defender cannot be the same player"
        );
    }

    game.table = [];

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

    game.currentAttackPlayerId =
        game.attackerId;

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
        game.currentAttackPlayerId !==
        playerId
    ) {
        throw new Error(
            "Player does not have attack priority"
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

    if (player.eliminated) {
        throw new Error(
            "Eliminated player cannot attack"
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

    if (
        game.attackLimit <= 0
    ) {

        const defender =
            game.defenderId
                ? getPlayer(
                    game,
                    game.defenderId
                )
                : null;

        game.attackLimit =
            getMaxAttackCards(
                defender
                    ? defender.hand.length
                    : 0
            );

    }

    if (
        game.attackLimit <= 0
    ) {
        throw new Error(
            "Invalid attack limit"
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

    game.currentAttackPlayerId =
        playerId;

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

    if (defender.eliminated) {
        throw new Error(
            "Eliminated player cannot defend"
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

    const remainingAttack =
        getCurrentAttackPair(game);

    if (remainingAttack) {

        game.phase =
            PHASE.DEFENSE;

        game.turnPlayerId =
            game.defenderId;

        return game;

    }

    const nextAttacker =
        getNextAttacker(
            game,
            game.currentAttackPlayerId
        );

    if (!nextAttacker) {

        game.currentAttackPlayerId =
            game.attackerId;

        game.turnPlayerId =
            game.attackerId;

        return game;

    }

    game.currentAttackPlayerId =
        nextAttacker.playerId;

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

    if (
        playerId ===
        game.defenderId
    ) {
        throw new Error(
            "Defender cannot attack"
        );
    }

    if (
        getCurrentAttackPair(game)
    ) {
        throw new Error(
            "Current attack must be defended first"
        );
    }

    if (
        game.turnPlayerId !==
        playerId
    ) {
        throw new Error(
            "It is not this player's attack turn"
        );
    }

    if (
        game.currentAttackPlayerId !==
        playerId
    ) {
        throw new Error(
            "Player does not have attack priority"
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

    if (player.eliminated) {
        throw new Error(
            "Eliminated player cannot attack"
        );
    }

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

    removeCardFromHand(
        player,
        cardId
    );

    game.table.push({

        attack: card,

        defense: null

    });

    game.currentAttackPlayerId =
        playerId;

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

    game.currentAttackPlayerId =
        nextAttacker.playerId;

    game.turnPlayerId =
        nextAttacker.playerId;

    game.round += 1;

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

    if (
        game.currentAttackPlayerId !==
        playerId
    ) {
        throw new Error(
            "Player does not have attack priority"
        );
    }

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

    game.currentAttackPlayerId =
        nextAttacker.playerId;

    game.turnPlayerId =
        nextAttacker.playerId;

    game.round += 1;

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
DRAW CARDS FOR ROUND
=========================================================
*/

function drawCardsForRound(game) {

    if (
        !game ||
        !Array.isArray(game.deck)
    ) {
        return;
    }

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

    const attacker =
        getPlayer(
            game,
            game.attackerId
        );

    if (
        attacker &&
        !attacker.eliminated
    ) {

        order.push(
            attacker
        );

    }

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

        order.push(
            current
        );

    }

    for (const player of order) {

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

            player.hand.push(
                card
            );

        }

    }

}


/*
=========================================================
UPDATE ELIMINATED PLAYERS
=========================================================
*/

function updateEliminatedPlayers(game) {

    if (
        !game ||
        !Array.isArray(game.deck)
    ) {
        return;
    }

    if (
        game.deck.length > 0
    ) {
        return;
    }

    for (const player of game.players) {

        if (player.eliminated) {
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

        game.currentAttackPlayerId = null;

        game.turnPlayerId = null;

        return;

    }

    let attacker =
        getPlayer(
            game,
            game.attackerId
        );

    if (
        !attacker ||
        attacker.eliminated
    ) {

        attacker =
            getNextActivePlayer(
                game,
                game.defenderId
            );

        if (!attacker) {
            attacker =
                activePlayers[0];
        }

        game.attackerId =
            attacker.playerId;

    }

    let defender =
        getPlayer(
            game,
            game.defenderId
        );

    if (
        !defender ||
        defender.eliminated ||
        defender.playerId ===
            game.attackerId
    ) {

        defender =
            getNextActivePlayer(
                game,
                game.attackerId
            );

        if (defender) {

            game.defenderId =
                defender.playerId;

        } else {

            game.defenderId =
                null;

        }

    }

    if (!game.defenderId) {

        game.currentAttackPlayerId =
            null;

        game.turnPlayerId =
            null;

        return;

    }

    game.currentAttackPlayerId =
        game.attackerId;

    game.turnPlayerId =
        game.attackerId;

}


/*
=========================================================
CHECK GAME FINISHED
=========================================================
*/

function checkGameFinished(game) {

    if (!game) {
        return false;
    }

    if (
        game.status ===
        GAME_STATUS.FINISHED
    ) {
        return true;
    }

    if (game.resultProcessed) {
        return (
            game.status ===
            GAME_STATUS.FINISHED
        );
    }

    if (
        game.deck.length > 0
    ) {
        return false;
    }

    updateEliminatedPlayers(game);

    const activePlayers =
        getActivePlayers(game);

    if (
        activePlayers.length <= 1
    ) {

        let winnerId = null;

        if (
            game.finishOrder.length > 0
        ) {

            winnerId =
                game.finishOrder[0];

        }

        let loserId = null;

        if (
            activePlayers.length === 1
        ) {

            loserId =
                activePlayers[0].playerId;

        } else if (
            game.finishOrder.length > 1
        ) {

            loserId =
                game.finishOrder[
                    game.finishOrder.length - 1
                ];

        }

        if (!winnerId) {

            const zeroCardPlayer =
                game.players.find(
                    player =>
                        player.hand.length === 0
                );

            if (zeroCardPlayer) {

                winnerId =
                    zeroCardPlayer.playerId;

            }

        }

        if (
            winnerId &&
            loserId === winnerId
        ) {

            const alternativeLoser =
                activePlayers.find(
                    player =>
                        player.playerId !==
                        winnerId
                );

            loserId =
                alternativeLoser
                    ? alternativeLoser.playerId
                    : null;

        }

        game.status =
            GAME_STATUS.FINISHED;

        game.phase =
            PHASE.FINISHED;

        game.winnerId =
            winnerId;

        game.loserId =
            loserId;

        game.finishedAt =
            Date.now();

        game.currentAttackPlayerId =
            null;

        game.turnPlayerId =
            null;

        game.resultProcessed =
            true;

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
        !game ||
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

    if (defender.eliminated) {
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
        !game ||
        game.status !==
        GAME_STATUS.PLAYING
    ) {
        return [];
    }

    if (
        game.phase !== PHASE.ATTACK &&
        game.phase !== PHASE.DEFENSE
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

    if (
        game.currentAttackPlayerId !==
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

    if (player.eliminated) {
        return [];
    }

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

Безопасное состояние игры.

Руки игроков НЕ раскрываются.

Для lobby дополнительно возвращается:

- playerCount
- minPlayers
- maxPlayers
- canStart
=========================================================
*/

function getGameState(game) {

    if (!game) {
        return null;
    }

    return {

        gameId:
            game.gameId,

        status:
            game.status,

        phase:
            game.phase,

        /*
        =====================================================
        LOBBY
        =====================================================
        */

        playerCount:
            game.players.length,

        minPlayers:
            MIN_PLAYERS,

        maxPlayers:
            MAX_PLAYERS,

        canStart:
            canStartGame(game),

        lobbyCreatedAt:
            game.lobby
                ? game.lobby.createdAt
                : null,

        lobbyUpdatedAt:
            game.lobby
                ? game.lobby.updatedAt
                : null,

        /*
        =====================================================
        PLAYERS
        =====================================================
        */

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

        trumpCard:
            game.trumpCard,

        trumpSuit:
            game.trumpSuit,

        table:
            game.table,

        attackerId:
            game.attackerId,

        defenderId:
            game.defenderId,

        currentAttackPlayerId:
            game.currentAttackPlayerId,

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
            [
                ...game.finishOrder
            ]

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

    canStartGame,

    addPlayer,

    removePlayer,

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
