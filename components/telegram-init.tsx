"use client";

import { useEffect, useState } from "react";

type AuthStatus = "loading" | "success" | "error";

export default function TelegramInit() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      try {
        const telegram = (
          window as Window & {
            Telegram?: {
              WebApp?: any;
            };
          }
        ).Telegram?.WebApp;

        if (!telegram) {
          throw new Error("Откройте приложение через Telegram");
        }

        telegram.ready();
        telegram.expand();

        const initData = telegram.initData;

        if (!initData) {
          throw new Error("Не удалось получить данные Telegram");
        }

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
          throw new Error(result.error || "Ошибка авторизации");
        }

        const profileResponse = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!profileResponse.ok) {
          throw new Error("Не удалось загрузить профиль");
        }

        if (!cancelled) {
          setStatus("success");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка авторизации"
          );
          setStatus("error");
        }
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "success") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#080808",
        color: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center"
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: 3
        }}
      >
        K7 <span style={{ color: "#e32636" }}>CREW</span>
      </div>

      {status === "loading" ? (
        <p style={{ color: "#888", marginTop: 20 }}>
          Проверка авторизации...
        </p>
      ) : (
        <>
          <p style={{ color: "#e32636", marginTop: 20 }}>
            Ошибка входа
          </p>

          <p style={{ color: "#aaa" }}>
            {errorMessage}
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "12px 24px",
              border: 0,
              borderRadius: 8,
              background: "#e32636",
              color: "#fff",
              fontWeight: 700
            }}
          >
            Повторить
          </button>
        </>
      )}
    </div>
  );
}
