import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

const poppins = Poppins({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-sans" });

export default function App({ Component, pageProps }: AppProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <div className={poppins.className}>
      <Component {...pageProps} />
    </div>
  );
}
