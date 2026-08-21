"use strict";

/*
=========================================================
HEAVY LUX CARD
CLIENT
BASE V3
=========================================================
*/

(() => {
    const socket = io({
        transports: ["websocket", "polling"],
        auth: {
            devId: getDevId()
        }
    });

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
        vibration: true
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
    ===================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function qs(selector, root = document) {
        return root.querySelector(selector);
    }

    function qsa(selector, root = document) {
        return [...root.querySelectorAll(selector)];
    }

    function getDevId() {
        const key = "heavy_lux_dev_id";

        let id = localStorage.getItem(key);

        if (!id) {
            id =
                "dev_" +
                Date.now().toString(36) +
                "_" +
                Math.random().toString(36).slice(2, 9);

            localStorage.setItem(key, id);
        }

        return id;
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
        return Number(value || 0).toLocaleString("ru-RU");
    }

    function money(value) {
        return `${number(value)} HC`;
    }

    function initials(name) {
        const text = String(name || "Игрок").trim();

        if (!text) return "?";

        const parts = text.split(/\s+/);

        if (parts.length >= 2) {
            return (
                parts[0][0] +
                parts[1][0]
            ).toUpperCase();
        }

        return text.slice(0, 2).toUpperCase();
    }

    function vibrate(pattern = 20) {
        if (!state.vibration) return;

        try {
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch (_) {}
    }

    function playClick() {
        vibrate(15);
    }


    /* =====================================================
       LOCAL STORAGE
    ===================================================== */

    function loadSettings() {
        try {
            const sound = localStorage.getItem("hl_sound");
            const vibration = localStorage.getItem("hl_vibration");

            if (sound !== null) {
                state.sound = sound !== "0";
            }

            if (vibration !== null) {
                state.vibration = vibration !== "0";
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
       LOADING / AUTH
    ===================================================== */

    function showScreen(id) {
        [
            "loadingScreen",
            "authScreen",
            "mainScreen"
        ].forEach((screenId) => {
            const element = $(screenId);

            if (!element) return;

            element.classList.toggle(
                "hidden",
                screenId !== id
            );
        });
    }

    function finishLoading() {
        if (state.bootstrapped) {
            showScreen("mainScreen");
            renderAll();
        }
    }

    function showAuth() {
        showScreen("authScreen");
    }


    /* =====================================================
       VIEW NAVIGATION
    ===================================================== */

    function showView(viewName) {
        const targetId = VIEW_IDS[viewName];

        if (!targetId) {
            viewName = "home";
        }

        Object.entries(VIEW_IDS).forEach(
            ([name, id]) => {
                const element = $(id);

                if (!element) return;

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

        state.currentView = viewName;

        qsa(".nav-item").forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.view === viewName
            );
        });

        const bottomNavigation = $("bottomNavigation");

        if (bottomNavigation) {
            bottomNavigation.classList.toggle(
                "hidden",
                viewName === "game" ||
                viewName === "matching"
            );
        }

        if (viewName === "stake") {
            renderStakes();
        }

        if (viewName === "profile") {
            renderProfile();
        }

        if (viewName === "garage") {
            renderGarage();
        }

        if (viewName === "settings") {
            renderSettings();
        }
    }


    /* =====================================================
       PROFILE
    ===================================================== */

    function updateAvatar(element, profile) {
        if (!element) return;

        if (profile?.avatar) {
            element.innerHTML = `
                <img
                    src="${escapeHtml(profile.avatar)}"
                    alt=""
                >
            `;
        } else {
            element.textContent = initials(
                profile?.name
            );
        }
    }

    function renderProfileSummary() {
        const p = state.profile;

        if (!p) return;

        const name = p.name || "Игрок";
        const level = Number(p.level || 1);
        const xp = Number(p.xp || 0);
        const balance = Number(
            p.hc ?? p.balance ?? p.lux ?? 0
        );

        const playerName = $("playerName");

        if (playerName) {
            playerName.textContent = name;
        }

        const playerLevel = $("playerLevel");

        if (playerLevel) {
            playerLevel.textContent = level;
        }

        const balanceElement = $("playerBalance");

        if (balanceElement) {
            balanceElement.textContent = number(balance);
        }

        updateAvatar(
            $("playerAvatar"),
            p
        );

        updateAvatar(
            qs("#profileButton .avatar"),
            p
        );

        const xpProgress = $("xpProgress");

        if (xpProgress) {
            const currentLevelXp = xp % 1000;

            xpProgress.style.width =
                `${Math.min(100, currentLevelXp / 10)}%`;
        }

        const games = Number(
            p.games ??
            p.gamesPlayed ??
            ((p.wins || 0) + (p.losses || 0))
        );

        const wins = Number(p.wins || 0);
        const losses = Number(p.losses || 0);

        setText("gamesPlayed", games);
        setText("gamesWon", wins);
        setText("gamesLost", losses);
    }

    function renderProfile() {
        const p = state.profile;

        if (!p) return;

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
                ? `@${String(p.username).replace(/^@/, "")}`
                : "@username"
        );

        setText(
            "profileLevel",
            p.level || 1
        );

        const games = Number(
            p.games ??
            p.gamesPlayed ??
            ((p.wins || 0) + (p.losses || 0))
        );

        setText("profileGames", games);
        setText("profileWins", p.wins || 0);
        setText("profileLosses", p.losses || 0);

        setText(
            "profileBalance",
            `${number(p.hc ?? 0)} HC`
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

    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent = String(value);
        }
    }


    /* =====================================================
       STAKES
    ===================================================== */

    function renderStakes() {
        const container = $("stakesContainer");

        if (!container) return;

        const stakes = Array.isArray(
            state.catalog.stakes
        )
            ? state.catalog.stakes
            : [];

        if (!stakes.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">♠</div>
                    <strong>Ставки загружаются</strong>
                    <span>Попробуй ещё раз через несколько секунд.</span>
                </div>
            `;

            return;
        }

        container.innerHTML = stakes
            .map((stake, index) => {
                const value =
                    typeof stake === "number"
                        ? stake
                        : Number(
                            stake?.value ??
                            stake?.amount ??
                            stake?.stake ??
                            0
                        );

                const name =
                    typeof stake === "object"
                        ? (
                            stake.name ||
                            stake.title ||
                            `СТОЛ ${index + 1}`
                        )
                        : `СТОЛ ${index + 1}`;

                const available =
                    Number(
                        state.profile?.hc || 0
                    ) >= value;

                return `
                    <button
                        class="stake-card ${available ? "" : "disabled"}"
                        type="button"
                        data-stake="${value}"
                        ${available ? "" : "disabled"}
                    >
                        <div class="stake-card-left">
                            <div class="stake-card-icon">
                                ♠
                            </div>

                            <div>
                                <strong>
                                    ${escapeHtml(name)}
                                </strong>

                                <span>
                                    Подкидной • 1 × 1
                                </span>
                            </div>
                        </div>

                        <div class="stake-card-price">
                            ${number(value)}
                            <small>HC</small>
                        </div>
                    </button>
                `;
            })
            .join("");

        qsa(
            "[data-stake]",
            container
        ).forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const stake = Number(
                        button.dataset.stake
                    );

                    startMatch(stake);
                }
            );
        });
    }


    /* =====================================================
       MATCHMAKING
    ===================================================== */

    function startMatch(stake) {
        state.matchStake = stake;

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

        showView("matching");

        socket.emit(
            "quick_match",
            {
                stake
            }
        );

        playClick();
    }

    function cancelMatch() {
        socket.emit("leave_room");

        state.matchStake = null;
        state.room = null;

        showView("home");

        setText(
            "matchingStatus",
            "Поиск отменён"
        );
    }


    /* =====================================================
       ROOM
    ===================================================== */

    function handleRoomState(room) {
        state.room = room;

        const players = Array.isArray(
            room?.players
        )
            ? room.players
            : [];

        const maxPlayers =
            Number(room?.maxPlayers || 2);

        if (
            state.currentView === "matching" ||
            room.status === "LOBBY"
        ) {
            setText(
                "matchingPlayers",
                `${players.length} / ${maxPlayers}`
            );

            if (players.length >= maxPlayers) {
                setText(
                    "matchingStatus",
                    "Соперник найден"
                );
            } else {
                setText(
                    "matchingStatus",
                    "Ищем игрока..."
                );
            }
        }

        if (
            room.status === "PLAYING"
        ) {
            showView("game");
        }
    }


    /* =====================================================
       GAME
    ===================================================== */

    function handleGameState(game) {
        state.game = game;

        showView("game");

        renderGame();
    }

    function normalizeCard(card, index) {
        if (typeof card === "string") {
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
        const value = String(
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
            value === "♥" ||
            value === "♦" ||
            value === "♣" ||
            value === "♠"
        ) {
            return value;
        }

        return "♠";
    }

    function renderCard(card, index, location) {
        const c = normalizeCard(
            card,
            index
        );

        const symbol =
            suitSymbol(c.suit);

        const red =
            symbol === "♥" ||
            symbol === "♦";

        return `
            <button
                class="game-card ${red ? "red" : ""}"
                type="button"
                data-card-id="${escapeHtml(c.id)}"
                data-card-location="${escapeHtml(location)}"
            >
                <span class="card-rank">
                    ${escapeHtml(c.rank)}
                </span>

                <span class="card-suit">
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
        const game = state.game;

        if (!game) return;

        const handContainer =
            $("playerHand");

        if (handContainer) {
            const cards = getMyCards(game);

            handContainer.innerHTML =
                Array.isArray(cards) && cards.length
                    ? cards
                        .map(
                            (card, index) =>
                                renderCard(
                                    card,
                                    index,
                                    "hand"
                                )
                        )
                        .join("")
                    : `
                        <div class="empty-state">
                            <span>
                                Нет карт
                            </span>
                        </div>
                    `;

            qsa(
                ".game-card",
                handContainer
            ).forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        handleCardClick(
                            button.dataset.cardId
                        );
                    }
                );
            });
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
                            (card, index) =>
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

        if (deck !== undefined) {
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
    }

    function getOpponent(game) {
        const players =
            game?.players ||
            state.room?.players ||
            [];

        const myId =
            state.profile?.id;

        return players.find(
            (player) =>
                String(player?.id) !==
                String(myId)
        ) || players[0];
    }

    function getGameStatusText(game) {
        if (
            game?.status === "FINISHED"
        ) {
            return "Партия завершена";
        }

        if (
            game?.status === "WAITING"
        ) {
            return "Ожидание хода...";
        }

        if (
            game?.turnPlayerId &&
            state.profile?.id
        ) {
            if (
                String(game.turnPlayerId) ===
                String(state.profile.id)
            ) {
                return "Твой ход";
            }

            return "Ход соперника";
        }

        return "Ожидание хода...";
    }

    function handleCardClick(cardId) {
        if (!state.game) return;

        const game = state.game;

        const myId =
            state.profile?.id;

        const attacker =
            game.attackerId ??
            game.currentPlayerId;

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
    ===================================================== */

    function takeCards() {
        socket.emit("take_cards");
        playClick();
    }

    function passAttack() {
        socket.emit("end_attack");
        playClick();
    }


    /* =====================================================
       GARAGE
    ===================================================== */

    function renderGarage() {
        const container =
            $("garageContainer");

        if (!container) return;

        const garage =
            Array.isArray(
                state.profile?.garage
            )
                ? state.profile.garage
                : [];

        if (!garage.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
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
                .map((vehicle) => {
                    const brand =
                        vehicle?.brand ||
                        vehicle?.manufacturer ||
                        "";

                    const model =
                        vehicle?.model ||
                        vehicle?.name ||
                        "Автомобиль";

                    return `
                        <div class="garage-card">
                            <div class="garage-card-icon">
                                🚘
                            </div>

                            <div class="garage-card-info">
                                <strong>
                                    ${escapeHtml(brand)}
                                </strong>

                                <span>
                                    ${escapeHtml(model)}
                                </span>
                            </div>
                        </div>
                    `;
                })
                .join("");
    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function renderSettings() {
        const sound =
            $("soundToggle");

        const vibration =
            $("vibrationToggle");

        if (sound) {
            const value =
                qs("strong", sound);

            if (value) {
                value.textContent =
                    state.sound
                        ? "ВКЛ"
                        : "ВЫКЛ";
            }
        }

        if (vibration) {
            const value =
                qs("strong", vibration);

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
    ===================================================== */

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
    ===================================================== */

    function toast(
        message,
        type = "info"
    ) {
        const container =
            $("toastContainer");

        if (!container) return;

        const element =
            document.createElement("div");

        element.className =
            `toast toast-${type}`;

        element.textContent =
            String(message);

        container.appendChild(
            element
        );

        requestAnimationFrame(() => {
            element.classList.add(
                "show"
            );
        });

        setTimeout(() => {
            element.classList.remove(
                "show"
            );

            setTimeout(() => {
                element.remove();
            }, 250);
        }, 3000);
    }


    /* =====================================================
       BOOTSTRAP
    ===================================================== */

    function applyBootstrap(data) {
        if (!data) return;

        if (data.profile) {
            state.profile =
                data.profile;
        }

        if (data.catalog) {
            state.catalog = {
                ...state.catalog,
                ...data.catalog
            };
        }

        state.bootstrapped = true;

        renderAll();

        showScreen("mainScreen");
        showView("home");
    }


    /* =====================================================
       RENDER ALL
    ===================================================== */

    function renderAll() {
        renderProfileSummary();
        renderProfile();
        renderGarage();
        renderSettings();

        if (
            state.currentView === "stake"
        ) {
            renderStakes();
        }

        if (
            state.currentView === "game" &&
            state.game
        ) {
            renderGame();
        }
    }


    /* =====================================================
       SOCKET EVENTS
    ===================================================== */

    socket.on(
        "connect",
        () => {
            state.connected = true;

            const loadingText =
                qs(
                    ".loading-text",
                    $("loadingScreen")
                );

            if (loadingText) {
                loadingText.textContent =
                    "Загрузка профиля...";
            }
        }
    );

    socket.on(
        "disconnect",
        () => {
            state.connected = false;

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

    socket.on(
        "connect_error",
        (error) => {
            console.error(
                "[Heavy Lux] Socket error:",
                error
            );

            if (!state.bootstrapped) {
                showAuth();
            }

            toast(
                "Не удалось подключиться к серверу",
                "error"
            );
        }
    );

    socket.on(
        "bootstrap",
        (data) => {
            applyBootstrap(data);
        }
    );

    socket.on(
        "auth_error",
        (data) => {
            console.error(
                "[Heavy Lux] Auth error:",
                data
            );

            showAuth();

            toast(
                data?.message ||
                "Ошибка авторизации",
                "error"
            );
        }
    );

    socket.on(
        "room_state",
        (room) => {
            handleRoomState(room);
        }
    );

    socket.on(
        "game_state",
        (game) => {
            handleGameState(game);
        }
    );

    socket.on(
        "toast",
        (data) => {
            toast(
                data?.message ||
                "Сообщение",
                data?.type ||
                "info"
            );
        }
    );

    socket.on(
        "quick_match_wait",
        () => {
            setText(
                "matchingStatus",
                "Ожидаем соперника..."
            );

            setText(
                "matchingPlayers",
                "1 / 2"
            );
        }
    );

    socket.on(
        "quick_message",
        (data) => {
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

    socket.on(
        "rooms_list",
        (rooms) => {
            console.log(
                "[Heavy Lux] rooms:",
                rooms
            );
        }
    );


    /* =====================================================
       UI EVENTS
    ===================================================== */

    function bindUI() {
        const playButton =
            $("playButton");

        if (playButton) {
            playButton.addEventListener(
                "click",
                () => {
                    showView("stake");
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
                    showView("profile");
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
                    showView("settings");
                    playClick();
                }
            );
        }

        qsa(
            ".nav-item"
        ).forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const view =
                        button.dataset.view;

                    if (view) {
                        showView(view);
                        playClick();
                    }
                }
            );
        });

        qsa(
            "[data-back]"
        ).forEach((button) => {
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
        });

        const cancelMatchButton =
            $("cancelMatchButton");

        if (cancelMatchButton) {
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
                (event) => {
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
                    socket.disconnect();

                    state.profile = null;
                    state.game = null;
                    state.room = null;

                    showAuth();
                }
            );
        }

        const telegramLoginButton =
            $("telegramLoginButton");

        if (telegramLoginButton) {
            telegramLoginButton.addEventListener(
                "click",
                () => {
                    openTelegram();
                }
            );
        }

        const testLoginButton =
            $("testLoginButton");

        if (testLoginButton) {
            testLoginButton.addEventListener(
                "click",
                () => {
                    location.reload();
                }
            );
        }
    }


    /* =====================================================
       TELEGRAM
    ===================================================== */

    function openTelegram() {
        try {
            if (
                window.Telegram &&
                window.Telegram.WebApp
            ) {
                window.Telegram.WebApp.ready();

                const user =
                    window.Telegram.WebApp
                        .initDataUnsafe
                        ?.user;

                if (user) {
                    socket.auth = {
                        initData:
                            window.Telegram.WebApp
                                .initData,

                        devId:
                            String(
                                user.id
                            ),

                        username:
                            user.username ||
                            "",

                        name:
                            user.first_name ||
                            "Игрок"
                    };

                    if (
                        !socket.connected
                    ) {
                        socket.connect();
                    }

                    return;
                }
            }
        } catch (error) {
            console.error(
                "[Heavy Lux] Telegram:",
                error
            );
        }

        toast(
            "Открой игру через Telegram",
            "info"
        );
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function init() {
        loadSettings();
        bindUI();

        /*
         * В DEV / обычном браузере backend
         * автоматически принимает devId,
         * если BOT_TOKEN не задан.
         */

        showScreen(
            "loadingScreen"
        );

        const timeout =
            setTimeout(() => {
                if (
                    !state.bootstrapped
                ) {
                    if (
                        state.connected
                    ) {
                        /*
                         * Socket подключён,
                         * но bootstrap почему-то
                         * не пришёл.
                         */
                        toast(
                            "Сервер подключён, ожидание данных...",
                            "info"
                        );
                    } else {
                        showAuth();
                    }
                }
            }, 7000);

        window.addEventListener(
            "beforeunload",
            () => {
                clearTimeout(timeout);
            }
        );
    }


    /* =====================================================
       GLOBAL DEBUG
    ===================================================== */

    window.HEAVY_LUX_CLIENT = {
        state,
        socket,

        showView,
        toast,
        openModal,

        refreshRooms() {
            socket.emit(
                "list_rooms"
            );
        },

        getState() {
            return state;
        }
    };


    init();
})();
