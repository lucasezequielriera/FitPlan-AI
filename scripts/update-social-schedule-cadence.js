/**
 * Aplica en Firestore la nueva cadencia/horario de contenido social decidida
 * por Lucas (2026-08): reels cada 2 días, alternando entre dos horarios
 * (20:30 y 01:30, hora Madrid — noche en España y noche en Argentina
 * respectivamente, sin tocar el huso de referencia, ver `dueReelSlotsNow` en
 * scheduleStore.ts), y carruseles una vez por día a las 13:00. No toca
 * `slideCount` ni `priceLabel` del carrusel: solo baja `timesLocal` de dos
 * franjas a una.
 *
 * Es config operativa (docs `config/socialSchedule` y `config/carouselSchedule`),
 * no esquema ni datos de usuario, así que no hace falta migración: se
 * sobreescribe con `set({ merge: true })`, igual que hacen los endpoints
 * `setSocialSchedule`/`setCarouselSchedule` que este script imita a mano
 * (no hay tsx/ts-node instalado para importar los .ts directamente).
 *
 * Ejecutar con: node scripts/update-social-schedule-cadence.js
 * Para confirmar la escritura, edita este archivo y cambia CONFIRM a true.
 */

// dotenv no está instalado en este repo (mismo caso que los demás scripts de
// scripts/), así que se parsea `.env.local` a mano en vez de agregar una
// dependencia nueva solo para un script de un solo uso.
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.trim().replace(/^"(.*)"$/, '$1');
    process.env[key] = value;
  }
} catch (e) {
  // Sin .env.local disponible, usar variables de entorno del sistema tal cual.
}

const CONFIRM = false; // ⚠️ Cambiar a true para escribir de verdad en Firestore — ya se aplicó una vez (2026-08), este archivo queda como referencia/histórico

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const NEW_SOCIAL_SCHEDULE = { enabled: true, timesLocal: ['20:30', '01:30'], intervalDays: 2 };
const NEW_CAROUSEL_TIMES = ['13:00'];

async function main() {
  console.log('📋 Nueva config a escribir:');
  console.log('   config/socialSchedule   →', JSON.stringify(NEW_SOCIAL_SCHEDULE));
  console.log('   config/carouselSchedule →', 'timesLocal:', JSON.stringify(NEW_CAROUSEL_TIMES), '(slideCount/priceLabel sin cambios)\n');

  if (!CONFIRM) {
    console.log('⚠️  Dry-run: no se escribió nada.');
    console.log('   Para aplicar, edita este archivo y cambiá CONFIRM a true.\n');
    process.exit(0);
  }

  let app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!privateKey || !clientEmail || !projectId) {
      console.error('❌ Variables de entorno faltantes: FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_CLIENT_EMAIL, NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      process.exit(1);
    }
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore(app);

  await db.collection('config').doc('socialSchedule').set(
    {
      enabled: NEW_SOCIAL_SCHEDULE.enabled,
      timesLocal: NEW_SOCIAL_SCHEDULE.timesLocal,
      intervalDays: NEW_SOCIAL_SCHEDULE.intervalDays,
      timesUtc: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ config/socialSchedule actualizado.');

  await db.collection('config').doc('carouselSchedule').set(
    {
      enabled: true,
      timesLocal: NEW_CAROUSEL_TIMES,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ config/carouselSchedule actualizado (timesLocal solamente).');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
