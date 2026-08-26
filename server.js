"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const {
  STAKES, createGame, dealInitial, playAttack, defend, take, endAttack, stateForPlayer
} = require("./game/engine");
const {
  VEHICLES, EXCLUSIVE, PROPERTY, PROPERTY_COLORS, BUSINESSES, NORMAL_PLATES, BEAUTIFUL_NUMBERS,
  QUICK_PHRASES, RANKS, RATING_MAX, rankForRating, getPlateById
} = require("./data/catalog");

const PORT = Number(process.env.PORT) || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const START_HC = 20000;
const MAX_LEVEL = 1000;
const MATCH_RAKE = 0.05;
const ADMIN_TELEGRAM_ID = idOf(process.env.ADMIN_TELEGRAM_ID || "7990813827");

const FACTIONS = Object.freeze({
  bandits: {
    id: "bandits", name: "Бандиты",
    ranks: ["Фраер","Жулик","Хулиган","Бандит","Рецидивист","Смотрящий","Блатной","Вор в законе"],
    tasks: [
      { min: 0, max: 1, name: "Провернуть темную тему с напарником", reward: 3000, cooldown: 15 * 60 * 1000 },
      { min: 2, max: 3, name: "Совершить угон Т/С на продажу", reward: 10000, cooldown: 30 * 60 * 1000 },
      { min: 4, max: 5, name: "Собрать доход с крышуемых точек", reward: 25000, cooldown: 45 * 60 * 1000 },
      { min: 6, max: 7, name: "Организовать трансфер нелегальной продукции за рубеж", reward: 50000, cooldown: 60 * 60 * 1000 }
    ]
  },
  police: {
    id: "police", name: "МВД",
    ranks: ["Рядовой","Сержант","Прапорщик","Лейтенант","Капитан","Майор","Подполковник","Полковник"],
    tasks: [
      { min: 0, max: 1, name: "Патруль закрепленных территорий", reward: 3000, cooldown: 15 * 60 * 1000 },
      { min: 2, max: 3, name: "Проведение розыскных мероприятий", reward: 10000, cooldown: 30 * 60 * 1000 },
      { min: 4, max: 5, name: "Обеспечение мер по задержанию преступной группы лиц", reward: 25000, cooldown: 45 * 60 * 1000 },
      { min: 6, max: 7, name: "Проведение мероприятий противодействия обороту запретных веществ", reward: 50000, cooldown: 60 * 60 * 1000 }
    ]
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, transports: ["websocket","polling"], pingInterval: 10000, pingTimeout: 20000 });
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map(), players = new Map(), sockets = new Map();
const marketListings = new Map(), auctions = new Map();
const factionMessages = { police: [], bandits: [] };
let db = null;

if (DATABASE_URL) {
  db = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, max: 5 });
  db.query(`CREATE TABLE IF NOT EXISTS heavy_lux_players (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`)
    .then(async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS heavy_lux_faction_chat (
        id BIGSERIAL PRIMARY KEY, faction TEXT NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL,
        message TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
      console.log("[DB] PostgreSQL ready");
    }).catch(err => console.error("[DB] init failed:", err.message));
}

function idOf(v) { return String(v ?? ""); }
function safeName(v) { return typeof v === "string" ? v.trim().slice(0, 40) : "Игрок"; }
function uid(prefix="id") { return `${prefix}_${crypto.randomBytes(5).toString("hex")}`; }
function money(v) { return Math.max(0, Math.floor(Number(v) || 0)); }
function clampInt(v,min,max) { return Math.max(min, Math.min(max, Math.floor(Number(v) || 0))); }
function initials(name) { return safeName(name).split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase() || "HL"; }
function isAdminPlayer(p) { return !!p && idOf(p.telegramId || p.id) === ADMIN_TELEGRAM_ID; }
function requireAdmin(socket) {
  const p=players.get(socket.data.playerId);
  if (!BOT_TOKEN || !socket.data.telegramVerified || !isAdminPlayer(p)) throw new Error("Доступ к админ-панели запрещён");
  return p;
}

/* Level curve: XP required for level L is 100 * (L - 1)^1.7.
   This makes early progression readable but prevents level 20 arriving in a week. */
function xpForLevel(level) {
  const l=clampInt(level,1,MAX_LEVEL);
  return Math.floor(100 * Math.pow(l - 1, 1.7));
}
function levelForXp(xp) {
  const value=Math.max(0,Math.floor(Number(xp)||0));
  let lo=1, hi=MAX_LEVEL;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(xpForLevel(mid)<=value)lo=mid;else hi=mid-1;}
  return lo;
}
function xpForMatch(win, place, stake) {
  const base = win ? 120 : place === 2 ? 55 : 35;
  const stakeBonus = Math.min(80, Math.floor(Number(stake || 0) / 1000) * 10);
  return base + (win ? stakeBonus : Math.floor(stakeBonus / 2));
}
function ratingDelta(win, place, playerRating, opponentAvg=playerRating) {
  const expected=1/(1+Math.pow(10,(opponentAvg-playerRating)/400));
  const actual=win?1:place===2?0.45:0;
  return Math.round(35*(actual-expected));
}

function newPlayer(id,tg={}) {
  return {
    id:idOf(id), telegramId:idOf(tg.id||id), username:safeName(tg.username||""),
    name:safeName(tg.first_name||tg.username||"Игрок"), avatar:tg.photo_url||"",
    level:1, xp:0, hc:START_HC, rating:1000, wins:0, losses:0, draws:0,
    faction:null, factionRank:0, factionCooldowns:{}, garage:[], plates:[], properties:[], businesses:[],
    displayProperty:null, displayVehicle:null, createdAt:Date.now(), lastSeenAt:Date.now()
  };
}
function normalizePlayer(p,tg={}) {
  if(!p) return newPlayer(tg.id||"dev",tg);
  p.id=idOf(p.id); p.telegramId=idOf(p.telegramId||p.id); p.name=safeName(p.name||tg.first_name||"Игрок");
  p.username=safeName(tg.username!==undefined?tg.username:p.username||""); p.avatar=tg.photo_url!==undefined?(tg.photo_url||""):(p.avatar||"");
  p.level=clampInt(p.level||1,1,MAX_LEVEL); p.xp=Math.max(0,Math.floor(Number(p.xp)||0)); p.level=levelForXp(p.xp);
  p.hc=money(p.hc??START_HC); p.rating=clampInt(p.rating??1000,0,RATING_MAX);
  p.wins=money(p.wins); p.losses=money(p.losses); p.draws=money(p.draws);
  p.faction=FACTIONS[p.faction]?p.faction:null; p.factionRank=clampInt(p.factionRank||0,0,7);
  if(p.faction && !FACTIONS[p.faction].ranks[p.factionRank]) p.factionRank=0;
  p.factionCooldowns=p.factionCooldowns||{}; p.garage=Array.isArray(p.garage)?p.garage:[]; p.plates=Array.isArray(p.plates)?p.plates:[];
  p.properties=Array.isArray(p.properties)?p.properties:[]; p.businesses=Array.isArray(p.businesses)?p.businesses:[];
  return p;
}
function factionInfo(p) {
  if(!p?.faction || !FACTIONS[p.faction]) return null;
  const f=FACTIONS[p.faction];
  return {id:f.id,name:f.name,rankIndex:p.factionRank,rank:f.ranks[p.factionRank],ranks:f.ranks};
}
function taskForPlayer(p) {
  const f=p?.faction?FACTIONS[p.faction]:null;
  if(!f) return null;
  return f.tasks.find(t=>p.factionRank>=t.min&&p.factionRank<=t.max)||f.tasks[0];
}
function taskState(p) {
  const task=taskForPlayer(p); if(!task) return null;
  const last=Number(p.factionCooldowns?.[task.name]||0);
  const next=Math.max(0,last+task.cooldown-Date.now());
  return {name:task.name,reward:task.reward,cooldown:task.cooldown,nextAvailableAt:next?last+task.cooldown:Date.now(),remainingMs:next,canClaim:!next};
}
function publicProfile(p) {
  if(!p) return null;
  const displayVehicle=p.displayVehicle?p.garage.find(v=>v.id===p.displayVehicle)||null:null;
  const plate=displayVehicle?.plateId?getPlateById(displayVehicle.plateId):null;
  return {
    id:p.id,name:p.name,username:p.username,avatar:p.avatar,initials:initials(p.name),
    level:p.level,xp:p.xp,xpForNextLevel:p.level<MAX_LEVEL?xpForLevel(p.level+1):xpForLevel(MAX_LEVEL),
    maxLevel:MAX_LEVEL,hc:p.hc,rating:p.rating,ratingMax:RATING_MAX,rank:rankForRating(p.rating),
    isAdmin:isAdminPlayer(p),wins:p.wins,losses:p.losses,draws:p.draws,
    faction:factionInfo(p),factionTask:taskState(p),
    displayProperty:p.properties.find(x=>x.id===p.displayProperty)||null,
    displayVehicle:displayVehicle?{...displayVehicle,plate:plate?.plate||null}:null,
    garage:p.garage,plates:p.plates.map(id=>getPlateById(id)).filter(Boolean),
    properties:p.properties,businesses:p.businesses
  };
}
async function savePlayer(p){if(!db||!p)return;try{await db.query(`INSERT INTO heavy_lux_players(id,data,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,[p.id,JSON.stringify(p)]);}catch(e){console.error("[DB] save:",e.message);}}
async function loadPlayer(id,tg={}) {
  const key=idOf(id); let p=players.get(key);
  if(!p&&db){try{const r=await db.query("SELECT data FROM heavy_lux_players WHERE id=$1",[key]);if(r.rows[0])p=r.rows[0].data;}catch(e){console.error("[DB] load:",e.message);}}
  p=normalizePlayer(p||newPlayer(key,tg),tg); p.lastSeenAt=Date.now(); players.set(key,p); await savePlayer(p); return p;
}
function telegramCheck(initData) {
  if(!BOT_TOKEN)return {ok:true,dev:true,user:null};
  if(typeof initData!=="string"||!initData)return {ok:false,error:"Telegram initData отсутствует"};
  const params=new URLSearchParams(initData),hash=params.get("hash"); if(!hash)return {ok:false,error:"Telegram hash отсутствует"};
  params.delete("hash");
  const data=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const secret=crypto.createHmac("sha256","WebAppData").update(BOT_TOKEN).digest();
  const expected=crypto.createHmac("sha256",secret).update(data).digest("hex");
  if(expected.length!==hash.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(hash)))return {ok:false,error:"Неверная подпись Telegram"};
  let user={};try{user=JSON.parse(params.get("user")||"{}");}catch{return {ok:false,error:"Некорректные данные Telegram"}}
  return {ok:true,user};
}
async function authenticate(socket){
  const a=socket.handshake.auth||{},checked=telegramCheck(a.initData||"");if(!checked.ok)throw new Error(checked.error);
  const tg=checked.user||{id:a.devId||`dev_${socket.id}`,username:a.username||"demo",first_name:a.name||"Игрок",photo_url:""};
  const p=await loadPlayer(String(tg.id||a.devId||socket.id),tg);
  socket.data.playerId=p.id;socket.data.telegramVerified=!!BOT_TOKEN&&checked.ok&&/^\d+$/.test(idOf(tg.id));sockets.set(p.id,socket.id);return p;
}
function socketFor(id){const sid=sockets.get(id);return sid?io.sockets.sockets.get(sid)||null:null;}
function findRoom(id){for(const r of rooms.values())if(r.playerIds.includes(id))return r;return null;}
function roomPublic(r){return {id:r.id,roomId:r.id,stake:r.stake,maxPlayers:r.maxPlayers,status:r.status,hostId:r.hostId,playerIds:r.playerIds,players:r.playerIds.map(id=>publicProfile(players.get(id))).filter(Boolean),mode:"Подкидной",deck:36,createdAt:r.createdAt};}
function roomList(){return [...rooms.values()].filter(r=>r.status==="LOBBY"&&r.playerIds.length<r.maxPlayers).sort((a,b)=>a.createdAt-b.createdAt).map(roomPublic);}
function emitRoom(r){for(const id of r.playerIds)socketFor(id)?.emit("room_state",roomPublic(r));io.emit("rooms",roomList());}
function emitGame(r){if(!r?.game)return;for(const id of r.playerIds)socketFor(id)?.emit("game_state",stateForPlayer(r.game,id));}
function emitProfile(p){socketFor(p.id)?.emit("profile",publicProfile(p));}
function error(socket,msg){socket.emit("toast",{type:"error",message:String(msg)});}
function ok(socket,msg){socket.emit("toast",{type:"success",message:String(msg)});}
function spend(p,n){n=money(n);if(p.hc<n)throw new Error("Недостаточно HC");p.hc-=n;}
function give(p,n){p.hc+=money(n);}
function getVehicle(p,id){return p.garage.find(v=>v.id===id)||null;}
function hasPlate(p,id){return p.plates.includes(id);}
function plateTaken(id){for(const p of players.values())if(p.plates.includes(id)||p.garage.some(v=>v.plateId===id))return true;for(const l of marketListings.values())if(l.assetType==="plate"&&l.assetId===id)return true;return false;}
function randomNormalPlate(){const a=NORMAL_PLATES.filter(x=>!plateTaken(x.id));if(!a.length)throw new Error("Свободные обычные номера закончились");return a[Math.floor(Math.random()*a.length)];}
function reserveBeautiful(id){const p=getPlateById(id);if(!p?.beautiful)throw new Error("Это не красивый номер");if(plateTaken(id))throw new Error("Номер уже занят");return p;}
function requireRoom(socket){const r=findRoom(socket.data.playerId);if(!r)throw new Error("Вы не находитесь в лобби");return r;}
function requireGameRoom(socket){const r=requireRoom(socket);if(!r.game)throw new Error("Партия ещё не началась");return r;}
function createRoom(playerId,stake,maxPlayers){if(!STAKES.includes(Number(stake)))throw new Error("Недопустимая ставка");if(![2,3].includes(Number(maxPlayers)))throw new Error("Лобби может быть на 2 или 3 игроков");const p=players.get(playerId);if(!p||p.hc<stake)throw new Error("Недостаточно HC");const r={id:crypto.randomBytes(3).toString("hex").toUpperCase(),stake:Number(stake),maxPlayers:Number(maxPlayers),status:"LOBBY",hostId:playerId,playerIds:[playerId],game:null,rewarded:false,createdAt:Date.now()};rooms.set(r.id,r);return r;}
function joinRoom(r,id){if(!r||r.status!=="LOBBY")throw new Error("Лобби уже запущено");if(r.playerIds.includes(id))return r;if(r.playerIds.length>=r.maxPlayers)throw new Error("В лобби нет свободных мест");if(players.get(id).hc<r.stake)throw new Error("Недостаточно HC");if(findRoom(id))throw new Error("Сначала выйдите из текущего лобби");r.playerIds.push(id);return r;}
function startRoom(r){if(r.playerIds.length!==r.maxPlayers)throw new Error(`Нужно ${r.maxPlayers} игрока(ов)`);for(const id of r.playerIds)if(players.get(id).hc<r.stake)throw new Error("Недостаточно HC");for(const id of r.playerIds)spend(players.get(id),r.stake);r.game=createGame({id:r.id,playerIds:[...r.playerIds],stake:r.stake});dealInitial(r.game);r.status="PLAYING";r.rewarded=false;emitProfiles(r);emitRoom(r);emitGame(r);}
function emitProfiles(r){for(const id of r.playerIds)emitProfile(players.get(id));}
function finishRewards(r){
  if(!r?.game||r.rewarded||r.game.status!=="FINISHED")return;r.rewarded=true;
  const g=r.game,ids=r.playerIds,pot=r.stake*ids.length,rake=Math.floor(pot*MATCH_RAKE);
  const ordered=[...g.players].sort((a,b)=>(a.finishPosition??999)-(b.finishPosition??999)),opAvg=ids.reduce((s,id)=>s+(players.get(id)?.rating||1000),0)/ids.length;
  const payouts={};if(ids.length===2)payouts[ordered[0].id]=pot-rake;else{payouts[ordered[0].id]=Math.floor(pot*.90);payouts[ordered[1].id]=Math.floor(pot*.05);}
  for(const id of ids){
    const p=players.get(id),win=g.winnerId===id,place=ordered.findIndex(x=>x.id===id)+1,payout=payouts[id]||0;
    give(p,payout);const xp=xpForMatch(win,place,r.stake);p.xp+=xp;p.level=levelForXp(p.xp);
    if(win){p.wins++;p.rating=clampInt(p.rating+Math.max(8,ratingDelta(true,place,p.rating,opAvg)),0,RATING_MAX);}
    else{p.losses++;p.rating=clampInt(p.rating+Math.min(-4,ratingDelta(false,place,p.rating,opAvg)),0,RATING_MAX);}
    emitProfile(p);savePlayer(p);socketFor(id)?.emit("match_result",{win,place,payout,xp,rating:p.rating,rank:rankForRating(p.rating),winnerId:g.winnerId});
  }
  r.status="FINISHED";emitRoom(r);emitGame(r);
}
function resetForRematch(r){if(r.status!=="FINISHED")throw new Error("Реванш недоступен");for(const id of r.playerIds)if(players.get(id).hc<r.stake)throw new Error("Недостаточно HC");r.game=null;r.status="LOBBY";r.rewarded=false;r.rematchVotes=new Set();emitRoom(r);}
function publicCatalog(){return {stakes:STAKES,vehicles:VEHICLES,exclusive:EXCLUSIVE,property:PROPERTY,propertyColors:PROPERTY_COLORS,businesses:BUSINESSES,beautifulNumbers:BEAUTIFUL_NUMBERS,quickPhrases:QUICK_PHRASES,ranks:RANKS,ratingMax:RATING_MAX,factions:FACTIONS,maxLevel:MAX_LEVEL};}
function publicMarket(){return {listings:[...marketListings.values()],auctions:[...auctions.values()].filter(a=>!a.ended)};}
function assetForPlayer(p,t,id){if(t==="vehicle")return getVehicle(p,id);if(t==="plate")return hasPlate(p,id)?getPlateById(id):null;return null;}
function removeAsset(p,t,id){if(t==="vehicle"){const i=p.garage.findIndex(v=>v.id===id);if(i<0)return false;p.garage.splice(i,1);if(p.displayVehicle===id)p.displayVehicle=p.garage[0]?.id||null;return true;}if(t==="plate"){const i=p.plates.indexOf(id);if(i<0)return false;p.plates.splice(i,1);for(const v of p.garage)if(v.plateId===id)v.plateId=null;return true;}return false;}
function buyVehicle(p,item){spend(p,item.price);const plate=randomNormalPlate();p.plates.push(plate.id);const v={id:uid("car"),catalogId:item.id,brand:item.brand,model:item.model,price:item.price,tuning:item.tuning||null,plateId:plate.id,purchasedAt:Date.now()};p.garage.push(v);if(!p.displayVehicle)p.displayVehicle=v.id;return {vehicle:v,plate};}
function buyProperty(p,item){if(p.properties.some(x=>x.id===item.id))throw new Error("Эта недвижимость уже есть");spend(p,item.price);const x={...item,acquiredAt:Date.now()};p.properties.push(x);if(!p.displayProperty)p.displayProperty=x.id;return x;}
function buyBusiness(p,item){const count=p.businesses.filter(x=>x.id===item.id).length;if(count>=item.maxOwned)throw new Error("Достигнут лимит владения");spend(p,item.price);const x={...item,ownershipId:uid("biz"),acquiredAt:Date.now()};p.businesses.push(x);return x;}
function buyBeautifulPlate(p,id){const plate=reserveBeautiful(id);spend(p,plate.price);p.plates.push(plate.id);return plate;}

async function getFactionChat(faction){
  if(db){try{const r=await db.query(`SELECT player_id,player_name,message,created_at FROM heavy_lux_faction_chat WHERE faction=$1 ORDER BY id DESC LIMIT 500`,[faction]);return r.rows.reverse().map(x=>({playerId:x.player_id,playerName:x.player_name,message:x.message,createdAt:new Date(x.created_at).getTime()}));}catch(e){console.error("[DB] faction chat:",e.message);}}
  return (factionMessages[faction]||[]).slice(-500);
}
async function pushFactionChat(faction,msg){
  factionMessages[faction]=(factionMessages[faction]||[]).concat(msg).slice(-500);
  if(db){try{await db.query(`INSERT INTO heavy_lux_faction_chat(faction,player_id,player_name,message) VALUES($1,$2,$3,$4)`,[faction,msg.playerId,msg.playerName,msg.message]);await db.query(`DELETE FROM heavy_lux_faction_chat WHERE faction=$1 AND id NOT IN (SELECT id FROM heavy_lux_faction_chat WHERE faction=$1 ORDER BY id DESC LIMIT 500)`,[faction]);}catch(e){console.error("[DB] chat save:",e.message);}}
}
function broadcastFaction(faction,event,data){for(const p of players.values())if(p.faction===faction)socketFor(p.id)?.emit(event,data);}
function factionCanClaim(p){const t=taskState(p);if(!t)throw new Error("Вы не состоите во фракции");if(!t.canClaim)throw new Error(`Задание будет доступно через ${Math.ceil(t.remainingMs/60000)} мин.`);return t;}

io.use((socket,next)=>authenticate(socket).then(()=>next()).catch(e=>next(new Error(e.message))));
io.on("connection",socket=>{
  const playerId=socket.data.playerId,p=players.get(playerId);emitProfile(p);socket.emit("catalog",publicCatalog());socket.emit("rooms",roomList());socket.emit("market",publicMarket());
  const room=findRoom(playerId);if(room){socket.emit("room_state",roomPublic(room));if(room.game)socket.emit("game_state",stateForPlayer(room.game,playerId));}
  socket.on("refresh",async()=>{socket.emit("profile",publicProfile(players.get(playerId)));socket.emit("rooms",roomList());socket.emit("market",publicMarket());});
  socket.on("create_room",({stake,maxPlayers},cb=()=>{})=>{try{const old=findRoom(playerId);if(old)throw new Error("Сначала выйдите из текущего лобби");const r=createRoom(playerId,Number(stake),Number(maxPlayers));emitRoom(r);cb({ok:true,room:roomPublic(r)});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("join_room",({roomId},cb=()=>{})=>{try{const r=joinRoom(rooms.get(String(roomId).toUpperCase()),playerId);emitRoom(r);cb({ok:true,room:roomPublic(r)});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("quick_match",({maxPlayers=2}={},cb=()=>{})=>{try{if(findRoom(playerId))throw new Error("Сначала выйдите из текущего лобби");const pp=players.get(playerId),c=roomList().filter(r=>r.playerIds[0]!==playerId&&r.stake<=pp.hc&&(Number(maxPlayers)===3?r.maxPlayers===3:true));const r=c[0]?joinRoom(rooms.get(c[0].id),playerId):createRoom(playerId,STAKES.filter(s=>s<=pp.hc).slice(-1)[0]||100,Number(maxPlayers)===3?3:2);emitRoom(r);if(r.playerIds.length===r.maxPlayers)startRoom(r);cb({ok:true,room:roomPublic(r)});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("start_room",(cb=()=>{})=>{try{const r=requireRoom(socket);if(r.hostId!==playerId)throw new Error("Начать игру может создатель");startRoom(r);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("leave_room",(cb=()=>{})=>{try{const r=findRoom(playerId);if(!r)return cb({ok:true});if(r.status==="PLAYING")throw new Error("Нельзя выйти во время партии");r.playerIds=r.playerIds.filter(id=>id!==playerId);if(r.hostId===playerId)r.hostId=r.playerIds[0]||null;if(!r.playerIds.length)rooms.delete(r.id);else emitRoom(r);io.emit("rooms",roomList());cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  for(const [event,fn] of [["attack",(r,id)=>playAttack(r.game,playerId,id)],["defend",(r,id)=>defend(r.game,playerId,id)]]){
    socket.on(event,({cardId}={},cb=()=>{})=>{try{const r=requireGameRoom(socket);r.game=fn(r,cardId);if(r.game.status==="FINISHED")finishRewards(r);emitGame(r);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  }
  socket.on("take",(cb=()=>{})=>{try{const r=requireGameRoom(socket);r.game=take(r.game,playerId);if(r.game.status==="FINISHED")finishRewards(r);emitGame(r);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("end_attack",(cb=()=>{})=>{try{const r=requireGameRoom(socket);r.game=endAttack(r.game,playerId);if(r.game.status==="FINISHED")finishRewards(r);emitGame(r);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("rematch",(cb=()=>{})=>{try{const r=requireRoom(socket);r.rematchVotes=r.rematchVotes||new Set();r.rematchVotes.add(playerId);if(r.rematchVotes.size===r.playerIds.length)resetForRematch(r);else ok(socket,"Ждём соперников на реванш");cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("phrase",({phrase})=>{if(!QUICK_PHRASES.includes(phrase))return;const r=findRoom(playerId);if(!r||r.status!=="PLAYING")return;for(const id of r.playerIds)socketFor(id)?.emit("phrase",{playerId,phrase});});
  socket.on("profile_get",({playerId:targetId}={})=>{const t=players.get(idOf(targetId));if(t)socket.emit("player_preview",publicProfile(t));});

  socket.on("faction_get",async(cb=()=>{})=>{try{const p=players.get(playerId);cb({ok:true,faction:factionInfo(p),task:taskState(p),messages:p.faction?await getFactionChat(p.faction):[]});}catch(e){cb({ok:false,error:e.message});}});
  socket.on("faction_chat_send",async({message}={},cb=()=>{})=>{try{const p=players.get(playerId);if(!p.faction)throw new Error("Вы не состоите во фракции");const text=safeName(message).slice(0,300);if(!text)throw new Error("Сообщение пустое");const msg={playerId:p.id,playerName:p.name,message:text,createdAt:Date.now()};await pushFactionChat(p.faction,msg);broadcastFaction(p.faction,"faction_chat_message",msg);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("faction_task_claim",async(cb=()=>{})=>{try{const p=players.get(playerId),t=factionCanClaim(p);give(p,t.reward);p.factionCooldowns[t.name]=Date.now();await savePlayer(p);emitProfile(p);cb({ok:true,reward:t.reward,task:taskState(p)});ok(socket,`Задание выполнено: +${t.reward} HC`);}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});

  socket.on("admin_get",async({telegramId}={},cb=()=>{})=>{try{requireAdmin(socket);const id=idOf(telegramId);if(!/^\d+$/.test(id))throw new Error("Укажите корректный Telegram ID");const t=await loadPlayer(id,{id});cb({ok:true,player:publicProfile(t)});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("admin_set_player",async({telegramId,level,rating,rankName,hc,faction,factionRank}={},cb=()=>{})=>{try{requireAdmin(socket);const id=idOf(telegramId);if(!/^\d+$/.test(id))throw new Error("Укажите корректный Telegram ID");const t=await loadPlayer(id,{id});
    const lv=clampInt(level,1,MAX_LEVEL);let rt=clampInt(rating,0,RATING_MAX);if(rankName){const chosen=RANKS.find(r=>r.name===rankName);if(!chosen)throw new Error("Некорректный ранг");rt=chosen.min;}const cash=money(hc);
    if(faction!==undefined&&!FACTIONS[faction]&&faction!==null)throw new Error("Некорректная фракция");
    t.level=lv;t.xp=xpForLevel(lv);t.rating=rt;t.hc=cash;
    if(faction===null||faction===""){t.faction=null;t.factionRank=0;}else if(faction!==undefined){t.faction=faction;t.factionRank=clampInt(factionRank??0,0,7);}
    await savePlayer(t);emitProfile(t);cb({ok:true,player:publicProfile(t)});ok(socket,`Профиль ${id} обновлён`);
  }catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});

  socket.on("set_display",async({vehicleId,propertyId}={},cb=()=>{})=>{try{const p=players.get(playerId);if(vehicleId!==undefined){if(vehicleId!==null&&!getVehicle(p,vehicleId))throw new Error("Автомобиль не найден");p.displayVehicle=vehicleId;}if(propertyId!==undefined){if(propertyId!==null&&!p.properties.some(x=>x.id===propertyId))throw new Error("Недвижимость не найдена");p.displayProperty=propertyId;}await savePlayer(p);emitProfile(p);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("buy_vehicle",async({catalogId,exclusive=false}={},cb=()=>{})=>{try{const p=players.get(playerId),item=(exclusive?EXCLUSIVE:VEHICLES).find(x=>x.id===catalogId);if(!item)throw new Error("Автомобиль не найден");const result=buyVehicle(p,item);await savePlayer(p);emitProfile(p);cb({ok:true,result});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("buy_property",async({catalogId}={},cb=()=>{})=>{try{const p=players.get(playerId),item=PROPERTY.find(x=>x.id===catalogId);if(!item)throw new Error("Недвижимость не найдена");const result=buyProperty(p,item);await savePlayer(p);emitProfile(p);cb({ok:true,result});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("buy_business",async({catalogId}={},cb=()=>{})=>{try{const p=players.get(playerId),item=BUSINESSES.find(x=>x.id===catalogId);if(!item)throw new Error("Бизнес не найден");const result=buyBusiness(p,item);await savePlayer(p);emitProfile(p);cb({ok:true,result});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("buy_plate",async({plateId}={},cb=()=>{})=>{try{const p=players.get(playerId),result=buyBeautifulPlate(p,plateId);await savePlayer(p);emitProfile(p);cb({ok:true,result});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("install_plate",async({vehicleId,plateId}={},cb=()=>{})=>{try{const p=players.get(playerId),v=getVehicle(p,vehicleId);if(!v)throw new Error("Автомобиль не найден");if(!hasPlate(p,plateId))throw new Error("Номер не принадлежит вам");for(const other of p.garage)if(other.plateId===plateId)other.plateId=null;v.plateId=plateId;await savePlayer(p);emitProfile(p);cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("market_list",async({assetType,assetId,price}={},cb=()=>{})=>{try{const p=players.get(playerId),asset=assetForPlayer(p,assetType,assetId);if(!asset)throw new Error("Предмет не найден");const salePrice=money(price);if(!salePrice)throw new Error("Укажите цену");if([...marketListings.values()].some(x=>x.assetType===assetType&&x.assetId===assetId))throw new Error("Предмет уже выставлен");const snapshot=assetType==="vehicle"?JSON.parse(JSON.stringify(asset)):null;if(snapshot?.plateId)p.plates=p.plates.filter(id=>id!==snapshot.plateId);removeAsset(p,assetType,assetId);const l={id:uid("listing"),sellerId:playerId,sellerName:p.name,assetType,assetId,vehicleSnapshot:snapshot,price:salePrice,createdAt:Date.now()};marketListings.set(l.id,l);await savePlayer(p);emitProfile(p);io.emit("market",publicMarket());cb({ok:true,listing:l});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("market_buy",async({listingId}={},cb=()=>{})=>{try{const l=marketListings.get(listingId);if(!l)throw new Error("Объявление не найдено");const buyer=players.get(playerId);if(l.sellerId===playerId)throw new Error("Нельзя купить свой предмет");spend(buyer,l.price);const seller=players.get(l.sellerId);give(seller,l.price);if(l.assetType==="plate")buyer.plates.push(l.assetId);else{const v=l.vehicleSnapshot||{id:uid("car"),catalogId:"market",brand:"Market",model:"Автомобиль",price:l.price,plateId:null};if(v.plateId)buyer.plates.push(v.plateId);buyer.garage.push(v);if(!buyer.displayVehicle)buyer.displayVehicle=v.id;}marketListings.delete(listingId);await savePlayer(buyer);await savePlayer(seller);emitProfile(buyer);emitProfile(seller);io.emit("market",publicMarket());cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("auction_create",async({assetType,assetId,startPrice,duration=300}={},cb=()=>{})=>{try{const p=players.get(playerId),asset=assetForPlayer(p,assetType,assetId);if(!asset)throw new Error("Предмет не найден");const snapshot=assetType==="vehicle"?JSON.parse(JSON.stringify(asset)):null;if(snapshot?.plateId)p.plates=p.plates.filter(id=>id!==snapshot.plateId);removeAsset(p,assetType,assetId);const a={id:uid("auction"),sellerId:playerId,sellerName:p.name,assetType,assetId,vehicleSnapshot:snapshot,startPrice:money(startPrice),highestBid:0,highestBidderId:null,endsAt:Date.now()+Math.max(60,Number(duration))*1000,ended:false};auctions.set(a.id,a);await savePlayer(p);emitProfile(p);io.emit("market",publicMarket());cb({ok:true,auction:a});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("auction_bid",async({auctionId,bid}={},cb=()=>{})=>{try{const a=auctions.get(auctionId);if(!a||a.ended||Date.now()>a.endsAt)throw new Error("Аукцион завершён");const p=players.get(playerId),amount=money(bid);if(amount<=Math.max(a.startPrice,a.highestBid))throw new Error("Ставка должна быть выше текущей");spend(p,amount);if(a.highestBidderId)give(players.get(a.highestBidderId),a.highestBid);a.highestBid=amount;a.highestBidderId=playerId;await savePlayer(p);io.emit("market",publicMarket());cb({ok:true});}catch(e){error(socket,e.message);cb({ok:false,error:e.message});}});
  socket.on("disconnect",()=>{if(sockets.get(playerId)===socket.id)sockets.delete(playerId);const r=findRoom(playerId);if(r?.status==="LOBBY")emitRoom(r);});
});

setInterval(()=>{
  for(const a of auctions.values())if(!a.ended&&Date.now()>=a.endsAt){a.ended=true;const winner=players.get(a.highestBidderId),seller=players.get(a.sellerId);
    if(winner){if(a.assetType==="plate")winner.plates.push(a.assetId);else{const v=a.vehicleSnapshot||{id:uid("car"),catalogId:"auction",brand:"Auction",model:"Автомобиль",price:a.highestBid,plateId:null};if(v.plateId)winner.plates.push(v.plateId);winner.garage.push(v);}savePlayer(winner);emitProfile(winner);}
    else if(seller){if(a.assetType==="plate")seller.plates.push(a.assetId);else{if(a.vehicleSnapshot?.plateId)seller.plates.push(a.vehicleSnapshot.plateId);seller.garage.push(a.vehicleSnapshot||{id:uid("car"),catalogId:"auction",brand:"Auction",model:"Автомобиль",price:a.startPrice,plateId:null});}savePlayer(seller);emitProfile(seller);}
    io.emit("market",publicMarket());
  }
},5000);

app.get("/health",(req,res)=>res.json({ok:true,service:"Heavy Lux Card",database:!!db,rooms:rooms.size,players:players.size,time:new Date().toISOString()}));
app.get("/api/catalog",(req,res)=>res.json(publicCatalog()));
app.get("/api/rooms",(req,res)=>res.json(roomList()));
app.get("/api/market",(req,res)=>res.json(publicMarket()));
app.post("/api/auth/telegram",async(req,res)=>{const c=telegramCheck(req.body?.initData||"");if(!c.ok)return res.status(401).json(c);const tg=c.user||{id:req.body?.devId||"demo",first_name:"Игрок"};const p=await loadPlayer(String(tg.id),tg);res.json({ok:true,profile:publicProfile(p)});});
app.get("/api/factions",(req,res)=>res.json(FACTIONS));
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
server.listen(PORT,()=>console.log(`[Heavy Lux Card] listening on ${PORT} | telegram=${!!BOT_TOKEN} | postgres=${!!db} | admin=${ADMIN_TELEGRAM_ID}`));
process.on("SIGTERM",async()=>{try{for(const p of players.values())await savePlayer(p);if(db)await db.end();}finally{process.exit(0);}});
process.on("SIGINT",async()=>{try{for(const p of players.values())await savePlayer(p);if(db)await db.end();}finally{process.exit(0);}});
