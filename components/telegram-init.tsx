
"use client";

import { useEffect } from "react";

export default function TelegramInit() {
  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      const telegram = (
        window as Window & {
          Telegram?: {
            WebApp?: any;
          };
        }
      ).Telegram?.WebApp;

      // Обычный браузер — никаких проверок Telegram
      if (!telegram) return;

      telegram.ready();
      telegram.expand();

      const initData = telegram.initData;

      // Если сайт открыт вне полноценного Mini App,
      // не блокируем просмотр публичных страниц.
      if (!initData) {
        console.warn("Telegram initData отсутствует");
        return;
      }

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ initData })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error("Telegram auth error:", result.error);
          return;
        }

        const profileResponse = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!profileResponse.ok) {
          console.error("Не удалось загрузить профиль");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Ошибка авторизации:", error);
        }
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
