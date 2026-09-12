import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { getAuthSafe, getDbSafe } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import { trackEvent } from "@/lib/analytics";
import Seo from "@/components/Seo";
import { authedFetch } from "@/lib/userAuthClient";

export default function PaymentSuccess() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const purchaseTrackedRef = useRef(false);

  useEffect(() => {
    if (!authUser) {
      router.push("/");
      return;
    }

    const checkAndUpdatePremium = async () => {
      try {
        const db = getDbSafe();
        const auth = getAuthSafe();
        
        if (!db || !auth?.currentUser) {
          setLoading(false);
          return;
        }

        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        let isPremium = false;
        if (userDoc.exists()) {
          const userData = userDoc.data();
          isPremium = userData.premium === true;
        }

        // Si ya es premium, solo actualizar el estado
        if (isPremium) {
          setPremium(true);
          setLoading(false);
          return;
        }

        // Si no es premium, intentar verificar el pago desde los query params
        const { payment_id, session_id, provider } = router.query;
        const paymentProvider = provider === "stripe" ? "stripe" : "mercadopago";
        
        if (paymentProvider === "stripe" && session_id && typeof session_id === "string") {
          // Verificar el pago con Stripe
          try {
            // authedFetch: el endpoint ahora comprueba en el servidor que la sesión
            // sea de quien pregunta, no solo aquí en el cliente.
            const paymentCheck = await authedFetch(`/api/checkStripePayment?session_id=${session_id}`);
            if (paymentCheck.ok) {
              const paymentData = await paymentCheck.json();
              
              if (paymentData.status === "succeeded" && paymentData.userId === auth.currentUser.uid) {
                // Actualizar el estado premium en la base de datos
                const premiumData = {
                  premium: true,
                  premiumSince: serverTimestamp(),
                  premiumStatus: "active",
                  premiumPayment: {
                    paymentId: session_id,
                    amount: paymentData.amount,
                    currency: paymentData.currency || "EUR",
                    date: serverTimestamp(),
                    method: "stripe",
                    status: paymentData.status,
                  },
                  updatedAt: serverTimestamp(),
                };
                
                await setDoc(userRef, premiumData, { merge: true });
                console.log(`✅ Usuario ${auth.currentUser.uid} actualizado a premium desde success page (Stripe)`);
                setPremium(true);
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error al verificar pago de Stripe:", error);
          }
        } else if (paymentProvider === "mercadopago" && payment_id && typeof payment_id === "string") {
          // Verificar el pago con MercadoPago
          try {
            const idToken = await auth.currentUser.getIdToken();
            const paymentCheck = await fetch(`/api/checkPayment?payment_id=${payment_id}`, {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (paymentCheck.ok) {
              const paymentData = await paymentCheck.json();
              
              if (paymentData.status === "approved" && paymentData.externalReference === auth.currentUser.uid) {
                // Actualizar el estado premium en la base de datos
                const premiumData = {
                  premium: true,
                  premiumSince: serverTimestamp(),
                  premiumStatus: "active",
                  premiumPayment: {
                    paymentId: payment_id,
                    amount: paymentData.transactionAmount,
                    currency: paymentData.currencyId || "ARS",
                    date: serverTimestamp(),
                    method: paymentData.paymentMethodId || "unknown",
                    status: paymentData.status,
                  },
                  updatedAt: serverTimestamp(),
                };
                
                await setDoc(userRef, premiumData, { merge: true });
                console.log(`✅ Usuario ${auth.currentUser.uid} actualizado a premium desde success page (MercadoPago)`);
                setPremium(true);
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error al verificar pago de MercadoPago:", error);
          }
        }

        // Si no se pudo verificar, solo verificar el estado actual
        setPremium(isPremium);
        setLoading(false);
      } catch (error) {
        console.error("Error al verificar estado premium:", error);
        setLoading(false);
      }
    };

    // Esperar a que router.query esté disponible
    if (router.isReady) {
      checkAndUpdatePremium();
    }

    // Verificar periódicamente si el pago fue procesado (en caso de que el webhook tarde)
    const interval = setInterval(() => {
      if (router.isReady && !premium) {
        checkAndUpdatePremium();
      }
    }, 3000); // Verificar cada 3 segundos
    
    // Limpiar intervalo después de 30 segundos
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [authUser, router, premium]);

  useEffect(() => {
    if (!premium) return;
    if (!purchaseTrackedRef.current) {
      purchaseTrackedRef.current = true;
      const provider = router.query.provider === "stripe" ? "stripe" : "mercadopago";
      trackEvent("purchase", {
        source: "payment-success-page",
        provider,
      }, { sendServer: true, user: { email: authUser?.email || undefined } });
    }
    const timeout = setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
    return () => clearTimeout(timeout);
  }, [premium, router]);

  if (loading) {
    return (
      <>
        {/* El `noindex` también va aquí, no solo en el return de abajo.
            `loading` arranca en true, así que este es el HTML que renderiza el
            servidor y el que ve un buscador: sin el Seo, la página de
            confirmación de pago se servía indexable. Comprobado con curl —
            `/payment/failure` y `/payment/pending` sí traían el noindex y
            `success` no, pese a tener el mismo `<Seo noindex />` más abajo. */}
        <Seo
          title="Pago confirmado"
          description="Confirmación de tu pago en FitPlan."
          path="/payment/success"
          noindex
        />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
            <p className="opacity-70">Verificando pago...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Pago confirmado"
        description="Confirmación de tu pago en FitPlan. Tu plan personalizado de alimentación y entrenamiento ya está disponible en tu cuenta para que empieces hoy mismo."
        path="/payment/success"
        noindex
      />
    <div className="min-h-screen">
      <Navbar minimal />
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ y: 12, scale: 0.9 }}
          animate={{ y: 0, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          {premium ? (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/20 mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-10 w-10 text-success"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 className="font-display text-3xl font-bold mb-4 text-success">
                ¡Pago exitoso!
              </h1>
              <p className="text-lg opacity-80 mb-6">
                Tu plan Premium ha sido activado correctamente.
              </p>
              <div className="mb-8 p-4 rounded-xl bg-success/10 border border-success/30">
                <p className="text-sm opacity-70 mb-2">Ahora tienes acceso a:</p>
                <ul className="text-left text-sm space-y-1">
                  <li>✓ Objetivos avanzados (Recomposición, Definición, Volumen, Corte)</li>
                  <li>✓ Dietas premium personalizadas</li>
                  <li>✓ Intensidad ajustable para todos los objetivos</li>
                  <li>✓ Análisis avanzado de progreso</li>
                </ul>
              </div>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn btn-success"
              >
                Ir a mi Dashboard
              </button>
              <p className="text-subtle text-xs mt-3">Te redirigimos automáticamente en unos segundos...</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-warning/20 mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-10 w-10 text-warning"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="font-display text-3xl font-bold mb-4">Procesando pago...</h1>
              <p className="text-lg opacity-80 mb-6">
                Estamos verificando tu pago. Esto puede tomar unos momentos.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn btn-primary"
              >
                Volver al Dashboard
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
    </>
  );
}

