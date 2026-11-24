"use client";
import { useEffect, useRef } from "react";

// Session-authenticated polling. No public database keys, no overlapping scheduled requests.
export function useK7Sync(enabled: boolean, load: (silent: boolean) => Promise<void>, interval = 15000) {
  const current = useRef(load);
  useEffect(() => { current.current = load; }, [load]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, busy = false, first = true;
    let timer: number | undefined;
    // Small jitter spreads background section requests; chat keeps its exact cadence.
    const schedule = () => { if (!stopped) { window.clearTimeout(timer); timer = window.setTimeout(run, interval + (interval >= 10000 ? Math.floor(Math.random()*1500) : 0)); } };
    async function run() {
      if (stopped || busy) return;
      if (document.hidden || !navigator.onLine) { schedule(); return; }
      window.clearTimeout(timer); busy = true;
      try { await current.current(!first); first = false; } catch { /* loader owns its error state */ }
      finally { busy = false; schedule(); }
    }
    const resume = () => { if (!document.hidden && navigator.onLine) { window.clearTimeout(timer); timer=window.setTimeout(run,interval>=10000?Math.floor(Math.random()*350):0); } };
    void run();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [enabled, interval]);
}
