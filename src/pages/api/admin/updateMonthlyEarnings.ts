import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/adminAuthServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    // Usar Firebase Admin SDK
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({
        error: "Firebase Admin SDK no configurado"
      });
    }

    // Obtener todos los usuarios premium
    const usersSnapshot = await db.collection("usuarios").where("premium", "==", true).get();

    console.log(`📊 Procesando ${usersSnapshot.size} usuarios premium...`);

    const earningsByMonth: Record<string, { total: number; count: number }> = {};
    let processedCount = 0;
    let skippedCount = 0;

    // Procesar cada usuario premium
    usersSnapshot.forEach((docSnapshot) => {
      try {
        const userData = docSnapshot.data();
        
        // Excluir al admin
        if (userData.email?.toLowerCase() === "admin@fitplan-ai.com") {
          return;
        }

        // Obtener información del pago premium
        const premiumPayment = userData.premiumPayment;
        
        console.log(`🔍 Procesando usuario ${docSnapshot.id}:`, {
          email: userData.email,
          hasPremiumPayment: !!premiumPayment,
          hasPremiumLastPay: !!userData.premiumLastPay,
        });
        
        // Log detallado solo si es necesario (evitar problemas con objetos de Firebase)
        if (premiumPayment) {
          try {
            console.log(`  - premiumPayment.amount:`, premiumPayment.amount);
            // No intentar hacer JSON.stringify de objetos de Firebase
          } catch (e) {
            console.log(`  - Error al leer premiumPayment:`, e);
          }
        }
      
        // Si no hay premiumPayment, intentar usar el monto estándar mensual actual
        let amount = 0;
        if (premiumPayment && premiumPayment.amount) {
          amount = Number(premiumPayment.amount) || 0;
        } else {
          // Si no tiene amount en premiumPayment, usar el monto estándar
          console.log(`⚠️ Usuario ${docSnapshot.id} no tiene premiumPayment.amount, usando monto estándar ($10,000)`);
          amount = 10000; // Monto estándar mensual del plan premium
        }

        // Obtener fecha del pago
        let paymentDate: Date | null = null;
        
        // Intentar obtener fecha de premiumPayment.date
        if (premiumPayment && premiumPayment.date) {
          if (premiumPayment.date.toDate && typeof premiumPayment.date.toDate === 'function') {
            paymentDate = premiumPayment.date.toDate();
          } else if (premiumPayment.date instanceof Date) {
            paymentDate = premiumPayment.date;
          } else if (typeof premiumPayment.date === 'string') {
            paymentDate = new Date(premiumPayment.date);
          } else if (premiumPayment.date && typeof premiumPayment.date === 'object' && 'seconds' in premiumPayment.date) {
            const ts = premiumPayment.date as { seconds: number; nanoseconds?: number };
            paymentDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
          }
        }
        
        // Si no hay fecha en premiumPayment, usar premiumLastPay
        if (!paymentDate || isNaN(paymentDate.getTime())) {
          const premiumLastPay = userData.premiumLastPay;
          if (premiumLastPay) {
            if (premiumLastPay.toDate && typeof premiumLastPay.toDate === 'function') {
              paymentDate = premiumLastPay.toDate();
            } else if (premiumLastPay instanceof Date) {
              paymentDate = premiumLastPay;
            } else if (typeof premiumLastPay === 'string') {
              paymentDate = new Date(premiumLastPay);
            } else if (premiumLastPay && typeof premiumLastPay === 'object' && 'seconds' in premiumLastPay) {
              const ts = premiumLastPay as { seconds: number; nanoseconds?: number };
              paymentDate = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
            }
          }
        }

        if (!paymentDate || isNaN(paymentDate.getTime())) {
          console.log(`⚠️ Usuario ${docSnapshot.id} no tiene fecha de pago válida`);
          skippedCount++;
          return;
        }

        // Obtener año y mes del pago
        const year = paymentDate.getFullYear();
        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
        const monthId = `${year}-${month}`;

        if (amount <= 0) {
          console.log(`⚠️ Usuario ${docSnapshot.id} tiene amount inválido: ${amount}`);
          skippedCount++;
          return;
        }
        
        console.log(`✅ Usuario ${docSnapshot.id}: Monto $${amount} ARS, Fecha: ${paymentDate.toISOString()}, Mes: ${monthId}`);

        // Acumular ganancias por mes
        if (!earningsByMonth[monthId]) {
          earningsByMonth[monthId] = { total: 0, count: 0 };
        }
        
        earningsByMonth[monthId].total += amount;
        earningsByMonth[monthId].count += 1;
        processedCount++;
      } catch (userError: unknown) {
        console.error(`❌ Error al procesar usuario ${docSnapshot.id}:`, userError);
        skippedCount++;
      }
    });

    console.log(`✅ Procesados: ${processedCount} pagos, Omitidos: ${skippedCount}`);
    console.log(`📅 Meses a actualizar: ${Object.keys(earningsByMonth).length}`);

    // Actualizar o crear documentos en la colección admin
    const updatePromises: Promise<unknown>[] = [];
    
    for (const [monthId, data] of Object.entries(earningsByMonth)) {
      const [yearStr, monthStr] = monthId.split('-');
      const year = parseInt(yearStr);
      const monthNumber = parseInt(monthStr);

      const adminMonthRef = db.collection("admin").doc(monthId);
      const adminMonthDoc = await adminMonthRef.get();

      if (!adminMonthDoc.exists) {
        // Crear documento inicial para el mes
        updatePromises.push(
          adminMonthRef.set({
            month: monthId,
            year: year,
            monthNumber: monthNumber,
            totalEarningsArs: data.total,
            totalEarningsEur: 0,
            totalEarnings: data.total,
            paymentCount: data.count,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
        );
        console.log(`✅ Creado documento para ${monthId}: $${data.total.toLocaleString('es-AR')} ARS (${data.count} pagos)`);
      } else {
        // Actualizar documento existente (usar set con merge para evitar sobrescribir)
        const currentData = adminMonthDoc.data();
        const currentTotal = currentData?.totalEarnings || 0;
        
        // Solo actualizar si el total calculado es mayor (para evitar duplicados)
        if (data.total > currentTotal) {
          updatePromises.push(
            adminMonthRef.set({
              month: monthId,
              year: year,
              monthNumber: monthNumber,
              totalEarningsArs: data.total,
              totalEarningsEur: 0,
              totalEarnings: data.total,
              paymentCount: data.count,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true })
          );
          console.log(`✅ Actualizado documento para ${monthId}: $${data.total.toLocaleString('es-AR')} ARS (${data.count} pagos)`);
        } else {
          console.log(`ℹ️ Documento ${monthId} ya tiene un total mayor, omitiendo actualización`);
        }
      }
    }

    await Promise.all(updatePromises);

    console.log(`✅ Proceso completado. Promesas ejecutadas: ${updatePromises.length}`);
    console.log(`📊 Resumen final:`, {
      processed: processedCount,
      skipped: skippedCount,
      months: Object.keys(earningsByMonth).length,
      earningsByMonth,
    });

    return res.status(200).json({
      success: true,
      message: "Ganancias mensuales actualizadas correctamente",
      processed: processedCount,
      skipped: skippedCount,
      monthsUpdated: Object.keys(earningsByMonth).length,
      earningsByMonth,
    });
  } catch (error: unknown) {
    console.error("❌ Error al actualizar ganancias mensuales:", error);
    
    // Log detallado del error
    if (error instanceof Error) {
      console.error("❌ Error message:", error.message);
      console.error("❌ Error stack:", error.stack);
    }
    
    const message = error instanceof Error ? error.message : "Error desconocido";
    return res.status(500).json({ 
      error: "Error al procesar la solicitud", 
      detail: message,
      // Solo incluir stack en desarrollo
      ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {})
    });
  }
}

