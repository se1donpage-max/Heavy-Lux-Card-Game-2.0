"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
  ArrowDown,
  RefreshCw,
  Crown,
  Shield,
  ArrowUpRight,
} from "lucide-react";

type TabId = "chat" | "events" | "roster" | "news" | "stats";

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

const tabs = [
  { id: "chat", label: "Chat", icon: MessageCircle, number: "01" },
  { id: "events", label: "Events", icon: CalendarDays, number: "02" },
  { id: "roster", label: "Roster", icon: Users, number: "03" },
  { id: "news", label: "News", icon: Newspaper, number: "04" },
  { id: "stats", label: "Stats", icon: Trophy, number: "05" },
] as const;

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];

const sceneWords: Record<TabId | "intro", string[]> = {
  intro: ["SILENT MOVES", "DEADLY RESULTS", "K7", "NO LIMITS"],
  chat: ["STAY CONNECTED", "ONE CREW", "NO DISTANCE", "UNITED"],
  events: ["ENTER THE GAME", "NO SECOND CHANCES", "COMPETE", "TAKE YOUR PLACE"],
  roster: ["BUILT DIFFERENT", "THE SQUAD", "TRUST THE TEAM", "K7 CREW"],
  news: ["LATEST SIGNAL", "STAY INFORMED", "THE NEXT MOVE", "BROADCAST"],
  stats: ["PROVE IT", "EVERY MATCH", "PURE PERFORMANCE", "RESULTS"],
};

function getPlayerName(player: RosterPlayer) {
  if (player.profiles?.username) {
    return `@${player.profiles.username}`;
  }

  if (player.profiles?.first_name) {
    return [
      player.profiles.first_name,
      player.profiles.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return `PLAYER_${player.telegram_id}`;
}

function SceneBackdrop({
  scene,
}: {
  scene: TabId | "intro";
}) {
  const words = sceneWords[scene];

  return (
    <div className={`scene-backdrop scene-${scene}`} aria-hidden="true">
      <div className="scene-grain" />
      <div className="scene-orbit scene-orbit-one" />
      <div className="scene-orbit scene-orbit-two" />

      <div className="scene-typography">
        {words.map((word, index) => (
          <span
            key={`${scene}-${word}`}
            className={`scene-word scene-word-${index + 1}`}
          >
            {word}
          </span>
        ))}
      </div>

      <div className="scene-index">
        K7 <span> / </span> {scene === "intro" ? "2026" : scene.toUpperCase()}
      </div>

      <div className="scene-crosshair scene-crosshair-one" />
      <div className="scene-crosshair scene-crosshair-two" />
    </div>
  );
}

function PlayerCard({
  player,
  slot,
}: {
  player?: RosterPlayer;
  slot: string;
}) {
  return (
    <div className={`roster-player ${player ? "is-filled" : "is-open"}`}>
      <div className="roster-player-number">
        {slot.replace("_", " ")}
      </div>

      <div className="roster-player-info">
        <div className="roster-player-name">
          {player ? getPlayerName(player) : "OPEN POSITION"}
        </div>

        <div className="roster-player-role">
          {player ? player.game_role || "TEAM MEMBER" : "AVAILABLE"}
        </div>
      </div>

      <div className="roster-player-status">
        {player ? (
          player.is_captain ? <Crown size={17} /> : <Shield size={17} />
        ) : (
          "+"
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-heading">
      <div className="section-heading-number">
        <span>{number}</span>
        <i />
        K7 CREW
      </div>

      <h2>{title}<span>.</span></h2>

      <p>{subtitle}</p>
    </div>
  );
}

function EmptySection({
  eyebrow,
  title,
  description,
  number,
}: {
  eyebrow: string;
  title: string;
  description: string;
  number: string;
}) {
  return (
    <div className="empty-section">
      <div className="empty-section-top">
        <span>{eyebrow}</span>
        <span>{number} / 05</span>
      </div>

      <div className="empty-section-center">
        <div className="empty-section-symbol">
          <span />
          <span />
          <span />
        </div>

        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="empty-section-bottom">
        <span>IN DEVELOPMENT</span>
        <ArrowUpRight size={17} />
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRoster() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/roster", {
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load roster");
      }

      setRoster(result.roster ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoster();
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(
      "[data-nav-section]"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;

            if (tabs.some((tab) => tab.id === id)) {
              setActiveTab(id as TabId);
            }
          }
        });
      },
      {
        rootMargin: "-38% 0px -42% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const updateScroll = () => {
      frame = 0;

      const scrollY = window.scrollY;
      const height = window.innerHeight || 1;
      const maxScroll =
        document.documentElement.scrollHeight - height;

      const progress =
        maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

      root.style.setProperty("--scroll-progress", String(progress));
      root.style.setProperty("--scroll-y", `${scrollY}px`);
    };

    const requestUpdate = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(updateScroll);
      }
    };

    updateScroll();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  function navigateTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function getPlayerForSlot(slot: string) {
    return roster.find((player) => player.slot === slot);
  }

  return (
    <main className="cinema-shell">
      <section className="cinema-intro">
        <SceneBackdrop scene="intro" />

        <div className="intro-content">
          <div className="intro-overline">
            <span className="intro-dot" />
            INDEPENDENT ESPORTS COMMUNITY
          </div>

          <div className="intro-monogram" aria-label="K7 CREW">
            K<span>7</span>
          </div>

          <div className="intro-rule">
            <span />
            <span>K7 CREW</span>
            <span />
          </div>

          <h1>
            SILENT MOVES.
            <br />
            <span>DEADLY RESULTS.</span>
          </h1>

          <p className="intro-description">
            DISCIPLINE. PRECISION. UNITY.
          </p>

          <button
            className="intro-explore"
            onClick={() => navigateTo("chat")}
          >
            <span>EXPLORE THE CREW</span>
            <ArrowDown size={16} />
          </button>
        </div>

        <div className="intro-side-note intro-side-left">
          EST. 2026
        </div>

        <div className="intro-side-note intro-side-right">
          PUBG MOBILE / ESPORTS
        </div>

        <div className="intro-bottom-index">
          <span>SCROLL TO DISCOVER</span>
          <span>01 — 05</span>
        </div>
      </section>

      <section
        id="chat"
        data-nav-section
        className="cinema-section scene-section scene-chat"
      >
        <SceneBackdrop scene="chat" />

        <div className="section-content">
          <SectionHeading
            number="01"
            title="CHAT"
            subtitle="COMMUNICATION IS THE FOUNDATION."
          />

          <div className="section-main">
            <div className="section-watermark">01</div>

            <EmptySection
              eyebrow="K7 COMMUNITY"
              title="THE CREW IS HERE."
              description="A place for communication, coordination and everything happening inside the community."
              number="01"
            />
          </div>
        </div>
      </section>

      <section
        id="events"
        data-nav-section
        className="cinema-section scene-section scene-events"
      >
        <SceneBackdrop scene="events" />

        <div className="section-content">
          <SectionHeading
            number="02"
            title="EVENTS"
            subtitle="EVERY MATCH IS AN OPPORTUNITY."
          />

          <div className="section-main">
            <div className="section-watermark">02</div>

            <EmptySection
              eyebrow="TOURNAMENTS / MATCHES"
              title="ENTER THE GAME."
              description="Upcoming competitions, matches and important team activities will appear here."
              number="02"
            />
          </div>
        </div>
      </section>

      <section
        id="roster"
        data-nav-section
        className="cinema-section scene-section scene-roster"
      >
        <SceneBackdrop scene="roster" />

        <div className="section-content">
          <SectionHeading
            number="03"
            title="ROSTER"
            subtitle="THE PEOPLE BEHIND K7 CREW."
          />

          <div className="roster-toolbar">
            <div>
              <span className="roster-toolbar-label">ACTIVE LINEUP</span>
              <span className="roster-toolbar-count">
                {roster.length.toString().padStart(2, "0")}
                <small> / 07</small>
              </span>
            </div>

            <button
              className="elite-refresh"
              onClick={loadRoster}
              disabled={loading}
              aria-label="Refresh roster"
            >
              <RefreshCw size={17} />
              <span>REFRESH</span>
            </button>
          </div>

          {loading ? (
            <div className="elite-loading">
              <span className="loading-line" />
              LOADING THE SQUAD...
            </div>
          ) : error ? (
            <div className="elite-error">
              <p>{error}</p>
              <button onClick={loadRoster}>TRY AGAIN</button>
            </div>
          ) : (
            <div className="roster-layout">
              <div className="roster-column">
                <div className="roster-group-heading">
                  <span>MAIN SQUAD</span>
                  <span>04 POSITIONS</span>
                </div>

                <div className="elite-roster-list">
                  {mainSlots.map((slot, index) => (
                    <PlayerCard
                      key={slot}
                      slot={slot}
                      player={getPlayerForSlot(slot)}
                    />
                  ))}
                </div>
              </div>

              <div className="roster-column roster-sub-column">
                <div className="roster-group-heading">
                  <span>SUBSTITUTES</span>
                  <span>03 POSITIONS</span>
                </div>

                <div className="elite-roster-list">
                  {subSlots.map((slot) => (
                    <PlayerCard
                      key={slot}
                      slot={slot}
                      player={getPlayerForSlot(slot)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="roster-footer-line">
            <span>TEAM STRUCTURE / K7</span>
            <span>EST. 2026</span>
          </div>
        </div>
      </section>

      <section
        id="news"
        data-nav-section
        className="cinema-section scene-section scene-news"
      >
        <SceneBackdrop scene="news" />

        <div className="section-content">
          <SectionHeading
            number="04"
            title="NEWS"
            subtitle="THE LATEST FROM OUR WORLD."
          />

          <div className="section-main">
            <div className="section-watermark">04</div>

            <EmptySection
              eyebrow="K7 BROADCAST"
              title="STAY INFORMED."
              description="Announcements, organization updates and important information from the crew."
              number="04"
            />
          </div>
        </div>
      </section>

      <section
        id="stats"
        data-nav-section
        className="cinema-section scene-section scene-stats"
      >
        <SceneBackdrop scene="stats" />

        <div className="section-content">
          <SectionHeading
            number="05"
            title="STATS"
            subtitle="NUMBERS NEVER LIE."
          />

          <div className="section-main">
            <div className="section-watermark">05</div>

            <EmptySection
              eyebrow="PERFORMANCE / RESULTS"
              title="PROVE IT."
              description="Team performance, match results and competitive statistics will be collected here."
              number="05"
            />
          </div>
        </div>
      </section>

      <footer className="cinema-footer">
        <div className="footer-monogram">K<span>7</span></div>

        <div className="footer-main">
          <span>K7 CREW</span>
          <p>SILENT MOVES. DEADLY RESULTS.</p>
        </div>

        <div className="footer-bottom">
          <span>INDEPENDENT ESPORTS COMMUNITY</span>
          <span>© 2026 K7 CREW</span>
        </div>
      </footer>

      <nav className="cinema-nav" aria-label="Main navigation">
        <div className="cinema-nav-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`cinema-nav-item ${isActive ? "active" : ""}`}
                onClick={() => navigateTo(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-number">{tab.number}</span>
                <Icon size={19} strokeWidth={isActive ? 2 : 1.5} />
                <span className="nav-label">{tab.label}</span>
                <i />
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
