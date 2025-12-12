/**
 * Script para eliminar documentos duplicados en exercise_weights
 * Mantiene solo el documento más reciente de cada grupo duplicado
 * 
 * Ejecutar con: node scripts/delete-duplicate-weights.js
 * 
 * Para confirmar, edita este archivo y cambia CONFIRM_DELETE a true
 */

// Cargar variables de entorno desde .env.local si existe
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv no está instalado, usar variables de entorno del sistema
}

const CONFIRM_DELETE = false; // ⚠️ Cambia a true para confirmar la eliminación

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function deleteDuplicates() {
  if (!CONFIRM_DELETE) {
    console.log("⚠️  ADVERTENCIA: Este script eliminará documentos duplicados");
    console.log("📝 Para confirmar, edita el archivo y cambia CONFIRM_DELETE a true\n");
    console.log("   Archivo: scripts/delete-duplicate-weights.js");
    console.log("   Línea: const CONFIRM_DELETE = false;");
    console.log("   Cambiar a: const CONFIRM_DELETE = true;\n");
    process.exit(0);
  }

  console.log("🔍 Buscando y eliminando documentos duplicados...\n");

  try {
    // Inicializar Firebase Admin
    let app;
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

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
    
    console.log(`📊 Total de documentos: ${snapshot.size}\n`);

    // Agrupar por combinación única
    const groups = new Map();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const key = `${data.userId}_${data.planId}_${data.exerciseName}_${data.week}_${data.day}_${data.dayIndex}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      // Obtener fecha para ordenar (usar updatedAt o createdAt o date)
      let dateValue = null;
      if (data.updatedAt) {
        dateValue = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
      } else if (data.createdAt) {
        dateValue = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      } else if (data.date) {
        dateValue = new Date(data.date);
      }
      
      groups.get(key).push({
        id: doc.id,
        date: dateValue,
        ref: doc.ref,
      });
    });

    // Encontrar duplicados y eliminar los más antiguos
    const toDelete = [];
    let duplicatesFound = 0;

    groups.forEach((docs, key) => {
      if (docs.length > 1) {
        duplicatesFound++;
        // Ordenar por fecha (más reciente primero)
        docs.sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date - a.date;
        });

        // Mantener el primero (más reciente), eliminar el resto
        for (let i = 1; i < docs.length; i++) {
          toDelete.push(docs[i].ref);
        }

        const [userId, planId, exerciseName, week, day, dayIndex] = key.split('_');
        console.log(`📌 Duplicados encontrados: ${exerciseName} - Semana ${week}, ${day}`);
        console.log(`   Manteniendo: ${docs[0].id.substring(0, 20)}... (más reciente)`);
        console.log(`   Eliminando: ${docs.length - 1} documento(s) antiguo(s)\n`);
      }
    });

    if (toDelete.length === 0) {
      console.log("✅ No se encontraron duplicados.\n");
      process.exit(0);
    }

    console.log(`\n🗑️  Eliminando ${toDelete.length} documento(s) duplicado(s)...\n`);

    // Eliminar en lotes de 500
    const batchSize = 500;
    let deleted = 0;
    let batch = db.batch();
    let count = 0;

    for (const ref of toDelete) {
      batch.delete(ref);
      count++;
      deleted++;

      if (count >= batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`   Eliminados: ${deleted}/${toDelete.length}`);
      }
    }

    // Eliminar el último lote si hay documentos restantes
    if (count > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Eliminación completada: ${deleted} documentos duplicados eliminados.`);
    console.log(`📊 Resumen:`);
    console.log(`   - Grupos con duplicados: ${duplicatesFound}`);
    console.log(`   - Documentos eliminados: ${deleted}`);
    console.log(`   - Documentos mantenidos: ${snapshot.size - deleted}\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteDuplicates();
