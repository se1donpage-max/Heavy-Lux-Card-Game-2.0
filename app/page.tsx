"use client";


import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { EventsPanel, NewsPanel, StatsPanel, RosterAdminPanel } from "@/components/k7-panels";
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
          {player ? getPlayerName(player) : "Ð¡Ð²Ð¾Ð±Ð¾Ð´Ð½Ð¾Ðµ Ð¼ÐµÑÑÐ¾"}
        </div>

        <div className="roster-player-role">
          {player
            ? player.game_role || "TEAM MEMBER"
            : "ÐÐ¾ÑÑÑÐ¿Ð½Ð¾"}
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [introVisible, setIntroVisible] = useState(true);

  const [needsTelegram, setNeedsTelegram] = useState(false);
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
          if (!cancelled) setNeedsTelegram(true);
          throw new Error(
            "ÐÑÐºÑÐ¾Ð¹ÑÐµ K7 CREW Ð² Telegram, ÑÑÐ¾Ð±Ñ Ð²Ð¾Ð¹ÑÐ¸."
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

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-section]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.min(160, window.innerHeight * 0.3);
      const current = sections.filter(section => section.getBoundingClientRect().top <= line).pop();
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const active = atBottom ? sections[sections.length - 1] : current ?? sections[0];
      if (active && !chatInputFocusedRef.current) setActiveTab(active.id as TabId);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    sections.forEach(section => observer.observe(section));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [accessRole, authReady, introVisible]);

  function navigateTo(id: TabId) {
    chatInputRef.current?.blur();
    document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
    setActiveTab(id);
  }

  function getPlayerForSlot(slot: string) {
    return roster.find((player) => player.slot === slot);
  }

  const canManage = accessRole === "OWNER" || accessRole === "IGL";
  const navigationTabs = canManage ? [...tabs, adminTab] : [...tabs];

  if (introVisible || (!authReady && !authError)) {
    return <main className="intro-screen"><img src="/k7-logo-transparent.png" alt="K7 CREW" className="intro-logo" /></main>;
  }

  if (!authReady) {
    return (
      <main className="entry-shell">
        <section className="entry-card">
          <div className="entry-mark"><img src="/k7-logo-transparent.png" alt="K7 CREW" /></div>
          <h1>{needsTelegram ? "ÐÑÐ¾Ð´ ÑÐµÑÐµÐ· Telegram" : "ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð²Ð¾Ð¹ÑÐ¸"}</h1>
          <p>{needsTelegram ? "ÐÑÐºÑÐ¾Ð¹ÑÐµ ÑÐ°Ñ Ñ Ð±Ð¾ÑÐ¾Ð¼ K7 CREW Ð² Telegram Ð¸ Ð½Ð°Ð¶Ð¼Ð¸ÑÐµ ÐºÐ½Ð¾Ð¿ÐºÑ Ð·Ð°Ð¿ÑÑÐºÐ° Ð¿ÑÐ¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ." : "ÐÐ±Ð½Ð¾Ð²Ð¸ÑÐµ ÑÑÑÐ°Ð½Ð¸ÑÑ, ÑÑÐ¾Ð±Ñ Ð¿Ð¾Ð²ÑÐ¾ÑÐ¸ÑÑ Ð²ÑÐ¾Ð´ Ð² K7 CREW."}</p>
          {!needsTelegram && <button type="button" onClick={() => window.location.reload()}>ÐÐ¾Ð²ÑÐ¾ÑÐ¸ÑÑ Ð²ÑÐ¾Ð´</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="elite-shell" data-scene={activeTab}>
      <header className="k7-app-header">
        <h1 className="k7-header-brand">K7 CREW</h1>
        <CommunityCounter authReady={authReady} />
        {(accessRole === "OWNER" || accessRole === "IGL") && (
          <span className="k7-header-access" title="Owner / captain"><Crown size={13} /> Ð£Ð¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ</span>
        )}
      </header>

      <section
        id="chat"
        data-nav-section
        className="elite-content-section k7-cinema-section"
      >
        <div className="elite-section-inner reveal-content">

          <div className="k7-chat">
            <div className="k7-chat-heading">
              <div>
                <h2>Ð§Ð°Ñ</h2>
                <p className="k7-chat-timer">Ð¡Ð¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ Ð¸ÑÑÐµÐ·Ð°ÑÑ ÑÐµÑÐµÐ· 10 Ð¼Ð¸Ð½ÑÑ.</p>
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
                  ÐÐ°Ð³ÑÑÐ¶Ð°ÐµÐ¼ Ð¸ÑÑÐ¾ÑÐ¸Ñâ¦
                </div>
              )}

              {!authReady ? (
                <div className="k7-chat-status">
                  {authError || "ÐÐ¾Ð´ÐºÐ»ÑÑÐµÐ½Ð¸Ðµâ¦"}
                </div>
              ) : chatLoading && chatMessages.length === 0 ? (
                <div className="k7-chat-status">
                  ÐÐ°Ð³ÑÑÐ¶Ð°ÐµÐ¼ ÑÐ°Ñâ¦
                </div>
              ) : chatError && chatMessages.length === 0 ? (
                <div className="k7-chat-status k7-chat-error">
                  {chatError}
                  <button onClick={() => void loadChat()}>
                    ÐÐ¾Ð²ÑÐ¾ÑÐ¸ÑÑ
                  </button>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="k7-chat-empty">
                  <MessageCircle size={30} />
                  <span>ÐÐ¾ÐºÐ° Ð½ÐµÑ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ð¹</span>
                  <small>ÐÐ°ÑÐ½Ð¸ÑÐµ ÑÐ°Ð·Ð³Ð¾Ð²Ð¾Ñ Ñ ÐºÐ¾Ð¼Ð°Ð½Ð´Ð¾Ð¹.</small>
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
                              ÐÑ
                            </span>
                          )}

                          <time>
                            {getChatTime(message.created_at)}
                          </time>
                        </div>

                        {repliedMessage && (
                          <div className="k7-chat-reply-preview">
                            <span>
                              ÐÑÐ²ÐµÑ Ð´Ð»Ñ {getChatName(repliedMessage)}
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
                            ÐÑÐ²ÐµÑÐ¸ÑÑ
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
                      <span>ÐÑÐ²ÐµÑ Ð´Ð»Ñ</span>
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
                    placeholder="Ð¡Ð¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ"
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
        <div className="elite-section-inner reveal-content">

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
        <div className="elite-section-inner reveal-content">

          <div className="elite-section-heading">
            <div>
              <h2>Ð¡Ð¾ÑÑÐ°Ð²</h2>
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
              {authError || "ÐÑÐ¾Ð´â¦"}
            </div>
          ) : loading ? (
            <div className="elite-loading">
              ÐÐ°Ð³ÑÑÐ¶Ð°ÐµÐ¼ ÑÐ¾ÑÑÐ°Ð²â¦
            </div>
          ) : error ? (
            <div className="elite-error">
              <p>{error}</p>
              <button onClick={() => void loadRoster()}>
                ÐÐ¾Ð²ÑÐ¾ÑÐ¸ÑÑ
              </button>
            </div>
          ) : (
            <>
              <div className="elite-roster-group">
                <div className="elite-roster-label">
                  ÐÑÐ½Ð¾Ð²Ð½Ð¾Ð¹ ÑÐ¾ÑÑÐ°Ð² <span>4 Ð¼ÐµÑÑÐ°</span>
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
                  ÐÐ°Ð¿Ð°ÑÐ½ÑÐµ <span>3 Ð¼ÐµÑÑÐ°</span>
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
                <span>ÐÐ³ÑÐ¾ÐºÐ¾Ð² Ð² ÑÐ¾ÑÑÐ°Ð²Ðµ</span>
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
        <div className="elite-section-inner reveal-content">

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
        <div className="elite-section-inner reveal-content">

          <StatsPanel
            authReady={authReady}
            canSubmit={accessRole === "OWNER" || accessRole === "IGL"}
            roster={roster}
          />
        </div>
      </section>


      {canManage && <section id="messages" data-nav-section className="elite-content-section k7-cinema-section k7-admin-chapter">
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
