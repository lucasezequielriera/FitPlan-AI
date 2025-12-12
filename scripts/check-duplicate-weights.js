/**
 * Script para verificar documentos duplicados en exercise_weights
 * Ejecutar con: node scripts/check-duplicate-weights.js
 */

// Cargar variables de entorno desde .env.local si existe
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv no está instalado, usar variables de entorno del sistema
}

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function checkDuplicates() {
  console.log("🔍 Verificando documentos duplicados en exercise_weights...\n");

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

    // Agrupar por combinación única de userId, planId, exerciseName, week, day, dayIndex
    const groups = new Map();
    const duplicates = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const key = `${data.userId}_${data.planId}_${data.exerciseName}_${data.week}_${data.day}_${data.dayIndex}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push({
        id: doc.id,
        date: data.date,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        sets: data.sets,
        rm: data.rm,
      });
    });

    // Encontrar duplicados
    groups.forEach((docs, key) => {
      if (docs.length > 1) {
        duplicates.push({
          key,
          count: docs.length,
          documents: docs,
        });
      }
    });

    if (duplicates.length === 0) {
      console.log("✅ No se encontraron duplicados.\n");
    } else {
      console.log(`⚠️  Se encontraron ${duplicates.length} grupos con duplicados:\n`);
      
      duplicates.forEach((dup, index) => {
        const [userId, planId, exerciseName, week, day, dayIndex] = dup.key.split('_');
        console.log(`${index + 1}. ${exerciseName} - Semana ${week}, ${day}, día ${dayIndex}`);
        console.log(`   Usuario: ${userId.substring(0, 8)}...`);
        console.log(`   Plan: ${planId?.substring(0, 8) || 'N/A'}...`);
        console.log(`   Documentos duplicados: ${dup.count}`);
        
        dup.documents.forEach((doc, i) => {
          const setsInfo = doc.sets?.map(s => `${s.weight}kg`).join(', ') || 'N/A';
          console.log(`   ${i + 1}. ID: ${doc.id.substring(0, 20)}...`);
          console.log(`      Fecha: ${doc.date || 'N/A'}`);
          console.log(`      Sets: ${setsInfo}`);
          console.log(`      RM: ${doc.rm || 'N/A'}`);
        });
        console.log('');
      });

      console.log(`\n📝 Total de documentos duplicados: ${duplicates.reduce((sum, d) => sum + d.count, 0)}`);
      console.log(`📝 Documentos únicos que deberían existir: ${duplicates.length}`);
      console.log(`📝 Documentos a eliminar: ${duplicates.reduce((sum, d) => sum + d.count - 1, 0)}\n`);
    }

    // Estadísticas generales
    console.log("\n📊 Estadísticas:");
    console.log(`   - Total documentos: ${snapshot.size}`);
    console.log(`   - Grupos únicos: ${groups.size}`);
    console.log(`   - Grupos con duplicados: ${duplicates.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkDuplicates();
