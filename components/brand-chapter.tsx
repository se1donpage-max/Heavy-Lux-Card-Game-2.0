"use client";

import { useEffect, useRef } from "react";

const chapters = ["chat", "news", "events", "roster", "stats", "messages"] as const;
type Chapter = (typeof chapters)[number];

export function BrandChapter({ id }: { id: Chapter }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slow = window.matchMedia("(update: slow)");
    let visible = false;
    let disposed = false;
    let generation = 0;
    const sync = () => {
      const request = ++generation;
      if (!visible || document.hidden || reduced.matches || slow.matches) {
        media.pause();
        if (reduced.matches || slow.matches) media.removeAttribute("data-playing");
        return;
      }
      if (!media.getAttribute("src")) media.src = `/k7-motion/${id}.mp4`;
      media.muted = true;
      void media.play().then(() => {
        if (disposed || request !== generation) return;
        media.setAttribute("data-playing", "true");
      }).catch(() => {
        if (!disposed && request === generation) media.removeAttribute("data-playing");
      });
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
      sync();
    }, { threshold: [0, 0.55] });
    observer?.observe(media);
    const failed = () => media.removeAttribute("data-playing");
    media.addEventListener("error", failed);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync); slow.addEventListener("change", sync);
    return () => {
      disposed = true; generation++; observer?.disconnect(); media.pause();
      media.removeEventListener("error", failed);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync); slow.removeEventListener("change", sync);
      media.removeAttribute("src"); media.load();
    };
  }, [id]);
  return <div className={`k7-chapter k7-chapter-${id} k7-motion-chapter`} aria-hidden="true" style={{ backgroundImage: `url(/k7-motion/${id}.jpg)` }}>
    <video ref={ref} muted loop playsInline preload="none" poster={`/k7-motion/${id}.jpg`} disablePictureInPicture disableRemotePlayback />
  </div>;
}
