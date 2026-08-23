import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient } from "@/lib/adminAuthClient";
import Navbar from "@/components/Navbar";
import { FaArrowLeft, FaChevronRight, FaCog, FaDumbbell, FaVideo, FaServer, FaChartLine, FaBolt, FaColumns } from "react-icons/fa";

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
                  Crea videos para Instagram/TikTok con IA, revísalos y publícalos. También configura los reels automáticos diarios.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/servicios"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-400/25 text-emerald-200">
                <FaServer />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">Servicios</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Estado y crédito de cada servicio externo (HeyGen, Cloudinary, OpenAI, Instagram, pagos), e historial de contenido publicado.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/metricas-rs"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-200">
                <FaChartLine />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">Métricas de RS</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Qué reel engancha más: retención, alcance y amplificación comparadas por gancho, franja horaria y tema.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/backlog"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-400/25 text-violet-200">
                <FaColumns />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">Backlog del equipo</p>
                <p className="text-sm text-white/50 mt-0.5">
                  En qué trabaja cada equipo, cuánto tardó cada tarea, y qué quedó esperando una decisión tuya.
                </p>
              </div>
              <FaChevronRight className="text-white/35 group-hover:text-violet-300/80 shrink-0" />
            </Link>
          </li>
          <li>
            <Link
              href="/admin/hyrox"
              className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-violet-400/30 px-4 py-4 transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-400/25 text-orange-200">
                <FaBolt />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">HYROX</p>
                <p className="text-sm text-white/50 mt-0.5">
                  Plan de 15 semanas para el Doubles del 20 de noviembre: entrenos, estrategia de carrera, tests y nutrición.
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
