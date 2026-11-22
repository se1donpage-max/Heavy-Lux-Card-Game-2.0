
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, RefreshCw, Shield, Trophy } from "lucide-react";

export interface K7RosterPlayer {
  id: string;
  telegram_id: number;
  slot: string;
  game_role: string;
  in_game_id: string | null;
  is_captain: boolean;
  joined_at: string;
  profiles: {
    first_name: string;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
  } | null;
}

type PanelProps = { authReady: boolean; canManage?: boolean };

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  status: "UPCOMING" | "COMPLETED" | "CANCELLED";
  event_format: string | null;
  poster_url: string | null;
  result: string | null;
};

type NewsRecord = {
  id: string;
  title: string;
  content: string;
  cover_url: string | null;
  published_at: string;
};

type PlayerStats = {
  telegramId: number;
  name: string;
  slot: string | null;
  matches: number;
  wins: number;
  kills: number;
  winRate: number;
  killsPerMatch: number;
};

type StatsData = {
  team: {
    matches: number;
    wins: number;
    kills: number;
    winRate: number;
  };
  rankings: {
    overall: PlayerStats[];
    main: PlayerStats[];
    sub: PlayerStats[];
  };
  recentMatches: {
    id: string;
    title: string;
    played_at: string;
    placement: number;
  }[];
};

type Member = {
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function getName(player: K7RosterPlayer) {
  const profile = player.profiles;

  return profile?.username
    ? `@${profile.username}`
    : [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ") || `ID ${player.telegram_id}`;
}

function SectionState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="k7-panel-empty" role="status">
      <span>{message}</span>

      {retry && (
        <button
          type="button"
          className="k7-panel-button"
          onClick={retry}
        >
          ПОВТОРИТЬ
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  onRefresh,
  busy,
}: {
  eyebrow: string;
  title: string;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <div className="k7-panel-head">
      <div>
        <div className="k7-panel-eyebrow">{eyebrow}</div>
        <h2>
          {title}
          <span>.</span>
        </h2>
      </div>

      <button
        type="button"
        className="k7-panel-icon"
        onClick={onRefresh}
        disabled={busy}
        aria-label="Обновить данные"
      >
        <RefreshCw size={17} />
      </button>
    </div>
  );
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });

  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(
      result.error || `Ошибка запроса (${response.status})`
    );
  }

  return result;
}

export function EventsPanel({
  authReady,
  canManage = false,
}: PanelProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filter, setFilter] = useState<
    "UPCOMING" | "COMPLETED"
  >("UPCOMING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [eventFormat, setEventFormat] = useState("");
  const [posterUrl, setPosterUrl] = useState("");

  const reload = useCallback(async () => {
    if (!authReady) return;

    setLoading(true);

    try {
      const response = await requestJson("/api/events");
      setEvents(response.events ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить события"
      );
    } finally {
      setLoading(false);
    }
  }, [authReady]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !date) return;

    setSaving(true);

    try {
      await requestJson("/api/events", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title: title.trim(),
          eventDate: new Date(date).toISOString(),
          description,
          eventFormat,
          ...(posterUrl.trim()
            ? { posterUrl: posterUrl.trim() }
            : {}),
        }),
      });

      setTitle("");
      setDate("");
      setDescription("");
      setEventFormat("");
      setPosterUrl("");
      setShowForm(false);
      setEditingId(null);
      setFilter("UPCOMING");

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить событие"
      );
    } finally {
      setSaving(false);
    }
  }

  const visible = events
    .filter((item) => item.status === filter)
    .sort((a, b) =>
      filter === "UPCOMING"
        ? Date.parse(a.event_date) - Date.parse(b.event_date)
        : Date.parse(b.event_date) - Date.parse(a.event_date)
    );

  return (
    <div className="k7-data-panel">
      <SectionHeader
        eyebrow="K7 / COMPETITION"
        title="THE EVENTS"
        onRefresh={() => void reload()}
        busy={!authReady || loading}
      />

      <div className="k7-panel-toolbar">
        <div
          className="k7-panel-tabs"
          role="group"
          aria-label="Статус мероприятий"
        >
          <button
            type="button"
            className={
              filter === "UPCOMING" ? "selected" : ""
            }
            onClick={() => setFilter("UPCOMING")}
          >
            ПРЕДСТОЯЩИЕ
          </button>

          <button
            type="button"
            className={
              filter === "COMPLETED" ? "selected" : ""
            }
            onClick={() => setFilter("COMPLETED")}
          >
            ЗАВЕРШЁННЫЕ
          </button>
        </div>

        {canManage && (
          <button
            type="button"
            className="k7-panel-button"
            onClick={() => { setEditingId(null); setTitle(""); setDate(""); setDescription(""); setEventFormat(""); setPosterUrl(""); setShowForm((value) => !value); }}
          >
            {showForm ? "ЗАКРЫТЬ" : "+ СОБЫТИЕ"}
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form
          className="k7-panel-form"
          onSubmit={(event) => void createEvent(event)}
        >
          <label>
            Название
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <label>
            Дата и время
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
            />
          </label>

          <label>
            Формат
            <input
              maxLength={100}
              value={eventFormat}
              onChange={(event) =>
                setEventFormat(event.target.value)
              }
            />
          </label>

          <label>
            Постер (HTTPS)
            <input
              type="url"
              placeholder="https://..."
              value={posterUrl}
              onChange={(event) =>
                setPosterUrl(event.target.value)
              }
            />
          </label>

          <label className="k7-panel-wide">
            Описание
            <textarea
              maxLength={5000}
              rows={3}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
            />
          </label>

          <button
            className="k7-panel-button k7-panel-primary"
            disabled={saving}
          >
            {saving
              ? "СОХРАНЕНИЕ..."
              : editingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "ОПУБЛИКОВАТЬ"}
          </button>
        </form>
      )}

      {!authReady ? (
        <SectionState message="Войдите через Telegram" />
      ) : loading && !events.length ? (
        <SectionState message="ЗАГРУЗКА СОБЫТИЙ..." />
      ) : error && !events.length ? (
        <SectionState
          message={error}
          retry={() => void reload()}
        />
      ) : (
        <>
          {error && (
            <div className="k7-panel-error" role="alert">
              {error}
            </div>
          )}

          {visible.length === 0 ? (
            <SectionState
              message={
                filter === "UPCOMING"
                  ? "Пока нет запланированных мероприятий"
                  : "Пока нет завершённых мероприятий"
              }
            />
          ) : (
            <div className="k7-panel-cards">
              {visible.map((item) => (
                <article
                  key={item.id}
                  className="k7-panel-card"
                >
                  {item.poster_url && (
                    <img
                      src={item.poster_url}
                      alt="Постер мероприятия"
                      loading="lazy"
                      className="k7-panel-cover"
                    />
                  )}

                  <div className="k7-panel-date">
                    <CalendarDays size={13} />
                    {formatDate(item.event_date)}
                  </div>

                  <h3>{item.title}</h3>

                  {item.event_format && (
                    <div className="k7-panel-tag">
                      {item.event_format}
                    </div>
                  )}

                  {item.description && (
                    <p className="k7-panel-preserve">
                      {item.description}
                    </p>
                  )}

                  {item.result && (
                    <p className="k7-panel-muted">
                      {item.result}
                    </p>
                  )}

                  {canManage && (
                    <div className="k7-panel-card-actions">
                      <button type="button" className="k7-panel-button" onClick={() => {
                        setEditingId(item.id); setTitle(item.title); setDate(toLocalDateTime(item.event_date));
                        setDescription(item.description ?? ""); setEventFormat(item.event_format ?? "");
                        setPosterUrl(item.poster_url ?? ""); setShowForm(true);
                      }}>РЕДАКТИРОВАТЬ</button>
                      <button type="button" className="k7-panel-button" onClick={() => {
                        if (!window.confirm(`Удалить событие «${item.title}»?`)) return;
                        void (async () => { try {
                          await requestJson("/api/events", {method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:item.id})});
                          await reload();
                        } catch(err) { setError(err instanceof Error ? err.message : "Не удалось удалить событие"); } })();
                      }}>УДАЛИТЬ</button>
                    </div>
                  )}
                  {canManage &&
                    filter === "UPCOMING" && (
                      <div className="k7-panel-card-actions">
                        <button
                          type="button"
                          className="k7-panel-button"
                          onClick={() => {
                            void (async () => {
                              try {
                                await requestJson(
                                  "/api/events",
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type":
                                        "application/json",
                                    },
                                    body: JSON.stringify({
                                      id: item.id,
                                      status: "COMPLETED",
                                    }),
                                  }
                                );

                                await reload();
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Не удалось завершить событие"
                                );
                              }
                            })();
                          }}
                        >
                          ЗАВЕРШИТЬ
                        </button>
                      </div>
                    )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function NewsPanel({
  authReady,
  canManage = false,
}: PanelProps) {
  const [news, setNews] = useState<NewsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const reload = useCallback(async () => {
    if (!authReady) return;

    setLoading(true);

    try {
      const result = await requestJson("/api/news");
      setNews(result.news ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить новости"
      );
    } finally {
      setLoading(false);
    }
  }, [authReady]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createNews(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!title.trim() || !content.trim()) return;

    setSaving(true);

    try {
      await requestJson("/api/news", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title: title.trim(),
          content: content.trim(),
          ...(coverUrl.trim()
            ? { coverUrl: coverUrl.trim() }
            : {}),
        }),
      });

      setTitle("");
      setContent("");
      setCoverUrl("");
      setShowForm(false);
      setEditingId(null);

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось опубликовать новость"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="k7-data-panel">
      <SectionHeader
        eyebrow="K7 / BROADCAST"
        title="THE NEWS"
        onRefresh={() => void reload()}
        busy={!authReady || loading}
      />

      {canManage && (
        <div className="k7-panel-toolbar">
          <button
            className="k7-panel-button"
            type="button"
            onClick={() => {
              setEditingId(null); setTitle(""); setContent(""); setCoverUrl("");
              setShowForm((value) => !value);
            }}
          >
            {showForm ? "ЗАКРЫТЬ" : "+ НОВОСТЬ"}
          </button>
        </div>
      )}

      {canManage && showForm && (
        <form
          className="k7-panel-form"
          onSubmit={(event) => void createNews(event)}
        >
          <label>
            Заголовок
            <input
              required
              maxLength={150}
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <label>
            Обложка (HTTPS)
            <input
              type="url"
              placeholder="https://..."
              value={coverUrl}
              onChange={(event) =>
                setCoverUrl(event.target.value)
              }
            />
          </label>

          <label className="k7-panel-wide">
            Текст новости
            <textarea
              required
              maxLength={20000}
              rows={5}
              value={content}
              onChange={(event) =>
                setContent(event.target.value)
              }
            />
          </label>

          <button
            className="k7-panel-button k7-panel-primary"
            disabled={saving}
          >
            {saving
              ? "СОХРАНЕНИЕ..."
              : editingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "ОПУБЛИКОВАТЬ"}
          </button>
        </form>
      )}

      {!authReady ? (
        <SectionState message="Войдите через Telegram" />
      ) : loading && !news.length ? (
        <SectionState message="ЗАГРУЗКА НОВОСТЕЙ..." />
      ) : error && !news.length ? (
        <SectionState
          message={error}
          retry={() => void reload()}
        />
      ) : (
        <>
          {error && (
            <div
              className="k7-panel-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {news.length === 0 ? (
            <SectionState message="Новостей пока нет" />
          ) : (
            <div className="k7-panel-cards">
              {news.map((item) => (
                <article
                  key={item.id}
                  className="k7-panel-card"
                >
                  {item.cover_url && (
                    <img
                      src={item.cover_url}
                      alt="Обложка новости"
                      loading="lazy"
                      className="k7-panel-cover"
                    />
                  )}

                  <div className="k7-panel-date">
                    {formatDate(item.published_at)}
                  </div>

                  <h3>{item.title}</h3>

                  <p className="k7-panel-preserve">
                    {item.content}
                  </p>
                  {canManage && <div className="k7-panel-card-actions">
                    <button type="button" className="k7-panel-button" onClick={() => {
                      setEditingId(item.id); setTitle(item.title); setContent(item.content);
                      setCoverUrl(item.cover_url ?? ""); setShowForm(true);
                    }}>РЕДАКТИРОВАТЬ</button>
                    <button type="button" className="k7-panel-button" onClick={() => {
                      if (!window.confirm(`Удалить новость «${item.title}»?`)) return;
                      void (async () => { try {
                        await requestJson("/api/news", {method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:item.id})});
                        await reload();
                      } catch(err) { setError(err instanceof Error ? err.message : "Не удалось удалить новость"); } })();
                    }}>УДАЛИТЬ</button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function StatsPanel({
  authReady,
  canSubmit,
  roster,
}: {
  authReady: boolean;
  canSubmit: boolean;
  roster: K7RosterPlayer[];
}) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<
    "main" | "sub"
  >("main");
  const [showForm, setShowForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [playedAt, setPlayedAt] = useState("");
  const [placement, setPlacement] = useState("1");
  const [selected, setSelected] = useState<
    Record<number, string>
  >({});

  const reload = useCallback(async () => {
    if (!authReady) return;

    setLoading(true);

    try {
      const result = await requestJson("/api/stats");

      setData({
        team: result.team,
        rankings: result.rankings,
        recentMatches: result.recentMatches,
      });

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить статистику"
      );
    } finally {
      setLoading(false);
    }
  }, [authReady]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createMatch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const players = Object.entries(selected)
      .filter(([, kills]) => kills !== "")
      .map(([telegramId, kills]) => ({
        telegramId: Number(telegramId),
        kills: Number(kills),
      }));

    if (
      !players.length ||
      players.length > 4 ||
      !playedAt ||
      !title.trim()
    ) {
      setError(
        "Выберите от 1 до 4 игроков и укажите дату матча"
      );
      return;
    }

    setSaving(true);

    try {
      await requestJson("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          playedAt: new Date(
            playedAt
          ).toISOString(),
          placement: Number(placement),
          players,
        }),
      });

      setTitle("");
      setPlayedAt("");
      setPlacement("1");
      setSelected({});
      setShowForm(false);

      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось записать результат"
      );
    } finally {
      setSaving(false);
    }
  }

  const ranking = data?.rankings[view] ?? [];

  return (
    <div className="k7-data-panel">
      <SectionHeader
        eyebrow="K7 / PERFORMANCE"
        title="THE STATS"
        onRefresh={() => void reload()}
        busy={!authReady || loading}
      />

      {canSubmit && (
        <div className="k7-panel-toolbar">
          <button
            className="k7-panel-button"
            type="button"
            onClick={() =>
              setShowForm((value) => !value)
            }
          >
            {showForm
              ? "ЗАКРЫТЬ"
              : "+ РЕЗУЛЬТАТ МАТЧА"}
          </button>
        </div>
      )}

      {canSubmit && showForm && (
        <form
          className="k7-panel-form"
          onSubmit={(event) =>
            void createMatch(event)
          }
        >
          <label>
            Название матча
            <input
              required
              maxLength={100}
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <label>
            Дата и время
            <input
              type="datetime-local"
              required
              value={playedAt}
              onChange={(event) =>
                setPlayedAt(event.target.value)
              }
            />
          </label>

          <label>
            Место (1–100)
            <input
              type="number"
              min="1"
              max="100"
              required
              value={placement}
              onChange={(event) =>
                setPlacement(event.target.value)
              }
            />
          </label>

          <div className="k7-panel-wide k7-match-players">
            <strong>
              Участники матча (1–4)
            </strong>

            {roster.map((player) => (
              <label
                key={player.id}
                className="k7-match-player"
              >
                <span>
                  {getName(player)}
                  <small>
                    {player.slot.replace(
                      "_",
                      " "
                    )}
                  </small>
                </span>

                <input
                  aria-label={`Убийства: ${getName(player)}`}
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Kills"
                  value={
                    selected[
                      player.telegram_id
                    ] ?? ""
                  }
                  onChange={(event) =>
                    setSelected(
                      (current) => ({
                        ...current,
                        [player.telegram_id]:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>
            ))}

            <small>
              Укажи количество убийств для каждого
              участвовавшего игрока; пустые поля означают,
              что игрок не участвовал.
            </small>
          </div>

          <button
            className="k7-panel-button k7-panel-primary"
            disabled={saving}
          >
            {saving
              ? "СОХРАНЕНИЕ..."
              : "ЗАПИСАТЬ МАТЧ"}
          </button>
        </form>
      )}

      {!authReady ? (
        <SectionState message="Войдите через Telegram" />
      ) : loading && !data ? (
        <SectionState message="ПОЛУЧЕНИЕ СТАТИСТИКИ..." />
      ) : error && !data ? (
        <SectionState
          message={error}
          retry={() => void reload()}
        />
      ) : (
        <>
          {error && (
            <div
              className="k7-panel-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {data && (
            <>
              <div className="k7-stat-metrics">
                <div>
                  <span>MATCHES</span>
                  <strong>
                    {data.team.matches}
                  </strong>
                </div>

                <div>
                  <span>WINS</span>
                  <strong>
                    {data.team.wins}
                  </strong>
                </div>

                <div>
                  <span>KILLS</span>
                  <strong>
                    {data.team.kills}
                  </strong>
                </div>

                <div>
                  <span>WIN RATE</span>
                  <strong>
                    {data.team.winRate}%
                  </strong>
                </div>
              </div>

              <div className="k7-panel-toolbar">
                <div
                  className="k7-panel-tabs"
                  role="group"
                  aria-label="Таблица игроков"
                >
                  <button
                    type="button"
                    className={
                      view === "main"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setView("main")
                    }
                  >
                    ОСНОВА
                  </button>

                  <button
                    type="button"
                    className={
                      view === "sub"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setView("sub")
                    }
                  >
                    ЗАПАС
                  </button>
                </div>
              </div>

              {ranking.length ? (
                <div className="k7-rankings">
                  {ranking.map(
                    (player, index) => (
                      <div
                        key={
                          player.telegramId
                        }
                        className="k7-rank-row"
                      >
                        <span className="k7-rank-position">
                          {String(
                            index + 1
                          ).padStart(2, "0")}
                        </span>

                        <strong>
                          {player.name}
                        </strong>

                        <span>
                          {player.wins} WINS
                        </span>

                        <span>
                          {player.kills} KILLS
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <SectionState message="В этой группе пока нет игроков" />
              )}

              <h3 className="k7-panel-subtitle">
                ПОСЛЕДНИЕ МАТЧИ
              </h3>

              {data.recentMatches.length ? (
                <div className="k7-recent-matches">
                  {data.recentMatches.map(
                    (match) => (
                      <div
                        key={match.id}
                        className="k7-recent-row"
                      >
                        <Trophy size={16} />

                        <strong>
                          {match.title}
                        </strong>

                        <span>
                          #{match.placement}
                        </span>

                        <small>
                          {formatDate(
                            match.played_at
                          )}
                        </small>
                        {canSubmit && <div className="k7-panel-card-actions">
                          <button type="button" className="k7-panel-button" onClick={() => {
                            setEditingMatchId(match.id);
                            setTitle(match.title); setPlayedAt(toLocalDateTime(match.played_at));
                            setPlacement(String(match.placement));
                          }}>ИЗМЕНИТЬ</button>
                          <button type="button" className="k7-panel-button" onClick={() => {
                            if (!window.confirm(`Удалить матч «${match.title}» и его статистику?`)) return;
                            void (async () => { try {
                              await requestJson("/api/matches", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:match.id})});
                              await reload();
                            } catch(err) { setError(err instanceof Error ? err.message : "Не удалось удалить матч"); } })();
                          }}>УДАЛИТЬ</button>
                        </div>}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <SectionState message="Матчи пока не добавлены" />
              )}
              {canSubmit && editingMatchId && (
                <form className="k7-panel-form" onSubmit={(event) => { event.preventDefault();
                  void (async () => {try {
                    await requestJson("/api/matches", {method:"PATCH", headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({id:editingMatchId,title:title.trim(),playedAt:new Date(playedAt).toISOString(),placement:Number(placement)})});
                    setEditingMatchId(null); await reload();
                  } catch(err) {setError(err instanceof Error ? err.message : "Не удалось обновить матч");}})();
                }}>
                  <label>Название матча<input required maxLength={100} value={title} onChange={(e)=>setTitle(e.target.value)} /></label>
                  <label>Дата и время<input type="datetime-local" required value={playedAt} onChange={(e)=>setPlayedAt(e.target.value)} /></label>
                  <label>Место<input type="number" required min={1} max={100} value={placement} onChange={(e)=>setPlacement(e.target.value)} /></label>
                  <button className="k7-panel-button k7-panel-primary" type="submit">СОХРАНИТЬ</button>
                  <button className="k7-panel-button" type="button" onClick={()=>setEditingMatchId(null)}>ОТМЕНА</button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function RosterAdminPanel({
  roster,
  onUpdated,
}: {
  roster: K7RosterPlayer[];
  onUpdated: () => Promise<void>;
}) {
  const [members, setMembers] = useState<
    Member[]
  >([]);
  const [memberId, setMemberId] = useState("");
  const [editPlayerId, setEditPlayerId] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState("MAIN_1");
  const [editRole, setEditRole] = useState("FLEX");
  const [editGameId, setEditGameId] = useState("");
  const [slot, setSlot] = useState(
    "MAIN_1"
  );
  const [role, setRole] = useState(
    "FLEX"
  );
  const [gameId, setGameId] =
    useState("");
  const [busy, setBusy] = useState(
    false
  );
  const [error, setError] =
    useState("");
  const [notice, setNotice] =
    useState("");

  const slots = [
    "MAIN_1",
    "MAIN_2",
    "MAIN_3",
    "MAIN_4",
    "SUB_1",
    "SUB_2",
    "SUB_3",
  ];

  const roles = [
    "FLEX",
    "IGL",
    "SUPPORT",
    "FRAGGER",
    "SNIPER",
  ];

  const freeSlots = slots.filter(
    (value) =>
      !roster.some(
        (player) =>
          player.slot === value
      )
  );

  const availableSlot = freeSlots.includes(
    slot
  )
    ? slot
    : freeSlots[0] ?? "";

  useEffect(() => {
    let active = true;

    void requestJson("/api/members")
      .then((result) => {
        if (active) {
          setMembers(
            result.members ?? []
          );
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось получить пользователей"
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function runTask(
    task: () => Promise<unknown>,
    message: string
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await task();
      await onUpdated();
      setNotice(message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка изменения состава"
      );
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await runTask(async () => {
      await requestJson(
        "/api/roster",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            telegramId:
              Number(memberId),
            slot: availableSlot,
            gameRole: role,
            inGameId:
              gameId || null,
          }),
        }
      );
    }, "Игрок добавлен в состав");
  }

  return (
    <details className="k7-admin-panel">
      <summary>
        <Shield size={16} />
        УПРАВЛЕНИЕ СОСТАВОМ
      </summary>

      <div className="k7-admin-body">
        <p>
          Выберите зарегистрированного участника и
          свободную позицию. Изменения доступны
          только уполномоченным участникам.
        </p>

        <form
          className="k7-panel-form"
          onSubmit={(event) =>
            void addPlayer(event)
          }
        >
          <label>
            Участник

            <select
              value={memberId}
              onChange={(event) =>
                setMemberId(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                ВЫБРАТЬ УЧАСТНИКА
              </option>

              {members
                .filter(
                  (member) =>
                    !roster.some(
                      (player) =>
                        player.telegram_id ===
                        member.telegram_id
                    )
                )
                .map((member) => (
                  <option
                    key={
                      member.telegram_id
                    }
                    value={
                      member.telegram_id
                    }
                  >
                    {member.username
                      ? `@${member.username}`
                      : `${member.first_name} ${member.last_name ?? ""}`}
                    {" · "}
                    {member.telegram_id}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Позиция

            <select
              value={availableSlot}
              onChange={(event) =>
                setSlot(
                  event.target.value
                )
              }
            >
              {freeSlots.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value.replace(
                      "_",
                      " "
                    )}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Игровая роль

            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value
                )
              }
            >
              {roles.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Игровой ID (необязательно)

            <input
              maxLength={40}
              value={gameId}
              onChange={(event) =>
                setGameId(
                  event.target.value
                )
              }
            />
          </label>

          <button
            className="k7-panel-button k7-panel-primary"
            disabled={
              busy ||
              !memberId ||
              !availableSlot ||
              freeSlots.length === 0
            }
          >
            ДОБАВИТЬ ИГРОКА
          </button>
        </form>

        <div className="k7-admin-rows">
          {roster.map((player) => (
            <div
              className="k7-admin-row"
              key={player.id}
            >
              <div>
                <strong>
                  {getName(player)}
                </strong>

                <small>
                  {player.slot.replace(
                    "_",
                    " "
                  )}
                  {" · "}
                  {player.game_role}
                </small>
              </div>

              <div className="k7-admin-actions">
                {!player.is_captain && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runTask(
                        async () => {
                          await requestJson(
                            "/api/roster/captain",
                            {
                              method:
                                "POST",
                              headers: {
                                "Content-Type":
                                  "application/json",
                              },
                              body:
                                JSON.stringify(
                                  {
                                    telegramId:
                                      player.telegram_id,
                                  }
                                ),
                            }
                          );
                        },
                        "Капитан назначен"
                      )
                    }
                  >
                    КАПИТАН
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Убрать ${getName(player)} из состава?`
                      )
                    ) {
                      return;
                    }

                    void runTask(
                      async () => {
                        await requestJson(
                          "/api/roster",
                          {
                            method:
                              "DELETE",
                            headers: {
                              "Content-Type":
                                "application/json",
                            },
                            body:
                              JSON.stringify(
                                {
                                  telegramId:
                                    player.telegram_id,
                                }
                              ),
                          }
                        );
                      },
                      "Игрок удалён из состава"
                    );
                  }}
                >
                  УДАЛИТЬ
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div
            className="k7-panel-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className="k7-panel-notice"
            role="status"
          >
            {notice}
          </div>
        )}
      </div>
    </details>
  );
}
