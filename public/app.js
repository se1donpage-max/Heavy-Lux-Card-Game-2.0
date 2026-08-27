"use strict";

(() => {

  const S = {
    profile: null,
    catalog: {},
    rooms: [],
    room: null,
    game: null,
    view: "play",
    tab: "cars",
    market: {
      listings: [],
      auctions: []
    },
    socket: null,
    selectedStake: 500,
    selectedPlayers: 2
  };

  const $ =
    id => document.getElementById(id);

  const esc =
    v =>
      String(v ?? "")
        .replace(
          /[&<>"']/g,
          c =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              "\"": "&quot;",
              "'": "&#039;"
            }[c])
        );

  const money =
    v =>
      Number(v || 0)
        .toLocaleString("ru-RU");

  const devId =
    () => {

      let x =
        localStorage.getItem(
          "hlc_dev_id"
        );

      if (!x) {

        x =
          "dev_" +
          crypto.randomUUID();

        localStorage.setItem(
          "hlc_dev_id",
          x
        );

      }

      return x;

    };


  function tg() {

    const w =
      window.Telegram?.WebApp;

    if (w) {

      try {

        w.ready();

        if (
          w.initData &&
          w.initDataUnsafe?.user
        ) {

          return {
            initData: w.initData,
            devId:
              String(
                w.initDataUnsafe.user.id
              ),
            username:
              w.initDataUnsafe.user.username ||
              "",
            name:
              w.initDataUnsafe.user.first_name ||
              "Игрок"
          };

        }

      } catch {}

    }

    return {
      devId: devId(),
      username: "demo",
      name: "Игрок"
    };

  }


  function toast(
    message,
    type = "success"
  ) {

    const e =
      document.createElement("div");

    e.className =
      `toast ${type}`;

    e.textContent =
      message;

    $("toast")
      .appendChild(e);

    setTimeout(
      () => e.remove(),
      2800
    );

  }


  function show(view) {

    S.view =
      view;

    for (
      const id of [
        "play",
        "profile",
        "menu",
        "admin",
        "garage",
        "faction",
        "room",
        "game"
      ]
    ) {

      $("view-" + id)
        .classList
        .toggle(
          "hidden",
          id !== view
        );

    }

    document
      .querySelectorAll(
        ".bottom button"
      )
      .forEach(
        b =>
          b.classList.toggle(
            "active",
            b.dataset.view === view
          )
      );

    if (view === "profile")
      renderProfile();

    if (view === "garage")
      renderGarage();

    if (view === "faction")
      renderFaction();

    if (view === "menu")
      renderMenu();

    if (view === "admin")
      renderAdmin();

    if (view === "room")
      renderRoom();

    if (view === "game")
      renderGame();

  }


  function profileHeader() {

    if (!S.profile)
      return;

    $("playerName").textContent =
      S.profile.name ||
      "Игрок";

    $("balance").textContent =
      money(
        S.profile.hc
      );

    $("playerRank").textContent =
      `${S.profile.rank?.name || "Новичок"} · ${
        S.profile.rating || 0
      }/${S.profile.ratingMax || 12000}`;

    $("playerRank").style.color =
      S.profile.rank?.color || "";

    $("topProfile").textContent =
      S.profile.initials ||
      "HL";

  }


  function emit(
    event,
    data,
    cb
  ) {

    if (!S.socket)
      return;

    S.socket.emit(
      event,
      data,
      cb
    );

  }


  function modal(
    title,
    body
  ) {

    const e =
      document.createElement("div");

    e.className =
      "modal";

    e.innerHTML = `
      <div class="modalInner">

        <div class="modalHead">
          <h3>${esc(title)}</h3>
          <button class="modalClose">
            ✕
          </button>
        </div>

        ${body}

      </div>
    `;

    e.querySelector(
      ".modalClose"
    ).onclick =
      () => e.remove();

    document.body.appendChild(e);

    return e;

  }


  function openCreate() {

    const m =
      modal(
        "Создать лобби",
        `
        <p class="muted">
          Выберите размер комнаты и ставку.
        </p>

        <b>Игроки</b>

        <div
          class="choice"
          id="playersChoice"
        >
          <button
            data-v="2"
            class="selected"
          >
            2 игрока
          </button>

          <button data-v="3">
            3 игрока
          </button>
        </div>

        <b>Ставка</b>

        <div
          class="choice"
          id="stakeChoice"
        >
          ${(S.catalog.stakes || [])
            .map(
              x =>
                `
                <button
                  data-v="${x}"
                  class="${
                    x === S.selectedStake
                      ? "selected"
                      : ""
                  }"
                >
                  ${money(x)} HC
                </button>
                `
            )
            .join("")}
        </div>

        <button
          class="primary wide"
          id="createConfirm"
        >
          Создать лобби
        </button>
        `
      );

    m.querySelectorAll(
      "#playersChoice button"
    ).forEach(
      b =>
        b.onclick =
          () => {

            m.querySelectorAll(
              "#playersChoice button"
            )
            .forEach(
              x =>
                x.classList.remove(
                  "selected"
                )
            );

            b.classList.add(
              "selected"
            );

            S.selectedPlayers =
              Number(
                b.dataset.v
              );

          }
    );

    m.querySelectorAll(
      "#stakeChoice button"
    ).forEach(
      b =>
        b.onclick =
          () => {

            m.querySelectorAll(
              "#stakeChoice button"
            )
            .forEach(
              x =>
                x.classList.remove(
                  "selected"
                )
            );

            b.classList.add(
              "selected"
            );

            S.selectedStake =
              Number(
                b.dataset.v
              );

          }
    );

    m.querySelector(
      "#createConfirm"
    ).onclick =
      () =>
        emit(
          "create_room",
          {
            stake:
              S.selectedStake,
            maxPlayers:
              S.selectedPlayers
          },
          r => {

            if (r?.ok) {

              m.remove();

              show(
                "room"
              );

            }

          }
        );

  }


  function openFind() {

    const m =
      modal(
        "Найти игру",
        `
        <div class="choice">

          <button
            class="selected"
            id="quick2"
          >
            ⚡ Быстрая игра
            <br>
            <small>
              Любая доступная ставка
            </small>
          </button>

          <button id="quick3">
            👥 Быстрая игра 3 игрока
            <br>
            <small>
              Любая доступная ставка
            </small>
          </button>

        </div>

        <div
          id="roomListModal"
          class="roomsList"
        ></div>
        `
      );

    m.querySelector(
      "#quick2"
    ).onclick =
      () =>
        quick(
          2,
          m
        );

    m.querySelector(
      "#quick3"
    ).onclick =
      () =>
        quick(
          3,
          m
        );

    renderRoomList(
      m.querySelector(
        "#roomListModal"
      )
    );

  }


  function quick(
    max,
    m
  ) {

    emit(
      "quick_match",
      {
        maxPlayers:
          max
      },
      r => {

        if (r?.ok) {

          m.remove();

          show(
            "room"
          );

        }

      }
    );

  }


  function renderRoomList(
    root =
      document.querySelector(
        "#roomListModal"
      )
  ) {

    if (!root)
      return;

    root.innerHTML =
      S.rooms.length
        ? S.rooms
            .map(
              room =>
                `
                <div class="room">

                  <div>
                    <b>
                      Heavy Room ·
                      ${esc(room.id)}
                    </b>

                    <div class="muted">
                      ${room.players.length}/${
                        room.maxPlayers
                      }
                      игроков ·
                      ${money(room.stake)}
                      HC
                    </div>
                  </div>

                  <button
                    class="smallBtn"
                    data-join="${room.id}"
                  >
                    Войти
                  </button>

                </div>
                `
            )
            .join("")
        :
          "<div class='empty'>Свободных лобби сейчас нет.</div>";

    root
      .querySelectorAll(
        "[data-join]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              emit(
                "join_room",
                {
                  roomId:
                    b.dataset.join
                },
                r => {

                  if (r?.ok) {

                    document
                      .querySelector(
                        ".modal"
                      )
                      ?.remove();

                    show(
                      "room"
                    );

                  }

                }
              )
      );

  }


  function renderRoom() {

    if (!S.room)
      return;

    const r =
      S.room;

    $("roomContent")
      .innerHTML = `
        <div class="room">

          <div class="eyebrow">
            HEAVY ROOM ·
            ${esc(r.id)}
          </div>

          <div class="roomPlayers">

            ${[
              ...Array(
                r.maxPlayers
              )
            ]
              .map(
                (_, i) => {

                  const p =
                    r.players[i];

                  return `
                    <div class="slot">

                      ${
                        p
                          ? `
                            <div class="oppAvatar">
                              ${esc(p.initials)}
                            </div>

                            <b>
                              ${
                                esc(
                                  p.username
                                    ? "@" +
                                      p.username
                                    : p.name
                                )
                              }
                            </b>
                          `
                          :
                          `
                            <span class="muted">
                              Свободно
                            </span>
                          `
                      }

                    </div>
                  `;

                }
              )
              .join("")}

          </div>

          <div class="roomMeta">

            <span>
              СТАВКИ:
              <strong>
                ${money(r.stake)}
              </strong>
            </span>

            <span>
              РЕЖИМ:
              <strong>
                ПОДКИДНОЙ
              </strong>
            </span>

            <span>
              КОЛОДА:
              <strong>
                36
              </strong>
            </span>

          </div>

          <button
            class="primary wide"
            id="startRoom"
          >
            ${
              r.players.length ===
              r.maxPlayers
                ? (
                    r.hostId ===
                    S.profile.id
                      ? "НАЧАТЬ"
                      : "Ждём создателя"
                  )
                : "Ждём игроков"
            }
          </button>

        </div>
      `;

    const b =
      $("startRoom");

    b.disabled =
      !(
        r.players.length ===
          r.maxPlayers &&
        r.hostId ===
          S.profile.id
      );

    b.onclick =
      () =>
        emit(
          "start_room",
          r => {

            if (r?.ok)
              show("game");

          }
        );

  }


  function card(
    c,
    available = false,
    click = null
  ) {

    const red =
      c.suit === "♥" ||
      c.suit === "♦";

    return `
      <button
        class="playingCard ${
          red ? "red" : ""
        } ${
          available
            ? "available"
            : ""
        }"
        data-card="${esc(c.id)}"
        ${
          click
            ? `data-action="${click}"`
            : ""
        }
      >
        <span class="rank">
          ${esc(c.rank)}
        </span>

        <span class="suit">
          ${esc(c.suit)}
        </span>

      </button>
    `;

  }


  function renderGame() {

    const g =
      S.game;

    if (!g)
      return;

    const players =
      (g.players || [])
        .filter(
          p =>
            p.id !==
            S.profile.id
        );

    const availableA =
      new Set(
        (
          g.availableAttacks ||
          []
        ).map(
          c => c.id
        )
      );

    const availableD =
      new Set(
        (
          g.availableDefenses ||
          []
        ).map(
          c => c.id
        )
      );

    let table =
      g.table
        ?.map(
          x =>
            `
            <div>
              ${card(x.attack)}

              ${
                x.defense
                  ? `
                    <span class="defenseMark">
                      ✓
                    </span>
                    ${card(x.defense)}
                  `
                  : ""
              }

            </div>
            `
        )
        .join("")
      ||
      "<span class='muted'>Стол пуст</span>";

    $("gameContent")
      .innerHTML = `
        <div class="game">

          <div class="gameTop">

            <div>

              <b>
                ${
                  g.phase ===
                  "DEFENSE"
                    ? "ЗАЩИТА"
                    : "АТАКА"
                }
              </b>

              <small class="muted">
                · раунд
                ${g.roundNumber}
              </small>

            </div>

            <b class="gold">
              ${money(g.stake)} HC
            </b>

          </div>

          <div class="opponents">

            ${players
              .map(
                p => {

                  const op =
                    S.room.players
                      .find(
                        x =>
                          x.id ===
                          p.id
                      ) || {};

                  return `
                    <div class="opponent">

                      <div class="oppAvatar">
                        ${esc(
                          op.initials ||
                          "HL"
                        )}
                      </div>

                      <b>
                        ${esc(
                          op.name ||
                          "Игрок"
                        )}
                      </b>

                      <small>
                        ${p.handCount}
                        карт ·
                        ${
                          p.id ===
                          g.defenderId
                            ? "защита"
                            : "атака"
                        }
                      </small>

                      <small>
                        ${op.wins || 0}W /
                        ${op.losses || 0}L ·
                        ${esc(
                          op.rank?.name ||
                          "Новичок"
                        )}
                      </small>

                      <small>
                        ${
                          esc(
                            op.displayVehicle
                              ?.brand ||
                            ""
                          )
                        }
                        ${
                          esc(
                            op.displayVehicle
                              ?.model ||
                            ""
                          )
                        }
                      </small>

                      <small>
                        ${
                          esc(
                            op.displayProperty
                              ?.name ||
                            ""
                          )
                        }
                      </small>

                    </div>
                  `;

                }
              )
              .join("")}

          </div>

          <div class="table">

            <div class="trump">
              Козырь:
              ${esc(
                g.trumpSuit ||
                "—"
              )}
            </div>

            <div class="deck">
              ${g.deckCount}
            </div>

            <div class="tableCards">
              ${table}
            </div>

          </div>

          <div class="hand">

            ${(g.myHand || [])
              .map(
                c =>
                  card(
                    c,
                    availableA.has(
                      c.id
                    ) ||
                    availableD.has(
                      c.id
                    )
                  )
              )
              .join("")}

          </div>

          <div class="actions">

            ${
              g.canTake
                ? `
                  <button
                    class="danger"
                    id="takeBtn"
                  >
                    ВЗЯТЬ
                  </button>
                `
                : ""
            }

            ${
              g.canEndAttack
                ? `
                  <button
                    class="goldBtn"
                    id="endBtn"
                  >
                    ЗАКОНЧИТЬ АТАКУ
                  </button>
                `
                : ""
            }

          </div>

          <div class="phrases">

            ${(S.catalog.quickPhrases || [])
              .map(
                x =>
                  `
                  <button
                    data-phrase="${esc(x)}"
                  >
                    ${esc(x)}
                  </button>
                  `
              )
              .join("")}

          </div>

        </div>
      `;

    $("gameContent")
      .querySelectorAll(
        "[data-card]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const id =
                b.dataset.card;

              if (
                availableD.has(id)
              ) {

                emit(
                  "defend",
                  {
                    cardId: id
                  }
                );

              }
              else if (
                availableA.has(id)
              ) {

                emit(
                  "attack",
                  {
                    cardId: id
                  }
                );

              }
              else {

                toast(
                  "Эта карта сейчас недоступна",
                  "error"
                );

              }

            }
      );

    $("takeBtn")
      ?.addEventListener(
        "click",
        () =>
          emit("take")
      );

    $("endBtn")
      ?.addEventListener(
        "click",
        () =>
          emit("end_attack")
      );

    $("gameContent")
      .querySelectorAll(
        "[data-phrase]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              emit(
                "phrase",
                {
                  phrase:
                    b.dataset.phrase
                }
              )
      );

  }


  function result(data) {

    const root =
      $("gameContent");

    root.innerHTML = `
      <div class="result">

        <div class="eyebrow">
          ПАРТИЯ ЗАВЕРШЕНА
        </div>

        <h2>
          ${
            data.win
              ? "ПОБЕДА"
              : "ПАРТИЯ ОКОНЧЕНА"
          }
        </h2>

        <div class="bigMoney">
          +${money(data.payout)} HC
        </div>

        <p class="muted">
          ${data.xp} XP ·
          рейтинг ${data.rating} ·
          ${esc(data.rank.name)}
        </p>

        <div class="grid2">

          <button
            class="primary"
            id="rematch"
          >
            Играть еще
          </button>

          <button
            class="secondary"
            id="exitAfter"
          >
            Выйти из лобби
          </button>

        </div>

      </div>
    `;

    $("rematch").onclick =
      () =>
        emit("rematch");

    $("exitAfter").onclick =
      () => {

        emit(
          "leave_room"
        );

        S.room = null;
        S.game = null;

        show("play");

      };

  }


  function renderProfile() {

    const p =
      S.profile;

    if (!p)
      return;

    const avatar =
      p.avatar
        ? `
          <img
            src="${esc(p.avatar)}"
            alt=""
          >
        `
        : esc(
            p.initials
          );

    $("profileCard")
      .innerHTML = `
        <div class="profileHero">

          <div class="avatar profileAvatar">
            ${avatar}
          </div>

          <div>

            <h3>
              ${esc(p.name)}
            </h3>

            <small>
              ${
                p.username
                  ? "@" +
                    esc(
                      p.username
                    )
                  : "Telegram"
              }
            </small>

            <small
              class="rankColor"
              style="color:${
                esc(
                  p.rank?.color ||
                  "#fff"
                )
              }"
            >
              ${esc(
                p.rank?.name ||
                "Новичок"
              )}
              ·
              ${p.rating}/${
                p.ratingMax ||
                12000
              }
            </small>

            <small>
              Уровень
              ${p.level}/${
                p.maxLevel ||
                1000
              }
              ·
              ${p.xp} XP
            </small>

          </div>

          <strong>
            LVL ${p.level}
          </strong>

        </div>

        <div class="stats">

          <div>
            <b>${p.wins}</b>
            <small>ПОБЕД</small>
          </div>

          <div>
            <b>${p.losses}</b>
            <small>ПОРАЖЕНИЙ</small>
          </div>

          <div>
            <b>${money(p.hc)}</b>
            <small>HC</small>
          </div>

        </div>
      `;

    $("profileFaction")
      .innerHTML =
      p.faction
        ? `
          <div class="cardBox factionMini">

            <div class="eyebrow">
              ФРАКЦИЯ
            </div>

            <h3>
              ${esc(p.faction.name)}
              ·
              ${esc(p.faction.rank)}
            </h3>

            <small class="muted">
              Должность внутри фракции
            </small>

            <button
              class="secondary wide"
              data-view="faction"
            >
              Открыть фракцию
            </button>

          </div>
        `
        :
        `
          <div class="cardBox factionMini">

            <div class="eyebrow">
              ФРАКЦИЯ
            </div>

            <h3>
              Нет членства
            </h3>

            <small class="muted">
              Вступление и должность
              назначаются администрацией.
            </small>

          </div>
        `;

    $("profileFaction")
      .querySelector(
        "[data-view]"
      )
      ?.addEventListener(
        "click",
        () =>
          show("faction")
      );

    renderPossessions();

  }


  function renderPossessions() {

    const p =
      S.profile;

    const root =
      $("possessions");

    const map = {

      cars:
        () => p.garage,

      plates:
        () => p.plates,

      property:
        () => p.properties,

      business:
        () => p.businesses

    };

    const data =
      map[S.tab]?.() || [];

    root.innerHTML =
      data.length
        ? data
            .map(
              x => {

                if (
                  S.tab ===
                  "cars"
                ) {

                  return `
                    <div class="listItem">

                      <div class="row">

                        <div>

                          <b>
                            ${esc(
                              x.brand
                            )}
                            ${esc(
                              x.model
                            )}
                          </b>

                          <small class="muted">
                            ${
                              x.tuning
                                ? esc(
                                    x.tuning
                                  ) +
                                  " · "
                                : ""
                            }
                            ${
                              x.plateId
                                ? esc(
                                    (
                                      p.plates
                                        .find(
                                          q =>
                                            q.id ===
                                            x.plateId
                                        )?.plate
                                    ) ||
                                    "№"
                                  )
                                : "без номера"
                            }
                          </small>

                        </div>

                        <div class="garageActions">

                          <button
                            class="smallBtn"
                            data-3d-car="${x.id}"
                          >
                            3D
                          </button>

                          <button
                            class="smallBtn"
                            data-display-car="${x.id}"
                          >
                            ${
                              p.displayVehicle ===
                              x.id
                                ? "Закреплено"
                                : "Закрепить"
                            }
                          </button>

                        </div>

                      </div>

                    </div>
                  `;

                }

                if (
                  S.tab ===
                  "plates"
                ) {

                  return `
                    <div class="listItem">

                      <div class="row">

                        <div>
                          <b>
                            ${esc(
                              x.plate
                            )}
                          </b>

                          <small class="muted">
                            ${
                              x.beautiful
                                ? "Красивый номер"
                                : "Обычный номер"
                            }
                          </small>
                        </div>

                        <button
                          class="smallBtn"
                          data-sell-plate="${x.id}"
                        >
                          Продать
                        </button>

                      </div>

                    </div>
                  `;

                }

                if (
                  S.tab ===
                  "property"
                ) {

                  return `
                    <div class="listItem">

                      <div class="row">

                        <div>
                          <b>
                            ${esc(
                              x.name
                            )}
                          </b>

                          <small class="muted">
                            ${esc(
                              x.tier
                            )}
                          </small>
                        </div>

                        <button
                          class="smallBtn"
                          data-display-property="${x.id}"
                        >
                          ${
                            p.displayProperty ===
                            x.id
                              ? "Отображается"
                              : "Показать"
                          }
                        </button>

                      </div>

                    </div>
                  `;

                }

                return `
                  <div class="listItem">

                    <b>
                      ${esc(x.name)}
                    </b>

                    <small class="muted">
                      ${money(x.price)}
                      HC
                    </small>

                  </div>
                `;

              }
            )
            .join("")
        :
          `
            <div class="empty">
              Коллекция пока пуста.
            </div>
          `;

    root
      .querySelectorAll(
        "[data-3d-car]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const vehicle =
                p.garage.find(
                  x =>
                    String(x.id) ===
                    String(
                      b.dataset
                        .threeDCar
                    )
                );

              if (!vehicle)
                return;

              window.openHeavyLux3DShowroom(
                vehicle
              );

            }
      );

    root
      .querySelectorAll(
        "[data-display-car]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              emit(
                "set_display",
                {
                  vehicleId:
                    b.dataset
                      .displayCar
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Автомобиль закреплён"
                    );

                    renderPossessions();

                  }

                }
              )
      );

    root
      .querySelectorAll(
        "[data-display-property]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              emit(
                "set_display",
                {
                  propertyId:
                    b.dataset
                      .displayProperty
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Недвижимость отображается в профиле"
                    );

                    renderPossessions();

                  }

                }
              )
      );

    root
      .querySelectorAll(
        "[data-sell-plate]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const price =
                prompt(
                  "Цена продажи номера в HC"
                );

              if (!price)
                return;

              emit(
                "market_list",
                {
                  assetType:
                    "plate",
                  assetId:
                    b.dataset
                      .sellPlate,
                  price:
                    Number(price)
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Номер выставлен на вторичный рынок"
                    );

                    renderPossessions();

                  }

                }
              );

            }
      );

  }


  function renderGarage() {

    const p =
      S.profile;

    $("garageContent")
      .innerHTML =
      p.garage.length
        ? p.garage
            .map(
              v =>
                `
                <div class="cardBox">

                  <div class="row">

                    <div>

                      <b>
                        ${esc(v.brand)}
                        ${esc(v.model)}
                      </b>

                      <small class="muted">
                        ${
                          v.tuning
                            ? esc(v.tuning) +
                              " · "
                            : ""
                        }
                        номер:
                        ${esc(
                          p.plates.find(
                            x =>
                              x.id ===
                              v.plateId
                          )?.plate ||
                          "—"
                        )}
                      </small>

                    </div>

                    <span class="price">
                      ${money(v.price)}
                    </span>

                  </div>

                  <div class="phrases">

                    <button
                      class="smallBtn"
                      data-3d-garage="${v.id}"
                    >
                      ◈ 3D
                    </button>

                    <button
                      class="smallBtn"
                      data-install="${v.id}"
                    >
                      Установить другой номер
                    </button>

                    <button
                      class="smallBtn"
                      data-car-display="${v.id}"
                    >
                      ${
                        p.displayVehicle ===
                        v.id
                          ? "Закреплено"
                          : "Закрепить в профиле"
                      }
                    </button>

                    <button
                      class="smallBtn"
                      data-sell="${v.id}"
                    >
                      Продать
                    </button>

                    <button
                      class="smallBtn"
                      data-auction-sell="${v.id}"
                    >
                      Аукцион
                    </button>

                  </div>

                </div>
                `
            )
            .join("")
        :
          `
            <div class="empty">
              У вас пока нет автомобилей.
              Купите первый в Heavy Motors.
            </div>
          `;

    $("garageContent")
      .querySelectorAll(
        "[data-3d-garage]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const vehicle =
                p.garage.find(
                  x =>
                    String(x.id) ===
                    String(
                      b.dataset
                        .threeDGarage
                    )
                );

              if (!vehicle)
                return;

              window.openHeavyLux3DShowroom(
                vehicle
              );

            }
      );

    $("garageContent")
      .querySelectorAll(
        "[data-car-display]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              emit(
                "set_display",
                {
                  vehicleId:
                    b.dataset
                      .carDisplay
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Автомобиль закреплён"
                    );

                    renderGarage();

                  }

                }
              )
      );

    $("garageContent")
      .querySelectorAll(
        "[data-install]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const choices =
                p.plates
                  .map(
                    x =>
                      `
                      <button
                        data-p="${x.id}"
                        class="wide"
                      >
                        ${esc(x.plate)}
                        ·
                        ${
                          x.beautiful
                            ? "красивый"
                            : "обычный"
                        }
                      </button>
                      `
                  )
                  .join("");

              const m =
                modal(
                  "Установить номер",
                  choices ||
                  `
                    <div class="empty">
                      Номеров нет.
                    </div>
                  `
                );

              m.querySelectorAll(
                "[data-p]"
              )
              .forEach(
                x =>
                  x.onclick =
                    () =>
                      emit(
                        "install_plate",
                        {
                          vehicleId:
                            b.dataset
                              .install,
                          plateId:
                            x.dataset.p
                        },
                        r => {

                          if (r?.ok) {

                            m.remove();

                            toast(
                              "Номер установлен"
                            );

                            renderGarage();

                          }

                        }
                      )
              );

            }
      );

    $("garageContent")
      .querySelectorAll(
        "[data-sell]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const price =
                prompt(
                  "Цена продажи автомобиля в HC"
                );

              if (!price)
                return;

              emit(
                "market_list",
                {
                  assetType:
                    "vehicle",
                  assetId:
                    b.dataset.sell,
                  price:
                    Number(price)
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Автомобиль выставлен на вторичный рынок"
                    );

                    renderGarage();

                  }

                }
              );

            }
      );

    $("garageContent")
      .querySelectorAll(
        "[data-auction-sell]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const price =
                prompt(
                  "Стартовая цена аукциона в HC"
                );

              if (!price)
                return;

              emit(
                "auction_create",
                {
                  assetType:
                    "vehicle",
                  assetId:
                    b.dataset
                      .auctionSell,
                  startPrice:
                    Number(price),
                  duration:
                    300
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Автомобиль выставлен на аукцион"
                    );

                    renderGarage();

                  }

                }
              );

            }
      );

  }


  function renderMenu() {

    const c =
      $("menuContent");

    c.innerHTML = "";

    $("adminMenuItem")
      ?.classList.toggle(
        "hidden",
        !S.profile?.isAdmin
      );

  }


  function renderAdmin() {

    if (!S.profile?.isAdmin) {

      show("menu");

      return;

    }

    const root =
      $("adminContent");

    root.innerHTML = `

      <div class="cardBox">

        <p class="adminHint">
          Администратор:
          Telegram ID
          <b>
            ${esc(S.profile.id)}
          </b>
        </p>

        <div class="adminForm">

          <label>
            Telegram ID игрока

            <input
              id="adminTargetId"
              inputmode="numeric"
            >
          </label>

          <button
            class="secondary wide"
            id="adminLoad"
          >
            Найти игрока
          </button>

        </div>

        <div id="adminPlayer"></div>

      </div>

    `;

    $("adminLoad")
      .onclick =
      () => {

        const id =
          $("adminTargetId")
            .value
            .trim();

        if (
          !/^\d+$/.test(id)
        ) {

          return toast(
            "Введите корректный Telegram ID",
            "error"
          );

        }

        emit(
          "admin_get",
          {
            telegramId:
              id
          },
          r => {

            if (r?.ok)
              renderAdminPlayer(
                r.player
              );

          }
        );

      };

  }


  function renderAdminPlayer(p) {

    const root =
      $("adminPlayer");

    root.innerHTML = `

      <div class="adminPlayer">

        <div class="row">

          <div>

            <b>
              ${esc(
                p.name ||
                "Игрок"
              )}
            </b>

            <small class="muted">
              Telegram ID:
              ${esc(p.id)}
            </small>

          </div>

          <span class="gold">
            ${esc(
              p.rank?.name ||
              "Новичок"
            )}
          </span>

        </div>

        <div class="adminForm">

          <label>
            Уровень (1–1000)

            <input
              id="adminLevel"
              type="number"
              min="1"
              max="1000"
              value="${p.level}"
            >
          </label>

          <label>
            Рейтинг

            <input
              id="adminRating"
              type="number"
              min="0"
              max="12000"
              value="${p.rating}"
            >
          </label>

          <label>
            Ранг

            <select
              id="adminRank"
            >

              ${(S.catalog.ranks || [])
                .map(
                  r =>
                    `
                    <option
                      value="${esc(r.name)}"
                      ${
                        p.rank?.name ===
                        r.name
                          ? "selected"
                          : ""
                      }
                    >
                      ${esc(r.name)}
                      ·
                      ${r.min}–${r.max}
                    </option>
                    `
                )
                .join("")}

            </select>

          </label>

          <label>
            Деньги HC

            <input
              id="adminHc"
              type="number"
              min="0"
              value="${p.hc}"
            >
          </label>

          <label>
            Фракция

            <select
              id="adminFaction"
            >

              <option value="">
                Без фракции
              </option>

              <option
                value="police"
                ${
                  p.faction?.id ===
                  "police"
                    ? "selected"
                    : ""
                }
              >
                МВД
              </option>

              <option
                value="bandits"
                ${
                  p.faction?.id ===
                  "bandits"
                    ? "selected"
                    : ""
                }
              >
                Бандиты
              </option>

            </select>

          </label>

          <label>
            Должность

            <input
              id="adminFactionRank"
              type="number"
              min="0"
              max="7"
              value="${
                p.faction
                  ?.rankIndex ??
                0
              }"
            >
          </label>

          <button
            class="primary wide"
            id="adminSave"
          >
            Сохранить изменения
          </button>

        </div>

      </div>

    `;

    $("adminSave")
      .onclick =
      () => {

        const level =
          Number(
            $("adminLevel")
              .value
          );

        const rating =
          Number(
            $("adminRating")
              .value
          );

        const rankName =
          $("adminRank")
            .value;

        const hc =
          Number(
            $("adminHc")
              .value
          );

        const faction =
          $("adminFaction")
            .value ||
          null;

        const factionRank =
          Number(
            $("adminFactionRank")
              .value
          );

        if (
          !Number.isInteger(
            level
          ) ||
          level < 1 ||
          level > 1000 ||
          !Number.isInteger(
            rating
          ) ||
          rating < 0 ||
          !Number.isInteger(
            hc
          ) ||
          hc < 0
        ) {

          return toast(
            "Проверьте значения",
            "error"
          );

        }

        emit(
          "admin_set_player",
          {
            telegramId:
              p.id,
            level,
            rating,
            rankName,
            hc,
            faction,
            factionRank
          },
          r => {

            if (r?.ok) {

              renderAdminPlayer(
                r.player
              );

              toast(
                "Профиль игрока обновлён"
              );

            }

          }
        );

      };

  }


  function renderFaction() {

    const root =
      $("factionContent");

    const p =
      S.profile;

    if (!p?.faction) {

      root.innerHTML = `
        <div class="cardBox">

          <h3>
            Нет фракции
          </h3>

          <p class="muted">
            Членство и должность
            назначаются администратором.
          </p>

        </div>
      `;

      return;

    }

    const f =
      p.faction;

    const t =
      p.factionTask;

    root.innerHTML = `

      <div class="cardBox factionHero">

        <div class="eyebrow">
          ${esc(f.name)}
        </div>

        <h2>
          ${esc(f.rank)}
        </h2>

        <p class="muted">
          Должность №
          ${f.rankIndex + 1}
          ·
          ${esc(f.name)}
        </p>

      </div>

      <div class="cardBox">

        <div class="sectionHead">

          <h3>
            Задание
          </h3>

          <span class="price">
            +${money(t?.reward)} HC
          </span>

        </div>

        <b>
          ${esc(
            t?.name ||
            "Нет задания"
          )}
        </b>

        <small class="muted">
          Следующее выполнение:
          ${
            t?.remainingMs
              ? formatCooldown(
                  t.remainingMs
                )
              : "доступно сейчас"
          }
        </small>

        <button
          id="claimFactionTask"
          class="primary wide"
          ${
            t?.canClaim
              ? ""
              : "disabled"
          }
        >
          ${
            t?.canClaim
              ? "Выполнить"
              : "На перезарядке"
          }
        </button>

      </div>

      <div class="cardBox">

        <div class="sectionHead">

          <h3>
            Чат фракции
          </h3>

          <small>
            до 500 сообщений
          </small>

        </div>

        <div
          id="factionChat"
          class="factionChat"
        ></div>

        <div class="chatSend">

          <input
            id="factionInput"
            maxlength="300"
            placeholder="Сообщение..."
          >

          <button
            class="primary"
            id="factionSend"
          >
            ➤
          </button>

        </div>

      </div>

    `;

    $("claimFactionTask")
      .onclick =
      () =>
        emit(
          "faction_task_claim",
          r => {

            if (r?.ok) {

              toast(
                `+${money(r.reward)} HC`
              );

              renderFaction();

            }

          }
        );

    $("factionSend")
      .onclick =
      sendFactionMessage;

    $("factionInput")
      .onkeydown =
      e => {

        if (
          e.key ===
          "Enter"
        )
          sendFactionMessage();

      };

    emit(
      "faction_get",
      r => {

        if (r?.ok)
          renderFactionChat(
            r.messages || []
          );

      }
    );

  }


  function formatCooldown(ms) {

    const total =
      Math.ceil(
        ms / 1000
      );

    const h =
      Math.floor(
        total / 3600
      );

    const m =
      Math.floor(
        (total % 3600) /
        60
      );

    const s =
      total % 60;

    return h
      ? `${h} ч ${m} мин`
      : m
        ? `${m} мин`
        : `${s} сек`;

  }


  function renderFactionChat(
    messages
  ) {

    const root =
      $("factionChat");

    if (!root)
      return;

    root.innerHTML =
      messages.length
        ? messages
            .map(
              m =>
                `
                <div class="chatMsg">

                  <b>
                    ${esc(
                      m.playerName
                    )}
                  </b>

                  <small>
                    ${
                      new Date(
                        m.createdAt
                      ).toLocaleTimeString(
                        "ru-RU",
                        {
                          hour:
                            "2-digit",
                          minute:
                            "2-digit"
                        }
                      )
                    }
                  </small>

                  <p>
                    ${esc(
                      m.message
                    )}
                  </p>

                </div>
                `
            )
            .join("")
        :
          `
            <div class="empty">
              В чате пока нет сообщений.
            </div>
          `;

    root.scrollTop =
      root.scrollHeight;

  }


  function sendFactionMessage() {

    const input =
      $("factionInput");

    if (
      !input ||
      !input.value.trim()
    )
      return;

    const message =
      input.value.trim();

    emit(
      "faction_chat_send",
      {
        message
      },
      r => {

        if (r?.ok)
          input.value = "";

      }
    );

  }


  function shop(
    title,
    items,
    kind
  ) {

    const m =
      modal(
        title,

        items
          .map(
            x => {

              const price =
                x.price;

              const extra =
                kind === "car"
                  ? `${x.brand} ${x.model}${
                      x.tuning
                        ? ` · ${x.tuning}`
                        : ""
                    }`
                  : kind ===
                    "property"
                    ? `${x.name} · ${x.tier}`
                    : kind ===
                      "business"
                      ? `${x.name} · максимум 3`
                      : x.plate;

              return `
                <div class="shopItem">

                  <div>

                    <h3>
                      ${esc(extra)}
                    </h3>

                    <p>
                      ${money(price)} HC
                    </p>

                  </div>

                  <button
                    class="buy"
                    data-buy="${x.id}"
                  >
                    ${
                      kind ===
                      "car"
                        ? "3D / Купить"
                        : "Купить"
                    }
                  </button>

                </div>
              `;

            }
          )
          .join("")
      );

    m.querySelectorAll(
      "[data-buy]"
    )
    .forEach(
      b =>
        b.onclick =
          () => {

            const id =
              b.dataset.buy;

            /*
             * Для автомобиля сначала
             * показываем 3D.
             */

            if (
              kind ===
              "car"
            ) {

              const vehicle =
                items.find(
                  x =>
                    String(x.id) ===
                    String(id)
                );

              if (
                vehicle &&
                window.openHeavyLux3DShowroom
              ) {

                window.openHeavyLux3DShowroom(
                  vehicle
                );

                return;

              }

            }

            const event =
              kind === "car"
                ? "buy_vehicle"
                : kind === "property"
                  ? "buy_property"
                  : kind === "business"
                    ? "buy_business"
                    : "buy_plate";

            const data =
              kind === "car"
                ? {
                    catalogId:
                      id,
                    exclusive:
                      title.includes(
                        "Exclusive"
                      )
                  }
                :
                kind === "plate"
                  ? {
                      plateId:
                        id
                    }
                  :
                    {
                      catalogId:
                        id
                    };

            emit(
              event,
              data,
              r => {

                if (r?.ok) {

                  toast(
                    "Покупка завершена"
                  );

                  m.remove();

                }

              }
            );

          }
    );

  }


  function openMarket() {

    const m =
      modal(
        "Вторичный рынок Т/С",
        `
          <div id="marketBody"></div>
        `
      );

    renderMarket(
      m.querySelector(
        "#marketBody"
      )
    );

  }


  function renderMarket(
    root
  ) {

    const l =
      S.market.listings;

    root.innerHTML =
      l.length
        ? l
            .map(
              x =>
                `
                <div class="shopItem">

                  <div>

                    <h3>
                      ${
                        esc(
                          x.assetType ===
                          "plate"
                            ? getPlate(
                                x.assetId
                              )
                            : "Автомобиль"
                        )
                      }
                    </h3>

                    <p>
                      Продавец:
                      ${esc(
                        x.sellerName
                      )}
                    </p>

                  </div>

                  <div>

                    <span class="price">
                      ${money(x.price)} HC
                    </span>

                    <button
                      class="buy"
                      data-market="${x.id}"
                    >
                      Купить
                    </button>

                  </div>

                </div>
                `
            )
            .join("")
        :
          `
            <div class="empty">
              Объявлений пока нет.
            </div>
          `;

    root.querySelectorAll(
      "[data-market]"
    )
    .forEach(
      b =>
        b.onclick =
          () =>
            emit(
              "market_buy",
              {
                listingId:
                  b.dataset.market
              },
              r => {

                if (r?.ok) {

                  toast(
                    "Покупка на рынке завершена"
                  );

                  renderMarket(
                    root
                  );

                }

              }
            )
    );

  }


  function getPlate(id) {

    return (
      S.profile?.plates.find(
        x =>
          x.id === id
      )?.plate ||
      id
    );

  }


  function openAuction() {

    const m =
      modal(
        "Аукцион",
        `
          <div id="auctionBody"></div>
        `
      );

    renderAuction(
      m.querySelector(
        "#auctionBody"
      )
    );

  }


  function renderAuction(
    root
  ) {

    const a =
      S.market.auctions;

    root.innerHTML =
      a.length
        ? a
            .map(
              x =>
                `
                <div class="shopItem">

                  <div>

                    <h3>
                      ${
                        esc(
                          x.assetType ===
                          "plate"
                            ? getPlate(
                                x.assetId
                              )
                            : "Автомобиль"
                        )
                      }
                    </h3>

                    <p>
                      до
                      ${
                        new Date(
                          x.endsAt
                        ).toLocaleTimeString(
                          "ru-RU",
                          {
                            hour:
                              "2-digit",
                            minute:
                              "2-digit"
                          }
                        )
                      }

                      · текущая
                      ${money(
                        x.highestBid ||
                        x.startPrice
                      )}
                      HC
                    </p>

                  </div>

                  <button
                    class="buy"
                    data-auction="${x.id}"
                  >
                    Сделать ставку
                  </button>

                </div>
                `
            )
            .join("")
        :
          `
            <div class="empty">
              Активных аукционов нет.
            </div>
          `;

    root
      .querySelectorAll(
        "[data-auction]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              const amount =
                prompt(
                  "Введите сумму ставки HC"
                );

              if (!amount)
                return;

              emit(
                "auction_bid",
                {
                  auctionId:
                    b.dataset.auction,
                  bid:
                    Number(amount)
                },
                r => {

                  if (r?.ok) {

                    toast(
                      "Ставка принята"
                    );

                    renderAuction(
                      root
                    );

                  }

                }
              );

            }
      );

  }


  function wire() {

    document
      .querySelectorAll(
        "[data-view]"
      )
      .forEach(
        b =>
          b.onclick =
            () =>
              show(
                b.dataset.view
              )
      );

    $("createBtn")
      .onclick =
      openCreate;

    $("findBtn")
      .onclick =
      openFind;

    $("activeBtn")
      .onclick =
      openFind;

    $("topProfile")
      .onclick =
      () =>
        show("profile");

    $("topMenu")
      .onclick =
      () =>
        show("menu");

    $("profileSettings")
      .onclick =
      () =>
        toast(
          "Настройки Telegram-профиля управляются Telegram"
        );

    document
      .querySelectorAll(
        "[data-tab]"
      )
      .forEach(
        b =>
          b.onclick =
            () => {

              document
                .querySelectorAll(
                  "[data-tab]"
                )
                .forEach(
                  x =>
                    x.classList.remove(
                      "active"
                    )
                );

              b.classList.add(
                "active"
              );

              S.tab =
                b.dataset.tab;

              renderPossessions();

            }
      );

    document
      .querySelector(
        '[data-tab="cars"]'
      )
      ?.classList.add(
        "active"
      );

    $("leaveRoom")
      .onclick =
      () =>
        emit(
          "leave_room",
          r => {

            if (r?.ok) {

              S.room = null;

              show("play");

            }

          }
        );

    $("showShowrooms")
      .onclick =
      () => {

        const m =
          modal(
            "Автосалоны",

            `
              <div class="grid2">

                <button
                  class="primary big"
                  id="motorsChoice"
                >
                  Heavy Motors
                  <br>
                  <small>
                    ${(
                      S.catalog.vehicles ||
                      []
                    ).length}
                    автомобилей
                  </small>
                </button>

                <button
                  class="secondary big"
                  id="exclusiveChoice"
                >
                  Heavy Exclusive
                  <br>
                  <small>
                    Премиум · гиперкары
                  </small>
                </button>

              </div>
            `
          );

        m.querySelector(
          "#motorsChoice"
        ).onclick =
          () => {

            m.remove();

            shop(
              "Heavy Motors",
              S.catalog.vehicles ||
              [],
              "car"
            );

          };

        m.querySelector(
          "#exclusiveChoice"
        ).onclick =
          () => {

            m.remove();

            shop(
              "Heavy Exclusive",
              S.catalog.exclusive ||
              [],
              "car"
            );

          };

      };

    $("showProperty")
      .onclick =
      () =>
        shop(
          "Недвижимость",
          S.catalog.property ||
          [],
          "property"
        );

    $("showBusiness")
      .onclick =
      () =>
        shop(
          "Бизнес",
          S.catalog.businesses ||
          [],
          "business"
        );

    $("showPlates")
      .onclick =
      () =>
        shop(
          "Приобрести номер на Т/С",
          S.catalog.beautifulNumbers ||
          [],
          "plate"
        );

    $("showMarket")
      .onclick =
      openMarket;

    $("showAuction")
      .onclick =
      openAuction;

    $("openAdmin")
      ?.addEventListener(
        "click",
        () =>
          show("admin")
      );

  }


  function connect() {

    const auth =
      tg();

    S.socket =
      io({
        auth,
        transports: [
          "websocket",
          "polling"
        ],
        reconnection: true,
        reconnectionAttempts:
          Infinity,
        reconnectionDelay:
          500
      });

    S.socket.on(
      "connect",
      () => {

        toast(
          "Соединение установлено"
        );

        S.socket.emit(
          "refresh"
        );

      }
    );

    S.socket.on(
      "connect_error",
      e =>
        toast(
          e.message ||
          "Ошибка соединения",
          "error"
        )
    );

    S.socket.on(
      "profile",
      p => {

        S.profile =
          p;

        profileHeader();

        if (
          S.view ===
          "profile"
        )
          renderProfile();

        if (
          S.view ===
          "garage"
        )
          renderGarage();

        if (
          S.view ===
          "menu"
        )
          renderMenu();

        if (
          S.view ===
          "admin"
        )
          renderAdmin();

        if (
          S.view ===
          "faction"
        )
          renderFaction();

      }
    );

    S.socket.on(
      "catalog",
      c => {

        S.catalog =
          c;

      }
    );

    S.socket.on(
      "rooms",
      rooms => {

        S.rooms =
          rooms;

      }
    );

    S.socket.on(
      "room_state",
      r => {

        S.room =
          r;

        show(
          r.status ===
          "PLAYING"
            ? "game"
            : "room"
        );

      }
    );

    S.socket.on(
      "game_state",
      g => {

        S.game =
          g;

        if (
          g.status ===
          "FINISHED"
        )
          return;

        show("game");

      }
    );

    S.socket.on(
      "match_result",
      d => {

        S.game = {
          status:
            "FINISHED"
        };

        result(d);

      }
    );

    S.socket.on(
      "market",
      m => {

        S.market =
          m;

      }
    );

    S.socket.on(
      "faction_chat_message",
      m => {

        const root =
          $("factionChat");

        if (!root)
          return;

        const msg =
          document.createElement(
            "div"
          );

        msg.className =
          "chatMsg";

        msg.innerHTML = `
          <b>
            ${esc(
              m.playerName
            )}
          </b>

          <small>
            сейчас
          </small>

          <p>
            ${esc(
              m.message
            )}
          </p>
        `;

        root.appendChild(
          msg
        );

        root.scrollTop =
          root.scrollHeight;

      }
    );

    S.socket.on(
      "phrase",
      x =>
        toast(
          `${
            S.room?.players.find(
              p =>
                p.id ===
                x.playerId
            )?.name ||
            "Игрок"
          }: ${x.phrase}`
        )
    );

    S.socket.on(
      "toast",
      x =>
        toast(
          x.message,
          x.type
        )
    );

  }


  async function boot() {

    wire();

    const auth =
      tg();

    if (
      window.Telegram?.WebApp
    )
      window.Telegram.WebApp.expand();

    connect();

    setTimeout(
      () => {

        $("loading")
          .classList
          .add("hidden");

        $("main")
          .classList
          .remove("hidden");

      },
      400
    );

  }


  boot();

})();
