"use client";

import { K7PhotoUpload } from "@/components/k7-photo-upload";
import { stableSnapshot } from "@/lib/stable-snapshot";
import { useK7Sync } from "@/components/use-k7-sync";
import { BrandLabel } from "@/components/brand-label";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Shield, Trophy } from "lucide-react";
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
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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
      <span><BrandLabel text={message} /></span>

      {retry && (
        <button
          type="button"
          className="k7-panel-button"
          onClick={retry}
        >
          <BrandLabel text={"ПОВТОРИТЬ"} asset="actions/retry" />
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="k7-panel-head">
      <div>
        <div className="k7-panel-eyebrow"><BrandLabel text={eyebrow} /></div>
        <h2>
          <BrandLabel text={title} />
        </h2>
      </div>

    </div>
  );
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
  });

  // Fetch decodes JSON as UTF-8. Report a useful error if a proxy
  // serves HTML (for example, an authentication redirect) instead.
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== "object") {
    throw new Error(`Сервер вернул некорректный JSON (${response.status})`);
  }

  const payload = result as { success?: boolean; error?: string };
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Ошибка запроса (${response.status})`);
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
  const [photoBusy,setPhotoBusy]=useState(false);

  const requestVersion = useRef(0);
  const reload = useCallback(async (silent = false) => {
    if (!authReady) return;
    const version = ++requestVersion.current;

    if (!silent) setLoading(true);

    try {
      const response = await requestJson("/api/events");
      if(version!==requestVersion.current)return;
      setEvents(old=>stableSnapshot(old,response.events??[]));
      if(!silent)setError("");
    } catch (err) {
      if(version===requestVersion.current&&!silent)setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить события"
      );
    } finally {
      if(version===requestVersion.current)setLoading(false);
    }
  }, [authReady]);

  useK7Sync(authReady, reload, 15000);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !date || photoBusy) return;

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
        title="События"
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
            <BrandLabel text={"Предстоящие"} asset="sections/upcoming" />
          </button>

          <button
            type="button"
            className={
              filter === "COMPLETED" ? "selected" : ""
            }
            onClick={() => setFilter("COMPLETED")}
          >
            <BrandLabel text={"Завершённые"} asset="sections/completed" />
          </button>
          <button type="button" className={filter === "CANCELLED" ? "selected" : ""} onClick={() => setFilter("CANCELLED")}><BrandLabel text={"Отменённые"} asset="sections/cancelled" /></button>
        </div>

        {canManage && (
          <button
            type="button"
            className="k7-panel-button"
            disabled={photoBusy || saving}
            onClick={() => { setEditingId(null); setTitle(""); setDate(""); setDescription(""); setEventFormat(""); setPosterUrl(""); setShowForm((value) => !value); }}
          >
            {showForm ? <BrandLabel text={"ЗАКРЫТЬ"} asset="actions/close" /> : <BrandLabel text={"+ СОБЫТИЕ"} asset="actions/add_event" />}
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form
          className="k7-panel-form"
          onSubmit={(event) => void createEvent(event)}
        >
          <label>
            <BrandLabel text={"Название"} asset="fields/name" />
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
            <BrandLabel text={"Дата и время"} asset="fields/date_time" />
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
            <BrandLabel text={"Формат"} asset="fields/format" />
            <input
              maxLength={100}
              value={eventFormat}
              onChange={(event) =>
                setEventFormat(event.target.value)
              }
            />
          </label>

          <div className="k7-panel-wide"><BrandLabel text="Постер" asset="fields/poster"/><K7PhotoUpload disabled={saving} onBusy={setPhotoBusy} onUpload={urls=>setPosterUrl(urls[0])}/>{posterUrl&&<><img className="k7-panel-cover" src={posterUrl} alt="Постер"/><button type="button" onClick={()=>setPosterUrl("")}>Удалить фото</button></>}</div>

          <label className="k7-panel-wide">
            <BrandLabel text={"Описание"} asset="fields/description" />
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
            disabled={saving || photoBusy}
          >
            {saving
              ? <BrandLabel text={"СОХРАНЕНИЕ..."} asset="actions/saving" />
              : editingId ? <BrandLabel text={"СОХРАНИТЬ ИЗМЕНЕНИЯ"} asset="actions/save_changes" /> : <BrandLabel text={"ОПУБЛИКОВАТЬ"} asset="actions/publish" />}
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
                  : filter === "CANCELLED"
                    ? "Пока нет отменённых мероприятий"
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
                      }}><BrandLabel text={"РЕДАКТИРОВАТЬ"} asset="actions/edit" /></button>
                      {item.status !== "UPCOMING" && <button type="button" className="k7-panel-button" onClick={() => {
                        void (async () => {try { await requestJson("/api/events", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status:"UPCOMING"})}); setFilter("UPCOMING"); await reload(); }
                          catch(err) {setError(err instanceof Error ? err.message : "Не удалось восстановить событие");}})();
                      }}><BrandLabel text={"ВОССТАНОВИТЬ"} asset="actions/restore" /></button>}
                      {item.status === "UPCOMING" && <button type="button" className="k7-panel-button" onClick={() => {
                        void (async () => {try { await requestJson("/api/events", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status:"CANCELLED"})}); await reload(); }
                          catch(err) {setError(err instanceof Error ? err.message : "Не удалось отменить событие");}})();
                      }}><BrandLabel text={"ОТМЕНИТЬ"} asset="actions/cancel_event" /></button>}
                      <button type="button" className="k7-panel-button" onClick={() => {
                        setDeleteEventId(item.id);
                      }}><BrandLabel text={"УДАЛИТЬ"} asset="actions/delete" /></button>
                      {deleteEventId === item.id && <div className="k7-inline-confirm"><span><BrandLabel text={"Удалить событие?"} asset="status/delete_event" /></span>
                        <button type="button" disabled={saving} onClick={() => { void (async () => { try {
                          setSaving(true);
                          await requestJson("/api/events", {method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:item.id})});
                          setDeleteEventId(null); await reload();
                        } catch(err) { setError(err instanceof Error ? err.message : "Не удалось удалить событие"); }
                          finally { setSaving(false); } })(); }}><BrandLabel text={"ПОДТВЕРДИТЬ"} asset="actions/confirm" /></button>
                        <button type="button" onClick={() => setDeleteEventId(null)}><BrandLabel text={"ОТМЕНА"} asset="actions/cancel" /></button></div>}
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
                          <BrandLabel text={"ЗАВЕРШИТЬ"} asset="actions/complete" />
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
  onProfile,
}: {
  authReady: boolean;
  canSubmit: boolean;
  roster: K7RosterPlayer[];
  onProfile: (id:number)=>void;
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

  const requestVersion = useRef(0);
  const reload = useCallback(async (silent = false) => {
    if (!authReady) return;
    const version = ++requestVersion.current;

    if (!silent) setLoading(true);

    try {
      const result = await requestJson("/api/stats");

      if(version!==requestVersion.current)return;
      setData(old=>stableSnapshot(old,{team:result.team,rankings:result.rankings,recentMatches:result.recentMatches}));
      if(!silent)setError("");
    } catch (err) {
      if(version===requestVersion.current&&!silent)setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить статистику"
      );
    } finally {
      if(version===requestVersion.current)setLoading(false);
    }
  }, [authReady]);

  useK7Sync(authReady, reload, 15000);

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
      !title.trim() ||
      players.some((player) => !Number.isInteger(player.kills) || player.kills < 0 || player.kills > 100)
    ) {
      setError(
        "Выберите 1–4 игроков, дату и корректное число убийств (0–100)"
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
        title="Статистика"
      />

      {canSubmit && (
        <div className="k7-panel-toolbar">
          <button
            className="k7-panel-button"
            type="button"
            onClick={() => {
              setEditingMatchId(null);
              setTitle("");
              setPlayedAt("");
              setPlacement("1");
              setSelected({});
              setShowForm((value) => !value);
            }}
          >
            {showForm
              ? <BrandLabel text={"ЗАКРЫТЬ"} asset="actions/close" />
              : <BrandLabel text={"+ РЕЗУЛЬТАТ МАТЧА"} asset="actions/add_match" />}
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
            <BrandLabel text={"Название матча"} asset="fields/match_name" />
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
            <BrandLabel text={"Дата и время"} asset="fields/date_time" />
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
            <BrandLabel text={"Место (1–100)"} asset="fields/placement_range" />
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
              <BrandLabel text={"Участники матча (1–4)"} asset="status/match_players" />
            </strong>

            {roster.map((player) => (
              <label
                key={player.id}
                className="k7-match-player"
              >
                <span>
                  {getName(player)}
                  <small>
                    <BrandLabel text={player.slot.replace("_", " ")} />
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
              ? <BrandLabel text={"СОХРАНЕНИЕ..."} asset="actions/saving" />
              : <BrandLabel text={"ЗАПИСАТЬ МАТЧ"} asset="actions/record_match" />}
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
                  <span><BrandLabel text={"Матчи"} asset="sections/matches" /></span>
                  <strong>
                    {data.team.matches}
                  </strong>
                </div>

                <div>
                  <span><BrandLabel text={"Победы"} asset="sections/wins" /></span>
                  <strong>
                    {data.team.wins}
                  </strong>
                </div>

                <div>
                  <span><BrandLabel text={"Убийства"} asset="sections/kills" /></span>
                  <strong>
                    {data.team.kills}
                  </strong>
                </div>

                <div>
                  <span><BrandLabel text={"Доля побед"} asset="sections/win_rate" /></span>
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
                    <BrandLabel text={"Основа"} asset="sections/main" />
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
                    <BrandLabel text={"Запас"} asset="sections/reserve" />
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
                          <button type="button" className="k7-profile-link" onClick={()=>onProfile(player.telegramId)}>{player.name}</button>
                        </strong>

                        <span>
                          {player.wins} <BrandLabel text={"WINS"} asset="roles/wins_en" />
                        </span>

                        <span>
                          {player.kills} <BrandLabel text={"KILLS"} asset="roles/kills_en" />
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <SectionState message="В этой группе пока нет игроков" />
              )}

              <h3 className="k7-panel-subtitle">
                <BrandLabel text={"Последние матчи"} asset="sections/recent_matches" />
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
                            setShowForm(false);
                            setEditingMatchId(match.id);
                            setTitle(match.title); setPlayedAt(toLocalDateTime(match.played_at));
                            setPlacement(String(match.placement));
                          }}><BrandLabel text={"ИЗМЕНИТЬ"} asset="actions/modify" /></button>
                          <button type="button" className="k7-panel-button" onClick={() => {
                            setDeleteMatchId(match.id);
                          }}><BrandLabel text={"УДАЛИТЬ"} asset="actions/delete" /></button>
                          {deleteMatchId === match.id && <div className="k7-inline-confirm"><BrandLabel text={"Удалить матч и статистику?"} asset="status/delete_match" />
                            <button type="button" disabled={saving} onClick={() => { void (async () => {try { setSaving(true);
                              await requestJson("/api/matches", {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:match.id})});
                              setDeleteMatchId(null); await reload();
                            } catch(err) { setError(err instanceof Error ? err.message : "Не удалось удалить матч"); }
                              finally { setSaving(false); } })(); }}><BrandLabel text={"ПОДТВЕРДИТЬ"} asset="actions/confirm" /></button>
                            <button type="button" onClick={() => setDeleteMatchId(null)}><BrandLabel text={"ОТМЕНА"} asset="actions/cancel" /></button></div>}
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
                  <label><BrandLabel text={"Название матча"} asset="fields/match_name" /><input required maxLength={100} value={title} onChange={(e)=>setTitle(e.target.value)} /></label>
                  <label><BrandLabel text={"Дата и время"} asset="fields/date_time" /><input type="datetime-local" required value={playedAt} onChange={(e)=>setPlayedAt(e.target.value)} /></label>
                  <label><BrandLabel text={"Место"} asset="fields/placement" /><input type="number" required min={1} max={100} value={placement} onChange={(e)=>setPlacement(e.target.value)} /></label>
                  <button className="k7-panel-button k7-panel-primary" type="submit" disabled={saving}><BrandLabel text={"СОХРАНИТЬ"} asset="actions/save" /></button>
                  <button className="k7-panel-button" type="button" onClick={()=>setEditingMatchId(null)}><BrandLabel text={"ОТМЕНА"} asset="actions/cancel" /></button>
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
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(""),4000);return()=>window.clearTimeout(timer);},[notice]);

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

  useK7Sync(true, async (silent) => {
    try { const result = await requestJson("/api/members"); setMembers(old=>stableSnapshot(old,result.members??[])); }
    catch(err) { if(!silent)setError(err instanceof Error?err.message:"Не удалось получить пользователей"); }
  }, 20000);

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
        <BrandLabel text={"УПРАВЛЕНИЕ СОСТАВОМ"} asset="sections/manage_roster" />
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
            <BrandLabel text={"Участник"} asset="fields/member" />

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
            <BrandLabel text={"Позиция"} asset="fields/position" />

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
            <BrandLabel text={"Игровая роль"} asset="fields/game_role" />

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
            <BrandLabel text={"Игровой ID (необязательно)"} asset="fields/game_id_optional" />

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
            <BrandLabel text={"ДОБАВИТЬ ИГРОКА"} asset="actions/add_player" />
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
                  <BrandLabel text={player.slot.replace("_", " ")} />
                  {" · "}
                  <BrandLabel text={player.game_role} />
                </small>
              </div>

              <div className="k7-admin-actions">
                <button type="button" disabled={busy} onClick={() => {
                  setEditPlayerId(player.telegram_id); setEditSlot(player.slot);
                  setEditRole(player.game_role); setEditGameId(player.in_game_id ?? "");
                }}><BrandLabel text={"ИЗМЕНИТЬ"} asset="actions/modify" /></button>
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
                    <BrandLabel text={"КАПИТАН"} asset="actions/captain" />
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeletePlayerId(player.telegram_id)}
                >
                  <BrandLabel text={"УДАЛИТЬ"} asset="actions/delete" />
                </button>
                {deletePlayerId === player.telegram_id && <div className="k7-inline-confirm">
                  <span>Убрать {getName(player)} из состава?</span>
                  <button type="button" disabled={busy} onClick={() => {
                    void runTask(async () => {
                      await requestJson("/api/roster", { method: "DELETE", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ telegramId: player.telegram_id }) });
                      setDeletePlayerId(null);
                    }, "Игрок удалён из состава");
                  }}><BrandLabel text={"ПОДТВЕРДИТЬ"} asset="actions/confirm" /></button>
                  <button type="button" onClick={() => setDeletePlayerId(null)}><BrandLabel text={"ОТМЕНА"} asset="actions/cancel" /></button>
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
            }, "Данные игрока обновлены");
          }}>
            <strong className="k7-panel-wide"><BrandLabel text={"РЕДАКТИРОВАНИЕ ИГРОКА"} asset="sections/edit_player" /></strong>
            <label><BrandLabel text={"Позиция"} asset="fields/position" /><select value={editSlot} onChange={event => setEditSlot(event.target.value)}>
              {slots.map(value => <option key={value} value={value} disabled={roster.some(player => player.slot === value && player.telegram_id !== editPlayerId)}>{value.replace("_", " ")}</option>)}
            </select></label>
            <label><BrandLabel text={"Роль"} asset="fields/role" /><select value={editRole} onChange={event => setEditRole(event.target.value)}>
              {roles.map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
            <label className="k7-panel-wide"><BrandLabel text={"Игровой ID"} asset="fields/game_id" /><input value={editGameId} maxLength={40} onChange={event => setEditGameId(event.target.value)}/></label>
            <button className="k7-panel-button k7-panel-primary" disabled={busy}><BrandLabel text={"СОХРАНИТЬ"} asset="actions/save" /></button>
            <button type="button" className="k7-panel-button" onClick={() => setEditPlayerId(null)}><BrandLabel text={"ОТМЕНА"} asset="actions/cancel" /></button>
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
