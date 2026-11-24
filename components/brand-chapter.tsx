"use client";

import { useEffect, useRef } from "react";
import { BrandLabel } from "@/components/brand-label";
import type { BrandAssetId } from "@/lib/brand-assets";

const chapters = {
  chat: ["01 / CHAT", "STAY", "CONNECTED"],
  events: ["02 / EVENTS", "OWN THE", "MOMENT"],
  roster: ["03 / TEAM ROSTER", "ONE CREW.", "ONE MISSION."],
  news: ["04 / NEWS", "STAY", "AHEAD"],
  stats: ["05 / STATS", "NUMBERS", "DON’T LIE"],
  messages: ["K7 / ADMIN ONLY", "СООБЩЕНИЯ", ""],
} as const;
const marks: Record<keyof typeof chapters, BrandAssetId> = {
  chat: "cinema/chat_label", events: "cinema/events_label", roster: "cinema/roster_label", news: "cinema/news_label", stats: "cinema/stats_label", messages: "status/admin_only",
};

export function BrandChapter({ id }: { id: keyof typeof chapters }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const limited = window.matchMedia("(update: slow)");
    let frame = 0, visible = false;
    const render = () => {
      frame = 0;
      if (!visible || document.hidden || reduce.matches || limited.matches) { node.style.removeProperty("--k7-shift"); return; }
      const bounds = node.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (window.innerHeight * .5 - bounds.top - bounds.height * .5) / Math.max(1, window.innerHeight)));
      node.style.setProperty("--k7-shift", `${Math.round(progress * 32)}px`);
    };
    const schedule = () => { if (!frame && visible) frame = requestAnimationFrame(render); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); });
    observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    reduce.addEventListener?.("change", schedule);
    limited.addEventListener?.("change", schedule);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); document.removeEventListener("visibilitychange", schedule); reduce.removeEventListener?.("change", schedule); limited.removeEventListener?.("change", schedule); };
  }, []);
  const [index, first, second] = chapters[id];
  return <div ref={ref} className={`k7-chapter k7-chapter-${id}`} aria-hidden="true">
    <div className="k7-chapter-geometry" />
    <div className="k7-chapter-index"><BrandLabel text={index} asset={marks[id]} /></div>
    <div className="k7-chapter-slogan"><BrandLabel text={first} />{second && <BrandLabel text={second} />}</div>
  </div>;
}
