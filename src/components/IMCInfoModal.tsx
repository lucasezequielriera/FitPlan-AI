import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaWeight, FaArrowUp, FaArrowDown, FaCheckCircle, FaClock, FaInfoCircle } from "react-icons/fa";

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
  let diferenciaPeso: number;
  let tiempoEstimadoMeses: number;
  
  if (estaBajoPeso) {
    // Objetivo: llegar al mínimo saludable + un poco de margen (IMC 19.5)
    pesoObjetivo = Math.round(19.5 * (alturaM * alturaM));
    diferenciaPeso = pesoObjetivo - pesoActual;
    // Ganancia saludable: 0.25-0.5 kg/semana (1-2 kg/mes)
    const gananciaMinMes = 1; // kg/mes (conservador)
    const gananciaMaxMes = sexo === "masculino" ? 2 : 1.5; // kg/mes
    const tasaPromedio = intensidad === "intensa" ? gananciaMaxMes : intensidad === "leve" ? gananciaMinMes : (gananciaMinMes + gananciaMaxMes) / 2;
    tiempoEstimadoMeses = Math.ceil(diferenciaPeso / tasaPromedio);
  } else if (estaSobrepeso) {
    // Objetivo: llegar al máximo saludable
    pesoObjetivo = Math.round(pesoMaxSaludable);
    diferenciaPeso = pesoActual - pesoObjetivo;
    // Pérdida saludable: 0.5-1 kg/semana (2-4 kg/mes)
    const perdidaMinMes = 2; // kg/mes (conservador)
    const perdidaMaxMes = 4; // kg/mes (más agresivo pero seguro)
    const tasaPromedio = intensidad === "intensa" ? perdidaMaxMes : intensidad === "leve" ? perdidaMinMes : (perdidaMinMes + perdidaMaxMes) / 2;
    tiempoEstimadoMeses = Math.ceil(diferenciaPeso / tasaPromedio);
  } else {
    pesoObjetivo = pesoActual;
    diferenciaPeso = 0;
    tiempoEstimadoMeses = 0;
  }
  
  // Clasificación detallada del IMC
  const getClasificacionIMC = (imc: number): { nombre: string; color: string; emoji: string } => {
    if (imc < 16) return { nombre: "Delgadez severa", color: "text-red-400", emoji: "⚠️" };
    if (imc < 17) return { nombre: "Delgadez moderada", color: "text-orange-400", emoji: "⚠️" };
    if (imc < 18.5) return { nombre: "Bajo peso", color: "text-yellow-400", emoji: "📉" };
    if (imc < 25) return { nombre: "Peso saludable", color: "text-green-400", emoji: "✅" };
    if (imc < 30) return { nombre: "Sobrepeso", color: "text-yellow-400", emoji: "📈" };
    if (imc < 35) return { nombre: "Obesidad grado I", color: "text-orange-400", emoji: "⚠️" };
    if (imc < 40) return { nombre: "Obesidad grado II", color: "text-red-400", emoji: "🚨" };
    return { nombre: "Obesidad grado III", color: "text-red-500", emoji: "🚨" };
  };
  
  const clasificacion = getClasificacionIMC(imc);
  
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-6 border-b border-white/10 ${
              estaEnRangoSaludable 
                ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20" 
                : estaBajoPeso 
                  ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20"
                  : "bg-gradient-to-r from-orange-500/20 to-red-500/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    estaEnRangoSaludable ? "bg-green-500/20" : estaBajoPeso ? "bg-yellow-500/20" : "bg-orange-500/20"
                  }`}>
                    <FaWeight className={`text-2xl ${
                      estaEnRangoSaludable ? "text-green-400" : estaBajoPeso ? "text-yellow-400" : "text-orange-400"
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Tu Análisis de IMC</h2>
                    <p className="text-sm text-white/60">Índice de Masa Corporal</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <FaTimes className="text-white/60" />
                </button>
              </div>
            </div>
            
            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* IMC Actual */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-white">{imc.toFixed(1)}</span>
                  <span className="text-lg text-white/50">IMC</span>
                </div>
                <div className={`flex items-center justify-center gap-2 ${clasificacion.color}`}>
                  <span className="text-xl">{clasificacion.emoji}</span>
                  <span className="text-lg font-semibold">{clasificacion.nombre}</span>
                </div>
                <p className="text-sm text-white/50 mt-1">
                  Rango saludable: 18.5 - 24.9
                </p>
              </div>
              
              {/* Barra visual del IMC */}
              <div className="space-y-2">
                <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-[18.5%] bg-yellow-500/30"></div>
                  <div className="absolute inset-y-0 left-[18.5%] w-[25%] bg-green-500/30"></div>
                  <div className="absolute inset-y-0 left-[43.5%] w-[20%] bg-yellow-500/30"></div>
                  <div className="absolute inset-y-0 left-[63.5%] w-[36.5%] bg-red-500/30"></div>
                  {/* Indicador de posición */}
                  <motion.div
                    initial={{ left: 0 }}
                    animate={{ left: `${Math.min(Math.max((imc / 40) * 100, 2), 98)}%` }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg"
                    style={{ transform: "translateX(-50%)" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/40">
                  <span>16</span>
                  <span>18.5</span>
                  <span>25</span>
                  <span>30</span>
                  <span>40</span>
                </div>
              </div>
              
              {/* Información de peso */}
              {!estaEnRangoSaludable && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`p-4 rounded-xl border ${
                    estaBajoPeso 
                      ? "bg-yellow-500/10 border-yellow-500/20" 
                      : "bg-orange-500/10 border-orange-500/20"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {estaBajoPeso ? (
                      <FaArrowUp className="text-2xl text-yellow-400" />
                    ) : (
                      <FaArrowDown className="text-2xl text-orange-400" />
                    )}
                    <div>
                      <p className="font-semibold text-white">
                        {estaBajoPeso ? "Necesitás ganar peso" : "Necesitás perder peso"}
                      </p>
                      <p className="text-sm text-white/60">
                        Para alcanzar un IMC saludable
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">
                        {estaBajoPeso ? "+" : "-"}{diferenciaPeso.toFixed(1)} kg
                      </p>
                      <p className="text-xs text-white/50">Meta de cambio</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{pesoObjetivo} kg</p>
                      <p className="text-xs text-white/50">Peso objetivo</p>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Tiempo estimado */}
              {!estaEnRangoSaludable && tiempoEstimadoMeses > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <FaClock className="text-2xl text-blue-400" />
                    <div>
                      <p className="font-semibold text-white">Tiempo estimado</p>
                      <p className="text-sm text-white/60">
                        Aproximadamente <span className="font-bold text-blue-400">
                          {tiempoEstimadoMeses} {tiempoEstimadoMeses === 1 ? "mes" : "meses"}
                        </span> siguiendo tu plan con intensidad {intensidad}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Mensaje personalizado */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start gap-3">
                  <FaInfoCircle className="text-xl text-white/60 mt-0.5" />
                  <p className="text-sm text-white/80 leading-relaxed">
                    {getMensajePersonalizado()}
                  </p>
                </div>
              </motion.div>
              
              {/* Beneficios */}
              {!estaEnRangoSaludable && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-3"
                >
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <FaCheckCircle className="text-green-400" />
                    Beneficios de alcanzar tu peso saludable
                  </h3>
                  <ul className="space-y-2">
                    {getBeneficios().map((beneficio, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + idx * 0.1 }}
                        className="flex items-center gap-2 text-sm text-white/70"
                      >
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        {beneficio}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}
              
              {/* Estado saludable */}
              {estaEnRangoSaludable && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center p-6 rounded-xl bg-green-500/10 border border-green-500/20"
                >
                  <FaCheckCircle className="text-4xl text-green-400 mx-auto mb-3" />
                  <h3 className="font-bold text-lg text-white mb-2">¡Peso Saludable!</h3>
                  <p className="text-sm text-white/70">
                    Tu IMC está dentro del rango saludable. Seguí con tu plan para mantener y mejorar tu composición corporal.
                  </p>
                </motion.div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-white/10">
              <button
                onClick={onClose}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  estaEnRangoSaludable
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    : estaBajoPeso
                      ? "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                      : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                } text-white`}
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

