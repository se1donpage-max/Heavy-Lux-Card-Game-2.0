"use strict";

/*
=========================================================
HEAVY LUX CARD
FRONTEND APPLICATION
=========================================================

Этот файл отвечает только за интерфейс.

Он НЕ содержит серверную игровую логику.

Позже сюда подключаются:

- Socket.IO
- Telegram WebApp
- существующий game engine
- lobby API
- profile API
- garage API
- economy API

=========================================================
*/


/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {

    currentScreen:
        "home",

    playTab:
        "create",

    players:
        2,

    bet:
        100,

    balance:
        20000,

    level:
        1,

    xp:
        0,

    rating:
        1000,

    wins:
        0,

    losses:
        0,

    games:
        0,

    selectedCard:
        null,

    gameActive:
        false,

    playerName:
        "Игрок",

    playerAvatar:
        "V"

};


/* =========================================================
   HELPERS
========================================================= */

function $(selector) {

    return document.querySelector(
        selector
    );

}


function $$(selector) {

    return [
        ...document.querySelectorAll(
            selector
        )
    ];

}


function formatNumber(number) {

    return Number(number || 0)
        .toLocaleString("ru-RU");

}


function showToast(message) {

    const toast =
        $("#toast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            1800
        );

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

            screen.classList.remove(
                "active"
            );

        }
    );

    target.classList.add(
        "active"
    );

    state.currentScreen =
        screenName;


    /*
    Нижняя навигация.
    */

    $$(".nav-button").forEach(
        button => {

            button.classList.toggle(
                "active",
                button.dataset.screen ===
                    screenName
            );

        }
    );


    /*
    На игровых/внутренних экранах
    нижняя навигация остаётся доступной,
    но игра получает отдельный визуальный режим.
    */

    window.scrollTo({
        top: 0,
        behavior: "instant"
    });

}


/* =========================================================
   NAVIGATION EVENTS
========================================================= */

function initNavigation() {

    $$("[data-screen]").forEach(
        element => {

            element.addEventListener(
                "click",
                () => {

                    const screen =
                        element.dataset.screen;

                    openScreen(
                        screen
                    );

                }
            );

        }
    );

}


/* =========================================================
   PLAY TABS
========================================================= */

function initPlayTabs() {

    $$("[data-play-tab]").forEach(
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

                                panel.classList.remove(
                                    "active"
                                );

                            }
                        );

                    const target =
                        document.getElementById(
                            `play-${tab}`
                        );

                    if (target) {

                        target.classList.add(
                            "active"
                        );

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

    $$("[data-players]").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.players =
                        Number(
                            button.dataset.players
                        );

                    $$("[data-players]")
                        .forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );

                    $("#previewPlayers")
                        .textContent =
                        state.players;

                }
            );

        }
    );

}


/* =========================================================
   BET CHOICES
========================================================= */

function initBetChoices() {

    $$(".bet").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.bet =
                        Number(
                            button.dataset.bet
                        );

                    $$(".bet")
                        .forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );

                    $("#previewBet")
                        .textContent =
                        `${formatNumber(state.bet)} HC`;

                }
            );

        }
    );

}


/* =========================================================
   CREATE LOBBY
========================================================= */

function createLobby() {

    if (
        state.balance <
        state.bet
    ) {

        showToast(
            "Недостаточно HC"
        );

        return;
    }


    /*
    Пока создаём локальную визуальную комнату.

    Следующим этапом здесь будет:

    socket.emit(
        "createLobby",
        {
            players: state.players,
            bet: state.bet
        }
    );
    */

    showToast(
        "Лобби создано"
    );


    setTimeout(
        () => {

            openScreen(
                "play"
            );

            const findTab =
                $("[data-play-tab='find']");

            if (findTab) {
                findTab.click();
            }

        },
        350
    );

}


/* =========================================================
   QUICK MATCH
========================================================= */

function quickMatch() {

    showToast(
        "Ищем подходящее лобби…"
    );


    /*
    Будущее подключение:

    socket.emit(
        "quickMatch"
    );

    socket.on(
        "lobbyFound",
        lobby => {}
    );
    */


    setTimeout(
        () => {

            showToast(
                "Лобби найдено"
            );

            joinLobby(
                state.bet
            );

        },
        900
    );

}


/* =========================================================
   JOIN LOBBY
========================================================= */

function joinLobby(
    bet
) {

    bet =
        Number(bet);


    if (
        state.balance <
        bet
    ) {

        showToast(
            "Недостаточно HC"
        );

        return;
    }


    /*
    В реальном backend здесь будет:

    socket.emit(
        "joinLobby",
        {
            lobbyId,
            bet
        }
    );
    */


    showToast(
        "Подключение к лобби…"
    );


    setTimeout(
        () => {

            openGame();

        },
        500
    );

}


/* =========================================================
   LOBBY EVENTS
========================================================= */

function initLobbyActions() {

    const createButton =
        $("#createLobbyButton");

    if (createButton) {

        createButton.addEventListener(
            "click",
            createLobby
        );

    }


    const quickButton =
        $("#quickMatchButton");

    if (quickButton) {

        quickButton.addEventListener(
            "click",
            quickMatch
        );

    }


    $$(".join-lobby")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        joinLobby(
                            button.dataset.bet
                        );

                    }
                );

            }
        );

}


/* =========================================================
   GAME
========================================================= */

function openGame() {

    state.gameActive =
        true;

    state.selectedCard =
        null;

    openScreen(
        "game"
    );

    showToast(
        "Партия началась"
    );

}


/* =========================================================
   CARD SELECTION
========================================================= */

function initCards() {

    $$(".playing-card")
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        selectCard(
                            card
                        );

                    }
                );

            }
        );

}


function selectCard(card) {

    $$(".playing-card")
        .forEach(
            item => {

                item.classList.remove(
                    "selected"
                );

            }
        );

    card.classList.add(
        "selected"
    );

    state.selectedCard =
        card.dataset.card;


    /*
    В реальной игре здесь
    будет отправка действия
    после проверки сервером.

    Например:

    socket.emit(
        "playCard",
        {
            cardId:
                state.selectedCard
        }
    );
    */

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

                if (!state.gameActive) {
                    return;
                }

                showToast(
                    "Карты взяты"
                );

                clearSelectedCard();

            }
        );

    }


    const end =
        $("#endAttackButton");

    if (end) {

        end.addEventListener(
            "click",
            () => {

                if (!state.gameActive) {
                    return;
                }

                showToast(
                    "Атака закончена"
                );

                clearSelectedCard();

            }
        );

    }

}


function clearSelectedCard() {

    state.selectedCard =
        null;

    $$(".playing-card")
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

function openModal(id) {

    const modal =
        document.getElementById(
            id
        );

    if (!modal) {
        return;
    }

    modal.classList.add(
        "active"
    );

}


function closeModal(id) {

    const modal =
        document.getElementById(
            id
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "active"
    );

}


function initMessageModal() {

    const button =
        $("#messageButton");

    if (button) {

        button.addEventListener(
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

                        closeModal(
                            "messageModal"
                        );

                        showToast(
                            text
                        );


                        /*
                        Будущее:

                        socket.emit(
                            "quickMessage",
                            {
                                text
                            }
                        );
                        */

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


/* =========================================================
   PLAYER INFO
========================================================= */

function initPlayerInfo() {

    $$(".player-info")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openModal(
                            "playerInfoModal"
                        );

                    }
                );

            }
        );


    const close =
        $("#closePlayerInfo");

    if (close) {

        close.addEventListener(
            "click",
            () => {

                closeModal(
                    "playerInfoModal"
                );

            }
        );

    }


    $$("#playerInfoModal .modal-backdrop")
        .forEach(
            backdrop => {

                backdrop.addEventListener(
                    "click",
                    () => {

                        closeModal(
                            "playerInfoModal"
                        );

                    }
                );

            }
        );

}


/* =========================================================
   PROFILE OWNERSHIP TABS
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

                                    panel.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        const panel =
                            document.getElementById(
                                `owner-${target}`
                            );

                        if (panel) {

                            panel.classList.add(
                                "active"
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   SHOWROOM TABS
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

                                    panel.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        const panel =
                            document.getElementById(
                                `showroom-${target}`
                            );

                        if (panel) {

                            panel.classList.add(
                                "active"
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   BUY CAR
========================================================= */

function initCarPurchases() {

    $$(".buy-car")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const price =
                            Number(
                                button.dataset.price
                            );


                        if (
                            state.balance <
                            price
                        ) {

                            showToast(
                                "Недостаточно HC"
                            );

                            return;

                        }


                        state.balance -=
                            price;


                        updateProfileUI();

                        showToast(
                            "Автомобиль приобретён"
                        );


                        /*
                        В реальном backend:

                        socket.emit(
                            "buyVehicle",
                            {
                                vehicleId
                            }
                        );
                        */

                    }
                );

            }
        );

}


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

    $("#topBalance")
        .textContent =
        formatNumber(
            state.balance
        );


    $("#homeLevel")
        .textContent =
        state.level;


    $("#homeWins")
        .textContent =
        state.wins;


    $("#homeLosses")
        .textContent =
        state.losses;


    $("#homeRating")
        .textContent =
        state.rating;


    $("#profileLevel")
        .textContent =
        state.level;


    $("#profileRating")
        .textContent =
        state.rating;


    $("#profileWins")
        .textContent =
        state.wins;


    $("#profileLosses")
        .textContent =
        state.losses;


    $("#profileGames")
        .textContent =
        state.games;


    $("#profileXP")
        .textContent =
        state.xp;


    $("#homeName")
        .textContent =
        state.playerName;


    $("#profileName")
        .textContent =
        state.playerName;


    $("#homeAvatar")
        .textContent =
        state.playerAvatar;

}


/* =========================================================
   TELEGRAM WEB APP
========================================================= */

function initTelegram() {

    /*
    Этот блок безопасен даже если
    Telegram WebApp недоступен.

    Позже здесь можно получить:

    Telegram.WebApp.initData
    Telegram.WebApp.initDataUnsafe.user
    */


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


    const webApp =
        window.Telegram.WebApp;


    try {

        webApp.ready();

        webApp.expand();

    }
    catch (error) {

        console.warn(
            "Telegram WebApp init error:",
            error
        );

    }


    const user =
        webApp.initDataUnsafe &&
        webApp.initDataUnsafe.user;


    if (!user) {
        return;
    }


    /*
    Telegram name.

    Приоритет:

    username
    first_name
    */

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


/* =========================================================
   SOCKET.IO
========================================================= */

let socket =
    null;


function initSocket() {

    /*
    ВАЖНО:

    Socket.IO подключаем только если
    библиотека реально доступна.

    Это позволяет интерфейсу работать
    даже отдельно от backend.

    Когда подключим существующий server.js,
    сюда будет добавлена авторизация
    и реальные события.
    */


    if (
        typeof window.io !==
        "function"
    ) {

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

                    reconnection:
                        true,

                    reconnectionAttempts:
                        Infinity,

                    reconnectionDelay:
                        1000
                }
            );


        socket.on(
            "connect",
            () => {

                console.log(
                    "[Heavy Lux] Socket connected:",
                    socket.id
                );

            }
        );


        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "[Heavy Lux] Socket disconnected:",
                    reason
                );

            }
        );


        /*
        Реальные события игры
        подключим следующим этапом.
        */

    }
    catch (error) {

        console.warn(
            "Socket initialization failed:",
            error
        );

    }

}


/* =========================================================
   INITIALIZATION
========================================================= */

function initApp() {

    initNavigation();

    initPlayTabs();

    initPlayerChoices();

    initBetChoices();

    initLobbyActions();

    initCards();

    initGameActions();

    initMessageModal();

    initPlayerInfo();

    initOwnershipTabs();

    initShowrooms();

    initCarPurchases();

    initTelegram();

    initSocket();

    updateProfileUI();


    console.log(
        "Heavy Lux Card frontend initialized"
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
