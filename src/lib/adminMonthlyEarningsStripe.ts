import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Registra un pago de Stripe (EUR u otra moneda mayor) en admin/{YYYY-MM}.totalEarningsEur.
 * Idempotente: misma clave = un solo conteo (checkout + invoice.paid).
 */
export async function recordStripeMonthlyEarningIfNew(
  db: Firestore,
  idempotencyKey: string,
  paymentDate: Date,
  amount: number
): Promise<void> {
  if (!idempotencyKey || !Number.isFinite(amount) || amount <= 0) return;

  const year = paymentDate.getFullYear();
  const month = String(paymentDate.getMonth() + 1).padStart(2, "0");
  const monthId = `${year}-${month}`;
  const ledgerRef = db.collection("stripeEarningsLedger").doc(idempotencyKey);
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
        totalEarningsArs: 0,
        totalEarningsEur: amount,
        paymentCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.update(monthRef, {
        totalEarningsEur: FieldValue.increment(amount),
        paymentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
