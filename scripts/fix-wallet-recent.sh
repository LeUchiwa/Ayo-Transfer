#!/usr/bin/env bash
set -euo pipefail

WALLET_FILE="src/app/pages/Wallet.tsx"
[[ -f "$WALLET_FILE" ]] || { echo "❌ $WALLET_FILE introuvable"; exit 1; }

BACKUP="${WALLET_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$WALLET_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

PATCH_OUTPUT=$(WALLET_FILE="$WALLET_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib

p = pathlib.Path(os.environ["WALLET_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ─── PATCH 1 : Import Link + Inbox ───
if "from \"react-router\"" not in src:
    old = 'import { useState, useEffect, useRef, useCallback } from "react";'
    new = 'import { useState, useEffect, useRef, useCallback } from "react";\nimport { Link } from "react-router";'
    if old not in src:
        print("ERR: import react introuvable"); sys.exit(2)
    src = src.replace(old, new, 1); ops.append("import Link")

old_lucide = "  Banknote, CheckCircle2, Globe, ArrowRight, XCircle,"
new_lucide = "  Banknote, CheckCircle2, Globe, ArrowRight, XCircle, Inbox,"
if old_lucide not in src:
    print("ERR: bloc lucide-react introuvable"); sys.exit(2)
src = src.replace(old_lucide, new_lucide, 1); ops.append("import Inbox")

# ─── PATCH 2 : Destructurer transactions + isLoading ───
old_dest = "  const { stats, addDeposit, addWithdrawal, checkBalance, refreshWallet, getTransactionStatus } = useWallet();"
new_dest = "  const { stats, transactions, isLoading, addDeposit, addWithdrawal, checkBalance, refreshWallet, getTransactionStatus } = useWallet();"
if old_dest not in src:
    print("ERR: destructuration useWallet introuvable"); sys.exit(2)
src = src.replace(old_dest, new_dest, 1); ops.append("destructuring transactions")

# ─── PATCH 3 : Calcul recentOps avant return ───
old_return = "  // ── Render ───────────────────────────────────────────────────────────────────\n\n  return ("
new_return = '''  // ── Opérations récentes (dépôts + retraits) ────────────────────────────────
  const recentOps = transactions
    .filter((t) => t.type === "deposit" || t.type === "withdrawal")
    .slice(0, 5)
    .map((t) => {
      const isDeposit = t.type === "deposit";
      const statusLabel =
        t.status === "completed" ? "Complété" :
        t.status === "failed" ? "Échoué" :
        "En attente";
      return {
        id: t.id,
        label: `${isDeposit ? "Dépôt" : "Retrait"} ${t.method || ""}`.trim(),
        date: new Date(t.createdAt).toLocaleString("fr-FR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        }),
        amount: `${isDeposit ? "+" : "-"}${t.amount.toLocaleString()} FCFA`,
        iconBg: isDeposit ? "bg-green-500" : "bg-blue-500",
        Icon: isDeposit ? ArrowUpCircle : ArrowDownCircle,
        color: isDeposit ? "text-green-600" : "text-blue-600",
        status: t.status,
        statusLabel,
      };
    });

  // ── Render ───────────────────────────────────────────────────────────────────

  return ('''

if old_return not in src:
    print("ERR: commentaire Render introuvable"); sys.exit(2)
src = src.replace(old_return, new_return, 1); ops.append("recentOps calculé")

# ─── PATCH 4 : Remplacer le bloc Recent Operations ───
old_block = '''      {/* Recent Operations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-teal-100">
          <CardHeader>
            <CardTitle>Opérations récentes</CardTitle>
            <CardDescription>Vos derniers dépôts et retraits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Dépôt MTN MoMo", date: "2026-03-15", amount: "+50 000 FCFA", bg: "bg-green-50", iconBg: "bg-green-500", Icon: ArrowUpCircle, color: "text-green-600" },
                { label: "Retrait Orange Money", date: "2026-03-12", amount: "-30 000 FCFA", bg: "bg-blue-50", iconBg: "bg-blue-500", Icon: ArrowDownCircle, color: "text-blue-600" },
                { label: "Dépôt Wave", date: "2026-03-10", amount: "+100 000 FCFA", bg: "bg-green-50", iconBg: "bg-sky-500", Icon: ArrowUpCircle, color: "text-green-600" },
              ].map((op) => (
                <div key={op.label + op.date} className={`flex items-center justify-between p-3 ${op.bg} rounded-lg`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${op.iconBg} rounded-full flex items-center justify-center`}>
                      <op.Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{op.label}</p>
                      <p className="text-sm text-gray-500">{op.date}</p>
                    </div>
                  </div>
                  <p className={`font-semibold ${op.color}`}>{op.amount}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>'''

new_block = '''      {/* Recent Operations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-teal-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Opérations récentes</CardTitle>
                <CardDescription>Vos derniers dépôts et retraits</CardDescription>
              </div>
              {recentOps.length > 0 && (
                <Link to="/history">
                  <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
                    Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-gray-200 rounded" />
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </div>
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : recentOps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-3">
                  <Inbox className="w-8 h-8 text-teal-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Aucune opération récente</p>
                <p className="text-xs text-gray-500 mb-4">Vos dépôts et retraits apparaîtront ici</p>
                <Link to="/history">
                  <Button size="sm" variant="outline">
                    Voir l'historique complet
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOps.map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 ${op.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <op.Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{op.label}</p>
                        <p className="text-xs text-gray-500">{op.date}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className={`font-semibold ${op.color}`}>{op.amount}</p>
                      <Badge
                        variant="secondary"
                        className={
                          op.status === "completed"
                            ? "bg-green-50 text-green-700 text-[10px]"
                            : op.status === "failed"
                            ? "bg-red-50 text-red-700 text-[10px]"
                            : "bg-amber-50 text-amber-700 text-[10px]"
                        }
                      >
                        {op.statusLabel}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>'''

if old_block not in src:
    print("ERR: bloc Recent Operations introuvable"); sys.exit(2)
src = src.replace(old_block, new_block, 1); ops.append("Recent Operations dynamique")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops))
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP" "$WALLET_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "─── Vérifs ───"
echo "Import Link            : $(grep -c 'import { Link } from' "$WALLET_FILE") (doit être 1)"
echo "Import Inbox           : $(grep -c 'Inbox,' "$WALLET_FILE") (doit être 1)"
echo "transactions dans hook : $(grep -c 'transactions, isLoading, addDeposit' "$WALLET_FILE") (doit être 1)"
echo "recentOps calculé      : $(grep -c 'const recentOps =' "$WALLET_FILE") (doit être 1)"
echo "Bloc dynamique         : $(grep -c 'recentOps.map' "$WALLET_FILE") (doit être 1)"
echo ""
echo "Balance accolades      : { $(grep -o '{' "$WALLET_FILE" | wc -l) / } $(grep -o '}' "$WALLET_FILE" | wc -l)"
echo ""
echo "✅ Terminé. Backup : $BACKUP"
