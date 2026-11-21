
"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
  Crown,
  RefreshCw,
  ArrowUpRight,
  Menu,
  X,
  Shield,
  Crosshair,
  Target,
  ChevronRight,
  Swords
} from "lucide-react";

const tabs = [
  { id: "chat", label: "CHAT", icon: MessageCircle },
  { id: "events", label: "EVENTS", icon: CalendarDays },
  { id: "roster", label: "ROSTER", icon: Users },
  { id: "news", label: "NEWS", icon: Newspaper },
  { id: "stats", label: "STATS", icon: Trophy }
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
  IGL: "IN-GAME LEADER",
  SUPPORT: "SUPPORT",
  FRAGGER: "FRAGGER",
  SNIPER: "SNIPER"
};

const tabTitles: Record<TabId, string> = {
  chat: "COMMUNITY",
  events: "COMPETITION",
  roster: "THE ROSTER",
  news: "LATEST INTEL",
  stats: "PERFORMANCE"
};

function PlayerCard({
  player,
  index
}: {
  player?: RosterPlayer;
  index: number;
}) {
  const slot = player?.slot ?? `OPEN_${index}`;
  const profile = player?.profiles;

  if (!player) {
    return (
      <div className="elite-player elite-player-open">
        <div className="elite-player-number">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="elite-player-info">
          <span className="elite-player-name">OPEN POSITION</span>
          <span className="elite-player-role">AWAITING RECRUITMENT</span>
        </div>
        <span className="elite-open-label">OPEN</span>
      </div>
    );
  }

  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "K7 CREW MEMBER";

  return (
    <article className="elite-player">
      <div className="elite-player-number">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="elite-player-avatar">
        {profile?.photo_url ? (
          <img src={profile.photo_url} alt="" />
        ) : (
          <span>K7</span>
        )}
      </div>

      <div className="elite-player-info">
        <div className="elite-player-name-row">
          <h4 className="elite-player-name">{name}</h4>
          {player.is_captain && (
            <Crown size={14} className="elite-captain-icon" />
          )}
        </div>

        <div className="elite-player-meta">
          {profile?.username
            ? `@${profile.username}`
            : "K7 CREW"}
          {player.in_game_id
            ? ` / PUBG ID: ${player.in_game_id}`
            : ""}
        </div>

        <div className="elite-player-role">
          {roleNames[player.game_role] ?? player.game_role}
          {player.is_captain ? " / CAPTAIN" : ""}
        </div>
      </div>

      <div className="elite-player-slot">
        {slot.replace("_", " ")}
      </div>
    </article>
  );
}

function EmptySection({
  icon: Icon,
  title,
  description
}: {
  icon: typeof MessageCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="elite-empty">
      <div className="elite-empty-icon">
        <Icon size={28} strokeWidth={1.3} />
      </div>
      <span className="elite-kicker">K7 CREW / IN DEVELOPMENT</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("roster");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
        throw new Error(result.error || "Unable to load roster");
      }

      setRoster(result.roster ?? []);
    } catch (error) {
      setRosterError(
        error instanceof Error
          ? error.message
          : "Roster loading error"
      );
    } finally {
      setLoadingRoster(false);
    }
  }

  useEffect(() => {
    loadRoster();
  }, []);

  const mainPlayers = roster.filter((p) =>
    mainSlots.includes(p.slot)
  );

  const substitutePlayers = roster.filter((p) =>
    subSlots.includes(p.slot)
  );

  const activeTitle = tabTitles[activeTab];

  function changeTab(tab: TabId) {
    setActiveTab(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="elite-shell">
      <header className="elite-header">
        <div className="elite-header-inner">
          <button
            className="elite-brand"
            onClick={() => changeTab("roster")}
            aria-label="K7 CREW home"
          >
            <span className="elite-brand-mark">K7</span>
            <span className="elite-brand-copy">
              <strong>K7 CREW</strong>
              <small> PUBG MOBILE ESPORTS</small>
            </span>
          </button>

          <nav className="elite-desktop-nav">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => changeTab(tab.id)}
                  className={
                    activeTab === tab.id
                      ? "elite-nav-link active"
                      : "elite-nav-link"
                  }
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <button
            className="elite-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {menuOpen && (
          <div className="elite-mobile-menu">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => changeTab(tab.id)}
                  className={
                    activeTab === tab.id
                      ? "elite-mobile-menu-link active"
                      : "elite-mobile-menu-link"
                  }
                >
                  <Icon size={17} />
                  {tab.label}
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="elite-content">
        <section className="elite-hero">
          <div className="elite-hero-top">
            <span className="elite-kicker">
              INDEPENDENT ESPORTS ORGANIZATION
            </span>
            <span className="elite-hero-index">EST. K7</span>
          </div>

          <div className="elite-hero-main">
            <div className="elite-hero-title">
              <span>BUILT</span>
              <span className="elite-hero-outline">TO</span>
              <span>DOMINATE<span className="elite-period">.</span></span>
            </div>

            <div className="elite-hero-side">
              <div className="elite-hero-emblem">
                <img src="/k7-logo.jpeg" alt="K7 CREW" />
              </div>
              <span className="elite-vertical-text">
                PUBG MOBILE / ESPORTS
              </span>
            </div>
          </div>

          <div className="elite-hero-bottom">
            <p>
              SILENT MOVES.
              <br />
              DEADLY RESULTS.
            </p>
            <button
              className="elite-explore"
              onClick={() => changeTab("roster")}
            >
              EXPLORE THE ROSTER
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>

        <div className="elite-divider" />

        <section className="elite-section">
          <div className="elite-section-heading">
            <div>
              <span className="elite-kicker">
                K7 CREW / {activeTab.toUpperCase()}
              </span>
              <h2>{activeTitle}<span>.</span></h2>
            </div>
            <span className="elite-section-count">01 — 05</span>
          </div>

          {activeTab === "roster" && (
            <div className="elite-roster">
              <div className="elite-roster-overview">
                <div>
                  <span className="elite-kicker">OFFICIAL LINEUP</span>
                  <div className="elite-roster-count">
                    <strong>{roster.length.toString().padStart(2, "0")}</strong>
                    <span>/ 07 MEMBERS</span>
                  </div>
                </div>

                <button
                  className="elite-refresh"
                  onClick={loadRoster}
                  disabled={loadingRoster}
                >
                  <RefreshCw
                    size={14}
                    className={loadingRoster ? "elite-spinning" : ""}
                  />
                  REFRESH
                </button>
              </div>

              {rosterError && (
                <div className="elite-error">
                  <strong>ROSTER UNAVAILABLE</strong>
                  <p>{rosterError}</p>
                  <button onClick={loadRoster}>TRY AGAIN</button>
                </div>
              )}

              {loadingRoster ? (
                <div className="elite-loading">
                  <RefreshCw size={20} className="elite-spinning" />
                  <span>LOADING TEAM DATA</span>
                </div>
              ) : !rosterError ? (
                <>
                  <div className="elite-roster-group">
                    <div className="elite-group-heading">
                      <div>
                        <span className="elite-kicker">01 / ACTIVE LINEUP</span>
                        <h3>MAIN ROSTER</h3>
                      </div>
                      <span className="elite-group-total">
                        {mainPlayers.length.toString().padStart(2, "0")} / 04
                      </span>
                    </div>

                    <div className="elite-player-list">
                      {mainSlots.map((slot, index) => (
                        <PlayerCard
                          key={slot}
                          index={index}
                          player={roster.find((p) => p.slot === slot)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="elite-roster-group">
                    <div className="elite-group-heading">
                      <div>
                        <span className="elite-kicker">02 / RESERVE UNIT</span>
                        <h3>SUBSTITUTES</h3>
                      </div>
                      <span className="elite-group-total">
                        {substitutePlayers.length.toString().padStart(2, "0")} / 03
                      </span>
                    </div>

                    <div className="elite-player-list">
                      {subSlots.map((slot, index) => (
                        <PlayerCard
                          key={slot}
                          index={index + 4}
                          player={roster.find((p) => p.slot === slot)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {activeTab === "chat" && (
            <EmptySection
              icon={MessageCircle}
              title="COMMUNITY CHAT"
              description="The community communication hub. Messages will appear here when the chat service is connected."
            />
          )}

          {activeTab === "events" && (
            <EmptySection
              icon={CalendarDays}
              title="UPCOMING OPERATIONS"
              description="Tournaments, team practices and competitive events will be displayed here when event data is connected."
            />
          )}

          {activeTab === "news" && (
            <EmptySection
              icon={Newspaper}
              title="LATEST INTEL"
              description="Official K7 CREW announcements and publications will appear here when news data is available."
            />
          )}

          {activeTab === "stats" && (
            <EmptySection
              icon={Trophy}
              title="TEAM PERFORMANCE"
              description="Competitive results and player analytics will be displayed here when real match statistics are available."
            />
          )}
        </section>

        <section className="elite-manifesto">
          <div className="elite-manifesto-icon">
            <Swords size={22} />
          </div>
          <div>
            <span className="elite-kicker">THE K7 STANDARD</span>
            <h3>LESS NOISE.<br />MORE IMPACT.</h3>
          </div>
          <span className="elite-manifesto-mark">K7</span>
        </section>

        <footer className="elite-footer">
          <div className="elite-footer-brand">K7 CREW</div>
          <span>PUBG MOBILE ESPORTS COMMUNITY</span>
          <span>© K7 CREW</span>
        </footer>
      </div>

      <nav className="elite-bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "elite-bottom-link active"
                  : "elite-bottom-link"
              }
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
