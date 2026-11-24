// Approved section-specific template choices; no user-supplied style or font fields.
export const sectionTemplates = {
  news: [{label:"НОВОСТИ",style:"editorial"},{label:"ОБЪЯВЛЕНИЕ",style:"statement"},{label:"АНОНС",style:"statement"},{label:"ФОТОПУБЛИКАЦИЯ",style:"spotlight"}],
  chat: [{label:"ОФИЦИАЛЬНОЕ ОБЪЯВЛЕНИЕ",style:"statement"}],
  events: [{label:"ТУРНИР",style:"spotlight"},{label:"ТРЕНИРОВКА",style:"editorial"},{label:"СКРИМ",style:"editorial"},{label:"РАСПИСАНИЕ",style:"statement"}],
  roster: [{label:"ПРЕДСТАВЛЕНИЕ ИГРОКА",style:"spotlight"},{label:"ИЗМЕНЕНИЕ СОСТАВА",style:"editorial"},{label:"НАЗНАЧЕНИЕ КАПИТАНА",style:"statement"}],
  stats: [{label:"ИТОГИ МАТЧА",style:"editorial"},{label:"MVP",style:"spotlight"},{label:"РЕЙТИНГ",style:"editorial"},{label:"ДОСТИЖЕНИЕ",style:"statement"}],
} as const;
export type PublicationSection = keyof typeof sectionTemplates;
export function isPublicationSection(v:unknown): v is PublicationSection {return typeof v==="string"&&Object.prototype.hasOwnProperty.call(sectionTemplates,v);}
export const isK7Media = (v:string)=>/^\/api\/community\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
