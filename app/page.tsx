
"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { EventsPanel, NewsPanel, StatsPanel, RosterAdminPanel } from "@/components/k7-panels";
import CinemaWorld from "@/components/cinema-world";
import CinemaWeather from "@/components/cinema-weather";
import { CommunityCounter, ReportButton, ReportsInbox } from "@/components/community-tools";
import {
  MessageCircle,
  CalendarDays,
  Users,
  Newspaper,
  Trophy,
  RefreshCw,
  Crown,
  Shield,
  MessageSquare,
} from "lucide-react";

type TabId = "chat" | "events" | "roster" | "news" | "stats" | "messages";

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
  { id: "chat", label: "\u{427}\u{430}\u{442}", icon: MessageCircle },
  { id: "events", label: "\u{421}\u{43E}\u{431}\u{44B}\u{442}\u{438}\u{44F}", icon: CalendarDays },
  { id: "roster", label: "\u{421}\u{43E}\u{441}\u{442}\u{430}\u{432}", icon: Users },
  { id: "news", label: "\u{41D}\u{43E}\u{432}\u{43E}\u{441}\u{442}\u{438}", icon: Newspaper },
  { id: "stats", label: "\u{421}\u{442}\u{430}\u{442}\u{438}\u{441}\u{442}\u{438}\u{43A}\u{430}", icon: Trophy },
] as const;

const adminTab = { id: "messages" as const, label: "Ð¡Ð¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ", icon: MessageSquare };

const mainSlots = ["MAIN_1", "MAIN_2", "MAIN_3", "MAIN_4"];
const subSlots = ["SUB_1", "SUB_2", "SUB_3"];
const chatReactionOptions = ["\u{1F525}", "\u{2764}\u{FE0F}", "\u{1F44D}", "\u{1F44E}"];

const sceneCopy: Record<TabId, { first: string; second: string; third: string }> = {
  chat: { first: "ONE CREW", second: "ONE SIGNAL", third: "01 / SIGNAL â CONNECTED" },
  events: { first: "ENTER", second: "THE ARENA", third: "02 / ARENA â COMPETE" },
  roster: { first: "BUILT", second: "AS ONE", third: "03 / FORMATION â UNITED" },
  news: { first: "MAKE", second: "AN IMPACT", third: "04 / TRANSMISSION â LIVE" },
  stats: { first: "NUMBERS", second: "NEVER LIE", third: "05 / PRECISION â PROVE IT" },
  messages: { first: "DIRECT", second: "MESSAGES", third: "ADMIN / INBOX" },
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

/**
 * Each scene has a distinct silhouette. The live controls are never in 3D:
 * only these decorative assets and the shared WebGL world are animated.
 */
const sceneIdentity: Record<TabId, { number: string; label: string }> = {
  chat: { number: "01", label: "SIGNAL" },
  events: { number: "02", label: "ARENA" },
  roster: { number: "03", label: "FORMATION" },
  news: { number: "04", label: "TRANSMISSION" },
  stats: { number: "05", label: "PRECISION" },
  messages: { number: "06", label: "INBOX" },
};

function SceneBackdrop({ scene }: { scene: TabId }) {
  const words = sceneCopy[scene];
  const identity = sceneIdentity[scene];
  return (
    <div className={`k7-stage k7-stage-${scene}`} aria-hidden="true">
      <div className="k7-stage-vignette" />
      <div className="k7-stage-axis" />
      <div className="k7-stage-symbolic" />
      <div className="k7-stage-topline"><span>CREW / EST. 2026</span><span>{identity.number} â {identity.label}</span></div>
      <div className="k7-stage-typography">
        <span className="k7-stage-title">{words.first}</span>
        <span className="k7-stage-echo">{words.second}</span>
      </div>
      <div className="k7-stage-footer">{words.third}</div>
      {scene === "roster" && <div className="k7-stage-structural-mark">K7</div>}
      {scene === "news" && <div className="k7-stage-press-seal">K7<span>EST / 26</span></div>}
      {scene === "events" && <img className="k7-stage-logo-fragment" src="/k7-logo-transparent.png" alt="" draggable={false} />}
      {scene === "stats" && <div className="k7-stage-coordinate">00.00 <span>METRIC / ACTIVE</span></div>}
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
  const [chatPendingDelete, setChatPendingDelete] = useState<string | null>(null);
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
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatRestoreRef = useRef(false);
  const syncViewportRef = useRef<(() => void) | null>(null);

  const chatShouldStickToBottomRef = useRef(true);
  const chapterScrollFrameRef = useRef<number | null>(null);
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
    try {
      const response = await fetch("/api/chat", {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "\u{41E}\u{448}\u{438}\u{431}\u{43A}\u{430} \u{43C}\u{43E}\u{434}\u{435}\u{440}\u{430}\u{446}\u{438}\u{438}");
      setChatMessages((current) => id ? current.filter((message) => message.id !== id) : []);
      setChatHasMore(false);
      setChatPendingDelete(null);
      setChatError("");
    } catch (err) { setChatError(err instanceof Error ? err.message : "\u{41E}\u{448}\u{438}\u{431}\u{43A}\u{430} \u{43C}\u{43E}\u{434}\u{435}\u{440}\u{430}\u{446}\u{438}\u{438}"); }
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
      chatRestoreRef.current = true;
      chatInputFocusedRef.current = false;
      chatInputRef.current?.blur();
      await loadChat(true);
      syncViewportRef.current?.();
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
      void toggleChatReaction(messageId, "\u{1F525}");
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
    }, 650);

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

  // Mobile keyboard: follow the *visual* viewport used by iOS and Telegram WebView.
  // Keep the chat composed inside the visible window and restore chapter framing
  // only after keyboard dismissal, without fighting manual scrolling.
  useEffect(() => {
    const visual = window.visualViewport;
    const telegram = (window as Window & { Telegram?: { WebApp?: { viewportStableHeight?: number; onEvent?: (name: string, callback: () => void) => void; offEvent?: (name: string, callback: () => void) => void } } }).Telegram?.WebApp;
    let baseline = Math.max(visual?.height ?? window.innerHeight, telegram?.viewportStableHeight ?? 0);
    let frame = 0;
    let keyboardPreviouslyOpen = false;
    const update = () => {
      frame = 0;
      const height = Math.max(240, visual?.height ?? window.innerHeight);
      const offsetTop = visual?.offsetTop ?? 0;
      const root = document.documentElement;
      root.style.setProperty("--k7-visual-height", `${height}px`);
      root.style.setProperty("--k7-visual-top", `${offsetTop}px`);
      const keyboardOpen = baseline - height > 125;
      if (keyboardOpen) keyboardPreviouslyOpen = true;
      root.classList.toggle("k7-keyboard-open", keyboardOpen && (chatInputFocusedRef.current || chatRestoreRef.current));
      if (!keyboardOpen && !chatInputFocusedRef.current) baseline = Math.max(baseline, height);
      if (chatRestoreRef.current && !chatInputFocusedRef.current && (!keyboardOpen || !keyboardPreviouslyOpen)) {
        chatRestoreRef.current = false;
        keyboardPreviouslyOpen = false;
        root.classList.remove("k7-keyboard-open");
        const chat = document.getElementById("chat");
        if (chat && window.scrollY < chat.offsetTop + chat.offsetHeight + 120) {
          const top = Math.max(0, window.scrollY + chat.getBoundingClientRect().top - 48);
          window.scrollTo({ top, behavior: "instant" });
        }
        const feed = chatFeedRef.current;
        if (feed) feed.scrollTop = feed.scrollHeight;
      }
    };
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    syncViewportRef.current = queue;
    queue();
    visual?.addEventListener("resize", queue);
    visual?.addEventListener("scroll", queue);
    window.addEventListener("resize", queue);
    telegram?.onEvent?.("viewportChanged", queue);
    return () => {
      syncViewportRef.current = null;
      if (frame) window.cancelAnimationFrame(frame);
      visual?.removeEventListener("resize", queue);
      visual?.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      telegram?.offEvent?.("viewportChanged", queue);
      document.documentElement.classList.remove("k7-keyboard-open");
    };
  }, []);

  // Fast mobile CINEMA: one continuous scroll with lightweight RAF parallax.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      }
    }, { threshold: 0.03, rootMargin: "0px 0px 12% 0px" });
    document.querySelectorAll(".reveal-content").forEach((node) => reveal.observe(node));
    let raf = 0;
    let lastActive: TabId = "chat";
    const render = () => {
      raf = 0;
      const center = window.innerHeight * 0.39;
      let closest: TabId = lastActive;
      let best = Infinity;
      for (const section of sections) {
        const bounds = section.getBoundingClientRect();
        if (bounds.bottom < -100 || bounds.top > window.innerHeight + 100) continue;
        const mid = bounds.top + bounds.height * 0.5;
        const distance = Math.abs(mid - center);
        if (distance < best) { best = distance; closest = section.id as TabId; }
        const spread = Math.max(bounds.height * .5, window.innerHeight * .5);
        const travel = Math.max(-1, Math.min(1, (center - mid) / spread));
        section.style.setProperty("--scene-shift", `${(reduced.matches ? 0 : travel * 36).toFixed(1)}px`);
        section.style.setProperty("--scene-shift-fast", `${(reduced.matches ? 0 : travel * -62).toFixed(1)}px`);
        section.style.setProperty("--scene-focus", `${(1 - Math.abs(travel)).toFixed(2)}`);
      }
      if (!chatInputFocusedRef.current && best !== Infinity && closest !== lastActive) {
        lastActive = closest;
        setActiveTab(closest);
      }
      const height = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty("--k7-scroll", height > 0 ? `${(window.scrollY / height * 100).toFixed(2)}%` : "0%");
    };
    const requestRender = () => { if (!raf) raf = requestAnimationFrame(render); };
    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    reduced.addEventListener("change", requestRender);
    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reduced.removeEventListener("change", requestRender);
      reveal.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // A manual gesture immediately cancels programmatic camera navigation.
  useEffect(() => {
    const interrupt = () => {
      if (chapterScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(chapterScrollFrameRef.current);
        chapterScrollFrameRef.current = null;
      }
    };
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("pointerdown", interrupt, { passive: true });
    return () => {
      interrupt();
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("pointerdown", interrupt);
    };
  }, []);

  function navigateTo(id: string) {
    const manager = accessRole === "OWNER" || accessRole === "IGL";
    if (!tabs.some((tab) => tab.id === id) && !(id === "messages" && manager)) return;
    chatInputFocusedRef.current = false;
    chatInputRef.current?.blur();
    setActiveTab(id as TabId);
    const node = document.getElementById(id);
    if (!node) return;
    const destination = window.scrollY + node.getBoundingClientRect().top - 48;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { window.scrollTo(0, destination); return; }
    // Native smooth scrolling over a multi-chapter distance feels slow on iOS.
    // Explicitly cap chapter navigation at 440ms, regardless of distance.
    if (chapterScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(chapterScrollFrameRef.current);
      chapterScrollFrameRef.current = null;
    }
    const initial = window.scrollY;
    const delta = destination - initial;
    const started = performance.now();
    const duration = 360;
    const animate = (time: number) => {
      const t = Math.min(1, (time - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, initial + delta * eased);
      chapterScrollFrameRef.current = t < 1
        ? window.requestAnimationFrame(animate)
        : null;
    };
    chapterScrollFrameRef.current = window.requestAnimationFrame(animate);
  }

  function getPlayerForSlot(slot: string) {
    return roster.find((player) => player.slot === slot);
  }

  const canManage = accessRole === "OWNER" || accessRole === "IGL";
  const navigationTabs = canManage ? [...tabs, adminTab] : [...tabs];

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

      <CinemaWorld />
      <CinemaWeather scene={activeTab} />


      <header className="k7-app-header">
        <strong className="k7-header-brand">K7<span> / CREW</span></strong>
        <span className="k7-header-scene"><b>{sceneIdentity[activeTab].number}</b> {sceneIdentity[activeTab].label}</span>
        <CommunityCounter authReady={authReady} />
        {(accessRole === "OWNER" || accessRole === "IGL") && (
          <span className="k7-header-access" title="Owner / captain"><Crown size={13} /> CONTROL</span>
        )}
        <i className="k7-header-progress" aria-hidden="true" />
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
                <p className="k7-chat-timer">&#x422;&#x410;&#x419;&#x41C;&#x415;&#x420; &#x423;&#x414;&#x410;&#x41B;&#x415;&#x41D;&#x418;&#x42F; &#x421;&#x41E;&#x41E;&#x411;&#x429;&#x415;&#x41D;&#x418;&#x419; &#x2014; 10 &#x41C;&#x418;&#x41D;.</p>
                {viewer && (
                  <div className="k7-chat-viewer">
                    {viewer.photoUrl ? <img src={viewer.photoUrl} alt="" /> : <div className="k7-chat-viewer-initial">{viewer.firstName.charAt(0).toUpperCase()}</div>}
                    <span>
                      <strong>{viewer.username ? `@${viewer.username}` : viewer.firstName}</strong>
                      <small>{roster.find((player) => player.telegram_id === viewer.telegramId)?.game_role ?? (accessRole === "MEMBER" ? "\u{423}\u{447}\u{430}\u{441}\u{442}\u{43D}\u{438}\u{43A} \u{441}\u{43E}\u{43E}\u{431}\u{449}\u{435}\u{441}\u{442}\u{432}\u{430}" : accessRole)}</small>
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
                  <Shield size={13} /> &#x41D;&#x410;&#x421;&#x422;&#x420;&#x41E;&#x419;&#x41A;&#x418; &#x427;&#x410;&#x422;&#x410;
                </button>
                {chatManageOpen && <div className="k7-chat-management-tools">
                  <span>&#x410;&#x432;&#x442;&#x43E;&#x443;&#x434;&#x430;&#x43B;&#x435;&#x43D;&#x438;&#x435; &#x441;&#x43E;&#x43E;&#x431;&#x449;&#x435;&#x43D;&#x438;&#x439; &#x2014; 10 &#x43C;&#x438;&#x43D;&#x443;&#x442;</span>
                  <button type="button" className="k7-panel-button" onClick={() => setChatPendingDelete("all")}>&#x41E;&#x427;&#x418;&#x421;&#x422;&#x418;&#x422;&#x42C; &#x427;&#x410;&#x422;</button>
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
                            <button type="button" onClick={() => setChatPendingDelete(message.id)} aria-label="&#x423;&#x434;&#x430;&#x43B;&#x438;&#x442;&#x44C; &#x441;&#x43E;&#x43E;&#x431;&#x449;&#x435;&#x43D;&#x438;&#x435;">&#x423;&#x414;&#x410;&#x41B;&#x418;&#x422;&#x42C;</button>
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
                      &#xD7;
                    </button>
                  </div>
                )}
                <div className="k7-chat-input-row">
                  <textarea
                    ref={chatInputRef}
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value.slice(0, 1000))}
                    onKeyDown={handleChatKeyDown}
                    onPointerDown={() => { chatInputFocusedRef.current = true; }}
                    onFocus={() => { chatInputFocusedRef.current = true; chatRestoreRef.current = false; syncViewportRef.current?.(); }}
                    onBlur={() => { chatInputFocusedRef.current = false; chatRestoreRef.current = true; syncViewportRef.current?.(); }}
                    placeholder="Write a message..."
                    aria-label="&#x421;&#x43E;&#x43E;&#x431;&#x449;&#x435;&#x43D;&#x438;&#x435; &#x447;&#x430;&#x442;&#x430;"
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


      {canManage && <section id="messages" data-nav-section className="elite-content-section k7-cinema-section k7-admin-chapter">
        <SceneBackdrop scene="messages" />
        <div className="elite-section-inner reveal-content"><ReportsInbox authReady={authReady} /></div>
      </section>}

      {canManage && chatPendingDelete && <div className="k7-modal-root" onPointerDown={event => {if(event.target === event.currentTarget) setChatPendingDelete(null);}}>
        <section className="k7-modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="k7-chat-delete-title">
          <div className="k7-modal-title"><span className="k7-panel-eyebrow">K7 / MODERATION</span><button type="button" onClick={() => setChatPendingDelete(null)} aria-label="ÐÑÐ¼ÐµÐ½Ð°">Ã</button></div>
          <h2 id="k7-chat-delete-title">ÐÐÐÐ¢ÐÐÐ ÐÐÐÐÐÐ</h2>
          <p>{chatPendingDelete === "all" ? "Ð£Ð´Ð°Ð»Ð¸ÑÑ Ð²ÑÐµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ ÑÐ°ÑÐ° Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ°?" : "Ð£Ð´Ð°Ð»Ð¸ÑÑ Ð²ÑÐ±ÑÐ°Ð½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ Ð´Ð»Ñ Ð²ÑÐµÑ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ¾Ð²?"}</p>
          <div className="k7-panel-card-actions">
            <button className="k7-panel-button k7-panel-primary" type="button" onClick={() => void moderateChat(chatPendingDelete === "all" ? undefined : chatPendingDelete)}>Ð£ÐÐÐÐÐ¢Ð¬</button>
            <button className="k7-panel-button" type="button" onClick={() => setChatPendingDelete(null)}>ÐÐ¢ÐÐÐÐ</button>
          </div>
        </section>
      </div>}

      <ReportButton authReady={authReady}/>

      <nav
        className="elite-bottom-nav"
        aria-label="Main navigation"
      >
        {navigationTabs.map((tab) => {
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
