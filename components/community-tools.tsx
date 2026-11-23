"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Send, MessageSquare, Users, X, RefreshCw } from "lucide-react";

type ReportRecord = {
  id: string;
  author_id: number;
  subject: string;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED";
  admin_reply: string | null;
  created_at: string;
  profiles: { first_name: string; username: string | null } | { first_name: string; username: string | null }[] | null;
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", credentials: "include", ...init });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error ?? "Ошибка запроса");
  return payload;
}

export function CommunityCounter({ authReady }: { authReady: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const reload = useCallback(async () => {
    try {
      const result = await api("/api/community");
      if (typeof result.count === "number") setCount(result.count);
    } catch { /* Leave the last known count visible on temporary network errors. */ }
  }, []);
  useEffect(() => {
    if (!authReady) return;
    void reload();
    const interval = window.setInterval(() => { if (!document.hidden) void reload(); }, 20000);
    const onVisible = () => { if (!document.hidden) void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [authReady, reload]);
  return <div className="k7-community-count" title="Зарегистрированные пользователи K7 CREW">
    <Users size={14} aria-hidden="true" /> <strong>{count === null ? "—" : count.toLocaleString("ru-RU")}</strong>
    <span>в сообществе</span>
  </div>;
}

export function ReportButton({ authReady }: { authReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!authReady || busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) });
      setSent(true); setSubject(""); setMessage("");
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось отправить"); }
    finally { setBusy(false); }
  }
  function close() { setOpen(false); setSent(false); setError(""); }
  return <>
    <button className="k7-report-trigger" type="button" disabled={!authReady} onClick={() => { setOpen(true); setSent(false); }}>
      <AlertTriangle size={15} /> Сообщить об ошибке
    </button>
    {open && <div className="k7-modal-root" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="k7-modal-panel" role="dialog" aria-modal="true" aria-labelledby="k7-report-title">
        <div className="k7-modal-title"><span className="k7-panel-eyebrow">K7 / SUPPORT</span><button type="button" onClick={close} aria-label="Закрыть"><X size={20}/></button></div>
        <h2 id="k7-report-title">СООБЩИТЬ ОБ ОШИБКЕ</h2>
        {sent ? <div className="k7-report-success" role="status">Сообщение отправлено. Владелец и капитан увидят его во вкладке «Сообщения».<button type="button" className="k7-panel-button" onClick={close}>ЗАКРЫТЬ</button></div> :
          <form className="k7-report-form" onSubmit={(event) => void submit(event)}>
            <label>Тема обращения <input required autoFocus maxLength={80} value={subject} placeholder="Например, не открывается публикация" onChange={(event) => setSubject(event.target.value)} /></label>
            <label>Сообщение <textarea required rows={3} maxLength={100} value={message} placeholder="Опиши проблему кратко..." onChange={(event) => setMessage(event.target.value)} /><small>{message.length}/100 символов</small></label>
            {error && <p className="k7-panel-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || !subject.trim() || !message.trim()} className="k7-panel-button k7-panel-primary"><Send size={15}/> {busy ? "ОТПРАВКА..." : "ОТПРАВИТЬ"}</button>
          </form>}
      </section>
    </div>}
  </>;
}

export function ReportsInbox({ authReady }: { authReady: boolean }) {
  const [items, setItems] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const reload = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    try { const result = await api("/api/reports"); setItems(result.reports ?? []); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, [authReady]);
  useEffect(() => { void reload(); }, [reload]);
  async function update(item: ReportRecord, status: ReportRecord["status"]) {
    setBusyId(item.id); setError("");
    try {
      await api("/api/reports", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status, reply: draftReplies[item.id] ?? item.admin_reply ?? "" }) });
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось обновить обращение"); }
    finally { setBusyId(null); }
  }
  async function remove(id: string) {
    setBusyId(id); setError("");
    try { await api("/api/reports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setPendingDelete(null); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Не удалось удалить обращение"); }
    finally { setBusyId(null); }
  }
  return <div className="k7-data-panel k7-reports-inbox">
    <div className="k7-panel-head"><div><div className="k7-panel-eyebrow">K7 / ADMIN ONLY</div><h2>Обращения</h2></div>
      <button type="button" className="k7-panel-icon" aria-label="Обновить сообщения" disabled={loading} onClick={() => void reload()}><RefreshCw size={18}/></button></div>
    <p className="k7-report-explainer"><MessageSquare size={16}/> Обращения участников видят только владелец и капитан.</p>
    {error && <div role="alert" className="k7-panel-error">{error}</div>}
    {loading && items.length === 0 && <p>Загрузка...</p>}
    {!loading && items.length === 0 && !error && <p className="k7-panel-empty">Пока нет обращений.</p>}
    <div className="k7-report-list">{items.map(item => {
      const author = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return <article className="k7-report-item" key={item.id}>
        <div className="k7-report-item-top"><span className="k7-report-state">{item.status === "NEW" ? "НОВОЕ" : item.status === "IN_PROGRESS" ? "В РАБОТЕ" : "РЕШЕНО"}</span><time>{new Date(item.created_at).toLocaleString("ru-RU")}</time></div>
        <h3>{item.subject}</h3><p>{item.message}</p>
        <small>От: {author?.username ? `@${author.username}` : author?.first_name ?? `Telegram ID ${item.author_id}`} · ID {item.author_id}</small>
        <label className="k7-report-reply">Ответ или внутренняя заметка (до 500 символов)
          <textarea rows={2} maxLength={500} value={draftReplies[item.id] ?? item.admin_reply ?? ""} onChange={event => setDraftReplies(previous => ({ ...previous, [item.id]: event.target.value }))}/>
        </label>
        <div className="k7-panel-card-actions"><button type="button" disabled={busyId === item.id} onClick={() => void update(item, "IN_PROGRESS")} className="k7-panel-button">В РАБОТУ</button><button type="button" disabled={busyId === item.id} onClick={() => void update(item, "RESOLVED")} className="k7-panel-button">РЕШЕНО</button><button type="button" disabled={busyId === item.id} onClick={() => void update(item, item.status)} className="k7-panel-button">СОХРАНИТЬ</button><button type="button" onClick={() => setPendingDelete(item.id)} className="k7-panel-button">УДАЛИТЬ</button></div>
        {pendingDelete === item.id && <div className="k7-inline-confirm" role="group" aria-label="Подтверждение удаления">Удалить обращение? <button type="button" disabled={busyId === item.id} onClick={() => void remove(item.id)}>ДА, УДАЛИТЬ</button><button type="button" onClick={() => setPendingDelete(null)}>ОТМЕНА</button></div>}
      </article>;
    })}</div>
  </div>;
}
