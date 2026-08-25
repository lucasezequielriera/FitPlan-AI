import { FaEnvelope } from "react-icons/fa";
import { motion } from "framer-motion";
import { useRouter } from "next/router";

export default function ContactButton() {
  const router = useRouter();
  const isEn = router.pathname.startsWith("/en");

  const googleFormUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdcSPbwCneAfBpvVAZEz4dusoRLgyMIVSzJm-FqGrU2SF5KwQ/viewform?usp=publish-editor";

  const labelFull = isEn ? "Questions? Contact us" : "¿Tienes alguna duda? Contáctanos";
  const aria = isEn ? "Open contact form in a new tab" : "Abrir formulario de contacto en una nueva pestaña";

  return (
    <motion.a
      href={googleFormUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ y: 12, scale: 0.85 }}
      animate={{ y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 22,
        delay: 0.85,
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="group fixed z-40 flex h-14 w-14 touch-manipulation items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--landing-accent)_50%,transparent)] bg-gradient-to-br from-[color-mix(in_oklab,var(--landing-accent)_28%,#0f172a)] to-[color-mix(in_oklab,var(--background)_92%,#0f172a)] text-[var(--landing-accent)] shadow-[0_10px_36px_-6px_rgba(45,212,191,0.45),0_0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-sm transition-[box-shadow,filter] hover:shadow-[0_14px_44px_-4px_rgba(45,212,191,0.55)] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:h-16 md:w-16"
      style={{
        bottom: "max(1.5rem, env(safe-area-inset-bottom))",
        right: "max(1.5rem, env(safe-area-inset-right))",
      }}
      aria-label={aria}
      title={labelFull}
    >
      <span className="relative flex items-center justify-center" aria-hidden>
        <FaEnvelope className="h-6 w-6 md:h-7 md:w-7" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--landing-accent)] shadow-[0_0_10px_var(--landing-accent)] ring-2 ring-[color-mix(in_oklab,var(--background)_92%,black)]" />
      </span>

      {/* Tooltip a la izquierda del botón (flotante, no empuja layout) */}
      <span className="pointer-events-none absolute right-full z-10 mr-3 hidden max-w-[min(16rem,calc(100vw-5rem))] rounded-xl border border-[var(--landing-border)] bg-[color-mix(in_oklab,var(--background)_96%,#0f172a)] px-3 py-2 text-left text-xs font-medium text-[var(--foreground)]/95 opacity-0 shadow-xl ring-1 ring-white/5 transition-opacity duration-200 sm:block sm:group-hover:opacity-100">
        {labelFull}
        <span
          className="absolute left-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-l-[color-mix(in_oklab,var(--background)_96%,#0f172a)]"
          aria-hidden
        />
      </span>
    </motion.a>
  );
}
