# Sistema de Continuidad Mes a Mes para Planes Multi-Fase

## 📋 Descripción

Sistema de seguimiento **mes a mes** para planes multi-fase (bulk_cut y lean_bulk) que detecta automáticamente cuando cada mes del plan llega al 90-100% de progreso y permite generar el siguiente mes basado en los resultados del mes anterior.

## 🔄 Diferencia con Planes Simples

### **Planes Simples:**
- 1 plan = 30 días
- Al 90-100%: Genera un **nuevo plan completo** independiente
- Requiere análisis completo con IA

### **Planes Multi-Fase:**
- 1 plan = 6-12 meses (múltiples fases)
- Al 90-100% de **cada mes**: Genera el **siguiente mes** del mismo plan
- Mantiene contexto del progreso total
- Ajusta según resultados del mes anterior

## ✨ Funcionalidades implementadas

### 1. **Detección automática mes a mes**

**En el Dashboard:**
- Calcula progreso del mes actual (no del plan completo)
- Muestra barra de progreso del mes en curso
- Indica "Mes X completado" cuando llega al 90-100%
- Texto: "Abre el plan para generar el mes X+1"

**En la Página del Plan:**
- Banner grande y prominente cuando el mes está al 90-100%
- Cambia de color según la fase (BULK = ámbar, CUT = cyan, LEAN_BULK = esmeralda)
- Muestra barra de progreso del mes actual
- Botón destacado: "🚀 Generar Mes X"

### 2. **Detección de cambio de fase**

Cuando el siguiente mes implica cambiar de fase (ej: de BULK a CUT):
- Icono especial: 🔄
- Mensaje: "Es momento de cambiar a la fase CUT"
- Info adicional: "BULK → CUT"
- Color del botón cambia al de la nueva fase

### 3. **Modal de datos del mes completado**

Al hacer click en "Generar Mes X":

**Datos requeridos:**
- Peso actual (obligatorio)
- Cintura actual (opcional)
- Energía (muy baja → muy alta)
- Recuperación (mala → excelente)
- Adherencia a comidas (<50%, 50-70%, 70-80%, >80%)
- Adherencia a entrenamiento
- Lesiones nuevas (opcional)
- Comentarios adicionales

### 4. **Generación inteligente del siguiente mes**

**Ajustes automáticos basados en resultados:**

#### Si estás en BULK o LEAN_BULK:
```
Cambio de peso < 0.5kg → Aumentar calorías +150-200 kcal
Cambio de peso > 1.5kg → Reducir calorías -100-150 kcal (ganancia muy rápida)
```

#### Si estás en CUT:
```
Cambio de peso > -0.3kg → Aumentar déficit -150-200 kcal
Cambio de peso < -1.5kg → Reducir déficit +100-150 kcal (pérdida muy rápida)
```

#### Ajustes por energía:
```
Energía muy baja/baja → Subir carbohidratos
Si CUT → Considerar día de recarga 1x/semana
```

#### Ajustes por recuperación:
```
Recuperación mala/regular → Reducir volumen de entrenamiento
                         → Revisar proteína y sueño
```

#### Ajustes por adherencia:
```
Adherencia comida baja → Simplificar comidas, más flexibilidad
Adherencia entreno baja → Reducir días o duración de sesiones
```

### 5. **Historial completo**

Cada mes guardado incluye:
```javascript
{
  mesNumero: 2,
  faseEnEsteMes: "BULK",
  fechaGeneracion: "2025-11-25...",
  fechaFin: "2025-12-25...",
  
  datosAlIniciar: {
    peso: 75,
    cintura: 85,
    fechaRegistro: "2025-11-25..."
  },
  
  datosAlFinalizar: {
    peso: 76.5,
    cintura: 86,
    energia: "normal",
    recuperacion: "buena",
    adherenciaComida: ">80%",
    adherenciaEntreno: "70-80%",
    lesionesNuevas: null,
    comentarios: "Me sentí bien pero podría comer más",
    fechaRegistro: "2025-12-25..."
  },
  
  // Plan generado para este mes
  planAlimentacion: [...],
  caloriasObjetivo: 2800,
  macros: { proteinas: "160g", carbohidratos: "350g", grasas: "90g" },
  planEntrenamiento: {...},
  suplementos: [...],
  
  // Ajustes aplicados basados en el mes anterior
  ajustesAplicados: [
    "Aumentar calorías +150-200 kcal (ganancia muy lenta)",
    "Aumentar volumen de entrenamiento"
  ],
  
  dificultad: "media",
  mensajeMotivacional: "..."
}
```

## 📊 Ejemplo de flujo completo

### **Plan: Bulk+Cut de 8 meses**
```
Fase 1: BULK (Meses 1-6)
Fase 2: CUT (Meses 7-8)
```

### **Mes 1:**
- Usuario crea el plan → Mes 1 generado automáticamente
- Objetivo: Ganar masa en fase BULK
- Calorías: 2800 kcal
- Entrena durante 30 días

### **Día 27 del Mes 1 (90% completado):**
- ✅ Banner aparece: "Mes 1 casi completado (93%)"
- Botón: "Preparar Mes 2"

### **Día 30 del Mes 1 (100% completado):**
- ✅ Banner: "¡Mes 1 completado!"
- Botón: "🚀 Generar Mes 2"
- Usuario hace click

### **Modal de finalización del Mes 1:**
```
Datos ingresados:
- Peso inicial: 75kg → Peso final: 76kg (+1kg)
- Adherencia comida: >80%
- Adherencia entreno: 70-80%
- Energía: Alta
- Recuperación: Buena
- Comentarios: "Me sentí genial, podría comer un poco más"
```

### **Análisis automático:**
```
Cambio de peso: +1kg ✓ (ganancia adecuada para BULK)
Adherencia: Excelente
Energía/Recuperación: Óptimas

Ajustes para Mes 2:
✓ Mantener calorías (ganancia adecuada)
✓ Mantener volumen de entrenamiento
✓ Continuar en fase BULK
```

### **Mes 2 generado:**
- Calorías: 2800 kcal (mantenidas)
- Mismo objetivo: Fase BULK
- Plan actualizado con variedad en comidas
- Ejercicios progresados (más peso/reps)

### **Meses 3-6:**
- Mismo proceso cada mes
- Ajustes basados en progreso
- Continúa fase BULK

### **Día 30 del Mes 6:**
- Banner especial: **"🔄 Cambio de Fase"**
- Mensaje: "Es momento de cambiar a la fase CUT"
- Info: "BULK → CUT"
- Color del banner cambia de ámbar a cyan

### **Mes 7:**
- Nueva fase: CUT
- Objetivo cambia automáticamente a "corte"
- Calorías reducidas para déficit
- Plan de entrenamiento ajustado para preservar músculo

### **Día 30 del Mes 8:**
- Banner: "¡Plan completo finalizado!"
- No hay botón de "Generar Mes 9" (ya terminó)
- Usuario puede crear un nuevo plan multi-fase o simple

## 🎨 UI/UX por fase

### **Fase BULK:**
- Color: Ámbar/Naranja (🔥 energía, crecimiento)
- Icono: 🏋️
- Banner: Gradiente ámbar → naranja
- Botón: bg-amber-500

### **Fase CUT:**
- Color: Cyan/Azul (❄️ frescura, definición)
- Icono: ✂️
- Banner: Gradiente cyan → azul
- Botón: bg-cyan-500

### **Fase LEAN_BULK:**
- Color: Esmeralda/Verde (💎 balance, calidad)
- Icono: 💎
- Banner: Gradiente esmeralda → teal
- Botón: bg-emerald-500

## 🔧 Componentes técnicos

### **Cálculo de progreso del mes:**
```typescript
// Obtener fecha de inicio del mes actual del historial
const mesActualData = planMultiFase.historialMeses[mesActual - 1];
const fechaInicio = new Date(mesActualData.fechaGeneracion);

// Calcular días transcurridos
const now = new Date();
const diffTime = now.getTime() - fechaInicio.getTime();
const diffDays = diffTime / (1000 * 60 * 60 * 24);

// Progreso del mes (30 días)
const progress = Math.min(100, Math.max(0, (diffDays / 30) * 100));
```

### **Contexto pasado a generatePlan.ts:**
```typescript
{
  ...userInput,
  _contextoMultiFase: {
    mesActual: 2,
    totalMeses: 8,
    faseActual: "BULK",
    pesoInicial: 75,
    pesoObjetivoFinal: 85,
    ajustesRecomendados: [
      "Aumentar calorías +150 kcal",
      "Mantener volumen actual"
    ],
    feedbackUsuario: "Me sentí muy bien",
    cambiaFase: false
  }
}
```

## 📈 Ventajas del sistema

✅ **Continuidad perfecta** - No hay "cortes" entre meses, es un flujo continuo

✅ **Ajustes inteligentes** - Cada mes se optimiza basado en resultados reales

✅ **Cambios de fase suaves** - Transición automática entre BULK y CUT

✅ **Historial completo** - Guardas todos los datos de cada mes para análisis

✅ **Motivación constante** - El usuario ve su progreso mes a mes

✅ **Personalización dinámica** - El plan se adapta al usuario, no al revés

## 🎯 Comparación con sistema anterior

### **ANTES:**
- Usuario tenía botón "Generar Mes X" siempre visible
- No había indicación de cuándo generar
- No se mostraba progreso del mes actual
- Usuario podía generar siguiente mes en cualquier momento

### **AHORA:**
- Banner aparece solo al 90-100% del mes
- Indicación clara: "Mes X completado"
- Barra de progreso visual del mes
- Botón destacado y prominente
- Cambio de fase claramente indicado
- Usuario sabe exactamente cuándo continuar

## 🔮 Mejoras futuras

- [ ] Notificaciones push cuando un mes está por completarse
- [ ] Gráficos de evolución mes a mes (peso, medidas, fuerza)
- [ ] Comparación de adherencia entre meses
- [ ] Predicción de resultados finales basada en progreso actual
- [ ] Exportar historial completo en PDF
- [ ] Sistema de badges por meses completados
- [ ] Recordatorios automáticos para registrar datos

---

**Desarrollado con:** Next.js, TypeScript, OpenAI GPT-4o, Firebase/Firestore, Framer Motion

✅ **100% funcional y listo para producción**




