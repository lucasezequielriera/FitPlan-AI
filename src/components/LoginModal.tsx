import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaKey, FaLock, FaEnvelope } from "react-icons/fa";
import { useAuthStore } from "@/store/authStore";
import { getDbSafe, getAuthSafe } from "@/lib/firebase";
import { trackEvent } from "@/lib/analytics";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
  /** Textos de UI; por defecto español. */
  locale?: "es" | "en";
}

export default function LoginModal({
  isOpen,
  onClose,
  defaultMode = "login",
  locale = "es",
}: LoginModalProps) {
  const [isSignUp, setIsSignUp] = useState(defaultMode === "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultMode === "signup");
      setIsForgotPassword(false);
      setResetEmailSent(false);
      setEmail("");
      setPassword("");
      setError(null);
    }
  }, [isOpen, defaultMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn, signUp } = useAuthStore();

  const copy = useMemo(() => {
    if (locale === "en") {
      return {
        titleLogin: "Sign in",
        titleSignup: "Create account",
        titleForgot: "Reset password",
        subtitleLogin: "Welcome back — your plans and progress are here.",
        subtitleSignup: "One account to save workouts, meals, and your AI plans.",
        subtitleForgot: "We’ll email you a link to set a new password.",
        emailLabel: "Email",
        passwordLabel: "Password",
        minChars: "At least 6 characters",
        forgotLink: "Forgot password?",
        backLogin: "Back to sign in",
        sendCta: "Send reset link",
        sending: "Sending…",
        sentCta: "Email sent",
        resetSuccess:
          "Check your inbox for instructions to reset your password.",
        resetError: "Couldn’t send the email. Try again.",
        genericError: "Something went wrong",
        primaryLogin: "Sign in",
        primarySignup: "Create account",
        loading: "Please wait…",
        toggleSignup: "Need an account? Sign up",
        toggleLogin: "Already have an account? Sign in",
        close: "Close",
      };
    }
    return {
      titleLogin: "Iniciar sesión",
      titleSignup: "Crear cuenta",
      titleForgot: "Recuperar contraseña",
      subtitleLogin: "Bienvenido de nuevo: tus planes y progreso te esperan.",
      subtitleSignup: "Una cuenta para guardar entrenos, comidas y planes con IA.",
      subtitleForgot: "Te enviamos un enlace para elegir una nueva contraseña.",
      emailLabel: "Email",
      passwordLabel: "Contraseña",
      minChars: "Mínimo 6 caracteres",
      forgotLink: "¿Olvidaste tu contraseña?",
      backLogin: "Volver a iniciar sesión",
      sendCta: "Enviar enlace",
      sending: "Enviando…",
      sentCta: "Email enviado",
      resetSuccess:
        "Revisá tu correo: te enviamos las instrucciones para recuperar tu contraseña.",
      resetError: "No pudimos enviar el email. Prueba de nuevo.",
      genericError: "Algo salió mal",
      primaryLogin: "Iniciar sesión",
      primarySignup: "Crear cuenta",
      loading: "Cargando…",
      toggleSignup: "¿No tienes cuenta? Regístrate",
      toggleLogin: "¿Ya tienes cuenta? Iniciá sesión",
      close: "Cerrar",
    };
  }, [locale]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkUserPlansAndRedirect = async () => {
    try {
      const db = getDbSafe();
      const auth = getAuthSafe();
      if (!db || !auth?.currentUser) {
        window.location.href = "/create-plan";
        return;
      }

      const { doc, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const emailLower = userData.email?.toLowerCase() || "";
        const nombreLower = userData.nombre?.toLowerCase() || "";
        const isAdmin = emailLower === "admin@fitplan-ai.com" || nombreLower === "administrador";

        if (isAdmin) {
          window.location.href = "/admin";
          return;
        }
      }

      const q = query(collection(db, "planes"), where("userId", "==", auth.currentUser.uid), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        window.location.href = "/create-plan";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (e) {
      console.error("Error al verificar planes:", e);
      window.location.href = "/create-plan";
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const auth = getAuthSafe();
      if (!auth) {
        throw new Error(locale === "en" ? "Authentication error" : "Error de autenticación");
      }

      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setSuccess(copy.resetSuccess);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : copy.resetError;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        trackEvent("lead", {
          source: "login-modal",
          method: "email_signup",
          locale,
        }, { sendServer: true, user: { email } });
      } else {
        await signIn(email, password);
      }
      onClose();
      setEmail("");
      setPassword("");

      const auth = getAuthSafe();
      if (auth?.currentUser) {
        const authEmail = auth.currentUser.email?.toLowerCase() || "";
        if (authEmail === "admin@fitplan-ai.com") {
          window.location.href = "/admin";
          return;
        }

        const db = getDbSafe();
        if (db) {
          const { doc, getDoc } = await import("firebase/firestore");
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const emailLower = userData.email?.toLowerCase() || "";
            const nombreLower = userData.nombre?.toLowerCase() || "";
            const isAdmin = emailLower === "admin@fitplan-ai.com" || nombreLower === "administrador";

            if (isAdmin) {
              window.location.href = "/admin";
              return;
            }
          }
        }
      }

      if (isSignUp) {
        window.location.href = "/create-plan";
      } else {
        checkUserPlansAndRedirect();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : copy.genericError;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const inputClass =
    "w-full min-h-[48px] rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 py-3 pl-11 text-[var(--foreground)] placeholder:text-[var(--landing-muted)] outline-none transition " +
    "focus:border-[color-mix(in_oklab,var(--landing-accent)_55%,transparent)] focus:ring-2 focus:ring-[var(--landing-accent)]/35";

  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--landing-muted)]";

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[10000] flex min-h-0 items-center justify-center px-3 py-6 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
          lang={locale}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md max-h-[min(90dvh,calc(100dvh-3rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_95%,#0f172a)] shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[min(92dvh,100dvh)] sm:pb-6"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-2xl bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_18%,transparent)] via-transparent to-[color-mix(in_oklab,#6366f1_10%,transparent)] opacity-90" />

            <div className="relative px-4 pt-10 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-2 top-2 sm:right-3 sm:top-3 rounded-lg p-2 text-[var(--foreground)]/70 transition hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
                aria-label={copy.close}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              <div className="mb-5 flex items-start gap-3 pr-10">
                <span
                  className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--landing-accent)]/30 to-[var(--brand-mid)]/20 ring-1 ring-[var(--landing-accent)]/40 text-[var(--landing-accent)]"
                  aria-hidden
                >
                  {isForgotPassword ? <FaKey className="h-5 w-5" /> : <FaLock className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <h2
                    id="login-modal-title"
                    className="font-display text-xl font-bold tracking-tight text-balance bg-gradient-to-r from-[var(--foreground)] to-[var(--landing-accent)] bg-clip-text text-transparent sm:text-2xl"
                  >
                    {isForgotPassword ? copy.titleForgot : isSignUp ? copy.titleSignup : copy.titleLogin}
                  </h2>
                  <p className="mt-1.5 text-sm font-medium text-[var(--landing-muted)] text-pretty leading-snug">
                    {isForgotPassword ? copy.subtitleForgot : isSignUp ? copy.subtitleSignup : copy.subtitleLogin}
                  </p>
                </div>
              </div>

              {isForgotPassword ? (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label htmlFor="auth-email-reset" className={labelClass}>
                      {copy.emailLabel}
                    </label>
                    <div className="relative">
                      <FaEnvelope className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]" aria-hidden />
                      <input
                        id="auth-email-reset"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputClass}
                        placeholder="you@email.com"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>
                  )}
                  {success && (
                    <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">{success}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || resetEmailSent}
                    className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--landing-accent)] px-4 py-3 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                  >
                    {loading ? copy.sending : resetEmailSent ? copy.sentCta : copy.sendCta}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError(null);
                        setSuccess(null);
                        setResetEmailSent(false);
                      }}
                      className="text-sm font-semibold text-[var(--landing-accent)] hover:underline"
                    >
                      {copy.backLogin}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-5 flex rounded-xl bg-[var(--landing-surface)] p-1 ring-1 ring-[var(--landing-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                        !isSignUp
                          ? "bg-[color-mix(in_oklab,var(--landing-accent)_22%,#0f172a)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--landing-accent)]/40"
                          : "text-[var(--landing-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {copy.titleLogin}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setError(null);
                        setSuccess(null);
                      }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                        isSignUp
                          ? "bg-[color-mix(in_oklab,var(--landing-accent)_22%,#0f172a)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--landing-accent)]/40"
                          : "text-[var(--landing-muted)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {copy.titleSignup}
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="auth-email" className={labelClass}>
                        {copy.emailLabel}
                      </label>
                      <div className="relative">
                        <FaEnvelope className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]" aria-hidden />
                        <input
                          id="auth-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className={inputClass}
                          placeholder="you@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="auth-password" className={labelClass}>
                        {copy.passwordLabel}
                      </label>
                      <div className="relative">
                        <FaLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--landing-muted)]" aria-hidden />
                        <input
                          id="auth-password"
                          type="password"
                          autoComplete={isSignUp ? "new-password" : "current-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className={inputClass}
                          placeholder="••••••••"
                        />
                      </div>
                      {isSignUp && <p className="mt-1.5 text-xs text-[var(--landing-muted)]">{copy.minChars}</p>}
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setError(null);
                            setSuccess(null);
                          }}
                          className="mt-2 text-left text-xs font-semibold text-[var(--landing-accent)] hover:underline"
                        >
                          {copy.forgotLink}
                        </button>
                      )}
                    </div>

                    {error && (
                      <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>
                    )}
                    {success && (
                      <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">{success}</div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[var(--landing-accent)] px-4 py-3 text-sm font-semibold text-[#0a1628] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                    >
                      {loading ? copy.loading : isSignUp ? copy.primarySignup : copy.primaryLogin}
                    </button>
                  </form>

                  <p className="mt-5 text-center text-sm text-[var(--landing-muted)]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="font-semibold text-[var(--landing-accent)] hover:underline"
                    >
                      {isSignUp ? copy.toggleLogin : copy.toggleSignup}
                    </button>
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
