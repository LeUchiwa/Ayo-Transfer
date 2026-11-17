#!/usr/bin/env bash
set -euo pipefail

# ═══ 1. BACKEND : route /exchange-rates (publique) ═══
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.currency"

python3 <<'PY'
import pathlib

p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

# Handler pour récupérer les taux
handler = '''async function handleGetExchangeRates() {
  const settings = (await kv.get("admin:settings")) || {};
  const rates = settings.exchangeRates || {
    XAF: 1,
    XOF: 1,
    EUR: 655.957,
    USD: 610,
  };
  return Response.json({ rates }, { headers: corsHeaders });
}

'''

marker = "async function handleGetDepositCoords() {"
if "handleGetExchangeRates" not in src:
    src = src.replace(marker, handler + marker, 1)
    print("✅ Handler getExchangeRates ajouté")

# Route publique
rate_anchor = '    // ═══ RATE LIMIT REGISTER (public) ═══'
route = '''    // ═══ TAUX DE CHANGE (public) ═══
    if (method === "GET" && path.endsWith("/exchange-rates")) {
      return await handleGetExchangeRates();
    }

''' + rate_anchor

if "/exchange-rates" not in src:
    src = src.replace(rate_anchor, route, 1)
    print("✅ Route /exchange-rates ajoutée")

p.write_text(src, encoding="utf-8")
PY

# ═══ 2. API : méthode getExchangeRates ═══
API_FILE="utils/api.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")

if "getExchangeRates" not in src:
    method = '''
  getExchangeRates: async (): Promise<{ rates: Record<string, number> }> => {
    const res = await fetch(`${API_BASE}/exchange-rates`);
    return res.json();
  },
'''
    anchor = "  getServices: () => apiCall('/services'),"
    src = src.replace(anchor, anchor + method, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ API getExchangeRates ajoutée")
PY

# ═══ 3. HOOK : useCurrency ═══
cat > src/app/hooks/useCurrency.ts <<'EOF'
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
EOF
echo "✅ Hook useCurrency créé"

# ═══ 4. COMPOSANT : CurrencySelector ═══
cat > src/app/components/CurrencySelector.tsx <<'EOF'
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
EOF
echo "✅ Composant CurrencySelector créé"

# ═══ 5. DASHBOARD : intégrer le sélecteur + formatage ═══
DASHBOARD_FILE="src/app/pages/Dashboard.tsx"
cp "$DASHBOARD_FILE" "${DASHBOARD_FILE}.bak.currency"

python3 <<'PY'
import pathlib, re

p = pathlib.Path("src/app/pages/Dashboard.tsx")
src = p.read_text(encoding="utf-8")

# Imports
if "useCurrency" not in src:
    src = src.replace(
        'import { useAuth } from "../contexts/AuthContext";',
        'import { useAuth } from "../contexts/AuthContext";\nimport { useCurrency } from "../hooks/useCurrency";\nimport { CurrencySelector } from "../components/CurrencySelector";'
    )

# Hook dans le composant
if "const { format" not in src:
    src = src.replace(
        'const { user } = useAuth();',
        'const { user } = useAuth();\n  const { format } = useCurrency();'
    )

# Remplacer l'affichage du solde principal
# Cherche : {showBalance ? stats.balance.toLocaleString() : "•••••••"}
old_balance = '''{showBalance ? stats.balance.toLocaleString() : "•••••••"}
                  <span className="text-lg font-medium text-white/80 ml-2">FCFA</span>'''

new_balance = '''{showBalance ? format(stats.balance) : "•••••••"}'''

if old_balance in src:
    src = src.replace(old_balance, new_balance, 1)

# Ajouter le sélecteur juste avant l'icône Eye (le toggle de visibilité du solde)
old_eye = '''<button
                onClick={() => setShowBalance(!showBalance)}
                className="text-white/80 hover:text-white transition-colors"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>'''

new_eye = '''<div className="flex items-center gap-2">
                <CurrencySelector />
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>'''

if old_eye in src and "<CurrencySelector />" not in src:
    src = src.replace(old_eye, new_eye, 1)

# Remplacer les 3 stats en bas (totalSent, totalReceived, totalDeposits)
replacements = [
    # Total envoyé
    ('''{isLoading ? <Skeleton className="h-7 w-32" /> : `${stats.totalSent.toLocaleString()} FCFA`}''',
     '''{isLoading ? <Skeleton className="h-7 w-32" /> : format(stats.totalSent)}'''),
    # Total reçu
    ('''{isLoading ? <Skeleton className="h-7 w-32" /> : `${stats.totalReceived.toLocaleString()} FCFA`}''',
     '''{isLoading ? <Skeleton className="h-7 w-32" /> : format(stats.totalReceived)}'''),
    # Total dépôts
    ('''{isLoading ? <Skeleton className="h-7 w-32" /> : `${stats.totalDeposits.toLocaleString()} FCFA`}''',
     '''{isLoading ? <Skeleton className="h-7 w-32" /> : format(stats.totalDeposits)}'''),
]

for old, new in replacements:
    if old in src:
        src = src.replace(old, new, 1)

p.write_text(src, encoding="utf-8")
print("✅ Dashboard.tsx mis à jour")
PY

# ═══ 6. WALLET : même traitement ═══
WALLET_FILE="src/app/pages/Wallet.tsx"
cp "$WALLET_FILE" "${WALLET_FILE}.bak.currency"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/Wallet.tsx")
src = p.read_text(encoding="utf-8")

if "useCurrency" not in src:
    src = src.replace(
        'import { useWallet } from "../contexts/WalletContext";',
        'import { useWallet } from "../contexts/WalletContext";\nimport { useCurrency } from "../hooks/useCurrency";\nimport { CurrencySelector } from "../components/CurrencySelector";'
    )

if "const { format" not in src:
    anchor = "const { stats, addDeposit, addWithdrawal, checkBalance, refreshWallet, getTransactionStatus } = useWallet();"
    src = src.replace(anchor, anchor + "\n  const { format } = useCurrency();", 1)

# Remplacer l'affichage du solde
old_balance = '''<CardTitle className="text-4xl">{balance.toLocaleString()} FCFA</CardTitle>'''
new_balance = '''<CardTitle className="text-4xl">{format(balance)}</CardTitle>'''
if old_balance in src:
    src = src.replace(old_balance, new_balance, 1)

# Remplacer les stats (Reçu, Dépôts, Retraits)
# Cherche les 3 affichages dans la carte de solde
src = src.replace(
    '''<p className="text-lg font-semibold">+{stats.totalReceived.toLocaleString()} FCFA</p>''',
    '''<p className="text-lg font-semibold">+{format(stats.totalReceived)}</p>'''
)

# Ajouter le sélecteur à côté du label "Solde disponible"
old_label = '''<CardDescription className="text-teal-50">Solde disponible</CardDescription>'''
new_label = '''<CardDescription className="text-teal-50">Solde disponible</CardDescription>'''
# On met le sélecteur juste avant le Eye toggle s'il existe
# Pour Wallet, on l'ajoute juste en dessous du header
anchor = '''<WalletIcon className="w-5 h-5" />
              <CardDescription className="text-teal-50">Solde disponible</CardDescription>
            </div>'''
new_anchor = '''<WalletIcon className="w-5 h-5" />
              <CardDescription className="text-teal-50">Solde disponible</CardDescription>
              <CurrencySelector className="ml-auto" />
            </div>'''
if anchor in src and "<CurrencySelector" not in src:
    src = src.replace(anchor, new_anchor, 1)

p.write_text(src, encoding="utf-8")
print("✅ Wallet.tsx mis à jour")
PY

echo ""
echo "✅ Script terminé."
