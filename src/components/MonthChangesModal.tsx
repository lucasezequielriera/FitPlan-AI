import { motion } from "framer-motion";

function CambioIndicator({ valor, unidad = "" }: { valor: number; unidad?: string }) {
  if (Math.abs(valor) < 1) {
    return (
      <span className="text-info flex items-center gap-1">
        <span>=</span> <span className="text-xs">Mantenido</span>
      </span>
    );
  }

  return (
    <span className={`${valor > 0 ? "text-success" : "text-warning"} flex items-center gap-1`}>
      <span>{valor > 0 ? "↑" : "↓"}</span>
      <span>{valor > 0 ? "+" : ""}{valor.toFixed(1)}{unidad}</span>
    </span>
  );
}

interface MonthChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cambios: {
    mesAnterior: number;
    mesNuevo: number;
    faseAnterior: string;
    faseNueva: string;
    cambioFase: boolean;
    nutricion: {
      caloriasAnterior: number;
      caloriasNueva: number;
      diferenciaCalorias: number;
      macrosAnterior: { proteinas: string; carbohidratos: string; grasas: string };
      macrosNuevo: { proteinas: string; carbohidratos: string; grasas: string };
      cambioMacros: {
        proteinas: number;
        carbohidratos: number;
        grasas: number;
      };
    };
    entrenamiento: {
      diasGymAnterior: number;
      diasGymNuevo: number;
      cambioVolumen: "aumentado" | "reducido" | "mantenido";
      ejerciciosNuevos: number;
      descripcionCambios: string;
    };
    ajustesAplicados: string[];
    razonCambios: string;
    progresoUsuario?: {
      pesoInicial: number;
      pesoActual: number;
      pesoObjetivo: number;
      cambioPesoTotal: number;
      cambioPesoUltimoMes: number;
      porcentajeHaciaObjetivo: number;
      mesesCompletados: number;
      totalMeses: number;
      adherenciaPromedio: number;
      tendenciaEnergia: "mejorando" | "estable" | "empeorando";
      tendenciaRecuperacion: "mejorando" | "estable" | "empeorando";
    };
  };
}

export default function MonthChangesModal({ isOpen, onClose, cambios }: MonthChangesModalProps) {
  if (!isOpen) return null;

  const { nutricion, entrenamiento, cambioFase } = cambios;
  
  // Calcular cambios porcentuales
  const cambioCaloriasPct = ((nutricion.caloriasNueva - nutricion.caloriasAnterior) / nutricion.caloriasAnterior * 100);
  
  // Extraer gramos de los strings de macros
  const extraerGramos = (str: string): number => {
    const match = str.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };
  
  const proteinasAnt = extraerGramos(nutricion.macrosAnterior.proteinas);
  const proteinasNue = extraerGramos(nutricion.macrosNuevo.proteinas);
  const carbosAnt = extraerGramos(nutricion.macrosAnterior.carbohidratos);
  const carbosNue = extraerGramos(nutricion.macrosNuevo.carbohidratos);
  const grasasAnt = extraerGramos(nutricion.macrosAnterior.grasas);
  const grasasNue = extraerGramos(nutricion.macrosNuevo.grasas);
  
  const diffProteinas = proteinasNue - proteinasAnt;
  const diffCarbos = carbosNue - carbosAnt;
  const diffGrasas = grasasNue - grasasAnt;

  const getColorFase = (fase: string) => {
    if (fase === "BULK") return { bg: "from-[var(--phase-bulk)]/20", text: "text-[var(--phase-bulk)]", icon: "🔥" };
    if (fase === "CUT") return { bg: "from-[var(--phase-cut)]/20", text: "text-[var(--phase-cut)]", icon: "✂️" };
    if (fase === "LEAN_BULK") return { bg: "from-[var(--phase-lean-bulk)]/20", text: "text-[var(--phase-lean-bulk)]", icon: "💎" };
    return { bg: "from-[var(--phase-maintenance)]/20", text: "text-[var(--phase-maintenance)]", icon: "⚖️" };
  };

  const colorFaseAnterior = getColorFase(cambios.faseAnterior);
  const colorFaseNueva = getColorFase(cambios.faseNueva);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-black/95 p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold mb-1">
              {cambioFase ? "🔄 ¡Cambio de Fase!" : "📈 Nuevo Mes Generado"}
            </h2>
            <p className="text-sm opacity-70">
              Resumen de cambios: Mes {cambios.mesAnterior} → Mes {cambios.mesNuevo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cambio de Fase (si aplica) */}
        {cambioFase && (
          <div
            className="mb-6 p-4 rounded-xl border border-white/20"
            style={{
              background: `linear-gradient(to right, color-mix(in oklab, ${colorFaseAnterior.text.replace("text-[", "").replace("]", "")} 15%, transparent), color-mix(in oklab, ${colorFaseNueva.text.replace("text-[", "").replace("]", "")} 15%, transparent))`,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{colorFaseAnterior.icon}</span>
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-3xl">{colorFaseNueva.icon}</span>
            </div>
            <p className="text-lg font-semibold mb-1">
              <span className={colorFaseAnterior.text}>{cambios.faseAnterior}</span>
              {" → "}
              <span className={colorFaseNueva.text}>{cambios.faseNueva}</span>
            </p>
            <p className="text-sm opacity-80">
              Has completado la fase de {cambios.faseAnterior}. Ahora comienza tu fase de {cambios.faseNueva}.
            </p>
          </div>
        )}

        {/* Resumen de Progreso del Usuario */}
        {cambios.progresoUsuario && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-mid)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] border border-[color-mix(in_oklab,var(--brand-mid)_30%,transparent)]">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📊</span>
              <span>Tu Progreso hasta ahora</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Progreso de peso */}
              <div>
                <p className="text-xs opacity-70 mb-2">Evolución de peso:</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-60">Inicial:</span>
                    <span className="font-medium">{cambios.progresoUsuario.pesoInicial} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-60">Actual:</span>
                    <span className="font-display font-semibold text-lg">{cambios.progresoUsuario.pesoActual} kg</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-60">Objetivo:</span>
                    <span className="font-medium">{cambios.progresoUsuario.pesoObjetivo} kg</span>
                  </div>
                  
                  {/* Barra de progreso hacia objetivo */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs opacity-60">Progreso hacia meta:</span>
                      <span className="text-xs font-semibold">{cambios.progresoUsuario.porcentajeHaciaObjetivo.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-mid)] to-[var(--brand-end)] transition-all"
                        style={{ width: `${Math.min(100, cambios.progresoUsuario.porcentajeHaciaObjetivo)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-2 p-2 rounded bg-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="opacity-70">Cambio total:</span>
                      <span className={`font-semibold ${cambios.progresoUsuario.cambioPesoTotal > 0 ? 'text-success' : 'text-warning'}`}>
                        {cambios.progresoUsuario.cambioPesoTotal > 0 ? '+' : ''}{cambios.progresoUsuario.cambioPesoTotal.toFixed(1)} kg
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="opacity-70">Último mes:</span>
                      <span className={`font-semibold ${cambios.progresoUsuario.cambioPesoUltimoMes > 0 ? 'text-success' : 'text-warning'}`}>
                        {cambios.progresoUsuario.cambioPesoUltimoMes > 0 ? '+' : ''}{cambios.progresoUsuario.cambioPesoUltimoMes.toFixed(1)} kg
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Métricas de desempeño */}
              <div>
                <p className="text-xs opacity-70 mb-2">Desempeño general:</p>
                <div className="space-y-3">
                  {/* Meses completados */}
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm opacity-70">Progreso del plan:</span>
                      <span className="text-sm font-semibold">
                        {cambios.progresoUsuario.mesesCompletados} de {cambios.progresoUsuario.totalMeses} meses
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]"
                        style={{ width: `${(cambios.progresoUsuario.mesesCompletados / cambios.progresoUsuario.totalMeses) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Adherencia promedio */}
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm opacity-70">Adherencia promedio:</span>
                      <span className={`text-sm font-semibold ${
                        cambios.progresoUsuario.adherenciaPromedio >= 80 ? 'text-success' :
                        cambios.progresoUsuario.adherenciaPromedio >= 70 ? 'text-info' :
                        cambios.progresoUsuario.adherenciaPromedio >= 50 ? 'text-warning' :
                        'text-warning'
                      }`}>
                        {cambios.progresoUsuario.adherenciaPromedio.toFixed(0)}%
                      </span>
                    </div>
                    {cambios.progresoUsuario.adherenciaPromedio >= 80 && (
                      <p className="text-xs text-success mt-1">¡Excelente consistencia! 🌟</p>
                    )}
                  </div>
                  
                  {/* Tendencias */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="opacity-70">Energía:</span>
                      <span className={`flex items-center gap-1 ${
                        cambios.progresoUsuario.tendenciaEnergia === 'mejorando' ? 'text-success' :
                        cambios.progresoUsuario.tendenciaEnergia === 'empeorando' ? 'text-warning' :
                        'text-info'
                      }`}>
                        {cambios.progresoUsuario.tendenciaEnergia === 'mejorando' && '↑ Mejorando'}
                        {cambios.progresoUsuario.tendenciaEnergia === 'estable' && '→ Estable'}
                        {cambios.progresoUsuario.tendenciaEnergia === 'empeorando' && '↓ Bajando'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="opacity-70">Recuperación:</span>
                      <span className={`flex items-center gap-1 ${
                        cambios.progresoUsuario.tendenciaRecuperacion === 'mejorando' ? 'text-success' :
                        cambios.progresoUsuario.tendenciaRecuperacion === 'empeorando' ? 'text-warning' :
                        'text-info'
                      }`}>
                        {cambios.progresoUsuario.tendenciaRecuperacion === 'mejorando' && '↑ Mejorando'}
                        {cambios.progresoUsuario.tendenciaRecuperacion === 'estable' && '→ Estable'}
                        {cambios.progresoUsuario.tendenciaRecuperacion === 'empeorando' && '↓ Bajando'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje motivacional basado en progreso */}
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-mid)_20%,transparent)] to-[color-mix(in_oklab,var(--brand-end)_20%,transparent)] border border-[color-mix(in_oklab,var(--brand-mid)_35%,transparent)]">
              <p className="text-sm text-center">
                {cambios.progresoUsuario.porcentajeHaciaObjetivo >= 80 
                  ? "🎉 ¡Estás muy cerca de tu objetivo! Sigue con esta consistencia."
                  : cambios.progresoUsuario.porcentajeHaciaObjetivo >= 50
                  ? "💪 ¡Vas por la mitad! Tu dedicación está dando resultados."
                  : cambios.progresoUsuario.porcentajeHaciaObjetivo >= 25
                  ? "🚀 ¡Gran comienzo! Cada mes te acerca más a tu meta."
                  : "🌟 Acabas de empezar tu transformación. ¡El camino será increíble!"}
              </p>
            </div>
          </div>
        )}

        {/* Razón de los cambios */}
        {cambios.razonCambios && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--info-soft)] border border-[var(--info)]/30">
            <h3 className="font-display text-sm font-semibold mb-2 text-info">💡 ¿Por qué estos cambios?</h3>
            <p className="text-sm opacity-90">{cambios.razonCambios}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Cambios en Nutrición */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🍽️</span>
              <span>Nutrición</span>
            </h3>

            {/* Calorías */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-70">Calorías diarias:</span>
                <CambioIndicator valor={nutricion.diferenciaCalorias} unidad=" kcal" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-60">{nutricion.caloriasAnterior} kcal</span>
                <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="font-semibold">{nutricion.caloriasNueva} kcal</span>
              </div>
              {Math.abs(cambioCaloriasPct) >= 1 && (
                <p className="text-xs opacity-60 mt-1">
                  {cambioCaloriasPct > 0 ? 'Aumento' : 'Reducción'} del {Math.abs(cambioCaloriasPct).toFixed(1)}%
                </p>
              )}
            </div>

            {/* Macronutrientes */}
            <div className="space-y-3">
              <p className="text-sm font-medium opacity-70">Macronutrientes:</p>
              
              {/* Proteínas */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Proteínas:</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm opacity-60">{nutricion.macrosAnterior.proteinas}</span>
                  <svg className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold">{nutricion.macrosNuevo.proteinas}</span>
                  <CambioIndicator valor={diffProteinas} unidad="g" />
                </div>
              </div>

              {/* Carbohidratos */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Carbohidratos:</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm opacity-60">{nutricion.macrosAnterior.carbohidratos}</span>
                  <svg className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold">{nutricion.macrosNuevo.carbohidratos}</span>
                  <CambioIndicator valor={diffCarbos} unidad="g" />
                </div>
              </div>

              {/* Grasas */}
              <div className="flex items-center justify-between">
                <span className="text-sm">Grasas:</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm opacity-60">{nutricion.macrosAnterior.grasas}</span>
                  <svg className="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm font-semibold">{nutricion.macrosNuevo.grasas}</span>
                  <CambioIndicator valor={diffGrasas} unidad="g" />
                </div>
              </div>
            </div>
          </div>

          {/* Cambios en Entrenamiento */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <span>💪</span>
              <span>Entrenamiento</span>
            </h3>

            {/* Días de gym */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-70">Días de entrenamiento:</span>
                <CambioIndicator 
                  valor={entrenamiento.diasGymNuevo - entrenamiento.diasGymAnterior} 
                  unidad=" días/semana" 
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-60">{entrenamiento.diasGymAnterior} días/semana</span>
                <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="font-semibold">{entrenamiento.diasGymNuevo} días/semana</span>
              </div>
            </div>

            {/* Volumen de entrenamiento */}
            <div className="mb-4 p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">Volumen total:</span>
                <span className={`text-sm font-semibold ${
                  entrenamiento.cambioVolumen === "aumentado" ? "text-success" :
                  entrenamiento.cambioVolumen === "reducido" ? "text-warning" :
                  "text-info"
                }`}>
                  {entrenamiento.cambioVolumen === "aumentado" && "↑ Aumentado"}
                  {entrenamiento.cambioVolumen === "reducido" && "↓ Reducido"}
                  {entrenamiento.cambioVolumen === "mantenido" && "= Mantenido"}
                </span>
              </div>
              {entrenamiento.ejerciciosNuevos > 0 && (
                <p className="text-xs opacity-70">
                  +{entrenamiento.ejerciciosNuevos} ejercicios nuevos este mes
                </p>
              )}
            </div>

            {/* Descripción de cambios */}
            {entrenamiento.descripcionCambios && (
              <div className="text-sm opacity-80 italic">
                {entrenamiento.descripcionCambios}
              </div>
            )}
          </div>

          {/* Ajustes aplicados */}
          {cambios.ajustesAplicados && cambios.ajustesAplicados.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--warning-soft)] border border-[var(--warning)]/30">
              <h3 className="font-display text-sm font-semibold mb-3 text-warning">
                🎯 Ajustes aplicados basados en tus resultados:
              </h3>
              <ul className="space-y-2">
                {cambios.ajustesAplicados.map((ajuste, idx) => (
                  <li key={idx} className="text-sm opacity-90 flex items-start gap-2">
                    <span className="text-warning mt-0.5">•</span>
                    <span>{ajuste}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resumen motivacional */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-start)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-end)_10%,transparent)] border border-[color-mix(in_oklab,var(--brand-mid)_30%,transparent)] text-center">
            <p className="text-sm font-medium mb-2">
              {cambioFase 
                ? `¡Felicidades! Has completado la fase ${cambios.faseAnterior}. Es momento de comenzar tu fase ${cambios.faseNueva}.`
                : `Tu plan ha sido ajustado según tus resultados del mes ${cambios.mesAnterior}. ¡Sigue así!`}
            </p>
            <p className="text-xs opacity-70">
              Los cambios se basan en tu progreso, adherencia y feedback del mes anterior.
            </p>
          </div>
        </div>

        {/* Botón continuar */}
        <button
          onClick={onClose}
          className="w-full mt-6 px-6 py-3 rounded-lg bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-mid)] to-[var(--brand-end)] text-accent-ink font-medium transition-all hover:brightness-110 shadow-lg"
        >
          Entendido, continuar con el Mes {cambios.mesNuevo}
        </button>
      </motion.div>
    </div>
  );
}

