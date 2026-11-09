#!/usr/bin/env bash
set -euo pipefail

FUNCTION_FILE="supabase/functions/server/index.ts"
API_FILE="utils/api.ts"
HISTORY_FILE="src/app/pages/History.tsx"

for f in "$FUNCTION_FILE" "$API_FILE" "$HISTORY_FILE"; do
  [[ -f "$f" ]] || { echo "❌ $f introuvable"; exit 1; }
done

# Backups
for f in "$FUNCTION_FILE" "$API_FILE" "$HISTORY_FILE"; do
  cp "$f" "${f}.bak.$(date +%Y%m%d_%H%M%S)"
  echo "🔒 Backup → ${f}.bak.$(date +%Y%m%d_%H%M%S)"
done

# ═══════════════════════════════════════════════
# PATCH 1 — Backend : ajouter status + direction
# ═══════════════════════════════════════════════
echo ""
echo "🩹 Patch 1/3 — Backend handleGetTransactions"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")

old = '''  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.toLowerCase().trim();

  let filtered: any[] = [...transactions];
  if (type && type !== "all") filtered = filtered.filter((t: any) => t.type === type);'''

new = '''  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const direction = url.searchParams.get("direction");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.toLowerCase().trim();

  let filtered: any[] = [...transactions];
  if (type && type !== "all") filtered = filtered.filter((t: any) => t.type === type);
  if (status && status !== "all") filtered = filtered.filter((t: any) => t.status === status);
  if (direction === "sent") filtered = filtered.filter((t: any) => t.type === "withdrawal" || t.type === "transfer_sent");
  if (direction === "received") filtered = filtered.filter((t: any) => t.type === "deposit" || t.type === "transfer_received");'''

if old not in src:
    print("ERR: bloc pagination backend introuvable"); sys.exit(2)
src = src.replace(old, new, 1)
p.write_text(src, encoding="utf-8")
print("OK: status + direction ajoutés")
PY

# ═══════════════════════════════════════════════
# PATCH 2 — utils/api.ts : étendre getTransactions
# ═══════════════════════════════════════════════
echo ""
echo "🩹 Patch 2/3 — getTransactions avec paramètres"

API_FILE="$API_FILE" python3 <<'PY'
import os, sys, pathlib
p = pathlib.Path(os.environ["API_FILE"])
src = p.read_text(encoding="utf-8")

old = "  getTransactions: () => apiCall('/transactions'),"

new = '''  getTransactions: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    direction?: string;
    q?: string;
    from?: string;
    to?: string;
  }) => {
    const search: string[] = [];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          search.push(`${k}=${encodeURIComponent(String(v))}`);
        }
      }
    }
    const qs = search.length ? `?${search.join("&")}` : "";
    return apiCall(`/transactions${qs}`);
  },'''

if old not in src:
    print("ERR: getTransactions introuvable"); sys.exit(2)
src = src.replace(old, new, 1)
p.write_text(src, encoding="utf-8")
print("OK: getTransactions étendu")
PY

# ═══════════════════════════════════════════════
# PATCH 3 — History.tsx : réécriture complète
# ═══════════════════════════════════════════════
echo ""
echo "🩹 Patch 3/3 — History.tsx avec pagination"

cat > "$HISTORY_FILE" <<'EOF'
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Search, Loader2, Inbox, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { walletApi } from "../../../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { SkeletonTransactionList } from "../components/ui/SkeletonCard";

type ApiTransaction = {
  id: string;
  type: "deposit" | "withdrawal" | "transfer_sent" | "transfer_received" | "platform_revenue";
  status: "completed" | "pending" | "failed";
  amount: number;
  fee?: number;
  method?: string;
  methodIcon?: string;
  recipient?: string;
  sender?: string;
  phone?: string;
  reference?: string;
  failureReason?: string;
  createdAt: string;
};

type DisplayTransaction = {
  id: string;
  direction: "sent" | "received";
  label: string;
  counterpart: string;
  amount: number;
  method: string;
  date: string;
  status: "completed" | "pending" | "failed";
  note?: string;
};

function toDisplay(tx: ApiTransaction): DisplayTransaction {
  let direction: "sent" | "received" = "sent";
  let label = "";
  let counterpart = "—";

  switch (tx.type) {
    case "transfer_sent": direction = "sent"; label = "Transfert envoyé"; counterpart = tx.recipient || "—"; break;
    case "transfer_received": direction = "received"; label = "Transfert reçu"; counterpart = tx.sender || "—"; break;
    case "deposit": direction = "received"; label = "Dépôt"; counterpart = tx.phone || "—"; break;
    case "withdrawal": direction = "sent"; label = "Retrait"; counterpart = tx.phone || "—"; break;
    default: direction = "received"; label = tx.type; counterpart = "—";
  }

  return {
    id: tx.id,
    direction,
    label,
    counterpart,
    amount: tx.amount,
    method: tx.method || "—",
    date: tx.createdAt,
    status: tx.status,
    note: tx.failureReason,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const PAGE_SIZE = 20;

export function History() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Debounce recherche (400ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadPage = useCallback(async (pageToLoad: number, append: boolean) => {
    if (!user) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await walletApi.getTransactions({
        page: pageToLoad,
        limit: PAGE_SIZE,
        direction: filterType,
        status: filterStatus,
        q: searchQuery,
      });

      const mapped: DisplayTransaction[] = (res.transactions || []).map(toDisplay);

      if (append) {
        setTransactions(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          return [...prev, ...mapped.filter(t => !existingIds.has(t.id))];
        });
      } else {
        setTransactions(mapped);
      }
      setHasMore(Boolean(res.hasMore));
      setTotal(Number(res.total) || 0);
      setPage(pageToLoad);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, filterType, filterStatus, searchQuery]);

  // Reset + rechargement page 1 quand filtres/recherche changent
  useEffect(() => {
    if (!user) return;
    setPage(1);
    loadPage(1, false);
  }, [user, filterType, filterStatus, searchQuery, loadPage]);

  const getStatusBadge = (status: DisplayTransaction["status"]) => {
    const variants = {
      completed: { variant: "default" as const, label: "Complété", className: "bg-green-500" },
      pending: { variant: "secondary" as const, label: "En attente", className: "bg-yellow-500" },
      failed: { variant: "destructive" as const, label: "Échoué", className: "bg-red-500" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const hasFilters = filterType !== "all" || filterStatus !== "all" || searchQuery !== "";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <h2 className="text-2xl font-semibold text-gray-900">Historique des transactions</h2>
        <p className="text-gray-600 mt-1">Consultez toutes vos opérations</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher (destinataire, méthode...)"
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type de transaction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les transactions</SelectItem>
                  <SelectItem value="sent">Envoyées / Retraits</SelectItem>
                  <SelectItem value="received">Reçues / Dépôts</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="completed">Complété</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="failed">Échoué</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {loading ? "Chargement…" : `${total} transaction${total > 1 ? "s" : ""}`}
                </CardTitle>
                <CardDescription>
                  {filterType === "all"
                    ? "Toutes vos transactions"
                    : filterType === "sent"
                    ? "Transactions envoyées et retraits"
                    : "Transactions reçues et dépôts"}
                  {hasFilters && total > 0 && " (filtrées)"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPage(1, false)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && <SkeletonTransactionList count={6} />}

            {error && !loading && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
                <Button size="sm" variant="outline" onClick={() => loadPage(1, false)} className="ml-auto">
                  Réessayer
                </Button>
              </div>
            )}

            {!loading && !error && transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Inbox className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">
                  {hasFilters
                    ? "Aucune transaction ne correspond à vos filtres."
                    : "Aucune transaction pour le moment."}
                </p>
                {hasFilters && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => { setFilterType("all"); setFilterStatus("all"); setSearchInput(""); }}
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            )}

            {!loading && !error && transactions.length > 0 && (
              <>
                <div className="space-y-4">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg gap-4 transition-colors duration-200">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.direction === "sent" ? "bg-red-100" : "bg-green-100"}`}>
                          {t.direction === "sent" ? (
                            <ArrowUpRight className="w-5 h-5 text-red-600" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {t.label}
                            {t.counterpart !== "—" && <span className="text-gray-500 font-normal"> · {t.counterpart}</span>}
                          </p>
                          <p className="text-sm text-gray-500">{t.method}</p>
                          {t.note && <p className="text-xs text-gray-400 mt-1">Note: {t.note}</p>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6">
                        <div className="text-right">
                          <p className={`font-semibold ${t.direction === "sent" ? "text-red-600" : "text-green-600"}`}>
                            {t.direction === "sent" ? "-" : "+"}{t.amount.toLocaleString()} FCFA
                          </p>
                          <p className="text-sm text-gray-500">{formatDate(t.date)}</p>
                        </div>
                        <div>{getStatusBadge(t.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charger plus */}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => loadPage(page + 1, true)}
                      disabled={loadingMore}
                      variant="outline"
                      className="w-full md:w-auto"
                    >
                      {loadingMore ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement…</>
                      ) : (
                        `Charger plus (${transactions.length}/${total})`
                      )}
                    </Button>
                  </div>
                )}

                {!hasMore && transactions.length > 0 && transactions.length === total && total > PAGE_SIZE && (
                  <p className="text-center text-xs text-gray-400 mt-6">
                    Vous avez vu toutes les transactions.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
EOF
echo "✅ History.tsx réécrit"

echo ""
echo "════════════════════════════════════════════════"
echo "✅ Terminé"
echo "════════════════════════════════════════════════"
echo ""
echo "Prochaines étapes :"
echo "  1. supabase functions deploy server --no-verify-jwt   (backend)"
echo "  2. npm run dev                                         (test local)"
echo "  3. Tester /history → filtres + charger plus"
echo "  4. Si OK : git commit + wrangler deploy"
