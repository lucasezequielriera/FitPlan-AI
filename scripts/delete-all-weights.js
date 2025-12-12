/**
 * Script para ELIMINAR TODOS los datos de exercise_weights
 * ⚠️  ADVERTENCIA: Esto eliminará TODOS los pesos guardados permanentemente
 * 
 * Ejecutar con: node scripts/delete-all-weights.js
 * 
 * Para confirmar, edita este archivo y cambia CONFIRM_DELETE a true
 */

// Cargar variables de entorno desde .env.local si existe
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv no está instalado, usar variables de entorno del sistema
}

const CONFIRM_DELETE = true; // ⚠️ Cambia a true para confirmar la eliminación

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function deleteAllWeights() {
  if (!CONFIRM_DELETE) {
    console.log("⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de exercise_weights");
    console.log("📝 Para confirmar, edita el archivo y cambia CONFIRM_DELETE a true\n");
    console.log("   Archivo: scripts/delete-all-weights.js");
    console.log("   Línea: const CONFIRM_DELETE = false;");
    console.log("   Cambiar a: const CONFIRM_DELETE = true;\n");
    process.exit(0);
  }

  console.log("🗑️  Eliminando TODOS los datos de exercise_weights...\n");

  try {
    // Inicializar Firebase Admin
    let app;
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const projectId = process.env.FIREBASE_PROJECT_ID;

      if (!privateKey || !clientEmail || !projectId) {
        console.error("❌ Variables de entorno faltantes. Configura:");
        console.error("   - FIREBASE_ADMIN_PRIVATE_KEY");
        console.error("   - FIREBASE_ADMIN_CLIENT_EMAIL");
        console.error("   - NEXT_PUBLIC_FIREBASE_PROJECT_ID");
        process.exit(1);
      }

      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    const db = getFirestore(app);

    // Obtener todos los documentos
    const snapshot = await db.collection('exercise_weights').get();
    
    console.log(`📊 Documentos encontrados: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log("✅ No hay documentos para eliminar.\n");
      process.exit(0);
    }

    // Eliminar en lotes de 500 (límite de Firestore)
    const batchSize = 500;
    let deleted = 0;
    let batch = db.batch();
    let count = 0;

    console.log("\n🗑️  Eliminando documentos...");

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      deleted++;

      if (count >= batchSize) {
        batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`   Eliminados: ${deleted}/${snapshot.size}`);
      }
    });

    // Eliminar el último lote si hay documentos restantes
    if (count > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Eliminación completada: ${deleted} documentos eliminados.\n`);

    // Verificar que se eliminaron todos
    const verifySnapshot = await db.collection('exercise_weights').get();
    if (verifySnapshot.empty) {
      console.log("✅ Verificación: Todos los documentos fueron eliminados correctamente.\n");
    } else {
      console.log(`⚠️  Advertencia: Aún quedan ${verifySnapshot.size} documentos. Ejecuta el script nuevamente.\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteAllWeights();
