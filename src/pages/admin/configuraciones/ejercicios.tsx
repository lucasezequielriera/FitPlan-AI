import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getIsAdminClient } from "@/lib/adminAuthClient";
import AdminExerciseCatalogPanel from "@/components/AdminExerciseCatalogPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminFadeUp } from "@/components/admin/adminMotion";

export default function AdminConfiguracionEjerciciosPage() {
  const router = useRouter();
  const fadeUp = useAdminFadeUp();
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <AdminShell active="ejercicios">
      <motion.div {...fadeUp}>
        <AdminPageHeader
          kicker="Ejercicios"
          title="Catálogo de ejercicios"
          subtitle="Asignación global de ilustraciones por nombre de ejercicio."
        />
        <div className="mt-6">
          <AdminExerciseCatalogPanel variant="page" />
        </div>
      </motion.div>
    </AdminShell>
  );
}
