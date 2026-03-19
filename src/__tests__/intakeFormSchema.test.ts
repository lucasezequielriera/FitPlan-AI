import { describe, expect, it } from "@jest/globals";
import { INTAKE_INITIAL_STATE, validateIntakeForm } from "@/lib/intakeFormSchema";

function validPayload() {
  return {
    ...INTAKE_INITIAL_STATE,
    nombreCompleto: "María López",
    email: "maria@example.com",
    whatsapp: "+34 612 345 678",
    edad: "31",
    alturaCm: "167",
    pesoKg: "64",
    comidasPorDiaHorarios: "4 comidas: 8:00, 12:30, 17:00, 21:00",
    diasEntrenaActualmente: "3",
    diasCompromisoEntrenamiento: "4",
    objetivoRendimiento: "Mejorar resistencia y fuerza.",
    objetivoEstetico: "Bajar grasa abdominal.",
    diasDisponibles: ["Lunes", "Miércoles", "Viernes"],
    dondeEntrena: ["Gimnasio"],
    consentimiento: true,
  };
}

describe("validateIntakeForm", () => {
  it("passes for a valid payload", () => {
    expect(validateIntakeForm(validPayload())).toEqual([]);
  });

  it("fails when required fields are missing", () => {
    const payload = { ...INTAKE_INITIAL_STATE };
    const errors = validateIntakeForm(payload);

    expect(errors).toContain("Por favor, introduce tu nombre completo.");
    expect(errors).toContain("Por favor, introduce tu email.");
    expect(errors).toContain("Por favor, introduce tu WhatsApp.");
    expect(errors).toContain("Debes aceptar el consentimiento para enviar el formulario.");
  });

  it("fails with invalid email and phone format", () => {
    const payload = {
      ...validPayload(),
      email: "maria@",
      whatsapp: "abc",
      instagram: "@usuario invalido",
    };

    const errors = validateIntakeForm(payload);
    expect(errors).toContain("Introduce un email válido.");
    expect(errors).toContain("Introduce un WhatsApp válido (con prefijo internacional si es posible).");
    expect(errors).toContain("El usuario de Instagram no es válido.");
  });

  it("fails with unrealistic anthropometric values", () => {
    const payload = {
      ...validPayload(),
      edad: "8",
      alturaCm: "260",
      pesoKg: "20",
    };

    const errors = validateIntakeForm(payload);
    expect(errors).toContain("La edad debe estar entre 14 y 100 años.");
    expect(errors).toContain("La altura debe estar entre 120 y 230 cm.");
    expect(errors).toContain("El peso debe estar entre 35 y 300 kg.");
  });

  it("fails when selected options are outside allowed lists", () => {
    const payload = {
      ...validPayload(),
      diasDisponibles: ["Luness"],
      dondeEntrena: ["Playa"],
      equipamientoDisponible: ["Barras mágicas"],
      diasTrabajo: ["Finde"],
    };

    const errors = validateIntakeForm(payload);
    expect(errors).toContain("Los días seleccionados no son válidos.");
    expect(errors).toContain("Los lugares de entrenamiento seleccionados no son válidos.");
    expect(errors).toContain("El equipamiento seleccionado no es válido.");
    expect(errors).toContain("Los días de trabajo seleccionados no son válidos.");
  });

  it("fails when long text exceeds max length", () => {
    const longText = "a".repeat(2001);
    const payload = {
      ...validPayload(),
      motivacionPrincipal: longText,
    };

    const errors = validateIntakeForm(payload);
    expect(errors.some((e) => e.includes("motivacionPrincipal"))).toBe(true);
  });
});
