
"use client";

import { useEffect } from "react";

export default function TelegramInit() {
  useEffect(() => {
    const telegram = window.Telegram?.WebApp;

    if (!telegram) {
      return;
    }

    telegram.ready();
    telegram.expand();
  }, []);

  return null;
}
