# Modal de Cambios Entre Meses - Planes Multi-Fase

## 📋 Descripción

Modal automático que se muestra **después de generar el siguiente mes** en planes multi-fase (bulk_cut, lean_bulk). Presenta un resumen visual claro de todos los cambios aplicados entre el mes anterior y el nuevo mes.

## ✨ ¿Qué muestra el modal?

### 1. **Cambio de Fase (si aplica)**
```
🔥 BULK  →  ✂️ CUT
```
- Icono y color de fase anterior → fase nueva
- Mensaje explicativo del cambio de fase
- Banner destacado con colores de la nueva fase

### 2. **Cambios en Nutrición** 🍽️

#### **Calorías:**
```
2800 kcal  →  2650 kcal  ↓ -150 kcal
Reducción del 5.4%
```
- Valor anterior vs nuevo
- Diferencia absoluta con flecha indicadora
- Porcentaje de cambio

#### **Macronutrientes:**
```
Proteínas:      160g  →  170g   ↑ +10g
Carbohidratos:  350g  →  320g   ↓ -30g
Grasas:          90g  →   85g   ↓ -5g
```
- Cada macro con su cambio individual
- Indicadores visuales:
  - ↑ Verde = Aumentado
  - ↓ Naranja = Reducido
  - = Azul = Mantenido

### 3. **Cambios en Entrenamiento** 💪

#### **Días de entrenamiento:**
```
4 días/semana  →  5 días/semana  ↑ +1 día/semana
```

#### **Volumen total:**
```
↑ Aumentado
+3 ejercicios nuevos este mes
```
- Estado: Aumentado / Reducido / Mantenido
- Conteo de ejercicios nuevos

#### **Descripción:**
```
"Se ha incrementado el volumen de entrenamiento para 
progresar según tus capacidades actuales."
```

### 4. **Ajustes Aplicados** 🎯

Lista de todos los ajustes automáticos que se aplicaron basados en el feedback del mes anterior:

```
• Aumentar calorías +150-200 kcal (ganancia muy lenta)
• Considerar subir carbohidratos o revisar sueño/estrés
• Agregar ejercicio de movilidad para lesión: Dolor de rodilla
```

### 5. **Razón de los Cambios** 💡

Explicación del por qué se hicieron estos ajustes:

```
"Los ajustes se realizaron para optimizar tu progreso 
basándose en los resultados del mes anterior."
```

O si es cambio de fase:

```
"Cambio de fase automático según tu plan multi-fase. Tu fase 
BULK ha finalizado y ahora comienza la fase CUT."
```

## 🎨 Diseño Visual

### **Indicadores de cambio:**
- **Verde** ↑ = Aumento (calorías, macros, días de gym)
- **Naranja** ↓ = Reducción
- **Azul** = = Mantenido (sin cambio significativo)

### **Colores por fase:**
- **BULK**: Ámbar/Naranja 🔥
- **CUT**: Cyan/Azul ✂️
- **LEAN_BULK**: Esmeralda/Verde 💎
- **MANTENIMIENTO**: Púrpura ⚖️

## 🔧 Implementación Técnica

### **Cuándo se muestra:**
- Automáticamente al completar la generación del siguiente mes
- Después de cerrar el modal de "Generar Siguiente Mes"
- Solo para planes multi-fase

### **Datos que calcula:**

```typescript
{
  mesAnterior: 1,
  mesNuevo: 2,
  faseAnterior: "LEAN_BULK",
  faseNueva: "LEAN_BULK",
  cambioFase: false,
  
  nutricion: {
    caloriasAnterior: 2800,
    caloriasNueva: 2950,
    diferenciaCalorias: +150,
    macrosAnterior: { proteinas: "160g", carbohidratos: "350g", grasas: "90g" },
    macrosNuevo: { proteinas: "170g", carbohidratos: "365g", grasas: "95g" },
    cambioMacros: {
      proteinas: +10,
      carbohidratos: +15,
      grasas: +5
    }
  },
  
  entrenamiento: {
    diasGymAnterior: 4,
    diasGymNuevo: 5,
    cambioVolumen: "aumentado",
    ejerciciosNuevos: 3,
    descripcionCambios: "Se ha incrementado el volumen..."
  },
  
  ajustesAplicados: [
    "Aumentar calorías +150-200 kcal (ganancia muy lenta)",
    "Considerar subir carbohidratos o revisar sueño/estrés"
  ],
  
  razonCambios: "Los ajustes se realizaron para..."
}
```

### **Flujo completo:**

```
Usuario llega al 90-100% del Mes 1
↓
Click en "Preparar mes 2 de 20"
↓
Modal 1: Ingresa datos del mes completado (peso, adherencia, etc.)
↓
Click en "Generar Mes 2"
↓
Sistema genera el nuevo mes (20-40 segundos)
↓
Modal 2: MUESTRA CAMBIOS (nuevo)
↓
Usuario ve qué se ajustó automáticamente
↓
Click en "Entendido, continuar con el Mes 2"
↓
Modal se cierra, usuario ve su nuevo plan
```

## 📊 Ejemplos de uso

### **Ejemplo 1: Mismo fase, ajuste de calorías**
```
Mes 1 → Mes 2 (LEAN_BULK → LEAN_BULK)

📈 Nuevo Mes Generado
Resumen de cambios: Mes 1 → Mes 2

🍽️ Nutrición:
  Calorías: 2800 kcal → 2950 kcal ↑ +150 kcal (5.4%)
  Proteínas: 160g → 170g ↑ +10g
  Carbohidratos: 350g → 365g ↑ +15g
  Grasas: 90g → 95g ↑ +5g

💪 Entrenamiento:
  Días: 4 → 5 ↑ +1 día/semana
  Volumen: ↑ Aumentado
  +2 ejercicios nuevos

🎯 Ajustes aplicados:
  • Aumentar calorías +150-200 kcal (ganancia lenta)
  • Aumentar volumen de entrenamiento

💡 Razón: Los ajustes se realizaron para optimizar tu 
progreso basándose en los resultados del mes anterior.
```

### **Ejemplo 2: Cambio de fase BULK → CUT**
```
🔄 ¡Cambio de Fase!
Mes 6 → Mes 7

🔥 BULK  →  ✂️ CUT

Has completado la fase de BULK. Ahora comienza tu fase de CUT.

🍽️ Nutrición:
  Calorías: 3000 kcal → 2400 kcal ↓ -600 kcal (20%)
  Proteínas: 180g → 190g ↑ +10g
  Carbohidratos: 400g → 280g ↓ -120g
  Grasas: 95g → 80g ↓ -15g

💪 Entrenamiento:
  Días: 5 → 4 ↓ -1 día/semana
  Volumen: ↓ Reducido
  Enfoque en preservar músculo y definir

💡 Razón: Cambio de fase automático según tu plan 
multi-fase. Tu fase BULK ha finalizado y ahora 
comienza la fase CUT.
```

### **Ejemplo 3: Sin cambios (mantenimiento)**
```
Mes 3 → Mes 4 (BULK → BULK)

🍽️ Nutrición:
  Calorías: 2900 kcal → 2900 kcal = Mantenido
  Proteínas: 165g → 165g = Mantenido
  Carbohidratos: 360g → 360g = Mantenido
  Grasas: 92g → 92g = Mantenido

💪 Entrenamiento:
  Días: 4 → 4 = Mantenido
  Volumen: = Mantenido

💡 Razón: El plan se mantiene consistente con tu 
progreso actual. Continuarás con la misma estructura 
para consolidar adaptaciones.
```

## 🎯 Beneficios para el usuario

✅ **Transparencia total** - El usuario ve exactamente qué cambió  
✅ **Educación** - Aprende por qué se hacen los ajustes  
✅ **Motivación** - Ve su progreso reflejado en los cambios  
✅ **Control** - Puede revisar los cambios antes de continuar  
✅ **Contexto** - Entiende la lógica detrás de cada ajuste  

## 🔮 Mejoras futuras

- [ ] Exportar comparación en PDF
- [ ] Gráficos visuales de cambios (barras comparativas)
- [ ] Historial de cambios de todos los meses
- [ ] Predicción de cambios para el próximo mes
- [ ] Comparación con meses anteriores (no solo el último)

---

**Desarrollado con:** Next.js, TypeScript, Framer Motion  
✅ **100% funcional y listo para uso**



