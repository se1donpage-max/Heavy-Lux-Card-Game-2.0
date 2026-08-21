"use strict";

/*
=========================================================
HEAVY LUX CARD
CLIENT
BASE V5
=========================================================
*/

(() => {

    /* =====================================================
       STATE
    ====================================================== */

    const state = {

        connected: false,

        bootstrapped: false,

        profile: null,

        catalog: {

            stakes: [],

            vehicles: [],

            exclusive: [],

            property: [],

            propertyColors: {},

            beautifulNumbers: [],

            quickPhrases: []
        },

        room: null,

        game: null,

        currentView: "home",

        matchStake: null,

        sound: true,

        vibration: true,

        telegram: false
    };


    const VIEW_IDS = {

        home: "homeView",

        stake: "stakeView",

        matching: "matchingView",

        game: "gameView",

        profile: "profileView",

        garage: "garageView",

        settings: "settingsView"
    };


    /* =====================================================
       HELPERS
    ====================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    function qs(selector, root = document) {
        return root.querySelector(selector);
    }


    function qsa(selector, root = document) {
        return [
            ...root.querySelectorAll(selector)
        ];
    }


    function getDevId() {

        const key =
            "heavy_lux_dev_id";

        let id =
            localStorage.getItem(key);

        if (!id) {

            id =
                "dev_" +
                Date.now().toString(36) +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9);

            localStorage.setItem(
                key,
                id
            );
        }

        return id;
    }


    function getTelegramWebApp() {

        try {

            if (
                window.Telegram &&
                window.Telegram.WebApp
            ) {

                return window.Telegram.WebApp;
            }

        } catch (_) {}

        return null;
    }


    function getTelegramAuth() {

        const webApp =
            getTelegramWebApp();

        if (!webApp) {
            return null;
        }

        try {

            webApp.ready();

            const user =
                webApp.initDataUnsafe?.user;

            const initData =
                webApp.initData || "";

            /*
             * Настоящая Telegram-сессия.
             *
             * Важно:
             * initData должен существовать,
             * иначе Telegram авторизацию
             * не считаем активной.
             */

            if (
                user &&
                initData
            ) {

                return {

                    initData,

                    devId:
                        String(user.id),

                    username:
                        user.username || "",

                    name:
                        user.first_name ||
                        "Игрок",

                    telegram: true
                };
            }

        } catch (error) {

            console.error(
                "[Heavy Lux] Telegram auth error:",
                error
            );
        }

        return null;
    }


    function getSocketAuth() {

        const telegramAuth =
            getTelegramAuth();

        if (telegramAuth) {

            state.telegram =
                true;

            return telegramAuth;
        }

        /*
         * DEV-режим.
         *
         * Используется только когда
         * игра открыта не внутри Telegram.
         */

        state.telegram =
            false;

        return {

            devId:
                getDevId(),

            username:
                "demo",

            name:
                "Игрок"
        };
    }


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function number(value) {

        return Number(
            value || 0
        ).toLocaleString("ru-RU");
    }


    function initials(name) {

        const text =
            String(
                name || "Игрок"
            ).trim();

        if (!text) {
            return "?";
        }

        const parts =
            text.split(/\s+/);

        if (parts.length >= 2) {

            return (
                parts[0][0] +
                parts[1][0]
            ).toUpperCase();
        }

        return text
            .slice(0, 2)
            .toUpperCase();
    }


    function vibrate(pattern = 20) {

        if (!state.vibration) {
            return;
        }

        try {

            if (
                navigator.vibrate
            ) {

                navigator.vibrate(
                    pattern
                );
            }

        } catch (_) {}
    }


    function playClick() {
        vibrate(15);
    }


    function setText(id, value) {

        const element =
            $(id);

        if (element) {

            element.textContent =
                String(value);
        }
    }


    /* =====================================================
       SETTINGS
    ====================================================== */

    function loadSettings() {

        try {

            const sound =
                localStorage.getItem(
                    "hl_sound"
                );

            const vibration =
                localStorage.getItem(
                    "hl_vibration"
                );

            if (sound !== null) {

                state.sound =
                    sound !== "0";
            }

            if (vibration !== null) {

                state.vibration =
                    vibration !== "0";
            }

        } catch (_) {}
    }


    function saveSettings() {

        try {

            localStorage.setItem(
                "hl_sound",
                state.sound ? "1" : "0"
            );

            localStorage.setItem(
                "hl_vibration",
                state.vibration ? "1" : "0"
            );

        } catch (_) {}
    }


    /* =====================================================
       SCREEN
    ====================================================== */

    function showScreen(id) {

        [
            "loadingScreen",
            "authScreen",
            "mainScreen"
        ].forEach(
            screenId => {

                const element =
                    $(screenId);

                if (!element) {
                    return;
                }

                element.classList.toggle(
                    "hidden",
                    screenId !== id
                );
            }
        );
    }


    function showAuth() {

        showScreen(
            "authScreen"
        );
    }


    /* =====================================================
       VIEWS
    ====================================================== */

    function showView(viewName) {

        if (
            !VIEW_IDS[viewName]
        ) {

            viewName =
                "home";
        }

        Object.entries(
            VIEW_IDS
        ).forEach(
            ([name, id]) => {

                const element =
                    $(id);

                if (!element) {
                    return;
                }

                element.classList.toggle(
                    "hidden",
                    name !== viewName
                );

                element.classList.toggle(
                    "active",
                    name === viewName
                );
            }
        );

        state.currentView =
            viewName;

        qsa(
            ".nav-item"
        ).forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.view ===
                    viewName
                );
            }
        );

        const bottomNavigation =
            $("bottomNavigation");

        if (bottomNavigation) {

            bottomNavigation.classList.toggle(
                "hidden",

                viewName === "game" ||
                viewName === "matching"
            );
        }

        if (
            viewName === "stake"
        ) {

            renderStakes();
        }

        if (
            viewName === "profile"
        ) {

            renderProfile();
        }

        if (
            viewName === "garage"
        ) {

            renderGarage();
        }

        if (
            viewName === "settings"
        ) {

            renderSettings();
        }
    }


    /* =====================================================
       AVATAR
    ====================================================== */

    function updateAvatar(
        element,
        profile
    ) {

        if (!element) {
            return;
        }

        if (profile?.avatar) {

            element.innerHTML = `

                <img
                    src="${escapeHtml(
                        profile.avatar
                    )}"
                    alt=""
                >

            `;

        } else {

            element.textContent =
                initials(
                    profile?.name
                );
        }
    }


    /* =====================================================
       PROFILE SUMMARY
    ====================================================== */

    function renderProfileSummary() {

        const p =
            state.profile;

        if (!p) {
            return;
        }

        const name =
            p.name || "Игрок";

        const level =
            Number(
                p.level || 1
            );

        const xp =
            Number(
                p.xp || 0
            );

        const balance =
            Number(
                p.hc ??
                p.balance ??
                p.lux ??
                0
            );

        setText(
            "playerName",
            name
        );

        setText(
            "playerLevel",
            level
        );

        setText(
            "playerBalance",
            number(balance)
        );

        updateAvatar(
            $("playerAvatar"),
            p
        );

        updateAvatar(
            qs(
                "#profileButton .avatar"
            ),
            p
        );

        const xpProgress =
            $("xpProgress");

        if (xpProgress) {

            const currentLevelXp =
                xp % 1000;

            xpProgress.style.width =
                `${Math.min(
                    100,
                    currentLevelXp / 10
                )}%`;
        }

        const games =
            Number(
                p.games ??
                p.gamesPlayed ??
                (
                    (p.wins || 0) +
                    (p.losses || 0)
                )
            );

        setText(
            "gamesPlayed",
            games
        );

        setText(
            "gamesWon",
            p.wins || 0
        );

        setText(
            "gamesLost",
            p.losses || 0
        );
    }


    /* =====================================================
       PROFILE
    ====================================================== */

    function renderProfile() {

        const p =
            state.profile;

        if (!p) {
            return;
        }

        updateAvatar(
            $("profileAvatar"),
            p
        );

        setText(
            "profileName",
            p.name || "Игрок"
        );

        setText(
            "profileUsername",

            p.username
                ? `@${String(
                    p.username
                ).replace(
                    /^@/,
                    ""
                )}`
                : "@username"
        );

        setText(
            "profileLevel",
            p.level || 1
        );

        const games =
            Number(
                p.games ??
                p.gamesPlayed ??
                (
                    (p.wins || 0) +
                    (p.losses || 0)
                )
            );

        setText(
            "profileGames",
            games
        );

        setText(
            "profileWins",
            p.wins || 0
        );

        setText(
            "profileLosses",
            p.losses || 0
        );

        setText(
            "profileBalance",
            `${number(
                p.hc ?? 0
            )} HC`
        );

        setText(
            "profileIncome",
            `${number(
                p.income ??
                p.passiveIncome ??
                0
            )} HC`
        );
    }


    /* =====================================================
       STAKES
    ====================================================== */

    function renderStakes() {

        const container =
            $("stakesContainer");

        if (!container) {
            return;
        }

        const stakes =
            Array.isArray(
                state.catalog.stakes
            )
                ? state.catalog.stakes
                : [];

        if (!stakes.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        ♠
                    </div>

                    <strong>
                        Ставки загружаются
                    </strong>

                    <span>
                        Попробуй ещё раз
                        через несколько секунд.
                    </span>

                </div>

            `;

            return;
        }

        container.innerHTML =
            stakes
                .map(
                    (
                        stake,
                        index
                    ) => {

                        const value =
                            typeof stake ===
                            "number"

                                ? stake

                                : Number(
                                    stake?.value ??
                                    stake?.amount ??
                                    stake?.stake ??
                                    0
                                );

                        const name =
                            typeof stake ===
                            "object"

                                ? (
                                    stake.name ||
                                    stake.title ||
                                    `СТОЛ ${
                                        index + 1
                                    }`
                                )

                                : `СТОЛ ${
                                    index + 1
                                }`;

                        const available =
                            Number(
                                state.profile?.hc ||
                                0
                            ) >= value;

                        return `

                            <button
                                class="stake-card ${
                                    available
                                        ? ""
                                        : "disabled"
                                }"
                                type="button"
                                data-stake="${value}"
                                ${
                                    available
                                        ? ""
                                        : "disabled"
                                }
                            >

                                <div
                                    class="stake-card-left"
                                >

                                    <div
                                        class="stake-card-icon"
                                    >
                                        ♠
                                    </div>

                                    <div>

                                        <strong>
                                            ${escapeHtml(
                                                name
                                            )}
                                        </strong>

                                        <span>
                                            Подкидной
                                            • 1 × 1
                                        </span>

                                    </div>

                                </div>

                                <div
                                    class="stake-card-price"
                                >

                                    ${number(
                                        value
                                    )}

                                    <small>
                                        HC
                                    </small>

                                </div>

                            </button>

                        `;
                    }
                )
                .join("");

        qsa(
            "[data-stake]",
            container
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const stake =
                            Number(
                                button.dataset.stake
                            );

                        startMatch(
                            stake
                        );
                    }
                );
            }
        );
    }


    /* =====================================================
       MATCHMAKING
    ====================================================== */

    function startMatch(stake) {

        state.matchStake =
            stake;

        setText(
            "matchingStake",
            `${number(stake)} HC`
        );

        setText(
            "matchingStatus",
            "Ищем игрока..."
        );

        setText(
            "matchingPlayers",
            "1 / 2"
        );

        showView(
            "matching"
        );

        socket.emit(
            "quick_match",
            {
                stake
            }
        );

        playClick();
    }


    function cancelMatch() {

        socket.emit(
            "leave_room"
        );

        state.matchStake =
            null;

        state.room =
            null;

        state.game =
            null;

        showView(
            "home"
        );

        setText(
            "matchingStatus",
            "Поиск отменён"
        );
    }


    /* =====================================================
       ROOM
    ====================================================== */

    function handleRoomState(room) {

        state.room =
            room;

        const roomPlayers =
            Array.isArray(
                room?.players
            )
                ? room.players
                : [];

        const maxPlayers =
            Number(
                room?.maxPlayers || 2
            );

        setText(
            "matchingPlayers",
            `${roomPlayers.length} / ${maxPlayers}`
        );

        if (
            room.status === "LOBBY"
        ) {

            if (
                roomPlayers.length >=
                maxPlayers
            ) {

                setText(
                    "matchingStatus",
                    "Соперник найден"
                );

            } else {

                setText(
                    "matchingStatus",
                    "Ожидаем соперника..."
                );
            }
        }

        if (
            room.status === "PLAYING"
        ) {

            showView(
                "game"
            );
        }
    }


    /* =====================================================
       GAME
    ====================================================== */

    function handleGameState(game) {

        state.game =
            game;

        showView(
            "game"
        );

        renderGame();
    }


    function normalizeCard(
        card,
        index
    ) {

        if (
            typeof card === "string"
        ) {

            return {

                id: card,

                rank: card,

                suit: ""
            };
        }

        return {

            id:
                card?.id ??
                card?.cardId ??
                `card_${index}`,

            rank:
                card?.rank ??
                card?.value ??
                card?.name ??
                "",

            suit:
                card?.suit ??
                card?.color ??
                ""
        };
    }


    function suitSymbol(suit) {

        const value =
            String(
                suit || ""
            ).toLowerCase();

        if (
            value.includes("heart") ||
            value.includes("черв")
        ) {
            return "♥";
        }

        if (
            value.includes("diamond") ||
            value.includes("буб")
        ) {
            return "♦";
        }

        if (
            value.includes("club") ||
            value.includes("крест")
        ) {
            return "♣";
        }

        if (
            value.includes("spade") ||
            value.includes("пик")
        ) {
            return "♠";
        }

        if (
            [
                "♥",
                "♦",
                "♣",
                "♠"
            ].includes(value)
        ) {

            return value;
        }

        return "♠";
    }


    function renderCard(
        card,
        index,
        location
    ) {

        const c =
            normalizeCard(
                card,
                index
            );

        const symbol =
            suitSymbol(
                c.suit
            );

        const red =
            symbol === "♥" ||
            symbol === "♦";

        return `

            <button
                class="game-card ${
                    red ? "red" : ""
                }"
                type="button"
                data-card-id="${escapeHtml(
                    c.id
                )}"
                data-card-location="${escapeHtml(
                    location
                )}"
            >

                <span
                    class="card-rank"
                >
                    ${escapeHtml(
                        c.rank
                    )}
                </span>

                <span
                    class="card-suit"
                >
                    ${symbol}
                </span>

            </button>

        `;
    }


    function getMyCards(game) {

        return (
            game?.hand ||
            game?.playerHand ||
            game?.cards ||
            game?.myCards ||
            []
        );
    }


    function getTableCards(game) {

        return (
            game?.table ||
            game?.tableCards ||
            game?.field ||
            []
        );
    }


    function renderGame() {

        const game =
            state.game;

        if (!game) {
            return;
        }

        const handContainer =
            $("playerHand");

        if (handContainer) {

            const cards =
                getMyCards(game);

            handContainer.innerHTML =
                Array.isArray(cards) &&
                cards.length

                    ? cards
                        .map(
                            (
                                card,
                                index
                            ) =>
                                renderCard(
                                    card,
                                    index,
                                    "hand"
                                )
                        )
                        .join("")

                    : `

                        <div
                            class="empty-state"
                        >
                            <span>
                                Нет карт
                            </span>
                        </div>

                    `;

            qsa(
                ".game-card",
                handContainer
            ).forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            handleCardClick(
                                button.dataset
                                    .cardId
                            );
                        }
                    );
                }
            );
        }

        const tableContainer =
            $("tableCards");

        if (tableContainer) {

            const cards =
                getTableCards(game);

            tableContainer.innerHTML =
                Array.isArray(cards)

                    ? cards
                        .map(
                            (
                                card,
                                index
                            ) =>
                                renderCard(
                                    card,
                                    index,
                                    "table"
                                )
                        )
                        .join("")

                    : "";
        }

        const trump =
            game?.trump ||
            game?.trumpCard;

        if (trump) {

            const trumpElement =
                $("trumpCard");

            if (trumpElement) {

                trumpElement.innerHTML =
                    renderCard(
                        trump,
                        0,
                        "trump"
                    );
            }
        }

        const deck =
            game?.deckCount ??
            game?.deckSize ??
            game?.remainingCards;

        if (
            deck !== undefined
        ) {

            setText(
                "deckCounter",
                deck
            );
        }

        const pot =
            game?.pot ??
            game?.bank ??
            state.room?.stake ??
            0;

        setText(
            "gamePot",
            number(pot)
        );

        const status =
            game?.message ||
            game?.statusText ||
            getGameStatusText(game);

        setText(
            "gameStatus",
            status
        );

        const opponent =
            getOpponent(game);

        if (opponent) {

            setText(
                "opponentName",
                opponent.name ||
                "Соперник"
            );

            updateAvatar(
                $("opponentAvatar"),
                opponent
            );

            setText(
                "opponentCards",
                opponent.cards ??
                opponent.cardCount ??
                0
            );
        }

        updateGameButtons();
    }


    function getOpponent(game) {

        const gamePlayers =
            game?.players ||
            state.room?.players ||
            [];

        const myId =
            state.profile?.id;

        return (
            gamePlayers.find(
                player =>
                    String(
                        player?.id
                    ) !==
                    String(myId)
            ) ||
            gamePlayers[0]
        );
    }


    function getGameStatusText(game) {

        if (
            game?.status ===
            "FINISHED"
        ) {

            if (
                game.winnerId &&
                state.profile?.id
            ) {

                return String(
                    game.winnerId
                ) ===
                    String(
                        state.profile.id
                    )
                        ? "ПОБЕДА!"
                        : "ПОРАЖЕНИЕ";
            }

            return "Партия завершена";
        }

        if (
            game?.status ===
            "WAITING"
        ) {

            return "Ожидание хода...";
        }

        if (
            game?.turnPlayerId &&
            state.profile?.id
        ) {

            return String(
                game.turnPlayerId
            ) ===
                String(
                    state.profile.id
                )
                    ? "ТВОЙ ХОД"
                    : "ХОД СОПЕРНИКА";
        }

        if (
            game?.currentPlayerId &&
            state.profile?.id
        ) {

            return String(
                game.currentPlayerId
            ) ===
                String(
                    state.profile.id
                )
                    ? "ТВОЙ ХОД"
                    : "ХОД СОПЕРНИКА";
        }

        return "Ожидание хода...";
    }


    function updateGameButtons() {

        const game =
            state.game;

        if (!game) {
            return;
        }

        const myId =
            state.profile?.id;

        const takeButton =
            $("takeButton");

        const passButton =
            $("passButton");

        const attacker =
            game.attackerId ??
            game.currentPlayerId;

        const defender =
            game.defenderId;

        const isDefender =
            defender &&
            String(defender) ===
            String(myId);

        const isAttacker =
            attacker &&
            String(attacker) ===
            String(myId);

        if (takeButton) {

            takeButton.disabled =
                !isDefender ||
                game.status ===
                "FINISHED";
        }

        if (passButton) {

            passButton.disabled =
                !isAttacker ||
                game.status ===
                "FINISHED";
        }
    }


    function handleCardClick(cardId) {

        if (!state.game) {
            return;
        }

        const game =
            state.game;

        const myId =
            state.profile?.id;

        const defender =
            game.defenderId;

        if (
            defender &&
            String(defender) ===
            String(myId)
        ) {

            socket.emit(
                "defend",
                {
                    cardId
                }
            );

        } else {

            socket.emit(
                "play_attack",
                {
                    cardId
                }
            );
        }

        playClick();
    }


    /* =====================================================
       GAME ACTIONS
    ====================================================== */

    function takeCards() {

        if (
            $("takeButton")?.disabled
        ) {
            return;
        }

        socket.emit(
            "take_cards"
        );

        playClick();
    }


    function passAttack() {

        if (
            $("passButton")?.disabled
        ) {
            return;
        }

        socket.emit(
            "end_attack"
        );

        playClick();
    }


    /* =====================================================
       GARAGE
    ====================================================== */

    function renderGarage() {

        const container =
            $("garageContainer");

        if (!container) {
            return;
        }

        const garage =
            Array.isArray(
                state.profile?.garage
            )
                ? state.profile.garage
                : [];

        if (!garage.length) {

            container.innerHTML = `

                <div
                    class="empty-state"
                >

                    <div
                        class="empty-icon"
                    >
                        🚘
                    </div>

                    <strong>
                        Гараж пуст
                    </strong>

                    <span>
                        Купленные автомобили
                        появятся здесь.
                    </span>

                </div>

            `;

            return;
        }

        container.innerHTML =
            garage
                .map(
                    vehicle => {

                        const id =
                            typeof vehicle ===
                            "string"
                                ? vehicle
                                : vehicle?.id;

                        const catalogVehicle =
                            [
                                ...(state.catalog
                                    .vehicles || []),

                                ...(state.catalog
                                    .exclusive || [])
                            ]
                                .find(
                                    x =>
                                        x.id === id
                                );

                        const brand =
                            catalogVehicle?.brand ||
                            vehicle?.brand ||
                            "";

                        const model =
                            catalogVehicle?.model ||
                            catalogVehicle?.name ||
                            vehicle?.model ||
                            vehicle?.name ||
                            "Автомобиль";

                        return `

                            <div
                                class="garage-card"
                            >

                                <div
                                    class="garage-card-icon"
                                >
                                    🚘
                                </div>

                                <div
                                    class="garage-card-info"
                                >

                                    <strong>
                                        ${escapeHtml(
                                            brand
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            model
                                        )}
                                    </span>

                                </div>

                            </div>

                        `;
                    }
                )
                .join("");
    }


    /* =====================================================
       SETTINGS
    ====================================================== */

    function renderSettings() {

        const sound =
            $("soundToggle");

        const vibration =
            $("vibrationToggle");

        if (sound) {

            const value =
                qs(
                    "strong",
                    sound
                );

            if (value) {

                value.textContent =
                    state.sound
                        ? "ВКЛ"
                        : "ВЫКЛ";
            }
        }

        if (vibration) {

            const value =
                qs(
                    "strong",
                    vibration
                );

            if (value) {

                value.textContent =
                    state.vibration
                        ? "ВКЛ"
                        : "ВЫКЛ";
            }
        }
    }


    /* =====================================================
       MODAL
    ====================================================== */

    function openModal(
        title,
        text,
        icon = "!"
    ) {

        setText(
            "modalTitle",
            title
        );

        setText(
            "modalText",
            text
        );

        setText(
            "modalIcon",
            icon
        );

        const overlay =
            $("modalOverlay");

        if (overlay) {

            overlay.classList.remove(
                "hidden"
            );
        }
    }


    function closeModal() {

        const overlay =
            $("modalOverlay");

        if (overlay) {

            overlay.classList.add(
                "hidden"
            );
        }
    }


    /* =====================================================
       TOAST
    ====================================================== */

    function toast(
        message,
        type = "info"
    ) {

        const container =
            $("toastContainer");

        if (!container) {
            return;
        }

        const element =
            document.createElement(
                "div"
            );

        element.className =
            `toast toast-${type}`;

        element.textContent =
            String(message);

        container.appendChild(
            element
        );

        requestAnimationFrame(
            () => {

                element.classList.add(
                    "show"
                );
            }
        );

        setTimeout(
            () => {

                element.classList.remove(
                    "show"
                );

                setTimeout(
                    () => {

                        element.remove();

                    },
                    250
                );

            },
            3000
        );
    }


    /* =====================================================
       BOOTSTRAP
    ====================================================== */

    function applyBootstrap(data) {

        if (!data) {
            return;
        }

        if (
            data.profile
        ) {

            state.profile =
                data.profile;
        }

        if (
            data.catalog
        ) {

            state.catalog = {

                ...state.catalog,

                ...data.catalog
            };
        }

        state.bootstrapped =
            true;

        renderAll();

        showScreen(
            "mainScreen"
        );

        showView(
            "home"
        );
    }


    /* =====================================================
       RENDER ALL
    ====================================================== */

    function renderAll() {

        renderProfileSummary();

        renderProfile();

        renderGarage();

        renderSettings();

        if (
            state.currentView ===
            "stake"
        ) {

            renderStakes();
        }

        if (
            state.currentView ===
            "game" &&
            state.game
        ) {

            renderGame();
        }
    }


    /* =====================================================
       SOCKET
    ====================================================== */

    let socket;


    function createSocket() {

        const auth =
            getSocketAuth();

        console.log(
            "[Heavy Lux] Socket auth mode:",
            state.telegram
                ? "TELEGRAM"
                : "DEV"
        );

        socket =
            io({

                transports: [
                    "websocket",
                    "polling"
                ],

                autoConnect: false,

                auth
            });


        /* =================================================
           CONNECT
        ================================================== */

        socket.on(
            "connect",
            () => {

                state.connected =
                    true;

                const loadingText =
                    qs(
                        ".loading-text",
                        $("loadingScreen")
                    );

                if (
                    loadingText
                ) {

                    loadingText.textContent =
                        "Загрузка профиля...";
                }

                console.log(
                    "[Heavy Lux] connected:",
                    socket.id
                );
            }
        );


        /* =================================================
           DISCONNECT
        ================================================== */

        socket.on(
            "disconnect",
            () => {

                state.connected =
                    false;

                if (
                    state.bootstrapped
                ) {

                    toast(
                        "Соединение с сервером потеряно",
                        "error"
                    );
                }
            }
        );


        /* =================================================
           CONNECT ERROR
        ================================================== */

        socket.on(
            "connect_error",
            error => {

                console.error(
                    "[Heavy Lux] Socket error:",
                    error
                );

                if (
                    !state.bootstrapped
                ) {

                    showAuth();
                }

                toast(
                    "Не удалось подключиться к серверу",
                    "error"
                );
            }
        );


        /* =================================================
           BOOTSTRAP
        ================================================== */

        socket.on(
            "bootstrap",
            data => {

                console.log(
                    "[Heavy Lux] bootstrap:",
                    data
                );

                applyBootstrap(
                    data
                );
            }
        );


        /* =================================================
           AUTH ERROR
        ================================================== */

        socket.on(
            "auth_error",
            data => {

                console.error(
                    "[Heavy Lux] auth:",
                    data
                );

                state.bootstrapped =
                    false;

                showAuth();

                toast(
                    data?.message ||
                    "Ошибка авторизации",
                    "error"
                );
            }
        );


        /* =================================================
           ROOM
        ================================================== */

        socket.on(
            "room_state",
            room => {

                console.log(
                    "[Heavy Lux] room:",
                    room
                );

                handleRoomState(
                    room
                );
            }
        );


        /* =================================================
           GAME
        ================================================== */

        socket.on(
            "game_state",
            game => {

                console.log(
                    "[Heavy Lux] game:",
                    game
                );

                handleGameState(
                    game
                );
            }
        );


        /* =================================================
           PROFILE
        ================================================== */

        socket.on(
            "profile",
            profile => {

                if (!profile) {
                    return;
                }

                state.profile =
                    profile;

                renderProfileSummary();

                renderProfile();

                renderGarage();
            }
        );


        /* =================================================
           TOAST
        ================================================== */

        socket.on(
            "toast",
            data => {

                toast(
                    data?.message ||
                    "Сообщение",

                    data?.type ||
                    "info"
                );
            }
        );


        /* =================================================
           QUICK MATCH WAIT
        ================================================== */

        socket.on(
            "quick_match_wait",
            data => {

                setText(
                    "matchingStatus",
                    "Ожидаем соперника..."
                );

                setText(
                    "matchingPlayers",

                    `${data?.players || 1} / ${
                        data?.maxPlayers || 2
                    }`
                );

                if (
                    data?.roomId
                ) {

                    console.log(
                        "[Heavy Lux] waiting room:",
                        data.roomId
                    );
                }
            }
        );


        /* =================================================
           QUICK MESSAGE
        ================================================== */

        socket.on(
            "quick_message",
            data => {

                if (
                    data?.text
                ) {

                    toast(
                        data.text,
                        "info"
                    );
                }
            }
        );


        /* =================================================
           ROOMS
        ================================================== */

        socket.on(
            "rooms_list",
            rooms => {

                console.log(
                    "[Heavy Lux] rooms:",
                    rooms
                );
            }
        );
    }


    /* =====================================================
       UI
    ====================================================== */

    function bindUI() {

        const playButton =
            $("playButton");

        if (playButton) {

            playButton.addEventListener(
                "click",
                () => {

                    showView(
                        "stake"
                    );

                    playClick();
                }
            );
        }


        const profileButton =
            $("profileButton");

        if (profileButton) {

            profileButton.addEventListener(
                "click",
                () => {

                    showView(
                        "profile"
                    );

                    playClick();
                }
            );
        }


        const settingsButton =
            $("settingsButton");

        if (settingsButton) {

            settingsButton.addEventListener(
                "click",
                () => {

                    showView(
                        "settings"
                    );

                    playClick();
                }
            );
        }


        qsa(
            ".nav-item"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const view =
                            button.dataset.view;

                        if (view) {

                            showView(
                                view
                            );

                            playClick();
                        }
                    }
                );
            }
        );


        qsa(
            "[data-back]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        showView(
                            button.dataset.back ||
                            "home"
                        );

                        playClick();
                    }
                );
            }
        );


        const cancelMatchButton =
            $("cancelMatchButton");

        if (
            cancelMatchButton
        ) {

            cancelMatchButton.addEventListener(
                "click",
                cancelMatch
            );
        }


        const takeButton =
            $("takeButton");

        if (takeButton) {

            takeButton.addEventListener(
                "click",
                takeCards
            );
        }


        const passButton =
            $("passButton");

        if (passButton) {

            passButton.addEventListener(
                "click",
                passAttack
            );
        }


        const modalClose =
            $("modalClose");

        if (modalClose) {

            modalClose.addEventListener(
                "click",
                closeModal
            );
        }


        const modalConfirm =
            $("modalConfirm");

        if (modalConfirm) {

            modalConfirm.addEventListener(
                "click",
                closeModal
            );
        }


        const modalOverlay =
            $("modalOverlay");

        if (modalOverlay) {

            modalOverlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modalOverlay
                    ) {

                        closeModal();
                    }
                }
            );
        }


        const soundToggle =
            $("soundToggle");

        if (soundToggle) {

            soundToggle.addEventListener(
                "click",
                () => {

                    state.sound =
                        !state.sound;

                    saveSettings();

                    renderSettings();

                    playClick();
                }
            );
        }


        const vibrationToggle =
            $("vibrationToggle");

        if (vibrationToggle) {

            vibrationToggle.addEventListener(
                "click",
                () => {

                    state.vibration =
                        !state.vibration;

                    saveSettings();

                    renderSettings();

                    if (
                        state.vibration
                    ) {

                        vibrate(40);
                    }
                }
            );
        }


        const logoutButton =
            $("logoutButton");

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                () => {

                    if (socket) {
                        socket.disconnect();
                    }

                    state.profile =
                        null;

                    state.game =
                        null;

                    state.room =
                        null;

                    state.bootstrapped =
                        false;

                    showAuth();
                }
            );
        }


        const telegramLoginButton =
            $("telegramLoginButton");

        if (
            telegramLoginButton
        ) {

            telegramLoginButton.addEventListener(
                "click",
                () => {

                    connectTelegram();
                }
            );
        }


        const testLoginButton =
            $("testLoginButton");

        if (
            testLoginButton
        ) {

            testLoginButton.addEventListener(
                "click",
                () => {

                    connectDev();
                }
            );
        }
    }


    /* =====================================================
       TELEGRAM LOGIN
    ====================================================== */

    function connectTelegram() {

        const auth =
            getTelegramAuth();

        if (!auth) {

            toast(
                "Открой игру через Telegram",
                "info"
            );

            return;
        }

        /*
         * Если Socket ещё не создан,
         * создаём его с Telegram auth.
         */

        if (!socket) {

            createSocket();

        } else {

            socket.auth =
                auth;
        }

        state.telegram =
            true;

        if (
            !socket.connected
        ) {

            socket.connect();
        }
    }


    /* =====================================================
       DEV LOGIN
    ====================================================== */

    function connectDev() {

        const auth = {

            devId:
                getDevId(),

            username:
                "demo",

            name:
                "Игрок"
        };

        state.telegram =
            false;

        if (!socket) {

            createSocket();

        } else {

            socket.auth =
                auth;
        }

        if (
            !socket.connected
        ) {

            socket.connect();
        }
    }


    /* =====================================================
       INITIAL CONNECTION
    ====================================================== */

    function connectInitial() {

        /*
         * Сначала пытаемся определить,
         * запущена ли игра внутри Telegram.
         */

        const telegramAuth =
            getTelegramAuth();

        if (telegramAuth) {

            state.telegram =
                true;

            createSocket();

            socket.auth =
                telegramAuth;

        } else {

            /*
             * Обычный браузер.
             * Работаем через DEV ID.
             */

            state.telegram =
                false;

            createSocket();
        }

        socket.connect();
    }


    /* =====================================================
       INIT
    ====================================================== */

    function init() {

        loadSettings();

        bindUI();

        showScreen(
            "loadingScreen"
        );

        /*
         * Подключаемся сразу с правильным
         * типом авторизации.
         */

        connectInitial();

        setTimeout(
            () => {

                if (
                    !state.bootstrapped
                ) {

                    if (
                        state.connected
                    ) {

                        toast(
                            "Сервер подключён, ожидание данных...",
                            "info"
                        );

                    } else {

                        showAuth();
                    }
                }

            },
            7000
        );
    }


    /* =====================================================
       GLOBAL DEBUG
    ====================================================== */

    window.HEAVY_LUX_CLIENT = {

        state,

        getSocket() {
            return socket;
        },

        showView,

        toast,

        openModal,

        refreshRooms() {

            if (socket) {

                socket.emit(
                    "list_rooms"
                );
            }
        },

        getState() {

            return state;
        }
    };


    init();

})();
