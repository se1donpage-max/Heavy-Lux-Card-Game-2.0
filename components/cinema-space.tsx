"use client";

import { useEffect, useRef } from "react";

// One persistent environment; chapter progress changes the camera, not the scene DOM.
const camera = [
  { x: -18, y: 8, roll: -7, scale: 1.05 },
  { x: 25, y: -12, roll: 4, scale: 1.18 },
  { x: -35, y: -25, roll: -3, scale: 1.32 },
  { x: 16, y: 12, roll: 7, scale: 1.12 },
  { x: 0, y: -35, roll: -5, scale: 1.40 },
  { x: 18, y: 0, roll: 0, scale: 1.16 },
];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function CinemaSpace() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slow = window.matchMedia("(update: slow)");
    let frame = 0;
    let anchors: number[] = [];
    let dirty = true;
    const measure = () => {
      anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]"), section => section.getBoundingClientRect().top + window.scrollY);
      dirty = false;
    };
    const render = () => {
      frame = 0;
      if (document.hidden) return;
      if (dirty) measure();
      if (!anchors.length) return;
      const position = window.scrollY + window.innerHeight * .24;
      let i = 0;
      while (i + 1 < anchors.length && position >= anchors[i + 1]) i++;
      i = Math.min(i, camera.length - 1);
      const next = Math.min(i + 1, anchors.length - 1, camera.length - 1);
      const fraction = next > i ? Math.max(0, Math.min(1, (position - anchors[i]) / Math.max(1, anchors[next] - anchors[i]))) : 0;
      const still = reduced.matches || slow.matches;
      const t = still ? 0 : fraction * fraction * (3 - 2 * fraction);
      const a = camera[still ? 0 : i];
      const b = camera[still ? 0 : Math.max(0, next)];
      const set = (name: string, value: number, unit = "") => node.style.setProperty(name, `${value.toFixed(3)}${unit}`);
      set("--cam-x", mix(a.x, b.x, t), "px");
      set("--cam-y", mix(a.y, b.y, t), "px");
      set("--cam-roll", mix(a.roll, b.roll, t), "deg");
      set("--cam-scale", mix(a.scale, b.scale, t));
      set("--cam-travel", still ? 0 : (i + fraction) * 32, "px");
      set("--cam-glow", still ? .65 : .62 + .22 * Math.sin((i + fraction) * 1.4));
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(render); };
    const invalidate = () => { dirty = true; schedule(); };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(invalidate) : null;
    observer?.observe(document.body);
    const mutation = typeof MutationObserver !== "undefined" ? new MutationObserver(invalidate) : null;
    // Admin-only section may mount after authorization; no attribute observation.
    if (node.parentElement) mutation?.observe(node.parentElement, { childList: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", invalidate);
    document.addEventListener("visibilitychange", invalidate);
    reduced.addEventListener?.("change", schedule);
    slow.addEventListener?.("change", schedule);
    schedule();
    return () => {
      observer?.disconnect(); mutation?.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", invalidate);
      document.removeEventListener("visibilitychange", invalidate);
      reduced.removeEventListener?.("change", schedule); slow.removeEventListener?.("change", schedule);
    };
  }, []);

  return <div ref={root} className="k7-cinema-space" aria-hidden="true">
    <div className="k7-cinema-halo" />
    <div className="k7-cinema-world">
      <svg className="k7-cinema-plane k7-cinema-far" viewBox="0 0 480 880" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M-160 80 240 365 640 80 M-160 850 240 365 640 850 M-160 420 240 365 640 420 M240 -150V1030" stroke="#fff" strokeWidth="1" opacity=".25" />
        <path d="M80 245 400 245 400 590 80 590Z M142 290 338 290 338 503 142 503Z M190 328 290 328 290 435 190 435Z" stroke="#fff" strokeWidth="1.2" opacity=".3" />
      </svg>
      <div className="k7-cinema-monument" />
      <svg className="k7-cinema-plane k7-cinema-mid" viewBox="0 0 480 880" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M-100 100 240 365 580 100 M-100 790 240 365 580 790 M-100 100V790 M580 100V790" stroke="#fff" strokeWidth="2" opacity=".43" />
        <path d="M30 190 450 190 450 690 30 690Z M100 258 380 258 380 550 100 550Z" stroke="#fff" strokeWidth="1.5" opacity=".26" />
        <path d="M-80 720 240 365 560 25 M-80 25 240 365 560 720" stroke="#fff" strokeWidth="2.5" opacity=".5" />
      </svg>
      <svg className="k7-cinema-plane k7-cinema-near" viewBox="0 0 480 880" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M-220 30 240 365 700 30 M-220 1020 240 365 700 1020 M-220 30V1020 M700 30V1020" stroke="#fff" strokeWidth="4" opacity=".55" />
        <path d="M-150 920 240 365 630 -180 M-150 -180 240 365 630 920" stroke="#fff" strokeWidth="2" opacity=".3" />
      </svg>
    </div>
    <div className="k7-cinema-vignette" />
  </div>;
}
