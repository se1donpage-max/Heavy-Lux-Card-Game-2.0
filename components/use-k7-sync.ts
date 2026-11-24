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
    const schedule = () => { if (!stopped) { window.clearTimeout(timer); timer = window.setTimeout(run, interval); } };
    async function run() {
      if (stopped || busy) return;
      if (document.hidden || !navigator.onLine) { schedule(); return; }
      window.clearTimeout(timer); busy = true;
      try { await current.current(!first); first = false; } catch { /* loader owns its error state */ }
      finally { busy = false; schedule(); }
    }
    const resume = () => { if (!document.hidden && navigator.onLine) void run(); };
    void run();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [enabled, interval]);
}
