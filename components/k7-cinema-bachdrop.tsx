"use client";

import { useEffect, useRef } from "react";

/**
 * K7 CREW CINEMA / one continuous visual layer for all five chapters.
 * ws2.GIF was packed into one WebP sprite atlas (84 frames). The scroll
 * position controls the frame in both directions. No autoplay, network services or
 * changes to Telegram authentication / API / Supabase are involved.
 */
// English-only kinetic background slogans. UI language and server data are unchanged.
const CHAPTERS = [
  { id: "chat", label: "01 / CHAT", first: "STAY", second: "CONNECTED" },
  { id: "events", label: "02 / EVENTS", first: "OWN THE", second: "MOMENT" },
  { id: "roster", label: "03 / TEAM ROSTER", first: "ONE CREW.", second: "ONE MISSION." },
  { id: "news", label: "04 / NEWS", first: "STAY", second: "AHEAD" },
  { id: "stats", label: "05 / STATS", first: "NUMBERS", second: "DON'T LIE" },
] as const;

// One WebP atlas replaces 84 separate files. Frame 0..83, 7 columns by 12 rows.
const FRAME_COUNT = 84;
const COLS = 7;
const TILE_WIDTH = 512;
const TILE_HEIGHT = 288;
const ATLAS_URL = "/ws2-atlas.webp";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smoothstep = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export default function K7CinemaBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headlineRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = CHAPTERS.map((chapter) => document.getElementById(chapter.id));
    const atlas = new window.Image();
    atlas.decoding = "async";
    let ready = false;
    let raf = 0;
    let lastFrame = -1;
    let disposed = false;

    function schedule() {
      if (!raf && !document.hidden && !disposed) raf = window.requestAnimationFrame(render);
    }

    function render() {
      raf = 0;
      if (disposed || document.hidden) return;
      const vw = window.innerWidth || 390;
      const vh = window.innerHeight || 800;
      const maxTravel = Math.max(1, document.documentElement.scrollHeight - vh);
      const progress = clamp(window.scrollY / maxTravel);
      const desired = reduce.matches ? 29 : Math.round(progress * (FRAME_COUNT - 1));

      const dpr = Math.min(window.devicePixelRatio || 1, vw < 740 ? 1.2 : 1.45);
      const width = Math.max(1, Math.round(canvas!.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas!.clientHeight * dpr));
      const resized = canvas!.width !== width || canvas!.height !== height;
      if (resized) { canvas!.width = width; canvas!.height = height; }

      if (ready && (resized || desired !== lastFrame)) {
        context!.fillStyle = "#050607";
        context!.fillRect(0, 0, width, height);
        const scale = Math.max(width / TILE_WIDTH, height / TILE_HEIGHT);
        const dw = TILE_WIDTH * scale;
        const dh = TILE_HEIGHT * scale;
        context!.imageSmoothingEnabled = true;
        context!.imageSmoothingQuality = "high";
        context!.drawImage(
          atlas,
          (desired % COLS) * TILE_WIDTH,
          Math.floor(desired / COLS) * TILE_HEIGHT,
          TILE_WIDTH, TILE_HEIGHT,
          (width - dw) / 2, (height - dh) / 2, dw, dh
        );
        lastFrame = desired;
        canvas!.classList.add("is-ready");
      }

      const focus = vh * .42;
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const headline = headlineRefs.current[i];
        if (!section || !headline) continue;
        const bounds = section.getBoundingClientRect();
        const fadeIn = smoothstep((focus - bounds.top + vh * .32) / (vh * .64));
        const fadeOut = smoothstep((bounds.bottom - focus + vh * .32) / (vh * .64));
        const weight = clamp(fadeIn * fadeOut);
        const t = clamp((focus - bounds.top) / Math.max(bounds.height, 1));
        const motion = reduce.matches ? .5 : t;
        const shift = motion - .5;
        const opacity = reduce.matches ? (weight > .5 ? .25 : 0) : (weight * (.22 + .10 * Math.sin(t * Math.PI)));
        const scale = .87 + motion * .22;
        const x = shift * (i % 2 ? -75 : 75);
        const y = shift * (i % 2 ? 68 : -72);
        headline.style.opacity = opacity.toFixed(3);
        headline.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
        headline.style.filter = `brightness(${(.7 + weight * .6).toFixed(3)})`;
      }
    }

    atlas.onload = () => { if (!disposed) { ready = true; schedule(); } };
    atlas.onerror = () => { /* Keep the dark CSS fallback if the file is missing. */ };
    atlas.src = ATLAS_URL;

    const onVisible = () => { if (!document.hidden) schedule(); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", onVisible);
    reduce.addEventListener("change", schedule);
    schedule();

    return () => {
      disposed = true;
      atlas.onload = null;
      atlas.onerror = null;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      reduce.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div className="k7-cinema-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="k7-cinema-ocean" />
      <div className="k7-cinema-darkening" />
      <div className="k7-cinema-slogans">
        {CHAPTERS.map((chapter, index) => (
          <div
            key={chapter.id}
            ref={(element) => { headlineRefs.current[index] = element; }}
            className={`k7-cinema-slogan k7-cinema-slogan--${chapter.id}`}
            style={{ opacity: index === 0 ? .13 : 0 }}
          >
            <span className="k7-cinema-slogan-label">{chapter.label}</span>
            <strong className="k7-cinema-slogan-first">{chapter.first}</strong>
            <strong className="k7-cinema-slogan-second">{chapter.second}</strong>
          </div>
        ))}
      </div>
      <div className="k7-cinema-foreground-vignette" />
    </div>
  );
}
