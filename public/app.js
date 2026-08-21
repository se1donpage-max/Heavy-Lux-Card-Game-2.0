"use strict";
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
const socket = io({
  auth: {
    initData: tg?.initData || "",
    devId: `dev_${Math.random().toString(36).slice(2)}`,
  },
});
const state = {
  profile: null,
  catalog: null,
  selectedPlayers: 2,
  selectedStake: 500,
  room: null,
  game: null,
  selectedCard: null,
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function nav(id) {
  $$(".screen").forEach((x) => x.classList.remove("active"));
  $(`#${id}`).classList.add("active");
  if (id === "profile") renderProfile();
  if (id === "garage") renderGarage();
  if (id === "dealers") renderDealer("motors");
}
function money(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}
function toast(m) {
  const el = $("#toast");
  el.textContent = m;
  el.style.display = "block";
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => (el.style.display = "none"), 2200);
}
function renderTop() {
  if (!state.profile) return;
  $(
    "#miniProfile"
  ).textContent = `${state.profile.name} · ур. ${state.profile.level}`;
  $("#balance").textContent = `${money(state.profile.hc)} HC`;
  $("#playBalance").textContent = `${money(state.profile.hc)} HC`;
}
function renderProfile() {
  const p = state.profile;
  if (!p) return;
  $("#profileCard").innerHTML = `<h3>${p.name}</h3><div class="small">@${ p.username || "player" }</div><div class="stat-grid"><div class="stat"><span>Уровень</span><b>${ p.level }/100</b></div><div class="stat"><span>Баланс</span><b>${money( p.hc )} HC</b></div><div class="stat"><span>Рейтинг</span><b>${ p.rating }</b></div><div class="stat"><span>W / L</span><b>${p.wins} / ${ p.losses }</b></div></div><h3>Владения игрока</h3><div>Номера: ${ p.plates.length }</div><div>Автомобили: ${p.garage.length}</div><div>Недвижимость: ${ p.properties.length }</div><div>Бизнес: ${p.businesses.length}</div>`;
}
function renderGarage() {
  const p = state.profile;
  $("#garageList").innerHTML = p.garage.length
    ? p.garage
        .map((id) => {
          const x = [
            ...(state.catalog.vehicles || []),
            ...(state.catalog.exclusive || []),
          ].find((v) => v.id === id);
          return `<div class="garage-card"><div><b>${ x ? x.brand + " " + x.model : id }</b><div class="small">Номер закрепляется отдельно</div></div></div>`;
        })
        .join("")
    : '<div class="panel">Гараж пока пуст.</div>';
}
function renderDealer(kind) {
  const list =
    kind === "motors" ? state.catalog.vehicles : state.catalog.exclusive;
  $("#dealerList").innerHTML = list
    .map(
      (x) =>
        `<div class="dealer-card"><div><b>${x.brand} ${ x.model }</b><div class="small">${ x.tuning || "Без тюнинга" }</div></div><div><div class="price">${money( x.price )} HC</div><button class="secondary" onclick="buyVehicle('${x.id}',${ kind === "exclusive" })">КУПИТЬ</button></div></div>`
    )
    .join("");
}
window.buyVehicle = (id, exclusive) =>
  socket.emit("buy_vehicle", { id, exclusive });
function renderRooms(rooms) {
  $("#roomsList").innerHTML = rooms.length
    ? rooms
        .map(
          (r) =>
            `<div class="room"><b>Heavy Room</b><div class="player-line">${r.players .map((p) => `<span>👤 ${p.name}</span>`) .join("")}</div><div class="small">СТАВКИ: ${money( r.stake )} · РЕЖИМ: ПОДКИДНОЙ · КОЛОДА: 36</div><button class="primary" onclick="joinRoom('${ r.roomId }')">ВОЙТИ</button></div>`
        )
        .join("")
    : '<div class="panel">Свободных лобби нет.</div>';
}
window.joinRoom = (id) => socket.emit("join_room", { roomId: id });
function renderRoom(room) {
  state.room = room;
  $("#roomPanel").classList.remove("hidden");
  $("#roomPanel").innerHTML = `<h3>Heavy Room</h3>${room.players .map((p) => `<div class="player-line">👤 ${p.name}</div>`) .join("")}${ room.players.length < room.maxPlayers ? '<div class="player-line">👤 Свободно</div>' : "" }<p>СТАВКИ: ${money(room.stake)}<br>РЕЖИМ: ПОДКИДНОЙ<br>КОЛОДА: 36</p>${ room.hostId === state.profile.id && room.players.length === room.maxPlayers ? '<button class="primary" id="startRoom">НАЧАТЬ</button>' : "" }<button class="secondary" id="leaveRoom">ВЫЙТИ</button>`;
  $("#startRoom")?.addEventListener("click", () => socket.emit("start_room"));
  $("#leaveRoom")?.addEventListener("click", () => socket.emit("leave_room"));
}
function cardHtml(c, active) {
  return `<button class="card ${ c.suit === "♥" || c.suit === "♦" ? "red" : "" } ${active ? "" : "disabled"}" data-card="${c.id}"><span>${ c.rank }</span><span>${c.suit}</span></button>`;
}
function renderGame(g) {
  state.game = g;
  nav("game");
  const me = g.players.find((p) => p.id === state.profile.id);
  $("#gameTop").innerHTML = `<span>Ставка ${money(g.stake)} HC · Козырь ${ g.trumpSuit }</span><span>Колода: ${g.deckCount}</span>`;
  $("#players").innerHTML = g.players
    .filter((p) => p.id !== state.profile.id)
    .map(
      (p) =>
        `<span class="player-chip">👤 ${p.id === g.attackerId ? "⚔️ " : ""}${ p.id === g.defenderId ? "🛡️ " : "" }${p.id.slice(0, 10)} · ${p.handCount} карт</span>`
    )
    .join("");
  $("#table").innerHTML = `<div class="table-zone">${g.table .map( (pair) => `<div class="pair">${cardHtml(pair.attack, true)}${ pair.defense ? cardHtml(pair.defense, true) : "" }</div>` ) .join("")}</div>`;
  $("#hand").innerHTML = `<div class="hand-zone">${g.myHand .map((c) => cardHtml( c, g.availableAttacks.some((a) => a.id === c.id) || g.availableDefenses.some((a) => a.id === c.id) ) ) .join("")}</div>`;
  $("#actions").innerHTML = `<div class="action-row">${ g.canTake ? '<button id="take">ВЗЯТЬ</button>' : "" }${g.canEndAttack ? '<button id="end">ЗАКОНЧИТЬ АТАКУ</button>' : ""}</div>`;
  $$("[data-card]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.card;
        if (g.availableDefenses.some((c) => c.id === id))
          socket.emit("defend", { cardId: id });
        else if (g.availableAttacks.some((c) => c.id === id))
          socket.emit("play_attack", { cardId: id });
        else toast("Эта карта сейчас недоступна");
      })
  );
  $("#take")?.addEventListener("click", () => socket.emit("take_cards"));
  $("#end")?.addEventListener("click", () => socket.emit("end_attack"));
  if (g.status === "FINISHED") {
    toast(g.winnerId === state.profile.id ? "ПОБЕДА" : "ПАРТИЯ ОКОНЧЕНА");
    setTimeout(() => nav("play"), 1800);
  }
}
function setup() {
  state.catalog = {
    stakes: [100, 250, 500, 1000, 2500, 5000, 10000],
    vehicles: [],
    exclusive: [],
  };
  state.catalog.vehicles = [];
  state.catalog.exclusive = [];
  $("#stakeChoice").innerHTML = state.catalog.stakes
    .map(
      (x) =>
        `<button class="choice ${ x === 500 ? "active" : "" }" data-stake="${x}">${x}</button>`
    )
    .join("");
  $$("[data-stake]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-stake]").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.selectedStake = Number(b.dataset.stake);
      })
  );
  $$("[data-players]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-players]").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.selectedPlayers = Number(b.dataset.players);
      })
  );
  $$("[data-nav]").forEach((b) => (b.onclick = () => nav(b.dataset.nav)));
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        const tab = b.dataset.tab;
        $$("[data-tab]").forEach((x) => x.classList.toggle("active", x === b));
        $("#createTab").classList.toggle("hidden", tab !== "create");
        $("#findTab").classList.toggle("hidden", tab !== "find");
      })
  );
  $$("[data-dealer]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-dealer]").forEach((x) =>
          x.classList.toggle("active", x === b)
        );
        renderDealer(b.dataset.dealer);
      })
  );
  $("#createRoom").onclick = () =>
    socket.emit("create_room", {
      stake: state.selectedStake,
      maxPlayers: state.selectedPlayers,
    });
  $("#listRooms").onclick = () => socket.emit("list_rooms");
  $("#quickMatch").onclick = () => socket.emit("quick_match");
  $("#messageBtn").onclick = () => {
    let box = $(".messages");
    if (box) box.remove();
    else {
      $("#game").insertAdjacentHTML(
        "beforeend",
        `<div class="messages">${ state.catalog.quickPhrases ?.map((x) => `<button data-msg="${x}">${x}</button>`) .join("") || "" }</div>`
      );
      $$("[data-msg]").forEach(
        (b) =>
          (b.onclick = () => {
            socket.emit("quick_message", { text: b.dataset.msg });
            $(".messages")?.remove();
          })
      );
    }
  };
}
setup();
socket.on("bootstrap", (data) => {
  state.profile = data.profile;
  state.catalog = data.catalog;
  renderTop();
  $("#stakeChoice").innerHTML = state.catalog.stakes
    .map(
      (x) =>
        `<button class="choice ${ x === 500 ? "active" : "" }" data-stake="${x}">${x}</button>`
    )
    .join("");
  $$("[data-stake]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-stake]").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        state.selectedStake = Number(b.dataset.stake);
      })
  );
  $("#loading").classList.remove("active");
  nav("home");
});
socket.on("room_state", renderRoom);
socket.on("rooms_list", renderRooms);
socket.on("game_state", renderGame);
socket.on("profile", (p) => {
  state.profile = p;
  renderTop();
  renderProfile();
});
socket.on("quick_message", (m) => toast(`${m.from.slice(0, 8)}: ${m.text}`));
socket.on("quick_match_wait", () => toast("Ищем подходящее лобби…"));
socket.on("toast", (x) => toast(x.message));
socket.on("auth_error", (x) => toast(x.message));
socket.on("connect_error", () => toast("Ошибка соединения"));
