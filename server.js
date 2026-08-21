"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const {
    STAKES,
    createGame,
    dealInitial,
    playAttack,
    defend,
    take,
    endAttack,
    stateForPlayer
} = require("./game/engine");

const {
    VEHICLES,
    EXCLUSIVE,
    PROPERTY,
    PROPERTY_COLORS,
    BEAUTIFUL_NUMBERS,
    QUICK_PHRASES
} = require("./data/catalog");


/* =========================================================
   CONFIG
========================================================= */

const PORT =
    Number(process.env.PORT) || 10000;

const BOT_TOKEN =
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    "";

const app = express();

const server =
    http.createServer(app);

const io =
    new Server(server, {
        cors: {
            origin: "*"
        },

        transports: [
            "websocket",
            "polling"
        ]
    });

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================================
   STORAGE
========================================================= */

const rooms =
    new Map();

const players =
    new Map();

const sockets =
    new Map();


/* =========================================================
   HELPERS
========================================================= */

function safeName(value) {
    return typeof value === "string"
        ? value.trim().slice(0, 40)
        : "Игрок";
}


function profile(id, tg = {}) {

    if (players.has(id)) {
        const existing =
            players.get(id);

        /*
         * Обновляем Telegram-профиль
         * при повторном подключении.
         */
        if (tg.username !== undefined) {
            existing.username =
                safeName(tg.username);
        }

        if (tg.first_name !== undefined) {
            existing.name =
                safeName(
                    tg.first_name ||
                    tg.username ||
                    existing.name ||
                    "Игрок"
                );
        }

        if (tg.photo_url !== undefined) {
            existing.avatar =
                tg.photo_url || "";
        }

        return existing;
    }


    const p = {

        id,

        telegramId:
            String(
                tg.id || id
            ),

        username:
            safeName(
                tg.username || ""
            ),

        name:
            safeName(
                tg.first_name ||
                tg.username ||
                "Игрок"
            ),

        avatar:
            tg.photo_url || "",

        level: 1,

        xp: 0,

        hc: 20000,

        rating: 1000,

        wins: 0,

        losses: 0,

        garage: [],

        plates: [],

        properties: [],

        businesses: [],

        displayProperty: null,

        displayVehicle: null
    };


    players.set(id, p);

    return p;
}


function publicProfile(p) {

    if (!p) {
        return null;
    }

    return {

        id: p.id,

        name: p.name,

        username: p.username,

        avatar: p.avatar,

        level: p.level,

        xp: p.xp,

        hc: p.hc,

        rating: p.rating,

        wins: p.wins,

        losses: p.losses,

        displayProperty:
            p.displayProperty,

        displayVehicle:
            p.displayVehicle,

        garage:
            p.garage,

        plates:
            p.plates,

        properties:
            p.properties,

        businesses:
            p.businesses
    };
}


/* =========================================================
   TELEGRAM AUTH
========================================================= */

function signCheck(initData) {

    /*
     * DEV MODE
     *
     * Если BOT_TOKEN не задан,
     * разрешаем обычный браузер.
     */
    if (!BOT_TOKEN) {

        return {
            ok: true,
            dev: true,
            user: null
        };
    }


    if (
        typeof initData !== "string" ||
        !initData
    ) {

        return {
            ok: false,
            error:
                "Telegram initData отсутствует"
        };
    }


    const params =
        new URLSearchParams(
            initData
        );

    const hash =
        params.get("hash");


    if (!hash) {

        return {
            ok: false,
            error:
                "Telegram hash отсутствует"
        };
    }


    params.delete("hash");


    const data =
        [...params.entries()]
            .sort(
                ([a], [b]) =>
                    a.localeCompare(b)
            )
            .map(
                ([key, value]) =>
                    `${key}=${value}`
            )
            .join("\n");


    const secret =
        crypto
            .createHmac(
                "sha256",
                "WebAppData"
            )
            .update(BOT_TOKEN)
            .digest();


    const expected =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(data)
            .digest("hex");


    if (expected !== hash) {

        return {
            ok: false,
            error:
                "Неверная подпись Telegram"
        };
    }


    let user = {};

    try {

        user =
            JSON.parse(
                params.get("user") ||
                "{}"
            );

    } catch {

        return {
            ok: false,
            error:
                "Некорректные данные Telegram"
        };
    }


    return {
        ok: true,
        user
    };
}


/* =========================================================
   SOCKET AUTH
========================================================= */

function authSocket(socket) {

    const auth =
        socket.handshake.auth || {};


    const result =
        signCheck(
            auth.initData || ""
        );


    if (!result.ok) {
        throw new Error(
            result.error
        );
    }


    const tg =
        result.user || {

            id:
                auth.devId ||
                `dev_${socket.id}`,

            username:
                auth.username ||
                "demo",

            first_name:
                auth.name ||
                "Игрок",

            photo_url: ""
        };


    const id =
        String(
            tg.id ||
            auth.devId ||
            socket.id
        );


    const p =
        profile(
            id,
            tg
        );


    socket.data.playerId =
        id;


    sockets.set(
        id,
        socket.id
    );


    return p;
}


/* =========================================================
   ROOM
========================================================= */

function roomState(room) {

    return {

        roomId:
            room.id,

        stake:
            room.stake,

        maxPlayers:
            room.maxPlayers,

        status:
            room.status,

        hostId:
            room.hostId,

        players:
            room.playerIds
                .map(
                    id =>
                        publicProfile(
                            players.get(id)
                        )
                )
    };
}


function findRoom(id) {

    for (
        const room of rooms.values()
    ) {

        if (
            room.playerIds.includes(id)
        ) {
            return room;
        }
    }

    return null;
}


function getSocket(playerId) {

    const socketId =
        sockets.get(playerId);

    if (!socketId) {
        return null;
    }

    return io.sockets.sockets.get(
        socketId
    ) || null;
}


function emitRoom(room) {

    if (!room) {
        return;
    }


    for (
        const id of room.playerIds
    ) {

        const socket =
            getSocket(id);

        if (socket) {

            socket.emit(
                "room_state",
                roomState(room)
            );
        }
    }
}


function emitGame(room) {

    if (
        !room ||
        !room.game
    ) {
        return;
    }


    for (
        const id of room.playerIds
    ) {

        const socket =
            getSocket(id);

        if (!socket) {
            continue;
        }


        socket.emit(
            "game_state",
            stateForPlayer(
                room.game,
                id
            )
        );
    }
}


/* =========================================================
   REWARDS
========================================================= */

function finishRewards(room) {

    if (
        !room ||
        !room.game ||
        room.rewarded
    ) {
        return;
    }


    room.rewarded = true;


    const game =
        room.game;


    for (
        const id of room.playerIds
    ) {

        const p =
            players.get(id);

        if (!p) {
            continue;
        }


        const win =
            game.winnerId === id;


        const delta =
            win
                ? Math.floor(
                    room.stake * 0.8
                )
                : Math.floor(
                    room.stake * 0.15
                );


        p.hc += delta;


        p.xp +=
            win
                ? 100
                : 40;


        if (win) {

            p.wins++;

            p.rating += 25;

        } else {

            p.losses++;

            p.rating =
                Math.max(
                    0,
                    p.rating - 10
                );
        }


        p.level =
            Math.min(
                100,
                1 +
                Math.floor(
                    p.xp / 1000
                )
            );


        const socket =
            getSocket(id);

        if (socket) {

            socket.emit(
                "profile",
                publicProfile(p)
            );
        }
    }
}


/* =========================================================
   START GAME
========================================================= */

function startRoom(room) {

    if (
        !room ||
        room.playerIds.length <
        2
    ) {
        throw new Error(
            "Нужно минимум 2 игрока"
        );
    }


    if (
        room.playerIds.some(
            id =>
                players.get(id).hc <
                room.stake
        )
    ) {

        throw new Error(
            "У игрока недостаточно HC"
        );
    }


    /*
     * Резервируем ставку.
     */
    for (
        const id of room.playerIds
    ) {

        players.get(id).hc -=
            room.stake;
    }


    room.game =
        createGame({

            id: room.id,

            playerIds:
                room.playerIds,

            stake:
                room.stake
        });


    dealInitial(
        room.game
    );


    room.status =
        "PLAYING";


    room.rewarded =
        false;


    emitRoom(room);

    emitGame(room);


    console.log(
        `[GAME START] ${room.id} | ${room.playerIds.join(", ")} | stake=${room.stake}`
    );
}


/* =========================================================
   CREATE QUICK MATCH ROOM
========================================================= */

function createQuickRoom(
    playerId,
    stake
) {

    const room = {

        id:
            crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase(),

        stake:
            Number(stake),

        maxPlayers:
            2,

        status:
            "LOBBY",

        hostId:
            playerId,

        playerIds:
            [playerId],

        game:
            null,

        rewarded:
            false,

        quickMatch:
            true
    };


    rooms.set(
        room.id,
        room
    );


    return room;
}


/* =========================================================
   ERROR
========================================================= */

function sendError(
    socket,
    message
) {

    socket.emit(
        "toast",
        {
            type: "error",
            message:
                String(message)
        }
    );
}


/* =========================================================
   HTTP
========================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "Heavy Lux Card",

            rooms:
                rooms.size,

            players:
                players.size
        });
    }
);


app.get(
    "/api/catalog",
    (req, res) => {

        res.json({

            stakes:
                STAKES,

            vehicles:
                VEHICLES,

            exclusive:
                EXCLUSIVE,

            property:
                PROPERTY,

            propertyColors:
                PROPERTY_COLORS,

            beautifulNumbers:
                BEAUTIFUL_NUMBERS,

            quickPhrases:
                QUICK_PHRASES
        });
    }
);


app.post(
    "/api/auth/telegram",
    (req, res) => {

        const result =
            signCheck(
                req.body?.initData ||
                ""
            );


        if (!result.ok) {

            return res
                .status(401)
                .json(result);
        }


        const tg =
            result.user || {

                id:
                    req.body?.devId ||
                    "demo",

                first_name:
                    "Игрок"
            };


        res.json({

            ok: true,

            profile:
                publicProfile(
                    profile(
                        String(tg.id),
                        tg
                    )
                ),

            telegramValidated:
                Boolean(BOT_TOKEN)
        });
    }
);


/* =========================================================
   SOCKET
========================================================= */

io.on(
    "connection",
    socket => {

        try {

            const p =
                authSocket(socket);


            socket.emit(
                "bootstrap",
                {

                    profile:
                        publicProfile(p),

                    catalog: {

                        stakes:
                            STAKES,

                        vehicles:
                            VEHICLES,

                        exclusive:
                            EXCLUSIVE,

                        property:
                            PROPERTY,

                        propertyColors:
                            PROPERTY_COLORS,

                        beautifulNumbers:
                            BEAUTIFUL_NUMBERS,

                        quickPhrases:
                            QUICK_PHRASES
                    }
                }
            );


            const room =
                findRoom(p.id);


            if (room) {

                socket.join(
                    room.id
                );


                emitRoom(room);


                if (room.game) {

                    socket.emit(
                        "game_state",
                        stateForPlayer(
                            room.game,
                            p.id
                        )
                    );
                }
            }

        } catch (error) {

            socket.emit(
                "auth_error",
                {
                    message:
                        error.message
                }
            );


            socket.disconnect(
                true
            );


            return;
        }


        /* =================================================
           CREATE ROOM
        ================================================== */

        socket.on(
            "create_room",
            ({
                stake,
                maxPlayers = 2
            } = {}) => {

                try {

                    const id =
                        socket.data.playerId;


                    if (findRoom(id)) {

                        throw new Error(
                            "Вы уже находитесь в лобби"
                        );
                    }


                    stake =
                        Number(stake);


                    maxPlayers =
                        Number(maxPlayers);


                    if (
                        !STAKES.includes(
                            stake
                        )
                    ) {

                        throw new Error(
                            "Недопустимая ставка"
                        );
                    }


                    if (
                        ![2, 3].includes(
                            maxPlayers
                        )
                    ) {

                        throw new Error(
                            "Количество игроков: 2 или 3"
                        );
                    }


                    if (
                        players.get(id).hc <
                        stake
                    ) {

                        throw new Error(
                            "Недостаточно HC"
                        );
                    }


                    const room = {

                        id:
                            crypto
                                .randomBytes(3)
                                .toString("hex")
                                .toUpperCase(),

                        stake,

                        maxPlayers,

                        status:
                            "LOBBY",

                        hostId:
                            id,

                        playerIds:
                            [id],

                        game:
                            null,

                        rewarded:
                            false,

                        quickMatch:
                            false
                    };


                    rooms.set(
                        room.id,
                        room
                    );


                    socket.join(
                        room.id
                    );


                    emitRoom(room);

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           LIST ROOMS
        ================================================== */

        socket.on(
            "list_rooms",
            () => {

                socket.emit(
                    "rooms_list",
                    [...rooms.values()]
                        .filter(
                            room =>
                                room.status ===
                                "LOBBY" &&
                                room.playerIds.length <
                                room.maxPlayers
                        )
                        .map(
                            roomState
                        )
                );
            }
        );


        /* =================================================
           JOIN ROOM
        ================================================== */

        socket.on(
            "join_room",
            ({
                roomId
            } = {}) => {

                try {

                    const id =
                        socket.data.playerId;


                    const room =
                        rooms.get(
                            String(
                                roomId ||
                                ""
                            )
                                .toUpperCase()
                        );


                    if (!room) {

                        throw new Error(
                            "Лобби не найдено"
                        );
                    }


                    if (
                        room.status !==
                        "LOBBY"
                    ) {

                        throw new Error(
                            "Игра уже началась"
                        );
                    }


                    if (
                        room.playerIds.includes(
                            id
                        )
                    ) {

                        return emitRoom(
                            room
                        );
                    }


                    if (
                        room.playerIds.length >=
                        room.maxPlayers
                    ) {

                        throw new Error(
                            "Лобби заполнено"
                        );
                    }


                    if (findRoom(id)) {

                        throw new Error(
                            "Сначала выйдите из текущего лобби"
                        );
                    }


                    if (
                        players.get(id).hc <
                        room.stake
                    ) {

                        throw new Error(
                            "Недостаточно HC для ставки"
                        );
                    }


                    room.playerIds.push(
                        id
                    );


                    socket.join(
                        room.id
                    );


                    emitRoom(room);


                    /*
                     * Автоматически запускаем
                     * комнату, если она заполнена.
                     */
                    if (
                        room.playerIds.length ===
                        room.maxPlayers
                    ) {

                        startRoom(
                            room
                        );
                    }

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           START ROOM
        ================================================== */

        socket.on(
            "start_room",
            () => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (!room) {

                        throw new Error(
                            "Лобби не найдено"
                        );
                    }


                    if (
                        room.hostId !==
                        socket.data.playerId
                    ) {

                        throw new Error(
                            "Начать игру может создатель"
                        );
                    }


                    if (
                        room.playerIds.length !==
                        room.maxPlayers
                    ) {

                        throw new Error(
                            "Лобби ещё не заполнено"
                        );
                    }


                    startRoom(room);

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           LEAVE ROOM
        ================================================== */

        socket.on(
            "leave_room",
            () => {

                try {

                    const id =
                        socket.data.playerId;


                    const room =
                        findRoom(id);


                    if (!room) {
                        return;
                    }


                    if (
                        room.status ===
                        "PLAYING"
                    ) {

                        throw new Error(
                            "Покинуть активную партию нельзя"
                        );
                    }


                    room.playerIds =
                        room.playerIds.filter(
                            x => x !== id
                        );


                    socket.leave(
                        room.id
                    );


                    if (
                        room.hostId === id
                    ) {

                        room.hostId =
                            room.playerIds[0] ||
                            null;
                    }


                    if (
                        !room.playerIds.length
                    ) {

                        rooms.delete(
                            room.id
                        );

                    } else {

                        emitRoom(
                            room
                        );
                    }

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           QUICK MATCH
        ================================================== */

        socket.on(
            "quick_match",
            ({
                stake
            } = {}) => {

                try {

                    const id =
                        socket.data.playerId;


                    stake =
                        Number(stake);


                    if (
                        !STAKES.includes(
                            stake
                        )
                    ) {

                        throw new Error(
                            "Недопустимая ставка"
                        );
                    }


                    if (findRoom(id)) {

                        throw new Error(
                            "Вы уже в лобби"
                        );
                    }


                    const player =
                        players.get(id);


                    if (
                        !player ||
                        player.hc < stake
                    ) {

                        throw new Error(
                            "Недостаточно HC для этой ставки"
                        );
                    }


                    /*
                     * Ищем только комнату
                     * с ТОЙ ЖЕ ставкой.
                     */
                    const candidate =
                        [...rooms.values()]
                            .find(
                                room =>
                                    room.status ===
                                    "LOBBY" &&

                                    room.quickMatch ===
                                    true &&

                                    room.stake ===
                                    stake &&

                                    room.playerIds.length <
                                    room.maxPlayers
                            );


                    /*
                     * Второго игрока нет.
                     * Создаём комнату.
                     */
                    if (!candidate) {

                        const room =
                            createQuickRoom(
                                id,
                                stake
                            );


                        socket.join(
                            room.id
                        );


                        emitRoom(
                            room
                        );


                        socket.emit(
                            "quick_match_wait",
                            {
                                roomId:
                                    room.id,

                                stake,

                                players:
                                    1,

                                maxPlayers:
                                    2
                            }
                        );


                        console.log(
                            `[MATCH WAIT] ${room.id} | player=${id} | stake=${stake}`
                        );


                        return;
                    }


                    /*
                     * Нашли первого игрока.
                     */
                    candidate.playerIds.push(
                        id
                    );


                    socket.join(
                        candidate.id
                    );


                    emitRoom(
                        candidate
                    );


                    console.log(
                        `[MATCH FOUND] ${candidate.id} | ${candidate.playerIds.join(", ")}`
                    );


                    /*
                     * Автоматический старт.
                     */
                    if (
                        candidate.playerIds.length ===
                        candidate.maxPlayers
                    ) {

                        startRoom(
                            candidate
                        );
                    }

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           ATTACK
        ================================================== */

        socket.on(
            "play_attack",
            ({
                cardId
            } = {}) => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (
                        !room ||
                        !room.game
                    ) {

                        throw new Error(
                            "Игра не найдена"
                        );
                    }


                    playAttack(
                        room.game,
                        socket.data.playerId,
                        cardId
                    );


                    emitGame(
                        room
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           DEFEND
        ================================================== */

        socket.on(
            "defend",
            ({
                cardId
            } = {}) => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (
                        !room ||
                        !room.game
                    ) {

                        throw new Error(
                            "Игра не найдена"
                        );
                    }


                    defend(
                        room.game,
                        socket.data.playerId,
                        cardId
                    );


                    emitGame(
                        room
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           TAKE
        ================================================== */

        socket.on(
            "take_cards",
            () => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (
                        !room ||
                        !room.game
                    ) {

                        throw new Error(
                            "Игра не найдена"
                        );
                    }


                    take(
                        room.game,
                        socket.data.playerId
                    );


                    if (
                        room.game.status ===
                        "FINISHED"
                    ) {

                        finishRewards(
                            room
                        );
                    }


                    emitGame(
                        room
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           END ATTACK
        ================================================== */

        socket.on(
            "end_attack",
            () => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (
                        !room ||
                        !room.game
                    ) {

                        throw new Error(
                            "Игра не найдена"
                        );
                    }


                    endAttack(
                        room.game,
                        socket.data.playerId
                    );


                    if (
                        room.game.status ===
                        "FINISHED"
                    ) {

                        finishRewards(
                            room
                        );
                    }


                    emitGame(
                        room
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           QUICK MESSAGE
        ================================================== */

        socket.on(
            "quick_message",
            ({
                text
            } = {}) => {

                try {

                    const room =
                        findRoom(
                            socket.data.playerId
                        );


                    if (!room) {

                        throw new Error(
                            "Лобби не найдено"
                        );
                    }


                    const allowed =
                        QUICK_PHRASES.includes(
                            text
                        );


                    if (!allowed) {

                        throw new Error(
                            "Недопустимое сообщение"
                        );
                    }


                    io.to(room.id).emit(
                        "quick_message",
                        {
                            from:
                                socket.data.playerId,

                            text
                        }
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           PROFILE UPDATE
        ================================================== */

        socket.on(
            "profile_update",
            ({
                displayProperty = null,
                displayVehicle = null
            } = {}) => {

                const p =
                    players.get(
                        socket.data.playerId
                    );


                if (!p) {
                    return;
                }


                if (
                    displayProperty !==
                    null &&
                    p.properties.includes(
                        displayProperty
                    )
                ) {

                    p.displayProperty =
                        displayProperty;
                }


                if (
                    displayVehicle !==
                    null &&
                    p.garage.includes(
                        displayVehicle
                    )
                ) {

                    p.displayVehicle =
                        displayVehicle;
                }


                socket.emit(
                    "profile",
                    publicProfile(p)
                );


                const room =
                    findRoom(p.id);


                if (room) {
                    emitRoom(room);
                }
            }
        );


        /* =================================================
           BUY VEHICLE
        ================================================== */

        socket.on(
            "buy_vehicle",
            ({
                id,
                exclusive = false
            } = {}) => {

                try {

                    const p =
                        players.get(
                            socket.data.playerId
                        );


                    const source =
                        exclusive
                            ? EXCLUSIVE
                            : VEHICLES;


                    const item =
                        source.find(
                            x => x.id === id
                        );


                    if (!item) {

                        throw new Error(
                            "Автомобиль не найден"
                        );
                    }


                    if (
                        p.hc < item.price
                    ) {

                        throw new Error(
                            "Недостаточно HC"
                        );
                    }


                    p.hc -=
                        item.price;


                    p.garage.push(
                        item.id
                    );


                    const plate =
                        BEAUTIFUL_NUMBERS.find(
                            n =>
                                !p.plates.includes(
                                    n.id
                                )
                        ) || {

                            id:
                                `random_${Date.now()}`,

                            plate:
                                `А${String(
                                    Math.floor(
                                        Math.random() *
                                        900
                                    ) + 100
                                )}ВС77`,

                            price:
                                1000
                        };


                    p.plates.push(
                        plate.id
                    );


                    p.displayVehicle =
                        item.id;


                    socket.emit(
                        "profile",
                        publicProfile(p)
                    );

                } catch (error) {

                    sendError(
                        socket,
                        error.message
                    );
                }
            }
        );


        /* =================================================
           DISCONNECT
        ================================================== */

        socket.on(
            "disconnect",
            () => {

                const id =
                    socket.data.playerId;


                if (
                    id &&
                    sockets.get(id) ===
                    socket.id
                ) {

                    sockets.delete(
                        id
                    );
                }


                /*
                 * Игрок НЕ удаляется из комнаты
                 * во время активной партии.
                 *
                 * Это позволяет обновить страницу
                 * и переподключиться.
                 */
            }
        );
    }
);


/* =========================================================
   START
========================================================= */

server.listen(
    PORT,
    () => {

        console.log(
            `[Heavy Lux Card] listening on ${PORT}`
        );
    }
);
