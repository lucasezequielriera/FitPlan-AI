import { useState, useEffect, useRef } from "react";
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
    closed: boolean;
    closedAt: string | null;
    initiatedByAdmin?: boolean;
    replies: Array<{ message: string; senderName: string; senderType: string; createdAt: string | null }>;
    createdAt: string | null;
    lastReplyAt: string | null;
    userRead: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadMessages();
    }
  }, [isOpen, userId]);

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

  // Función para ordenar mensajes: primero no leídos, luego leídos, finalmente finalizados
  const sortMessagesByDate = (msgs: Array<{
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
      const aIsUnread = a.replied && !a.userRead;
      const bIsUnread = b.replied && !b.userRead;
      
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

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/messages?userId=${userId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
      const data = await response.json();
      const sortedMessages = sortMessagesByDate(data.messages || []);
      setMessages(sortedMessages);
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4"
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
        className="bg-gray-900 rounded-xl border border-white/10 p-3 sm:p-4 md:p-6 max-w-4xl w-full h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón atrás en móvil cuando hay mensaje seleccionado */}
            {selectedMessage && (
              <button
                onClick={() => setSelectedMessage(null)}
                className="md:hidden text-white/70 hover:text-white transition-colors mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSendMessage}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs sm:text-sm font-medium transition-all"
            >
              <span className="hidden sm:inline">Nuevo Mensaje</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6">
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
          <div className="flex-1 flex gap-2 sm:gap-4 overflow-hidden min-h-0">
            {/* Lista de mensajes */}
            <div className={`${selectedMessage ? 'hidden md:block' : 'block'} w-full md:w-1/3 lg:w-1/3 border-r border-white/10 pr-2 sm:pr-4 overflow-y-auto flex-shrink-0`}>
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
                      className={`p-2 sm:p-3 rounded-lg border cursor-pointer transition-colors ${
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
                          {(() => {
                            if (msg.closed) {
                              return <p className="text-xs text-gray-400 mt-1">Chat Finalizado</p>;
                            }
                            // Verificar si hay respuestas y si la última es del admin
                            const replies = msg.replies || [];
                            if (replies.length === 0) return null;
                            
                            const lastReply = replies[replies.length - 1];
                            const lastReplyIsAdmin = lastReply?.senderType === "admin";
                            
                            if (lastReplyIsAdmin) {
                              // Si la última respuesta es del admin, verificar si el usuario respondió después
                              // Buscar la última respuesta del usuario
                              let lastUserReplyIndex = -1;
                              for (let i = replies.length - 1; i >= 0; i--) {
                                if (replies[i].senderType === "user") {
                                  lastUserReplyIndex = i;
                                  break;
                                }
                              }
                              
                              // Si no hay respuesta del usuario, o la última respuesta del admin es más reciente que la del usuario
                              if (lastUserReplyIndex === -1) {
                                // El usuario nunca respondió, mostrar "Responder"
                                return <p className="text-xs text-red-400 mt-1">Responder</p>;
                              } else {
                                // Verificar si la última respuesta del admin es más reciente que la última del usuario
                                const lastAdminReplyIndex = replies.length - 1;
                                if (lastAdminReplyIndex > lastUserReplyIndex) {
                                  // El admin respondió después de la última respuesta del usuario
                                  return <p className="text-xs text-blue-400 mt-1">Nuevo mensaje</p>;
                                } else {
                                  // El usuario respondió después de la última respuesta del admin
                                  return <p className="text-xs text-green-400 mt-1">✓ Respondido</p>;
                                }
                              }
                            } else {
                              // La última respuesta es del usuario, mostrar "Respondido"
                              return <p className="text-xs text-green-400 mt-1">✓ Respondido</p>;
                            }
                          })()}
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
            <div className={`${selectedMessage ? 'block' : 'hidden md:block'} flex-1 flex flex-col min-h-0 overflow-hidden`}>
              {selectedMsg ? (
                <>
                  {/* Área de mensajes con scroll */}
                  <div ref={messagesScrollRef} className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <div className="space-y-4 pb-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{selectedMsg.subject}</h3>
                      {(() => {
                        if (selectedMsg.closed) {
                          return (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                              Chat Finalizado
                            </span>
                          );
                        }
                        // Verificar si hay respuestas y si la última es del admin
                        const replies = selectedMsg.replies || [];
                        if (replies.length === 0) return null;
                        
                        const lastReply = replies[replies.length - 1];
                        const lastReplyIsAdmin = lastReply?.senderType === "admin";
                        
                        if (lastReplyIsAdmin) {
                          // Si la última respuesta es del admin, verificar si el usuario respondió después
                          // Buscar la última respuesta del usuario
                          let lastUserReplyIndex = -1;
                          for (let i = replies.length - 1; i >= 0; i--) {
                            if (replies[i].senderType === "user") {
                              lastUserReplyIndex = i;
                              break;
                            }
                          }
                          
                          // Si no hay respuesta del usuario, o la última respuesta del admin es más reciente que la del usuario
                          if (lastUserReplyIndex === -1) {
                            // El usuario nunca respondió, mostrar "Responder"
                            return (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                Responder
                              </span>
                            );
                          } else {
                            // Verificar si la última respuesta del admin es más reciente que la última del usuario
                            const lastAdminReplyIndex = replies.length - 1;
                            if (lastAdminReplyIndex > lastUserReplyIndex) {
                              // El admin respondió después de la última respuesta del usuario
                              return (
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  Mensaje nuevo
                                </span>
                              );
                            } else {
                              // El usuario respondió después de la última respuesta del admin
                              return (
                                <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                  Respondido
                                </span>
                              );
                            }
                          }
                        } else {
                          // La última respuesta es del usuario, mostrar "Respondido"
                          return (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                              Respondido
                            </span>
                          );
                        }
                      })()}
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

                  {/* Mensaje de finalización */}
                  {selectedMsg.closed && selectedMsg.closedAt && (
                    <div className="mt-4 p-3 rounded-lg bg-gray-500/10 border border-gray-500/30 text-center">
                      <p className="text-xs text-gray-400">
                        Chat finalizado el {new Date(selectedMsg.closedAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}

                    </div>
                  </div>

                  {/* Área de respuesta fija (footer) */}
                  <div className="border-t border-white/10 pt-4 mt-4 flex-shrink-0 bg-gray-900">
                    {selectedMsg.closed ? (
                      <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/30 text-center">
                        <p className="text-gray-400 text-sm">Este chat ha sido finalizado</p>
                        <p className="text-gray-500 text-xs mt-1">No se pueden enviar más mensajes</p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        <label className="block text-xs sm:text-sm font-medium text-white/60">
                          Responder
                        </label>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          rows={3}
                          className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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

                              // Actualizar el mensaje localmente primero para feedback inmediato
                              setMessages(prev => {
                                const updated = prev.map(m => 
                                  m.id === selectedMsg.id 
                                    ? { 
                                        ...m, 
                                        replies: [...(m.replies || []), {
                                          message: replyText.trim(),
                                          senderName: selectedMsg.userName || "Usuario",
                                          senderType: "user",
                                          createdAt: new Date().toISOString(),
                                        }],
                                        lastReplyAt: new Date().toISOString(),
                                        replied: true,
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
                              alert(error instanceof Error ? error.message : "Error al enviar respuesta");
                            } finally {
                              setReplying(false);
                            }
                          }}
                          disabled={replying || !replyText.trim()}
                          className="w-full px-4 py-2.5 sm:py-2 text-sm sm:text-base rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {replying ? "Enviando..." : "Enviar Respuesta"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
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

