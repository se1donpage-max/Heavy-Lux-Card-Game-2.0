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

const sceneCopy: Record<
  TabId,
  { first: string; second: string; third: string }
> = {
  chat: {
    first: "ONE CREW",
    second: "NOISE IS NOTHING",
    third: "STAY CONNECTED",
  },
  events: {
    first: "ENTER THE ARENA",
    second: "BUILT FOR PRESSURE",
    third: "NEXT MATCH",
  },
  roster: {
    first: "UNITED BY THE GAME",
    second: "EVERY ROLE MATTERS",
    third: "THE SQUAD",
  },
  news: {
    first: "NO NOISE",
    second: "JUST IMPACT",
    third: "THE LATEST",
  },
  stats: {
    first: "NUMBERS NEVER LIE",
    second: "PROVE YOUR LEVEL",
    third: "ONLY RESULTS",
  },
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

function Slogan({
  number,
  label,
  first,
  second,
}: {
  number: string;
  label: string;
  first: string;
  second: string;
}) {
  return (
    <section className="elite-slogan-break">
      <div className="elite-slogan-content reveal-content">
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
  const [introVisible, setIntroVisible] = useState(true);

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

    const introTimer = window.setTimeout(() => {
      setIntroVisible(false);
    }, 2300);

    return () => window.clearTimeout(introTimer);
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
        threshold: 0.12,
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

  // Scroll-controlled 3D scene.
  useEffect(() => {
    const layers = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-motion-layer]"
      )
    );

    if (!layers.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let frame = 0;

    const update = () => {
      frame = 0;

      const scroll = window.scrollY;
      const phase = scroll / 430;

      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );

      const progress = Math.min(1, Math.max(0, scroll / maxScroll));

      const motions = [
        {
          x: Math.sin(phase * 0.68) * 190,
          y: Math.cos(phase * 0.42) * 105,
          z: Math.sin(phase * 0.34) * 95,
          rx: Math.cos(phase * 0.45) * 9,
          ry: Math.sin(phase * 0.52) * -15,
          rz: Math.sin(phase * 0.31) * 8,
          scale: 1.12 + Math.sin(phase * 0.24) * 0.12,
        },
        {
          x: -Math.cos(phase * 0.88) * 215,
          y: Math.sin(phase * 0.61) * 145,
          z: Math.cos(phase * 0.37) * -125,
          rx: Math.sin(phase * 0.41) * -12,
          ry: Math.cos(phase * 0.57) * 17,
          rz: Math.cos(phase * 0.29) * -10,
          scale: 1.2 + Math.cos(phase * 0.22) * 0.1,
        },
        {
          x: Math.sin(phase * 1.05) * 145,
          y: -Math.cos(phase * 0.54) * 165,
          z: Math.sin(phase * 0.31) * 155,
          rx: Math.cos(phase * 0.38) * 14,
          ry: Math.sin(phase * 0.66) * -12,
          rz: Math.sin(phase * 0.48) * 6,
          scale: 1.05 + Math.sin(phase * 0.35) * 0.16,
        },
        {
          x: -Math.cos(phase * 0.96) * 135,
          y: Math.sin(phase * 0.79) * 180,
          z: Math.cos(phase * 0.28) * -180,
          rx: Math.sin(phase * 0.51) * -15,
          ry: Math.cos(phase * 0.43) * 13,
          rz: Math.sin(phase * 0.39) * 12,
          scale: 1.25 + Math.cos(phase * 0.2) * 0.12,
        },
      ];

      layers.forEach((layer, index) => {
        const motion = motions[index % motions.length];
        const factor = reduceMotion ? 0 : 1;

        layer.style.transform = `
          translate3d(
            ${motion.x * factor}px,
            ${motion.y * factor}px,
            ${motion.z * factor}px
          )
          rotateX(${motion.rx * factor}deg)
          rotateY(${motion.ry * factor}deg)
          rotateZ(${motion.rz * factor}deg)
          scale(${reduceMotion ? 1 : motion.scale})
        `;
      });

      document.documentElement.style.setProperty(
        "--scroll-progress",
        String(progress)
      );

      document.documentElement.style.setProperty(
        "--scroll-depth",
        `${progress * 100}%`
      );
    };

    const requestUpdate = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();

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

  const copy = sceneCopy[activeTab];

  return (
    <main className="elite-shell" data-scene={activeTab}>
      {introVisible && (
        <div className="intro-screen" aria-label="K7 CREW">
          <div className="intro-grain" />
          <div className="intro-light" />

          <img
            src="/k7-logo-transparent.png"
            alt="K7 CREW"
            className="intro-logo"
          />
        </div>
      )}

      <div className="elite-background" aria-hidden="true">
        <div className="elite-background-vignette" />
        <div className="elite-background-grid" />

        <div className="elite-background-depth">
          <div className="depth-orb depth-orb-one" />
          <div className="depth-orb depth-orb-two" />
          <div className="depth-orb depth-orb-three" />

          <div className="depth-ring depth-ring-one" />
          <div className="depth-ring depth-ring-two" />

          <div className="depth-beam depth-beam-one" />
          <div className="depth-beam depth-beam-two" />

          <div className="depth-crosshair">
            <span />
            <i />
          </div>
        </div>

        <div className="elite-background-type">
          <div
            className="motion-layer motion-layer-one"
            data-motion-layer
          >
            <span>{copy.first}</span>
            <i>{copy.second}</i>
          </div>

          <div
            className="motion-layer motion-layer-two"
            data-motion-layer
          >
            <span>{copy.second}</span>
            <i>{copy.third}</i>
          </div>

          <div
            className="motion-layer motion-layer-three"
            data-motion-layer
          >
            <span>{copy.third}</span>
            <i>{copy.first}</i>
          </div>

          <div
            className="motion-layer motion-layer-four"
            data-motion-layer
          >
            <span>{copy.first}</span>
            <i>{copy.third}</i>
          </div>
        </div>

        <div className="elite-background-noise" />
        <div className="elite-background-scan" />
      </div>

      <section id="home" className="elite-hero">
        <div className="hero-depth-line hero-depth-line-one" />
        <div className="hero-depth-line hero-depth-line-two" />

        <div className="elite-hero-content">
          <div className="elite-hero-index">
            INDEPENDENT ESPORTS ORGANIZATION
            <span> — 2026</span>
          </div>

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

        <div className="hero-side-index">K7 / 001</div>
        <div className="hero-depth-orbit" />
      </section>

      <section
        id="manifesto"
        className="elite-manifesto-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            01 / OUR MINDSET
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
            DISCIPLINE IS THE DIFFERENCE
          </div>
        </div>
      </section>

      <Slogan
        number="02"
        label="THE CONNECTION"
        first="ONE CREW."
        second="ONE PURPOSE."
      />

      <section
        id="chat"
        data-nav-section
        className="elite-content-section"
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
        number="04"
        label="THE COMPETITION"
        first="NO EXCUSES."
        second="ONLY RESULTS."
      />

      <section
        id="events"
        data-nav-section
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            05 / COMPETITION
          </div>

          <EmptySection
            eyebrow="TOURNAMENTS & MATCHES"
            title="THE EVENTS."
            description="Upcoming competitions, matches and team activities."
          />
        </div>
      </section>

      <Slogan
        number="06"
        label="THE SQUAD"
        first="STRONGER"
        second="AS ONE."
      />

      <section
        id="roster"
        data-nav-section
        className="elite-content-section elite-roster-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            07 / THE SQUAD
          </div>

          <div className="elite-section-heading">
            <div>
              <h2>
                ROSTER<span>.</span>
              </h2>
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
            <div className="elite-loading">
              LOADING THE SQUAD...
            </div>
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

      <Slogan
        number="08"
        label="THE LEGACY"
        first="BUILT TO"
        second="BE REMEMBERED."
      />

      <section
        id="news"
        data-nav-section
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            09 / LATEST UPDATES
          </div>

          <EmptySection
            eyebrow="K7 BROADCAST"
            title="THE NEWS."
            description="Announcements, organization updates and important information."
          />
        </div>
      </section>

      <Slogan
        number="10"
        label="THE PERFORMANCE"
        first="PROVE IT."
        second="EVERY MATCH."
      />

      <section
        id="stats"
        data-nav-section
        className="elite-content-section"
      >
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            11 / PERFORMANCE
          </div>

          <EmptySection
            eyebrow="NUMBERS DON'T LIE"
            title="THE STATS."
            description="Team performance, results and competitive statistics."
          />
        </div>
      </section>

      <footer className="elite-footer">
        <div className="elite-footer-slogan">
          SILENT MOVES. DEADLY RESULTS.
        </div>

        <div className="elite-footer-copy">
          K7 CREW © 2026
        </div>
      </footer>

      <nav
        className="elite-bottom-nav"
        aria-label="Main navigation"
      >
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
