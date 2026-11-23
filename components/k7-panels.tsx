"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, RefreshCw, Shield, Trophy } from "lucide-react";
import NewsStudio from "@/components/news-studio";

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
    ? "â"
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
          ÐÐÐÐ¢ÐÐ ÐÐ¢Ð¬
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
          
        </h2>
      </div>

      <button
        type="button"
        className="k7-panel-icon"
        onClick={onRefresh}
        disabled={busy}
        aria-label="ÐÐ±Ð½Ð¾Ð²Ð¸ÑÑ Ð´Ð°Ð½Ð½ÑÐµ"
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
      result.error || `ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð¿ÑÐ¾ÑÐ° (${response.status})`
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
    "UPCOMING" | "COMPLETED" | "CANCELLED"
  >("UPCOMING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
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
          : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð·Ð°Ð³ÑÑÐ·Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ñ"
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
          ...(editingId ? { posterUrl: posterUrl.trim() } :
              posterUrl.trim() ? { posterUrl: posterUrl.trim() } : {}),
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
          : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ ÑÐ¾ÑÑÐ°Ð½Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ"
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
        title="Ð¡Ð¾Ð±ÑÑÐ¸Ñ"
        onRefresh={() => void reload()}
        busy={!authReady || loading}
      />

      <div className="k7-panel-toolbar">
        <div
          className="k7-panel-tabs"
          role="group"
          aria-label="Ð¡ÑÐ°ÑÑÑ Ð¼ÐµÑÐ¾Ð¿ÑÐ¸ÑÑÐ¸Ð¹"
        >
          <button
            type="button"
            className={
              filter === "UPCOMING" ? "selected" : ""
            }
            onClick={() => setFilter("UPCOMING")}
          >
            ÐÐ ÐÐÐ¡Ð¢ÐÐ¯Ð©ÐÐ
          </button>

          <button
            type="button"
            className={
              filter === "COMPLETED" ? "selected" : ""
            }
            onClick={() => setFilter("COMPLETED")}
          >
            ÐÐÐÐÐ Ð¨ÐÐÐÐ«Ð
          </button>
          <button type="button" className={filter === "CANCELLED" ? "selected" : ""} onClick={() => setFilter("CANCELLED")}>ÐÐ¢ÐÐÐÐÐÐÐ«Ð</button>
        </div>

        {canManage && (
          <button
            type="button"
            className="k7-panel-button"
            onClick={() => { setEditingId(null); setTitle(""); setDate(""); setDescription(""); setEventFormat(""); setPosterUrl(""); setShowForm((value) => !value); }}
          >
            {showForm ? "ÐÐÐÐ Ð«Ð¢Ð¬" : "+ Ð¡ÐÐÐ«Ð¢ÐÐ"}
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form
          className="k7-panel-form"
          onSubmit={(event) => void createEvent(event)}
        >
          <label>
            ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ
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
            ÐÐ°ÑÐ° Ð¸ Ð²ÑÐµÐ¼Ñ
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
            Ð¤Ð¾ÑÐ¼Ð°Ñ
            <input
              maxLength={100}
              value={eventFormat}
              onChange={(event) =>
                setEventFormat(event.target.value)
              }
            />
          </label>

          <label>
            ÐÐ¾ÑÑÐµÑ (HTTPS)
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
            ÐÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ
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
              ? "Ð¡ÐÐ¥Ð ÐÐÐÐÐÐ..."
              : editingId ? "Ð¡ÐÐ¥Ð ÐÐÐÐ¢Ð¬ ÐÐÐÐÐÐÐÐÐ¯" : "ÐÐÐ£ÐÐÐÐÐÐÐÐ¢Ð¬"}
          </button>
        </form>
      )}

      {!authReady ? (
        <SectionState message="ÐÐ¾Ð¹Ð´Ð¸ÑÐµ ÑÐµÑÐµÐ· Telegram" />
      ) : loading && !events.length ? (
        <SectionState message="ÐÐÐÐ Ð£ÐÐÐ Ð¡ÐÐÐ«Ð¢ÐÐ..." />
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
                  ? "ÐÐ¾ÐºÐ° Ð½ÐµÑ Ð·Ð°Ð¿Ð»Ð°Ð½Ð¸ÑÐ¾Ð²Ð°Ð½Ð½ÑÑ Ð¼ÐµÑÐ¾Ð¿ÑÐ¸ÑÑÐ¸Ð¹"
                  : "ÐÐ¾ÐºÐ° Ð½ÐµÑ Ð·Ð°Ð²ÐµÑÑÑÐ½Ð½ÑÑ Ð¼ÐµÑÐ¾Ð¿ÑÐ¸ÑÑÐ¸Ð¹"
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
                      alt="ÐÐ¾ÑÑÐµÑ Ð¼ÐµÑÐ¾Ð¿ÑÐ¸ÑÑÐ¸Ñ"
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
                      }}>Ð ÐÐÐÐÐ¢ÐÐ ÐÐÐÐ¢Ð¬</button>
                      {item.status !== "UPCOMING" && <button type="button" className="k7-panel-button" onClick={() => {
                        void (async () => {try { await requestJson("/api/events", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status:"UPCOMING"})}); setFilter("UPCOMING"); await reload(); }
                          catch(err) {setError(err instanceof Error ? err.message : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð²Ð¾ÑÑÑÐ°Ð½Ð¾Ð²Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ");}})();
                      }}>ÐÐÐ¡Ð¡Ð¢ÐÐÐÐÐÐ¢Ð¬</button>}
                      {item.status === "UPCOMING" && <button type="button" className="k7-panel-button" onClick={() => {
                        void (async () => {try { await requestJson("/api/events", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status:"CANCELLED"})}); await reload(); }
                          catch(err) {setError(err instanceof Error ? err.message : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾ÑÐ¼ÐµÐ½Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ");}})();
                      }}>ÐÐ¢ÐÐÐÐÐ¢Ð¬</button>}
                      <button type="button" className="k7-panel-button" onClick={() => {
                        setDeleteEventId(item.id);
                      }}>Ð£ÐÐÐÐÐ¢Ð¬</button>
                      {deleteEventId === item.id && <div className="k7-inline-confirm"><span>Ð£Ð´Ð°Ð»Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ?</span>
                        <button type="button" disabled={saving} onClick={() => { void (async () => { try {
                          setSaving(true);
                          await requestJson("/api/events", {method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:item.id})});
                          setDeleteEventId(null); await reload();
                        } catch(err) { setError(err instanceof Error ? err.message : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ ÑÐ´Ð°Ð»Ð¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ"); }
                          finally { setSaving(false); } })(); }}>ÐÐÐÐ¢ÐÐÐ ÐÐÐ¢Ð¬</button>
                        <button type="button" onClick={() => setDeleteEventId(null)}>ÐÐ¢ÐÐÐÐ</button></div>}
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
                                    : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð·Ð°Ð²ÐµÑÑÐ¸ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ðµ"
                                );
                              }
                            })();
                          }}
                        >
                          ÐÐÐÐÐ Ð¨ÐÐ¢Ð¬
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

export function NewsPanel({ authReady, canManage = false }: PanelProps) {
  return <NewsStudio authReady={authReady} canManage={canManage} />;
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
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
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
          : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð·Ð°Ð³ÑÑÐ·Ð¸ÑÑ ÑÑÐ°ÑÐ¸ÑÑÐ¸ÐºÑ"
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
        "ÐÑÐ±ÐµÑÐ¸ÑÐµ Ð¾Ñ 1 Ð´Ð¾ 4 Ð¸Ð³ÑÐ¾ÐºÐ¾Ð² Ð¸ ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð´Ð°ÑÑ Ð¼Ð°ÑÑÐ°"
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
          : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð·Ð°Ð¿Ð¸ÑÐ°ÑÑ ÑÐµÐ·ÑÐ»ÑÑÐ°Ñ"
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
        title="Ð¡ÑÐ°ÑÐ¸ÑÑÐ¸ÐºÐ°"
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
              ? "ÐÐÐÐ Ð«Ð¢Ð¬"
              : "+ Ð ÐÐÐ£ÐÐ¬Ð¢ÐÐ¢ ÐÐÐ¢Ð§Ð"}
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
            ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ Ð¼Ð°ÑÑÐ°
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
            ÐÐ°ÑÐ° Ð¸ Ð²ÑÐµÐ¼Ñ
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
            ÐÐµÑÑÐ¾ (1â100)
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
              Ð£ÑÐ°ÑÑÐ½Ð¸ÐºÐ¸ Ð¼Ð°ÑÑÐ° (1â4)
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
                  aria-label={`Ð£Ð±Ð¸Ð¹ÑÑÐ²Ð°: ${getName(player)}`}
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
              Ð£ÐºÐ°Ð¶Ð¸ ÐºÐ¾Ð»Ð¸ÑÐµÑÑÐ²Ð¾ ÑÐ±Ð¸Ð¹ÑÑÐ² Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾
              ÑÑÐ°ÑÑÐ²Ð¾Ð²Ð°Ð²ÑÐµÐ³Ð¾ Ð¸Ð³ÑÐ¾ÐºÐ°; Ð¿ÑÑÑÑÐµ Ð¿Ð¾Ð»Ñ Ð¾Ð·Ð½Ð°ÑÐ°ÑÑ,
              ÑÑÐ¾ Ð¸Ð³ÑÐ¾Ðº Ð½Ðµ ÑÑÐ°ÑÑÐ²Ð¾Ð²Ð°Ð».
            </small>
          </div>

          <button
            className="k7-panel-button k7-panel-primary"
            disabled={saving}
          >
            {saving
              ? "Ð¡ÐÐ¥Ð ÐÐÐÐÐÐ..."
              : "ÐÐÐÐÐ¡ÐÐ¢Ð¬ ÐÐÐ¢Ð§"}
          </button>
        </form>
      )}

      {!authReady ? (
        <SectionState message="ÐÐ¾Ð¹Ð´Ð¸ÑÐµ ÑÐµÑÐµÐ· Telegram" />
      ) : loading && !data ? (
        <SectionState message="ÐÐÐÐ£Ð§ÐÐÐÐ Ð¡Ð¢ÐÐ¢ÐÐ¡Ð¢ÐÐÐ..." />
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
                  aria-label="Ð¢Ð°Ð±Ð»Ð¸ÑÐ° Ð¸Ð³ÑÐ¾ÐºÐ¾Ð²"
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
                    ÐÐ¡ÐÐÐÐ
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
                    ÐÐÐÐÐ¡
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
                <SectionState message="Ð ÑÑÐ¾Ð¹ Ð³ÑÑÐ¿Ð¿Ðµ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ Ð¸Ð³ÑÐ¾ÐºÐ¾Ð²" />
              )}

              <h3 className="k7-panel-subtitle">
                ÐÐÐ¡ÐÐÐÐÐÐ ÐÐÐ¢Ð§Ð
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
                          }}>ÐÐÐÐÐÐÐ¢Ð¬</button>
                          <button type="button" className="k7-panel-button" onClick={() => {
                            setDeleteMatchId(match.id);
                          }}>Ð£ÐÐÐÐÐ¢Ð¬</button>
                          {deleteMatchId === match.id && <div className="k7-inline-confirm">Ð£Ð´Ð°Ð»Ð¸ÑÑ Ð¼Ð°ÑÑ Ð¸ ÑÑÐ°ÑÐ¸ÑÑÐ¸ÐºÑ?
                            <button type="button" disabled={saving} onClick={() => { void (async () => {try { setSaving(true);
                              await requestJson("/api/matches", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:match.id})});
                              setDeleteMatchId(null); await reload();
                            } catch(err) { setError(err instanceof Error ? err.message : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ ÑÐ´Ð°Ð»Ð¸ÑÑ Ð¼Ð°ÑÑ"); }
                              finally { setSaving(false); } })(); }}>ÐÐÐÐ¢ÐÐÐ ÐÐÐ¢Ð¬</button>
                            <button type="button" onClick={() => setDeleteMatchId(null)}>ÐÐ¢ÐÐÐÐ</button></div>}
                        </div>}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <SectionState message="ÐÐ°ÑÑÐ¸ Ð¿Ð¾ÐºÐ° Ð½Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ" />
              )}
              {canSubmit && editingMatchId && (
                <form className="k7-panel-form" onSubmit={(event) => { event.preventDefault();
                  void (async () => {try {
                    await requestJson("/api/matches", {method:"PATCH", headers:{"Content-Type":"application/json"},
                      body:JSON.stringify({id:editingMatchId,title:title.trim(),playedAt:new Date(playedAt).toISOString(),placement:Number(placement)})});
                    setEditingMatchId(null); await reload();
                  } catch(err) {setError(err instanceof Error ? err.message : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾Ð±Ð½Ð¾Ð²Ð¸ÑÑ Ð¼Ð°ÑÑ");}})();
                }}>
                  <label>ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ Ð¼Ð°ÑÑÐ°<input required maxLength={100} value={title} onChange={(e)=>setTitle(e.target.value)} /></label>
                  <label>ÐÐ°ÑÐ° Ð¸ Ð²ÑÐµÐ¼Ñ<input type="datetime-local" required value={playedAt} onChange={(e)=>setPlayedAt(e.target.value)} /></label>
                  <label>ÐÐµÑÑÐ¾<input type="number" required min={1} max={100} value={placement} onChange={(e)=>setPlacement(e.target.value)} /></label>
                  <button className="k7-panel-button k7-panel-primary" type="submit">Ð¡ÐÐ¥Ð ÐÐÐÐ¢Ð¬</button>
                  <button className="k7-panel-button" type="button" onClick={()=>setEditingMatchId(null)}>ÐÐ¢ÐÐÐÐ</button>
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
  const [deletePlayerId, setDeletePlayerId] = useState<number | null>(null);
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
              : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¿Ð¾Ð»ÑÑÐ¸ÑÑ Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»ÐµÐ¹"
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
          : "ÐÑÐ¸Ð±ÐºÐ° Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ ÑÐ¾ÑÑÐ°Ð²Ð°"
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
    }, "ÐÐ³ÑÐ¾Ðº Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð² ÑÐ¾ÑÑÐ°Ð²");
  }

  return (
    <details className="k7-admin-panel">
      <summary>
        <Shield size={16} />
        Ð£ÐÐ ÐÐÐÐÐÐÐ Ð¡ÐÐ¡Ð¢ÐÐÐÐ
      </summary>

      <div className="k7-admin-body">
        <p>
          ÐÑÐ±ÐµÑÐ¸ÑÐµ Ð·Ð°ÑÐµÐ³Ð¸ÑÑÑÐ¸ÑÐ¾Ð²Ð°Ð½Ð½Ð¾Ð³Ð¾ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ° Ð¸
          ÑÐ²Ð¾Ð±Ð¾Ð´Ð½ÑÑ Ð¿Ð¾Ð·Ð¸ÑÐ¸Ñ. ÐÐ·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð´Ð¾ÑÑÑÐ¿Ð½Ñ
          ÑÐ¾Ð»ÑÐºÐ¾ ÑÐ¿Ð¾Ð»Ð½Ð¾Ð¼Ð¾ÑÐµÐ½Ð½ÑÐ¼ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ°Ð¼.
        </p>

        <form
          className="k7-panel-form"
          onSubmit={(event) =>
            void addPlayer(event)
          }
        >
          <label>
            Ð£ÑÐ°ÑÑÐ½Ð¸Ðº

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
                ÐÐ«ÐÐ ÐÐ¢Ð¬ Ð£Ð§ÐÐ¡Ð¢ÐÐÐÐ
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
                    {" Â· "}
                    {member.telegram_id}
                  </option>
                ))}
            </select>
          </label>

          <label>
            ÐÐ¾Ð·Ð¸ÑÐ¸Ñ

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
            ÐÐ³ÑÐ¾Ð²Ð°Ñ ÑÐ¾Ð»Ñ

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
            ÐÐ³ÑÐ¾Ð²Ð¾Ð¹ ID (Ð½ÐµÐ¾Ð±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾)

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
            ÐÐÐÐÐÐÐ¢Ð¬ ÐÐÐ ÐÐÐ
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
                  {" Â· "}
                  {player.game_role}
                </small>
              </div>

              <div className="k7-admin-actions">
                <button type="button" disabled={busy} onClick={() => {
                  setEditPlayerId(player.telegram_id); setEditSlot(player.slot);
                  setEditRole(player.game_role); setEditGameId(player.in_game_id ?? "");
                }}>ÐÐÐÐÐÐÐ¢Ð¬</button>
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
                        "ÐÐ°Ð¿Ð¸ÑÐ°Ð½ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½"
                      )
                    }
                  >
                    ÐÐÐÐÐ¢ÐÐ
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeletePlayerId(player.telegram_id)}
                >
                  Ð£ÐÐÐÐÐ¢Ð¬
                </button>
                {deletePlayerId === player.telegram_id && <div className="k7-inline-confirm">
                  <span>Ð£Ð±ÑÐ°ÑÑ {getName(player)} Ð¸Ð· ÑÐ¾ÑÑÐ°Ð²Ð°?</span>
                  <button type="button" disabled={busy} onClick={() => {
                    void runTask(async () => {
                      await requestJson("/api/roster", { method: "DELETE", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ telegramId: player.telegram_id }) });
                      setDeletePlayerId(null);
                    }, "ÐÐ³ÑÐ¾Ðº ÑÐ´Ð°Ð»ÑÐ½ Ð¸Ð· ÑÐ¾ÑÑÐ°Ð²Ð°");
                  }}>ÐÐÐÐ¢ÐÐÐ ÐÐÐ¢Ð¬</button>
                  <button type="button" onClick={() => setDeletePlayerId(null)}>ÐÐ¢ÐÐÐÐ</button>
                </div>}
              </div>
            </div>
          ))}
        </div>

        {editPlayerId !== null && (
          <form className="k7-panel-form k7-roster-edit" onSubmit={(event) => {
            event.preventDefault();
            void runTask(async () => {
              await requestJson("/api/roster", { method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ telegramId: editPlayerId, slot: editSlot, gameRole: editRole, inGameId: editGameId || null }) });
              setEditPlayerId(null);
            }, "ÐÐ°Ð½Ð½ÑÐµ Ð¸Ð³ÑÐ¾ÐºÐ° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ñ");
          }}>
            <strong className="k7-panel-wide">Ð ÐÐÐÐÐ¢ÐÐ ÐÐÐÐÐÐ ÐÐÐ ÐÐÐ</strong>
            <label>ÐÐ¾Ð·Ð¸ÑÐ¸Ñ<select value={editSlot} onChange={event => setEditSlot(event.target.value)}>
              {slots.map(value => <option key={value} value={value} disabled={roster.some(player => player.slot === value && player.telegram_id !== editPlayerId)}>{value.replace("_", " ")}</option>)}
            </select></label>
            <label>Ð Ð¾Ð»Ñ<select value={editRole} onChange={event => setEditRole(event.target.value)}>
              {roles.map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
            <label className="k7-panel-wide">ÐÐ³ÑÐ¾Ð²Ð¾Ð¹ ID<input value={editGameId} maxLength={40} onChange={event => setEditGameId(event.target.value)}/></label>
            <button className="k7-panel-button k7-panel-primary" disabled={busy}>Ð¡ÐÐ¥Ð ÐÐÐÐ¢Ð¬</button>
            <button type="button" className="k7-panel-button" onClick={() => setEditPlayerId(null)}>ÐÐ¢ÐÐÐÐ</button>
          </form>
        )}

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
