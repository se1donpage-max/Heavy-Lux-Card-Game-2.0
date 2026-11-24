"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { UserRound, X, Pencil } from "lucide-react";
import { BrandLabel } from "@/components/brand-label";
import { useK7Sync } from "@/components/use-k7-sync";
import type { ProfileInput } from "@/lib/community-profile";
type Profile = { telegramId:number; own:boolean; username:string|null; telegramName:string; photoUrl:string|null; position:string; gameRole:string|null; slot:string|null; createdAt:string|null; days:number|null; gameId:string|null; gameNickname:string|null; displayName:string|null; ageYears:number|null; showName?:boolean; showAge?:boolean; statistics:{matches:number;wins:number;kills:number;winRate:number} };
const toDraft=(p:Profile):ProfileInput=>({gameId:p.gameId??"",gameNickname:p.gameNickname??"",displayName:p.displayName??"",ageYears:p.ageYears,showName:!!p.showName,showAge:!!p.showAge});
export function CommunityProfile({ id, onClose }: { id:number; onClose:()=>void }) {
  const [p,setP]=useState<Profile|null>(null), [draft,setDraft]=useState<ProfileInput|null>(null);
  const [tab,setTab]=useState<"profile"|"stats"|"settings">("profile"), [error,setError]=useState(""), [saving,setSaving]=useState(false), [notice,setNotice]=useState("");
  async function load(silent:boolean) {
    try { const res=await fetch(`/api/community/profile?id=${id}`,{credentials:"include",cache:"no-store"}); const data=await res.json(); if(!res.ok||!data.success) throw Error(data.error||"Ошибка загрузки"); setP(data.profile); if(!silent||!p) setError(""); }
    catch(e){if(!silent) setError(e instanceof Error?e.message:"Профиль недоступен");}
  }
  useK7Sync(true,load,15000);
  useEffect(()=>{const previous=document.body.style.overflow; const shell=document.querySelector<HTMLElement>(".k7-immersive-shell"); const previousInert=shell?.inert; document.body.style.overflow="hidden"; if(shell)shell.inert=true; const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose(); if(e.key==="Tab"){const focusable=Array.from(document.querySelectorAll<HTMLElement>(".k7-profile-overlay button:not(:disabled),.k7-profile-overlay input:not(:disabled),.k7-profile-overlay select:not(:disabled)")).filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}; document.addEventListener("keydown",escape); return()=>{document.body.style.overflow=previous;if(shell)shell.inert=!!previousInert;document.removeEventListener("keydown",escape);};},[onClose]);
  const edit=()=>{if(p?.own){setDraft(toDraft(p));setTab("settings");setNotice("");setError("");}};
  async function save(e:FormEvent){ e.preventDefault(); if(!draft||!p?.own||saving)return;setSaving(true);setError("");try{const res=await fetch("/api/community/profile",{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});const data=await res.json();if(!res.ok||!data.success)throw Error(data.error||"Ошибка сохранения");await load(false);setTab("profile");setNotice("Профиль сохранён");}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}finally{setSaving(false);}}
  const field=(label:string,value:string|number|null|undefined)=><div className="k7-profile-field"><span>{label}</span><strong>{value??"—"}</strong></div>;
  return createPortal(<div className="k7-profile-overlay" role="dialog" aria-modal="true" aria-label="Профиль участника">
    <div className="k7-profile-top"><img src="/k7-ui/brand-mark.png" alt="K7 CREW"/><span>K7 / PROFILE</span><button type="button" autoFocus onClick={onClose} aria-label="Закрыть профиль"><X size={22}/></button></div>
    <div className="k7-profile-content">
      {error&&<p role="alert" className="k7-panel-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
      {!p?<p>Загрузка профиля...</p>:<>
        <header className="k7-profile-card"><div className="k7-profile-avatar">{p.photoUrl?<img src={p.photoUrl} alt=""/>:<UserRound size={36}/>}</div><div><h1>{p.gameNickname||p.username||p.telegramName}</h1><p>{p.username?`@${p.username}`:"Telegram"}</p><strong>{p.position}{p.gameRole?` / ${p.gameRole}`:""}</strong></div></header>
        <div className="k7-profile-metrics"><div><small>Дней на площадке</small><strong>{p.days??"—"}</strong></div><div><small><BrandLabel text="Матчи" asset="sections/matches"/></small><strong>{p.statistics.matches}</strong></div></div>
        <nav className="k7-profile-tabs" aria-label="Навигация профиля"><button className={tab==="profile"?"selected":""} onClick={()=>setTab("profile")}>ПРОФИЛЬ</button><button className={tab==="stats"?"selected":""} onClick={()=>setTab("stats")}><BrandLabel text="Статистика" asset="nav/stats"/></button>{p.own&&<button className={tab==="settings"?"selected":""} onClick={edit}>НАСТРОЙКИ</button>}</nav>
        {tab==="profile"&&<section className="k7-profile-card k7-profile-fields">{field("Игровое ID",p.gameId)}{field("Игровой ник",p.gameNickname)}{field("Имя",p.displayName)}{field("Возраст",p.ageYears)}{field("Telegram",p.username?`@${p.username}`:null)}{field("Должность",p.position)}{field("Дата регистрации",p.createdAt?new Date(p.createdAt).toLocaleDateString("ru-RU"):null)}{p.own&&<button className="k7-profile-action" onClick={edit}><Pencil size={15}/> <BrandLabel text="Редактировать" asset="actions/edit"/></button>}</section>}
        {tab==="stats"&&<section className="k7-profile-card k7-profile-fields">{field("Матчи",p.statistics.matches)}{field("Победы",p.statistics.wins)}{field("Убийства",p.statistics.kills)}{field("Доля побед",`${p.statistics.winRate}%`)}{field("Игровая роль",p.gameRole)}{field("Должность",p.position)}{field("Дней на площадке",p.days)}</section>}
        {tab==="settings"&&p.own&&draft&&<form className="k7-profile-card k7-profile-fields" onSubmit={save}>
          <label>Игровое ID<input inputMode="numeric" maxLength={32} pattern="[0-9]*" value={draft.gameId} onChange={e=>setDraft({...draft,gameId:e.target.value.replace(/\D/g,"")})}/></label>
          <label>Игровой ник<input maxLength={40} value={draft.gameNickname} onChange={e=>setDraft({...draft,gameNickname:e.target.value})}/></label>
          <label>Имя<input maxLength={60} value={draft.displayName} onChange={e=>setDraft({...draft,displayName:e.target.value})}/></label>
          <label>Возраст<input type="number" min={1} max={120} step={1} value={draft.ageYears??""} onChange={e=>setDraft({...draft,ageYears:e.target.value===""?null:Number(e.target.value)})}/></label>
          <label>Telegram<input readOnly value={p.username?`@${p.username}`:"Не задан в Telegram"}/></label>
          <label className="k7-profile-check"><input type="checkbox" checked={draft.showName} onChange={e=>setDraft({...draft,showName:e.target.checked})}/> Показывать имя участникам</label>
          <label className="k7-profile-check"><input type="checkbox" checked={draft.showAge} onChange={e=>setDraft({...draft,showAge:e.target.checked})}/> Показывать возраст участникам</label>
          <button type="submit" className="k7-profile-action" disabled={saving}><BrandLabel text="Сохранить" asset="actions/save"/></button>
        </form>}
      </>}
    </div>
  </div>,document.body);
}
