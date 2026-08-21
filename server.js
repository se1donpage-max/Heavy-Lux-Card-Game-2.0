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
  stateForPlayer,
} = require("./game/engine");

const {
  VEHICLES,
  EXCLUSIVE,
  PROPERTY,
  PROPERTY_COLORS,
  BEAUTIFUL_NUMBERS,
  QUICK_PHRASES,
} = require("./data/catalog");


/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT) || 10000;

const BOT_TOKEN =
  process.env.BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  "";

/*
=========================================================
DEV MODE

Для Render добавь Environment Variable:

DEV_MODE=true

В production, если DEV_MODE не включён,
фальшивые devId НЕ принимаются.

Это позволяет:
- Telegram → настоящий пользователь
- Chrome → DEV_PLAYER_1
- Safari → DEV_PLAYER_2

при включённом DEV_MODE.
=========================================================
*/

const DEV_MODE =
  String(process.env.DEV_MODE || "").toLowerCase() === "true";


/* =========================================================
   APP
========================================================= */

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },

  transports: [
    "websocket",
    "polling",
  ],
});

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================================================
   MEMORY
========================================================= */

const rooms = new Map();
const players = new Map();
const sockets = new Map();


/* =========================================================
   VALIDATION
========================================================= */

const ALLOWED_RANKS = [
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

const VALID_PLATE_RE =
  /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2}$/i;


/* =========================================================
   HELPERS
========================================================= */

function safeName(value) {
  return typeof value === "string"
    ? value.trim().slice(0, 40)
    : "Игрок";
}


/* =========================================================
   PLAYER
========================================================= */

function profile(id, tg = {}) {
  if (players.has(id)) {
    return players.get(id);
  }

  const p = {
    id,

    telegramId:
      String(tg.id || id),

    username:
      safeName(tg.username || ""),

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

    displayVehicle: null,
  };

  players.set(id, p);

  return p;
}


/* =========================================================
   PUBLIC PROFILE
========================================================= */

function publicProfile(p) {
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
      p.businesses,
  };
}


/* =========================================================
   TELEGRAM SIGNATURE CHECK
========================================================= */

function signCheck(initData) {

  /*
  ---------------------------------------------------------
  DEV MODE

  Если Telegram initData отсутствует,
  разрешаем тестового игрока ТОЛЬКО если:

  DEV_MODE=true
  ---------------------------------------------------------
  */

  if (
    DEV_MODE &&
    (
      typeof initData !== "string" ||
      !initData
    )
  ) {
    return {
      ok: true,

      dev: true,

      user: null,
    };
  }


  /*
  ---------------------------------------------------------
  Без BOT_TOKEN нельзя нормально проверить Telegram.
  В DEV_MODE это допустимо для тестовой среды.
  ---------------------------------------------------------
  */

  if (!BOT_TOKEN) {

    if (DEV_MODE) {
      return {
        ok: true,

        dev: true,

        user: null,
      };
    }

    return {
      ok: false,

      error:
        "Telegram авторизация не настроена",
    };
  }


  /*
  ---------------------------------------------------------
  REAL TELEGRAM
  ---------------------------------------------------------
  */

  if (
    typeof initData !== "string" ||
    !initData
  ) {
    return {
      ok: false,

      error:
        "Telegram initData отсутствует",
    };
  }


  const params =
    new URLSearchParams(initData);


  const hash =
    params.get("hash");


  if (!hash) {
    return {
      ok: false,

      error:
        "Telegram hash отсутствует",
    };
  }


  params.delete("hash");


  const data = [
    ...params.entries(),
  ]
    .sort(
      ([a], [b]) =>
        a.localeCompare(b)
    )
    .map(
      ([k, v]) =>
        `${k}=${v}`
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


  /*
  ---------------------------------------------------------
  Timing-safe comparison
  ---------------------------------------------------------
  */

  let valid = false;

  try {

    const a =
      Buffer.from(expected, "hex");

    const b =
      Buffer.from(hash, "hex");

    if (a.length === b.length) {
      valid =
        crypto.timingSafeEqual(
          a,
          b
        );
    }

  } catch {
    valid = false;
  }


  if (!valid) {
    return {
      ok: false,

      error:
        "Неверная подпись Telegram",
    };
  }


  let user = {};

  try {

    user =
      JSON.parse(
        params.get("user") || "{}"
      );

  } catch {

    return {
      ok: false,

      error:
        "Некорректные данные Telegram",
    };
  }


  return {
    ok: true,

    dev: false,

    user,
  };
}


/* =========================================================
   SOCKET AUTH
========================================================= */

function authSocket(socket) {

  const auth =
    socket.handshake.auth || {};


  const initData =
    auth.initData || "";


  /*
  ---------------------------------------------------------
  REAL TELEGRAM
  ---------------------------------------------------------
  */

  if (initData) {

    const result =
      signCheck(initData);


    if (!result.ok) {
      throw new Error(
        result.error
      );
    }


    const tg =
      result.user || {};


    const id =
      String(
        tg.id ||
        `tg_${socket.id}`
      );


    const p =
      profile(id, tg);


    socket.data.playerId =
      id;

    socket.data.authType =
      "telegram";


    sockets.set(
      id,
      socket.id
    );


    return p;
  }


  /*
  ---------------------------------------------------------
  DEV PLAYER
  ---------------------------------------------------------

  DEV_PLAYER_1
  DEV_PLAYER_2

  разрешены ТОЛЬКО при DEV_MODE=true
  ---------------------------------------------------------
  */

  if (DEV_MODE) {

    const devId =
      String(
        auth.devId || ""
      ).trim();


    const allowedDevPlayers = [
      "DEV_PLAYER_1",
      "DEV_PLAYER_2",
      "DEV_PLAYER_3",
    ];


    if (
      !allowedDevPlayers.includes(
        devId
      )
    ) {
      throw new Error(
        "Укажите DEV_PLAYER_1, DEV_PLAYER_2 или DEV_PLAYER_3"
      );
    }


    const names = {
      DEV_PLAYER_1:
        "Игрок 1",

      DEV_PLAYER_2:
        "Игрок 2",

      DEV_PLAYER_3:
        "Игрок 3",
    };


    const usernames = {
      DEV_PLAYER_1:
        "dev_player_1",

      DEV_PLAYER_2:
        "dev_player_2",

      DEV_PLAYER_3:
        "dev_player_3",
    };


    const tg = {
      id: devId,

      username:
        usernames[devId],

      first_name:
        names[devId],

      photo_url: "",
    };


    const p =
      profile(
        devId,
        tg
      );


    socket.data.playerId =
      devId;

    socket.data.authType =
      "dev";


    sockets.set(
      devId,
      socket.id
    );


    return p;
  }


  /*
  ---------------------------------------------------------
  NO AUTH
  ---------------------------------------------------------
  */

  throw new Error(
    "Telegram initData отсутствует"
  );
}


/* =========================================================
   ROOM STATE
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
      room.playerIds.map(
        (id) =>
          publicProfile(
            players.get(id)
          )
      ),
  };
}


/* =========================================================
   FIND ROOM
========================================================= */

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


/* =========================================================
   EMIT ROOM
========================================================= */

function emitRoom(room) {

  for (
    const id of room.playerIds
  ) {

    const socketId =
      sockets.get(id);


    const socket =
      io.sockets.sockets.get(
        socketId
      );


    if (socket) {

      socket.emit(
        "room_state",
        roomState(room)
      );
    }
  }
}


/* =========================================================
   EMIT GAME
========================================================= */

function emitGame(room) {

  if (!room.game) {
    return;
  }


  for (
    const id of room.playerIds
  ) {

    const socketId =
      sockets.get(id);


    const socket =
      io.sockets.sockets.get(
        socketId
      );


    if (socket) {

      socket.emit(
        "game_state",

        stateForPlayer(
          room.game,
          id
        )
      );
    }
  }
}


/* =========================================================
   REWARDS
========================================================= */

function finishRewards(room) {

  if (
    !room.game ||
    room.rewarded
  ) {
    return;
  }


  room.rewarded = true;


  const g =
    room.game;


  for (
    const id of room.playerIds
  ) {

    const p =
      players.get(id);


    const win =
      g.winnerId === id;


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
  }
}


/* =========================================================
   START ROOM
========================================================= */

function startRoom(room) {

  if (
    room.playerIds.length < 2
  ) {
    throw new Error(
      "Нужно минимум 2 игрока"
    );
  }


  if (
    room.playerIds.some(
      (id) =>
        players.get(id).hc <
        room.stake
    )
  ) {

    throw new Error(
      "У игрока недостаточно HC"
    );
  }


  /*
  ---------------------------------------------------------
  RESERVE STAKES
  ---------------------------------------------------------
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
        room.stake,
    });


  dealInitial(
    room.game
  );


  room.status =
    "PLAYING";


  emitRoom(room);

  emitGame(room);
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
      message,
    }
  );
}


/* =========================================================
   HEALTH
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
        players.size,

      devMode:
        DEV_MODE,

      telegram:
        Boolean(BOT_TOKEN),
    });
  }
);


/* =========================================================
   CATALOG
========================================================= */

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
        QUICK_PHRASES,
    });
  }
);


/* =========================================================
   TELEGRAM AUTH API
========================================================= */

app.post(
  "/api/auth/telegram",
  (req, res) => {

    const result =
      signCheck(
        req.body?.initData || ""
      );


    if (!result.ok) {

      /*
      -------------------------------------------------------
      DEV AUTH
      -------------------------------------------------------
      */

      if (
        DEV_MODE &&
        req.body?.devId
      ) {

        const allowed = [
          "DEV_PLAYER_1",
          "DEV_PLAYER_2",
          "DEV_PLAYER_3",
        ];


        if (
          allowed.includes(
            req.body.devId
          )
        ) {

          const names = {
            DEV_PLAYER_1:
              "Игрок 1",

            DEV_PLAYER_2:
              "Игрок 2",

            DEV_PLAYER_3:
              "Игрок 3",
          };


          const usernames = {
            DEV_PLAYER_1:
              "dev_player_1",

            DEV_PLAYER_2:
              "dev_player_2",

            DEV_PLAYER_3:
              "dev_player_3",
          };


          const p =
            profile(
              req.body.devId,
              {
                id:
                  req.body.devId,

                username:
                  usernames[
                    req.body.devId
                  ],

                first_name:
                  names[
                    req.body.devId
                  ],
              }
            );


          return res.json({
            ok: true,

            profile:
              publicProfile(p),

            telegramValidated:
              false,

            dev: true,
          });
        }
      }


      return res
        .status(401)
        .json(result);
    }


    /*
    ---------------------------------------------------------
    REAL TELEGRAM RESPONSE
    ---------------------------------------------------------
    */

    const tg =
      result.user || {

        id:
          req.body?.devId ||
          "demo",

        first_name:
          "Игрок",
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
        Boolean(BOT_TOKEN),

      dev:
        false,
    });
  }
);


/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
  "connection",
  (socket) => {

    try {

      const p =
        authSocket(socket);


      /*
      -------------------------------------------------------
      BOOTSTRAP
      -------------------------------------------------------
      */

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
              QUICK_PHRASES,
          },

          devMode:
            DEV_MODE,

          authType:
            socket.data.authType,
        }
      );


      /*
      -------------------------------------------------------
      RECONNECT TO EXISTING ROOM
      -------------------------------------------------------
      */

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

    } catch (e) {

      socket.emit(
        "auth_error",
        {
          message:
            e.message,
        }
      );


      socket.disconnect(
        true
      );


      return;
    }


    /* =====================================================
       CREATE ROOM
    ====================================================== */

    socket.on(
      "create_room",
      ({
        stake,
        maxPlayers = 2,
      } = {}) => {

        try {

          const id =
            socket.data.playerId;


          if (findRoom(id)) {

            throw new Error(
              "Вы уже находитесь в лобби"
            );
          }


          if (
            !STAKES.includes(
              Number(stake)
            )
          ) {

            throw new Error(
              "Недопустимая ставка"
            );
          }


          if (
            ![2, 3].includes(
              Number(maxPlayers)
            )
          ) {

            throw new Error(
              "Количество игроков: 2 или 3"
            );
          }


          const room = {

            id:
              crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase(),

            stake:
              Number(stake),

            maxPlayers:
              Number(maxPlayers),

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
          };


          rooms.set(
            room.id,
            room
          );


          socket.join(
            room.id
          );


          emitRoom(
            room
          );

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       LIST ROOMS
    ====================================================== */

    socket.on(
      "list_rooms",
      () => {

        socket.emit(
          "rooms_list",

          [...rooms.values()]

            .filter(
              (r) =>
                r.status === "LOBBY" &&
                r.playerIds.length <
                  r.maxPlayers
            )

            .map(roomState)
        );
      }
    );


    /* =====================================================
       JOIN ROOM
    ====================================================== */

    socket.on(
      "join_room",
      ({
        roomId,
      } = {}) => {

        try {

          const id =
            socket.data.playerId;


          const room =
            rooms.get(
              String(
                roomId || ""
              ).toUpperCase()
            );


          if (!room) {

            throw new Error(
              "Лобби не найдено"
            );
          }


          if (
            room.status !== "LOBBY"
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


          emitRoom(
            room
          );

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       START ROOM
    ====================================================== */

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


          startRoom(
            room
          );

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       LEAVE ROOM
    ====================================================== */

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
              (x) => x !== id
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

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       QUICK MATCH
    ====================================================== */

    socket.on(
      "quick_match",
      () => {

        try {

          const id =
            socket.data.playerId;


          if (findRoom(id)) {

            throw new Error(
              "Вы уже в лобби"
            );
          }


          const p =
            players.get(id);


          const candidate =
            [...rooms.values()]
              .find(
                (r) =>
                  r.status ===
                    "LOBBY" &&

                  r.playerIds.length <
                    r.maxPlayers &&

                  p.hc >=
                    r.stake
              );


          if (!candidate) {

            socket.emit(
              "quick_match_wait"
            );

            return;
          }


          candidate.playerIds.push(
            id
          );


          socket.join(
            candidate.id
          );


          emitRoom(
            candidate
          );


          if (
            candidate.playerIds.length ===
            candidate.maxPlayers
          ) {

            startRoom(
              candidate
            );
          }

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       ATTACK
    ====================================================== */

    socket.on(
      "play_attack",
      ({
        cardId,
      } = {}) => {

        try {

          const room =
            findRoom(
              socket.data.playerId
            );


          if (!room?.game) {

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

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       DEFEND
    ====================================================== */

    socket.on(
      "defend",
      ({
        cardId,
      } = {}) => {

        try {

          const room =
            findRoom(
              socket.data.playerId
            );


          if (!room?.game) {

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

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       TAKE CARDS
    ====================================================== */

    socket.on(
      "take_cards",
      () => {

        try {

          const room =
            findRoom(
              socket.data.playerId
            );


          if (!room?.game) {

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

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       END ATTACK
    ====================================================== */

    socket.on(
      "end_attack",
      () => {

        try {

          const room =
            findRoom(
              socket.data.playerId
            );


          if (!room?.game) {

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

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       QUICK MESSAGE
    ====================================================== */

    socket.on(
      "quick_message",
      ({
        text,
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


          io.to(
            room.id
          ).emit(
            "quick_message",
            {
              from:
                socket.data.playerId,

              text,
            }
          );

        } catch (e) {

          sendError(
            socket,
            e.message
          );
        }
      }
    );


    /* =====================================================
       PROFILE UPDATE
    ====================================================== */

    socket.on(
      "profile_update",
      ({
        displayProperty = null,
        displayVehicle = null,
      } = {}) => {

        const p =
          players.get(
            socket.data.playerId
          );


        if (
          displayProperty !== null &&
          p.properties.includes(
            displayProperty
          )
        ) {

          p.displayProperty =
            displayProperty;
        }


        if (
          displayVehicle !== null &&
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


    /* =====================================================
       BUY VEHICLE
    ====================================================== */

    socket.on(
      "buy_vehicle",
      ({
        id,
        exclusive = false,
      } = {}) => {

        const p =
          players.get(
            socket.data.playerId
          );


        const item =
          (
            exclusive
              ? EXCLUSIVE
              : VEHICLES
          ).find(
            (x) => x.id === id
          );


        if (!item) {

          return sendError(
            socket,
            "Автомобиль не найден"
          );
        }


        if (
          p.hc < item.price
        ) {

          return sendError(
            socket,
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
            (n) =>
              !p.plates.includes(
                n.id
              )
          ) || {

            id:
              `random_${Date.now()}`,

            plate:
              `А${String(
                Math.floor(
                  Math.random() * 900
                ) + 100
              )}ВС77`,

            price:
              1000,
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
      }
    );


    /* =====================================================
       DISCONNECT
    ====================================================== */

    socket.on(
      "disconnect",
      () => {

        /*
        -----------------------------------------------------
        Игрок НЕ удаляется из rooms/players.
        Это позволяет восстановить соединение.
        -----------------------------------------------------
        */

      }
    );
  }
);


/* =========================================================
   START SERVER
========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      `[Heavy Lux Card] listening on ${PORT}`
    );

    console.log(
      `[Heavy Lux Card] DEV_MODE=${DEV_MODE}`
    );

    console.log(
      `[Heavy Lux Card] TELEGRAM=${Boolean(BOT_TOKEN)}`
    );
  }
);
