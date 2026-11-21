
"use client";

import { useState } from "react";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
  Menu
} from "lucide-react";

const tabs = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "roster", label: "Roster", icon: Users },
  { id: "news", label: "News", icon: Newspaper },
  { id: "stats", label: "Stats", icon: Trophy }
] as const;

type TabId = (typeof tabs)[number]["id"];

const tabTitles: Record<TabId, string> = {
  chat: "COMMUNITY CHAT",
  events: "TEAM EVENTS",
  roster: "TEAM ROSTER",
  news: "LATEST NEWS",
  stats: "TEAM STATISTICS"
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("roster");

  return (
    <main className="crew-container relative overflow-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/k7-logo.jpeg"
              alt="K7 CREW"
              className="w-12 h-12 object-contain rounded-lg"
            />

            <div>
              <h1 className="text-lg font-black tracking-wider">
                K7 <span className="text-red-600">CREW</span>
              </h1>
              <p className="text-[9px] text-gray-500 tracking-[2px] font-bold">
                PUBG MOBILE ESPORTS
              </p>
            </div>
          </div>

          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10"
            aria-label="Меню"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <section className="relative min-h-[calc(100vh-145px)] px-5 pt-7 pb-8">
        {/* SUBTLE LOGO WATERMARK */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img
            src="/k7-logo.jpeg"
            alt=""
            aria-hidden="true"
            className="w-[85%] max-w-[420px] object-contain opacity-[0.045]"
          />
        </div>

        <div className="relative z-10">
          {/* SECTION TITLE */}
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1 h-5 bg-red-600 rounded-full" />
              <span className="text-[10px] tracking-[3px] font-black text-gray-500">
                K7 CREW / {activeTab.toUpperCase()}
              </span>
            </div>

            <h2 className="text-2xl font-black tracking-wide">
              {tabTitles[activeTab]}
            </h2>

            <p className="text-xs text-gray-500 mt-2 tracking-wide">
              SILENT MOVES. DEADLY RESULTS.
            </p>
          </div>

          {/* TAB CONTENT */}
          {activeTab === "roster" && (
            <div className="crew-card p-5">
              <div className="text-xs font-black tracking-widest text-gray-400">
                OFFICIAL TEAM LINEUP
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold">MAIN ROSTER</span>
                  <span className="text-xs text-red-500 font-bold">
                    4 SLOTS
                  </span>
                </div>

                {[1, 2, 3, 4].map((number) => (
                  <div
                    key={number}
                    className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.035] border border-white/[0.06]"
                  >
                    <span className="text-red-600 font-black">
                      0{number}
                    </span>
                    <span className="text-sm text-gray-500">
                      Свободный слот
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="font-bold">SUB ROSTER</span>
                <span className="text-xs text-gray-500 font-bold">
                  3 SLOTS
                </span>
              </div>

              {[1, 2, 3].map((number) => (
                <div
                  key={number}
                  className="flex items-center gap-3 mt-3 p-4 rounded-lg bg-white/[0.035] border border-white/[0.06]"
                >
                  <span className="text-gray-500 font-black">
                    S{number}
                  </span>
                  <span className="text-sm text-gray-500">
                    Свободный слот
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="crew-card p-5 text-center">
              <MessageCircle
                size={34}
                className="mx-auto text-red-600 mb-4"
              />
              <h3 className="font-black">COMMUNITY CHAT</h3>
              <p className="text-sm text-gray-500 mt-2">
                Сообщений пока нет
              </p>
            </div>
          )}

          {activeTab === "events" && (
            <div className="crew-card p-5 text-center">
              <CalendarDays
                size={34}
                className="mx-auto text-red-600 mb-4"
              />
              <h3 className="font-black">TEAM EVENTS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Предстоящих мероприятий пока нет
              </p>
            </div>
          )}

          {activeTab === "news" && (
            <div className="crew-card p-5 text-center">
              <Newspaper
                size={34}
                className="mx-auto text-red-600 mb-4"
              />
              <h3 className="font-black">LATEST NEWS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Новостей пока нет
              </p>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="crew-card p-5 text-center">
              <Trophy
                size={34}
                className="mx-auto text-red-600 mb-4"
              />
              <h3 className="font-black">TEAM STATISTICS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Статистика появится после первых матчей
              </p>
            </div>
          )}
        </div>
      </section>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-t border-white/10 safe-bottom">
        <div className="max-w-[600px] mx-auto grid grid-cols-5 px-2 pt-2 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center gap-1 py-2"
              >
                <Icon
                  size={21}
                  strokeWidth={selected ? 2.5 : 1.7}
                  className={
                    selected ? "text-red-600" : "text-gray-500"
                  }
                />

                <span
                  className={`text-[9px] font-bold tracking-wide ${
                    selected ? "text-white" : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </span>

                <span
                  className={`w-4 h-[2px] rounded-full ${
                    selected ? "bg-red-600" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
