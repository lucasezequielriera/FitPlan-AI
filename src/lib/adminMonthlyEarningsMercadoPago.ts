import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Registra un pago de MercadoPago (ARS) en admin/{YYYY-MM}.totalEarningsArs.
 * Idempotente y atómico vía transacción: si MercadoPago reentrega el mismo
 * webhook (comportamiento documentado de "al menos una entrega"), la misma
 * clave (paymentId) nunca se cuenta dos veces — mismo patrón que
 * recordStripeMonthlyEarningIfNew en adminMonthlyEarningsStripe.ts.
 */
export async function recordMercadoPagoMonthlyEarningIfNew(
  db: Firestore,
  idempotencyKey: string,
  paymentDate: Date,
  amount: number
): Promise<void> {
  if (!idempotencyKey || !Number.isFinite(amount) || amount <= 0) return;

  const year = paymentDate.getFullYear();
  const month = String(paymentDate.getMonth() + 1).padStart(2, "0");
  const monthId = `${year}-${month}`;
  const ledgerRef = db.collection("mercadopagoEarningsLedger").doc(idempotencyKey);
  const monthRef = db.collection("admin").doc(monthId);

  await db.runTransaction(async (transaction) => {
    const ledgerSnap = await transaction.get(ledgerRef);
    if (ledgerSnap.exists) return;

    transaction.set(ledgerRef, {
      monthId,
      amount,
      createdAt: FieldValue.serverTimestamp(),
    });

    const monthSnap = await transaction.get(monthRef);
    if (!monthSnap.exists) {
      transaction.set(monthRef, {
        month: monthId,
        year,
        monthNumber: parseInt(month, 10),
        totalEarningsArs: amount,
        totalEarningsEur: 0,
        totalEarnings: amount,
        paymentCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.update(monthRef, {
        totalEarningsArs: FieldValue.increment(amount),
        totalEarnings: FieldValue.increment(amount),
        paymentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
