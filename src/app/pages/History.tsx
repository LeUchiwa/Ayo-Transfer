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
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Historique des transactions</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Consultez toutes vos opérations</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border-orange-100">
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
                  <SelectItem value="platform_revenue">Revenus plateforme</SelectItem>
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
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg border-orange-100">
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
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
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
                    <div key={t.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 rounded-lg gap-4 transition-colors duration-200">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.direction === "sent" ? "bg-red-100" : "bg-green-100"}`}>
                          {t.direction === "sent" ? (
                            <ArrowUpRight className="w-5 h-5 text-red-600" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {t.label}
                            {t.counterpart !== "—" && <span className="text-gray-500 dark:text-gray-400 font-normal"> · {t.counterpart}</span>}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{t.method}</p>
                          {t.note && <p className="text-xs text-gray-400 mt-1">Note: {t.note}</p>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6">
                        <div className="text-right">
                          <p className={`font-semibold ${t.direction === "sent" ? "text-red-600" : "text-green-600"}`}>
                            {t.direction === "sent" ? "-" : "+"}{t.amount.toLocaleString()} FCFA
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(t.date)}</p>
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
