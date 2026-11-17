import { ChevronDown } from "lucide-react";
import { useCurrency, Currency } from "../hooks/useCurrency";

export function CurrencySelector({ className = "" }: { className?: string }) {
  const { currency, setCurrency, labels } = useCurrency();

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className="appearance-none pl-3 pr-8 py-1.5 bg-white/20 dark:bg-slate-900/30 border border-white/30 dark:border-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-white/30 transition-colors"
      >
        <option value="XAF" className="text-gray-900">🇨🇲 XAF</option>
        <option value="XOF" className="text-gray-900">🇸🇳 XOF</option>
        <option value="EUR" className="text-gray-900">🇪🇺 EUR</option>
        <option value="USD" className="text-gray-900">🇺🇸 USD</option>
      </select>
      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
    </div>
  );
}
