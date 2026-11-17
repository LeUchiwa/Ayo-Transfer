import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { walletApi } from "../../../utils/api";

export type Currency = "XAF" | "XOF" | "EUR" | "USD";

const STORAGE_KEY = "ayo_display_currency";

const DEFAULT_RATES: Record<Currency, number> = {
  XAF: 1,
  XOF: 1,
  EUR: 655.957,
  USD: 610,
};

const CURRENCY_LABELS: Record<Currency, { symbol: string; label: string; flag: string }> = {
  XAF: { symbol: "FCFA", label: "Franc CFA (CEMAC)", flag: "🇨🇲" },
  XOF: { symbol: "FCFA", label: "Franc CFA (UEMOA)", flag: "🇸🇳" },
  EUR: { symbol: "€", label: "Euro", flag: "🇪🇺" },
  USD: { symbol: "$", label: "Dollar US", flag: "🇺🇸" },
};

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (amountFCFA: number) => number;
  format: (amountFCFA: number) => string;
  rates: Record<Currency, number>;
  labels: typeof CURRENCY_LABELS;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ["XAF", "XOF", "EUR", "USD"].includes(saved)) {
        return saved as Currency;
      }
    } catch {}
    return "XAF";
  });

  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);

  useEffect(() => {
    walletApi.getExchangeRates()
      .then(res => {
        if (res.rates) {
          setRates({ ...DEFAULT_RATES, ...res.rates });
        }
      })
      .catch(err => console.warn("[CURRENCY] Failed to load rates:", err));
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  const convert = (amountFCFA: number): number => {
    if (currency === "XAF" || currency === "XOF") return amountFCFA;
    return Math.round(amountFCFA / rates[currency]);
  };

  const format = (amountFCFA: number): string => {
    const converted = convert(amountFCFA);
    const symbol = CURRENCY_LABELS[currency].symbol;
    if (currency === "XAF" || currency === "XOF") {
      return `${converted.toLocaleString("fr-FR")} ${symbol}`;
    }
    return `${symbol}${converted.toLocaleString("fr-FR")}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, format, rates, labels: CURRENCY_LABELS }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
