import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Send, ArrowUpRight, ArrowDownRight, Wallet as WalletIcon,
  TrendingUp, Plus, History, Sparkles, Eye, EyeOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";
import { WelcomeRotator } from "../components/WelcomeRotator";
import { ReceiveMoneyModal } from "../components/ReceiveMoneyModal";
import { QrCode } from "lucide-react";
import { ActivityChart, BreakdownChart } from "../components/DashboardCharts";
import { Skeleton, TransactionSkeleton } from "../components/Skeleton";

export function Dashboard() {
  const { stats, transactions, isLoading } = useWallet();
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Message selon l'heure
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const firstName = user?.name?.split(" ")[0] || "Utilisateur";

  // Recent transactions
  const recentTransactions = transactions
    .filter(t => t.status === 'completed')
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      type: t.type === 'deposit' || t.type === 'transfer_received' ? 'received' : 'sent',
      recipient: t.recipient,
      sender: t.sender,
      amount: t.amount,
      method: t.method,
      methodIcon: t.methodIcon,
      date: new Date(t.createdAt).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      }),
      status: t.status,
    }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* ─── Hero : Bienvenue ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            {getGreeting()}, <span className="text-primary font-semibold">{firstName}</span> 👋
          </p>
        </div>

        {/* 🎯 Rotateur de bienvenue multilingue */}
        <WelcomeRotator />

        <p className="text-muted-foreground">
          Gérez vos transferts d'argent en toute simplicité
        </p>
      </motion.div>

      {/* ─── Carte de solde ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-cyan-600 border-0 text-white shadow-2xl">
          {/* Cercles décoratifs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-slate-900/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 dark:bg-slate-900/5 rounded-full translate-y-24 -translate-x-24" />

          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardDescription className="text-white/80 flex items-center gap-2">
                <WalletIcon className="w-4 h-4" />
                Solde disponible
              </CardDescription>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-white/80 hover:text-white transition-colors"
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <CardTitle className="text-4xl sm:text-5xl font-bold mt-2">
              {isLoading ? (
  <Skeleton className="h-12 w-48 bg-white/20 dark:bg-slate-900/20" />
) : (
  <>
                  {showBalance ? stats.balance.toLocaleString() : "•••••••"}
                  <span className="text-lg font-medium text-white/80 ml-2">FCFA</span>
                </>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="relative">
            <div className="flex flex-wrap gap-3">
              <Link to="/transfer">
                <Button className="bg-white dark:bg-slate-900 text-primary hover:bg-white/90 dark:bg-slate-900/90 border-0 font-semibold shadow-lg">
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer
                </Button>
              </Link>
              <Link to="/wallet">
                <Button variant="outline" className="bg-white/10 dark:bg-slate-900/10 text-white border-white/30 hover:bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Déposer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Actions rapides ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
      >
        <Link to="/transfer">
          <Card className="bg-white dark:bg-slate-900 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Envoyer</p>
            </CardContent>
          </Card>
        </Link>
        
        <button onClick={() => setShowReceiveModal(true)} className="w-full text-left">
          <Card className="bg-white dark:bg-slate-900 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-teal-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Recevoir</p>
            </CardContent>
          </Card>
        </button>

<Link to="/wallet?tab=deposit">
  <Card className="bg-white dark:bg-slate-900 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
        <Plus className="w-6 h-6 text-emerald-600" />
      </div>
      <p className="text-sm font-medium text-foreground">Déposer</p>
    </CardContent>
  </Card>
</Link>

        <Link to="/wallet?tab=withdraw">
          <Card className="bg-white dark:bg-slate-900 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Retirer</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/history">
          <Card className="bg-white dark:bg-slate-900 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <History className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Historique</p>
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {/* ─── Stats ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total envoyé
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-7 w-32" /> : `${stats.totalSent.toLocaleString()} FCFA`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.countSent} transaction{stats.countSent > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total reçu
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? "..." : `${stats.totalReceived.toLocaleString()} FCFA`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.countReceived} transaction{stats.countReceived > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total dépôts
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? "..." : `${stats.totalDeposits.toLocaleString()} FCFA`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.countDeposits} dépôt{stats.countDeposits > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </motion.div>

            {/* ─── Graphiques d'activité ─── */}
      {transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Activité</CardTitle>
              <CardDescription>Entrées et sorties sur la période</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityChart transactions={transactions} />
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Répartition</CardTitle>
              <CardDescription>Par type d'opération</CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownChart transactions={transactions} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Transactions récentes ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Transactions récentes</CardTitle>
                <CardDescription>Vos dernières opérations</CardDescription>
              </div>
              <Link to="/history">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                  Voir tout
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => <TransactionSkeleton key={i} />)}
  </div>
) : recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                  <WalletIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucune transaction</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vos transactions apparaîtront ici
                </p>
                <Link to="/transfer">
                  <Button className="mt-4 bg-primary hover:bg-primary/90 text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Faire un premier transfert
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * index }}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          transaction.type === "sent"
                            ? "bg-red-50"
                            : "bg-emerald-50"
                        }`}
                      >
                        {transaction.type === "sent" ? (
                          <ArrowUpRight className="w-5 h-5 text-red-500" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {transaction.type === "sent"
                            ? transaction.recipient || "Transfert"
                            : transaction.sender || "Réception"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.methodIcon} {transaction.method} · {transaction.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p
                        className={`font-semibold ${
                          transaction.type === "sent"
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {transaction.type === "sent" ? "-" : "+"}
                        {transaction.amount.toLocaleString()} FCFA
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <ReceiveMoneyModal 
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        userId={user?.id || ""}
        userName={user?.name || "Mon compte"}
      />
    </motion.div>
  );
}