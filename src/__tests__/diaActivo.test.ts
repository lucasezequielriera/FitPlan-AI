import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { nextActiveDays, } from "@/lib/funnel/store";
import { madridDateId } from "@/lib/dates/madrid";

/**
 * #4 — qué significa "usuario activo".
 *
 * Decisión de Lucas (2026-09-13): **activo = entró en la app**, aunque no
 * registre nada. Mirar el plan es usar el producto.
 *
 * Esa definición ya era la implementada, así que el issue no necesitaba fórmula
 * nueva. Lo que sí tenía era un fallo silencioso en la dirección contraria a la
 * que se suponía: el cliente marcaba el día una vez por sesión de navegador
 * (`sessionStorage`), no una vez por día. Quien deja la app abierta —lo normal
 * en el móvil, donde el webview de Capacitor sobrevive días— entraba cinco días
 * seguidos y contaba como uno.
 *
 * La retención no estaba inflada: **subcontaba justo a los usuarios más fieles**,
 * que son los únicos que importan al medirla.
 */

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("#4 — el día activo se marca una vez por día, no una por sesión", () => {
  it("un día que ya consta no se vuelve a escribir", () => {
    // Es lo que hace barato llamar de más desde el cliente: el servidor decide.
    const hoy = madridDateId(d("2026-09-13"));
    expect(nextActiveDays([hoy], d("2026-09-13"))).toBeNull();
  });

  it("un día nuevo se añade al historial", () => {
    expect(nextActiveDays(["2026-09-12"], d("2026-09-13"))).toEqual([
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("entrar cinco días seguidos cuenta cinco, no uno", () => {
    // El fallo exacto que se arregla. Se simula el cliente llamando una vez por
    // día, que es lo que hace ahora que el guard va por día y no por sesión.
    let dias: string[] = [];
    for (const iso of ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]) {
      dias = nextActiveDays(dias, d(iso)) ?? dias;
    }
    expect(dias).toHaveLength(5);
  });

  it("el historial no crece sin límite", () => {
    // Un usuario que entra a diario durante años no puede hacer crecer el
    // documento indefinidamente.
    let dias = Array.from({ length: 80 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`);
    dias = [...new Set(dias)];
    const siguiente = nextActiveDays(dias, d("2026-09-13"));
    expect(siguiente!.length).toBeLessThanOrEqual(60);
    expect(siguiente).toContain("2026-09-13");
  });

  it("el día se calcula en hora de Madrid, no en UTC", () => {
    // A las 00:30 de Madrid en verano son las 22:30 UTC del día anterior. Si se
    // usara UTC, entrar de noche marcaría el día equivocado y partiría en dos
    // una racha real.
    const medianocheMadrid = new Date("2026-07-01T22:30:00Z");
    expect(madridDateId(medianocheMadrid)).toBe("2026-07-02");
  });
});

describe("#4 — el cliente no puede volver a marcar por sesión", () => {
  it("el guard usa localStorage y la fecha, no sessionStorage", () => {
    // Guard estructural: `sessionStorage` es precisamente lo que causaba el
    // subconteo, y volver a él no rompería ningún test de comportamiento
    // —el flujo sigue funcionando— pero devolvería la métrica al estado malo.
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/store/authStore.ts"),
      "utf8"
    ) as string;
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(codigo).not.toMatch(/sessionStorage/);
    expect(codigo).toMatch(/localStorage\.getItem\(diaKey\)/);
    expect(codigo).toMatch(/madridDateId\(new Date\(\)\)/);
  });

  it("vuelve a comprobarlo cuando la app vuelve al primer plano", () => {
    // `onAuthStateChanged` dispara una vez por carga. Sin esto, la app abierta
    // que cruza la medianoche nunca marca el día nuevo.
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/store/authStore.ts"),
      "utf8"
    ) as string;
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/visibilityState !== "visible"/);
  });
});
