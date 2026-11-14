import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { SkeletonTable } from "../components/ui/SkeletonCard";
import {
  Users, Send, TrendingUp, AlertCircle, CheckCircle, Clock, XCircle,
  Search, RefreshCw, Shield, Settings, BarChart3, ShieldCheck, FileText,
  ArrowUpRight, ArrowDownRight, Eye, Ban, ChevronDown, LogOut,
  DollarSign, Activity, Globe, Smartphone, Inbox, Loader2, X,
  User as UserIcon, Calendar, Mail, Phone,
  CreditCard, Building2, Wallet as WalletIcon, Copy, KeyRound, Download, Plus,
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { getAdminToken } from "../../../utils/adminApi";
import { exportToCSV } from "../../../utils/csvExport";
import { projectId } from "../../../utils/supabase/info";
import ayoLogo from "@/imports/AYO.png";
import { Button } from "../components/ui/button";
import { AdminNewsTab } from "../components/AdminNewsTab";
import { ServiceLogo } from "../components/ServiceLogo";

// ─── Config API ───────────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

async function adminCall(endpoint: string, options: { method?: string; body?: any } = {}) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin not authenticated — please login again");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `API error: ${response.status}`);
  }
  return response.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingDeposit {
  id: string;
  userId: string;
  type: string;
  amount: number;
  fee: number;
  status: string;
  reference: string;
  method: string;
  methodIcon?: string;
  phone?: string;
  createdAt: string;
  // ⬇️ Nouveaux champs pour le flux en 2 étapes
  coords?: {
    label: string;
    value: string;
    instructions: string;
    expiresAt: string;
    setAt?: string;
    setBy?: string;
  };
  clientInfo?: {
    txRef: string;
    screenshotUrl?: string | null;
    submittedAt: string;
  };
  cancelledAt?: string;
  cancelReason?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  balance: number;
  totalSent: number;
  totalReceived: number;
  totalDeposits: number;
  totalWithdrawals: number;
  countSent: number;
  countReceived: number;
  suspicious?: boolean;
}

interface AdminService {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
  depositFee: number;
  withdrawFee: number;
  active: boolean;
  transactions: number;
  volume: number;
  deposits: number;
  withdrawals: number;
  transfers: number;
}

interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  amount: number;
  fee: number;
  status: string;
  reference: string;
  method: string;
  methodIcon?: string;
  phone?: string;
  recipient?: string;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

interface AdminStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;
  countDeposits: number;
  countWithdrawals: number;
  countTransfers: number;
  countPending: number;
  totalBalance: number;
  totalWalletCount: number;
}

interface AdminSettings {
  platformName: string;
  transferFee: number;
  minAmount: number;
  maxAmount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getServiceTypeIcon(type: string) {
  switch (type) {
    case "mobile-money": return Smartphone;
    case "digital": return WalletIcon;
    case "agent": return Building2;
    case "card": return CreditCard;
    case "bank": return Building2;
    default: return Globe;
  }
}

function getServiceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    "mobile-money": "Mobile Money",
    "digital": "Wallet digital",
    "agent": "Agence",
    "card": "Carte bancaire",
    "bank": "Banque",
  };
  return labels[type] || type;
}

function getTransactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    "deposit": "Dépôt",
    "withdrawal": "Retrait",
    "transfer_sent": "Transfert envoyé",
    "transfer_received": "Transfert reçu",
    "platform_revenue": "Revenu plateforme",
  };
  return labels[type] || type;
}

function getTransactionTypeClass(type: string) {
  switch (type) {
    case "deposit": return "bg-green-50 text-green-700";
    case "withdrawal": return "bg-red-50 text-red-700";
    case "transfer_sent": return "bg-blue-50 text-blue-700";
    case "transfer_received": return "bg-teal-50 text-teal-700";
    case "platform_revenue": return "bg-purple-50 text-purple-700 font-semibold border border-purple-200";
    default: return "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300";
  }
}

// ⬇️ Helper : badge de statut pour les dépôts (nouveau flux)
function DepositStatusBadge({ status }: { status?: string }) {
  const effective = status || "awaiting_coords";
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_coords:    { label: "En attente admin",  cls: "bg-amber-50 text-amber-700" },
    coords_ready:       { label: "En attente client", cls: "bg-blue-50 text-blue-700" },
    pending_validation: { label: "À valider",         cls: "bg-orange-50 text-orange-700" },
    pending:            { label: "À valider",         cls: "bg-orange-50 text-orange-700" },
    cancelled:          { label: "Annulé",            cls: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400" },
    completed:          { label: "Complété",          cls: "bg-green-50 text-green-700" },
    failed:             { label: "Échoué",            cls: "bg-red-50 text-red-700" },
  };
  const config = map[effective] || { label: effective, cls: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}>
      {config.label}
    </span>
  );
}

// ⬇️ Helper : temps restant formaté
function formatTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    completed:          { label: "Complété",            cls: "bg-green-50 text-green-700",  icon: CheckCircle },
    active:             { label: "Actif",               cls: "bg-green-50 text-green-700",  icon: CheckCircle },
    pending:            { label: "En attente",          cls: "bg-amber-50 text-amber-700",  icon: Clock },
    awaiting_coords:    { label: "En attente admin",    cls: "bg-amber-50 text-amber-700",  icon: Clock },
    coords_ready:       { label: "En attente client",   cls: "bg-blue-50 text-blue-700",    icon: Clock },
    pending_validation: { label: "À valider",           cls: "bg-orange-50 text-orange-700", icon: AlertCircle },
    processing:         { label: "En cours",            cls: "bg-blue-50 text-blue-700",    icon: RefreshCw },
    failed:             { label: "Échoué",              cls: "bg-red-50 text-red-700",      icon: XCircle },
    cancelled:          { label: "Annulé",              cls: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400",   icon: XCircle },
    suspended:          { label: "Suspendu",            cls: "bg-red-50 text-red-700",      icon: Ban },
  };
  const { label, cls, icon: Icon } = map[status] ?? { label: status, cls: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400", icon: AlertCircle };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
        <ShieldCheck className="w-3 h-3" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
      <UserIcon className="w-3 h-3" />
      User
    </span>
  );
}

function SuspensionBadge({ bannedUntil }: { bannedUntil: string | null }) {
  if (!bannedUntil) return null;
  const isBanned = new Date(bannedUntil) > new Date();
  if (!isBanned) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
      <Ban className="w-3 h-3" />
      Suspendu
    </span>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────

function UserDetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{user.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
              {user.suspicious && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                  ⚠️ Suspect
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Rôle</span>
            <RoleBadge role={user.role} />
          </div>

          <div className="bg-gradient-to-br from-primary to-foreground rounded-xl p-5 text-white">
            <p className="text-xs opacity-80 mb-1">Solde actuel</p>
            <p className="text-3xl font-bold">{user.balance.toLocaleString()} FCFA</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-700 mb-1">Total reçu</p>
              <p className="text-lg font-bold text-green-800">{user.totalReceived.toLocaleString()} FCFA</p>
              <p className="text-xs text-green-600">{user.countReceived} transactions</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-700 mb-1">Total envoyé</p>
              <p className="text-lg font-bold text-blue-800">{user.totalSent.toLocaleString()} FCFA</p>
              <p className="text-xs text-blue-600">{user.countSent} transactions</p>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Inscription</p>
                <p className="text-sm text-foreground font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Dernière connexion</p>
                <p className="text-sm text-foreground font-medium">{formatDate(user.lastSignInAt)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Email confirmé</p>
                <p className="text-sm text-foreground font-medium">
                  {user.emailConfirmedAt ? "✅ Oui" : "⚠️ Non"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Service Detail Modal ─────────────────────────────────────────────────────

function ServiceDetailModal({ service, onClose }: { service: AdminService; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center text-2xl">
              {service.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{service.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{getServiceTypeLabel(service.type)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-br from-primary to-foreground rounded-xl p-5 text-white">
            <p className="text-xs opacity-80 mb-1">Volume total traité</p>
            <p className="text-3xl font-bold">{service.volume.toLocaleString()} FCFA</p>
            <p className="text-xs opacity-80 mt-1">{service.transactions} transactions</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Répartition</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <ArrowDownRight className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-green-700">Dépôts</p>
                <p className="text-lg font-bold text-green-800">{service.deposits}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <ArrowUpRight className="w-4 h-4 text-red-600 mx-auto mb-1" />
                <p className="text-xs text-red-700">Retraits</p>
                <p className="text-lg font-bold text-red-800">{service.withdrawals}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <Send className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-blue-700">Transferts</p>
                <p className="text-lg font-bold text-blue-800">{service.transfers}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Frais appliqués</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600 dark:text-gray-400">Dépôt</span>
                <span className="text-sm font-medium text-foreground">{(service.depositFee * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Retrait</span>
                <span className="text-sm font-medium text-foreground">{(service.withdrawFee * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

function TransactionDetailModal({ tx, onClose }: { tx: AdminTransaction; onClose: () => void }) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-foreground">Transaction</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tx.reference}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${getTransactionTypeClass(tx.type)}`}>
              {getTransactionTypeLabel(tx.type)}
            </span>
            <StatusBadge status={tx.status} />
          </div>

          <div className="bg-gradient-to-br from-primary to-foreground rounded-xl p-5 text-white">
            <p className="text-xs opacity-80 mb-1">Montant</p>
            <p className="text-3xl font-bold">{tx.amount.toLocaleString()} FCFA</p>
            {tx.fee > 0 && (
              <p className="text-xs opacity-80 mt-1">Frais : {tx.fee.toLocaleString()} FCFA</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <UserIcon className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Utilisateur</p>
                <p className="text-sm text-foreground font-medium">{tx.userName || "Inconnu"}</p>
                {tx.userEmail && <p className="text-xs text-gray-400">{tx.userEmail}</p>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Service</p>
                <p className="text-sm text-foreground font-medium">{tx.methodIcon} {tx.method}</p>
                {tx.phone && <p className="text-xs text-gray-400">Tél : {tx.phone}</p>}
              </div>
            </div>
            {tx.recipient && (
              <div className="flex items-start gap-3">
                <Send className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Destinataire</p>
                  <p className="text-sm text-foreground font-medium">{tx.recipient}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Créée le</p>
                <p className="text-sm text-foreground font-medium">{formatDate(tx.createdAt)}</p>
              </div>
            </div>
            {tx.completedAt && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Complétée le</p>
                  <p className="text-sm text-foreground font-medium">{formatDate(tx.completedAt)}</p>
                </div>
              </div>
            )}
            {tx.failedAt && (
              <div className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Échouée le</p>
                  <p className="text-sm text-foreground font-medium">{formatDate(tx.failedAt)}</p>
                  {tx.failureReason && <p className="text-xs text-red-600 mt-1">{tx.failureReason}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Password Rotation Modal ──────────────────────────────────────────────────

function PasswordRotationModal({
  newPassword,
  onClose,
}: {
  newPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Nouveau mot de passe</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Notez-le MAINTENANT</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
          ⚠️ Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Copiez-le et stockez-le dans un endroit sûr.
        </div>

        <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Identifiant :</p>
          <p className="font-mono text-sm font-bold text-foreground mb-3">AYO-ADMIN</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mot de passe :</p>
          <p className="font-mono text-lg font-bold text-primary break-all">{newPassword}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/85 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copier le mot de passe
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────

type Tab = "overview" | "pending" | "kyc" | "users" | "transactions" | "services" | "settings" | "news";

export function Admin() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Pending deposits
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingDeposit[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; deposit: PendingDeposit | null; reason: string }>({
    open: false, deposit: null, reason: "",
  });

  // ⬇️ NOUVEAU : modal pour renseigner les coordonnées
  const [coordsModal, setCoordsModal] = useState<{
    open: boolean;
    deposit: PendingDeposit | null;
    label: string;
    value: string;
    instructions: string;
  }>({ open: false, deposit: null, label: "", value: "", instructions: "" });

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Services
  const [services, setServices] = useState<AdminService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<AdminService | null>(null);
  const [togglingService, setTogglingService] = useState<string | null>(null);

  // ⬇️ NOUVEAU : Modal de création/édition de service
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    service: {
      id: string;
      name: string;
      description: string;
      icon: string;
      color: string;
      type: string;
      depositFee: number;
      withdrawFee: number;
      active: boolean;
    };
  }>({
    open: false,
    mode: "create",
    service: {
      id: "", name: "", description: "", icon: "💳",
      color: "bg-gray-500", type: "mobile-money",
      depositFee: 0, withdrawFee: 0, active: true,
    },
  });

  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    user: AdminUser | null;
    reason: string;
    activity: any | null;
    loadingActivity: boolean;
  }>({ open: false, user: null, reason: "", activity: null, loadingActivity: false });


  const [serviceSaving, setServiceSaving] = useState(false);
  const [deleteServiceModal, setDeleteServiceModal] = useState<{ open: boolean; service: AdminService | null }>({
    open: false, service: null,
  });

  // Transactions
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState<AdminTransaction | null>(null);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Password rotation
  const [rotatingPassword, setRotatingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  // KYC
  const [kycList, setKycList] = useState<any[]>([]);
  const [loadingKyc, setLoadingKyc] = useState(false);

  // Settings
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [depositCoords, setDepositCoords] = useState<any>(null);
  const [savingCoords, setSavingCoords] = useState(false);
  const [coordsSaved, setCoordsSaved] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ─── Chargement ────────────────────────────────────────────────────────────

  const loadPendingDeposits = async () => {
    setLoadingPending(true);
    setPendingError(null);
    try {
      const data = await adminCall("/admin/deposits/pending");
      setPendingDeposits(data.deposits || []);
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoadingPending(false);
    }
  };

  const loadPendingWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const data = await adminCall("/admin/withdrawals/pending");
      setPendingWithdrawals(data.withdrawals || []);
    } catch (err) {
      console.error("Failed to load withdrawals:", err);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await adminCall("/admin/users");
      setUsers(data.users || []);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadServices = async () => {
    setLoadingServices(true);
    setServicesError(null);
    try {
      const data = await adminCall("/admin/services");
      setServices(data.services || []);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoadingServices(false);
    }
  };

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    setTransactionsError(null);
    try {
      const params = new URLSearchParams();
      if (txTypeFilter !== "all") params.set("type", txTypeFilter);
      if (txStatusFilter !== "all") params.set("status", txStatusFilter);
      params.set("limit", "200");

      const data = await adminCall(`/admin/transactions?${params.toString()}`);
      setTransactions(data.transactions || []);
    } catch (err) {
      setTransactionsError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await adminCall("/admin/stats");
      setStats(data.stats || null);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadKyc = async () => {
    setLoadingKyc(true);
    try {
      const data = await adminCall("/admin/kyc");
      setKycList(data.kyc || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingKyc(false);
    }
  };

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await adminCall("/admin/settings");
      setSettings(data.settings || null);

      const coordsData = await adminCall("/admin/deposit-coords");
      setDepositCoords(coordsData.coords || null);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "overview") {
      loadPendingDeposits();
      loadStats();
      loadUsers();
    }
    if (activeTab === "pending") {
      loadPendingDeposits();
      loadPendingWithdrawals();
    }
    if (activeTab === "users") loadUsers();
    if (activeTab === "services") loadServices();
    if (activeTab === "transactions") loadTransactions();
    if (activeTab === "settings") loadSettings();
    if (activeTab === "kyc") loadKyc();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "transactions") {
      loadTransactions();
    }
  }, [txTypeFilter, txStatusFilter]);

  // 🔄 Polling auto des dépôts en attente (toutes les 10 sec)
  useEffect(() => {
    if (activeTab !== "pending") return;
    const interval = setInterval(() => {
      loadPendingDeposits();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleConfirm = async (deposit: PendingDeposit) => {
    // ⬇️ Protection : on ne peut confirmer que si le client a soumis ses infos
    if (deposit.status !== "pending_validation" && deposit.status !== "pending") {
      alert(
        `Ce dépôt est au statut "${deposit.status || "awaiting_coords"}".\n\n` +
        `Il faut d'abord envoyer les coordonnées au client, attendre qu'il paie et soumette son numéro de transaction.`
      );
      return;
    }

    if (!confirm(`Confirmer le dépôt de ${deposit.amount.toLocaleString()} FCFA pour ${deposit.reference} ?\n\nLe wallet de l'utilisateur sera crédité.`)) return;

    setProcessingId(deposit.id);
    try {
      await adminCall(`/admin/deposits/${deposit.id}/confirm`, { method: "POST" });
      setPendingDeposits(prev => prev.filter(d => d.id !== deposit.id));
      toast.success("Dépôt confirmé, wallet crédité");
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.deposit) return;
    setProcessingId(rejectModal.deposit.id);
    try {
      await adminCall(`/admin/deposits/${rejectModal.deposit.id}/reject`, {
        method: "POST",
        body: { reason: rejectModal.reason || "Rejeté par l'administrateur" },
      });
      setPendingDeposits(prev => prev.filter(d => d.id !== rejectModal.deposit!.id));
      setRejectModal({ open: false, deposit: null, reason: "" });
      toast.success("Dépôt rejeté");
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setProcessingId(null);
    }
  };

  // ⬇️ NOUVEAU : envoyer les coordonnées au client
  const handleSetCoords = async () => {
    if (!coordsModal.deposit) return;
    if (!coordsModal.label.trim() || !coordsModal.value.trim()) {
      alert("Les champs 'Label' et 'Valeur' sont requis.");
      return;
    }

    setProcessingId(coordsModal.deposit.id);
    try {
      await adminCall(`/admin/deposits/${coordsModal.deposit.id}/coords`, {
        method: "POST",
        body: {
          label: coordsModal.label.trim(),
          value: coordsModal.value.trim(),
          instructions: coordsModal.instructions.trim(),
        },
      });
      setCoordsModal({ open: false, deposit: null, label: "", value: "", instructions: "" });
      toast.success("Coordonnées envoyées au client");
      await loadPendingDeposits();
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmWithdrawal = async (w: any) => {
    if (!confirm(`Confirmer le retrait de ${w.amount.toLocaleString()} FCFA pour ${w.reference} ?\n\nLe wallet de l'utilisateur sera débité.`)) return;
    setProcessingId(w.id);
    try {
      await adminCall(`/admin/withdrawals/${w.id}/confirm`, { method: "POST" });
      setPendingWithdrawals(prev => prev.filter(x => x.id !== w.id));
      toast.success("Retrait confirmé");
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (w: any) => {
    const reason = prompt(`Rejeter le retrait de ${w.amount.toLocaleString()} FCFA ?\n\nRaison du rejet (optionnel) :`);
    if (reason === null) return;
    setProcessingId(w.id);
    try {
      await adminCall(`/admin/withdrawals/${w.id}/reject`, {
        method: "POST",
        body: { reason: reason || "Rejeté par l'administrateur" }
      });
      setPendingWithdrawals(prev => prev.filter(x => x.id !== w.id));
      toast.success("Retrait rejeté");
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleService = async (service: AdminService) => {
    setTogglingService(service.id);
    try {
      await adminCall(`/admin/services/${service.id}/toggle`, {
        method: "POST",
        body: { active: !service.active },
      });
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, active: !s.active } : s))
      );
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setTogglingService(null);
    }
  };

  // ⬇️ NOUVEAU : Handlers CRUD services
  const handleOpenCreateService = () => {
    setServiceModal({
      open: true,
      mode: "create",
      service: {
        id: "", name: "", description: "", icon: "💳",
        color: "bg-gray-500", type: "mobile-money",
        depositFee: 0, withdrawFee: 0, active: true,
      },
    });
  };

  const handleOpenEditService = (service: AdminService) => {
    setServiceModal({
      open: true,
      mode: "edit",
      service: {
        id: service.id,
        name: service.name,
        description: (service as any).description || "",
        icon: service.icon,
        color: service.color,
        type: service.type,
        depositFee: service.depositFee * 100,
        withdrawFee: service.withdrawFee * 100,
        active: service.active,
      },
    });
  };

  const handleSaveService = async () => {
    const s = serviceModal.service;
    if (!s.id.trim() || !s.name.trim()) {
      alert("L'ID et le nom sont obligatoires");
      return;
    }

    setServiceSaving(true);
    try {
      const payload = {
        id: s.id.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
        name: s.name.trim(),
        description: s.description.trim(),
        icon: s.icon.trim() || "💳",
        color: s.color,
        type: s.type,
        depositFee: Number(s.depositFee) / 100,
        withdrawFee: Number(s.withdrawFee) / 100,
        active: s.active,
      };

      if (serviceModal.mode === "create") {
        await adminCall("/admin/services", { method: "POST", body: payload });
        toast.success("Service créé");
      } else {
        await adminCall(`/admin/services/${s.id}`, { method: "PUT", body: payload });
        toast.success("Service mis à jour");
      }

      setServiceModal({ ...serviceModal, open: false });
      await loadServices();
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setServiceSaving(false);
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!deleteServiceModal.service) return;
    try {
      await adminCall(`/admin/services/${deleteServiceModal.service.id}`, { method: "DELETE" });
      toast.success("Service supprimé");
      setDeleteServiceModal({ open: false, service: null });
      await loadServices();
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    }
  };

    const openSuspendModal = async (user: AdminUser) => {
    setSuspendModal({ open: true, user, reason: "", activity: null, loadingActivity: true });
    try {
      const res = await adminCall(`/admin/users/${user.id}/activity`);
      setSuspendModal(prev => ({ ...prev, activity: res, loadingActivity: false }));
    } catch {
      setSuspendModal(prev => ({ ...prev, loadingActivity: false }));
    }
  };

  const confirmSuspend = async () => {
    const { user, reason } = suspendModal;
    if (!user) return;
    try {
      await adminCall(`/admin/users/${user.id}/suspend`, {
        method: "POST",
        body: { reason: reason.trim() || "Non spécifiée" },
      });
      toast.success(`${user.name} suspendu`);
      setSuspendModal({ open: false, user: null, reason: "", activity: null, loadingActivity: false });
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleReactivateUser = async (user: AdminUser) => {
    if (!confirm(`Réactiver ${user.name} (${user.email}) ?`)) return;

    try {
      await adminCall(`/admin/users/${user.id}/reactivate`, { method: "POST" });
      toast.success(`${user.name} réactivé`);
      await loadUsers();
    } catch (err) {
      toast.error("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    }
  };

  const handleExportUsers = () => {
    if (users.length === 0) {
      toast.error("Aucun utilisateur à exporter");
      return;
    }

    const headers = [
      "ID", "Nom", "Email", "Rôle", "Solde (FCFA)", "Total envoyé", "Total reçu",
      "Total dépôts", "Total retraits", "Nb envoyés", "Nb reçus", "Inscription",
      "Dernière connexion", "Statut",
    ];

    const rows = users.map((u) => [
      u.id, u.name, u.email, u.role, u.balance, u.totalSent, u.totalReceived,
      u.totalDeposits, u.totalWithdrawals, u.countSent, u.countReceived,
      new Date(u.createdAt).toLocaleString("fr-FR"),
      u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("fr-FR") : "Jamais",
      u.bannedUntil && new Date(u.bannedUntil) > new Date() ? "Suspendu" : "Actif",
    ]);

    exportToCSV("utilisateurs_ayo", headers, rows);
    toast.success(`${users.length} utilisateurs exportés`);
  };

  const handleExportTransactions = () => {
    if (transactions.length === 0) {
      toast.error("Aucune transaction à exporter");
      return;
    }

    const headers = [
      "Référence", "Date", "Utilisateur", "Email", "Type", "Montant (FCFA)",
      "Frais (FCFA)", "Service", "Téléphone", "Destinataire", "Statut",
      "Complétée le", "Échouée le", "Raison échec",
    ];

    const rows = transactions.map((tx) => [
      tx.reference, new Date(tx.createdAt).toLocaleString("fr-FR"), tx.userName,
      tx.userEmail, getTransactionTypeLabel(tx.type), tx.amount, tx.fee,
      tx.method, tx.phone || "", tx.recipient || "", tx.status,
      tx.completedAt ? new Date(tx.completedAt).toLocaleString("fr-FR") : "",
      tx.failedAt ? new Date(tx.failedAt).toLocaleString("fr-FR") : "",
      tx.failureReason || "",
    ]);

    exportToCSV("transactions_ayo", headers, rows);
    toast.success(`${transactions.length} transactions exportées`);
  };

  const handleApproveKyc = async (userId: string) => {
    if (!confirm("Approuver ce dossier KYC ?")) return;
    try {
      await adminCall(`/admin/kyc/${userId}/approve`, { method: "POST" });
      toast.success("KYC approuvé");
      loadKyc();
    } catch (err) { alert("Erreur"); }
  };

  const handleRejectKyc = async (userId: string) => {
    const reason = prompt("Raison du rejet :");
    if (reason === null) return;
    try {
      await adminCall(`/admin/kyc/${userId}/reject`, { method: "POST", body: { reason: reason || "Non conforme" } });
      toast.success("KYC rejeté");
      loadKyc();
    } catch (err) { alert("Erreur"); }
  };

  const viewDocument = async (userId: string, type: "recto" | "verso" | "selfie" = "recto") => {
    try {
      const data = await adminCall(`/admin/kyc/${userId}/document?type=${type}`);
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("Lien introuvable.");
      }
    } catch (err) {
      alert("Impossible d'ouvrir le document : " + (err instanceof Error ? err.message : "Erreur inconnue"));
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const data = await adminCall("/admin/settings", {
        method: "POST",
        body: settings,
      });
      setSettings(data.settings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveDepositCoords = async () => {
    if (!depositCoords) return;
    setSavingCoords(true);
    setCoordsSaved(false);
    try {
      await adminCall("/admin/deposit-coords", { method: "POST", body: depositCoords });
      setCoordsSaved(true);
      setTimeout(() => setCoordsSaved(false), 3000);
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setSavingCoords(false);
    }
  };

  const handleRotatePassword = async () => {
    if (!confirm("Générer un nouveau mot de passe admin ?\n\nL'ancien mot de passe ne fonctionnera plus. Assurez-vous de noter le nouveau.")) return;

    setRotatingPassword(true);
    try {
      const data = await adminCall("/admin/rotate-password", { method: "POST" });
      setNewPassword(data.password);
    } catch (err) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setRotatingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // ─── Filtres ───────────────────────────────────────────────────────────────

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredTransactions = transactions.filter(tx => {
    if (!txSearch) return true;
    const s = txSearch.toLowerCase();
    return (
      tx.reference.toLowerCase().includes(s) ||
      tx.userName.toLowerCase().includes(s) ||
      tx.userEmail.toLowerCase().includes(s) ||
      tx.method.toLowerCase().includes(s)
    );
  });

  const totalBalance = stats?.totalBalance || 0;
  const totalVolume = (stats?.totalDeposits || 0) + (stats?.totalWithdrawals || 0) + (stats?.totalTransfers || 0);

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview",     label: "Vue d'ensemble", icon: BarChart3 },
    { id: "pending",      label: "Validations", icon: Inbox, badge: pendingDeposits.length + pendingWithdrawals.length },
    { id: "kyc",          label: "Vérifications KYC", icon: ShieldCheck, badge: kycList.length },
    { id: "users",        label: "Utilisateurs",   icon: Users, badge: users.length },
    { id: "transactions", label: "Transactions",   icon: Activity },
    { id: "services",     label: "Services",       icon: Globe, badge: services.length },
    { id: "news",         label: "Actualités",     icon: FileText },
    { id: "settings",     label: "Paramètres",     icon: Settings },
    
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-foreground flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="p-5 border-b border-white/10">
          <ImageWithFallback src={ayoLogo} alt="AYO" className="h-10 w-auto object-contain" />
          <p className="text-white/50 text-xs mt-1 pl-1">Panneau Administrateur</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "text-white/60 hover:bg-white/10 dark:bg-slate-900/10 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 dark:bg-slate-900/10 hover:text-white transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            Retour à l'app
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60">
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-gray-400">Plateforme AYO — Espace d'administration</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Système opérationnel
            </div>
          </div>
        </header>

        <main className="p-8">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
  >
          {/* Overview */}
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Utilisateurs"
                  value={String(stats?.totalWalletCount || users.length)}
                  sub="Comptes créés"
                  color="bg-blue-50 text-primary"
                />
                <StatCard
                  icon={Inbox}
                  label="Validations"
                  value={String(pendingDeposits.length + pendingWithdrawals.length)}
                  sub="À traiter"
                  color="bg-amber-50 text-amber-600"
                />
                <StatCard
                  icon={DollarSign}
                  label="Soldes cumulés"
                  value={`${(totalBalance / 1000000).toFixed(2)}M FCFA`}
                  sub="Total des wallets"
                  color="bg-green-50 text-green-600"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Volume échangé"
                  value={`${(totalVolume / 1000000).toFixed(2)}M FCFA`}
                  sub={`${(stats?.countDeposits || 0) + (stats?.countWithdrawals || 0) + (stats?.countTransfers || 0)} transactions`}
                  color="bg-purple-50 text-purple-600"
                />
              </div>

              {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowDownRight className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dépôts</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.totalDeposits.toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{stats.countDeposits} transactions</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowUpRight className="w-4 h-4 text-red-600" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Retraits</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.totalWithdrawals.toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{stats.countWithdrawals} transactions</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Transferts</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.totalTransfers.toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{stats.countTransfers} transactions</p>
                  </div>
                </div>
              )}

              {(pendingDeposits.length + pendingWithdrawals.length) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">
                      {pendingDeposits.length + pendingWithdrawals.length} opération(s) en attente de validation
                    </p>
                    <button
                      onClick={() => setActiveTab("pending")}
                      className="mt-2 text-xs font-medium text-amber-800 underline hover:no-underline"
                    >
                      Voir les validations →
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Pending (Deposits & Withdrawals) */}
          {activeTab === "pending" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Section Dépôts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Dépôts en attente</h3>
                  <button
                    onClick={loadPendingDeposits}
                    disabled={loadingPending}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary"
                  >
                    Rafraîchir
                  </button>
                </div>
                {pendingError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-3">
                    Erreur : {pendingError}
                  </div>
                )}
                {loadingPending && pendingDeposits.length === 0 ? (
                  <SkeletonTable rows={3} cols={7} />
                ) : pendingDeposits.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 text-center text-gray-400 text-sm">
                    Aucun dépôt en attente
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Référence</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Service</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Téléphone</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pendingDeposits.map((deposit, i) => (
                          <motion.tr
                            key={deposit.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.03 }}
                            className="hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50/50"
                          >
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(deposit.createdAt).toLocaleString("fr-FR", {
                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                              })}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{deposit.reference}</td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {deposit.amount.toLocaleString()} FCFA
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{deposit.method}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{deposit.phone || "—"}</td>

                            {/* ⬇️ NOUVEAU : colonne Statut */}
                            <td className="px-4 py-3">
                              <DepositStatusBadge status={deposit.status} />
                              {deposit.status === "coords_ready" && deposit.coords?.expiresAt && (
                                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimeRemaining(deposit.coords.expiresAt)}
                                </p>
                              )}
                            </td>

                            {/* ⬇️ MODIFIÉ : boutons conditionnels selon le statut */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {/* Statut 1 : awaiting_coords (ou undefined pour anciennes tx) */}
                                {(!deposit.status || deposit.status === "awaiting_coords") && (
                                  <button
                                    onClick={() =>
                                      setCoordsModal({ open: true, deposit, label: "", value: "", instructions: "" })
                                    }
                                    disabled={processingId === deposit.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                                  >
                                    {processingId === deposit.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Phone className="w-3.5 h-3.5" />
                                    )}
                                    Renseigner coordonnées
                                  </button>
                                )}

                                {/* Statut 2 : coords_ready — rien à faire, le client doit payer */}
                                {deposit.status === "coords_ready" && (
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                                    <Clock className="w-3.5 h-3.5" />
                                    En attente du paiement client
                                  </span>
                                )}

                                {/* Statut 3 : pending_validation (ou legacy "pending") — Confirmer / Rejeter */}
                                {(deposit.status === "pending_validation" || deposit.status === "pending") && (
                                  <>
                                    <button
                                      onClick={() => handleConfirm(deposit)}
                                      disabled={processingId === deposit.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {processingId === deposit.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      )}
                                      Confirmer
                                    </button>
                                    <button
                                      onClick={() => setRejectModal({ open: true, deposit, reason: "" })}
                                      disabled={processingId === deposit.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      Rejeter
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Référence client soumise (si présente) */}
                              {deposit.clientInfo?.txRef && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                                  Réf. client : <span className="font-mono">{deposit.clientInfo.txRef}</span>
                                </p>
                              )}
                            </td>
                          </motion.tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section Retraits */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Retraits en attente</h3>
                  <button
                    onClick={loadPendingWithdrawals}
                    disabled={loadingWithdrawals}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary"
                  >
                    Rafraîchir
                  </button>
                </div>
                {loadingWithdrawals && pendingWithdrawals.length === 0 ? (
                  <SkeletonTable rows={3} cols={5} />
                ) : pendingWithdrawals.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 text-center text-gray-400 text-sm">
                    Aucun retrait en attente
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Référence</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Service</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pendingWithdrawals.map((w, i) => (
                          <motion.tr
                             key={w.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.03 }}
                            className="hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50/50"
                          >
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(w.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{w.reference}</td>
                            <td className="px-4 py-3 font-semibold text-foreground">{w.amount.toLocaleString()} FCFA</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{w.method}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleConfirmWithdrawal(w)}
                                  disabled={processingId === w.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Confirmer
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w)}
                                  disabled={processingId === w.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Rejeter
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* KYC */}
          {activeTab === "kyc" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Vérifiez les pièces d'identité soumises par les utilisateurs.
                </p>
                <button
                  onClick={loadKyc}
                  disabled={loadingKyc}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingKyc ? "animate-spin" : ""}`} />
                  Rafraîchir
                </button>
              </div>

              {kycList.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Aucun dossier en attente</p>
                  <p className="text-xs text-gray-400 mt-1">Les nouvelles soumissions apparaîtront ici.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {kycList.map((kyc) => (
                    <div key={kyc.userId} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-6 flex flex-col gap-4">

                      {/* Infos utilisateur */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-lg text-foreground">{kyc.fullName}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <strong>Type :</strong> {kyc.idType.toUpperCase()} • <strong>Numéro :</strong> {kyc.idNumber}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Soumis le : {new Date(kyc.submittedAt).toLocaleString("fr-FR")}
                          </p>
                        </div>
                        <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-medium border border-amber-200">
                          En attente
                        </div>
                      </div>

                      {/* Documents à vérifier */}
                      <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Documents à vérifier</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(kyc.userId, "recto")}
                            className="gap-2"
                          >
                            <FileText className="w-4 h-4" /> Pièce (Recto)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(kyc.userId, "verso")}
                            className="gap-2"
                          >
                            <FileText className="w-4 h-4" /> Pièce (Verso)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(kyc.userId, "selfie")}
                            className="gap-2"
                          >
                            <UserIcon className="w-4 h-4" /> Selfie
                          </Button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectKyc(kyc.userId)}
                        >
                          Rejeter
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApproveKyc(kyc.userId)}
                        >
                          Approuver
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Users */}
          {activeTab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Rechercher par nom ou email..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? "animate-spin" : ""}`} />
                  Rafraîchir
                </button>
                <button
                  onClick={handleExportUsers}
                  disabled={loadingUsers || users.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/85 disabled:opacity-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exporter CSV
                </button>
              </div>

              {usersError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  Erreur : {usersError}
                </div>
              )}

              {loadingUsers && users.length === 0 ? (
                <SkeletonTable rows={5} cols={6} />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Utilisateur</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rôle</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Solde</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Envoyé / Reçu</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Dernière connexion</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredUsers.map((user, i) => (
                        <motion.tr
  key={user.id}
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.3, delay: i * 0.03 }}
  className="hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50/50"
>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                user.role === "admin" ? "bg-purple-600" : "bg-primary"
                              }`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{user.name}</p>
                                <p className="text-xs text-gray-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <RoleBadge role={user.role} />
                              <SuspensionBadge bannedUntil={user.bannedUntil} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{user.balance.toLocaleString()} FCFA</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-blue-600">↗ {user.totalSent.toLocaleString()}</p>
                            <p className="text-xs text-green-600">↙ {user.totalReceived.toLocaleString()}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {user.lastSignInAt
                              ? new Date(user.lastSignInAt).toLocaleString("fr-FR", {
                                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                })
                              : "Jamais"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-50 rounded-lg transition-colors"
                                title="Voir détails"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Détails
                              </button>

                              {user.role !== "admin" && (
                                <>
                                  {user.bannedUntil && new Date(user.bannedUntil) > new Date() ? (
                                    <button
                                      onClick={() => handleReactivateUser(user)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                      title="Réactiver"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Réactiver
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openSuspendModal(user)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Suspendre"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      Suspendre
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                        ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-sm">
                      {users.length === 0 ? "Aucun utilisateur" : "Aucun résultat"}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Transactions */}
          {activeTab === "transactions" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={txSearch}
                    onChange={e => setTxSearch(e.target.value)}
                    placeholder="Rechercher (référence, user, service)..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="relative">
                  <select
                    value={txTypeFilter}
                    onChange={e => setTxTypeFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
                  >
                    <option value="all">Tous les types</option>
                    <option value="deposit">Dépôts</option>
                    <option value="withdrawal">Retraits</option>
                    <option value="transfer_sent">Transferts</option>
                    <option value="platform_revenue">Revenus plateforme</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={txStatusFilter}
                    onChange={e => setTxStatusFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En attente</option>
                    <option value="completed">Complété</option>
                    <option value="failed">Échoué</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={loadTransactions}
                  disabled={loadingTransactions}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingTransactions ? "animate-spin" : ""}`} />
                  Rafraîchir
                </button>
                <button
                  onClick={handleExportTransactions}
                  disabled={loadingTransactions || transactions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/85 disabled:opacity-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exporter CSV
                </button>
              </div>

              {transactionsError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  Erreur : {transactionsError}
                </div>
              )}

              {loadingTransactions && transactions.length === 0 ? (
                <SkeletonTable rows={5} cols={8} />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Référence</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Utilisateur</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Service</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50/50">
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(tx.createdAt).toLocaleString("fr-FR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                            })}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{tx.reference}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground text-xs">{tx.userName}</p>
                            <p className="text-xs text-gray-400">{tx.userEmail}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeClass(tx.type)}`}>
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{tx.amount.toLocaleString()} FCFA</p>
                            {tx.fee > 0 && <p className="text-xs text-gray-400">Frais: {tx.fee.toLocaleString()}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                            {tx.methodIcon} {tx.method}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Détails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredTransactions.length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-sm">
                      {transactions.length === 0 ? "Aucune transaction" : "Aucun résultat"}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Services */}
          {activeTab === "services" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Services de paiement et leurs statistiques réelles.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenCreateService}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un service
                  </button>
                  <button
                    onClick={loadServices}
                    disabled={loadingServices}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingServices ? "animate-spin" : ""}`} />
                    Rafraîchir
                  </button>
                </div>
              </div>

              {servicesError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  Erreur : {servicesError}
                </div>
              )}

              {loadingServices && services.length === 0 ? (
                <SkeletonTable rows={5} cols={7} />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Service</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Frais</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Transactions</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Volume</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {services.map(service => {
                        const TypeIcon = getServiceTypeIcon(service.type);
                        return (
                          <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-sm">
                                  <ServiceLogo name={service.id} fallbackIcon={service.icon} className="w-full h-full object-contain" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{service.name}</p>
                                  <p className="text-xs text-gray-400">ID: {service.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                                <TypeIcon className="w-3 h-3" />
                                {getServiceTypeLabel(service.type)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <p className="text-gray-600 dark:text-gray-400">Dép. : <strong>{(service.depositFee * 100).toFixed(1)}%</strong></p>
                              <p className="text-gray-600 dark:text-gray-400">Ret. : <strong>{(service.withdrawFee * 100).toFixed(1)}%</strong></p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-foreground">{service.transactions}</p>
                              <p className="text-xs text-gray-400">
                                {service.deposits}d · {service.withdrawals}r · {service.transfers}t
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-foreground">{service.volume.toLocaleString()} FCFA</p>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleService(service)}
                                disabled={togglingService === service.id}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                                  service.active ? "bg-primary" : "bg-gray-200 dark:bg-slate-700"
                                }`}
                              >
                                {togglingService === service.id ? (
                                  <Loader2 className="w-3 h-3 text-white animate-spin absolute left-1" />
                                ) : (
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${
                                    service.active ? "translate-x-4.5" : "translate-x-0.5"
                                  }`} />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenEditService(service)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Modifier"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                  Modifier
                                </button>
                                <button
                                  onClick={() => setDeleteServiceModal({ open: true, service })}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Supprimer
                                </button>
                                <button
                                  onClick={() => setSelectedService(service)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-primary hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Détails"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {services.length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-sm">Aucun service</div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Settings */}
          {activeTab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">

              {/* CARTE 1 : Paramètres généraux */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Paramètres généraux</h2>

                  <button
                    onClick={loadSettings}
                    disabled={loadingSettings}
                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSettings ? "animate-spin" : ""}`} />
                    Rafraîchir
                  </button>
                </div>

                {loadingSettings && !settings ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                  </div>
                ) : settings ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-50">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom de la plateforme</label>
                        <input
                          type="text"
                          value={settings.platformName}
                          onChange={e => setSettings({ ...settings, platformName: e.target.value })}
                          className="text-sm text-right bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-50">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Frais de transfert (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={settings.transferFee}
                          onChange={e => setSettings({ ...settings, transferFee: Number(e.target.value) })}
                          className="text-sm text-right bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-50">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant minimum (FCFA)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.minAmount}
                          onChange={e => setSettings({ ...settings, minAmount: Number(e.target.value) })}
                          className="text-sm text-right bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Montant maximum (FCFA)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.maxAmount}
                          onChange={e => setSettings({ ...settings, maxAmount: Number(e.target.value) })}
                          className="text-sm text-right bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/85 transition-colors disabled:opacity-50"
                      >
                        {savingSettings ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sauvegarde...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Sauvegarder
                          </>
                        )}
                      </button>

                      {settingsSaved && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Paramètres sauvegardés !
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Impossible de charger les paramètres
                  </div>
                )}
              </div>

              {/* CARTE 2 : Coordonnées de Dépôt */}
              {depositCoords && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-foreground">Coordonnées de Dépôt</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Affichées aux clients</span>
                  </div>
                  <div className="space-y-4">
                    {Object.keys(depositCoords).map((key) => (
                      <div key={key} className="p-3 border border-gray-100 dark:border-slate-800 rounded-lg space-y-2">
                        <p className="text-sm font-semibold uppercase text-primary">{key}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Label (ex: Numéro MTN)"
                            value={depositCoords[key].label}
                            onChange={e => setDepositCoords({ ...depositCoords, [key]: { ...depositCoords[key], label: e.target.value } })}
                            className="text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5"
                          />
                          <input
                            type="text"
                            placeholder="Valeur (ex: +237 6...)"
                            value={depositCoords[key].value}
                            onChange={e => setDepositCoords({ ...depositCoords, [key]: { ...depositCoords[key], value: e.target.value } })}
                            className="text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Instruction"
                          value={depositCoords[key].instruction}
                          onChange={e => setDepositCoords({ ...depositCoords, [key]: { ...depositCoords[key], instruction: e.target.value } })}
                          className="w-full text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveDepositCoords} disabled={savingCoords} className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/85 disabled:opacity-50">
                      {savingCoords ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Sauvegarder les coordonnées
                    </button>
                    {coordsSaved && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <CheckCircle className="w-4 h-4" /> Coordonnées sauvegardées !
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* CARTE 3 : Sécurité administrateur */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Sécurité administrateur</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Rotation du mot de passe admin</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  ⚠️ Un nouveau mot de passe sera généré. <strong>L'ancien ne fonctionnera plus.</strong> Assurez-vous de noter le nouveau immédiatement après la rotation.
                </div>

                <button
                  onClick={handleRotatePassword}
                  disabled={rotatingPassword}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/85 transition-colors disabled:opacity-50"
                >
                  {rotatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rotation en cours...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Générer un nouveau mot de passe
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
                      {activeTab === "news" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AdminNewsTab />
            </motion.div>
          )}
          </motion.div>
        </main>
      </div>

      {/* Modals */}
      {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {selectedTx && <TransactionDetailModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      {newPassword && <PasswordRotationModal newPassword={newPassword} onClose={() => setNewPassword(null)} />}

      {/* ⬇️ NOUVEAU : Modal Service (Créer/Modifier) */}
      {serviceModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-foreground">
                {serviceModal.mode === "create" ? "Nouveau service" : "Modifier le service"}
              </h3>
              <button
                onClick={() => setServiceModal({ ...serviceModal, open: false })}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">ID *</label>
                  <input
                    type="text"
                    value={serviceModal.service.id}
                    onChange={e => setServiceModal({
                      ...serviceModal,
                      service: { ...serviceModal.service, id: e.target.value },
                    })}
                    placeholder="ex: mtn"
                    disabled={serviceModal.mode === "edit"}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 dark:bg-slate-800 disabled:text-gray-500 dark:text-gray-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Icône</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={serviceModal.service.icon}
                      onChange={e => setServiceModal({
                        ...serviceModal,
                        service: { ...serviceModal.service, icon: e.target.value },
                      })}
                      placeholder="📱"
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 opacity-50 pointer-events-none">
                       <ServiceLogo name={serviceModal.service.id} fallbackIcon={serviceModal.service.icon} className="w-full h-full object-contain" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Nom *</label>
                <input
                  type="text"
                  value={serviceModal.service.name}
                  onChange={e => setServiceModal({
                    ...serviceModal,
                    service: { ...serviceModal.service, name: e.target.value },
                  })}
                  placeholder="ex: MTN Mobile Money"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Description</label>
                <input
                  type="text"
                  value={serviceModal.service.description}
                  onChange={e => setServiceModal({
                    ...serviceModal,
                    service: { ...serviceModal.service, description: e.target.value },
                  })}
                  placeholder="ex: Dépôt et retrait via MTN MoMo"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Type</label>
                  <select
                    value={serviceModal.service.type}
                    onChange={e => setServiceModal({
                      ...serviceModal,
                      service: { ...serviceModal.service, type: e.target.value },
                    })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="mobile-money">Mobile Money</option>
                    <option value="digital">Wallet digital</option>
                    <option value="agent">Agence</option>
                    <option value="card">Carte bancaire</option>
                    <option value="bank">Banque</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Couleur</label>
                  <select
                    value={serviceModal.service.color}
                    onChange={e => setServiceModal({
                      ...serviceModal,
                      service: { ...serviceModal.service, color: e.target.value },
                    })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="bg-yellow-500">Jaune (MTN)</option>
                    <option value="bg-orange-500">Orange</option>
                    <option value="bg-sky-500">Bleu ciel (Wave)</option>
                    <option value="bg-violet-600">Violet (Djamo)</option>
                    <option value="bg-blue-600">Bleu (Express)</option>
                    <option value="bg-gray-700">Gris (Carte)</option>
                    <option value="bg-emerald-700">Vert (Banque)</option>
                    <option value="bg-pink-500">Rose</option>
                    <option value="bg-red-500">Rouge</option>
                    <option value="bg-teal-500">Teal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Frais dépôt (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={serviceModal.service.depositFee}
                    onChange={e => setServiceModal({
                      ...serviceModal,
                      service: { ...serviceModal.service, depositFee: Number(e.target.value) },
                    })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Frais retrait (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={serviceModal.service.withdrawFee}
                    onChange={e => setServiceModal({
                      ...serviceModal,
                      service: { ...serviceModal.service, withdrawFee: Number(e.target.value) },
                    })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serviceModal.service.active}
                  onChange={e => setServiceModal({
                    ...serviceModal,
                    service: { ...serviceModal.service, active: e.target.checked },
                  })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Service actif (visible par les clients)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => setServiceModal({ ...serviceModal, open: false })}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveService}
                disabled={serviceSaving}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {serviceSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Enregistrer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⬇️ NOUVEAU : Modal confirmation suppression */}
      {deleteServiceModal.open && deleteServiceModal.service && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Supprimer le service ?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{deleteServiceModal.service.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Le service sera masqué des clients. Les transactions existantes restent intactes.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteServiceModal({ open: false, service: null })}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDeleteService}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && rejectModal.deposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-foreground mb-2">Rejeter le dépôt</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Référence : <span className="font-mono">{rejectModal.deposit.reference}</span><br />
              Montant : <strong>{rejectModal.deposit.amount.toLocaleString()} FCFA</strong>
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Raison du rejet (optionnel)
            </label>
            <textarea
              value={rejectModal.reason}
              onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Ex: Montant non reçu, référence invalide..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectModal({ open: false, deposit: null, reason: "" })}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={processingId === rejectModal.deposit.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {processingId === rejectModal.deposit.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de suspension */}
      {suspendModal.open && suspendModal.user && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSuspendModal(s => ({ ...s, open: false }))}
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Suspendre l'utilisateur</h3>
                <p className="text-sm text-muted-foreground">
                  {suspendModal.user.name} · {suspendModal.user.email}
                </p>
              </div>
            </div>

            {suspendModal.loadingActivity ? (
              <div className="text-center py-4 text-muted-foreground">Chargement de l'activité…</div>
            ) : suspendModal.activity && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <p className="font-medium mb-2">Activité des dernières 24h</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Transferts envoyés : <strong>{suspendModal.activity.activity?.sent24h ?? 0}</strong></div>
                  <div>Montant envoyé : <strong>{(suspendModal.activity.activity?.sentAmount24h ?? 0).toLocaleString()} FCFA</strong></div>
                  <div>Destinataires uniques : <strong>{suspendModal.activity.activity?.uniqueRecipients24h ?? 0}</strong></div>
                  <div>Échecs : <strong>{suspendModal.activity.activity?.failed24h ?? 0}</strong></div>
                </div>
                {suspendModal.activity.suspicious && (suspendModal.activity.alerts?.length ?? 0) > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-200">
                    <p className="text-red-700 font-medium text-xs">⚠️ Activité suspecte détectée :</p>
                    <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                      {suspendModal.activity.alerts.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <label className="block text-sm font-medium mb-2">Raison de la suspension</label>
            <textarea
              className="w-full border rounded-lg p-3 min-h-20 text-sm"
              placeholder="Ex : Série de transferts inhabituels"
              value={suspendModal.reason}
              onChange={(e) => setSuspendModal(s => ({ ...s, reason: e.target.value }))}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSuspendModal(s => ({ ...s, open: false }))}
                className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
              >
                Annuler
              </button>
              <button
                onClick={confirmSuspend}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Suspendre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⬇️ NOUVEAU : Modal Coordonnées de Dépôt */}
      {coordsModal.open && coordsModal.deposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-foreground mb-1">Coordonnées de paiement</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Dépôt de <strong>{coordsModal.deposit.amount.toLocaleString()} FCFA</strong>{" "}
              via {coordsModal.deposit.method}
              {coordsModal.deposit.phone && ` (${coordsModal.deposit.phone})`}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={coordsModal.label}
                  onChange={(e) => setCoordsModal({ ...coordsModal, label: e.target.value })}
                  placeholder="Ex: Numéro MTN MoMo"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Valeur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={coordsModal.value}
                  onChange={(e) => setCoordsModal({ ...coordsModal, value: e.target.value })}
                  placeholder="Ex: +237 6 55 00 11 22"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Instructions</label>
                <textarea
                  value={coordsModal.instructions}
                  onChange={(e) => setCoordsModal({ ...coordsModal, instructions: e.target.value })}
                  placeholder="Ex: Envoyez 5000 FCFA au numéro ci-dessus en ajoutant votre référence dans le libellé"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 p-2 rounded">
                ⏱️ Le client aura <strong>10 minutes</strong> pour effectuer le paiement après réception.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setCoordsModal({ open: false, deposit: null, label: "", value: "", instructions: "" })}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800/50"
              >
                Annuler
              </button>
              <button
                onClick={handleSetCoords}
                disabled={processingId === coordsModal.deposit.id}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2"
              >
                {processingId === coordsModal.deposit.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Envoyer au client</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}