import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Search, Loader2, Inbox, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { walletApi } from "../../../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { SkeletonTransactionList } from "../components/ui/SkeletonCard";
import { SkeletonTable } from "../components/ui/SkeletonCard";
// Type renvoyé par l'API /transactions
type ApiTransaction = {
  id: string;
  type: "deposit" | "withdrawal" | "transfer_sent" | "transfer_received";
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

// Type unifié pour l'affichage (garde la structure UI existante)
type DisplayTransaction = {
  id: string;
  direction: "sent" | "received";
  label: string;      // libellé du type (Transfert envoyé, Dépôt, etc.)
  counterpart: string; // destinataire / expéditeur / "—"
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
    case "transfer_sent":
      direction = "sent";
      label = "Transfert envoyé";
      counterpart = tx.recipient || "—";
      break;
    case "transfer_received":
      direction = "received";
      label = "Transfert reçu";
      counterpart = tx.sender || "—";
      break;
    case "deposit":
      direction = "received";
      label = "Dépôt";
      counterpart = tx.phone || "—";
      break;
    case "withdrawal":
      direction = "sent";
      label = "Retrait";
      counterpart = tx.phone || "—";
      break;
    case "platform_revenue":
      direction = "received";
      label = tx.sourceType === "transfer_fee" ? "Revenu transfert" : "Revenu retrait";
      counterpart = "—";
      break;
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
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function History() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await walletApi.getTransactions();
        const raw: ApiTransaction[] = res?.transactions || [];
        if (!cancelled) setTransactions(raw.map(toDisplay));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Impossible de charger l'historique.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === "" ||
      t.counterpart.toLowerCase().includes(q) ||
      t.method.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q) ||
      (t.note || "").toLowerCase().includes(q);

    const matchesType = filterType === "all" || t.direction === filterType;
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: DisplayTransaction["status"]) => {
    const variants = {
      completed: { variant: "default" as const, label: "Complété", className: "bg-green-500" },
      pending: { variant: "secondary" as const, label: "En attente", className: "bg-yellow-500" },
      failed: { variant: "destructive" as const, label: "Échoué", className: "bg-red-500" },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h2 className="text-2xl font-semibold text-gray-900">Historique des transactions</h2>
        <p className="text-gray-600 mt-1">Consultez toutes vos opérations</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-orange-100">
          <CardHeader>
            <CardTitle>
              {filteredTransactions.length} transaction{filteredTransactions.length > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {filterType === "all"
                ? "Toutes vos transactions"
                : filterType === "sent"
                ? "Transactions envoyées et retraits"
                : "Transactions reçues et dépôts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Loading */}
            {loading && <SkeletonTransactionList count={6} />}

            {/* Error */}
            {error && !loading && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {/* Empty */}
            {!loading && !error && filteredTransactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Inbox className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">
                  {transactions.length === 0
                    ? "Aucune transaction pour le moment."
                    : "Aucune transaction ne correspond à vos filtres."}
                </p>
              </div>
            )}

            {/* List */}
            {!loading && !error && filteredTransactions.length > 0 && (
              <div className="space-y-4">
                {filteredTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg gap-4 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          t.direction === "sent" ? "bg-red-100" : "bg-green-100"
                        }`}
                      >
                        {t.direction === "sent" ? (
                          <ArrowUpRight className="w-5 h-5 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {t.label}
                          {t.counterpart !== "—" && (
                            <span className="text-gray-500 font-normal"> · {t.counterpart}</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{t.method}</p>
                        {t.note && (
                          <p className="text-xs text-gray-400 mt-1">Note: {t.note}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6">
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            t.direction === "sent" ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {t.direction === "sent" ? "-" : "+"}
                          {t.amount.toLocaleString()} FCFA
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(t.date)}</p>
                      </div>
                      <div>{getStatusBadge(t.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}