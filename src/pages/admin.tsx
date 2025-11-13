import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import Navbar from "@/components/Navbar";

interface User {
  id: string;
  email: string | null;
  nombre: string | null;
  premium: boolean;
  premiumStatus: string | null;
  premiumSince: unknown;
  premiumLastPay: unknown;
  premiumExpiresAt?: Date | string | { toDate?: () => Date; seconds?: number } | null;
  premiumPlanType?: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  sexo: string | null;
  alturaCm: number | null;
  edad: number | null;
  peso: number | null;
  pesoObjetivo: number | null;
  cinturaCm: number | null;
  cuelloCm: number | null;
  caderaCm: number | null;
  atletico: boolean;
  premiumPayment: unknown;
}

export default function Admin() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [tooltipOpenUserId, setTooltipOpenUserId] = useState<string | null>(null);
  
  // Cerrar tooltip al hacer click fuera (solo en mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (tooltipOpenUserId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.relative')) {
          setTooltipOpenUserId(null);
        }
      }
    };
    
    if (tooltipOpenUserId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [tooltipOpenUserId]);
  const [deleting, setDeleting] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [premiumUsers, setPremiumUsers] = useState<number>(0);
  const [regularUsers, setRegularUsers] = useState<number>(0);
  const [athleticUsers, setAthleticUsers] = useState<number>(0);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<{
    user: unknown;
    plans: unknown[];
    history: unknown[];
    weightRecords?: Array<{ fecha: string; peso: number; planId: string; planCreatedAt?: string }>;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [adminMeta, setAdminMeta] = useState<{ lastUsersCheck?: string | null }>({});
  const [newUsersList, setNewUsersList] = useState<Array<{ id: string; nombre: string | null; email: string | null; createdAt?: string | null }>>([]);
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
  const [markingNewUsersSeen, setMarkingNewUsersSeen] = useState(false);
  
  // Estadísticas de ganancias
  const [revenueStats, setRevenueStats] = useState({
    estimatedMonthly: 0,
    premiumActiveThisMonth: 0,
    pendingPayments: 0,
    estimatedAnnual: 0,
    renewingSoon: 0,
    totalPremiumUsers: 0,
  });

  // Función para convertir timestamp a Date
  const convertTimestampToDate = (ts: unknown): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts === 'string') return new Date(ts);
    if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate();
    }
    if (typeof ts === 'object' && 'seconds' in ts) {
      const seconds = (ts as { seconds: number; nanoseconds?: number }).seconds;
      return new Date(seconds * 1000);
    }
    return null;
  };

  // Función para determinar estado de pago basado en premiumExpiresAt
  const getPaymentStatus = (user: User): { 
    status: "paid" | "expiring" | "expired" | "unpaid"; 
    label: string; 
    color: string;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
  } => {
    // Solo verificar estado de pago para usuarios premium
    if (!user.premium) {
      return { 
        status: "unpaid", 
        label: "Regular", 
        color: "gray",
        expiresAt: null,
        daysUntilExpiry: null
      };
    }

    const now = new Date();
    let expiresAt: Date | null = null;

    // Intentar obtener la fecha de vencimiento
    if (user.premiumExpiresAt) {
      expiresAt = convertTimestampToDate(user.premiumExpiresAt);
    }

    // Si no hay fecha de vencimiento, calcular basado en premiumLastPay y planType (fallback)
    if (!expiresAt && user.premiumLastPay) {
      const lastPayDate = convertTimestampToDate(user.premiumLastPay);
      if (lastPayDate) {
        expiresAt = new Date(lastPayDate);
        const planType = user.premiumPlanType || "monthly";
        switch (planType) {
          case "monthly":
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            break;
          case "quarterly":
            expiresAt.setMonth(expiresAt.getMonth() + 3);
            break;
          case "annual":
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            break;
        }
      }
    }

    if (!expiresAt) {
      // Si no hay fecha de vencimiento, considerar como sin pagar
      return { 
        status: "unpaid", 
        label: "Sin Fecha", 
        color: "red",
        expiresAt: null,
        daysUntilExpiry: null
      };
    }

    const diffTime = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Si ya venció
    if (daysUntilExpiry < 0) {
      return { 
        status: "expired", 
        label: "Vencido", 
        color: "red",
        expiresAt,
        daysUntilExpiry
      };
    }

    // Si vence en los próximos 7 días
    if (daysUntilExpiry <= 7) {
      return { 
        status: "expiring", 
        label: "Por Vencer", 
        color: "yellow",
        expiresAt,
        daysUntilExpiry
      };
    }

    // Si está vigente
    return { 
      status: "paid", 
      label: "Pagado", 
      color: "green",
      expiresAt,
      daysUntilExpiry
    };
  };

  // Función para calcular estadísticas de ganancias
  const calculateRevenueStats = () => {
    const PRICE_PER_MONTH = 25000; // ARS
    const premiumUsersList = users.filter(u => u.premium && u.email?.toLowerCase() !== "admin@fitplan-ai.com");
    
    // Usuarios que pagaron este mes
    const paidThisMonth = premiumUsersList.filter(user => {
      const status = getPaymentStatus(user);
      return status.status === "paid" || status.status === "expiring";
    });
    const premiumActiveThisMonth = paidThisMonth.length;
    
    // Usuarios premium que no han pagado este mes
    const pendingPayments = premiumUsersList.length - premiumActiveThisMonth;
    
    const estimatedMonthly = premiumActiveThisMonth * PRICE_PER_MONTH;
    const estimatedAnnual = estimatedMonthly * 12;
    
    // Usuarios premium cuya renovación ocurrirá en los próximos 7 días
    const renewingSoon = premiumUsersList.filter(user => {
      const status = getPaymentStatus(user);
      if (status.status !== "paid") return false;
      const lastPayISO = convertTimestampToISO(user.premiumLastPay);
      if (!lastPayISO) return false;
      const lastPayDate = new Date(lastPayISO);
      if (isNaN(lastPayDate.getTime())) return false;
      const now = new Date();
      const diffDays = (now.getTime() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysUntilRenewal = 30 - diffDays;
      return daysUntilRenewal > 0 && daysUntilRenewal <= 7;
    }).length;
    
    setRevenueStats({
      estimatedMonthly,
      premiumActiveThisMonth,
      pendingPayments,
      estimatedAnnual,
      renewingSoon,
      totalPremiumUsers: premiumUsersList.length,
    });
  };

  const convertTimestampToISO = (value: unknown): string | null => {
    if (!value) return null;
    try {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "string") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      if (typeof value === "number") {
        return new Date(value).toISOString();
      }
      if (typeof value === "object") {
        if (value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
          const date = (value as { toDate: () => Date }).toDate();
          return date.toISOString();
        }
        if (value && "seconds" in value && typeof (value as { seconds: number }).seconds === "number") {
          const { seconds, nanoseconds = 0 } = value as { seconds: number; nanoseconds?: number };
          return new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
        }
      }
    } catch (error) {
      console.error("Error al convertir timestamp a ISO:", error, value);
    }
    return null;
  };

  const formatDateTimeWithHour = (iso?: string | null) => {
    if (!iso) return "N/A";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (users.length > 0) {
      calculateRevenueStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Verificar si el usuario es administrador
  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!authUser) {
        router.push("/");
        return;
      }

      try {
        const auth = getAuthSafe();
        if (!auth?.currentUser) {
          setError("No se pudo acceder a la autenticación");
          setLoading(false);
          return;
        }

        let lastUsersCheckISO: string | null = null;

        // Primero verificar el email de Firebase Auth (disponible inmediatamente)
        const authEmail = auth.currentUser.email?.toLowerCase() || "";
        const isAuthAdmin = authEmail === "admin@fitplan-ai.com";

        // Obtener la base de datos y el documento del usuario
        const db = getDbSafe();
        if (!db) {
          setError("No se pudo acceder a la base de datos");
          setLoading(false);
          return;
        }

        const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        // Verificar y crear/actualizar documento del admin si es necesario
        if (isAuthAdmin) {
          if (!userDoc.exists()) {
            const nowISO = new Date().toISOString();
            try {
              await setDoc(userRef, {
                email: auth.currentUser.email || "admin@fitplan-ai.com",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastUsersCheck: serverTimestamp(),
              });
              console.log("✅ Documento de administrador creado");
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (createError) {
              console.error("Error al crear documento de administrador:", createError);
            }
            lastUsersCheckISO = nowISO;
          } else {
            const userData = userDoc.data();
            const needsUpdate = !userData.email || userData.email.toLowerCase() !== "admin@fitplan-ai.com";
            
            if (needsUpdate) {
              try {
                await updateDoc(userRef, {
                  email: auth.currentUser.email || "admin@fitplan-ai.com",
                  updatedAt: serverTimestamp(),
                });
                console.log("✅ Documento de administrador actualizado");
                await new Promise(resolve => setTimeout(resolve, 1500));
              } catch (updateError) {
                console.error("Error al actualizar documento de administrador:", updateError);
              }
            }

            lastUsersCheckISO = convertTimestampToISO(userData.lastUsersCheck);
            if (!lastUsersCheckISO) {
              const nowISO = new Date().toISOString();
              try {
                await updateDoc(userRef, {
                  lastUsersCheck: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                lastUsersCheckISO = nowISO;
              } catch (updateError) {
                console.error("Error al inicializar lastUsersCheck:", updateError);
              }
            }
          }

          setAdminMeta({ lastUsersCheck: lastUsersCheckISO });
          setIsAdmin(true);
          await loadUserStats(lastUsersCheckISO);
          return;
        }

        // Si no es admin por email de Auth, verificar en el documento
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email?.toLowerCase() || "";
          const isAdminUser = email === "admin@fitplan-ai.com";
          
          if (isAdminUser) {
            lastUsersCheckISO = convertTimestampToISO(userData.lastUsersCheck);
            if (!lastUsersCheckISO) {
              const nowISO = new Date().toISOString();
              try {
                await updateDoc(userRef, {
                  lastUsersCheck: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                lastUsersCheckISO = nowISO;
              } catch (updateError) {
                console.error("Error al actualizar lastUsersCheck para admin:", updateError);
              }
            }

            setAdminMeta({ lastUsersCheck: lastUsersCheckISO });
            setIsAdmin(true);
            await loadUserStats(lastUsersCheckISO);
          } else {
            setError("Acceso denegado. Solo administradores pueden acceder.");
            setLoading(false);
          }
        } else {
          setError("Usuario no encontrado en la base de datos.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error al verificar admin:", err);
        setError("Error al verificar permisos de administrador");
        setLoading(false);
      }
    };

    checkAdmin();
    // loadUserStats se maneja manualmente para evitar bucles de recarga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading, router]);

  // Actualización automática de usuarios - usando polling cada 10 segundos
  useEffect(() => {
    if (!isAdmin || !authUser) return;

    // Actualización automática silenciosa cada 60 segundos (sin mostrar loading)
    // Esto permite detectar nuevos usuarios sin interrumpir la experiencia
    // Menos frecuente para reducir re-renders innecesarios
    const pollInterval = setInterval(async () => {
      try {
        await loadUserStats(adminMeta.lastUsersCheck ?? null, true); // silent = true para no mostrar loading
      } catch {
        // Silenciar errores en polling
      }
    }, 60000); // Actualizar cada 60 segundos (menos frecuente para reducir re-renders)

    return () => {
      clearInterval(pollInterval);
    };
    // loadUserStats se maneja manualmente para evitar bucles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authUser, adminMeta.lastUsersCheck]);


  const loadUserStats = async (lastUsersCheck?: string | null, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const auth = getAuthSafe();
      
      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      // Llamar al endpoint API para obtener estadísticas
      const response = await fetch(`/api/admin/stats?userId=${auth.currentUser.uid}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("❌ Error del API:", errorData);
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Mostrar toda la información en console.log
      console.log("📊 ESTADÍSTICAS DE USUARIOS:", data.stats);
      console.log("👥 LISTA COMPLETA DE USUARIOS:", data.users);
      console.log("📈 Total de usuarios:", data.stats?.total);
      console.log("⭐ Usuarios premium:", data.stats?.premium);
      console.log("👤 Usuarios regulares:", data.stats?.regular);
      console.log("💪 Usuarios atléticos:", data.stats?.athletic);
      
      // Actualizar los contadores
      if (data.stats) {
        setTotalUsers(data.stats.total || 0);
        setPremiumUsers(data.stats.premium || 0);
        setRegularUsers(data.stats.regular || 0);
        setAthleticUsers(data.stats.athletic || 0);
      }

      // Guardar los usuarios para mostrarlos en la tabla
      if (data.users && Array.isArray(data.users)) {
        // Función auxiliar para obtener timestamp numérico para ordenar
        const getTimestamp = (timestamp: unknown): number => {
          if (!timestamp) return 0;
          
          try {
            if (timestamp instanceof Date) {
              return timestamp.getTime();
            } else if (typeof timestamp === 'string') {
              return new Date(timestamp).getTime();
            } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
              return (timestamp as { toDate: () => Date }).toDate().getTime();
            } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
              const ts = timestamp as { seconds: number; nanoseconds?: number };
              return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
            }
          } catch (error) {
            console.error("Error al obtener timestamp:", error);
          }
          
          return 0;
        };
        
        // Ordenar usuarios por fecha de creación (más reciente primero)
        const sortedUsers = [...data.users].sort((a, b) => {
          const aTime = getTimestamp(a.createdAt);
          const bTime = getTimestamp(b.createdAt);
          return bTime - aTime; // Orden descendente (más reciente primero)
        });

        // Calcular usuarios nuevos desde la última revisión
        const effectiveLastUsersCheckISO = lastUsersCheck ?? adminMeta.lastUsersCheck ?? null;
        let extractedNewUsers: Array<{ id: string; nombre: string | null; email: string | null; createdAt?: string | null }> = [];
        if (effectiveLastUsersCheckISO) {
          const lastCheckDate = new Date(effectiveLastUsersCheckISO);
          if (!isNaN(lastCheckDate.getTime())) {
            const lastCheckTime = lastCheckDate.getTime();
            extractedNewUsers = sortedUsers
              .filter((user: Record<string, unknown>) => {
                const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
                if (email === "admin@fitplan-ai.com") return false;
                const createdAtTime = getTimestamp(user.createdAt);
                return createdAtTime > lastCheckTime;
              })
              .map((user: Record<string, unknown>) => ({
                id: String(user.id || ""),
                nombre: (user.nombre as string | null) || null,
                email: (user.email as string | null) || null,
                createdAt: convertTimestampToISO(user.createdAt),
              }))
              .filter(user => !!user.id);
          }
        }
        
        setNewUsersList(extractedNewUsers);
        setNewUserIds(extractedNewUsers.map(user => user.id));
        
        setUsers(sortedUsers);
        console.log(`✅ ${sortedUsers.length} usuarios cargados y ordenados por fecha de creación`);
        
        // Verificar y desactivar premium vencido para todos los usuarios premium
        const premiumUsers = sortedUsers.filter(u => u.premium);
        for (const user of premiumUsers) {
          const status = getPaymentStatus(user);
          if (status.status === "expired") {
            // Desactivar premium vencido automáticamente
            try {
              const expireResponse = await fetch("/api/admin/expirePremium", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
              });
              if (expireResponse.ok) {
                const expireData = await expireResponse.json();
                if (expireData.expired) {
                  console.log(`✅ Premium desactivado automáticamente para ${user.email}`);
                  // Actualizar el usuario en el estado local
                  setUsers(prevUsers => 
                    prevUsers.map(u => 
                      u.id === user.id 
                        ? { ...u, premium: false, premiumStatus: "expired" }
                        : u
                    )
                  );
                }
              }
            } catch (error) {
              console.error(`Error al desactivar premium para ${user.email}:`, error);
            }
          }
        }
      } else {
        setUsers([]);
        setNewUsersList([]);
        setNewUserIds([]);
      }

      if (!silent) {
        setLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setLoading(false);
      console.error("❌ Error al cargar estadísticas:", err);
      
      // Si el error es sobre Firebase Admin SDK no configurado, mostrar mensaje más útil
      if (message.includes("Firebase Admin SDK no configurado") || message.includes("500")) {
        setError("Firebase Admin SDK no está configurado en el servidor. Configura las variables de entorno en Vercel: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, y NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
      }
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      nombre: user.nombre || "",
      email: user.email || "",
      premium: user.premium,
      sexo: user.sexo || "",
      alturaCm: user.alturaCm ?? null,
      edad: user.edad ?? null,
      peso: user.peso ?? null,
      pesoObjetivo: user.pesoObjetivo ?? null,
      cinturaCm: user.cinturaCm ?? null,
      cuelloCm: user.cuelloCm ?? null,
      caderaCm: user.caderaCm ?? null,
      atletico: user.atletico,
    });
  };

  const handleDelete = async () => {
    if (!editingUser) return;

    // Confirmación antes de eliminar
    const confirmMessage = `¿Estás seguro de que deseas eliminar el usuario "${editingUser.nombre || editingUser.email || editingUser.id}"?\n\nEsta acción eliminará:\n- El usuario de la autenticación\n- El perfil del usuario\n- Todos los planes asociados\n\nEsta acción NO se puede deshacer.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        throw new Error("No hay usuario autenticado");
      }

      console.log("🗑️ Eliminando usuario...");
      
      // Llamar al endpoint API para eliminar usuario
      const response = await fetch("/api/admin/deleteUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
          userId: editingUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Usuario eliminado exitosamente:", result);

      // Remover el usuario de la lista local
      setUsers(prevUsers => prevUsers.filter(user => user.id !== editingUser.id));

      // Recargar estadísticas para actualizar los contadores
      await loadUserStats(adminMeta.lastUsersCheck ?? null);
      
      // Cerrar el modal
      setEditingUser(null);
      setEditForm({});
      
      alert("Usuario eliminado correctamente");
    } catch (err: unknown) {
      console.error("❌ Error al eliminar usuario:", err);
      const error = err as { message?: string };
      alert(`Error al eliminar usuario: ${error.message || "Error desconocido"}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        throw new Error("No hay usuario autenticado");
      }

      // Construir objeto de actualización
      const updateData: Record<string, unknown> = {};

      // Solo actualizar campos que se proporcionan
      if (editForm.nombre !== undefined) updateData.nombre = editForm.nombre;
      if (editForm.email !== undefined) updateData.email = editForm.email;
      if (editForm.premium !== undefined) {
        updateData.premium = Boolean(editForm.premium);
        updateData.premiumStatus = editForm.premium ? "active" : "inactive";
        if (editForm.premium) {
          updateData.premiumSince = new Date().toISOString();
        }
      }
      if (editForm.sexo !== undefined) updateData.sexo = editForm.sexo;
      if (editForm.alturaCm !== undefined) updateData.alturaCm = editForm.alturaCm ? Number(editForm.alturaCm) : null;
      if (editForm.edad !== undefined) updateData.edad = editForm.edad ? Number(editForm.edad) : null;
      if (editForm.peso !== undefined) updateData.peso = editForm.peso ? Number(editForm.peso) : null;
      if (editForm.pesoObjetivo !== undefined) updateData.pesoObjetivo = editForm.pesoObjetivo ? Number(editForm.pesoObjetivo) : null;
      if (editForm.cinturaCm !== undefined) updateData.cinturaCm = editForm.cinturaCm ? Number(editForm.cinturaCm) : null;
      if (editForm.cuelloCm !== undefined) updateData.cuelloCm = editForm.cuelloCm ? Number(editForm.cuelloCm) : null;
      if (editForm.caderaCm !== undefined) updateData.caderaCm = editForm.caderaCm ? Number(editForm.caderaCm) : null;
      if (editForm.atletico !== undefined) updateData.atletico = Boolean(editForm.atletico);

      console.log("💾 Enviando cambios al API...");
      
      // Usar el endpoint API que tiene permisos de Admin SDK
      const response = await fetch("/api/admin/updateUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid, // ID del admin que hace la solicitud
          userId: editingUser.id, // ID del usuario a actualizar
          updateData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Cambios guardados exitosamente:", result);

      // Actualizar el usuario en la lista local sin recargar todo
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { ...user, ...updateData }
            : user
        )
      );

      // Recargar estadísticas para actualizar los contadores
      await loadUserStats(adminMeta.lastUsersCheck ?? null);
      
      setEditingUser(null);
      setEditForm({});
    } catch (err: unknown) {
      console.error("❌ Error al guardar:", err);
      const error = err as { message?: string };
      alert(`Error al guardar cambios: ${error.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) {
      console.log("⚠️ formatDate recibió timestamp vacío/null/undefined");
      return "N/A";
    }
    
    // Intentar convertir el timestamp a fecha
    let date: Date | null = null;
    
    try {
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Manejar string ISO (viene del servidor después de convertTimestamp)
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          console.log("⚠️ No se pudo parsear string de fecha:", timestamp);
          return "N/A";
        }
      } else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = (timestamp as { toDate: () => Date }).toDate();
      } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        // Firestore timestamp con formato { seconds: number, nanoseconds: number }
        const firestoreTimestamp = timestamp as { seconds: number; nanoseconds?: number };
        date = new Date(firestoreTimestamp.seconds * 1000 + (firestoreTimestamp.nanoseconds || 0) / 1000000);
      } else {
        console.log("⚠️ formatDate no pudo convertir timestamp desconocido:", timestamp);
        return "N/A";
      }
      
      if (date && !isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (error) {
      console.error("❌ Error al formatear fecha:", error, "timestamp:", timestamp);
    }
    
    return "N/A";
  };

  const handleMarkNewUsersSeen = async () => {
    try {
      const auth = getAuthSafe();
      if (!auth?.currentUser) {
        return;
      }
      setMarkingNewUsersSeen(true);
      const response = await fetch("/api/admin/markUsersSeen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUserId: auth.currentUser.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const updatedLastCheck = result.lastUsersCheck || new Date().toISOString();
      setAdminMeta(prev => ({ ...prev, lastUsersCheck: updatedLastCheck }));
      setNewUsersList([]);
      setNewUserIds([]);
      await loadUserStats(updatedLastCheck);
    } catch (error) {
      console.error("❌ Error al marcar usuarios como revisados:", error);
      alert("No se pudieron marcar los usuarios como revisados. Intenta nuevamente.");
    } finally {
      setMarkingNewUsersSeen(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-white/60">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center p-8 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-400 text-lg">{error || "Acceso denegado"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Panel de Administración
          </h1>
          <p className="text-white/60">Gestiona usuarios y permisos del sistema</p>
        </motion.div>

        {newUsersList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/20 to-emerald-500/10 backdrop-blur-sm"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span role="img" aria-label="confeti">🎉</span>
                  {newUsersList.length === 1
                    ? "Nuevo usuario desde tu última revisión"
                    : `${newUsersList.length} usuarios nuevos desde tu última revisión`}
                </h2>
                <p className="text-white/70 text-sm mt-1">
                  Última revisión registrada: {formatDateTimeWithHour(adminMeta.lastUsersCheck)}
                </p>
              </div>
              <button
                onClick={handleMarkNewUsersSeen}
                disabled={markingNewUsersSeen}
                className="px-4 py-2 rounded-lg bg-green-500/30 hover:bg-green-500/40 border border-green-500/40 text-green-200 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {markingNewUsersSeen ? "Guardando..." : "Marcar como revisado"}
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {newUsersList.slice(0, 5).map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90"
                >
                  <div>
                    <p className="font-medium text-white">{user.nombre || user.email || user.id}</p>
                    <p className="text-white/60 text-xs">
                      {user.email || "Sin email registrado"}
                    </p>
                  </div>
                  <span className="text-white/60 text-xs">
                    {user.createdAt ? formatDateTimeWithHour(user.createdAt) : "Sin fecha"}
                  </span>
                </li>
              ))}
              {newUsersList.length > 5 && (
                <li className="text-white/60 text-xs text-center">
                  ... y {newUsersList.length - 5} usuarios más
                </li>
              )}
            </ul>
          </motion.div>
        )}

        {/* Panel de Estadísticas de Ganancias */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2 p-6 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 backdrop-blur-sm"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.95s4.18 1.08 4.18 3.67c-.01 1.83-1.38 2.83-3.12 3.16z"/>
              </svg>
              Estadísticas de Ganancias
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-white/60 text-xs mb-1">Ganancia Mensual Estimada</p>
                <p className="text-2xl font-bold text-yellow-400">
                  ${revenueStats.estimatedMonthly.toLocaleString('es-AR')}
                </p>
                <p className="text-white/40 text-xs mt-1">ARS</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Premium Activos (Este Mes)</p>
                <p className="text-2xl font-bold text-green-400">
                  {revenueStats.premiumActiveThisMonth}
                </p>
                <p className="text-white/40 text-xs mt-1">usuarios</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Pendientes de Pago</p>
                <p className="text-2xl font-bold text-orange-400">
                  {revenueStats.pendingPayments}
                </p>
                <p className="text-white/40 text-xs mt-1">${(revenueStats.pendingPayments * 25000).toLocaleString('es-AR')} ARS</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Renovando Pronto</p>
                <p className="text-2xl font-bold text-blue-400">
                  {revenueStats.renewingSoon}
                </p>
                <p className="text-white/40 text-xs mt-1">próximos 7 días</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Proyección Anual</p>
                  <p className="text-xl font-bold text-cyan-400">
                    ${revenueStats.estimatedAnnual.toLocaleString('es-AR')} ARS
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-sm">Potencial Mensual</p>
                  <p className="text-xl font-bold text-green-400">
                    ${(revenueStats.totalPremiumUsers * 25000).toLocaleString('es-AR')} ARS
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    Si todos los premium pagaran este mes
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const pendingUsers = users.filter(u => {
                    // Excluir al admin
                    if (u.email?.toLowerCase() === "admin@fitplan-ai.com") return false;
                    const status = getPaymentStatus(u);
                    return status.status === "unpaid" && u.premium;
                  });
                  alert(`${pendingUsers.length} usuarios premium están sin pagar este mes. Total a recuperar: $${(pendingUsers.length * 25000).toLocaleString('es-AR')} ARS`);
                }}
                className="w-full px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors text-sm"
              >
                Ver Pendientes
              </button>
              <button
                onClick={() => {
                  alert(`${revenueStats.renewingSoon} usuarios renovarán en los próximos 7 días. Total esperado: $${(revenueStats.renewingSoon * 25000).toLocaleString('es-AR')} ARS`);
                }}
                className="w-full px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors text-sm"
              >
                Renovaciones Próximas
              </button>
              <div className="pt-3 border-t border-white/10">
                <p className="text-white/60 text-xs mb-2">Precio mensual actual</p>
                <p className="text-lg font-bold text-white">$25,000 ARS</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Total Usuarios</p>
            <p className="text-2xl font-bold text-blue-400">{totalUsers}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Usuarios Premium</p>
            <p className="text-2xl font-bold text-yellow-400">
              {premiumUsers}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Usuarios Regulares</p>
            <p className="text-2xl font-bold text-cyan-400">
              {regularUsers}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Atléticos</p>
            <p className="text-2xl font-bold text-green-400">
              {athleticUsers}
            </p>
          </motion.div>
        </div>

        {/* Lista de usuarios */}
        <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Estado de Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Edad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Peso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-white/60 text-sm">
                          La carga de usuarios está deshabilitada temporalmente
                        </p>
                        <p className="text-white/40 text-xs">
                          Esta funcionalidad se habilitará próximamente
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => {
                    const paymentStatus = getPaymentStatus(user);
                    const isNewUser = newUserIds.includes(user.id);
                    return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`hover:bg-white/5 transition-colors border-l-4 group ${isNewUser ? "bg-green-500/10 border-green-400/70" : "border-transparent"}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        <div className="flex items-center gap-2">
                          <span>{user.nombre || "N/A"}</span>
                          {isNewUser && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-green-500/30 text-green-100 border border-green-500/40">
                              Nuevo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{user.email || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Admin
                          </span>
                        ) : user.premium ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Premium
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.email?.toLowerCase() === "admin@fitplan-ai.com" ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            N/A
                          </span>
                        ) : user.premium ? (
                          <div className="relative">
                            <span 
                              onClick={() => {
                                if (tooltipOpenUserId === user.id) {
                                  setTooltipOpenUserId(null);
                                } else {
                                  setTooltipOpenUserId(user.id);
                                }
                              }}
                              className={`px-2 py-1 text-xs rounded-full border cursor-pointer touch-manipulation ${
                                paymentStatus.status === "paid" 
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : paymentStatus.status === "expiring"
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}
                            >
                              {paymentStatus.label}
                            </span>
                            {/* Tooltip con información de vencimiento */}
                            {paymentStatus.expiresAt && (
                              <div 
                                className={`absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/20 bg-black/95 px-3 py-2 text-xs text-white shadow-xl transition-opacity duration-200 ${
                                  // Mostrar en desktop con hover, en mobile con click
                                  tooltipOpenUserId === user.id 
                                    ? "opacity-100 pointer-events-auto md:pointer-events-none" 
                                    : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-focus:opacity-100"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  <p className="font-semibold text-white">
                                    {paymentStatus.status === "expired" 
                                      ? "⚠️ Plan Vencido"
                                      : paymentStatus.status === "expiring"
                                      ? "⏰ Por Vencer"
                                      : "✅ Plan Activo"}
                                  </p>
                                  <p className="text-white/80">
                                    <span className="font-medium">Vencimiento:</span>{" "}
                                    {paymentStatus.expiresAt.toLocaleDateString('es-AR', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  {paymentStatus.daysUntilExpiry !== null && (
                                    <p className="text-white/80">
                                      <span className="font-medium">
                                        {paymentStatus.daysUntilExpiry < 0 
                                          ? "Vencido hace:" 
                                          : "Días restantes:"}
                                      </span>{" "}
                                      {Math.abs(paymentStatus.daysUntilExpiry)} día{Math.abs(paymentStatus.daysUntilExpiry) !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                  {(() => {
                                    // Extraer monto del último pago
                                    const payment = user.premiumPayment;
                                    let amount: number | null = null;
                                    
                                    if (payment && typeof payment === 'object') {
                                      const paymentObj = payment as Record<string, unknown>;
                                      
                                      // Intentar diferentes formas de acceder al amount
                                      if (typeof paymentObj.amount === 'number') {
                                        amount = paymentObj.amount;
                                      } else if (typeof paymentObj.amount === 'string') {
                                        amount = parseFloat(paymentObj.amount);
                                      } else if (paymentObj.transaction_amount && typeof paymentObj.transaction_amount === 'number') {
                                        amount = paymentObj.transaction_amount;
                                      }
                                      
                                      // Debug solo si no encontramos el amount
                                      if (amount === null) {
                                        console.log('🔍 Debug premiumPayment para', user.email, ':', paymentObj);
                                      }
                                    }
                                    
                                    return amount !== null && !isNaN(amount) && amount > 0 ? (
                                      <p className="text-white/80">
                                        <span className="font-medium">Último pago:</span>{" "}
                                        ${amount.toLocaleString('es-AR')} ARS
                                      </p>
                                    ) : null;
                                  })()}
                                  {user.premiumPlanType && (
                                    <p className="text-white/60 text-[10px] mt-1 pt-1 border-t border-white/10">
                                      Plan: {user.premiumPlanType === "monthly" ? "Mensual" : user.premiumPlanType === "quarterly" ? "Trimestral" : "Anual"}
                                    </p>
                                  )}
                                </div>
                                {/* Flecha del tooltip */}
                                <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1">
                                  <div className="h-2 w-2 rotate-45 border-r border-b border-white/20 bg-black/95"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{user.edad || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                        {user.peso ? `${user.peso} kg` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors"
                          >
                            Editar
                          </button>
                          {user.email?.toLowerCase() !== "admin@fitplan-ai.com" && (
                            <button
                              onClick={async () => {
                                setSelectedUserForHistory(user);
                                setHistoryModalOpen(true);
                                setLoadingHistory(true);
                                try {
                                  const response = await fetch(`/api/admin/userHistory?userId=${user.id}&adminUserId=${authUser?.uid}`);
                                  if (!response.ok) throw new Error("Error al cargar historial");
                                  const data = await response.json();
                                  setUserHistory(data);
                                } catch (error) {
                                  console.error("Error al cargar historial:", error);
                                  setUserHistory(null);
                                } finally {
                                  setLoadingHistory(false);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors"
                            >
                              Historial
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de edición */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Editar Usuario: {editingUser.nombre || editingUser.id}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={editForm.nombre || ""}
                    onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Sexo</label>
                  <select
                    value={editForm.sexo || ""}
                    onChange={(e) => setEditForm({ ...editForm, sexo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Edad</label>
                  <input
                    type="number"
                    value={editForm.edad ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, edad: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Altura (cm)</label>
                  <input
                    type="number"
                    value={editForm.alturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, alturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.peso ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, peso: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Peso Objetivo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.pesoObjetivo ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, pesoObjetivo: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Premium</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.premium || false}
                      onChange={(e) => setEditForm({ ...editForm, premium: e.target.checked })}
                      className="w-4 h-4 rounded bg-white/5 border border-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-white">Activar Premium</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Perfil Atlético</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.atletico || false}
                      onChange={(e) => setEditForm({ ...editForm, atletico: e.target.checked })}
                      className="w-4 h-4 rounded bg-white/5 border border-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-white">Activar</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cintura (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cinturaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cinturaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cuello (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.cuelloCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cuelloCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cadera (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.caderaCm ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, caderaCm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving || deleting}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving || deleting || editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com"}
                  className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={editingUser?.email?.toLowerCase() === "admin@fitplan-ai.com" ? "No se puede eliminar al administrador" : "Eliminar usuario"}
                >
                  {deleting ? "Eliminando..." : "Eliminar Usuario"}
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setEditForm({});
                  }}
                  disabled={saving || deleting}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Historial Mensual */}
        {historyModalOpen && selectedUserForHistory && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 rounded-xl border border-white/10 p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Historial Mensual: {selectedUserForHistory.nombre || selectedUserForHistory.email}
                  </h2>
                  <p className="text-white/60 text-sm mt-1">{selectedUserForHistory.email}</p>
                </div>
                <button
                  onClick={() => {
                    setHistoryModalOpen(false);
                    setSelectedUserForHistory(null);
                    setUserHistory(null);
                  }}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : userHistory ? (
                <div className="space-y-6">
                  {/* Resumen del usuario */}
                  {(() => {
                    const user = userHistory.user as { peso?: number; alturaCm?: number; edad?: number; premium?: boolean } | null;
                    if (!user) return null;
                    return (
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-3">Datos del Usuario</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-white/60">Peso Actual</p>
                            <p className="text-white font-medium">{user.peso || "N/A"} kg</p>
                          </div>
                          <div>
                            <p className="text-white/60">Altura</p>
                            <p className="text-white font-medium">{user.alturaCm || "N/A"} cm</p>
                          </div>
                          <div>
                            <p className="text-white/60">Edad</p>
                            <p className="text-white font-medium">{user.edad || "N/A"} años</p>
                          </div>
                          <div>
                            <p className="text-white/60">Premium</p>
                            <p className={`font-medium ${user.premium ? "text-yellow-400" : "text-gray-400"}`}>
                              {user.premium ? "Sí" : "No"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Historial mensual */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Historial Mensual</h3>
                    {userHistory.history && Array.isArray(userHistory.history) && userHistory.history.length > 0 ? (
                      <div className="space-y-4">
                        {userHistory.history.map((snapshot: unknown, idx: number) => {
                          const snap = snapshot as {
                            snapshotMonth?: string;
                            objetivo?: string;
                            intensidad?: string;
                            tipoDieta?: string;
                            calorias_diarias?: number;
                            macros?: { proteinas?: string; grasas?: string; carbohidratos?: string };
                            pesoInicial?: number;
                            pesoObjetivo?: number;
                            diasGym?: number;
                            minutosSesion?: number;
                            createdAt?: string;
                          };
                          const monthYear = snap.snapshotMonth || "N/A";
                          const [year, month] = monthYear.split("-");
                          const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                          const monthName = month ? monthNames[parseInt(month) - 1] : "N/A";
                          
                          return (
                            <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-lg font-semibold text-white">
                                  {monthName} {year}
                                </h4>
                                {snap.createdAt && (
                                  <span className="text-xs text-white/60">
                                    {new Date(snap.createdAt).toLocaleDateString('es-AR')}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-white/60">Objetivo</p>
                                  <p className="text-white font-medium capitalize">{snap.objetivo || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Intensidad</p>
                                  <p className="text-white font-medium capitalize">{snap.intensidad || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Calorías Diarias</p>
                                  <p className="text-white font-medium">{snap.calorias_diarias || "N/A"} kcal</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Días Gym/Sem</p>
                                  <p className="text-white font-medium">{snap.diasGym || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Peso Inicial</p>
                                  <p className="text-white font-medium">{snap.pesoInicial || "N/A"} kg</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Peso Objetivo</p>
                                  <p className="text-white font-medium">{snap.pesoObjetivo || "N/A"} kg</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Duración Sesión</p>
                                  <p className="text-white font-medium">{snap.minutosSesion || "N/A"} min</p>
                                </div>
                                <div>
                                  <p className="text-white/60">Dieta</p>
                                  <p className="text-white font-medium capitalize">{snap.tipoDieta || "N/A"}</p>
                                </div>
                              </div>
                              {snap.macros && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                  <p className="text-white/60 text-xs mb-2">Macronutrientes</p>
                                  <div className="flex gap-4 text-xs">
                                    <span className="text-white/80">Proteínas: {snap.macros.proteinas || "N/A"}</span>
                                    <span className="text-white/80">Grasas: {snap.macros.grasas || "N/A"}</span>
                                    <span className="text-white/80">Carbos: {snap.macros.carbohidratos || "N/A"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-center">
                        <p className="text-white/60">No hay historial mensual registrado aún</p>
                        <p className="text-white/40 text-sm mt-2">El historial se genera automáticamente cuando los planes cumplen 30 días</p>
                      </div>
                    )}
                  </div>

                  {/* Seguimiento de Peso */}
                  {userHistory.weightRecords && userHistory.weightRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Seguimiento de Peso</h3>
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                        {/* Gráfico simple de evolución */}
                        <div className="mb-4">
                          <div className="flex items-end justify-between gap-1 h-32 mb-2">
                            {userHistory.weightRecords.slice(-10).map((record, idx) => {
                              const maxPeso = Math.max(...userHistory.weightRecords!.map(r => r.peso));
                              const minPeso = Math.min(...userHistory.weightRecords!.map(r => r.peso));
                              const range = maxPeso - minPeso || 1;
                              const height = ((record.peso - minPeso) / range) * 100;
                              const fecha = new Date(record.fecha);
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                  <div
                                    className="w-full bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t transition-all hover:from-cyan-400 hover:to-blue-400"
                                    style={{ height: `${Math.max(height, 10)}%` }}
                                  >
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap border border-white/10">
                                      {fecha.toLocaleDateString('es-AR')}: {record.peso} kg
                                    </div>
                                  </div>
                                  <span className="text-[8px] text-white/50 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                                    {fecha.getDate()}/{fecha.getMonth() + 1}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Tabla de registros */}
                        <div className="mt-4 max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-2 text-white/60">Fecha</th>
                                <th className="text-right py-2 text-white/60">Peso (kg)</th>
                                <th className="text-right py-2 text-white/60">Cambio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userHistory.weightRecords
                                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                                .slice(0, 15)
                                .map((record, idx, arr) => {
                                  const fecha = new Date(record.fecha);
                                  const cambio = idx < arr.length - 1 
                                    ? (record.peso - arr[idx + 1].peso).toFixed(1)
                                    : null;
                                  return (
                                    <tr key={idx} className="border-b border-white/5">
                                      <td className="py-2 text-white/80">
                                        {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                      </td>
                                      <td className="text-right py-2 text-white font-medium">{record.peso} kg</td>
                                      <td className="text-right py-2">
                                        {cambio && (
                                          <span className={Number(cambio) > 0 ? "text-red-400" : "text-green-400"}>
                                            {Number(cambio) > 0 ? `+${cambio}` : cambio} kg
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                          {userHistory.weightRecords.length > 15 && (
                            <p className="text-white/60 text-xs text-center mt-2">
                              ... y {userHistory.weightRecords.length - 15} registros más
                            </p>
                          )}
                        </div>

                        {/* Estadísticas */}
                        {userHistory.weightRecords.length > 1 && (() => {
                          const sorted = [...userHistory.weightRecords].sort((a, b) => a.fecha.localeCompare(b.fecha));
                          const primerPeso = sorted[0].peso;
                          const ultimoPeso = sorted[sorted.length - 1].peso;
                          const diferencia = ultimoPeso - primerPeso;
                          const diasTranscurridos = Math.ceil(
                            (new Date(sorted[sorted.length - 1].fecha).getTime() - new Date(sorted[0].fecha).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const promedio = sorted.reduce((sum, r) => sum + r.peso, 0) / sorted.length;
                          
                          return (
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-white/60">Peso Inicial</p>
                                <p className="text-white font-medium">{primerPeso} kg</p>
                              </div>
                              <div>
                                <p className="text-white/60">Peso Actual</p>
                                <p className="text-white font-medium">{ultimoPeso} kg</p>
                              </div>
                              <div>
                                <p className="text-white/60">Cambio Total</p>
                                <p className={`font-medium ${diferencia > 0 ? "text-red-400" : diferencia < 0 ? "text-green-400" : "text-white"}`}>
                                  {diferencia > 0 ? `+${diferencia.toFixed(1)}` : diferencia.toFixed(1)} kg
                                </p>
                              </div>
                              <div>
                                <p className="text-white/60">Promedio</p>
                                <p className="text-white font-medium">{promedio.toFixed(1)} kg</p>
                              </div>
                              {diasTranscurridos > 0 && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-white/60">Período</p>
                                  <p className="text-white font-medium">{diasTranscurridos} días ({Math.round(diasTranscurridos / 30 * 10) / 10} meses)</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Planes del usuario */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Planes Creados ({userHistory.plans?.length || 0})</h3>
                      <button
                        onClick={async () => {
                          if (!selectedUserForHistory) return;
                          try {
                            // Obtener el plan más reciente del usuario
                            const plans = userHistory.plans as Array<{ id?: string; plan?: { plan?: unknown; user?: unknown } }>;
                            if (plans && plans.length > 0) {
                              const latestPlan = plans[0];
                              const response = await fetch("/api/saveMonthlySnapshot", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  userId: selectedUserForHistory.id,
                                  planId: latestPlan.id,
                                  planData: latestPlan.plan?.plan || {},
                                  userData: latestPlan.plan?.user || {},
                                }),
                              });
                              if (response.ok) {
                                alert("Snapshot mensual creado exitosamente");
                                // Recargar historial
                                const historyResponse = await fetch(`/api/admin/userHistory?userId=${selectedUserForHistory.id}&adminUserId=${authUser?.uid}`);
                                if (historyResponse.ok) {
                                  const data = await historyResponse.json();
                                  setUserHistory(data);
                                }
                              } else {
                                const error = await response.json();
                                alert(`Error: ${error.error || "No se pudo crear el snapshot"}`);
                              }
                            } else {
                              alert("No hay planes para crear snapshot");
                            }
                          } catch (error) {
                            console.error("Error al crear snapshot:", error);
                            alert("Error al crear snapshot mensual");
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors text-sm"
                      >
                        Crear Snapshot Manual
                      </button>
                    </div>
                    {userHistory.plans && Array.isArray(userHistory.plans) && userHistory.plans.length > 0 ? (
                      <div className="space-y-2">
                        {userHistory.plans.slice(0, 5).map((plan: unknown, idx: number) => {
                          const p = plan as {
                            id?: string;
                            createdAt?: string;
                            plan?: {
                              plan?: {
                                calorias_diarias?: number;
                                macros?: { proteinas?: string; grasas?: string; carbohidratos?: string };
                              };
                              user?: {
                                objetivo?: string;
                                intensidad?: string;
                              };
                            };
                          };
                          return (
                            <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white font-medium">Plan #{idx + 1}</p>
                                  <p className="text-white/60 text-xs">
                                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : "N/A"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white/80">
                                    {p.plan?.plan?.calorias_diarias || "N/A"} kcal
                                  </p>
                                  <p className="text-white/60 text-xs capitalize">
                                    {p.plan?.user?.objetivo || "N/A"} - {p.plan?.user?.intensidad || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {userHistory.plans.length > 5 && (
                          <p className="text-white/60 text-sm text-center mt-2">
                            ... y {userHistory.plans.length - 5} planes más
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                        <p className="text-white/60">No hay planes registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-red-400">Error al cargar el historial</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}


