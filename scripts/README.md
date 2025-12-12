# Scripts de gestión de pesos de ejercicios

Scripts para verificar y limpiar datos de la colección `exercise_weights` en Firestore.

## Scripts disponibles

### 1. Verificar duplicados
```bash
npm run weights:check-duplicates
# o
node scripts/check-duplicate-weights.js
```

Este script muestra:
- Total de documentos
- Grupos con duplicados
- Detalles de cada duplicado (IDs, fechas, valores)
- Estadísticas generales

### 2. Eliminar TODOS los datos
```bash
npm run weights:delete-all
# o
node scripts/delete-all-weights.js
```

⚠️ **ADVERTENCIA**: Esto eliminará TODOS los pesos guardados permanentemente.

**Para usar:**
1. Edita `scripts/delete-all-weights.js`
2. Cambia `const CONFIRM_DELETE = false;` a `const CONFIRM_DELETE = true;`
3. Ejecuta el script

### 3. Eliminar solo duplicados
```bash
npm run weights:delete-duplicates
# o
node scripts/delete-duplicate-weights.js
```

Este script:
- Encuentra documentos duplicados (mismo usuario, plan, ejercicio, semana, día)
- Mantiene el documento más reciente de cada grupo
- Elimina los documentos antiguos

**Para usar:**
1. Edita `scripts/delete-duplicate-weights.js`
2. Cambia `const CONFIRM_DELETE = false;` a `const CONFIRM_DELETE = true;`
3. Ejecuta el script

## Configuración requerida

Los scripts necesitan estas variables de entorno (en `.env.local` o variables del sistema):

```
FIREBASE_ADMIN_PRIVATE_KEY=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

## Recomendación

1. Primero ejecuta `weights:check-duplicates` para ver qué hay
2. Si quieres empezar de cero, usa `weights:delete-all`
3. Si solo quieres limpiar duplicados, usa `weights:delete-duplicates`
