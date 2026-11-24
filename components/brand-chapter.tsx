"use client";

import { useEffect, useRef } from "react";

const chapters = ["chat", "news", "events", "roster", "stats", "messages"] as const;
type Chapter = (typeof chapters)[number];
let cinemaEpoch: number | undefined;

export function BrandChapter({ id }: { id: Chapter }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    cinemaEpoch ??= performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slow = window.matchMedia("(update: slow)");
    let disposed = false;
    let pending = false;
    const allowed = () => !document.hidden && !reduced.matches && !slow.matches;
    const align = () => {
      if (!allowed() || !Number.isFinite(media.duration) || media.duration <= 0 || media.seeking) return;
      const target = ((performance.now() - (cinemaEpoch ?? 0)) / 1000) % media.duration;
      const delta = Math.abs(media.currentTime - target);
      if (Math.min(delta, media.duration - delta) > .35) {
        try { media.currentTime = target; } catch { /* Browser may defer seeking. */ }
      }
    };
    const sync = () => {
      if (disposed) return;
      if (!allowed()) {
        media.pause();
        if (reduced.matches || slow.matches) media.removeAttribute("data-playing");
        return;
      }
      if (pending || !media.paused) return;
      media.muted = true;
      align();
      pending = true;
      void media.play().catch(() => { /* Keep poster; retry on foreground or interaction. */ }).finally(() => {
        pending = false;
        if (!disposed && !allowed()) media.pause();
      });
    };
    const playing = () => {
      if (!allowed()) { media.pause(); return; }
      align();
      media.setAttribute("data-playing", "true");
    };
    const failed = () => media.removeAttribute("data-playing");
    media.addEventListener("playing", playing);
    media.addEventListener("loadedmetadata", align);
    media.addEventListener("error", failed);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("pointerdown", sync, { passive: true });
    reduced.addEventListener("change", sync);
    slow.addEventListener("change", sync);
    sync();
    return () => {
      disposed = true;
      media.pause();
      media.removeEventListener("playing", playing);
      media.removeEventListener("loadedmetadata", align);
      media.removeEventListener("error", failed);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("pointerdown", sync);
      reduced.removeEventListener("change", sync);
      slow.removeEventListener("change", sync);
    };
  }, [id]);
  return <div className={`k7-chapter k7-chapter-${id} k7-motion-chapter`} aria-hidden="true" style={{ backgroundImage: `url(/k7-motion/${id}.jpg)` }}>
    <video ref={ref} src={`/k7-motion/${id}.mp4`} autoPlay muted loop playsInline preload="auto" poster={`/k7-motion/${id}.jpg`} disablePictureInPicture disableRemotePlayback />
  </div>;
}
