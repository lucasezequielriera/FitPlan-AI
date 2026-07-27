import { describe, expect, it } from "@jest/globals";
import { buildIntakeEmail } from "@/lib/intakeEmail";

describe("buildIntakeEmail", () => {
  it("creates subject, html and text with payload data", () => {
    const payload = {
      nombreCompleto: "Lucía García",
      objetivoPrincipal: "ganar_musculo" as const,
      email: "lucia@example.com",
      whatsapp: "+34 600 000 000",
      instagram: "@luciag",
      diasDisponibles: ["Lunes", "Miércoles"],
      diasTrabajo: ["Lunes", "Martes", "Miércoles"],
      preferenciasAlimentos: {
        Pollo: "gusta" as const,
        Atún: "no_gusta" as const,
      },
    };

    const result = buildIntakeEmail(payload);

    expect(result.subject).toContain("Lucía García");
    expect(result.subject).toContain("ganar_musculo");
    expect(result.html).toContain("Datos básicos");
    expect(result.html).toContain("Lucía García");
    expect(result.html).toContain("Instagram");
    expect(result.html).toContain("@luciag");
    expect(result.html).toContain("Días de trabajo");
    expect(result.html).toContain("Alimentos que le gustan");
    expect(result.html).toContain("Alimentos que no le gustan");
    expect(result.html).toContain("Alimentos neutros (sin marcar)");
    expect(result.html).toContain("Pollo");
    expect(result.html).toContain("Atún");
    expect(result.text).toContain("email: lucia@example.com");
    expect(result.text).toContain("preferenciasAlimentos_gustan: Pollo");
  });

  it("escapes HTML content to avoid injection in email body", () => {
    const payload = {
      nombreCompleto: "<script>alert(1)</script>",
      objetivoPrincipal: "otro" as const,
    };

    const result = buildIntakeEmail(payload);

    expect(result.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.html).not.toContain("<script>alert(1)</script>");
  });
});
