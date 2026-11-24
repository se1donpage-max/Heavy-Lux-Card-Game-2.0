"use client";

import { BrandLabel } from "@/components/brand-label";

const chapters = {
  chat: ["01 / CHAT", "STAY", "CONNECTED"],
  news: ["02 / NEWS", "STAY", "AHEAD"],
  events: ["03 / EVENTS", "OWN THE", "MOMENT"],
  roster: ["04 / TEAM ROSTER", "ONE CREW.", "ONE MISSION."],
  stats: ["05 / STATS", "NUMBERS", "DON’T LIE"],
  messages: ["K7 / ADMIN ONLY", "СООБЩЕНИЯ", ""],
} as const;

export function BrandChapter({ id }: { id: keyof typeof chapters }) {
  const [index, first, second] = chapters[id];
  return <div className={`k7-chapter k7-chapter-${id}`} aria-hidden="true">
    <div className="k7-chapter-index">{index}</div>
    <div className="k7-chapter-slogan"><BrandLabel text={first} />{second && <BrandLabel text={second} />}</div>
  </div>;
}
