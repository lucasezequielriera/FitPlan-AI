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
  const [deleting, setDeleting] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [premiumUsers, setPremiumUsers] = useState<number>(0);
  const [regularUsers, setRegularUsers] = useState<number>(0);
  const [athleticUsers, setAthleticUsers] = useState<number>(0);
  
  // Estadísticas de ganancias
  const [revenueStats, setRevenueStats] = useState({
    estimatedMonthly: 0,
    premiumActiveThisMonth: 0,
    pendingPayments: 0,
    estimatedAnnual: 0,
    renewingSoon: 0,
    totalPremiumUsers: 0,
  });

  // Función para determinar estado de pago basado en premiumLastPay
  const getPaymentStatus = (user: User): { status: "paid" | "unpaid"; label: string; color: string } => {
    // Solo verificar estado de pago para usuarios premium
    if (!user.premium) {
      return { status: "unpaid", label: "Regular", color: "gray" };
    }

    // Verificar premiumLastPay para ver si pagó este mes
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let lastPayDate: Date | null = null;
    
    // Intentar obtener la fecha de premiumLastPay
    if (user.premiumLastPay) {
      if (user.premiumLastPay instanceof Date) {
        lastPayDate = user.premiumLastPay;
      } else if (typeof user.premiumLastPay === 'string') {
        lastPayDate = new Date(user.premiumLastPay);
      } else if (user.premiumLastPay && typeof user.premiumLastPay === 'object' && 'toDate' in user.premiumLastPay) {
        lastPayDate = (user.premiumLastPay as { toDate: () => Date }).toDate();
      }
    }
    
    // Si hay fecha de último pago y es del mes actual
    if (lastPayDate && !isNaN(lastPayDate.getTime())) {
      const paymentMonth = lastPayDate.getMonth();
      const paymentYear = lastPayDate.getFullYear();
      
      // Si pagó este mes
      if (paymentMonth === currentMonth && paymentYear === currentYear) {
        return { status: "paid", label: "Pagado", color: "green" };
      }
    }
    
    // Si no pagó este mes o no tiene premiumLastPay, está sin pagar
    return { status: "unpaid", label: "Sin Pagar", color: "red" };
  };

  // Función para calcular estadísticas de ganancias
  const calculateRevenueStats = () => {
    const PRICE_PER_MONTH = 25000; // ARS
    const premiumUsersList = users.filter(u => u.premium && u.email?.toLowerCase() !== "admin@fitplan-ai.com");
    
    let premiumActiveThisMonth = 0;
    let pendingPayments = 0;
    let renewingSoon = 0;
    
    const now = new Date();
    
    const totalPremiumUsers = premiumUsersList.length;
    
    premiumUsersList.forEach(user => {
      const paymentStatus = getPaymentStatus(user);
      
      if (paymentStatus.status === "paid") {
        premiumActiveThisMonth++;
      } else if (paymentStatus.status === "unpaid") {
        pendingPayments++;
      }
      
      // Usuarios que renovarán pronto (próximos 7 días)
      if (user.premiumSince) {
        let premiumDate: Date | null = null;
        if (user.premiumSince instanceof Date) {
          premiumDate = user.premiumSince;
        } else if (typeof user.premiumSince === 'string') {
          premiumDate = new Date(user.premiumSince);
        } else if (user.premiumSince && typeof user.premiumSince === 'object' && 'toDate' in user.premiumSince) {
          premiumDate = (user.premiumSince as { toDate: () => Date }).toDate();
        }
        
        if (premiumDate && !isNaN(premiumDate.getTime())) {
          const daysSincePayment = Math.floor((now.getTime() - premiumDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSincePayment >= 23 && daysSincePayment <= 30) {
            renewingSoon++;
          }
        }
      }
    });
    
    const estimatedMonthly = premiumActiveThisMonth * PRICE_PER_MONTH;
    // Proyección anual: asume que los usuarios activos este mes seguirán pagando cada mes durante el año
    const estimatedAnnual = estimatedMonthly * 12;
    
    setRevenueStats({
      estimatedMonthly,
      premiumActiveThisMonth,
      pendingPayments,
      estimatedAnnual,
      renewingSoon,
      totalPremiumUsers,
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
            // Crear documento del admin
            try {
              await setDoc(userRef, {
                email: auth.currentUser.email || "admin@fitplan-ai.com",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              console.log("✅ Documento de administrador creado");
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (createError) {
              console.error("Error al crear documento de administrador:", createError);
            }
          } else {
            // Verificar y actualizar si es necesario
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
          }
          
          setIsAdmin(true);
          setLoading(false);
          loadUserStats();
          return;
        }

        // Si no es admin por email de Auth, verificar en el documento
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email?.toLowerCase() || "";
          const isAdminUser = email === "admin@fitplan-ai.com";
          
          if (isAdminUser) {
            setIsAdmin(true);
            setLoading(false);
            loadUserStats();
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
  }, [authUser, authLoading, router]);

  const loadUserStats = async () => {
    try {
      const auth = getAuthSafe();
      
      if (!auth?.currentUser) {
        return;
      }

      // Llamar al endpoint API para obtener estadísticas
      const response = await fetch(`/api/admin/stats?userId=${auth.currentUser.uid}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        console.error("❌ Error del API:", errorData);
        return;
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
        
        setUsers(sortedUsers);
        setLoading(false);
        console.log(`✅ ${sortedUsers.length} usuarios cargados y ordenados por fecha de creación`);
      }
    } catch (err: unknown) {
      console.error("❌ Error al cargar estadísticas:", err);
    }
  };

  // Función loadUsers deshabilitada temporalmente
  // Se puede habilitar más adelante cuando se necesite mostrar la lista completa de usuarios

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
      await loadUserStats();
      
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
      await loadUserStats();
      
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
                    return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{user.nombre || "N/A"}</td>
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
                          <span className={`px-2 py-1 text-xs rounded-full border ${
                            paymentStatus.status === "paid" 
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}>
                            {paymentStatus.label}
                          </span>
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
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-colors"
                        >
                          Editar
                        </button>
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
      </div>
    </div>
  );
}


