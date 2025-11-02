# ⚠️ IMPORTANTE: Actualizar Reglas de Firestore para Administrador

El error "Missing or insufficient permissions" ocurre porque las reglas de Firestore necesitan ser actualizadas.

## Pasos para solucionar:

1. **Ve a Firebase Console**: https://console.firebase.google.com/
2. **Selecciona tu proyecto**
3. **Ve a Firestore Database** > **Rules**
4. **Copia TODO el contenido** del archivo `REGLAS_ADMIN_FIRESTORE.txt`
5. **Pega las reglas** en el editor de reglas
6. **Haz clic en "Publish"**
7. **Espera 10-20 segundos** para que se propaguen

## Cambio importante:

Las reglas ahora incluyen una verificación `exists()` antes de intentar leer el documento, lo que evita errores cuando el usuario administrador aún no tiene documento en Firestore.

## Verificación:

Después de actualizar las reglas:
1. Cierra sesión
2. Inicia sesión con `admin@fitplan-ai.com`
3. Deberías poder acceder al panel de administración sin errores

Si aún tienes problemas, verifica que:
- El documento del usuario existe en Firestore con el email `admin@fitplan-ai.com`
- Las reglas se publicaron correctamente
- Estás usando el email correcto para iniciar sesión

