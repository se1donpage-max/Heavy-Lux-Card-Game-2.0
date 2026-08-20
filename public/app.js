"use strict";

/*
=========================================================
HEAVY LUX CARD
FRONTEND
=========================================================

Frontend отвечает за:

- интерфейс
- навигацию
- отображение состояния
- Socket.IO
- отправку пользовательских действий
- Telegram WebApp
- локальные UI-состояния

ВАЖНО:

Игровая логика НЕ находится здесь.

Сервер является авторитетным источником:

- баланса
- XP
- рейтинга
- автомобилей
- номеров
- имущества
- комнат
- карт
- ходов
- ставок
- результатов партии
=========================================================
*/


/* =========================================================
   STATE
========================================================= */

const state = {

    currentScreen: "home",

    playTab: "create",

    players: 2,

    bet: 100,

    balance: 0,

    level: 1,

    xp: 0,

    rating: 1000,

    wins: 0,

    losses: 0,

    games: 0,

    playerName: "Игрок",

    playerAvatar: "V",

    playerId: null,

    telegramId: null,

    connected: false,

    authenticated: false,

    gameActive: false,

    roomId: null,

    selectedCard: null,

    gameState: null,

    lobbies: [],

    vehicles: [],

    plates: [],

    property: [],

    businesses: []

};


/* =========================================================
   SOCKET
========================================================= */

let socket = null;


/* =========================================================
   HELPERS
========================================================= */

function $(selector) {

    return document.querySelector(selector);

}


function $$(selector) {

    return [
        ...document.querySelectorAll(selector)
    ];

}


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("ru-RU");

}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function showToast(message) {

    const toast = $("#toast");

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(
        showToast.timer
    );

    showToast.timer = setTimeout(
        () => {

            toast.classList.remove("show");

        },
        2200
    );

}


function safeText(selector, value) {

    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }

}


/* =========================================================
   SCREEN NAVIGATION
========================================================= */

function openScreen(screenName) {

    const target =
        document.getElementById(
            `screen-${screenName}`
        );

    if (!target) {
        return;
    }

    $$(".screen").forEach(
        screen => {

            screen.classList.toggle(
                "active",
                screen === target
            );

        }
    );


    $$(".nav-button").forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.screen === screenName
            );

        }
    );


    state.currentScreen =
        screenName;


    window.scrollTo({
        top: 0,
        behavior: "instant"
    });

}


function initNavigation() {

    $$("[data-screen]")
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        const screen =
                            element.dataset.screen;

                        if (!screen) {
                            return;
                        }

                        openScreen(screen);

                    }
                );

            }
        );

}


/* =========================================================
   PLAY TABS
========================================================= */

function initPlayTabs() {

    $$("[data-play-tab]")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const tab =
                            button.dataset.playTab;

                        state.playTab =
                            tab;


                        $$("[data-play-tab]")
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );

                                }
                            );


                        $$(".play-panel")
                            .forEach(
                                panel => {

                                    panel.classList.toggle(
                                        "active",
                                        panel.id ===
                                            `play-${tab}`
                                    );

                                }
                            );


                        if (tab === "find") {

                            requestLobbyList();

                        }

                    }
                );

            }
        );

}


/* =========================================================
   PLAYER COUNT
========================================================= */

function initPlayerChoices() {

    $$("[data-players]")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const players =
                            Number(
                                button.dataset.players
                            );

                        if (
                            !Number.isInteger(players)
                        ) {
                            return;
                        }

                        state.players =
                            players;


                        $$("[data-players]")
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );

                                }
                            );


                        safeText(
                            "#previewPlayers",
                            state.players
                        );

                    }
                );

            }
        );

}


/* =========================================================
   BET
========================================================= */

function initBetChoices() {

    $$(".bet")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const bet =
                            Number(
                                button.dataset.bet
                            );

                        if (
                            !Number.isFinite(bet) ||
                            bet <= 0
                        ) {
                            return;
                        }

                        state.bet =
                            bet;


                        $$(".bet")
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );

                                }
                            );


                        safeText(
                            "#previewBet",
                            `${formatNumber(state.bet)} HC`
                        );

                    }
                );

            }
        );

}


/* =========================================================
   CONNECTION UI
========================================================= */

function updateConnectionStatus(
    connected,
    text
) {

    const container =
        $("#connectionStatus");

    const label =
        $("#connectionText");

    if (!container) {
        return;
    }

    container.classList.toggle(
        "online",
        Boolean(connected)
    );

    container.classList.toggle(
        "offline",
        !connected
    );

    if (label) {

        label.textContent =
            text ||
            (
                connected
                    ? "Подключено"
                    : "Нет соединения"
            );

    }

}


/* =========================================================
   SOCKET INIT
========================================================= */

function initSocket() {

    if (
        typeof window.io !==
        "function"
    ) {

        updateConnectionStatus(
            false,
            "Socket.IO недоступен"
        );

        return;

    }


    try {

        socket =
            window.io(
                window.location.origin,
                {

                    transports: [
                        "websocket",
                        "polling"
                    ],

                    reconnection: true,

                    reconnectionAttempts:
                        Infinity,

                    reconnectionDelay:
                        1000,

                    reconnectionDelayMax:
                        5000,

                    timeout:
                        20000

                }
            );


        registerSocketEvents();


    }
    catch (error) {

        console.error(
            "[Heavy Lux] Socket init error:",
            error
        );

        updateConnectionStatus(
            false,
            "Ошибка подключения"
        );

    }

}


/* =========================================================
   SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (!socket) {
        return;
    }


    socket.on(
        "connect",
        () => {

            state.connected =
                true;

            updateConnectionStatus(
                true,
                "Подключено"
            );

            console.log(
                "[Heavy Lux] connected:",
                socket.id
            );


            authenticateSocket();

        }
    );


    socket.on(
        "disconnect",
        reason => {

            state.connected =
                false;

            updateConnectionStatus(
                false,
                "Соединение потеряно"
            );

            console.warn(
                "[Heavy Lux] disconnected:",
                reason
            );


            /*
            Socket.IO автоматически
            пытается переподключиться
            при обычном разрыве.

            Если сервер принудительно
            разорвал соединение, можно
            инициировать connect().
            */

            if (
                reason ===
                "io server disconnect"
            ) {

                setTimeout(
                    () => {

                        if (
                            socket &&
                            !socket.connected
                        ) {

                            socket.connect();

                        }

                    },
                    1000
                );

            }

        }
    );


    socket.on(
        "connect_error",
        error => {

            state.connected =
                false;

            updateConnectionStatus(
                false,
                "Сервер недоступен"
            );

            console.warn(
                "[Heavy Lux] connect_error:",
                error?.message || error
            );

        }
    );


    socket.on(
        "profile",
        profile => {

            applyProfile(profile);

        }
    );


    socket.on(
        "lobbyList",
        payload => {

            renderLobbyList(
                Array.isArray(payload)
                    ? payload
                    : payload?.lobbies
            );

        }
    );


    socket.on(
        "lobbies",
        payload => {

            renderLobbyList(
                Array.isArray(payload)
                    ? payload
                    : payload?.lobbies
            );

        }
    );


    socket.on(
        "lobbyCreated",
        lobby => {

            if (!lobby) {
                return;
            }

            state.roomId =
                lobby.id ||
                lobby.lobbyId ||
                null;


            showToast(
                "Лобби создано"
            );


            openScreen("play");


            switchPlayTab("find");

            requestLobbyList();

        }
    );


    socket.on(
        "lobbyJoined",
        payload => {

            const lobby =
                payload?.lobby ||
                payload;

            if (!lobby) {
                return;
            }

            state.roomId =
                lobby.id ||
                lobby.lobbyId ||
                payload?.roomId ||
                null;


            showToast(
                "Вы вошли в лобби"
            );


            if (
                payload?.gameStarted ||
                lobby.gameStarted
            ) {

                openGame(
                    payload?.game ||
                    lobby.gameState ||
                    null
                );

            }

        }
    );


    socket.on(
        "roomState",
        roomState => {

            applyRoomState(
                roomState
            );

        }
    );


    socket.on(
        "gameState",
        gameState => {

            applyGameState(
                gameState
            );

        }
    );


    socket.on(
        "gameStarted",
        gameState => {

            openGame(
                gameState
            );

        }
    );


    socket.on(
        "gameEnded",
        result => {

            handleGameEnded(
                result
            );

        }
    );


    socket.on(
        "gameResult",
        result => {

            handleGameEnded(
                result
            );

        }
    );


    socket.on(
        "errorMessage",
        message => {

            showToast(
                normalizeServerMessage(message)
            );

        }
    );


    socket.on(
        "serverError",
        message => {

            showToast(
                normalizeServerMessage(message)
            );

        }
    );


    socket.on(
        "actionError",
        message => {

            showToast(
                normalizeServerMessage(message)
            );

        }
    );


    socket.on(
        "purchaseResult",
        result => {

            if (
                result?.success === false
            ) {

                showToast(
                    result.message ||
                    "Покупка не выполнена"
                );

                return;

            }

            showToast(
                result?.message ||
                "Покупка выполнена"
            );

            requestProfile();

        }
    );


    socket.on(
        "garage",
        payload => {

            applyGarage(
                payload
            );

        }
    );


    socket.on(
        "market",
        payload => {

            renderMarket(
                Array.isArray(payload)
                    ? payload
                    : payload?.items
            );

        }
    );


    socket.on(
        "quickMessage",
        payload => {

            if (
                payload?.text
            ) {

                showToast(
                    payload.text
                );

            }

        }
    );

}


/* =========================================================
   AUTH
========================================================= */

function authenticateSocket() {

    if (!socket) {
        return;
    }


    const telegram =
        getTelegramUser();


    if (telegram) {

        state.telegramId =
            telegram.id;

        state.playerId =
            String(
                telegram.id
            );


        /*
        Основной вариант для Telegram.

        Server должен сам проверить
        initData / initDataUnsafe
        по своей авторизационной схеме.
        */

        socket.emit(
            "auth",
            {

                telegramId:
                    telegram.id,

                initData:
                    window.Telegram?.WebApp
                        ?.initData || "",

                user:
                    telegram

            }
        );

        return;

    }


    /*
    Обычный браузерный режим.

    Сервер может выдать playerId
    или создать гостевого игрока.
    */

    socket.emit(
        "auth",
        {

            playerId:
                state.playerId

        }
    );

}


/* =========================================================
   PROFILE
========================================================= */

function requestProfile() {

    if (
        !socket ||
        !socket.connected
    ) {
        return;
    }

    socket.emit(
        "getProfile"
    );

}


function applyProfile(profile) {

    if (!profile) {
        return;
    }


    const source =
        profile.profile ||
        profile;


    state.playerId =
        source.playerId ??
        state.playerId;


    state.telegramId =
        source.telegramId ??
        state.telegramId;


    state.playerName =
        source.name ||
        source.username ||
        state.playerName;


    state.balance =
        Number(
            source.balance ??
            state.balance
        );


    state.level =
        Number(
            source.level?.level ??
            source.level ??
            state.level
        );


    state.xp =
        Number(
            source.xp ??
            source.level?.xp ??
            state.xp
        );


    state.rating =
        Number(
            source.rating ??
            state.rating
        );


    state.wins =
        Number(
            source.stats?.wins ??
            source.wins ??
            state.wins
        );


    state.losses =
        Number(
            source.stats?.losses ??
            source.losses ??
            state.losses
        );


    state.games =
        Number(
            source.stats?.games ??
            source.games ??
            state.games
        );


    state.authenticated =
        true;


    updateProfileUI();

}


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

    safeText(
        "#topBalance",
        formatNumber(state.balance)
    );


    safeText(
        "#homeLevel",
        state.level
    );


    safeText(
        "#homeWins",
        state.wins
    );


    safeText(
        "#homeLosses",
        state.losses
    );


    safeText(
        "#homeRating",
        state.rating
    );


    safeText(
        "#profileLevel",
        state.level
    );


    safeText(
        "#profileRating",
        state.rating
    );


    safeText(
        "#profileWins",
        state.wins
    );


    safeText(
        "#profileLosses",
        state.losses
    );


    safeText(
        "#profileGames",
        state.games
    );


    safeText(
        "#profileXP",
        state.xp
    );


    safeText(
        "#homeName",
        state.playerName
    );


    safeText(
        "#profileName",
        state.playerName
    );


    const avatar =
        state.playerAvatar ||
        state.playerName
            ?.charAt(0)
            ?.toUpperCase() ||
        "V";


    safeText(
        "#homeAvatar",
        avatar
    );


    safeText(
        "#profileAvatar",
        avatar
    );


    safeText(
        "#homeRank",
        getRankName(state.rating)
    );


    safeText(
        "#profileRank",
        getRankName(state.rating)
    );

}


function getRankName(rating) {

    if (rating >= 1800) {
        return "ЭЛИТА";
    }

    if (rating >= 1600) {
        return "МАСТЕР";
    }

    if (rating >= 1400) {
        return "ВЕТЕРАН";
    }

    if (rating >= 1200) {
        return "ОПЫТНЫЙ";
    }

    return "НОВИЧОК";

}


/* =========================================================
   CREATE LOBBY
========================================================= */

function createLobby() {

    if (
        !socket ||
        !socket.connected
    ) {

        showToast(
            "Нет соединения с сервером"
        );

        return;

    }


    if (
        state.balance <
        state.bet
    ) {

        showToast(
            "Недостаточно HC"
        );

        return;

    }


    socket.emit(
        "createLobby",
        {

            players:
                state.players,

            bet:
                state.bet,

            mode:
                "podkidnoy",

            deckSize:
                36

        }
    );


    showToast(
        "Создаём лобби..."
    );

}


/* =========================================================
   QUICK MATCH
========================================================= */

function quickMatch() {

    if (
        !socket ||
        !socket.connected
    ) {

        showToast(
            "Нет соединения с сервером"
        );

        return;

    }


    socket.emit(
        "quickMatch",
        {

            players:
                state.players,

            bet:
                state.bet

        }
    );


    showToast(
        "Ищем соперника..."
    );

}


/* =========================================================
   REQUEST LOBBIES
========================================================= */

function requestLobbyList() {

    if (
        !socket ||
        !socket.connected
    ) {
        return;
    }


    socket.emit(
        "getLobbies"
    );

}


/* =========================================================
   RENDER LOBBIES
========================================================= */

function renderLobbyList(lobbies) {

    const container =
        $("#lobbyList");

    if (!container) {
        return;
    }


    if (
        !Array.isArray(lobbies)
    ) {

        lobbies = [];

    }


    state.lobbies =
        lobbies;


    if (
        lobbies.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-list">
                Сейчас свободных лобби нет
            </div>
        `;

        return;

    }


    container.innerHTML =
        lobbies.map(
            lobby => {

                const id =
                    lobby.id ??
                    lobby.lobbyId ??
                    "";


                const players =
                    Number(
                        lobby.playersCount ??
                        lobby.currentPlayers ??
                        lobby.players?.length ??
                        0
                    );


                const maxPlayers =
                    Number(
                        lobby.maxPlayers ??
                        lobby.players ??
                        lobby.maxPlayersCount ??
                        2
                    );


                const bet =
                    Number(
                        lobby.bet ??
                        0
                    );


                const name =
                    lobby.name ||
                    "Heavy Room";


                return `
                    <article
                        class="lobby-card"
                        data-lobby-id="${escapeHtml(id)}"
                    >

                        <div class="lobby-head">

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span class="online-dot"></span>

                        </div>


                        <div class="lobby-players">

                            <span>
                                👤
                                ${players}
                                / ${maxPlayers}
                            </span>

                            <span>
                                ${escapeHtml(
                                    lobby.mode ||
                                    "ПОДКИДНОЙ"
                                )}
                            </span>

                        </div>


                        <div class="lobby-info">

                            <span>
                                СТАВКА:
                                <b>
                                    ${formatNumber(bet)}
                                </b>
                            </span>

                            <span>
                                ${players}/${maxPlayers}
                            </span>

                        </div>


                        <button
                            class="small-primary join-lobby"
                            type="button"
                            data-lobby-id="${escapeHtml(id)}"
                            data-bet="${bet}"
                        >
                            ВОЙТИ
                        </button>

                    </article>
                `;

            }
        ).join("");


    $$(".join-lobby")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        joinLobby(
                            button.dataset.lobbyId
                        );

                    }
                );

            }
        );

}


/* =========================================================
   JOIN LOBBY
========================================================= */

function joinLobby(lobbyId) {

    if (!lobbyId) {

        showToast(
            "Комната не найдена"
        );

        return;

    }


    if (
        !socket ||
        !socket.connected
    ) {

        showToast(
            "Нет соединения с сервером"
        );

        return;

    }


    socket.emit(
        "joinLobby",
        {

            lobbyId:
                lobbyId

        }
    );


    showToast(
        "Входим в лобби..."
    );

}


/* =========================================================
   SWITCH PLAY TAB
========================================================= */

function switchPlayTab(tab) {

    const button =
        $(
            `[data-play-tab="${tab}"]`
        );

    if (button) {
        button.click();
    }

}


/* =========================================================
   GAME
========================================================= */

function openGame(gameState = null) {

    state.gameActive =
        true;

    state.selectedCard =
        null;

    state.gameState =
        gameState;


    openScreen(
        "game"
    );


    if (gameState) {

        applyGameState(
            gameState
        );

    }

}


function applyRoomState(roomState) {

    if (!roomState) {
        return;
    }


    state.roomId =
        roomState.roomId ??
        roomState.id ??
        roomState.lobbyId ??
        state.roomId;


    if (
        roomState.gameStarted ||
        roomState.status === "playing"
    ) {

        openGame(
            roomState.gameState ||
            null
        );

    }

}


/* =========================================================
   GAME STATE
========================================================= */

function applyGameState(gameState) {

    if (!gameState) {
        return;
    }


    state.gameState =
        gameState;


    state.gameActive =
        true;


    state.roomId =
        gameState.roomId ??
        gameState.lobbyId ??
        state.roomId;


    safeText(
        "#gameRoomName",
        gameState.roomName ||
        "HEAVY ROOM"
    );


    safeText(
        "#gameRound",
        gameState.round
            ? `РАУНД ${gameState.round}`
            : "ПАРТИЯ"
    );


    safeText(
        "#gameBet",
        `${formatNumber(
            gameState.bet || 0
        )} HC`
    );


    renderTrump(
        gameState.trump ||
        gameState.trumpSuit
    );


    renderOpponents(
        gameState.players ||
        gameState.opponents ||
        []
    );


    renderTable(
        gameState.table ||
        gameState.tableCards ||
        []
    );


    renderHand(
        gameState.hand ||
        gameState.playerHand ||
        []
    );


    renderGameStatus(
        gameState
    );

}


/* =========================================================
   TRUMP
========================================================= */

function renderTrump(trump) {

    safeText(
        "#trumpSuit",
        trump ||
        "—"
    );

}


/* =========================================================
   OPPONENTS
========================================================= */

function renderOpponents(players) {

    const container =
        $("#opponents");

    if (!container) {
        return;
    }


    if (!Array.isArray(players)) {

        container.innerHTML = "";

        return;

    }


    const currentPlayerId =
        state.playerId;


    const opponents =
        players.filter(
            player =>
                String(
                    player.playerId ??
                    player.id ??
                    ""
                ) !==
                String(
                    currentPlayerId ??
                    ""
                )
        );


    container.innerHTML =
        opponents.map(
            player => {

                const name =
                    player.name ||
                    player.username ||
                    "Игрок";


                const avatar =
                    (
                        name
                            .replace("@", "")
                            .charAt(0) ||
                        "?"
                    ).toUpperCase();


                const cards =
                    Number(
                        player.cardsCount ??
                        player.handSize ??
                        player.cards ??
                        0
                    );


                return `
                    <div class="opponent-card">

                        <div class="opponent-avatar">
                            ${escapeHtml(avatar)}
                        </div>

                        <div>
                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span>
                                ${cards} карт
                            </span>
                        </div>

                        <button
                            class="player-info"
                            type="button"
                            data-player-id="${escapeHtml(
                                player.playerId ??
                                player.id ??
                                ""
                            )}"
                        >
                            i
                        </button>

                    </div>
                `;

            }
        ).join("");


    $$(".player-info")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        requestPlayerInfo(
                            button.dataset.playerId
                        );

                    }
                );

            }
        );

}


/* =========================================================
   TABLE
========================================================= */

function renderTable(cards) {

    const container =
        $("#tableCards");

    if (!container) {
        return;
    }


    if (
        !Array.isArray(cards) ||
        cards.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-table">
                ОЖИДАНИЕ...
            </div>
        `;

        return;

    }


    container.innerHTML =
        cards.map(
            card => {

                return renderCard(
                    card,
                    "table-card"
                );

            }
        ).join("");

}


/* =========================================================
   HAND
========================================================= */

function renderHand(cards) {

    const container =
        $("#playerHand");

    if (!container) {
        return;
    }


    if (!Array.isArray(cards)) {

        container.innerHTML = "";

        return;

    }


    container.innerHTML =
        cards.map(
            card => {

                const cardId =
                    typeof card === "string"
                        ? card
                        : (
                            card.id ||
                            card.cardId ||
                            ""
                        );


                return renderCard(
                    card,
                    "playing-card",
                    cardId
                );

            }
        ).join("");


    $$("#playerHand .playing-card")
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        selectCard(
                            card.dataset.card
                        );

                    }
                );

            }
        );

}


function renderCard(
    card,
    className,
    cardId = null
) {

    if (
        typeof card === "string"
    ) {

        cardId =
            cardId ||
            card;


        const parsed =
            parseCard(card);


        return `
            <button
                class="${className}"
                type="button"
                data-card="${escapeHtml(card)}"
            >
                <span>
                    ${escapeHtml(parsed.rank)}
                </span>

                <b class="${suitClass(parsed.suit)}">
                    ${escapeHtml(parsed.suit)}
                </b>
            </button>
        `;

    }


    const id =
        cardId ||
        card.id ||
        card.cardId ||
        "";


    const rank =
        card.rank ||
        card.value ||
        "";


    const suit =
        card.suitSymbol ||
        card.suit ||
        "";


    return `
        <button
            class="${className}"
            type="button"
            data-card="${escapeHtml(id)}"
        >
            <span>
                ${escapeHtml(rank)}
            </span>

            <b class="${suitClass(suit)}">
                ${escapeHtml(suit)}
            </b>
        </button>
    `;

}


function parseCard(card) {

    const value =
        String(card || "");


    const suit =
        value.charAt(
            value.length - 1
        );


    const rank =
        value.slice(
            0,
            -1
        );


    const suits = {

        H: "♥",

        D: "♦",

        C: "♣",

        S: "♠"

    };


    return {

        rank,

        suit:
            suits[suit] ||
            suit

    };

}


function suitClass(suit) {

    if (
        suit === "♥" ||
        suit === "♦" ||
        suit === "H" ||
        suit === "D"
    ) {

        return "red-suit";

    }

    return "black-suit";

}


/* =========================================================
   SELECT CARD
========================================================= */

function selectCard(cardId) {

    if (
        !state.gameActive
    ) {
        return;
    }


    $$("#playerHand .playing-card")
        .forEach(
            card => {

                card.classList.toggle(
                    "selected",
                    card.dataset.card ===
                        cardId
                );

            }
        );


    state.selectedCard =
        cardId;


    /*
    ВАЖНО:

    Здесь карта только выбирается.

    Сервер сам проверяет:

    - чей ход
    - существует ли карта
    - можно ли её положить
    - козырь
    - защиту
    - количество карт
    - правила подкидывания

    И только после этого
    меняет gameState.
    */

    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "playCard",
            {

                cardId:
                    cardId

            }
        );

    }

}


/* =========================================================
   GAME ACTIONS
========================================================= */

function initGameActions() {

    const take =
        $("#takeButton");

    if (take) {

        take.addEventListener(
            "click",
            () => {

                if (
                    !state.gameActive ||
                    !socket ||
                    !socket.connected
                ) {
                    return;
                }


                socket.emit(
                    "takeCards"
                );

            }
        );

    }


    const end =
        $("#endAttackButton");

    if (end) {

        end.addEventListener(
            "click",
            () => {

                if (
                    !state.gameActive ||
                    !socket ||
                    !socket.connected
                ) {
                    return;
                }


                socket.emit(
                    "endAttack"
                );

            }
        );

    }

}


/* =========================================================
   GAME STATUS
========================================================= */

function renderGameStatus(gameState) {

    const status =
        $("#gameStatus");

    if (!status) {
        return;
    }


    const currentPlayerId =
        gameState.currentPlayerId ??
        gameState.turnPlayerId;


    const isMyTurn =
        currentPlayerId != null &&
        String(currentPlayerId) ===
        String(state.playerId);


    if (gameState.phase === "finished") {

        status.textContent =
            "ПАРТИЯ ЗАВЕРШЕНА";

        return;

    }


    if (isMyTurn) {

        status.textContent =
            gameState.attackerId &&
            String(gameState.attackerId) ===
            String(state.playerId)
                ? "ВАША АТАКА"
                : "ВАШ ХОД";

        return;

    }


    status.textContent =
        "ХОД СОПЕРНИКА";

}


/* =========================================================
   GAME END
========================================================= */

function handleGameEnded(result) {

    state.gameActive =
        false;

    state.selectedCard =
        null;


    clearSelectedCard();


    const message =
        result?.message ||
        (
            result?.winnerId &&
            String(result.winnerId) ===
            String(state.playerId)
                ? "Вы победили!"
                : "Партия завершена"
        );


    showToast(
        message
    );


    requestProfile();


    setTimeout(
        () => {

            openScreen(
                "play"
            );

        },
        1000
    );

}


/* =========================================================
   CLEAR CARD
========================================================= */

function clearSelectedCard() {

    state.selectedCard =
        null;


    $$("#playerHand .playing-card")
        .forEach(
            card => {

                card.classList.remove(
                    "selected"
                );

            }
        );

}


/* =========================================================
   MESSAGE MODAL
========================================================= */

function initMessageModal() {

    const open =
        $("#messageButton");

    if (open) {

        open.addEventListener(
            "click",
            () => {

                openModal(
                    "messageModal"
                );

            }
        );

    }


    const close =
        $("#closeMessageModal");

    if (close) {

        close.addEventListener(
            "click",
            () => {

                closeModal(
                    "messageModal"
                );

            }
        );

    }


    $$(".quick-message")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const text =
                            button.textContent.trim();


                        if (
                            socket &&
                            socket.connected
                        ) {

                            socket.emit(
                                "quickMessage",
                                {
                                    text
                                }
                            );

                        }


                        closeModal(
                            "messageModal"
                        );

                    }
                );

            }
        );


    $$("#messageModal .modal-backdrop")
        .forEach(
            backdrop => {

                backdrop.addEventListener(
                    "click",
                    () => {

                        closeModal(
                            "messageModal"
                        );

                    }
                );

            }
        );

}


function openModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {

        modal.classList.add(
            "active"
        );

    }

}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {

        modal.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   PLAYER INFO
========================================================= */

function requestPlayerInfo(playerId) {

    if (
        !playerId
    ) {
        return;
    }


    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "getPlayerProfile",
            {
                playerId
            }
        );

    }


    openModal(
        "playerInfoModal"
    );

}


socketPlayerProfileListener();


function socketPlayerProfileListener() {

    /*
    Отдельная регистрация после initSocket
    не требуется.

    Если сервер присылает profile игрока
    через событие playerProfile,
    его обработаем здесь только после
    создания socket.
    */

}


/* =========================================================
   OWNERSHIP
========================================================= */

function initOwnershipTabs() {

    $$("[data-owner]")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            button.dataset.owner;


                        $$("[data-owner]")
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );

                                }
                            );


                        $$(".ownership-panel")
                            .forEach(
                                panel => {

                                    panel.classList.toggle(
                                        "active",
                                        panel.id ===
                                        `owner-${target}`
                                    );

                                }
                            );

                    }
                );

            }
        );

}


/* =========================================================
   SHOWROOMS
========================================================= */

function initShowrooms() {

    $$("[data-showroom]")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            button.dataset.showroom;


                        $$("[data-showroom]")
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item === button
                                    );

                                }
                            );


                        $$(".showroom-panel")
                            .forEach(
                                panel => {

                                    panel.classList.toggle(
                                        "active",
                                        panel.id ===
                                        `showroom-${target}`
                                    );

                                }
                            );

                    }
                );

            }
        );

}


/* =========================================================
   CAR PURCHASE
========================================================= */

function initCarPurchases() {

    $$(".buy-car")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const vehicleId =
                            button.dataset.vehicleId;


                        const price =
                            Number(
                                button.dataset.price
                            );


                        if (!vehicleId) {

                            showToast(
                                "Автомобиль не найден"
                            );

                            return;

                        }


                        if (
                            state.balance <
                            price
                        ) {

                            showToast(
                                "Недостаточно HC"
                            );

                            return;

                        }


                        if (
                            !socket ||
                            !socket.connected
                        ) {

                            showToast(
                                "Нет соединения"
                            );

                            return;

                        }


                        /*
                        Баланс здесь НЕ меняем.

                        Сервер:

                        1. проверит баланс
                        2. проверит товар
                        3. спишет HC
                        4. создаст автомобиль
                        5. отправит profile
                        */

                        socket.emit(
                            "buyVehicle",
                            {
                                vehicleId
                            }
                        );


                        showToast(
                            "Отправляем покупку..."
                        );

                    }
                );

            }
        );

}


/* =========================================================
   PLATE PURCHASE
========================================================= */

function initPlatePurchases() {

    $$(".buy-plate")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const plate =
                            button.dataset.plate;


                        if (
                            !socket ||
                            !socket.connected
                        ) {

                            showToast(
                                "Нет соединения"
                            );

                            return;

                        }


                        socket.emit(
                            "buyPlate",
                            {
                                plate
                            }
                        );


                        showToast(
                            "Отправляем покупку..."
                        );

                    }
                );

            }
        );

}


/* =========================================================
   GARAGE
========================================================= */

function applyGarage(payload) {

    if (!payload) {
        return;
    }


    const vehicles =
        payload.vehicles ||
        payload;


    if (
        Array.isArray(vehicles)
    ) {

        state.vehicles =
            vehicles;

        renderGarage(
            vehicles
        );

    }

}


function requestGarage() {

    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "getGarage"
        );

    }

}


function renderGarage(vehicles) {

    const list =
        $("#vehicleList");

    const feature =
        $("#garageFeature");


    if (
        !Array.isArray(vehicles) ||
        vehicles.length === 0
    ) {

        if (list) {

            list.innerHTML = `
                <div class="empty-collection">
                    В гараже пока нет автомобилей
                </div>
            `;

        }

        if (feature) {

            feature.innerHTML = `
                <div class="empty-collection">
                    Основной автомобиль не выбран
                </div>
            `;

        }

        return;

    }


    const primary =
        vehicles.find(
            vehicle =>
                vehicle.primary ||
                vehicle.isPrimary
        ) ||
        vehicles[0];


    if (feature) {

        feature.innerHTML = `
            <div class="garage-car">
                ${escapeHtml(
                    primary.brand ||
                    "AUTO"
                )}
            </div>

            <div class="garage-car-info">

                <span>
                    ОСНОВНОЙ АВТОМОБИЛЬ
                </span>

                <h2>
                    ${escapeHtml(
                        primary.name ||
                        "Автомобиль"
                    )}
                </h2>

                <div class="license-plate">
                    ${escapeHtml(
                        primary.plate ||
                        "БЕЗ НОМЕРА"
                    )}
                </div>

                <button
                    class="small-primary install-plate"
                    type="button"
                    data-vehicle-id="${escapeHtml(
                        primary.id ||
                        primary.vehicleId ||
                        ""
                    )}"
                >
                    УСТАНОВИТЬ НОМЕР
                </button>

            </div>
        `;

    }


    if (list) {

        list.innerHTML =
            vehicles.map(
                vehicle => {

                    return `
                        <div class="vehicle-row">

                            <div class="vehicle-icon">
                                ${escapeHtml(
                                    vehicle.brand ||
                                    "AUTO"
                                )}
                            </div>

                            <div>
                                <strong>
                                    ${escapeHtml(
                                        vehicle.name ||
                                        "Автомобиль"
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        vehicle.plate ||
                                        "Без номера"
                                    )}
                                </span>
                            </div>

                            <b>›</b>

                        </div>
                    `;

                }
            ).join("");

    }

}


/* =========================================================
   MARKET
========================================================= */

function requestMarket() {

    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "getMarket"
        );

    }

}


function renderMarket(items) {

    const list =
        $("#marketList");

    if (!list) {
        return;
    }


    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        list.innerHTML = `
            <div class="empty-collection">
                На рынке пока нет предложений
            </div>
        `;

        return;

    }


    list.innerHTML =
        items.map(
            item => {

                return `
                    <article class="market-card">

                        <div class="market-image">
                            ${escapeHtml(
                                item.brand ||
                                "AUTO"
                            )}
                        </div>

                        <div class="market-info">

                            <strong>
                                ${escapeHtml(
                                    item.name ||
                                    "Предмет"
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    item.plate ||
                                    "Без номера"
                                )}
                            </span>

                            <b>
                                ${formatNumber(
                                    item.price ||
                                    0
                                )} HC
                            </b>

                        </div>

                        <button
                            class="small-primary market-buy"
                            type="button"
                            data-item-id="${escapeHtml(
                                item.id ||
                                item.itemId ||
                                ""
                            )}"
                        >
                            КУПИТЬ
                        </button>

                    </article>
                `;

            }
        ).join("");


    $$(".market-buy")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (
                            !socket ||
                            !socket.connected
                        ) {

                            showToast(
                                "Нет соединения"
                            );

                            return;

                        }


                        socket.emit(
                            "buyMarketItem",
                            {
                                itemId:
                                    button.dataset.itemId
                            }
                        );

                    }
                );

            }
        );

}


/* =========================================================
   TELEGRAM
========================================================= */

function getTelegramUser() {

    if (
        typeof window.Telegram ===
        "undefined"
    ) {
        return null;
    }


    const webApp =
        window.Telegram.WebApp;


    if (!webApp) {
        return null;
    }


    return (
        webApp.initDataUnsafe &&
        webApp.initDataUnsafe.user
    ) || null;

}


function initTelegram() {

    if (
        typeof window.Telegram ===
        "undefined"
    ) {
        return;
    }


    if (
        !window.Telegram.WebApp
    ) {
        return;
    }


    try {

        const webApp =
            window.Telegram.WebApp;


        webApp.ready();

        webApp.expand();


        const user =
            getTelegramUser();


        if (!user) {
            return;
        }


        state.telegramId =
            user.id;


        state.playerId =
            String(
                user.id
            );


        state.playerName =
            user.username
                ? `@${user.username}`
                : (
                    user.first_name ||
                    "Игрок"
                );


        state.playerAvatar =
            (
                user.first_name ||
                "V"
            )
                .charAt(0)
                .toUpperCase();


        updateProfileUI();

    }
    catch (error) {

        console.warn(
            "[Heavy Lux] Telegram error:",
            error
        );

    }

}


/* =========================================================
   SERVER MESSAGE
========================================================= */

function normalizeServerMessage(message) {

    if (
        typeof message ===
        "string"
    ) {

        return message;

    }


    if (
        message?.message
    ) {

        return message.message;

    }


    if (
        message?.error
    ) {

        return message.error;

    }


    return "Операция не выполнена";

}


/* =========================================================
   INITIALIZATION
========================================================= */

function initApp() {

    initNavigation();

    initPlayTabs();

    initPlayerChoices();

    initBetChoices();

    initGameActions();

    initMessageModal();

    initOwnershipTabs();

    initShowrooms();

    initCarPurchases();

    initPlatePurchases();

    initTelegram();

    initSocket();

    updateProfileUI();


    /*
    После перехода на нужные экраны
    запрашиваем данные с backend.
    */

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "[data-screen]"
                );

            if (!target) {
                return;
            }


            const screen =
                target.dataset.screen;


            if (screen === "profile") {

                requestProfile();

            }


            if (screen === "garage") {

                requestGarage();

            }


            if (screen === "market") {

                requestMarket();

            }


            if (screen === "play") {

                requestLobbyList();

            }

        }
    );


    console.log(
        "[Heavy Lux] frontend initialized"
    );

}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initApp
    );

}
else {

    initApp();

}
