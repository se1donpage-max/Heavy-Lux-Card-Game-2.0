
"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { EventsPanel, NewsPanel, StatsPanel, RosterAdminPanel } from "@/components/k7-panels";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
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

interface ChatProfile {
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
}

interface ChatReaction {
  id: string;
  telegram_id: number;
  reaction: string;
}

interface ChatMessage {
  id: string;
  telegram_id: number;
  content: string;
  reply_to: string | null;
  created_at: string;
  expires_at: string;
  profiles: ChatProfile | ChatProfile[] | null;
  chat_reactions: ChatReaction[];
}

const tabs = [
  { id: "chat", label: "Чат", icon: MessageCircle },
  { id: "events", label: "События", icon: CalendarDays },
  { id: "roster", label: "Состав", icon: Users },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "stats", label: "Статистика", icon: Trophy },
] as const;

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];
const chatReactionOptions = ["🔥", "❤️", "👍", "👎"];

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

function getChatProfile(message: ChatMessage): ChatProfile | null {
  if (Array.isArray(message.profiles)) {
    return message.profiles[0] ?? null;
  }

  return message.profiles;
}

function getChatName(message: ChatMessage) {
  const profile = getChatProfile(message);

  if (profile?.username) return `@${profile.username}`;

  if (profile?.first_name) {
    return [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ");
  }

  return `PLAYER_${message.telegram_id}`;
}

function getChatInitial(message: ChatMessage) {
  const profile = getChatProfile(message);

  return (
    profile?.first_name?.charAt(0)?.toUpperCase() || "K"
  );
}

function getChatTime(date: string) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeChatMessages(
  current: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const now = Date.now();
  const byId = new Map<string, ChatMessage>();

  for (const message of [...current, ...incoming]) {
    if (Date.parse(message.expires_at) > now) {
      byId.set(message.id, message);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const difference =
      Date.parse(a.created_at) - Date.parse(b.created_at);

    return difference !== 0
      ? difference
      : a.id.localeCompare(b.id);
  });
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

/** Scene typography is part of each tab, not a separate scroll section. */
function SceneBackdrop({ scene }: { scene: TabId }) {
  const words = sceneCopy[scene];
  return (
    <div className="k7-scene-backdrop" aria-hidden="true" data-k7-scene>
      <div className="k7-scene-light k7-scene-light-primary" />
      <div className="k7-scene-light k7-scene-light-secondary" />
      <div className="k7-scene-grid" />
      <div className="k7-scene-orbit k7-scene-orbit-a" />
      <div className="k7-scene-orbit k7-scene-orbit-b" />
      <div className="k7-scene-word k7-scene-word-a">{words.first}</div>
      <div className="k7-scene-word k7-scene-word-b">{words.second}</div>
      <div className="k7-scene-word k7-scene-word-c">{words.third}</div>
      <div className="k7-scene-monogram">K7</div>
      <img className="k7-scene-logo" src="/k7-logo-transparent.png" alt="" draggable={false} />
      <div className="k7-scene-scrim" />
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [introVisible, setIntroVisible] = useState(true);

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accessRole, setAccessRole] = useState<"OWNER" | "ADMIN" | "IGL" | "MEMBER">("MEMBER");
  const [viewer, setViewer] = useState<{
    telegramId: number;
    username: string | null;
    firstName: string;
    photoUrl: string | null;
  } | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatManageOpen, setChatManageOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const lastTapRef = useRef<{
    id: string;
    time: number;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const chatInputFocusedRef = useRef(false);

  const chatShouldStickToBottomRef = useRef(true);
  const chatOlderLoadingRef = useRef(false);

  const chatPrependPositionRef = useRef<{
    height: number;
    top: number;
  } | null>(null);

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

  async function loadChat(silent = false) {
    try {
      if (!silent) setChatLoading(true);

      const response = await fetch("/api/chat", {
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load chat");
      }

      setChatMessages((current) =>
        mergeChatMessages(current, result.messages ?? [])
      );

      setChatHasMore(Boolean(result.hasMore));

      if (result.currentUserId != null) {
        setCurrentUserId(Number(result.currentUserId));
      }

      setChatError("");
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Chat unavailable"
      );
    } finally {
      if (!silent) setChatLoading(false);
    }
  }

  async function moderateChat(id?: string) {
    const isManager = accessRole === "OWNER" || accessRole === "IGL";
    if (!isManager) return;
    if (!window.confirm(id ? "Удалить это сообщение?" : "Очистить весь чат для всех участников?")) return;
    try {
      const response = await fetch("/api/chat", {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Ошибка модерации");
      setChatMessages((current) => id ? current.filter((message) => message.id !== id) : []);
      setChatHasMore(false);
      setChatError("");
    } catch (err) { setChatError(err instanceof Error ? err.message : "Ошибка модерации"); }
  }

  async function loadOlderChat() {
    const feed = chatFeedRef.current;
    const oldestMessage = chatMessages[0];

    if (
      !feed ||
      !oldestMessage ||
      !chatHasMore ||
      chatOlderLoadingRef.current
    ) {
      return;
    }

    chatOlderLoadingRef.current = true;
    setChatLoadingOlder(true);

    try {
      const params = new URLSearchParams({
        beforeCreatedAt: oldestMessage.created_at,
        beforeId: oldestMessage.id,
      });

      const response = await fetch(`/api/chat?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load older messages");
      }

      const olderMessages = result.messages ?? [];

      if (olderMessages.length > 0) {
        chatPrependPositionRef.current = {
          height: feed.scrollHeight,
          top: feed.scrollTop,
        };

        setChatMessages((current) =>
          mergeChatMessages(current, olderMessages)
        );
      }

      setChatHasMore(Boolean(result.hasMore));
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Could not load older messages"
      );
    } finally {
      chatOlderLoadingRef.current = false;
      setChatLoadingOlder(false);
    }
  }

  function handleChatFeedScroll() {
    const feed = chatFeedRef.current;
    if (!feed) return;

    const distanceFromBottom =
      feed.scrollHeight - feed.clientHeight - feed.scrollTop;

    chatShouldStickToBottomRef.current =
      distanceFromBottom < 110;

    if (feed.scrollTop < 70) {
      void loadOlderChat();
    }
  }

  async function sendChatMessage() {
    const content = chatText.trim();

    if (!content || content.length > 1000 || chatSending) return;

    try {
      setChatSending(true);
      setChatError("");

      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          replyTo: replyTo?.id ?? null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Message could not be sent");
      }

      setChatText("");
      setReplyTo(null);

      chatShouldStickToBottomRef.current = true;

      await loadChat(true);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Sending failed"
      );
    } finally {
      setChatSending(false);
    }
  }

  async function toggleChatReaction(
    messageId: string,
    reaction: string
  ) {
    try {
      const response = await fetch("/api/chat/reactions", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId,
          reaction,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Reaction failed");
      }

      await loadChat(true);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Reaction failed"
      );
    }
  }

  function handleChatKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendChatMessage();
    }
  }

  function handleMessageTap(messageId: string) {
    const now = Date.now();
    const previous = lastTapRef.current;

    if (
      previous?.id === messageId &&
      now - previous.time < 350
    ) {
      lastTapRef.current = null;
      void toggleChatReaction(messageId, "🔥");
      return;
    }

    lastTapRef.current = {
      id: messageId,
      time: now,
    };
  }

  // Telegram authentication must finish before API requests.
  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      try {
        const telegram = (
          window as Window & {
            Telegram?: {
              WebApp?: {
                initData?: string;
                ready?: () => void;
                expand?: () => void;
              };
            };
          }
        ).Telegram?.WebApp;

        telegram?.ready?.();
        telegram?.expand?.();

        const initData = telegram?.initData;

        if (!initData) {
          throw new Error(
            "Open K7 CREW inside Telegram to sign in."
          );
        }

        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ initData }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Telegram authentication failed"
          );
        }

        if (cancelled) return;

        setAuthError("");
        setAuthReady(true);

        // Capabilities are loaded from the server; never trust a client-side role.
        // A temporary /me failure must not undo an already valid Telegram login.
        try {
          const meResponse = await fetch("/api/auth/me", {
            credentials: "include",
            cache: "no-store",
          });
          if (meResponse.ok) {
            const me = await meResponse.json();
            if (!cancelled && me.success && ["OWNER", "ADMIN", "IGL", "MEMBER"].includes(me.user?.accessRole)) {
              setAccessRole(me.user.accessRole);
              setViewer(me.user);
            }
          }
        } catch (profileError) {
          console.error("Current user display unavailable:", profileError);
        }

        if (!cancelled) await loadRoster();
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : "Authentication failed";

        setAuthError(message);
        setChatError(message);
        setError(message);
        setLoading(false);
      }
    }

    void initializeApp();

    const introTimer = window.setTimeout(() => {
      setIntroVisible(false);
    }, 2300);

    return () => {
      cancelled = true;
      window.clearTimeout(introTimer);
    };
  }, []);

  // Chat requests only run after successful authentication.
  useEffect(() => {
    if (!authReady || activeTab !== "chat") return;

    void loadChat();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadChat(true);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeTab, authReady]);

  // Keep chat position stable when messages change.
  useEffect(() => {
    const feed = chatFeedRef.current;

    if (!feed || chatMessages.length === 0) return;

    const previousPosition = chatPrependPositionRef.current;

    if (previousPosition) {
      chatPrependPositionRef.current = null;

      window.requestAnimationFrame(() => {
        feed.scrollTop =
          feed.scrollHeight -
          previousPosition.height +
          previousPosition.top;
      });

      return;
    }

    if (chatShouldStickToBottomRef.current) {
      window.requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    }
  }, [chatMessages]);

  // Cinematic scroll: all five chapters live on one continuous page.
  // The bottom menu tracks the chapter currently under the viewer's eye.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        }
      },
      { threshold: 0.04, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal-content").forEach((item) => revealObserver.observe(item));

    let frame = 0;
    const updateCinema = () => {
      frame = 0;
      const focusY = window.innerHeight * 0.44;
      let nearest: TabId = "chat";
      let nearestDistance = Infinity;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - focusY);
        if (rect.bottom > 0 && rect.top < window.innerHeight && distance < nearestDistance) {
          nearest = section.id as TabId;
          nearestDistance = distance;
        }
        // No need to animate scenes far outside the viewport.
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;

        const span = Math.max(rect.height / 2, window.innerHeight / 2, 1);
        const relative = Math.max(-1, Math.min(1, (focusY - centerY) / span));
        const centered = 1 - Math.abs(relative);
        const motion = reducedMotion.matches ? 0 : relative;
        section.style.setProperty("--k7-travel", `${(motion * 105).toFixed(1)}px`);
        section.style.setProperty("--k7-travel-neg", `${(-motion * 105).toFixed(1)}px`);
        section.style.setProperty("--k7-travel-half", `${(motion * 53).toFixed(1)}px`);
        section.style.setProperty("--k7-travel-half-neg", `${(-motion * 53).toFixed(1)}px`);
        section.style.setProperty("--k7-angle", `${(motion * 12).toFixed(2)}deg`);
        section.style.setProperty("--k7-glow", `${(0.54 + centered * 0.46).toFixed(3)}`);
        section.style.setProperty("--k7-scale", `${(1.01 + centered * 0.20).toFixed(3)}`);
        section.style.setProperty("--k7-blur", `${(0.5 + Math.abs(motion) * 2.4).toFixed(2)}px`);
        section.style.setProperty("--k7-bright", `${(0.64 + centered * 0.7).toFixed(2)}`);
        section.style.setProperty("--k7-focus", centered.toFixed(3));
      }
      // Don't jump to another tab when the keyboard moves the viewport.
      if (!chatInputFocusedRef.current && nearestDistance !== Infinity) {
        setActiveTab((previous) => previous === nearest ? previous : nearest);
      }
    };
    const requestUpdate = () => { if (!frame) frame = window.requestAnimationFrame(updateCinema); };
    updateCinema();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reducedMotion.addEventListener("change", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotion.removeEventListener("change", requestUpdate);
      revealObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function navigateTo(id: string) {
    if (!tabs.some((tab) => tab.id === id)) return;
    chatInputFocusedRef.current = false;
    setActiveTab(id as TabId);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  function getPlayerForSlot(slot: string) {
    return roster.find((player) => player.slot === slot);
  }

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
        </div>
        <div className="elite-background-noise" />
      </div>

      <header className="k7-app-header">
        <img src="/k7-logo-transparent.png" alt="" className="k7-header-logo" />
        <div className="k7-header-brand"><strong>K7 CREW</strong><span>TELEGRAM MINI APP</span></div>
        {(accessRole === "OWNER" || accessRole === "IGL") && (
          <span className="k7-header-access"><Crown size={12} /> УПРАВЛЕНИЕ</span>
        )}
      </header>

      <section
        id="chat"
        data-nav-section
        className="elite-content-section k7-cinema-section"
      >
        <SceneBackdrop scene="chat" />
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            03 / COMMUNICATION
          </div>

          <div className="k7-chat">
            <div className="k7-chat-heading">
              <div>
                <div className="k7-chat-eyebrow">
                  K7 COMMUNITY
                </div>

                <h2>
                  THE CHAT<span>.</span>
                </h2>

                <p>ONE CREW. ONE CONNECTION.</p>
                <p className="k7-chat-timer">ТАЙМЕР УДАЛЕНИЯ СООБЩЕНИЙ — 10 МИН.</p>
                {viewer && (
                  <div className="k7-chat-viewer">
                    {viewer.photoUrl ? <img src={viewer.photoUrl} alt="" /> : <div className="k7-chat-viewer-initial">{viewer.firstName.charAt(0).toUpperCase()}</div>}
                    <span>
                      <strong>{viewer.username ? `@${viewer.username}` : viewer.firstName}</strong>
                      <small>{roster.find((player) => player.telegram_id === viewer.telegramId)?.game_role ?? (accessRole === "MEMBER" ? "Участник сообщества" : accessRole)}</small>
                    </span>
                  </div>
                )}
              </div>

              <div className="k7-chat-live">
                <i />
                LIVE
              </div>
            </div>

            {(accessRole === "OWNER" || accessRole === "IGL") && (
              <div className="k7-chat-management">
                <button type="button" className="k7-panel-button" onClick={() => setChatManageOpen((value) => !value)}>
                  <Shield size={13} /> НАСТРОЙКИ ЧАТА
                </button>
                {chatManageOpen && <div className="k7-chat-management-tools">
                  <span>Автоудаление сообщений — 10 минут</span>
                  <button type="button" className="k7-panel-button" onClick={() => void moderateChat()}>ОЧИСТИТЬ ЧАТ</button>
                </div>}
              </div>
            )}
            <div
              className="k7-chat-feed"
              ref={chatFeedRef}
              onScroll={handleChatFeedScroll}
            >
              {chatLoadingOlder && (
                <div className="k7-chat-history-loading">
                  LOADING OLDER MESSAGES...
                </div>
              )}

              {!authReady ? (
                <div className="k7-chat-status">
                  {authError || "CONNECTING TO K7 CREW..."}
                </div>
              ) : chatLoading && chatMessages.length === 0 ? (
                <div className="k7-chat-status">
                  CONNECTING TO THE CREW...
                </div>
              ) : chatError && chatMessages.length === 0 ? (
                <div className="k7-chat-status k7-chat-error">
                  {chatError}
                  <button onClick={() => void loadChat()}>
                    RETRY
                  </button>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="k7-chat-empty">
                  <MessageCircle size={30} />
                  <span>THE CONVERSATION STARTS HERE.</span>
                  <small>BE THE FIRST TO SEND A MESSAGE.</small>
                </div>
              ) : (
                chatMessages.map((message) => {
                  const profile = getChatProfile(message);
                  const isOwn =
                    currentUserId !== null &&
                    Number(message.telegram_id) === currentUserId;

                  const repliedMessage = message.reply_to
                    ? chatMessages.find(
                        (item) => item.id === message.reply_to
                      )
                    : null;

                  return (
                    <article
                      key={message.id}
                      className={`k7-chat-message ${
                        isOwn ? "is-own" : ""
                      }`}
                    >
                      <div className="k7-chat-avatar">
                        {profile?.photo_url ? (
                          <img
                            src={profile.photo_url}
                            alt=""
                          />
                        ) : (
                          <span>{getChatInitial(message)}</span>
                        )}
                      </div>

                      <div className="k7-chat-message-body">
                        <div className="k7-chat-message-meta">
                          <span className="k7-chat-author">
                            {getChatName(message)}
                          </span>

                          {isOwn && (
                            <span className="k7-chat-you">
                              YOU
                            </span>
                          )}

                          <time>
                            {getChatTime(message.created_at)}
                          </time>
                        </div>

                        {repliedMessage && (
                          <div className="k7-chat-reply-preview">
                            <span>
                              REPLY TO {getChatName(repliedMessage)}
                            </span>
                            <p>{repliedMessage.content}</p>
                          </div>
                        )}

                        <div
                          className="k7-chat-message-text"
                          onClick={() => handleMessageTap(message.id)}
                        >
                          {message.content}
                        </div>

                        <div className="k7-chat-message-actions">
                          {(accessRole === "OWNER" || accessRole === "IGL") && (
                            <button type="button" onClick={() => void moderateChat(message.id)} aria-label="Удалить сообщение">УДАЛИТЬ</button>
                          )}
                          <button
                            onClick={() => setReplyTo(message)}
                            aria-label="Reply"
                          >
                            REPLY
                          </button>

                          <div className="k7-chat-reactions">
                            {chatReactionOptions.map((reaction) => {
                              const matches =
                                message.chat_reactions?.filter(
                                  (item) => item.reaction === reaction
                                ) ?? [];

                              const selected = matches.some(
                                (item) =>
                                  Number(item.telegram_id) === currentUserId
                              );

                              return (
                                <button
                                  key={reaction}
                                  className={
                                    matches.length > 0
                                      ? `k7-chat-reaction ${
                                          selected ? "selected" : ""
                                        }`
                                      : "k7-chat-reaction-empty"
                                  }
                                  onClick={() =>
                                    void toggleChatReaction(
                                      message.id,
                                      reaction
                                    )
                                  }
                                  aria-label={`React ${reaction}`}
                                >
                                  {reaction}
                                  {matches.length > 0 && (
                                    <span>{matches.length}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}

              <div ref={chatEndRef} />
            </div>

            {chatError && chatMessages.length > 0 && (
              <div className="k7-chat-inline-error">
                {chatError}
              </div>
            )}
            <div className="k7-chat-composer">
              <div className="k7-chat-composer-inner">
                {replyTo && (
                  <div className="k7-chat-replying">
                    <div>
                      <span>REPLYING TO</span>
                      <strong>{getChatName(replyTo)}</strong>
                    </div>
                    <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                      ×
                    </button>
                  </div>
                )}
                <div className="k7-chat-input-row">
                  <textarea
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value.slice(0, 1000))}
                    onKeyDown={handleChatKeyDown}
                    onPointerDown={() => { chatInputFocusedRef.current = true; }}
                    onFocus={() => { chatInputFocusedRef.current = true; }}
                    onBlur={() => { chatInputFocusedRef.current = false; }}
                    placeholder="Write a message..."
                    aria-label="Сообщение чата"
                    maxLength={1000}
                    rows={1}
                    disabled={!authReady || chatSending}
                  />
                  <span className="k7-chat-counter">{chatText.length}/1000</span>
                  <button
                    type="button"
                    className="k7-chat-send"
                    onClick={() => void sendChatMessage()}
                    disabled={!authReady || !chatText.trim() || chatSending}
                    aria-label="Send message"
                  >
                    <MessageCircle size={19} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section
        id="events"
        data-nav-section
        className="elite-content-section k7-cinema-section"
      >
        <SceneBackdrop scene="events" />
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            05 / COMPETITION
          </div>

          <EventsPanel
            authReady={authReady}
            canManage={accessRole === "OWNER" || accessRole === "IGL"}
          />
        </div>
      </section>


      <section
        id="roster"
        data-nav-section
        className="elite-content-section k7-cinema-section elite-roster-section"
      >
        <SceneBackdrop scene="roster" />
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
              onClick={() => void loadRoster()}
              disabled={loading || !authReady}
              aria-label="Refresh roster"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {!authReady ? (
            <div className="elite-loading">
              {authError || "AUTHENTICATING..."}
            </div>
          ) : loading ? (
            <div className="elite-loading">
              LOADING THE SQUAD...
            </div>
          ) : error ? (
            <div className="elite-error">
              <p>{error}</p>
              <button onClick={() => void loadRoster()}>
                TRY AGAIN
              </button>
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

              {(accessRole === "OWNER" || accessRole === "IGL") && (
                <RosterAdminPanel roster={roster} onUpdated={loadRoster} />
              )}
            </>
          )}
        </div>
      </section>


      <section
        id="news"
        data-nav-section
        className="elite-content-section k7-cinema-section"
      >
        <SceneBackdrop scene="news" />
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            09 / LATEST UPDATES
          </div>

          <NewsPanel
            authReady={authReady}
            canManage={accessRole === "OWNER" || accessRole === "IGL"}
          />
        </div>
      </section>


      <section
        id="stats"
        data-nav-section
        className="elite-content-section k7-cinema-section"
      >
        <SceneBackdrop scene="stats" />
        <div className="elite-section-inner reveal-content">
          <div className="section-eyebrow">
            11 / PERFORMANCE
          </div>

          <StatsPanel
            authReady={authReady}
            canSubmit={accessRole === "OWNER" || accessRole === "IGL"}
            roster={roster}
          />
        </div>
      </section>


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
