import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * "Configuraciones" dejó de ser un hub — DESIGN_SYSTEM.md §7.3/§7.4.
 * Sus 6 hijos ahora son destinos de primer nivel del sidebar del admin
 * (Ejercicios, Contenido, Backlog, Servicios, HYROX) o sub-pestañas de
 * "Contenido". Esta ruta se mantiene solo para no romper enlaces viejos
 * (favoritos, historial) y redirige al Resumen.
 */
export default function AdminConfiguracionesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return null;
}
