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
  premiumSince: any;
  createdAt: any;
  updatedAt: any;
  sexo: string | null;
  alturaCm: number | null;
  edad: number | null;
  peso: number | null;
  pesoObjetivo: number | null;
  cinturaCm: number | null;
  cuelloCm: number | null;
  caderaCm: number | null;
  atletico: boolean;
  premiumPayment: any;
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
        
        // Si es admin pero el documento no existe en Firestore, crearlo primero
        if (isAuthAdmin && !userDoc.exists()) {
          try {
            await setDoc(userRef, {
              email: auth.currentUser.email,
              nombre: "administrador",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            console.log("✅ Documento de administrador creado en Firestore con email y nombre");
            // Esperar un momento para que Firestore propague el cambio
            await new Promise(resolve => setTimeout(resolve, 500));
            // Verificar nuevamente que el documento exista
            const finalUserDoc = await getDoc(userRef);
            if (finalUserDoc.exists()) {
              setIsAdmin(true);
              loadUsers();
              return;
            } else {
              setError("El documento se creó pero no se puede verificar. Por favor, recarga la página.");
              setLoading(false);
              return;
            }
          } catch (createError) {
            console.error("Error al crear documento de administrador:", createError);
            setError("Error al crear documento de administrador. Verifica las reglas de Firestore.");
            setLoading(false);
            return;
          }
        }
        
        // Si es admin por email de Auth pero el documento existe pero no tiene nombre "administrador", actualizarlo
        if (isAuthAdmin && userDoc.exists()) {
          const userData = userDoc.data();
          const needsUpdate = !userData.nombre || userData.nombre.toLowerCase() !== "administrador";
          
          if (needsUpdate) {
            try {
              await updateDoc(userRef, {
                nombre: "administrador",
                email: auth.currentUser.email, // Asegurar que el email esté presente
                updatedAt: serverTimestamp(),
              });
              console.log("✅ Documento de administrador actualizado con nombre");
              // Esperar un momento para que Firestore propague el cambio
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (updateError) {
              console.error("Error al actualizar documento de administrador:", updateError);
              // Continuar de todas formas, el email debería ser suficiente
            }
          }
          
          setIsAdmin(true);
          loadUsers();
          return;
        }

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const email = userData.email?.toLowerCase() || "";
          const nombreLower = userData.nombre?.toLowerCase() || "";
          
          // Verificar si el email es "admin@fitplan-ai.com" o el nombre es "administrador"
          const isAdminUser = email === "admin@fitplan-ai.com" || nombreLower === "administrador";
          
          if (isAdminUser) {
            setIsAdmin(true);
            loadUsers();
          } else {
            setError("Acceso denegado. Solo administradores pueden acceder.");
            setLoading(false);
          }
        } else {
          // Si el documento no existe pero el email de Auth es admin, permitir acceso
          if (isAuthAdmin) {
            setIsAdmin(true);
            loadUsers();
          } else {
            setError("Usuario no encontrado en la base de datos. Si eres administrador, completa tu perfil primero.");
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error al verificar admin:", err);
        setError("Error al verificar permisos de administrador");
        setLoading(false);
      }
    };

    checkAdmin();
  }, [authUser, authLoading, router]);

  const loadUsers = async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      
      if (!db || !auth?.currentUser) {
        setError("Firebase no configurado");
        setLoading(false);
        return;
      }

      // Verificar que el documento del administrador existe antes de intentar leer la colección
      const { doc, getDoc } = await import("firebase/firestore");
      const adminUserRef = doc(db, "usuarios", auth.currentUser.uid);
      const adminUserDoc = await getDoc(adminUserRef);
      
      if (!adminUserDoc.exists()) {
        setError("Error: El documento de administrador no existe en Firestore. Por favor, recarga la página.");
        setLoading(false);
        return;
      }

      const adminData = adminUserDoc.data();
      const isAdminDoc = adminData.email?.toLowerCase() === "admin@fitplan-ai.com" || adminData.nombre?.toLowerCase() === "administrador";
      
      console.log("📋 Datos del administrador:", {
        email: adminData.email,
        nombre: adminData.nombre,
        isAdminByEmail: adminData.email?.toLowerCase() === "admin@fitplan-ai.com",
        isAdminByName: adminData.nombre?.toLowerCase() === "administrador",
        isAdminDoc: isAdminDoc
      });
      
      if (!isAdminDoc) {
        setError("Error: El usuario no tiene permisos de administrador en Firestore.");
        setLoading(false);
        return;
      }

      console.log("✅ Verificación de admin exitosa, cargando usuarios...");
      console.log("🔍 Intentando leer colección de usuarios...");

      // Obtener todos los usuarios directamente desde Firestore (las reglas permitirán si es admin)
      const { collection, query, getDocs, limit } = await import("firebase/firestore");
      const usersQuery = query(collection(db, "usuarios"), limit(500));
      
      try {
        const usersSnapshot = await getDocs(usersQuery);
        console.log("✅ Colección leída exitosamente, usuarios encontrados:", usersSnapshot.docs.length);

      const usersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || null,
          nombre: data.nombre || null,
          premium: data.premium === true,
          premiumStatus: data.premiumStatus || null,
          premiumSince: data.premiumSince || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          sexo: data.sexo || null,
          alturaCm: data.alturaCm || null,
          edad: data.edad || null,
          peso: data.peso || null,
          pesoObjetivo: data.pesoObjetivo || null,
          cinturaCm: data.cinturaCm || null,
          cuelloCm: data.cuelloCm || null,
          caderaCm: data.caderaCm || null,
          atletico: data.atletico || false,
          premiumPayment: data.premiumPayment || null,
        };
      });

        setUsers(usersData);
        setLoading(false);
      } catch (queryError) {
        console.error("❌ Error específico en getDocs:", queryError);
        throw queryError; // Re-lanzar para que el catch general lo maneje
      }
    } catch (err: any) {
      console.error("❌ Error al cargar usuarios:", err);
      console.error("Código del error:", err.code);
      console.error("Mensaje del error:", err.message);
      
      // Mensaje más específico según el tipo de error
      if (err.code === 'permission-denied') {
        setError("Error de permisos: Las reglas de Firestore no permiten leer usuarios. Verifica que:\n1. Las reglas estén publicadas en Firebase Console\n2. El documento tenga email='admin@fitplan-ai.com' y nombre='administrador'\n3. La función isAdmin() en las reglas funcione correctamente");
      } else {
        setError(`Error al cargar usuarios: ${err.message || "Error desconocido"}`);
      }
      setLoading(false);
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

  const handleSave = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const db = getDbSafe();
      if (!db) {
        throw new Error("Firebase no configurado");
      }

      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const userRef = doc(db, "usuarios", editingUser.id);
      
      // Construir objeto de actualización
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };

      // Solo actualizar campos que se proporcionan
      if (editForm.nombre !== undefined) updateData.nombre = editForm.nombre;
      if (editForm.email !== undefined) updateData.email = editForm.email;
      if (editForm.premium !== undefined) {
        updateData.premium = Boolean(editForm.premium);
        updateData.premiumStatus = editForm.premium ? "active" : "inactive";
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

      await updateDoc(userRef, updateData);

      // Recargar usuarios
      await loadUsers();
      setEditingUser(null);
      setEditForm({});
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("Error al guardar cambios. Verifica que las reglas de Firestore permitan acceso de administrador.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("es-AR");
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

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Total Usuarios</p>
            <p className="text-2xl font-bold text-blue-400">{users.length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/60 text-sm mb-1">Usuarios Premium</p>
            <p className="text-2xl font-bold text-yellow-400">
              {users.filter(u => u.premium).length}
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
              {users.filter(u => !u.premium).length}
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
              {users.filter(u => u.atletico).length}
            </p>
          </motion.div>
        </div>

        {/* Lista de usuarios */}
        <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Premium</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Edad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Peso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 font-mono">
                      {user.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{user.nombre || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{user.email || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.premium ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          Premium
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
                ))}
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
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setEditForm({});
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
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

