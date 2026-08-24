"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
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
  BUSINESSES,
  NORMAL_PLATES,
  BEAUTIFUL_NUMBERS,
  QUICK_PHRASES,
  rankForRating,
  getPlateById,
} = require("./data/catalog");

const PORT = Number(process.env.PORT) || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const START_HC = 20000;
const MAX_LEVEL = 100;
const XP_PER_LEVEL = 1000;
const MATCH_RAKE = 0.05;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 20000,
});
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const players = new Map();
const sockets = new Map();
const marketListings = new Map();
const auctions = new Map();
let db = null;

if (DATABASE_URL) {
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
    max: 5,
  });
  db.query(
    `CREATE TABLE IF NOT EXISTS heavy_lux_players (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`
  )
    .then(() => console.log("[DB] PostgreSQL ready"))
    .catch((err) => console.error("[DB] init failed:", err.message));
}

function safeName(v) {
  return typeof v === "string" ? v.trim().slice(0, 40) : "Игрок";
}
function idOf(v) {
  return String(v || "");
}
function uid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}
function money(v) {
  return Math.max(0, Math.floor(Number(v) || 0));
}
function levelForXp(xp) {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL));
}
function rankInfo(p) {
  return rankForRating(p.rating);
}
function initials(name) {
  return (
    safeName(name)
      .split(/\s+/)
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "HL"
  );
}

function newPlayer(id, tg = {}) {
  return {
    id: idOf(id),
    telegramId: idOf(tg.id || id),
    username: safeName(tg.username || ""),
    name: safeName(tg.first_name || tg.username || "Игрок"),
    avatar: tg.photo_url || "",
    level: 1,
    xp: 0,
    hc: START_HC,
    rating: 1000,
    wins: 0,
    losses: 0,
    draws: 0,
    garage: [],
    plates: [],
    properties: [],
    businesses: [],
    displayProperty: null,
    displayVehicle: null,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

function publicProfile(p) {
  if (!p) return null;
  const displayVehicle = p.displayVehicle
    ? p.garage.find((v) => v.id === p.displayVehicle) || null
    : null;
  const plate = displayVehicle?.plateId
    ? getPlateById(displayVehicle.plateId)
    : null;
  return {
    id: p.id,
    name: p.name,
    username: p.username,
    avatar: p.avatar,
    initials: initials(p.name),
    level: p.level,
    xp: p.xp,
    hc: p.hc,
    rating: p.rating,
    rank: rankInfo(p),
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    displayProperty:
      p.properties.find((x) => x.id === p.displayProperty) || null,
    displayVehicle: displayVehicle
      ? { ...displayVehicle, plate: plate?.plate || null }
      : null,
    garage: p.garage,
    plates: p.plates.map((id) => getPlateById(id)).filter(Boolean),
    properties: p.properties,
    businesses: p.businesses,
  };
}

async function loadPlayer(id, tg) {
  const key = idOf(id);
  if (players.has(key)) {
    const p = players.get(key);
    if (tg.username !== undefined) p.username = safeName(tg.username);
    if (tg.first_name !== undefined)
      p.name = safeName(tg.first_name || tg.username || p.name);
    if (tg.photo_url !== undefined) p.avatar = tg.photo_url || "";
    p.lastSeenAt = Date.now();
    return p;
  }
  let p = null;
  if (db) {
    try {
      const r = await db.query(
        "SELECT data FROM heavy_lux_players WHERE id=$1",
        [key]
      );
      if (r.rows[0]) p = r.rows[0].data;
    } catch (e) {
      console.error("[DB] load:", e.message);
    }
  }
  if (!p) p = newPlayer(key, tg);
  p.lastSeenAt = Date.now();
  players.set(key, p);
  await savePlayer(p);
  return p;
}

async function savePlayer(p) {
  if (!db || !p) return;
  try {
    await db.query(
      "INSERT INTO heavy_lux_players(id,data,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()",
      [p.id, JSON.stringify(p)]
    );
  } catch (e) {
    console.error("[DB] save:", e.message);
  }
}

function telegramCheck(initData) {
  if (!BOT_TOKEN) return { ok: true, dev: true, user: null };
  if (typeof initData !== "string" || !initData)
    return { ok: false, error: "Telegram initData отсутствует" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Telegram hash отсутствует" };
  params.delete("hash");
  const data = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash)))
    return { ok: false, error: "Неверная подпись Telegram" };
  let user = {};
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch {
    return { ok: false, error: "Некорректные данные Telegram" };
  }
  return { ok: true, user };
}

async function authenticate(socket) {
  const a = socket.handshake.auth || {};
  const checked = telegramCheck(a.initData || "");
  if (!checked.ok) throw new Error(checked.error);
  const tg = checked.user || {
    id: a.devId || `dev_${socket.id}`,
    username: a.username || "demo",
    first_name: a.name || "Игрок",
    photo_url: "",
  };
  const p = await loadPlayer(String(tg.id || a.devId || socket.id), tg);
  socket.data.playerId = p.id;
  sockets.set(p.id, socket.id);
  return p;
}

function socketFor(id) {
  const sid = sockets.get(id);
  return sid ? io.sockets.sockets.get(sid) || null : null;
}
function findRoom(playerId) {
  for (const room of rooms.values())
    if (room.playerIds.includes(playerId)) return room;
  return null;
}
function roomPublic(room) {
  return {
    id: room.id,
    roomId: room.id,
    stake: room.stake,
    maxPlayers: room.maxPlayers,
    status: room.status,
    hostId: room.hostId,
    playerIds: room.playerIds,
    players: room.playerIds
      .map((id) => publicProfile(players.get(id)))
      .filter(Boolean),
    mode: "Подкидной",
    deck: 36,
    createdAt: room.createdAt,
  };
}
function roomList() {
  return [...rooms.values()]
    .filter((r) => r.status === "LOBBY" && r.playerIds.length < r.maxPlayers)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(roomPublic);
}
function emitRoom(room) {
  for (const id of room.playerIds)
    socketFor(id)?.emit("room_state", roomPublic(room));
  io.emit("rooms", roomList());
}
function emitGame(room) {
  if (!room?.game) return;
  for (const id of room.playerIds)
    socketFor(id)?.emit("game_state", stateForPlayer(room.game, id));
}
function emitProfile(p) {
  socketFor(p.id)?.emit("profile", publicProfile(p));
}
function error(socket, message) {
  socket.emit("toast", { type: "error", message: String(message) });
}
function ok(socket, message) {
  socket.emit("toast", { type: "success", message: String(message) });
}

function spend(p, amount) {
  if (p.hc < amount) throw new Error("Недостаточно HC");
  p.hc -= amount;
}
function give(p, amount) {
  p.hc += money(amount);
}
function getVehicle(p, id) {
  return p.garage.find((v) => v.id === id) || null;
}
function hasPlate(p, plateId) {
  return p.plates.includes(plateId);
}
function plateTaken(plateId) {
  for (const p of players.values())
    if (
      p.plates.includes(plateId) ||
      p.garage.some((v) => v.plateId === plateId)
    )
      return true;
  for (const l of marketListings.values())
    if (l.assetType === "plate" && l.assetId === plateId) return true;
  return false;
}
function randomNormalPlate() {
  const available = NORMAL_PLATES.filter((x) => !plateTaken(x.id));
  if (!available.length)
    throw new Error("Свободные обычные номера временно закончились");
  return available[Math.floor(Math.random() * available.length)];
}
function reserveBeautiful(plateId) {
  const plate = getPlateById(plateId);
  if (!plate?.beautiful) throw new Error("Это не красивый номер");
  if (plateTaken(plateId)) throw new Error("Номер уже занят");
  return plate;
}
function requireRoom(socket) {
  const room = findRoom(socket.data.playerId);
  if (!room) throw new Error("Вы не находитесь в лобби");
  return room;
}
function requireGameRoom(socket) {
  const room = requireRoom(socket);
  if (!room.game) throw new Error("Партия ещё не началась");
  return room;
}

function createRoom(playerId, stake, maxPlayers) {
  if (!STAKES.includes(Number(stake))) throw new Error("Недопустимая ставка");
  if (![2, 3].includes(Number(maxPlayers)))
    throw new Error("Лобби может быть на 2 или 3 игроков");
  const p = players.get(playerId);
  if (!p) throw new Error("Игрок не найден");
  if (p.hc < stake) throw new Error("Недостаточно HC для этой ставки");
  const room = {
    id: crypto.randomBytes(3).toString("hex").toUpperCase(),
    stake: Number(stake),
    maxPlayers: Number(maxPlayers),
    status: "LOBBY",
    hostId: playerId,
    playerIds: [playerId],
    game: null,
    rewarded: false,
    createdAt: Date.now(),
    rematch: false,
  };
  rooms.set(room.id, room);
  return room;
}

function joinRoom(room, playerId) {
  if (!room || room.status !== "LOBBY") throw new Error("Лобби уже запущено");
  if (room.playerIds.includes(playerId)) return room;
  if (room.playerIds.length >= room.maxPlayers)
    throw new Error("В лобби нет свободных мест");
  if (players.get(playerId).hc < room.stake)
    throw new Error("Недостаточно HC для этой ставки");
  const old = findRoom(playerId);
  if (old) throw new Error("Сначала выйдите из текущего лобби");
  room.playerIds.push(playerId);
  return room;
}

function startRoom(room) {
  if (!room || room.status !== "LOBBY") throw new Error("Лобби уже запущено");
  if (room.playerIds.length !== room.maxPlayers)
    throw new Error(`Нужно ${room.maxPlayers} игрока(ов)`);
  for (const id of room.playerIds)
    if (players.get(id).hc < room.stake)
      throw new Error("У одного из игроков недостаточно HC");
  for (const id of room.playerIds) spend(players.get(id), room.stake);
  room.game = createGame({
    id: room.id,
    playerIds: [...room.playerIds],
    stake: room.stake,
  });
  dealInitial(room.game);
  room.status = "PLAYING";
  room.rewarded = false;
  emitProfileForRoom(room);
  emitRoom(room);
  emitGame(room);
}

function emitProfileForRoom(room) {
  for (const id of room.playerIds) emitProfile(players.get(id));
}

function finishRewards(room) {
  if (!room?.game || room.rewarded || room.game.status !== "FINISHED") return;
  room.rewarded = true;
  const game = room.game;
  const ids = room.playerIds;
  const pot = room.stake * ids.length;
  const rake = Math.floor(pot * MATCH_RAKE);
  const ordered = [...game.players].sort(
    (a, b) => (a.finishPosition ?? 999) - (b.finishPosition ?? 999)
  );
  const payouts = {};
  if (ids.length === 2) payouts[ordered[0].id] = pot - rake;
  else {
    payouts[ordered[0].id] = Math.floor(pot * 0.9);
    payouts[ordered[1].id] = Math.floor(pot * 0.05);
  }
  for (const id of ids) {
    const p = players.get(id);
    const win = game.winnerId === id;
    const place = ordered.findIndex((x) => x.id === id) + 1;
    const payout = payouts[id] || 0;
    give(p, payout);
    const xp = win ? 150 : place === 2 ? 80 : 50;
    p.xp += xp;
    p.level = levelForXp(p.xp);
    if (win) {
      p.wins++;
      p.rating += 25;
    } else {
      p.losses++;
      p.rating = Math.max(0, p.rating - (place === 2 ? 8 : 12));
    }
    emitProfile(p);
    savePlayer(p);
    socketFor(id)?.emit("match_result", {
      win,
      place,
      payout,
      xp,
      rating: p.rating,
      rank: rankInfo(p),
      winnerId: game.winnerId,
    });
  }
  room.status = "FINISHED";
  emitRoom(room);
  emitGame(room);
}

function resetForRematch(room) {
  if (!room || room.status !== "FINISHED") throw new Error("Реванш недоступен");
  for (const id of room.playerIds)
    if (players.get(id).hc < room.stake)
      throw new Error("Недостаточно HC для реванша");
  room.game = null;
  room.status = "LOBBY";
  room.rewarded = false;
  room.rematch = true;
  emitRoom(room);
}

function publicCatalog() {
  return {
    stakes: STAKES,
    vehicles: VEHICLES,
    exclusive: EXCLUSIVE,
    property: PROPERTY,
    propertyColors: PROPERTY_COLORS,
    businesses: BUSINESSES,
    beautifulNumbers: BEAUTIFUL_NUMBERS,
    quickPhrases: QUICK_PHRASES,
    rankTiers: rankForRating(1000),
  };
}

function publicMarket() {
  return {
    listings: [...marketListings.values()],
    auctions: [...auctions.values()].filter((a) => !a.ended),
  };
}

function assetForPlayer(p, assetType, assetId) {
  if (assetType === "vehicle") return getVehicle(p, assetId);
  if (assetType === "plate")
    return hasPlate(p, assetId) ? getPlateById(assetId) : null;
  if (assetType === "property")
    return p.properties.find((x) => x.id === assetId);
  if (assetType === "business")
    return p.businesses.find((x) => x.id === assetId);
  return null;
}

function removeAsset(p, type, id) {
  if (type === "vehicle") {
    const i = p.garage.findIndex((v) => v.id === id);
    if (i < 0) return false;
    p.garage.splice(i, 1);
    if (p.displayVehicle === id) p.displayVehicle = p.garage[0]?.id || null;
    return true;
  }
  if (type === "plate") {
    const i = p.plates.indexOf(id);
    if (i < 0) return false;
    p.plates.splice(i, 1);
    for (const v of p.garage) if (v.plateId === id) v.plateId = null;
    return true;
  }
  return false;
}

function buyVehicle(p, item) {
  spend(p, item.price);
  const plate = randomNormalPlate();
  p.plates.push(plate.id);
  const vehicle = {
    id: uid("car"),
    catalogId: item.id,
    brand: item.brand,
    model: item.model,
    price: item.price,
    tuning: item.tuning || null,
    plateId: plate.id,
    purchasedAt: Date.now(),
  };
  p.garage.push(vehicle);
  if (!p.displayVehicle) p.displayVehicle = vehicle.id;
  return { vehicle, plate };
}

function buyProperty(p, item) {
  const owned = p.properties.some((x) => x.id === item.id);
  if (owned) throw new Error("Эта недвижимость уже есть");
  spend(p, item.price);
  const property = { ...item, acquiredAt: Date.now() };
  p.properties.push(property);
  if (!p.displayProperty) p.displayProperty = property.id;
  return property;
}
function buyBusiness(p, item) {
  const count = p.businesses.filter((x) => x.id === item.id).length;
  if (count >= item.maxOwned)
    throw new Error("Достигнут лимит владения этим бизнесом");
  spend(p, item.price);
  const b = { ...item, ownershipId: uid("biz"), acquiredAt: Date.now() };
  p.businesses.push(b);
  return b;
}
function buyBeautifulPlate(p, id) {
  const plate = reserveBeautiful(id);
  spend(p, plate.price);
  p.plates.push(plate.id);
  return plate;
}

io.use((socket, next) => {
  authenticate(socket)
    .then(() => next())
    .catch((err) => next(new Error(err.message)));
});

io.on("connection", (socket) => {
  const playerId = socket.data.playerId;
  const p = players.get(playerId);
  emitProfile(p);
  socket.emit("catalog", publicCatalog());
  socket.emit("rooms", roomList());
  socket.emit("market", publicMarket());
  const existing = findRoom(playerId);
  if (existing) {
    socket.emit("room_state", roomPublic(existing));
    if (existing.game)
      socket.emit("game_state", stateForPlayer(existing.game, playerId));
  }

  socket.on("refresh", () => {
    socket.emit("profile", publicProfile(players.get(playerId)));
    socket.emit("rooms", roomList());
    socket.emit("market", publicMarket());
  });
  socket.on("create_room", ({ stake, maxPlayers }, cb = () => {}) => {
    try {
      const old = findRoom(playerId);
      if (old) throw new Error("Сначала выйдите из текущего лобби");
      const room = createRoom(playerId, Number(stake), Number(maxPlayers));
      emitRoom(room);
      cb({ ok: true, room: roomPublic(room) });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("join_room", ({ roomId }, cb = () => {}) => {
    try {
      const old = findRoom(playerId);
      if (old && old.id !== roomId)
        throw new Error("Сначала выйдите из текущего лобби");
      const room = joinRoom(rooms.get(String(roomId).toUpperCase()), playerId);
      emitRoom(room);
      cb({ ok: true, room: roomPublic(room) });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("quick_match", ({ maxPlayers = 2 } = {}, cb = () => {}) => {
    try {
      const old = findRoom(playerId);
      if (old) throw new Error("Сначала выйдите из текущего лобби");
      const p = players.get(playerId);
      const candidates = roomList().filter(
        (r) =>
          r.playerIds[0] !== playerId &&
          r.stake <= p.hc &&
          (Number(maxPlayers) === 3 ? r.maxPlayers === 3 : true)
      );
      const room = candidates[0]
        ? joinRoom(rooms.get(candidates[0].id), playerId)
        : createRoom(
            playerId,
            STAKES.filter((s) => s <= p.hc).slice(-1)[0] || 100,
            Number(maxPlayers) === 3 ? 3 : 2
          );
      emitRoom(room);
      if (room.playerIds.length === room.maxPlayers) startRoom(room);
      cb({ ok: true, room: roomPublic(room) });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("start_room", (cb = () => {}) => {
    try {
      const room = requireRoom(socket);
      if (room.hostId !== playerId)
        throw new Error("Начать игру может создатель лобби");
      startRoom(room);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("leave_room", (cb = () => {}) => {
    try {
      const room = findRoom(playerId);
      if (!room) return cb({ ok: true });
      if (room.status === "PLAYING")
        throw new Error("Нельзя выйти во время партии");
      room.playerIds = room.playerIds.filter((id) => id !== playerId);
      if (room.hostId === playerId) room.hostId = room.playerIds[0] || null;
      if (!room.playerIds.length) rooms.delete(room.id);
      else emitRoom(room);
      io.emit("rooms", roomList());
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("attack", ({ cardId }, cb = () => {}) => {
    try {
      const room = requireGameRoom(socket);
      room.game = playAttack(room.game, playerId, cardId);
      if (room.game.status === "FINISHED") finishRewards(room);
      emitGame(room);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("defend", ({ cardId }, cb = () => {}) => {
    try {
      const room = requireGameRoom(socket);
      room.game = defend(room.game, playerId, cardId);
      if (room.game.status === "FINISHED") finishRewards(room);
      emitGame(room);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("take", (cb = () => {}) => {
    try {
      const room = requireGameRoom(socket);
      room.game = take(room.game, playerId);
      if (room.game.status === "FINISHED") finishRewards(room);
      emitGame(room);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("end_attack", (cb = () => {}) => {
    try {
      const room = requireGameRoom(socket);
      room.game = endAttack(room.game, playerId);
      if (room.game.status === "FINISHED") finishRewards(room);
      emitGame(room);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("rematch", (cb = () => {}) => {
    try {
      const room = requireRoom(socket);
      if (!room.playerIds.includes(playerId)) throw new Error("Нет доступа");
      room.rematchVotes = room.rematchVotes || new Set();
      room.rematchVotes.add(playerId);
      if (room.rematchVotes.size === room.playerIds.length) {
        room.rematchVotes.clear();
        resetForRematch(room);
      } else {
        ok(socket, "Ждём соперников на реванш");
      }
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("phrase", ({ phrase }) => {
    if (!QUICK_PHRASES.includes(phrase)) return;
    const room = findRoom(playerId);
    if (!room || room.status !== "PLAYING") return;
    for (const id of room.playerIds)
      socketFor(id)?.emit("phrase", { playerId, phrase });
  });
  socket.on("profile_get", ({ playerId: targetId } = {}) => {
    const target = players.get(idOf(targetId));
    if (target) socket.emit("player_preview", publicProfile(target));
  });
  socket.on("set_display", async ({ vehicleId, propertyId }, cb = () => {}) => {
    try {
      const p = players.get(playerId);
      if (vehicleId !== undefined) {
        if (vehicleId !== null && !getVehicle(p, vehicleId))
          throw new Error("Автомобиль не найден");
        p.displayVehicle = vehicleId;
      }
      if (propertyId !== undefined) {
        if (
          propertyId !== null &&
          !p.properties.some((x) => x.id === propertyId)
        )
          throw new Error("Недвижимость не найдена");
        p.displayProperty = propertyId;
      }
      await savePlayer(p);
      emitProfile(p);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on(
    "buy_vehicle",
    async ({ catalogId, exclusive = false }, cb = () => {}) => {
      try {
        const p = players.get(playerId);
        const list = exclusive ? EXCLUSIVE : VEHICLES;
        const item = list.find((x) => x.id === catalogId);
        if (!item) throw new Error("Автомобиль не найден");
        const result = buyVehicle(p, item);
        await savePlayer(p);
        emitProfile(p);
        cb({ ok: true, result });
      } catch (e) {
        error(socket, e.message);
        cb({ ok: false, error: e.message });
      }
    }
  );
  socket.on("buy_property", async ({ catalogId }, cb = () => {}) => {
    try {
      const p = players.get(playerId);
      const item = PROPERTY.find((x) => x.id === catalogId);
      if (!item) throw new Error("Недвижимость не найдена");
      const result = buyProperty(p, item);
      await savePlayer(p);
      emitProfile(p);
      cb({ ok: true, result });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("buy_business", async ({ catalogId }, cb = () => {}) => {
    try {
      const p = players.get(playerId);
      const item = BUSINESSES.find((x) => x.id === catalogId);
      if (!item) throw new Error("Бизнес не найден");
      const result = buyBusiness(p, item);
      await savePlayer(p);
      emitProfile(p);
      cb({ ok: true, result });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("buy_plate", async ({ plateId }, cb = () => {}) => {
    try {
      const p = players.get(playerId);
      const result = buyBeautifulPlate(p, plateId);
      await savePlayer(p);
      emitProfile(p);
      cb({ ok: true, result });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("install_plate", async ({ vehicleId, plateId }, cb = () => {}) => {
    try {
      const p = players.get(playerId);
      const v = getVehicle(p, vehicleId);
      if (!v) throw new Error("Автомобиль не найден");
      if (!hasPlate(p, plateId)) throw new Error("Номер не принадлежит вам");
      for (const other of p.garage)
        if (other.plateId === plateId) other.plateId = null;
      v.plateId = plateId;
      await savePlayer(p);
      emitProfile(p);
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on(
    "market_list",
    async ({ assetType, assetId, price }, cb = () => {}) => {
      try {
        const p = players.get(playerId);
        const asset = assetForPlayer(p, assetType, assetId);
        if (!asset) throw new Error("Предмет не найден");
        if (assetType !== "vehicle" && assetType !== "plate")
          throw new Error("На вторичном рынке сейчас доступны авто и номера");
        const salePrice = money(price);
        if (salePrice <= 0) throw new Error("Укажите цену");
        if (
          [...marketListings.values()].some(
            (x) => x.assetType === assetType && x.assetId === assetId
          )
        )
          throw new Error("Предмет уже выставлен");
        const snapshot =
          assetType === "vehicle" ? JSON.parse(JSON.stringify(asset)) : null;
        if (snapshot?.plateId) {
          p.plates = p.plates.filter((id) => id !== snapshot.plateId);
        }
        removeAsset(p, assetType, assetId);
        const listing = {
          id: uid("listing"),
          sellerId: playerId,
          sellerName: p.name,
          assetType,
          assetId,
          vehicleSnapshot: snapshot,
          price: salePrice,
          createdAt: Date.now(),
        };
        marketListings.set(listing.id, listing);
        await savePlayer(p);
        emitProfile(p);
        io.emit("market", publicMarket());
        cb({ ok: true, listing });
      } catch (e) {
        error(socket, e.message);
        cb({ ok: false, error: e.message });
      }
    }
  );
  socket.on("market_buy", async ({ listingId }, cb = () => {}) => {
    try {
      const l = marketListings.get(listingId);
      if (!l) throw new Error("Объявление не найдено");
      const buyer = players.get(playerId);
      if (l.sellerId === playerId)
        throw new Error("Нельзя купить свой предмет");
      spend(buyer, l.price);
      const seller = players.get(l.sellerId);
      give(seller, l.price);
      if (l.assetType === "plate") buyer.plates.push(l.assetId);
      else if (l.assetType === "vehicle") {
        const v = l.vehicleSnapshot || {
          id: uid("car"),
          catalogId: "market",
          brand: "Market",
          model: "Автомобиль",
          price: l.price,
          plateId: null,
        };
        if (v.plateId) buyer.plates.push(v.plateId);
        buyer.garage.push(v);
      }
      marketListings.delete(listingId);
      await savePlayer(buyer);
      await savePlayer(seller);
      emitProfile(buyer);
      emitProfile(seller);
      io.emit("market", publicMarket());
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on(
    "auction_create",
    async (
      { assetType, assetId, startPrice, duration = 300 },
      cb = () => {}
    ) => {
      try {
        const p = players.get(playerId);
        if (!assetForPlayer(p, assetType, assetId))
          throw new Error("Предмет не найден");
        if (assetType !== "vehicle" && assetType !== "plate")
          throw new Error("На аукционе доступны авто и номера");
        const snapshot =
          assetType === "vehicle"
            ? JSON.parse(JSON.stringify(assetForPlayer(p, assetType, assetId)))
            : null;
        if (snapshot?.plateId)
          p.plates = p.plates.filter((id) => id !== snapshot.plateId);
        removeAsset(p, assetType, assetId);
        const a = {
          id: uid("auction"),
          sellerId: playerId,
          sellerName: p.name,
          assetType,
          assetId,
          vehicleSnapshot: snapshot,
          startPrice: money(startPrice),
          highestBid: 0,
          highestBidderId: null,
          endsAt: Date.now() + Math.max(60, Number(duration)) * 1000,
          ended: false,
        };
        auctions.set(a.id, a);
        await savePlayer(p);
        emitProfile(p);
        io.emit("market", publicMarket());
        cb({ ok: true, auction: a });
      } catch (e) {
        error(socket, e.message);
        cb({ ok: false, error: e.message });
      }
    }
  );
  socket.on("auction_bid", async ({ auctionId, bid }, cb = () => {}) => {
    try {
      const a = auctions.get(auctionId);
      if (!a || a.ended || Date.now() > a.endsAt)
        throw new Error("Аукцион завершён");
      const p = players.get(playerId);
      const amount = money(bid);
      if (amount <= Math.max(a.startPrice, a.highestBid))
        throw new Error("Ставка должна быть выше текущей");
      spend(p, amount);
      if (a.highestBidderId) {
        give(players.get(a.highestBidderId), a.highestBid);
      }
      a.highestBid = amount;
      a.highestBidderId = playerId;
      await savePlayer(p);
      io.emit("market", publicMarket());
      cb({ ok: true });
    } catch (e) {
      error(socket, e.message);
      cb({ ok: false, error: e.message });
    }
  });
  socket.on("disconnect", () => {
    if (sockets.get(playerId) === socket.id) sockets.delete(playerId);
    const room = findRoom(playerId);
    if (room?.status === "LOBBY") emitRoom(room);
  });
});

setInterval(() => {
  for (const a of auctions.values())
    if (!a.ended && Date.now() >= a.endsAt) {
      a.ended = true;
      const winner = players.get(a.highestBidderId);
      const seller = players.get(a.sellerId);
      if (winner) {
        if (a.assetType === "plate") winner.plates.push(a.assetId);
        else {
          const v = a.vehicleSnapshot || {
            id: uid("car"),
            catalogId: "auction",
            brand: "Auction",
            model: "Автомобиль",
            price: a.highestBid,
            plateId: null,
          };
          if (v.plateId) winner.plates.push(v.plateId);
          winner.garage.push(v);
        }
        savePlayer(winner);
        emitProfile(winner);
      } else if (seller) {
        if (a.assetType === "plate") seller.plates.push(a.assetId);
        else {
          if (a.vehicleSnapshot?.plateId)
            seller.plates.push(a.vehicleSnapshot.plateId);
          seller.garage.push(
            a.vehicleSnapshot || {
              id: uid("car"),
              catalogId: "auction",
              brand: "Auction",
              model: "Автомобиль",
              price: a.startPrice,
              plateId: null,
            }
          );
        }
        savePlayer(seller);
        emitProfile(seller);
      }
      io.emit("market", publicMarket());
    }
}, 5000);

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    service: "Heavy Lux Card",
    database: !!db,
    rooms: rooms.size,
    players: players.size,
    time: new Date().toISOString(),
  })
);
app.get("/api/catalog", (req, res) => res.json(publicCatalog()));
app.get("/api/rooms", (req, res) => res.json(roomList()));
app.get("/api/market", (req, res) => res.json(publicMarket()));
app.post("/api/auth/telegram", async (req, res) => {
  const checked = telegramCheck(req.body?.initData || "");
  if (!checked.ok) return res.status(401).json(checked);
  const tg = checked.user || {
    id: req.body?.devId || "demo",
    first_name: "Игрок",
  };
  const p = await loadPlayer(String(tg.id), tg);
  res.json({ ok: true, profile: publicProfile(p) });
});
app.get(/.*/, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

server.listen(PORT, () =>
  console.log(
    `[Heavy Lux Card] listening on ${PORT} | telegram=${!!BOT_TOKEN} | postgres=${!!db}`
  )
);

process.on("SIGTERM", async () => {
  try {
    for (const p of players.values()) await savePlayer(p);
    if (db) await db.end();
  } finally {
    process.exit(0);
  }
});
process.on("SIGINT", async () => {
  try {
    for (const p of players.values()) await savePlayer(p);
    if (db) await db.end();
  } finally {
    process.exit(0);
  }
});
