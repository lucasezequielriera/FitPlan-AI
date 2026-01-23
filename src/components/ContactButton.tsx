import { FaEnvelope } from "react-icons/fa";
import { motion } from "framer-motion";

export default function ContactButton() {
  // URL del formulario de contacto de Google Forms
  const googleFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdcSPbwCneAfBpvVAZEz4dusoRLgyMIVSzJm-FqGrU2SF5KwQ/viewform?usp=publish-editor";

  return (
    <motion.a
      href={googleFormUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: 1
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300 group"
      aria-label="Contactar por formulario"
      title="¿Tienes alguna duda? Contáctanos"
    >
      <FaEnvelope className="w-6 h-6 md:w-7 md:h-7" />
      
      {/* Tooltip */}
      <span className="absolute right-full mr-3 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/10">
        ¿Tienes alguna duda? Contáctanos
        <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
      </span>
    </motion.a>
  );
}
