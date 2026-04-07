import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import AdminExerciseCatalogPanel from "@/components/AdminExerciseCatalogPanel";
import { FaArrowLeft, FaCog } from "react-icons/fa";

export default function AdminConfiguracionEjerciciosPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) {
        router.replace("/");
        return;
      }
      const ok = await getIsAdminClient();
      setAllowed(ok);
      setChecking(false);
      if (!ok) router.replace("/");
    };
    void run();
  }, [authUser, authLoading, router]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 pb-12">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <nav className="text-sm text-white/50 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href="/admin" className="hover:text-white/80 transition-colors">
            Panel
          </Link>
          <span aria-hidden className="text-white/30">
            /
          </span>
          <Link href="/admin/configuraciones" className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors">
            <FaCog className="text-xs opacity-70" />
            Configuraciones
          </Link>
          <span aria-hidden className="text-white/30">
            /
          </span>
          <span className="text-white/75">Ejercicios</span>
        </nav>

        <div className="mb-6">
          <Link
            href="/admin/configuraciones"
            className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/85 transition-colors mb-3"
          >
            <FaArrowLeft className="text-xs" />
            Configuraciones
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Catálogo de ejercicios</h1>
          <p className="text-sm text-white/55 mt-1 max-w-2xl">
            Asignación global de ilustraciones por nombre de ejercicio. Misma herramienta que antes en modal, ahora en vista dedicada.
          </p>
        </div>

        <AdminExerciseCatalogPanel variant="page" />
      </div>
    </div>
  );
}
