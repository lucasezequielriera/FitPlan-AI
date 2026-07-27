import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { FaArrowLeft, FaChevronRight, FaCog, FaDumbbell, FaVideo } from "react-icons/fa";

export default function AdminConfiguracionesPage() {
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-400" />
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/85 transition-colors mb-4"
          >
            <FaArrowLeft className="text-xs" />
            Volver al panel
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-400/35 text-violet-200">
              <FaCog className="text-lg" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Configuraciones</h1>
              <p className="text-sm text-white/55 mt-1">Ajustes globales del administrador (se irá ampliando).</p>
            </div>
          </div>
        </div>

        <motion.ul
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <li>
            <Link
              href="/admin/configuraciones/ejercicios"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-200">
                <FaDumbbell />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">Catálogo de ejercicios</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Ilustraciones wger, imágenes en <code className="text-violet-300/90 text-xs">public/ejercicios/</code>, índice por planes y
                  cobertura wger.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/configuraciones/contenido-social"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/15 border border-info/25 text-info">
                <FaVideo />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">Generador de contenido</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Creá videos para Instagram/TikTok con IA, revisalos y publicalos. También configurá los reels automáticos diarios.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
        </motion.ul>
      </div>
    </div>
  );
}
