import { useState, useEffect } from "react";
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

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["XAF", "XOF", "EUR", "USD"].includes(saved)) {
      return saved as Currency;
    }
    return "XAF";
  });

  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);

  // Charge les taux depuis le backend une fois
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
    localStorage.setItem(STORAGE_KEY, c);
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

  return { currency, setCurrency, convert, format, rates, labels: CURRENCY_LABELS };
}
