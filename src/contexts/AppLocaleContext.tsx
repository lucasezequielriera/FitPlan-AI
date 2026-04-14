import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/router";

const STORAGE_KEY = "fitplan-locale";

export type AppLocale = "es" | "en";

type Ctx = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
};

const AppLocaleContext = createContext<Ctx | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>("es");

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") return;

    if (router.pathname.startsWith("/en")) {
      setLocaleState("en");
      localStorage.setItem(STORAGE_KEY, "en");
      document.documentElement.lang = "en-US";
      return;
    }

    // Home en español: siempre ES en la URL raíz
    if (router.pathname === "/") {
      setLocaleState("es");
      localStorage.setItem(STORAGE_KEY, "es");
      document.documentElement.lang = "es";
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (stored === "en" || stored === "es") {
      setLocaleState(stored);
      document.documentElement.lang = stored === "en" ? "en-US" : "es";
    } else {
      setLocaleState("es");
      document.documentElement.lang = "es";
    }
  }, [router.isReady, router.pathname]);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "en" ? "en-US" : "es";
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale(): Ctx {
  const ctx = useContext(AppLocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within AppLocaleProvider");
  }
  return ctx;
}
