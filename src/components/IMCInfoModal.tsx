import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes,
  FaWeight,
  FaArrowUp,
  FaArrowDown,
  FaCheckCircle,
  FaClock,
  FaInfoCircle,
} from "react-icons/fa";

interface IMCInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imc: number;
  pesoActual: number;
  alturaCm: number;
  objetivo: string;
  intensidad: string;
  sexo: string;
}

export default function IMCInfoModal({
  isOpen,
  onClose,
  imc,
  pesoActual,
  alturaCm,
  objetivo,
  intensidad,
  sexo
}: IMCInfoModalProps) {
  // Rangos de IMC según OMS
  const IMC_MIN_SALUDABLE = 18.5;
  const IMC_MAX_SALUDABLE = 24.9;
  
  // Calcular estado del IMC
  const estaBajoPeso = imc < IMC_MIN_SALUDABLE;
  const estaSobrepeso = imc > IMC_MAX_SALUDABLE;
  const estaEnRangoSaludable = !estaBajoPeso && !estaSobrepeso;
  
  // Calcular peso objetivo para llegar al rango saludable
  const alturaM = alturaCm / 100;
  const pesoMinSaludable = IMC_MIN_SALUDABLE * (alturaM * alturaM);
  const pesoMaxSaludable = IMC_MAX_SALUDABLE * (alturaM * alturaM);
  
  // Peso objetivo y diferencia
  let pesoObjetivo: number;
  let pesoMinimoSaludable: number; // Para mostrar el mínimo también
  let diferenciaPeso: number;
  let diferenciaPesoMinimo: number; // Diferencia para llegar al mínimo saludable
  let tiempoEstimadoMeses: number;
  let tiempoMinimoMeses: number; // Tiempo para llegar al mínimo
  
  if (estaBajoPeso) {
    // Peso mínimo para IMC 18.5
    pesoMinimoSaludable = Math.round((IMC_MIN_SALUDABLE * (alturaM * alturaM)) * 10) / 10;
    diferenciaPesoMinimo = Math.round((pesoMinimoSaludable - pesoActual) * 10) / 10;
    
    // Objetivo recomendado: IMC 20 (punto medio saludable, más sostenible)
    // Pero si está muy cerca (IMC > 18), usar objetivo más cercano (IMC 19)
    const imcObjetivo = imc >= 18 ? 19 : 20;
    pesoObjetivo = Math.round((imcObjetivo * (alturaM * alturaM)) * 10) / 10;
    diferenciaPeso = Math.round((pesoObjetivo - pesoActual) * 10) / 10;
    
    // Ganancia saludable: 0.25-0.5 kg/semana (1-2 kg/mes)
    const gananciaMinMes = 1; // kg/mes (conservador)
    const gananciaMaxMes = sexo === "masculino" ? 2 : 1.5; // kg/mes
    const tasaPromedio = intensidad === "intensa" ? gananciaMaxMes : intensidad === "leve" ? gananciaMinMes : (gananciaMinMes + gananciaMaxMes) / 2;
    
    tiempoEstimadoMeses = Math.max(1, Math.ceil(diferenciaPeso / tasaPromedio));
    tiempoMinimoMeses = diferenciaPesoMinimo > 0 ? Math.max(1, Math.ceil(diferenciaPesoMinimo / tasaPromedio)) : 0;
  } else if (estaSobrepeso) {
    pesoMinimoSaludable = 0;
    diferenciaPesoMinimo = 0;
    tiempoMinimoMeses = 0;
    
    // Objetivo: llegar al máximo saludable (IMC 24.9)
    pesoObjetivo = Math.round(pesoMaxSaludable * 10) / 10;
    diferenciaPeso = Math.round((pesoActual - pesoObjetivo) * 10) / 10;
    
    // Pérdida saludable: 0.5-1 kg/semana (2-4 kg/mes)
    const perdidaMinMes = 2; // kg/mes (conservador)
    const perdidaMaxMes = 4; // kg/mes (más agresivo pero seguro)
    const tasaPromedio = intensidad === "intensa" ? perdidaMaxMes : intensidad === "leve" ? perdidaMinMes : (perdidaMinMes + perdidaMaxMes) / 2;
    tiempoEstimadoMeses = Math.max(1, Math.ceil(diferenciaPeso / tasaPromedio));
  } else {
    pesoObjetivo = pesoActual;
    pesoMinimoSaludable = 0;
    diferenciaPeso = 0;
    diferenciaPesoMinimo = 0;
    tiempoEstimadoMeses = 0;
    tiempoMinimoMeses = 0;
  }
  
  // Clasificación detallada del IMC
  const getClasificacionIMC = (imc: number): { nombre: string; color: string; emoji: string } => {
    if (imc < 16) return { nombre: "Delgadez severa", color: "text-danger", emoji: "⚠️" };
    if (imc < 17) return { nombre: "Delgadez moderada", color: "text-warning", emoji: "⚠️" };
    if (imc < 18.5) return { nombre: "Bajo peso", color: "text-warning", emoji: "📉" };
    if (imc < 25) return { nombre: "Peso saludable", color: "text-success", emoji: "✅" };
    if (imc < 30) return { nombre: "Sobrepeso", color: "text-warning", emoji: "📈" };
    if (imc < 35) return { nombre: "Obesidad grado I", color: "text-warning", emoji: "⚠️" };
    if (imc < 40) return { nombre: "Obesidad grado II", color: "text-danger", emoji: "🚨" };
    return { nombre: "Obesidad grado III", color: "text-danger", emoji: "🚨" };
  };
  
  const clasificacion = getClasificacionIMC(imc);

  const estadoTema = estaEnRangoSaludable
    ? {
        panel:
          "from-[color-mix(in_oklab,var(--landing-accent)_20%,transparent)] via-[color-mix(in_oklab,var(--brand-mid)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-end)_18%,transparent)]",
        border: "border-[color-mix(in_oklab,var(--landing-accent)_35%,transparent)]",
        badge:
          "bg-[color-mix(in_oklab,var(--landing-accent)_18%,transparent)] text-[var(--foreground)] border-[color-mix(in_oklab,var(--landing-accent)_38%,transparent)]",
        button:
          "from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] hover:brightness-110",
      }
    : estaBajoPeso
      ? {
          panel:
            "from-[color-mix(in_oklab,#f59e0b_22%,transparent)] via-[color-mix(in_oklab,#fbbf24_10%,transparent)] to-[color-mix(in_oklab,#d97706_16%,transparent)]",
          border: "border-[color-mix(in_oklab,#f59e0b_40%,transparent)]",
          badge:
            "bg-[color-mix(in_oklab,#f59e0b_20%,transparent)] text-[var(--foreground)] border-[color-mix(in_oklab,#f59e0b_38%,transparent)]",
          button:
            "from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] hover:brightness-110",
        }
      : {
          panel:
            "from-[color-mix(in_oklab,#fb923c_20%,transparent)] via-[color-mix(in_oklab,#ef4444_10%,transparent)] to-[color-mix(in_oklab,#f97316_18%,transparent)]",
          border: "border-[color-mix(in_oklab,#fb923c_36%,transparent)]",
          badge:
            "bg-[color-mix(in_oklab,#fb923c_18%,transparent)] text-[var(--foreground)] border-[color-mix(in_oklab,#fb923c_35%,transparent)]",
          button:
            "from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] hover:brightness-110",
        };
  
  // Mensaje personalizado según objetivo del usuario
  const getMensajePersonalizado = (): string => {
    if (estaEnRangoSaludable) {
      return "¡Excelente! Tu peso está dentro del rango saludable. Tu plan está optimizado para ayudarte a alcanzar tus objetivos de fitness.";
    }
    
    if (estaBajoPeso) {
      if (objetivo === "ganar_masa" || objetivo === "volumen") {
        return "Tu plan de ganancia muscular te ayudará a alcanzar un peso más saludable mientras construyes músculo de calidad.";
      }
      return "Te recomendamos enfocarte en aumentar tu peso de manera saludable antes de considerar otros objetivos.";
    }
    
    if (estaSobrepeso) {
      if (objetivo === "perder_grasa" || objetivo === "definicion" || objetivo === "corte") {
        return "Tu plan de pérdida de grasa está diseñado para ayudarte a alcanzar un peso saludable de manera sostenible.";
      }
      if (objetivo === "recomposicion") {
        return "Tu plan de recomposición corporal te ayudará a perder grasa mientras mantienes o ganas músculo.";
      }
      return "Considera ajustar tu objetivo para incluir pérdida de grasa y mejorar tu salud general.";
    }
    
    return "";
  };
  
  // Beneficios de alcanzar peso saludable
  const getBeneficios = (): string[] => {
    if (estaBajoPeso) {
      return [
        "Más energía y vitalidad diaria",
        "Sistema inmune más fuerte",
        "Mejor rendimiento físico y mental",
        "Mayor fuerza y resistencia muscular",
        "Mejor recuperación después del ejercicio"
      ];
    }
    if (estaSobrepeso) {
      return [
        "Menor riesgo de enfermedades cardíacas",
        "Mejor movilidad y menor dolor articular",
        "Más energía para actividades diarias",
        "Mejor calidad de sueño",
        "Mayor autoestima y confianza"
      ];
    }
    return [];
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,#020617_82%,black)] p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_88%,#0a0f18)] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`border-b border-[var(--landing-border)] bg-gradient-to-r ${estadoTema.panel}`}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-xl border p-2.5 ${estadoTema.badge}`}
                    >
                      <FaWeight className="text-xl" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--landing-muted)]">
                        Índice de masa corporal
                      </p>
                      <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
                        Tu análisis de IMC
                      </h2>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1 text-xs text-[var(--foreground)]">
                        <span>{clasificacion.emoji}</span>
                        {clasificacion.nombre}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2 text-[var(--landing-muted)] transition hover:text-[var(--foreground)]"
                    aria-label="Cerrar modal de IMC"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5">
                <div className={`rounded-xl border p-2.5 ${estadoTema.border} bg-[var(--landing-surface)]`}>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">IMC</p>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-2xl font-bold text-[var(--foreground)]">{imc.toFixed(1)}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">Peso</p>
                  <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{pesoActual} kg</p>
                </div>
                <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--landing-muted)]">Rango</p>
                  <p className="mt-1 text-xl font-bold text-[var(--foreground)]">18.5-24.9</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-[var(--landing-muted)]">Posición en escala IMC</p>
                <div className="relative h-3 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_14%,transparent)]">
                  <div className="absolute inset-y-0 left-0 w-[10.4%] bg-warning/45" />
                  <div className="absolute inset-y-0 left-[10.4%] w-[27.1%] bg-success/50" />
                  <div className="absolute inset-y-0 left-[37.5%] w-[20.8%] bg-warning/45" />
                  <div className="absolute inset-y-0 left-[58.3%] w-[41.7%] bg-danger/45" />
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: `${Math.min(Math.max(((imc - 16) / 24) * 100, 1), 99)}%` }}
                    transition={{ delay: 0.25, duration: 0.45 }}
                    className="absolute top-0 h-full w-1 rounded-full bg-[var(--foreground)]"
                    style={{ transform: "translateX(-50%)" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--landing-muted)]">
                  <span>16</span>
                  <span>18.5</span>
                  <span>25</span>
                  <span>30</span>
                  <span>40</span>
                </div>
              </div>

              {estaBajoPeso && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.25 }}
                  className="space-y-2.5"
                >
                  <div className="rounded-xl border border-success/25 bg-success/10 p-3">
                    <div className="mb-2 flex items-center gap-2.5">
                      <FaArrowUp className="text-base text-success" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--foreground)]">Mínimo para entrar en rango saludable</p>
                        <p className="text-[11px] text-[var(--landing-muted)]">Peso mínimo: {pesoMinimoSaludable} kg</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                        <p className="text-xl font-bold text-success">+{diferenciaPesoMinimo} kg</p>
                        <p className="text-[10px] text-[var(--landing-muted)]">Para ganar</p>
                      </div>
                      <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                        <p className="text-xl font-bold text-success">
                          {tiempoMinimoMeses > 0 ? `~${tiempoMinimoMeses} ${tiempoMinimoMeses === 1 ? "mes" : "meses"}` : "< 1 mes"}
                        </p>
                        <p className="text-[10px] text-[var(--landing-muted)]">Tiempo est.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-warning/25 bg-warning/10 p-3">
                    <div className="mb-2 flex items-center gap-2.5">
                      <FaArrowUp className="text-base text-warning" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--foreground)]">Objetivo recomendado (IMC {imc >= 18 ? "19" : "20"})</p>
                        <p className="text-[11px] text-[var(--landing-muted)]">Más sostenible y saludable</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                        <p className="text-xl font-bold text-warning">+{diferenciaPeso} kg</p>
                        <p className="text-[10px] text-[var(--landing-muted)]">Para ganar</p>
                      </div>
                      <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                        <p className="text-xl font-bold text-warning">
                          ~{tiempoEstimadoMeses} {tiempoEstimadoMeses === 1 ? "mes" : "meses"}
                        </p>
                        <p className="text-[10px] text-[var(--landing-muted)]">Tiempo est.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {estaSobrepeso && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.25 }}
                  className="rounded-xl border border-warning/25 bg-warning/10 p-3"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <FaArrowDown className="text-xl text-warning" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Necesitás perder peso</p>
                      <p className="text-[11px] text-[var(--landing-muted)]">
                        Para alcanzar IMC saludable (24.9)
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                      <p className="text-2xl font-bold text-warning">-{diferenciaPeso} kg</p>
                      <p className="text-[10px] text-[var(--landing-muted)]">Para perder</p>
                    </div>
                    <div className="rounded-lg bg-[var(--landing-surface)] p-2">
                      <p className="text-2xl font-bold text-warning">{pesoObjetivo} kg</p>
                      <p className="text-[10px] text-[var(--landing-muted)]">Peso objetivo</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {estaSobrepeso && tiempoEstimadoMeses > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.25 }}
                  className="rounded-xl border border-info/25 bg-info/10 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <FaClock className="text-xl text-info" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Tiempo estimado</p>
                      <p className="text-[11px] text-[var(--landing-muted)]">
                        Aproximadamente <span className="font-bold text-info">
                          {tiempoEstimadoMeses} {tiempoEstimadoMeses === 1 ? "mes" : "meses"}
                        </span> siguiendo tu plan con intensidad {intensidad}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.25 }}
                className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3"
              >
                <div className="flex items-start gap-2.5">
                  <FaInfoCircle className="mt-0.5 text-base text-[var(--landing-muted)]" />
                  <p className="text-xs leading-relaxed text-[var(--foreground)]">
                    {getMensajePersonalizado()}
                  </p>
                </div>
              </motion.div>

              {!estaEnRangoSaludable && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.25 }}
                  className="space-y-2 rounded-xl border border-success/20 bg-success/[0.06] p-3"
                >
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    <FaCheckCircle className="text-success" />
                    Beneficios de alcanzar tu peso saludable
                  </h3>
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {getBeneficios().map((beneficio, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + idx * 0.1 }}
                        className="flex items-center gap-2 text-xs text-[var(--foreground)]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {beneficio}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {estaEnRangoSaludable && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.25 }}
                  className="rounded-xl border border-success/25 bg-success/10 p-4 text-center"
                >
                  <FaCheckCircle className="mx-auto mb-2 text-3xl text-success" />
                  <h3 className="mb-1 text-base font-bold text-[var(--foreground)]">¡Peso saludable!</h3>
                  <p className="text-xs text-[var(--foreground)]">
                    Tu IMC está dentro del rango saludable. Sigue con tu plan para mantener y mejorar tu composición corporal.
                  </p>
                </motion.div>
              )}
            </div>

            <div className="border-t border-[var(--landing-border)] p-4">
              <button
                onClick={onClose}
                className={`w-full rounded-xl bg-gradient-to-r py-2.5 text-sm font-semibold text-accent-ink transition-all ${estadoTema.button}`}
              >
                {estaEnRangoSaludable ? "¡Genial! Continuar" : "Entendido, ¡a trabajar!"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

