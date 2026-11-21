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
  },
  {
    number: "02",
    label: "THE COMPETITION",
    first: "NO EXCUSES.",
    second: "ONLY RESULTS.",
  },
  {
    number: "03",
    label: "THE SQUAD",
    first: "STRONGER",
    second: "AS ONE.",
  },
  {
    number: "04",
    label: "THE LEGACY",
    first: "BUILT TO",
    second: "BE REMEMBERED.",
  },
  {
    number: "05",
    label: "THE PERFORMANCE",
    first: "PROVE IT.",
    second: "EVERY MATCH.",
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
}: {
  number: string;
  label: string;
  first: string;
  second: string;
}) {
  return (
    <section className="elite-slogan-break">
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

  // Navigation and content reveal.
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

  // Scroll-controlled logo and background typography.
  // Nothing moves automatically when the page is not scrolling.
  useEffect(() => {
    const background = document.querySelector<HTMLElement>(
      ".elite-background-type"
    );

    const logo = document.querySelector<HTMLElement>(
      ".elite-hero-logo"
    );

    const laneOne = document.querySelector<HTMLElement>(
      ".elite-type-lane-one"
    );

    const laneTwo = document.querySelector<HTMLElement>(
      ".elite-type-lane-two"
    );

    const laneThree = document.querySelector<HTMLElement>(
      ".elite-type-lane-three"
    );

    if (!background || !logo || !laneOne || !laneTwo || !laneThree) {
      return;
    }

    let frame = 0;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const smoothStep = (value: number) =>
      value * value * (3 - 2 * value);

    const updateVisuals = () => {
      frame = 0;

      const scroll = window.scrollY;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const maxScroll =
        document.documentElement.scrollHeight - viewportHeight;

      const progress =
        maxScroll > 0 ? clamp(scroll / maxScroll, 0, 1) : 0;

      // HERO LOGO: fades out while scrolling down
      // and returns when scrolling back to the top.
      const logoProgress = clamp(
        scroll / (viewportHeight * 0.72),
        0,
        1
      );

      const logoFade = smoothStep(logoProgress);

      logo.style.opacity = String(1 - logoFade);
      logo.style.transform = `
        translate3d(0, ${-35 * logoFade}px, 0)
        scale(${1 - logoFade * 0.09})
      `;
      logo.style.filter = `blur(${logoFade * 11}px)`;
      logo.style.pointerEvents = logoFade > 0.95 ? "none" : "auto";

      // Different movement paths for each typography lane.
      const waveOne = Math.sin(progress * Math.PI * 2);
      const waveTwo = Math.cos(progress * Math.PI * 2 + 0.9);
      const waveThree = Math.sin(progress * Math.PI * 3 + 1.4);

      // Lane one: moves left.
      laneOne.style.transform = `
        translate3d(
          ${-progress * viewportWidth * 0.16 + waveOne * 12}px,
          ${waveOne * 22}px,
          0
        )
        scale(${1 + waveOne * 0.025})
      `;

      laneOne.style.opacity = String(
        0.055 + (waveOne + 1) * 0.018
      );

      // Lane two: moves right, with a different vertical path.
      laneTwo.style.transform = `
        translate3d(
          ${progress * viewportWidth * 0.12 + waveTwo * 15}px,
          ${waveTwo * 30}px,
          0
        )
        scale(${1.02 + waveTwo * 0.035})
      `;

      laneTwo.style.opacity = String(
        0.04 + (waveTwo + 1) * 0.018
      );

      // Lane three: slower movement in the opposite direction.
      laneThree.style.transform = `
        translate3d(
          ${-progress * viewportWidth * 0.07 + waveThree * 10}px,
          ${waveThree * 17}px,
          0
        )
        scale(${0.98 + waveThree * 0.025})
      `;

      laneThree.style.opacity = String(
        0.025 + (waveThree + 1) * 0.015
      );
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateVisuals);
    };

    updateVisuals();

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

        <div className="elite-background-type">
          <div className="elite-type-lane elite-type-lane-one">
            <div className="elite-type-track">
              <span>SILENT MOVES</span>
              <span>DISCIPLINE OVER EVERYTHING</span>
              <span>EARN YOUR PLACE</span>
              <span>EXECUTE WITH PRECISION</span>
              <span>NO ROOM FOR ERROR</span>
              <span>BUILT DIFFERENT</span>
            </div>
          </div>

          <div className="elite-type-lane elite-type-lane-two">
            <div className="elite-type-track">
              <span>ONE CREW</span>
              <span>CONTROL THE GAME</span>
              <span>STRONGER AS ONE</span>
              <span>THE GAME NEVER STOPS</span>
              <span>ONLY RESULTS</span>
              <span>MADE FOR PRESSURE</span>
            </div>
          </div>

          <div className="elite-type-lane elite-type-lane-three">
            <div className="elite-type-track">
              <span>FOCUS</span>
              <span>ADAPT</span>
              <span>DOMINATE</span>
              <span>BEYOND THE LIMIT</span>
              <span>STAY SHARP</span>
              <span>PROVE IT</span>
            </div>
          </div>
        </div>
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

      <section id="manifesto" className="elite-manifesto-section">
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
