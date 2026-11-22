"use client";
import { useEffect, useRef } from "react";

type Scene = "chat" | "events" | "roster" | "news" | "stats" | "messages";
type Drop = { x: number; y: number; length: number; speed: number; alpha: number; layer: number };

/** Single low-resolution rain layer, never intercepts touch. 22 fps, paused in background. */
export default function CinemaWeather({ scene }: { scene: Scene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { context.clearRect(0, 0, canvas.width, canvas.height); return; }
    const motion = true;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const count = !motion ? 0 : memory <= 2 ? 25 : 60;
    const drops: Drop[] = Array.from({ length: count }, (_, i) => ({
      x: ((i * 107 + 13) % 101) / 101,
      y: ((i * 73 + 17) % 107) / 107,
      length: 8 + i % 22,
      speed: 160 + (i * 23) % 265,
      alpha: .045 + (i % 6) * .027,
      layer: i % 3,
    }));
    let width = 0, height = 0, raf = 0, last = 0, elapsed = 0, dead = false;
    function resize() {
      if (!canvas || !context) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, memory <= 2 ? .65 : 1);
      width = canvas.clientWidth; height = canvas.clientHeight;
      const pw = Math.max(1, Math.round(width * pixelRatio));
      const ph = Math.max(1, Math.round(height * pixelRatio));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    function draw(time: number) {
      if (!context || !canvas || dead) return;
      raf = 0;
      if (document.hidden) return;
      if (time - last < 44) { raf = requestAnimationFrame(draw); return; }
      const dt = Math.min(.06, (time - (last || time)) / 1000); last = time;
      elapsed += dt;
      const currentScene = sceneRef.current;
      const intensity = currentScene === "events" ? 1 : currentScene === "stats" ? .7 : currentScene === "news" ? .58 : currentScene === "roster" ? .38 : currentScene === "messages" ? .26 : .52;
      context.clearRect(0, 0, width, height);
      if (motion) {
        for (const drop of drops) {
          drop.y += drop.speed * dt / Math.max(height, 1);
          if (drop.y > 1.06) { drop.y = -.08; drop.x = (drop.x + .371) % 1; }
          const x = drop.x * width;
          const y = drop.y * height;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x - drop.length * .18, y + drop.length);
          context.strokeStyle = `rgba(222,234,246,${(drop.alpha * intensity).toFixed(3)})`;
          context.lineWidth = drop.layer === 0 ? .7 : 1.15;
          context.stroke();
        }
      }
      // Brief directional lightning, no full-screen white flash or strobe.
      if (motion && (currentScene === "events" || currentScene === "news")) {
        const phase = elapsed % 14.8;
        const flash = (phase > 9.35 && phase < 9.43) || (phase > 9.55 && phase < 9.62);
        if (flash) {
          const gradient = context.createLinearGradient(width * .9, 0, width * .32, height);
          gradient.addColorStop(0, "rgba(210,224,250,.19)");
          gradient.addColorStop(.65, "rgba(170,186,216,.04)");
          gradient.addColorStop(1, "rgba(170,186,216,0)");
          context.fillStyle = gradient;
          context.fillRect(0, 0, width, height);
          context.beginPath();
          context.moveTo(width * .87, 0); context.lineTo(width * .75, height * .22);
          context.lineTo(width * .81, height * .34); context.lineTo(width * .62, height * .6);
          context.strokeStyle = "rgba(239,245,255,.36)"; context.lineWidth = 1.3; context.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    const request = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(draw); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const visibility = () => document.hidden ? stop() : request();
    resize(); request();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => { dead = true; stop(); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <canvas ref={canvasRef} className="k7-weather-canvas" aria-hidden="true" />;
}
