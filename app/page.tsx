
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

const tabs: {
  id: TabId;
  label: string;
  icon: typeof MessageCircle;
}[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "roster", label: "Roster", icon: Users },
  { id: "news", label: "News", icon: Newspaper },
  { id: "stats", label: "Stats", icon: Trophy },
];

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];

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
          {player
            ? player.game_role || "TEAM MEMBER"
            : "AVAILABLE"}
        </div>
      </div>

      <div className="roster-player-status">
        {player ? (
          player.is_captain ? (
            <Crown size={16} />
          ) : (
            <Shield size={16} />
          )
        ) : (
          "+"
        )}
      </div>
    </div>
  );
}

function EmptySection({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-section">
      <div>{eyebrow}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="section-coming">COMING SOON</div>
    </div>
  );
}

function Slogan({
  scene,
  number,
  label,
  firstLine,
  secondLine,
}: {
  scene: string;
  number: string;
  label: string;
  firstLine: string;
  secondLine: string;
}) {
  return (
    <div
      className="elite-slogan-break"
      data-scene={scene}
    >
      <div className="elite-slogan-content">
        <span>{number} / {label}</span>
        <strong>
          {firstLine}
          <br />
          <em>{secondLine}</em>
        </strong>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("roster");
  const [scene, setScene] = useState("home");

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
        err instanceof Error
          ? err.message
          : "Something went wrong"
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
      "[data-scene]"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const currentScene =
              entry.target.getAttribute("data-scene");

            if (currentScene) {
              setScene(currentScene);
            }

            entry.target.classList.add("is-visible");

            const sectionId = entry.target.id;

            if (tabs.some((tab) => tab.id === sectionId)) {
              setActiveTab(sectionId as TabId);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: "-35% 0px -35% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
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
    <main className="elite-shell" data-scene={scene}>
      {/* CINEMATIC BACKGROUND */}
      <div className="elite-background" aria-hidden="true">
        <div className="elite-background-glow" />
        <div className="elite-background-mark">K7</div>
        <div className="elite-background-lines" />
      </div>

      {/* HEADER */}
      <header className="elite-header">
        <div className="elite-brand">
          <div className="elite-brand-mark">
            <img src="/k7-logo.jpeg" alt="K7 CREW" />
          </div>

          <div>
            <div className="elite-brand-name">K7 CREW</div>
            <div className="elite-brand-caption">
              PUBG MOBILE ESPORTS
            </div>
          </div>
        </div>

        <div className="elite-header-status">
          <span />
          COMMUNITY
        </div>
      </header>

      {/* HERO */}
      <section
        id="home"
        className="elite-hero"
        data-scene="home"
      >
        <div className="elite-hero-content">
          <div className="elite-kicker">
            INDEPENDENT ESPORTS ORGANIZATION
          </div>

          <div className="elite-hero-logo">
            <img src="/k7-logo.jpeg" alt="K7 CREW Logo" />
          </div>

          <div className="elite-hero-divider" />

          <h1>
            SILENT MOVES.
            <br />
            <span>DEADLY RESULTS.</span>
          </h1>

          <p className="elite-hero-description">
            BUILT ON DISCIPLINE.
            <br />
            UNITED BY THE GAME.
          </p>

          <button
            className="elite-scroll-hint"
            onClick={() => navigateTo("manifesto")}
          >
            <span>SCROLL TO EXPLORE</span>
            <ArrowDown size={15} />
          </button>
        </div>

        <div className="elite-hero-index">
          <span>01</span>
          <span className="elite-index-line" />
          <span>07</span>
        </div>
      </section>

      {/* MANIFESTO */}
      <section
        id="manifesto"
        className="elite-manifesto-section"
        data-scene="manifesto"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            02 / OUR MINDSET
          </div>

          <div className="elite-manifesto-title">
            LESS NOISE.
            <br />
            <span>MORE IMPACT.</span>
          </div>

          <p className="elite-manifesto-text">
            No unnecessary words.
            <br />
            No wasted movement.
            <br />
            Only focus, teamwork and results.
          </p>

          <div className="elite-manifesto-mark">
            K7 CREW — EST. 2026
          </div>
        </div>
      </section>

      <Slogan
        scene="chat"
        number="03"
        label="THE CONNECTION"
        firstLine="ONE CREW."
        secondLine="ONE PURPOSE."
      />

      {/* CHAT */}
      <section
        id="chat"
        className="elite-content-section"
        data-scene="chat"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            03 / COMMUNICATION
          </div>

          <EmptySection
            eyebrow="K7 COMMUNITY"
            title="THE CHAT."
            description="A place for the crew. Communication and community updates."
          />
        </div>
      </section>

      <Slogan
        scene="events"
        number="04"
        label="THE COMPETITION"
        firstLine="NO EXCUSES."
        secondLine="ONLY RESULTS."
      />

      {/* EVENTS */}
      <section
        id="events"
        className="elite-content-section"
        data-scene="events"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            04 / COMPETITION
          </div>

          <EmptySection
            eyebrow="TOURNAMENTS & MATCHES"
            title="THE EVENTS."
            description="Upcoming competitions, matches and team activities."
          />
        </div>
      </section>

      <Slogan
        scene="roster"
        number="05"
        label="THE SQUAD"
        firstLine="STRONGER"
        secondLine="AS ONE."
      />

      {/* ROSTER */}
      <section
        id="roster"
        className="elite-content-section elite-roster-section"
        data-scene="roster"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            05 / THE SQUAD
          </div>

          <div className="elite-section-heading">
            <div>
              <h2>ROSTER<span>.</span></h2>
              <p>THE PEOPLE BEHIND K7 CREW.</p>
            </div>

            <button
              className="elite-refresh"
              onClick={loadRoster}
              disabled={loading}
              aria-label="Refresh roster"
            >
              <RefreshCw
                size={17}
                className={loading ? "is-spinning" : ""}
              />
            </button>
          </div>

          {loading ? (
            <div className="elite-loading">
              LOADING THE SQUAD...
            </div>
          ) : error ? (
            <div className="elite-error">
              <p>{error}</p>
              <button onClick={loadRoster}>
                TRY AGAIN
              </button>
            </div>
          ) : (
            <>
              <div className="elite-roster-group">
                <div className="elite-roster-label">
                  MAIN SQUAD
                  <span>04 SLOTS</span>
                </div>

                <div className="elite-roster-list">
                  {mainSlots.map((slot) => (
                    <PlayerCard
                      key={slot}
                      slot={slot}
                      player={getPlayerForSlot(slot)}
                    />
                  ))}
                </div>
              </div>

              <div className="elite-roster-group">
                <div className="elite-roster-label">
                  SUBSTITUTES
                  <span>03 SLOTS</span>
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

              <div className="elite-roster-total">
                <span>REGISTERED PLAYERS</span>
                <strong>
                  {roster.length.toString().padStart(2, "0")}
                </strong>
              </div>
            </>
          )}
        </div>
      </section>

      <Slogan
        scene="news"
        number="06"
        label="THE LEGACY"
        firstLine="BUILT TO"
        secondLine="BE REMEMBERED."
      />

      {/* NEWS */}
      <section
        id="news"
        className="elite-content-section"
        data-scene="news"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            06 / LATEST UPDATES
          </div>

          <EmptySection
            eyebrow="K7 BROADCAST"
            title="THE NEWS."
            description="Announcements, organization updates and important information."
          />
        </div>
      </section>

      <Slogan
        scene="stats"
        number="07"
        label="THE PERFORMANCE"
        firstLine="PROVE IT."
        secondLine="EVERY MATCH."
      />

      {/* STATS */}
      <section
        id="stats"
        className="elite-content-section"
        data-scene="stats"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            07 / PERFORMANCE
          </div>

          <EmptySection
            eyebrow="NUMBERS DON'T LIE"
            title="THE STATS."
            description="Team performance, results and competitive statistics."
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="elite-footer">
        <div className="elite-footer-logo">
          <img src="/k7-logo.jpeg" alt="K7 CREW" />
        </div>

        <div className="elite-footer-slogan">
          SILENT MOVES. DEADLY RESULTS.
        </div>

        <div className="elite-footer-copy">
          K7 CREW © 2026
        </div>
      </footer>

      {/* BOTTOM NAVIGATION ONLY */}
      <nav className="elite-bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`elite-nav-item ${
                isActive ? "active" : ""
              }`}
              onClick={() => navigateTo(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={21}
                strokeWidth={isActive ? 2.3 : 1.7}
              />
              <span>{tab.label}</span>
              <i />
            </button>
          );
        })}
      </nav>
    </main>
  );
}
