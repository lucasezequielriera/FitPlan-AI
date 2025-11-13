import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Componente Modal para ver mensajes (usuarios)
export default function UserMessagesModal({ 
  isOpen, 
  onClose, 
  userId,
  onMessagesUpdate,
  onSendMessage
}: { 
  isOpen: boolean; 
  onClose: () => void;
  userId: string;
  onMessagesUpdate: () => void;
  onSendMessage: () => void;
}) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    subject: string;
    message: string;
    userName: string | null;
    replied: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
    userRead: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadMessages();
    }
  }, [isOpen, userId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/messages?userId=${userId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await fetch("/api/user/markMessageRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, messageId }),
      });
      // Actualizar el estado local inmediatamente
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, userRead: true } : m));
      // Notificar al Navbar para actualizar el contador
      onMessagesUpdate();
    } catch (error) {
      console.error("Error al marcar como leído:", error);
    }
  };

  if (!isOpen) return null;

  const selectedMsg = selectedMessage ? messages.find(m => m.id === selectedMessage) : null;
  const unreadCount = messages.filter(m => m.replied && !m.userRead).length;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-blue-400"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Mis Mensajes
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onSendMessage}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all"
            >
              Nuevo Mensaje
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Lista de mensajes */}
            <div className="w-1/3 border-r border-white/10 pr-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/60 mb-4">No tienes mensajes</p>
                  <button
                    onClick={onSendMessage}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all"
                  >
                    Enviar tu primer mensaje
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={async () => {
                        setSelectedMessage(msg.id);
                        // Si el mensaje tiene respuestas no leídas, marcarlo como leído
                        if (msg.replied && !msg.userRead) {
                          await handleMarkAsRead(msg.id);
                        }
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMessage === msg.id
                          ? "bg-blue-500/20 border-blue-500/50"
                          : msg.replied && !msg.userRead
                          ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${msg.replied && !msg.userRead ? "text-white" : "text-white/80"}`}>
                            {msg.subject}
                          </p>
                          {msg.replied && (
                            <p className="text-xs text-green-400 mt-1">✓ Respondido</p>
                          )}
                          {msg.createdAt && (
                            <p className="text-xs text-white/40 mt-1">
                              {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                        {msg.replied && !msg.userRead && (
                          <div className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detalle del mensaje */}
            <div className="flex-1 overflow-y-auto">
              {selectedMsg ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{selectedMsg.subject}</h3>
                      {selectedMsg.replied && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          Respondido
                        </span>
                      )}
                    </div>
                    {selectedMsg.createdAt && (
                      <p className="text-sm text-white/60">
                        {new Date(selectedMsg.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-start gap-3">
                      {selectedMsg.userName && (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                          {selectedMsg.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedMsg.userName && (
                            <p className="text-sm font-medium text-white">
                              {selectedMsg.userName.charAt(0).toUpperCase() + selectedMsg.userName.slice(1).toLowerCase()}
                            </p>
                          )}
                        </div>
                        <p className="text-white whitespace-pre-wrap">{selectedMsg.message}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mostrar todas las respuestas (tanto del admin como del usuario) */}
                  {selectedMsg.replies && selectedMsg.replies.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-white/80">Conversación:</h4>
                      {selectedMsg.replies.map((reply, index) => {
                        const senderName = reply.senderName || (reply.senderType === "admin" ? "Equipo de FitPlan" : "Usuario");
                        const senderInitial = senderName.charAt(0).toUpperCase();
                        const replyDate = reply.createdAt ? new Date(reply.createdAt) : null;
                        const isAdminReply = reply.senderType === "admin";
                        
                        return (
                          <div key={index} className={`p-4 rounded-lg border ${
                            isAdminReply 
                              ? "bg-green-500/10 border-green-500/30" 
                              : "bg-blue-500/10 border-blue-500/30"
                          }`}>
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 ${
                                isAdminReply
                                  ? "bg-gradient-to-br from-emerald-500 to-cyan-500"
                                  : "bg-gradient-to-br from-blue-500 to-cyan-500"
                              }`}>
                                {senderInitial}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className={`text-sm font-medium ${isAdminReply ? "text-green-400" : "text-blue-400"}`}>
                                    {senderName}
                                  </p>
                                  {replyDate && (
                                    <span className="text-xs text-white/60">
                                      {replyDate.toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-white/90 whitespace-pre-wrap">{reply.message}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-white/60">Aún no hay respuestas</p>
                    </div>
                  )}

                  {/* Campo para responder */}
                  <div className="space-y-3 mt-4">
                    <label className="block text-sm font-medium text-white/60">
                      Responder
                    </label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <button
                      onClick={async () => {
                        if (!replyText.trim() || !selectedMsg) return;
                        
                        setReplying(true);
                        try {
                          const response = await fetch("/api/user/replyMessage", {
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
                            throw new Error(errorData.error || "Error al responder");
                          }

                          // Recargar mensajes para ver la nueva respuesta
                          await loadMessages();
                          setReplyText("");
                          onMessagesUpdate();
                        } catch (error) {
                          console.error("Error al responder:", error);
                          alert(error instanceof Error ? error.message : "Error al enviar respuesta");
                        } finally {
                          setReplying(false);
                        }
                      }}
                      disabled={replying || !replyText.trim()}
                      className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {replying ? "Enviando..." : "Enviar Respuesta"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white/60">Selecciona un mensaje para ver los detalles</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

