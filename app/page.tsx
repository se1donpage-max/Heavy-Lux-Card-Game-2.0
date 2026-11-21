
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

const tabs = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "roster", label: "Roster", icon: Users },
  { id: "news", label: "News", icon: Newspaper },
  { id: "stats", label: "Stats", icon: Trophy },
] as const;

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];

const slogans = [
  {
    number: "01",
    label: "THE CONNECTION",
    first: "ONE CREW.",
    second: "ONE PURPOSE.",
    background: "ONE CREW — ONE PURPOSE",
  },
  {
    number: "02",
    label: "THE COMPETITION",
    first: "NO EXCUSES.",
    second: "ONLY RESULTS.",
    background: "NO EXCUSES — ONLY RESULTS",
  },
  {
    number: "03",
    label: "THE SQUAD",
    first: "STRONGER",
    second: "AS ONE.",
    background: "STRONGER AS ONE",
  },
  {
    number: "04",
    label: "THE LEGACY",
    first: "BUILT TO",
    second: "BE REMEMBERED.",
    background: "BUILT TO BE REMEMBERED",
  },
  {
    number: "05",
    label: "THE PERFORMANCE",
    first: "PROVE IT.",
    second: "EVERY MATCH.",
    background: "PROVE IT — EVERY MATCH",
  },
];

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
          {player ? player.game_role || "TEAM MEMBER" : "AVAILABLE"}
        </div>
      </div>

      <div className="roster-player-status">
        {player ? (
          player.is_captain ? <Crown size={16} /> : <Shield size={16} />
        ) : "+"}
      </div>
    </div>
  );
}

function Slogan({
  number,
  label,
  first,
  second,
  background,
}: {
  number: string;
  label: string;
  first: string;
  second: string;
  background: string;
}) {
  return (
    <section
      className="elite-slogan-break"
      data-motion-scene
      data-motion-word={background}
    >
      <div className="elite-slogan-content">
        <div className="elite-slogan-label">
          {number} / {label}
        </div>
        <h2>
          {first}
          <br />
          <span>{second}</span>
        </h2>
        <div className="elite-slogan-line" />
      </div>
    </section>
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
      <div className="empty-section-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="section-coming">COMING SOON</div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("roster");
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

  // Active navigation section and slogan reveal.
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
        rootMargin: "-35% 0px -45% 0px",
      }
    );

    sections.forEach((section) => observer.observe(section));

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    document
      .querySelectorAll(".elite-slogan-content, .reveal-content")
      .forEach((element) => revealObserver.observe(element));

    return () => {
      observer.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  // Scroll-driven horizontal typography.
  useEffect(() => {
    const scenes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-motion-scene]")
    );

    if (!scenes.length) return;

    let frame = 0;

    const updateMotion = () => {
      frame = 0;

      const viewportHeight = window.innerHeight;

      scenes.forEach((scene) => {
        const rect = scene.getBoundingClientRect();

        const progress = Math.max(
          0,
          Math.min(
            1,
            (viewportHeight - rect.top) /
              (viewportHeight + rect.height)
          )
        );

        // Text travels from left to right as the page scrolls.
        const horizontalPosition = -24 + progress * 48;

        // The text becomes strongest near the middle of its scene.
        const distanceFromCenter = Math.abs(progress - 0.5);
        const opacity = 0.13 + (1 - distanceFromCenter * 2) * 0.2;

        scene.style.setProperty(
          "--motion-x",
          `${horizontalPosition}vw`
        );

        scene.style.setProperty(
          "--motion-opacity",
          `${Math.max(0.08, Math.min(0.34, opacity))}`
        );

        scene.style.setProperty(
          "--motion-progress",
          `${progress}`
        );
      });
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateMotion);
    };

    updateMotion();

    window.addEventListener("scroll", requestUpdate, {
      passive: true,
    });

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
    <main className="elite-shell">
      <div className="elite-background" aria-hidden="true">
        <div className="elite-background-image" />
        <div className="elite-background-overlay" />
        <div className="elite-background-lines" />
      </div>

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

      <section id="home" className="elite-hero">
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
            SCROLL TO EXPLORE
            <ArrowDown size={15} />
          </button>
        </div>
      </section>

      <section
        id="manifesto"
        className="elite-manifesto-section"
        data-motion-scene
        data-motion-word="LESS NOISE — MORE IMPACT"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">01 / OUR MINDSET</div>

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

      <Slogan {...slogans[0]} />

      <section
        id="chat"
        data-nav-section
        data-motion-scene
        data-motion-word="CONNECT — COMMUNICATE"
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">02 / COMMUNICATION</div>

          <EmptySection
            eyebrow="K7 COMMUNITY"
            title="THE CHAT."
            description="A place for the crew. Communication and community updates."
          />
        </div>
      </section>

      <Slogan {...slogans[1]} />

      <section
        id="events"
        data-nav-section
        data-motion-scene
        data-motion-word="EVERY MATCH MATTERS"
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">03 / COMPETITION</div>

          <EmptySection
            eyebrow="TOURNAMENTS & MATCHES"
            title="THE EVENTS."
            description="Upcoming competitions, matches and team activities."
          />
        </div>
      </section>

      <Slogan {...slogans[2]} />

      <section
        id="roster"
        data-nav-section
        data-motion-scene
        data-motion-word="UNITED AS ONE"
        className="elite-content-section elite-roster-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">04 / THE SQUAD</div>

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
              <RefreshCw size={17} />
            </button>
          </div>

          {loading ? (
            <div className="elite-loading">LOADING THE SQUAD...</div>
          ) : error ? (
            <div className="elite-error">
              <p>{error}</p>
              <button onClick={loadRoster}>TRY AGAIN</button>
            </div>
          ) : (
            <>
              <div className="elite-roster-group">
                <div className="elite-roster-label">
                  MAIN SQUAD <span>04 SLOTS</span>
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
                  SUBSTITUTES <span>03 SLOTS</span>
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

      <Slogan {...slogans[3]} />

      <section
        id="news"
        data-nav-section
        data-motion-scene
        data-motion-word="STAY INFORMED"
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">05 / LATEST UPDATES</div>

          <EmptySection
            eyebrow="K7 BROADCAST"
            title="THE NEWS."
            description="Announcements, organization updates and important information."
          />
        </div>
      </section>

      <Slogan {...slogans[4]} />

      <section
        id="stats"
        data-nav-section
        data-motion-scene
        data-motion-word="NUMBERS NEVER LIE"
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">06 / PERFORMANCE</div>

          <EmptySection
            eyebrow="NUMBERS DON'T LIE"
            title="THE STATS."
            description="Team performance, results and competitive statistics."
          />
        </div>
      </section>

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

      <nav className="elite-bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`elite-nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigateTo(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={isActive ? 2.3 : 1.7} />
              <span>{tab.label}</span>
              <i />
            </button>
          );
        })}
      </nav>
    </main>
  );
}
