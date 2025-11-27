# Sistema de Continuidad de Planes

## 📋 Descripción

Sistema inteligente de seguimiento y continuidad automática para **todos los objetivos simples** (no multi-fase), que permite a los usuarios completar un plan de 30 días y recibir automáticamente una sugerencia personalizada del siguiente plan basada en sus resultados reales.

## ✨ Características principales

### 1. **Detección automática de planes completados**
- Detecta planes al **90-100%** de progreso
- Muestra banner de continuidad en dashboard y página del plan
- Solo para planes simples (excluye planes multi-fase como bulk_cut y lean_bulk)

### 2. **Análisis inteligente con OpenAI**
- Analiza resultados físicos (peso, medidas)
- Evalúa adherencia a comida y entrenamiento
- Considera energía, recuperación y lesiones
- Compara objetivo vs resultado obtenido

### 3. **Sugerencia de continuidad personalizada**
- **Objetivo recomendado** basado en resultados
- **Ajustes de calorías** (aumentar/mantener/reducir)
- **Ajustes de macros** (proteína, carbohidratos, grasas)
- **Ajustes de entrenamiento** (días, intensidad)
- **Mensaje motivacional** personalizado

### 4. **Opciones alternativas**
- Si el usuario no está de acuerdo con la sugerencia principal
- Muestra 2-3 objetivos alternativos con razones claras
- Permite elegir libremente qué objetivo seguir

### 5. **Generación automática del siguiente plan**
- Genera el plan con el objetivo seleccionado
- Aplica ajustes recomendados automáticamente
- Guarda referencia al plan anterior
- Marca el plan anterior como completado

## 🔧 Componentes implementados

### API Endpoints

#### `/api/analyzePlanCompletion`
Analiza los resultados de un plan completado y genera sugerencias de continuidad.

**Request:**
```json
{
  "pesoInicial": 80,
  "pesoFinal": 75,
  "cinturaInicial": 95,
  "cinturaFinal": 88,
  "objetivo": "perder_grasa",
  "adherenciaComida": ">80%",
  "adherenciaEntreno": "70-80%",
  "energia": "normal",
  "recuperacion": "buena",
  "lesionesNuevas": "Dolor de rodilla leve",
  "comentarios": "Me sentí muy bien, pero me gustaría más variedad"
}
```

**Response:**
```json
{
  "analisis": {
    "cumplioObjetivo": true,
    "progresoGeneral": "excelente",
    "puntosPositivos": ["Pérdida de peso saludable...", "Excelente adherencia..."],
    "areasMejora": ["Considera revisar la rodilla..."],
    "resumen": "Has logrado tus objetivos exitosamente..."
  },
  "sugerenciaContinuidad": {
    "objetivoRecomendado": "definicion",
    "razonObjetivo": "Has perdido grasa exitosamente, ahora es momento de...",
    "ajustesCalorias": "-100",
    "ajustesMacros": {
      "proteinas": "aumentar",
      "carbohidratos": "mantener",
      "grasas": "reducir"
    },
    "ajustesEntrenamiento": {
      "diasGym": "aumentar",
      "intensidad": "aumentar",
      "recomendacion": "Considera agregar un día extra de hipertrofia..."
    },
    "mensajeMotivacional": "¡Felicidades! Has demostrado gran consistencia..."
  },
  "objetivosAlternativos": [
    {
      "objetivo": "recomposicion",
      "razon": "Si prefieres mantener el peso actual pero mejorar composición...",
      "adecuadoPara": "Personas que ya están en un peso saludable..."
    }
  ]
}
```

### Components

#### `<PlanContinuityModal />`
Modal principal que maneja todo el flujo de continuidad.

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `planData`: { id, plan, user, createdAt }
- `registrosPeso`: Array<{ fecha, peso }>
- `userId`: string

**Flujo:**
1. **Input**: Usuario ingresa datos finales (peso, adherencia, energía, etc.)
2. **Analyzing**: Se envía a OpenAI para análisis
3. **Suggestion**: Muestra análisis y sugerencia, permite elegir alternativas
4. **Generating**: Genera el nuevo plan
5. **Complete**: Redirige al nuevo plan

### Dashboard Integration

**Banner de continuidad:**
```tsx
// Aparece automáticamente cuando un plan llega al 90-100%
{!plan.planMultiFase && progress >= 90 && (
  <button onClick={() => setContinuityModalOpen(true)}>
    Generar siguiente plan
  </button>
)}
```

### Plan Page Integration

**Banner en página del plan:**
```tsx
// Similar al banner del dashboard pero integrado en la vista del plan
{!planMultiFase && progress >= 90 && (
  <ContinuityBanner />
)}
```

## 📊 Datos guardados

### En el plan anterior (completado):
```javascript
{
  datosFinalizacion: {
    pesoFinal: 75,
    cinturaFinal: 88,
    adherenciaComida: ">80%",
    adherenciaEntreno: "70-80%",
    energia: "normal",
    recuperacion: "buena",
    lesionesNuevas: "Dolor rodilla leve",
    comentarios: "...",
    fechaFinalizacion: "2025-01-15T10:30:00Z"
  },
  analisis: {
    cumplioObjetivo: true,
    progresoGeneral: "excelente",
    ...
  },
  completado: true
}
```

### En el nuevo plan:
```javascript
{
  planAnteriorId: "abc123",
  esContinuacion: true,
  // ... resto del plan normal
}
```

## 🎯 Objetivos soportados

Todos los objetivos simples:
- `perder_grasa`
- `mantener`
- `ganar_masa`
- `recomposicion`
- `definicion`
- `volumen`
- `corte`
- `mantenimiento_avanzado`
- `rendimiento_deportivo`
- `powerlifting`
- `resistencia`
- `atleta_elite`

**Excluidos:** `bulk_cut` y `lean_bulk` (ya tienen su propio sistema multi-fase)

## 🚀 Cómo usar

### Para el usuario:

1. **Durante el plan:**
   - Registra tu peso regularmente en el modal de progreso
   - Completa tu plan de 30 días

2. **Al 90% de progreso:**
   - Aparecerá un banner verde en dashboard y en el plan
   - Click en "Generar siguiente plan"

3. **Completa tus datos finales:**
   - Peso final (obligatorio)
   - Cintura final (opcional)
   - Adherencia a comida y entrenamiento
   - Nivel de energía y recuperación
   - Lesiones nuevas (si las hay)
   - Comentarios adicionales

4. **Revisa el análisis:**
   - Lee tu análisis de resultados
   - Revisa la sugerencia principal
   - O elige un objetivo alternativo

5. **Genera tu nuevo plan:**
   - Click en "Aceptar y generar" para la sugerencia
   - O selecciona una alternativa y genera con ese objetivo
   - Espera mientras se genera (20-40 segundos)
   - Serás redirigido automáticamente al nuevo plan

### Para desarrolladores:

**Agregar nuevos campos al análisis:**
```typescript
// En analyzePlanCompletion.ts
interface AnalysisData {
  // Agregar nuevo campo aquí
  nuevoMetrico?: number;
}

// Actualizar el prompt
const prompt = `
...
${data.nuevoMetrico ? `- Nuevo métrico: ${data.nuevoMetrico}` : ''}
...
`;
```

**Personalizar ajustes automáticos:**
```typescript
// En PlanContinuityModal.tsx
if (usarSugerencia) {
  // Aplicar ajustes personalizados
  const ajusteGym = analysis.sugerenciaContinuidad.ajustesEntrenamiento.diasGym;
  if (ajusteGym === "aumentar") {
    nuevoUserInput.diasGym = Math.min(7, nuevoUserInput.diasGym + 1);
  }
}
```

## 📈 Mejoras futuras

- [ ] Agregar gráficos de evolución multi-plan
- [ ] Historial completo de todos los planes del usuario
- [ ] Comparación de progreso entre planes
- [ ] Predicción de resultados futuros con ML
- [ ] Notificaciones push cuando el plan esté por completarse
- [ ] Exportar análisis completo en PDF
- [ ] Sistema de badges/logros por planes completados

## 🔍 Testing

**Escenario 1: Plan exitoso**
```
Peso inicial: 80kg → Final: 75kg
Objetivo: perder_grasa
Resultado: ✅ Cumplió (pérdida de 5kg en 30 días)
Sugerencia: Continuar con "definicion" o "mantener"
```

**Escenario 2: Plan parcialmente exitoso**
```
Peso inicial: 80kg → Final: 79kg
Objetivo: perder_grasa
Adherencia: 50-70%
Resultado: ⚠️ Progreso lento
Sugerencia: Repetir "perder_grasa" con mejor adherencia
```

**Escenario 3: Plan no cumplido**
```
Peso inicial: 80kg → Final: 82kg
Objetivo: perder_grasa
Energía: muy_baja
Resultado: ❌ No cumplió
Sugerencia: Revisar calorías, posible problema metabólico
```

## 💡 Notas técnicas

- El análisis usa **GPT-4o** para garantizar calidad y contexto
- Tiempo estimado de análisis: **5-10 segundos**
- Tiempo estimado de generación: **20-40 segundos**
- Los datos se guardan en **Firestore** con referencia al plan anterior
- Compatible con **localStorage** como fallback si Firestore falla
- Responsive design para móvil y desktop

---

**Desarrollado con:** Next.js, TypeScript, OpenAI GPT-4o, Firebase/Firestore, Framer Motion


