import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { dash, dashFmt } from "@/lib/i18n/appUi";
import { authedFetch } from "@/lib/userAuthClient";

// Modal de chats del cliente — UI tipo mensajería con burbujas y lista refinada
export default function UserMessagesModal({
  isOpen,
  onClose,
  userId,
  onMessagesUpdate,
  onSendMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onMessagesUpdate: () => void;
  onSendMessage: () => void;
}) {
  const { locale } = useAppLocale();
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      subject: string;
      message: string;
      userName: string | null;
      replied: boolean;
      closed: boolean;
      closedAt: string | null;
      initiatedByAdmin?: boolean;
      replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
      createdAt: string | null;
      lastReplyAt: string | null;
      userRead: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const onMessagesUpdateRef = useRef(onMessagesUpdate);
  onMessagesUpdateRef.current = onMessagesUpdate;
  const loadMessagesRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    if (isOpen && userId) {
      loadMessages(false);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const interval = setInterval(() => {
      void loadMessagesRef.current?.(true);
      onMessagesUpdateRef.current?.();
    }, 15000);

    return () => clearInterval(interval);
  }, [isOpen, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      const sorted = sortMessagesByDate(messages);
      const currentIds = messages.map((m) => m.id).join(",");
      const sortedIds = sorted.map((m) => m.id).join(",");
      if (currentIds !== sortedIds) {
        setMessages(sorted);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (selectedMessage && messagesScrollRef.current) {
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [selectedMessage, messages]);

  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const sortMessagesByDate = (
    msgs: Array<{
      id: string;
      subject: string;
      message: string;
      userName: string | null;
      replied: boolean;
      closed: boolean;
      closedAt: string | null;
      initiatedByAdmin?: boolean;
      replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
      createdAt: string | null;
      lastReplyAt: string | null;
      userRead: boolean;
    }>
  ) => {
    return [...msgs].sort((a, b) => {
      if (a.closed && !b.closed) return 1;
      if (!a.closed && b.closed) return -1;

      if (a.closed && b.closed) {
        const dateA = a.closedAt
          ? new Date(a.closedAt).getTime()
          : a.lastReplyAt
            ? new Date(a.lastReplyAt).getTime()
            : a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
        const dateB = b.closedAt
          ? new Date(b.closedAt).getTime()
          : b.lastReplyAt
            ? new Date(b.lastReplyAt).getTime()
            : b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
        return dateB - dateA;
      }

      const aIsUnread = a.replied && !a.userRead;
      const bIsUnread = b.replied && !b.userRead;

      if (aIsUnread && !bIsUnread) return -1;
      if (!aIsUnread && bIsUnread) return 1;

      const dateA = a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(`/api/user/messages?userId=${userId}`);
      if (!response.ok) throw new Error(dash(locale, "msgLoadError"));
      const data = await response.json();
      const sortedMessages = sortMessagesByDate(data.messages || []);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  loadMessagesRef.current = loadMessages;

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await authedFetch("/api/user/markMessageRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messageId }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, userRead: true } : m)));
      onMessagesUpdate();
    } catch (error) {
      console.error("Error al marcar como leído:", error);
    }
  };

  const localeTag = locale === "en" ? "en-US" : "es-AR";

  const formatShort = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLong = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Estado derivado para el subtítulo de cada hilo en la lista */
  const threadStatusLabel = (msg: (typeof messages)[0]) => {
    if (msg.closed) return { text: dash(locale, "msgChatEnded"), className: "text-[var(--landing-muted)]" };
    const replies = msg.replies || [];
    if (replies.length === 0) return null;
    const lastReply = replies[replies.length - 1];
    const lastReplyIsAdmin = lastReply?.senderType === "admin";
    if (!lastReplyIsAdmin) {
      return { text: dash(locale, "msgReplied"), className: "text-emerald-400/90" };
    }
    let lastUserReplyIndex = -1;
    for (let i = replies.length - 1; i >= 0; i--) {
      if (replies[i].senderType === "user") {
        lastUserReplyIndex = i;
        break;
      }
    }
    if (lastUserReplyIndex === -1) {
      return { text: dash(locale, "msgTheyWrote"), className: "text-amber-400/90" };
    }
    const lastAdminReplyIndex = replies.length - 1;
    if (lastAdminReplyIndex > lastUserReplyIndex) {
      return { text: dash(locale, "msgNewMessage"), className: "text-sky-400/90" };
    }
    return { text: dash(locale, "msgReplied"), className: "text-emerald-400/90" };
  };

  const detailStatusBadge = (selectedMsg: (typeof messages)[number]) => {
    if (selectedMsg.closed) {
      return (
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[var(--landing-muted)]">
          {dash(locale, "msgChatEnded")}
        </span>
      );
    }
    const replies = selectedMsg.replies || [];
    if (replies.length === 0) return null;
    const lastReply = replies[replies.length - 1];
    const lastReplyIsAdmin = lastReply?.senderType === "admin";
    if (!lastReplyIsAdmin) {
      return (
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          {dash(locale, "msgBadgeReplied")}
        </span>
      );
    }
    let lastUserReplyIndex = -1;
    for (let i = replies.length - 1; i >= 0; i--) {
      if (replies[i].senderType === "user") {
        lastUserReplyIndex = i;
        break;
      }
    }
    if (lastUserReplyIndex === -1) {
      return (
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
          {dash(locale, "msgBadgeReply")}
        </span>
      );
    }
    const lastAdminReplyIndex = replies.length - 1;
    if (lastAdminReplyIndex > lastUserReplyIndex) {
      return (
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
          {dash(locale, "msgBadgeNew")}
        </span>
      );
    }
    return (
      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
        {dash(locale, "msgBadgeReplied")}
      </span>
    );
  };

  if (!isOpen) return null;

  const selectedMsg = selectedMessage ? messages.find((m) => m.id === selectedMessage) : null;
  const unreadCount = messages.filter((m) => m.replied && !m.userRead).length;

  const shell =
    "relative flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0b1020)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-2 backdrop-blur-md sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className={shell}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="relative shrink-0 border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_70%,transparent)] px-3 py-3 sm:px-5 sm:py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--landing-accent) 28%, transparent), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(6,182,212,0.12), transparent 50%)",
            }}
          />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <AnimatePresence mode="wait">
                {selectedMessage && (
                  <motion.button
                    key="back"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] md:hidden"
                    aria-label={dash(locale, "msgBackList")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-[var(--landing-accent)]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">{dash(locale, "msgTitle")}</h2>
                  {unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] ring-1 ring-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]">
                      {unreadCount === 1
                        ? dash(locale, "msgUnreadOne")
                        : dashFmt(locale, "msgUnreadMany", { n: unreadCount })}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--landing-muted)]">{dash(locale, "msgSubtitle")}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onSendMessage}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] sm:px-3 sm:text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-[var(--landing-accent)]">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden sm:inline">{dash(locale, "msgNewLong")}</span>
                <span className="sm:hidden">{dash(locale, "msgNewShort")}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
                aria-label={dash(locale, "modalClose")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
            <div className="h-4 w-40 animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/5" />
            <div className="mt-4 grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
            {/* Lista */}
            <div
              className={`${selectedMessage ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-[var(--landing-border)] md:w-[min(100%,320px)] md:border-r lg:w-[340px]`}
            >
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                    <span className="text-3xl opacity-90" aria-hidden>
                      💬
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{dash(locale, "msgEmptyTitle")}</p>
                    <p className="mt-1 max-w-[240px] text-xs text-[var(--landing-muted)]">{dash(locale, "msgEmptyBody")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onSendMessage}
                    className="rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-5 py-2.5 text-sm font-medium text-accent-ink shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--brand-mid)_45%,transparent)] transition hover:brightness-110"
                  >
                    {dash(locale, "msgSendFirst")}
                  </button>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-3 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklab,var(--landing-muted)_35%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_oklab,var(--landing-muted)_30%,transparent)]">
                  {messages.map((msg) => {
                    const unread = msg.replied && !msg.userRead;
                    const status = threadStatusLabel(msg);
                    const active = selectedMessage === msg.id;
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={async () => {
                          setSelectedMessage(msg.id);
                          if (msg.replied && !msg.userRead) {
                            await handleMarkAsRead(msg.id);
                          }
                        }}
                        className={`group w-full rounded-xl border text-left transition ${
                          active
                            ? "border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : unread
                              ? "border-transparent bg-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] hover:bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)]"
                              : "border-transparent bg-[var(--landing-surface)]/40 hover:bg-[var(--landing-surface)]"
                        } ${unread && !active ? "ring-1 ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]" : ""}`}
                      >
                        <div className="flex gap-2 p-3">
                          <div
                            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-[var(--landing-accent)] shadow-[0_0_8px_color-mix(in_oklab,var(--landing-accent)_60%,transparent)]" : "bg-transparent"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${unread ? "text-[var(--foreground)]" : "text-[var(--foreground)]/85"}`}>{msg.subject}</p>
                            {status && <p className={`mt-0.5 text-[11px] ${status.className}`}>{status.text}</p>}
                            {msg.createdAt && <p className="mt-1 text-[10px] text-[var(--landing-muted)]">{formatShort(msg.createdAt)}</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detalle / hilo */}
            <div className={`${selectedMessage ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_oklab,var(--background)_40%,transparent)]`}>
              {selectedMsg ? (
                <>
                  <div
                    ref={messagesScrollRef}
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklab,var(--landing-muted)_35%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_oklab,var(--landing-muted)_30%,transparent)]"
                  >
                    <div className="mx-auto max-w-2xl space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--landing-border)]/80 pb-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold leading-tight text-[var(--foreground)]">{selectedMsg.subject}</h3>
                          {selectedMsg.createdAt && (
                            <p className="mt-1 text-xs text-[var(--landing-muted)]">Iniciado · {formatLong(selectedMsg.createdAt)}</p>
                          )}
                        </div>
                        {detailStatusBadge(selectedMsg)}
                      </div>

                      {/* Mensaje inicial (vos) */}
                      <div className="flex justify-end">
                        <div className="max-w-[92%] sm:max-w-[85%]">
                          <p className="mb-1 text-right text-[10px] font-medium uppercase tracking-wider text-[var(--landing-muted)]">{dash(locale, "msgYou")}</p>
                          <div className="rounded-2xl rounded-br-md border border-sky-500/25 bg-gradient-to-br from-sky-500/20 to-cyan-500/10 px-4 py-3 text-[var(--foreground)] shadow-sm">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMsg.message}</p>
                          </div>
                        </div>
                      </div>

                      {selectedMsg.replies && selectedMsg.replies.length > 0 ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--landing-muted)]">{dash(locale, "msgConversation")}</p>
                          {selectedMsg.replies.map((reply, index) => {
                            const senderName =
                              reply.senderName ||
                              (reply.senderType === "admin" ? dash(locale, "msgTeamFitPlan") : dash(locale, "msgYou"));
                            const replyDate = reply.createdAt ? new Date(reply.createdAt) : null;
                            const isAdminReply = reply.senderType === "admin";

                            return (
                              <div key={index} className={`flex ${isAdminReply ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[92%] sm:max-w-[85%] ${isAdminReply ? "flex flex-row gap-2" : "flex flex-row-reverse gap-2"}`}>
                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${
                                      isAdminReply
                                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                                        : "bg-gradient-to-br from-sky-500 to-cyan-600"
                                    }`}
                                  >
                                    {senderName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div
                                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                        isAdminReply
                                          ? "rounded-tl-md border border-emerald-500/25 bg-[color-mix(in_oklab,#10b981_12%,transparent)] text-[var(--foreground)]"
                                          : "rounded-tr-md border border-sky-500/25 bg-gradient-to-br from-sky-500/15 to-cyan-500/5 text-[var(--foreground)]"
                                      }`}
                                    >
                                      <p className="mb-1 text-xs font-semibold text-[var(--foreground)]/90">{senderName}</p>
                                      <p className="whitespace-pre-wrap">{reply.message}</p>
                                    </div>
                                    {replyDate && (
                                      <p className={`mt-1 text-[10px] text-[var(--landing-muted)] ${isAdminReply ? "text-left" : "text-right"}`}>
                                        {replyDate.toLocaleDateString(localeTag, {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[var(--landing-border)] bg-[var(--landing-surface)]/30 px-4 py-8 text-center">
                          <p className="text-sm text-[var(--landing-muted)]">{dash(locale, "msgNoReplies")}</p>
                          <p className="mt-1 text-xs text-[var(--landing-muted)]/80">{dash(locale, "msgNoRepliesSub")}</p>
                        </div>
                      )}

                      {selectedMsg.closed && selectedMsg.closedAt && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                          <p className="text-xs text-[var(--landing-muted)]">
                            {dash(locale, "msgChatClosedOn")} {formatLong(selectedMsg.closedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_92%,#0a0f18)] px-3 py-3 sm:px-5 sm:py-4">
                    {selectedMsg.closed ? (
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center">
                        <p className="text-sm font-medium text-[var(--landing-muted)]">{dash(locale, "msgThreadClosed")}</p>
                        <p className="mt-1 text-xs text-[var(--landing-muted)]/85">{dash(locale, "msgThreadClosedSub")}</p>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-2xl space-y-3">
                        <label htmlFor="user-reply-chat" className="text-xs font-medium text-[var(--landing-muted)]">
                          {dash(locale, "msgYourReply")}
                        </label>
                        <textarea
                          id="user-reply-chat"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={dash(locale, "msgReplyPlaceholder")}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!replyText.trim() || !selectedMsg) return;

                            setReplying(true);
                            try {
                              const response = await authedFetch("/api/user/replyMessage", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  userId,
                                  messageId: selectedMsg.id,
                                  reply: replyText.trim(),
                                  userName: selectedMsg.userName,
                                }),
                              });

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || dash(locale, "msgReplyError"));
                              }

                              setMessages((prev) => {
                                const updated = prev.map((m) =>
                                  m.id === selectedMsg.id
                                    ? {
                                        ...m,
                                        replies: [
                                          ...(m.replies || []),
                                          {
                                            message: replyText.trim(),
                                            senderName: selectedMsg.userName || dash(locale, "msgUserFallback"),
                                            senderType: "user",
                                            createdAt: new Date().toISOString(),
                                          },
                                        ],
                                        lastReplyAt: new Date().toISOString(),
                                        replied: true,
                                      }
                                    : m
                                );
                                return sortMessagesByDate(updated);
                              });

                              await loadMessages();
                              setReplyText("");
                              onMessagesUpdate();
                              scrollToBottom();
                            } catch (error) {
                              console.error("Error al responder:", error);
                              alert(error instanceof Error ? error.message : dash(locale, "msgReplyError"));
                            } finally {
                              setReplying(false);
                            }
                          }}
                          disabled={replying || !replyText.trim()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] py-3 text-sm font-semibold text-[var(--foreground)] shadow-[0_12px_28px_-20px_color-mix(in_oklab,var(--brand-end)_80%,transparent)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {!replying && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                              <path d="M22 2L11 13" />
                              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                            </svg>
                          )}
                          {replying ? dash(locale, "msgSending") : dash(locale, "msgSendReply")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center my-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[var(--landing-muted)]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="max-w-xs text-sm text-[var(--landing-muted)]">{dash(locale, "msgPickThread")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
