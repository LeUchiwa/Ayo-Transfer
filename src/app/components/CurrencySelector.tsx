import { ChevronDown } from "lucide-react";
import { useCurrency, Currency } from "../contexts/CurrencyContext";

interface Props {
  variant?: "dark" | "light";
  className?: string;
}

export function CurrencySelector({ variant = "dark", className = "" }: Props) {
  const { currency, setCurrency } = useCurrency();

  const styles = variant === "dark"
    ? "bg-white/20 dark:bg-slate-900/30 border-white/30 dark:border-slate-700 text-white hover:bg-white/30"
    : "bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200";

  const chevronColor = variant === "dark" ? "text-white" : "text-gray-600";

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className={`appearance-none pl-2.5 pr-7 py-1.5 border ${styles} text-xs font-semibold rounded-lg cursor-pointer transition-colors`}
      >
        <option value="XAF" className="text-gray-900">🇨🇲 XAF</option>
        <option value="XOF" className="text-gray-900">🇸🇳 XOF</option>
        <option value="EUR" className="text-gray-900">🇪🇺 EUR</option>
        <option value="USD" className="text-gray-900">🇺🇸 USD</option>
      </select>
      <ChevronDown className={`w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 ${chevronColor} pointer-events-none`} />
    </div>
  );
}
