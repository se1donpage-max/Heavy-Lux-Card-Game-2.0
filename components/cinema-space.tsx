"use client";

import { useEffect, useRef } from "react";

// Scroll is the playback clock. No autoplay or competing animation timer.
export function CinemaSpace() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = root.current;
    const media = video.current;
    if (!node || !media) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slow = window.matchMedia("(update: slow)");
    let frame = 0;
    let timer = 0;
    let lastSeek = 0;
    const still = () => reduced.matches || slow.matches;
    const render = () => {
      frame = 0;
      if (document.hidden || still()) return;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, window.scrollY / max));
      node.style.setProperty("--cinema-y", `${(0.5 - progress) * 4}%`);
      node.style.setProperty("--cinema-scale", `${1.06 + 0.035 * Math.sin(progress * Math.PI)}`);
      if (!Number.isFinite(media.duration) || media.duration <= 0 || media.seeking) return;
      const target = progress * Math.max(0, media.duration - 1 / 30);
      if (Math.abs(media.currentTime - target) < 1 / 30) return;
      const wait = 65 - (performance.now() - lastSeek);
      if (wait > 0) {
        if (!timer) timer = window.setTimeout(() => { timer = 0; schedule(); }, wait);
        return;
      }
      lastSeek = performance.now();
      try { media.currentTime = target; } catch { /* Keep the poster on unsupported players. */ }
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(render); };
    const sync = () => {
      if (still()) { node.removeAttribute("data-video-ready"); return; }
      if (!media.getAttribute("src")) { media.src = "/k7-cinema/background.mp4"; media.load(); }
      if (media.readyState >= 2) node.setAttribute("data-video-ready", "true");
      schedule();
    };
    const ready = () => { if (!still()) node.setAttribute("data-video-ready", "true"); schedule(); };
    const failed = () => node.removeAttribute("data-video-ready");
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(document.body);
    media.addEventListener("loadeddata", ready);
    media.addEventListener("loadedmetadata", schedule);
    media.addEventListener("seeked", schedule);
    media.addEventListener("error", failed);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    slow.addEventListener("change", sync);
    sync();
    return () => {
      resize?.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(timer);
      media.removeEventListener("loadeddata", ready);
      media.removeEventListener("loadedmetadata", schedule);
      media.removeEventListener("seeked", schedule);
      media.removeEventListener("error", failed);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync); slow.removeEventListener("change", sync);
      media.pause(); media.removeAttribute("src"); media.load();
    };
  }, []);
  return <div ref={root} className="k7-cinema-space k7-video-space" aria-hidden="true">
    <div className="k7-video-camera">
      <video ref={video} muted playsInline preload="auto" poster="/k7-cinema/background.jpg" disablePictureInPicture disableRemotePlayback />
    </div>
    <div className="k7-video-shade" />
  </div>;
}
