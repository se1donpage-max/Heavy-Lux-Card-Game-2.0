"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./k7-intro.module.css";

export function K7Intro({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) { setVisible(false); return; }
    const finish = () => setVisible(false);
    const timeout = window.setTimeout(finish, 3000);
    const onPreference = () => { if (preference.matches) finish(); };
    preference.addEventListener("change", onPreference);
    video.current?.play().catch(finish);
    return () => {
      window.clearTimeout(timeout);
      preference.removeEventListener("change", onPreference);
    };
  }, []);
  return <>
    <div style={{ display: "contents" }} inert={visible}>{children}</div>
    {visible && <div className={styles.overlay} aria-hidden="true">
      <video ref={video} className={styles.video} src="/k7-intro/intro.mp4"
        autoPlay muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback
        onEnded={() => setVisible(false)} onError={() => setVisible(false)} />
    </div>}
  </>;
}
