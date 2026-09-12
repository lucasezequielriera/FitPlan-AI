import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { useAuthStore } from "@/store/authStore";
import { adminFetch } from "@/lib/adminAuthClient";
import { dash } from "@/lib/i18n/appUi";
import { authedFetch } from "@/lib/userAuthClient";

/**
 * Modales que antes vivían dentro de `Navbar.tsx` (DESIGN_SYSTEM.md §11.8
 * punto 1: "dividir Navbar.tsx: separar el nav de los 2 modales que hoy
 * exporta"). Contenido sin cambios funcionales respecto al original — solo
 * cambia el archivo donde viven. `MessagesModal` sigue siendo importado por
 * `AdminShell.tsx` (chat admin), mismo contrato/props que antes.
 */

// Modal enviar mensaje — misma línea visual que UserMessagesModal
export function SendMessageModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  onMessageSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  userName: string | null;
  userEmail: string | null;
  onMessageSent?: () => void;
}) {
  const { locale } = useAppLocale();
  const { user: authUser } = useAuthStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !message.trim()) {
      setError(dash(locale, "composeEmpty"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authedFetch("/api/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.uid,
          userName: userName || null,
          userEmail: userEmail || null,
          subject: subject.trim() || dash(locale, "composeDefaultSubject"),
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || dash(locale, "composeError"));
      }

      setSuccess(true);
      setSubject("");
      setMessage("");

      if (onMessageSent) {
        onMessageSent();
      }

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : dash(locale, "composeError"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative w-full max-w-lg max-h-[min(92vh,720px)] overflow-y-auto rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0b1020)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_70%,transparent)] px-4 py-4 sm:px-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--landing-accent) 28%, transparent), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(6,182,212,0.12), transparent 50%)",
            }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5 text-[var(--landing-accent)]"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{dash(locale, "composeTitle")}</h2>
                <p className="truncate text-xs text-[var(--landing-muted)]">FitPlan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
              aria-label={dash(locale, "modalClose")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 ring-1 ring-success/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8 text-success">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="font-semibold text-success">{dash(locale, "composeSuccess")}</p>
              <p className="mt-2 text-sm text-[var(--landing-muted)]">{dash(locale, "composeSuccessSub")}</p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-6 rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-5 py-2.5 text-sm font-medium text-accent-ink shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--brand-mid)_45%,transparent)] transition hover:brightness-110"
              >
                {dash(locale, "composeAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--landing-muted)] sm:text-sm">
                  {dash(locale, "composeSubjectOptional")}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={dash(locale, "composeSubjectPlaceholder")}
                  className="w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--landing-muted)] sm:text-sm">
                  {dash(locale, "composeMessageLabel")} <span className="text-danger">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={dash(locale, "composeMessagePlaceholder")}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                  required
                  maxLength={2000}
                />
                <p className="mt-1 text-right text-[11px] text-[var(--landing-muted)]">{message.length}/2000</p>
              </div>

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)]"
                >
                  {dash(locale, "cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--brand-mid)_45%,transparent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? dash(locale, "composeSending") : dash(locale, "composeSend")}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Componente Modal para ver mensajes (admin)
export function MessagesModal({
  isOpen,
  onClose,
  adminUserId,
  onMessagesUpdate
}: {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  onMessagesUpdate: () => void;
}) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    subject: string;
    message: string;
    read: boolean;
    replied: boolean;
    closed: boolean;
    closedAt: string | null;
    initiatedByAdmin?: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && adminUserId) {
      loadMessages(false);
    }
  }, [isOpen, adminUserId]);

  // Recargar mensajes periódicamente cuando el modal está abierto para detectar nuevas respuestas
  useEffect(() => {
    if (!isOpen || !adminUserId) return;

    const interval = setInterval(() => {
      loadMessages(true);
      onMessagesUpdate(); // Actualizar contador también
    }, 15000); // Cada 15 segundos (menos frecuente para reducir re-renders)

    return () => clearInterval(interval);
  }, [isOpen, adminUserId, onMessagesUpdate]);

  // Reordenar mensajes cuando cambian
  useEffect(() => {
    if (messages.length > 0) {
      const sorted = sortMessagesByDate(messages);
      // Solo actualizar si el orden cambió
      const currentIds = messages.map(m => m.id).join(',');
      const sortedIds = sorted.map(m => m.id).join(',');
      if (currentIds !== sortedIds) {
        setMessages(sorted);
      }
    }
  }, [messages.length]); // Solo cuando cambia la cantidad de mensajes

  // Hacer scroll al final cuando se selecciona un mensaje o cambian las respuestas
  useEffect(() => {
    if (selectedMessage && messagesScrollRef.current) {
      // Pequeño delay para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [selectedMessage, messages]);

  // Función para ordenar mensajes: primero no leídos, luego leídos, finalmente finalizados
  const sortMessagesByDate = (msgs: Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    subject: string;
    message: string;
    read: boolean;
    replied: boolean;
    closed: boolean;
    closedAt: string | null;
    initiatedByAdmin?: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
  }>) => {
    return [...msgs].sort((a, b) => {
      // Primero: separar finalizados (van al final)
      if (a.closed && !b.closed) return 1;  // a va después
      if (!a.closed && b.closed) return -1; // a va primero

      // Si ambos están finalizados o ambos no están finalizados
      if (a.closed && b.closed) {
        // Ambos finalizados: ordenar por fecha de cierre (más reciente primero)
        const dateA = a.closedAt ? new Date(a.closedAt).getTime() : (a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const dateB = b.closedAt ? new Date(b.closedAt).getTime() : (b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return dateB - dateA; // Más reciente primero
      }

      // Si ninguno está finalizado: ordenar por no leídos primero
      const aIsUnread = !a.read;
      const bIsUnread = !b.read;

      if (aIsUnread && !bIsUnread) return -1; // a va primero
      if (!aIsUnread && bIsUnread) return 1;  // b va primero

      // Si ambos tienen el mismo estado de lectura, ordenar por fecha
      // Usar lastReplyAt si existe, sino createdAt
      const dateA = a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      // Ordenar descendente (más reciente primero)
      return dateB - dateA;
    });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await adminFetch(`/api/admin/messages?adminUserId=${adminUserId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
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

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await adminFetch("/api/admin/markMessageRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId, messageId }),
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
      onMessagesUpdate();
    } catch (error) {
      console.error("Error al marcar como leído:", error);
    }
  };

  // Función para hacer scroll al final después de enviar respuesta
  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleReply = async (messageId: string) => {
    if (!replyText.trim()) return;

    setReplying(true);
    try {
      const response = await adminFetch("/api/admin/replyMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId, messageId, reply: replyText.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || errorData.detail || `Error ${response.status}`);
      }

      // Actualizar el mensaje localmente primero para feedback inmediato
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                replies: [...(m.replies || []), {
                  message: replyText.trim(),
                  senderName: "Equipo de FitPlan",
                  senderType: "admin",
                  createdAt: new Date().toISOString(),
                }],
                lastReplyAt: new Date().toISOString(),
                replied: true,
                read: true,
              }
            : m
        );
        return sortMessagesByDate(updated);
      });

      // Recargar mensajes para obtener las respuestas actualizadas del servidor
      await loadMessages();
      setReplyText("");
      onMessagesUpdate();
      // Hacer scroll al final para ver la nueva respuesta
      scrollToBottom();
    } catch (error) {
      console.error("Error al responder:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al enviar respuesta";
      alert(`Error al enviar respuesta: ${errorMessage}`);
    } finally {
      setReplying(false);
    }
  };

  if (!isOpen) return null;

  const selectedMsg = selectedMessage ? messages.find(m => m.id === selectedMessage) : null;
  const unreadCount = messages.filter(m => !m.read).length;
  const formatShort = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const formatLong = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const threadStatusLabel = (msg: (typeof messages)[0]) => {
    if (msg.closed) return { text: "Finalizado", className: "text-[var(--landing-muted)]" };
    if (msg.initiatedByAdmin) return { text: "Enviado por admin", className: "text-[var(--landing-accent)]" };
    const replies = msg.replies || [];
    if (replies.length === 0) return { text: "Responder", className: "text-[var(--brand-start)]" };
    const lastReply = replies[replies.length - 1];
    return lastReply?.senderType === "admin"
      ? { text: "Respondido", className: "text-[var(--brand-end)]" }
      : { text: "Cliente respondió", className: "text-[var(--landing-accent)]" };
  };
  const detailStatusBadge = (msg: (typeof messages)[number]) => {
    if (msg.closed) {
      return (
        <span className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--landing-muted)]">
          Chat finalizado
        </span>
      );
    }
    const replies = msg.replies || [];
    if (replies.length === 0) {
      return (
        <span className="rounded-full border border-[color-mix(in_oklab,var(--brand-start)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-start)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
          Pendiente de respuesta
        </span>
      );
    }
    const lastReply = replies[replies.length - 1];
    return lastReply?.senderType === "admin" ? (
      <span className="rounded-full border border-[color-mix(in_oklab,var(--brand-end)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
        Respondido
      </span>
    ) : (
      <span className="rounded-full border border-[color-mix(in_oklab,var(--landing-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)]">
        Cliente respondió
      </span>
    );
  };

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
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0b1020)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--foreground)_5%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--landing-surface)_70%,transparent)] px-3 py-3 sm:px-5 sm:py-4">
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {selectedMessage && (
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] md:hidden"
                  aria-label="Volver a la lista"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-[var(--landing-accent)]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">Mensajes (Admin)</h2>
                  {unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] ring-1 ring-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)]">
                      {unreadCount} sin leer
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--landing-muted)]">Chats con clientes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--landing-muted)] transition hover:bg-[var(--landing-surface)] hover:text-[var(--foreground)]"
              aria-label="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
            <div className="h-4 w-40 animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/5" />
            <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/5" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
            <div className={`${selectedMessage ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-[var(--landing-border)] md:w-[min(100%,320px)] md:border-r lg:w-[340px]`}>
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-sm text-[var(--landing-muted)]">No hay mensajes por ahora.</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-3">
                  {messages.map((msg) => {
                    const status = threadStatusLabel(msg);
                    const active = selectedMessage === msg.id;
                    return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessage(msg.id);
                        if (!msg.read) {
                          handleMarkAsRead(msg.id);
                        }
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-[color-mix(in_oklab,var(--landing-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_12%,transparent)]"
                          : msg.read
                            ? "border-transparent bg-[var(--landing-surface)]/40 hover:bg-[var(--landing-surface)]"
                            : "border-transparent bg-[color-mix(in_oklab,var(--landing-accent)_8%,transparent)] hover:bg-[color-mix(in_oklab,var(--landing-accent)_14%,transparent)]"
                      }`}
                    >
                      <div className="flex gap-2">
                        <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${msg.read ? "bg-transparent" : "bg-[var(--landing-accent)]"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">{msg.subject}</p>
                          <p className={`mt-0.5 text-[11px] ${status.className}`}>{status.text}</p>
                          <p className="mt-1 text-[10px] text-[var(--landing-muted)]">{msg.userName || msg.userEmail || "Usuario"}</p>
                          {msg.createdAt && <p className="mt-1 text-[10px] text-[var(--landing-muted)]">{formatShort(msg.createdAt)}</p>}
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`${selectedMessage ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col bg-[color-mix(in_oklab,var(--background)_40%,transparent)]`}>
              {selectedMsg ? (
                <>
                  <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                    <div className="mx-auto max-w-2xl space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--landing-border)]/80 pb-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold leading-tight text-[var(--foreground)]">{selectedMsg.subject}</h3>
                          <p className="mt-1 text-xs text-[var(--landing-muted)]">Iniciado · {formatLong(selectedMsg.createdAt)}</p>
                          <p className="mt-1 text-xs text-[var(--landing-muted)]">{selectedMsg.userName || selectedMsg.userEmail || "Usuario"}</p>
                        </div>
                        {detailStatusBadge(selectedMsg)}
                      </div>

                      <div className="flex justify-start">
                        <div className="max-w-[92%] sm:max-w-[85%]">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--landing-muted)]">Cliente</p>
                          <div className="rounded-2xl rounded-tl-md border border-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] px-4 py-3 text-[var(--foreground)]">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedMsg.message}</p>
                          </div>
                        </div>
                      </div>

                      {selectedMsg.replies && selectedMsg.replies.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--landing-muted)]">Conversación</p>
                          {selectedMsg.replies.map((reply, index) => {
                            const senderName = reply.senderName || (reply.senderType === "admin" ? "Equipo de FitPlan" : "Usuario");
                            const replyDate = reply.createdAt ? new Date(reply.createdAt) : null;
                            const isAdminReply = reply.senderType === "admin";

                            return (
                              <div key={index} className={`flex ${isAdminReply ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[92%] sm:max-w-[85%]`}>
                                  <div
                                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                      isAdminReply
                                        ? "rounded-tr-md border border-[color-mix(in_oklab,var(--brand-end)_25%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_12%,transparent)] text-[var(--foreground)]"
                                        : "rounded-tl-md border border-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)] bg-[color-mix(in_oklab,var(--landing-accent)_10%,transparent)] text-[var(--foreground)]"
                                    }`}
                                  >
                                    <p className="mb-1 text-xs font-semibold text-[var(--foreground)]/90">{senderName}</p>
                                    <p className="whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                  {replyDate && (
                                    <p className={`mt-1 text-[10px] text-[var(--landing-muted)] ${isAdminReply ? "text-right" : "text-left"}`}>
                                      {replyDate.toLocaleDateString("es-AR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedMsg.closed && selectedMsg.closedAt && (
                        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/30 px-4 py-3 text-center">
                          <p className="text-xs text-[var(--landing-muted)]">
                            Chat finalizado el {formatLong(selectedMsg.closedAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_92%,#0a0f18)] px-3 py-3 sm:px-5 sm:py-4">
                    {selectedMsg.closed ? (
                      <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/40 px-4 py-4 text-center">
                        <p className="text-sm font-medium text-[var(--landing-muted)]">Este chat ha sido finalizado</p>
                        <p className="mt-1 text-xs text-[var(--landing-muted)]/85">No se pueden enviar más mensajes</p>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-2xl space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="text-xs font-medium text-[var(--landing-muted)]">
                            {selectedMsg.replied ? "Agregar otra respuesta" : "Responder"}
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedMsg || !confirm("¿Estás seguro de que deseas finalizar este chat? No se podrán enviar más mensajes.")) {
                                return;
                              }

                              try {
                                const response = await adminFetch("/api/admin/closeChat", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    adminUserId,
                                    messageId: selectedMsg.id,
                                  }),
                                });

                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.error || "Error al finalizar chat");
                                }

                                // Recargar mensajes para ver el estado actualizado
                                await loadMessages();
                                onMessagesUpdate();
                              } catch (error) {
                                console.error("Error al finalizar chat:", error);
                                alert(error instanceof Error ? error.message : "Error al finalizar chat");
                              }
                            }}
                            className="w-full rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3 py-2 text-xs text-[var(--foreground)] transition hover:bg-[var(--landing-surface-2)] sm:w-auto"
                          >
                            Finalizar Chat
                          </button>
                        </div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--landing-muted)]/70 focus:border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--landing-accent)_25%,transparent)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleReply(selectedMsg.id)}
                          disabled={replying || !replyText.trim()}
                          className="w-full rounded-xl border border-[color-mix(in_oklab,var(--brand-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-end)_16%,transparent)] py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--brand-end)_24%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {replying ? "Enviando..." : selectedMsg.replied ? "Agregar respuesta" : "Enviar respuesta"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="my-6 flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--landing-surface)] ring-1 ring-[var(--landing-border)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[var(--landing-muted)]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="max-w-xs text-sm text-[var(--landing-muted)]">Seleccioná una conversación para ver el hilo completo.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
