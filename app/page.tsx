
"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
  Menu,
  Crown,
  RefreshCw
} from "lucide-react";

const tabs = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "roster", label: "Roster", icon: Users },
  { id: "news", label: "News", icon: Newspaper },
  { id: "stats", label: "Stats", icon: Trophy }
] as const;

type TabId = (typeof tabs)[number]["id"];

interface RosterPlayer {
  id: string;
  telegram_id: number;
  slot: string;
  game_role: string;
  in_game_id: string | null;
  is_captain: boolean;
  joined_at: string;
  profiles: {
    first_name: string;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
  } | null;
}

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];

const roleNames: Record<string, string> = {
  FLEX: "FLEX",
  IGL: "IGL",
  SUPPORT: "SUPPORT",
  FRAGGER: "FRAGGER",
  SNIPER: "SNIPER"
};

const slotNames: Record<string, string> = {
  MAIN_1: "MAIN 1",
  MAIN_2: "MAIN 2",
  MAIN_3: "MAIN 3",
  MAIN_4: "MAIN 4",
  SUB_1: "SUB 1",
  SUB_2: "SUB 2",
  SUB_3: "SUB 3"
};

const tabTitles: Record<TabId, string> = {
  chat: "COMMUNITY CHAT",
  events: "TEAM EVENTS",
  roster: "TEAM ROSTER",
  news: "LATEST NEWS",
  stats: "TEAM STATISTICS"
};

function PlayerSlot({
  slot,
  player
}: {
  slot: string;
  player?: RosterPlayer;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.025] border border-dashed border-white/10">
        <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-gray-600">
          {slot.endsWith("1") ? "01" :
           slot.endsWith("2") ? "02" :
           slot.endsWith("3") ? "03" : "04"}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-500">
            Свободный слот
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            {slotNames[slot]}
          </div>
        </div>

        <div className="ml-auto text-[9px] tracking-wider text-gray-600">
          OPEN
        </div>
      </div>
    );
  }

  const profile = player.profiles;
  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "Участник K7 CREW";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.045] border border-white/10">
      {profile?.photo_url ? (
        <img
          src={profile.photo_url}
          alt=""
          className="w-11 h-11 rounded-lg object-cover"
        />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-neutral-800 flex items-center justify-center font-black text-red-500">
          K7
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold truncate">{name}</span>
          {player.is_captain && (
            <Crown size={13} className="text-red-500 shrink-0" />
          )}
        </div>

        <div className="text-[10px] text-gray-500 mt-1">
          {profile?.username ? `@${profile.username}` : "K7 CREW"}
          {player.in_game_id ? ` · ID: ${player.in_game_id}` : ""}
        </div>

        <div className="text-[10px] text-red-500 font-bold tracking-wider mt-1">
          {roleNames[player.game_role] ?? player.game_role}
          {player.is_captain ? " · CAPTAIN" : ""}
        </div>
      </div>

      <div className="text-[9px] text-gray-500 font-bold shrink-0">
        {slotNames[player.slot] ?? player.slot}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("roster");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState("");

  async function loadRoster() {
    try {
      setLoadingRoster(true);
      setRosterError("");

      const response = await fetch("/api/roster", {
        credentials: "include",
        cache: "no-store"
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Не удалось загрузить состав");
      }

      setRoster(result.roster ?? []);
    } catch (error) {
      setRosterError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки состава"
      );
    } finally {
      setLoadingRoster(false);
    }
  }

  useEffect(() => {
    loadRoster();
  }, []);

  function renderRosterSlots(slots: string[]) {
    return slots.map((slot) => (
      <PlayerSlot
        key={slot}
        slot={slot}
        player={roster.find((player) => player.slot === slot)}
      />
    ));
  }

  return (
    <main className="crew-container relative overflow-hidden">
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
            aria-label="Меню"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <section className="relative min-h-[calc(100vh-145px)] px-5 pt-7 pb-8">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img
            src="/k7-logo.jpeg"
            alt=""
            aria-hidden="true"
            className="w-[85%] max-w-[420px] object-contain opacity-[0.045]"
          />
        </div>

        <div className="relative z-10">
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

          {activeTab === "roster" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-bold tracking-widest">
                    OFFICIAL LINEUP
                  </div>
                  <div className="text-sm font-black mt-1">
                    {roster.length} / 7 PLAYERS
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadRoster}
                  disabled={loadingRoster}
                  className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={loadingRoster ? "animate-spin" : ""}
                  />
                  Обновить
                </button>
              </div>

              {rosterError && (
                <div className="crew-card p-4">
                  <p className="text-sm text-red-500 font-bold">
                    Не удалось загрузить состав
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {rosterError}
                  </p>
                  <button
                    type="button"
                    onClick={loadRoster}
                    className="text-xs text-white mt-3 underline"
                  >
                    Повторить
                  </button>
                </div>
              )}

              {loadingRoster ? (
                <div className="crew-card p-6 text-center text-gray-500">
                  Загрузка состава...
                </div>
              ) : !rosterError ? (
                <>
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black tracking-widest">
                        MAIN ROSTER
                      </h3>
                      <span className="text-[10px] text-red-500 font-bold">
                        {roster.filter((p) => p.slot.startsWith("MAIN_")).length} / 4
                      </span>
                    </div>

                    <div className="space-y-2">
                      {renderRosterSlots(mainSlots)}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black tracking-widest">
                        SUBSTITUTE ROSTER
                      </h3>
                      <span className="text-[10px] text-gray-500 font-bold">
                        {roster.filter((p) => p.slot.startsWith("SUB_")).length} / 3
                      </span>
                    </div>

                    <div className="space-y-2">
                      {renderRosterSlots(subSlots)}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="crew-card p-5 text-center">
              <MessageCircle size={34} className="mx-auto text-red-600 mb-4" />
              <h3 className="font-black">COMMUNITY CHAT</h3>
              <p className="text-sm text-gray-500 mt-2">
                Сообщений пока нет
              </p>
            </div>
          )}

          {activeTab === "events" && (
            <div className="crew-card p-5 text-center">
              <CalendarDays size={34} className="mx-auto text-red-600 mb-4" />
              <h3 className="font-black">TEAM EVENTS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Предстоящих мероприятий пока нет
              </p>
            </div>
          )}

          {activeTab === "news" && (
            <div className="crew-card p-5 text-center">
              <Newspaper size={34} className="mx-auto text-red-600 mb-4" />
              <h3 className="font-black">LATEST NEWS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Новостей пока нет
              </p>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="crew-card p-5 text-center">
              <Trophy size={34} className="mx-auto text-red-600 mb-4" />
              <h3 className="font-black">TEAM STATISTICS</h3>
              <p className="text-sm text-gray-500 mt-2">
                Статистика появится после первых матчей
              </p>
            </div>
          )}
        </div>
      </section>

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
                  className={selected ? "text-red-600" : "text-gray-500"}
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
