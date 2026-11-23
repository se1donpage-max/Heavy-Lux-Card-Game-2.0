"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RefreshCw, Edit3, Plus, Pin, Trash2, Eye, X, Bold, Italic, List, Heading2, Quote, ExternalLink } from "lucide-react";

type News = {
  id: string; title: string; subtitle: string | null; category: string; content: string;
  cover_url: string | null; published_at: string; layout_style: "editorial" | "statement" | "spotlight";
  is_pinned: boolean; cta_label: string | null; cta_url: string | null;
};
const blank = { title: "", subtitle: "", category: "НОВОСТИ", content: "", coverUrl: "", layoutStyle: "editorial" as News["layout_style"], pinned: false, ctaLabel: "", ctaUrl: "" };
type Draft = typeof blank;

async function json(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", credentials: "include", ...init });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

function inlineText(text: string): ReactNode[] {
  // Text stays escaped in React. Only HTTPS hyperlinks are clickable.
  const chunks = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g);
  return chunks.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2,-2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1,-1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

function EditorialBody({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  return <div className="k7-editorial-body">{lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="k7-editorial-spacer" aria-hidden="true" />;
    if (trimmed.startsWith("## ")) return <h4 key={index}>{inlineText(trimmed.slice(3))}</h4>;
    if (trimmed.startsWith("> ")) return <blockquote key={index}>{inlineText(trimmed.slice(2))}</blockquote>;
    if (/^[-•] /.test(trimmed)) return <p key={index} className="k7-editorial-bullet">{inlineText(trimmed.slice(2))}</p>;
    return <p key={index}>{inlineText(trimmed)}</p>;
  })}</div>;
}

function NewsCard({ item, canManage, onEdit, onDelete, onPin, busy }: {
  item: News; canManage: boolean; onEdit: (item: News) => void;
  onDelete: (id: string) => void; onPin: (item: News) => void; busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return <article className={`k7-news-story k7-news-${item.layout_style}`}>
    <div className="k7-story-kicker"><span>{item.category || "НОВОСТИ"}</span><span>{item.is_pinned && <><Pin size={12}/> ЗАКРЕПЛЕНО · </>}{new Date(item.published_at).toLocaleDateString("ru-RU")}</span></div>
    {item.cover_url && <div className="k7-story-cover"><img src={item.cover_url} alt="Обложка новости" loading="lazy"/></div>}
    <div className="k7-story-copy"><h3>{item.title}</h3>{item.subtitle && <p className="k7-story-subtitle">{item.subtitle}</p>}
      <EditorialBody value={item.content}/>
      {item.cta_label && item.cta_url && <a className="k7-story-cta" href={item.cta_url} target="_blank" rel="noopener noreferrer">{item.cta_label} <ExternalLink size={15}/></a>}
    </div>
    {canManage && <div className="k7-panel-card-actions k7-story-controls">
      <button type="button" className="k7-panel-button" onClick={() => onEdit(item)}><Edit3 size={13}/> РЕДАКТИРОВАТЬ</button>
      <button type="button" className="k7-panel-button" disabled={busy} onClick={() => onPin(item)}><Pin size={13}/> {item.is_pinned ? "ОТКРЕПИТЬ" : "ЗАКРЕПИТЬ"}</button>
      <button type="button" className="k7-panel-button" onClick={() => setConfirming(true)}><Trash2 size={13}/> УДАЛИТЬ</button>
    </div>}
    {confirming && <div className="k7-inline-confirm" role="group" aria-label="Подтверждение удаления"><span>Удалить «{item.title}» без возможности восстановления?</span><button type="button" disabled={busy} onClick={() => onDelete(item.id)}>УДАЛИТЬ</button><button type="button" onClick={() => setConfirming(false)}>ОТМЕНА</button></div>}
  </article>;
}

export default function NewsStudio({ authReady, canManage }: { authReady: boolean; canManage: boolean }) {
  const [posts, setPosts] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...blank });
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const patch = (partial: Partial<Draft>) => setDraft(old => ({ ...old, ...partial }));
  const reload = useCallback(async () => {
    if (!authReady) return;
    setLoading(true);
    try { const data = await json("/api/news"); setPosts(data.news ?? []); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить новости"); }
    finally { setLoading(false); }
  }, [authReady]);
  useEffect(() => { void reload(); }, [reload]);
  function startNew() { setDraft({ ...blank }); setEditingId(null); setEditorOpen(true); setPreview(false); editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  function startEdit(post: News) {
    setDraft({ title: post.title, subtitle: post.subtitle ?? "", category: post.category, content: post.content, coverUrl: post.cover_url ?? "", layoutStyle: post.layout_style, pinned: post.is_pinned, ctaLabel: post.cta_label ?? "", ctaUrl: post.cta_url ?? "" });
    setEditingId(post.id); setEditorOpen(true); setPreview(false);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function insert(mark: "strong" | "italic" | "title" | "quote" | "list" | "link") {
    const textarea = textareaRef.current; if (!textarea) return;
    const a = textarea.selectionStart, b = textarea.selectionEnd;
    const selected = draft.content.slice(a,b) || "Текст";
    const token = mark === "strong" ? `**${selected}**` : mark === "italic" ? `*${selected}*` :
      mark === "title" ? `\n## ${selected}\n` : mark === "quote" ? `\n> ${selected}\n` :
      mark === "list" ? `\n- ${selected}` : `[${selected}](https://example.com)`;
    patch({ content: draft.content.slice(0,a) + token + draft.content.slice(b) });
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(a + token.length, a + token.length); });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await json("/api/news", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(editingId ? { id: editingId } : {}) }) });
      setEditorOpen(false); setEditingId(null); setDraft({ ...blank }); setNotice("Публикация сохранена"); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Ошибка сохранения"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    setSaving(true); setError("");
    try { await json("/api/news", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setPosts(old => old.filter(post => post.id !== id)); setNotice("Публикация удалена"); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Ошибка удаления"); }
    finally { setSaving(false); }
  }
  async function togglePin(post: News) {
    setSaving(true); setError("");
    try { await json("/api/news", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      id: post.id, title: post.title, content: post.content, subtitle: post.subtitle ?? "", category: post.category,
      coverUrl: post.cover_url ?? "", layoutStyle: post.layout_style, pinned: !post.is_pinned, ctaLabel: post.cta_label ?? "", ctaUrl: post.cta_url ?? "",
    }) }); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Ошибка закрепления"); }
    finally { setSaving(false); }
  }
  const demo: News = { id: "preview", title: draft.title || "Заголовок публикации", subtitle: draft.subtitle, category: draft.category, content: draft.content || "Текст появится здесь.", cover_url: draft.coverUrl || null, published_at: new Date().toISOString(), layout_style: draft.layoutStyle, is_pinned: draft.pinned, cta_label: draft.ctaLabel, cta_url: draft.ctaUrl };
  return <div className="k7-data-panel k7-news-studio">
    <div className="k7-panel-head"><div><div className="k7-panel-eyebrow">K7 / EDITORIAL TRANSMISSION</div><h2>Новости</h2></div>
      <button className="k7-panel-icon" type="button" disabled={loading} aria-label="Обновить новости" onClick={() => void reload()}><RefreshCw size={17}/></button></div>
    {canManage && <div className="k7-panel-toolbar"><button type="button" className="k7-panel-button k7-panel-primary" onClick={startNew}><Plus size={15}/> СОЗДАТЬ ПУБЛИКАЦИЮ</button></div>}
    <div ref={editorRef}/>
    {canManage && editorOpen && <div className="k7-editor-studio">
      <div className="k7-editor-head"><span>{editingId ? "РЕДАКТИРОВАНИЕ" : "НОВАЯ ПУБЛИКАЦИЯ"}</span><button type="button" onClick={() => setEditorOpen(false)} aria-label="Закрыть редактор"><X size={19}/></button></div>
      <form onSubmit={(event) => void save(event)} className="k7-panel-form k7-editor-form">
        <label>Рубрика<input maxLength={35} required value={draft.category} onChange={event => patch({ category: event.target.value })} placeholder="НОВОСТИ / ТУРНИР / КОМАНДА" /></label>
        <label>Стиль публикации<select value={draft.layoutStyle} onChange={event => patch({ layoutStyle: event.target.value as News["layout_style"] })}><option value="editorial">EDITORIAL · редакционная</option><option value="statement">STATEMENT · крупный заголовок</option><option value="spotlight">SPOTLIGHT · акцент на постере</option></select></label>
        <label className="k7-panel-wide">Заголовок<input maxLength={150} required value={draft.title} onChange={event => patch({ title: event.target.value })} placeholder="Главная мысль публикации" /></label>
        <label className="k7-panel-wide">Подзаголовок<input maxLength={220} value={draft.subtitle} onChange={event => patch({ subtitle: event.target.value })} placeholder="Короткое выразительное вступление" /></label>
        <label className="k7-panel-wide">Постер / изображение (HTTPS)<input type="url" value={draft.coverUrl} onChange={event => patch({ coverUrl: event.target.value })} placeholder="https://..." /></label>
        <div className="k7-panel-wide k7-editor-composer"><div className="k7-editor-toolbar"><button type="button" title="Жирный" onClick={() => insert("strong")}><Bold size={16}/></button><button type="button" title="Курсив" onClick={() => insert("italic")}><Italic size={16}/></button><button type="button" title="Подзаголовок" onClick={() => insert("title")}><Heading2 size={16}/></button><button type="button" title="Цитата" onClick={() => insert("quote")}><Quote size={16}/></button><button type="button" title="Список" onClick={() => insert("list")}><List size={16}/></button><button type="button" title="HTTPS-ссылка" onClick={() => insert("link")}><ExternalLink size={16}/></button></div>
          <label>Текст публикации<textarea ref={textareaRef} rows={8} required maxLength={20000} value={draft.content} onChange={event => patch({ content: event.target.value })} placeholder="Расскажи историю команды, выдели ключевые детали..."/><small>{draft.content.length} / 20000</small></label></div>
        <label>Кнопка действия<input maxLength={48} value={draft.ctaLabel} onChange={event => patch({ ctaLabel: event.target.value })} placeholder="Например: Подробнее" /></label>
        <label>Ссылка кнопки (HTTPS)<input type="url" value={draft.ctaUrl} onChange={event => patch({ ctaUrl: event.target.value })} placeholder="https://..." /></label>
        <label className="k7-editor-pin"><input type="checkbox" checked={draft.pinned} onChange={event => patch({ pinned: event.target.checked })}/> Закрепить публикацию наверху</label>
        <div className="k7-panel-wide k7-editor-actions"><button type="button" className="k7-panel-button" onClick={() => setPreview(old => !old)}><Eye size={16}/> {preview ? "СКРЫТЬ ПРЕВЬЮ" : "ПРЕДПРОСМОТР"}</button><button type="submit" className="k7-panel-button k7-panel-primary" disabled={saving || !draft.title.trim() || !draft.content.trim()}>{saving ? "СОХРАНЯЕМ..." : editingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "ОПУБЛИКОВАТЬ"}</button></div>
      </form>
      {preview && <div className="k7-editor-preview"><span>ПРЕДПРОСМОТР</span><NewsCard item={demo} canManage={false} onDelete={() => {}} onEdit={() => {}} onPin={() => {}} busy={false}/></div>}
    </div>}
    {error && <div className="k7-panel-error" role="alert">{error}</div>}
    {notice && <div className="k7-panel-notice" role="status">{notice}</div>}
    {!authReady && <div className="k7-panel-empty">Войдите через Telegram</div>}
    {loading && !posts.length && <div className="k7-panel-empty">Загрузка публикаций...</div>}
    {authReady && !loading && posts.length === 0 && !error && <div className="k7-panel-empty">Публикаций пока нет</div>}
    <div className="k7-news-feed">{posts.map(post => <NewsCard key={post.id} item={post} canManage={canManage} onEdit={startEdit} onDelete={(id) => void remove(id)} onPin={(item) => void togglePin(item)} busy={saving}/>)}</div>
  </div>;
}
