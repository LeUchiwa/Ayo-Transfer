import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import {
  Wallet as WalletIcon, Plus, Minus, ArrowUpCircle, ArrowDownCircle,
  Copy, Clock, ShieldCheck, AlertCircle, Loader2, Phone, CreditCard,
  Banknote, CheckCircle2, Globe, ArrowRight, XCircle, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "../contexts/WalletContext";
import { walletApi } from "../../../utils/api";
import { ServiceLogo } from "../components/ServiceLogo";
import confetti from "canvas-confetti";

// ── Types ──────────────────────────────────────────────────────────────────────

type DepositMethodId = "mtn" | "orange" | "wave" | "djamo" | "express" | "card" | "bank";
type WithdrawMethodId = "mtn" | "orange" | "wave" | "djamo" | "express" | "bank";

type Method = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  accountType: "mobile-money" | "agent" | "card" | "bank" | "digital";
  fee: number; // percentage
};

// ── Payment coordinates by account type ───────────────────────────────────────

type CamerpayCoord = {
  label: string;
  value: string;
  Icon: React.ElementType;
  instruction: string;
};

const DEPOSIT_COORDS: Record<Method["accountType"], CamerpayCoord> = {
  "mobile-money": {
    label: "Numéro Mobile Money AYO",
    value: "+237 6 55 00 11 22",
    Icon: Phone,
    instruction: "Envoyez le montant exact sur ce numéro en ajoutant votre référence dans le libellé du paiement.",
  },
  "agent": {
    label: "Code Agent AYO",
    value: "CAMERPAY-XU-9847",
    Icon: CreditCard,
    instruction: "Rendez-vous dans une agence Express Union et présentez ce code pour déposer le montant.",
  },
  "card": {
    label: "Lien de paiement sécurisé",
    value: "pay.camerpay.cm/depot/secure",
    Icon: Globe,
    instruction: "Accédez au lien et entrez vos coordonnées de carte pour finaliser le paiement.",
  },
  "bank": {
    label: "IBAN AYO",
    value: "CM21 1000 0100 5000 0017 8906 001",
    Icon: Banknote,
    instruction: "Effectuez un virement depuis votre banque vers cet IBAN en indiquant votre référence.",
  },
  "digital": {
    label: "Wallet AYO (Email)",
    value: "transit@camerpay.cm",
    Icon: Globe,
    instruction: "Envoyez le montant sur cet identifiant depuis votre app et mentionnez votre référence.",
  },
};

const WITHDRAW_COORDS: Record<Method["accountType"], CamerpayCoord> = {
  "mobile-money": {
    label: "Compte de destination",
    value: "Votre numéro enregistré",
    Icon: Phone,
    instruction: "AYO va envoyer les fonds directement sur le numéro Mobile Money que vous avez indiqué.",
  },
  "agent": {
    label: "Agence de retrait",
    value: "Express Union — réseau national",
    Icon: CreditCard,
    instruction: "Rendez-vous en agence Express Union avec votre pièce d'identité et votre référence pour retirer les fonds.",
  },
  "card": {
    label: "Carte bancaire",
    value: "Crédit sous 3-5 jours ouvrés",
    Icon: CreditCard,
    instruction: "Le remboursement sur votre carte est en cours. Il apparaîtra dans 3 à 5 jours ouvrés.",
  },
  "bank": {
    label: "Compte bancaire de destination",
    value: "IBAN que vous avez fourni",
    Icon: Banknote,
    instruction: "AYO effectue un virement vers votre compte. Délai : 1 à 2 jours ouvrés.",
  },
  "digital": {
    label: "Wallet destinataire",
    value: "Votre compte digital",
    Icon: Globe,
    instruction: "Les fonds seront envoyés sur votre wallet digital dans les prochaines minutes.",
  },
};

// ── Method lists ───────────────────────────────────────────────────────────────

const DEPOSIT_METHODS: Method[] = [
  { id: "mtn", name: "MTN Mobile Money", description: "Dépôt via MTN MoMo", icon: "📱", color: "bg-yellow-500", accountType: "mobile-money", fee: 0 },
  { id: "orange", name: "Orange Money", description: "Dépôt via Orange Money", icon: "📱", color: "bg-orange-500", accountType: "mobile-money", fee: 0 },
  { id: "wave", name: "Wave", description: "Dépôt via Wave (0% frais)", icon: "🌊", color: "bg-sky-500", accountType: "mobile-money", fee: 0 },
  { id: "djamo", name: "Djamo", description: "Dépôt via Djamo", icon: "💜", color: "bg-violet-600", accountType: "digital", fee: 0 },
  { id: "express", name: "Express Union", description: "Dépôt en agence", icon: "🏪", color: "bg-blue-600", accountType: "agent", fee: 0 },
  { id: "card", name: "Carte bancaire", description: "Visa, Mastercard", icon: "💳", color: "bg-gray-700", accountType: "card", fee: 0.015 },
  { id: "bank", name: "Virement bancaire", description: "Depuis votre banque", icon: "🏛️", color: "bg-emerald-700", accountType: "bank", fee: 0 },
];

const WITHDRAW_METHODS: Method[] = [
  { id: "mtn", name: "MTN Mobile Money", description: "Retrait vers MTN MoMo", icon: "📱", color: "bg-yellow-500", accountType: "mobile-money", fee: 0.005 },
  { id: "orange", name: "Orange Money", description: "Retrait vers Orange Money", icon: "📱", color: "bg-orange-500", accountType: "mobile-money", fee: 0.005 },
  { id: "wave", name: "Wave", description: "Retrait vers Wave", icon: "🌊", color: "bg-sky-500", accountType: "mobile-money", fee: 0.003 },
  { id: "djamo", name: "Djamo", description: "Retrait vers Djamo", icon: "💜", color: "bg-violet-600", accountType: "digital", fee: 0.005 },
  { id: "express", name: "Express Union", description: "Retrait en agence", icon: "🏪", color: "bg-blue-600", accountType: "agent", fee: 0.015 },
  { id: "bank", name: "Compte bancaire", description: "Virement bancaire", icon: "🏛️", color: "bg-emerald-700", accountType: "bank", fee: 0.01 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateRef(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).toUpperCase().slice(2, 7)}-${Date.now().toString().slice(-4)}`;
}

// ── Progress animation hook ────────────────────────────────────────────────────

function useProgressAnimation(active: boolean) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) { setProgress(0); return; }
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return Math.min(90, p + Math.random() * 9 + 2);
      });
    }, 700);
    return () => clearInterval(interval);
  }, [active]);
  return [progress, setProgress] as const;
}

function useTransactionStatusPolling(
  active: boolean,
  transactionId: string,
  getTransactionStatus: (id: string) => Promise<{ status: string; failureReason?: string }>,
  onCompleted: () => void,
  onFailed: (reason: string) => void
) {
  useEffect(() => {
    if (!active || !transactionId) return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const data = await getTransactionStatus(transactionId);
        if (cancelled) return;

        if (data.status === "completed") {
          onCompleted();
        } else if (data.status === "failed") {
          onFailed(data.failureReason || "Transaction rejetée par l'administrateur");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, transactionId, getTransactionStatus, onCompleted, onFailed]);
}

// ── Sub-component: Transit page (shared for deposit & withdrawal) ──────────────

type TransitProps = {
  type: "deposit" | "withdrawal";
  method: Method;
  amount: number;
  phone: string;
  ref_: string;
  balance: number;
  onConfirmed: () => void;
};

function TransitPage({ type, method, amount, phone, ref_, balance, onConfirmed, onFailed }: TransitProps & { onFailed: (reason: string) => void }) {
  const isDeposit = type === "deposit";
  const fee = Math.ceil(amount * method.fee);
  const total = isDeposit ? amount + fee : amount;
  const newBalance = isDeposit ? balance + amount : balance - total;

  const { getTransactionStatus } = useWallet();
  const coord = isDeposit ? DEPOSIT_COORDS[method.accountType] : WITHDRAW_COORDS[method.accountType];
  
  const [progress, setProgress] = useProgressAnimation(true);
  const [failedReason, setFailedReason] = useState<string | null>(null);

  const handleCompleted = useCallback(() => {
    setProgress(100);
    setTimeout(onConfirmed, 800);
  }, [onConfirmed, setProgress]);

    const handleFailed = useCallback((reason: string) => {
    setFailedReason(reason);
    // Attend 2 secondes pour afficher le bandeau rouge, puis passe à la page d'échec
    setTimeout(() => {
      if (onConfirmed) {
        // On utilise onConfirmed comme callback pour dire au parent "c'est fini"
        // On va passer par un état parent pour l'échec
        (window as any).__ayo_failed_reason = reason;
        onConfirmed(); 
      }
    }, 2000);
  }, [onConfirmed]);

  useTransactionStatusPolling(true, ref_, getTransactionStatus, handleCompleted, handleFailed);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copié !");
  };

  return (
    <motion.div key="transit" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35 }}>
      <Card className="bg-white/90 backdrop-blur-sm shadow-2xl overflow-hidden border-teal-200">
        {failedReason && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 text-sm">Transaction rejetée</h3>
                <p className="text-xs text-red-700 mt-1">{failedReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Banner */}
        <div className={`px-6 py-5 text-white ${isDeposit ? "bg-gradient-to-r from-emerald-600 to-teal-600" : "bg-gradient-to-r from-blue-600 to-indigo-600"}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {isDeposit ? "En attente de votre paiement" : "Retrait en cours de traitement"}
              </h3>
              <p className="text-sm opacity-80">
                {isDeposit
                  ? "Envoyez les fonds à AYO pour créditer votre compte"
                  : "AYO traite votre demande de retrait"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs opacity-80 mb-1">
              <span>Vérification en cours…</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-white/20" />
          </div>
        </div>

        <CardContent className="pt-5 space-y-4 pb-6">
          {/* Reference */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Référence</p>
              <p className="font-mono font-bold text-teal-800 tracking-wider">{ref_}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(ref_)} className="gap-1 text-teal-600">
              <Copy className="w-4 h-4" /> Copier
            </Button>
          </div>

          {/* Alert */}
          {isDeposit ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Envoyez <strong>exactement {total.toLocaleString()} FCFA</strong> et indiquez la référence <strong>{ref_}</strong> dans le libellé.</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Votre demande est enregistrée. AYO va envoyer <strong>{amount.toLocaleString()} FCFA</strong> sur votre compte <strong>{method.name}</strong>.</p>
            </div>
          )}

          {/* AYO coordinates */}
          <div>
            <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              {isDeposit ? "Coordonnées AYO (envoyez ici)" : "Détails du paiement sortant"}
            </h4>
            <div className="border border-teal-200 rounded-xl overflow-hidden">
              <div className="bg-teal-50 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
                  <coord.Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{coord.label}</p>
                  <p className="font-mono font-bold text-gray-900 text-sm truncate">{coord.value}</p>
                </div>
                {isDeposit && (
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(coord.value)} className="text-teal-600 shrink-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-teal-100 bg-white">
                <p className="text-xs text-gray-600">{coord.instruction}</p>
              </div>
            </div>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            {[
              { label: "Opération", value: isDeposit ? "Dépôt" : "Retrait" },
              { label: "Service", value: `${method.icon} ${method.name}` },
              { label: isDeposit ? "Montant à envoyer" : "Montant demandé", value: `${total.toLocaleString()} FCFA` },
              ...(method.fee > 0 ? [{ label: "Frais", value: `${fee.toLocaleString()} FCFA` }] : []),
              { label: isDeposit ? "Crédité sur votre compte" : "Reçu sur votre compte externe", value: `${amount.toLocaleString()} FCFA` },
              { label: "Nouveau solde estimé", value: `${newBalance.toLocaleString()} FCFA` },
            ].map((row) => (
              <div key={row.label} className="bg-gray-50 rounded-lg p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{row.label}</p>
                <p className="font-semibold text-gray-800 text-xs">{row.value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            AYO surveille la {isDeposit ? "réception" : "confirmation"} automatiquement…
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Sub-component: Success page ────────────────────────────────────────────────

type SuccessProps = {
  type: "deposit" | "withdrawal";
  method: Method;
  amount: number;
  ref_: string;
  newBalance: number;
  onReset: () => void;
};

function SuccessPage({ type, method, amount, ref_, newBalance, onReset }: SuccessProps) {
  const isDeposit = type === "deposit";
  useEffect(() => {
    // Confettis verts/teal pour un dépôt, bleus pour un retrait
    const colors = isDeposit
      ? ["#10b981", "#14b8a6", "#34d399", "#6ee7b7"]
      : ["#3b82f6", "#6366f1", "#818cf8", "#a5b4fc"];

    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    return () => {
      confetti.reset();
    };
  }, [isDeposit]);
  return (
    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, type: "spring", stiffness: 200 }}>
      <Card className="bg-white/85 backdrop-blur-sm shadow-xl border-green-200 text-center">
        <CardContent className="pt-10 pb-8 space-y-5">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
            className={`w-20 h-20 ${isDeposit ? "bg-green-100" : "bg-blue-100"} rounded-full flex items-center justify-center mx-auto`}>
            <CheckCircle2 className={`w-10 h-10 ${isDeposit ? "text-green-600" : "text-blue-600"}`} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h3 className="text-2xl font-bold text-gray-900">
              {isDeposit ? "Dépôt confirmé !" : "Retrait effectué !"}
            </h3>
            <p className="text-gray-500 mt-1">
              {isDeposit
                ? "Paiement reçu et confirmé par AYO. Votre solde a été crédité."
                : "Votre demande a été traitée. Les fonds sont en route vers votre compte."}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="bg-gray-50 rounded-xl p-4 text-sm space-y-2.5 text-left">
            {[
              { label: "Référence", value: ref_, mono: true },
              { label: "Service", value: `${method.icon} ${method.name}` },
              { label: isDeposit ? "Montant crédité" : "Montant retiré", value: `${amount.toLocaleString()} FCFA`, color: isDeposit ? "text-green-700 font-bold text-base" : "text-blue-700 font-bold text-base" },
              { label: "Nouveau solde", value: `${newBalance.toLocaleString()} FCFA`, color: "text-teal-700 font-semibold" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-gray-500">{row.label}</span>
                <span className={`${row.mono ? "font-mono text-gray-800" : ""} ${row.color ?? "text-gray-800 font-semibold"}`}>{row.value}</span>
              </div>
            ))}
          </motion.div>

          <Button onClick={onReset} className={`w-full text-white ${isDeposit ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}`} size="lg">
            {isDeposit ? "Nouveau dépôt" : "Nouveau retrait"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Sub-component: Failure page ───────────────────────────────────────────────

function FailurePage({ type, method, amount, ref_, reason, onReset }: any) {
  const isDeposit = type === "deposit";
  return (
    <motion.div key="failed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, type: "spring", stiffness: 200 }}>
      <Card className="bg-white/85 backdrop-blur-sm shadow-xl border-red-200 text-center">
        <CardContent className="pt-10 pb-8 space-y-5">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }} className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10 text-red-600" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h3 className="text-2xl font-bold text-gray-900">
              {isDeposit ? "Dépôt rejeté" : "Retrait rejeté"}
            </h3>
            <p className="text-gray-500 mt-1">Référence : {ref_}</p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4 text-sm text-red-800">
              <strong>Raison :</strong> {reason}
            </div>
          </motion.div>
          <Button onClick={onReset} className="mt-4 bg-primary hover:bg-primary/90 text-white w-full">
            Retour au portefeuille
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
// ── Main Wallet component ──────────────────────────────────────────────────────

type WalletStep = "form" | "waiting_coords" | "coords_ready" | "pending_validation" | "transit" | "success" | "failed";

export function Wallet() {
  const { stats, transactions, isLoading, addDeposit, addWithdrawal, checkBalance, refreshWallet, getTransactionStatus } = useWallet();
  const balance = stats.balance;

  // Deposit state
  const [depositStep, setDepositStep] = useState<WalletStep>("form");
  const [depositForm, setDepositForm] = useState({ method: "", amount: "", phone: "" });
  const [depositRef, setDepositRef] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Withdrawal state
  const [withdrawStep, setWithdrawStep] = useState<WalletStep>("form");
  const [depositFailedReason, setDepositFailedReason] = useState("");
  const [depositCoords, setDepositCoords] = useState<{ label: string; value: string; instructions: string; expiresAt: string } | null>(null);
  const [depositClientTxRef, setDepositClientTxRef] = useState("");
  const [depositTimeLeft, setDepositTimeLeft] = useState(600);
  const [activeDeposit, setActiveDeposit] = useState<any>(null);
  const [activeWithdrawal, setActiveWithdrawal] = useState<any>(null);
  const [withdrawFailedReason, setWithdrawFailedReason] = useState("");
  const [withdrawForm, setWithdrawForm] = useState({ method: "", amount: "", phone: "" });
  const [withdrawRef, setWithdrawRef] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // ⬇️ NOUVEAU : Services dynamiques (fallback sur les hardcodes)
  const [depositMethods, setDepositMethods] = useState<Method[]>(DEPOSIT_METHODS);
  const [withdrawMethods, setWithdrawMethods] = useState<Method[]>(WITHDRAW_METHODS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await walletApi.getServices();
        const list = res?.services || [];
        if (cancelled || list.length === 0) return;

        const toMethod = (s: any, feeKey: "depositFee" | "withdrawFee"): Method => ({
          id: s.id,
          name: s.name,
          description: s.description || s.name,
          icon: s.icon || "💳",
          color: s.color || "bg-gray-500",
          accountType: s.type,
          fee: s[feeKey] || 0,
        });

        setDepositMethods(list.map((s: any) => toMethod(s, "depositFee")));
        setWithdrawMethods(list.map((s: any) => toMethod(s, "withdrawFee")));
      } catch (e) {
        console.warn("[Wallet] Dynamic services unavailable, using fallback", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const depositMethod = depositMethods.find((m) => m.id === depositForm.method) ?? null;
  const withdrawMethod = withdrawMethods.find((m) => m.id === withdrawForm.method) ?? null;
// ⬇️ NOUVEAU : Détecter un dépôt en cours au chargement
useEffect(() => {
  if (depositStep !== "form") return;
  let cancelled = false;
  (async () => {
    try {
      const res = await walletApi.getTransactions();
      const list = res?.transactions || [];
      const active = list.find(
        (t: any) =>
          t.type === "deposit" &&
          ["awaiting_coords", "coords_ready", "pending_validation"].includes(t.status)
      );
      if (!cancelled) setActiveDeposit(active || null);
    } catch (e) {
      console.error("[Wallet] Failed to load active deposits:", e);
    }
  })();
  return () => { cancelled = true; };
}, [depositStep]);
  // ── Deposit handlers ─────────────────────────────────────────────────────────

// ⬇️ NOUVEAU : Détecter un retrait en cours au chargement
useEffect(() => {
  if (withdrawStep !== "form") return;
  let cancelled = false;
  (async () => {
    try {
      const res = await walletApi.getTransactions();
      const list = res?.transactions || [];
      const active = list.find(
        (t: any) =>
          t.type === "withdrawal" &&
          t.status === "pending"
      );
      if (!cancelled) setActiveWithdrawal(active || null);
    } catch (e) {
      console.error("[Wallet] Failed to load active withdrawals:", e);
    }
  })();
  return () => { cancelled = true; };
}, [withdrawStep]);
  
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositSubmitting(true);
    try {
      const ref = generateRef("DEP");
      setDepositRef(ref);
      const method = depositMethods.find((m) => m.id === depositForm.method);
      const fee = method ? Math.ceil(Number(depositForm.amount) * method.fee) : 0;

      await addDeposit(
        Number(depositForm.amount),
        method?.name || "",
        method?.icon || "",
        depositForm.phone,
        ref,
        fee
      );

      setDepositSubmitting(false);
      setDepositStep("waiting_coords"); // ⬅️ nouveau flux
    } catch (error) {
      setDepositSubmitting(false);
      showError("Échec de la création du dépôt", error instanceof Error ? error.message : "Une erreur s'est produite");
    }
  };

    const onDepositConfirmed = useCallback(async () => {
    // ⚠️ Pas de confirmTransaction ici — le crédit est fait par l'admin
    await refreshWallet();
    setDepositStep("success");
  }, [refreshWallet]);
  // ── Polling 5s : attente des coordonnées admin ──
  useEffect(() => {
    if (depositStep !== "waiting_coords" || !depositRef) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await walletApi.getDepositStatus(depositRef);
        if (cancelled) return;
        const tx = res.transaction;
        if (tx.status === "coords_ready" && tx.coords) {
          setDepositCoords(tx.coords);
          setDepositStep("coords_ready");
        } else if (tx.status === "cancelled") {
          setDepositFailedReason(tx.cancelReason || "Dépôt annulé");
          setDepositStep("failed");
        }
      } catch (e) {
  console.error("[polling] getDepositStatus failed:", e);
}
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [depositStep, depositRef]);

  // ── Chrono 10 min ──
  useEffect(() => {
    if (depositStep !== "coords_ready" || !depositCoords?.expiresAt) return;
    const compute = () => {
      const left = Math.max(0, Math.floor((new Date(depositCoords.expiresAt).getTime() - Date.now()) / 1000));
      setDepositTimeLeft(left);
      if (left === 0) {
        walletApi.cancelExpiredDeposit(depositRef).catch(() => {});
        setDepositFailedReason("Délai de 10 minutes dépassé");
        setDepositStep("failed");
      }
    };
    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [depositStep, depositCoords, depositRef]);

    // ⬇️ NOUVEAU : Polling en attente de validation (détecte la confirmation admin)
    // ⬇️ Polling en attente de validation (détecte la confirmation admin)
  useEffect(() => {
    if (depositStep !== "pending_validation" || !depositRef) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await walletApi.getDepositStatus(depositRef);
        if (cancelled) return;
        const tx = res.transaction;

        if (tx.status === "completed") {
          await refreshWallet();
          setDepositStep("success");
          showSuccess("Dépôt confirmé !", `Votre dépôt de ${tx.amount.toLocaleString()} FCFA a été crédité sur votre compte.`);
          window.dispatchEvent(new Event("ayo:notif-updated"));
        } else if (tx.status === "failed" || tx.status === "cancelled") {
          setDepositFailedReason(
            tx.failureReason || tx.cancelReason || "Dépôt rejeté par l'admin"
          );
          setDepositStep("failed");
          showError("Dépôt rejeté", tx.failureReason || tx.cancelReason || "Votre dépôt n'a pas pu être validé.");
        }
      } catch (e) {
        console.error("[polling pending_validation]", e);
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [depositStep, depositRef, refreshWallet]);
  // ── Soumission des infos client ──
  const handleSubmitDepositInfo = async () => {
    if (!depositClientTxRef.trim() || depositClientTxRef.trim().length < 3) {
      showError("Numéro de transaction requis (min. 3 caractères)");
      return;
    }
    setDepositSubmitting(true);
    try {
      await walletApi.submitDepositInfo(depositRef, { txRef: depositClientTxRef.trim() });
      setDepositStep("pending_validation");
    } catch (e) {
      showError("Échec de la confirmation", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setDepositSubmitting(false);
    }
  };

  // ⬇️ NOUVEAU : Reprendre un dépôt en cours
const handleResumeDeposit = () => {
  if (!activeDeposit) return;

  // ⬇️ Convertir le nom complet ("MTN Mobile Money") en id ("mtn")
  const methodObj = depositMethods.find(m => m.name === activeDeposit.method);
  const methodId = methodObj?.id || activeDeposit.method || "";

  setDepositRef(activeDeposit.id);
  setDepositForm({
    method: methodId,
    amount: String(activeDeposit.amount),
    phone: activeDeposit.phone || "",
  });

  if (activeDeposit.status === "coords_ready" && activeDeposit.coords) {
    setDepositCoords(activeDeposit.coords);
    setDepositStep("coords_ready");
  } else if (activeDeposit.status === "pending_validation") {
    setDepositStep("pending_validation");
  } else {
    setDepositStep("waiting_coords");
  }
};

const handleResumeWithdrawal = () => {
  if (!activeWithdrawal) return;

  const methodObj = withdrawMethods.find(m => m.name === activeWithdrawal.method);
  const methodId = methodObj?.id || activeWithdrawal.method || "";

  setWithdrawRef(activeWithdrawal.id);
  setWithdrawForm({
    method: methodId,
    amount: String(activeWithdrawal.amount),
    phone: activeWithdrawal.phone || "",
  });
  setWithdrawStep("transit"); // Reprend sur l'écran d'attente
};

 const resetDeposit = () => {
    setDepositStep("form");
    setDepositForm({ method: "", amount: "", phone: "" });
    setDepositRef("");
    setDepositCoords(null);
    setDepositClientTxRef("");
    setDepositTimeLeft(600);
    setDepositFailedReason("");
  };
  // ── Withdrawal handlers ──────────────────────────────────────────────────────

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawForm.amount);
    const method = withdrawMethods.find((m) => m.id === withdrawForm.method);
    const fee = method ? Math.ceil(amount * method.fee) : 0;

    // Check balance first
    const hasSufficientBalance = await checkBalance(amount, fee);
    if (!hasSufficientBalance) {
      showError("Solde insuffisant", `Vous n'avez pas assez de fonds pour ce retrait. Solde disponible: ${balance.toLocaleString()} FCFA`);
      return;
    }

    setWithdrawSubmitting(true);
    try {
      const ref = generateRef("RET");
      setWithdrawRef(ref);

      await addWithdrawal(
        amount,
        method?.name || "",
        method?.icon || "",
        withdrawForm.phone,
        ref,
        fee
      );

      setWithdrawSubmitting(false);
      setWithdrawStep("transit");
    } catch (error) {
      setWithdrawSubmitting(false);
      showError("Échec de la création du retrait", error instanceof Error ? error.message : "Une erreur s'est produite");
    }
  };

    const onWithdrawConfirmed = useCallback(async () => {
    // ⚠️ Pas de confirmTransaction ici — le débit est fait par l'admin
    await refreshWallet();
    setWithdrawStep("success");
  }, [refreshWallet]);

  const resetWithdraw = () => {
    setWithdrawStep("form");
    setWithdrawForm({ method: "", amount: "", phone: "" });
    setWithdrawRef("");
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const depositFee = depositMethod ? Math.ceil(Number(depositForm.amount) * depositMethod.fee) : 0;
  const withdrawFee = withdrawMethod ? Math.ceil(Number(withdrawForm.amount) * withdrawMethod.fee) : 0;
  const depositNewBalance = balance + Number(depositForm.amount);
  const withdrawNewBalance = balance - Number(withdrawForm.amount) - withdrawFee;

  // ── Opérations récentes (dépôts + retraits) ────────────────────────────────
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="max-w-4xl mx-auto space-y-6">

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <h2 className="text-2xl font-semibold text-gray-900">Mon portefeuille</h2>
        <p className="text-gray-600 mt-1">Gérez votre solde et effectuez des opérations</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 border-0 text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <WalletIcon className="w-5 h-5" />
              <CardDescription className="text-teal-50">Solde disponible</CardDescription>
            </div>
            <CardTitle className="text-4xl">{balance.toLocaleString()} FCFA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-xs text-teal-100">Reçu</p>
                <p className="text-lg font-semibold">+{stats.totalReceived.toLocaleString()} FCFA</p>
              </div>
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-xs text-teal-100">Dépôts</p>
                <p className="text-lg font-semibold">{stats.countDeposits}</p>
              </div>
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <p className="text-xs text-teal-100">Retraits</p>
                <p className="text-lg font-semibold">{stats.countWithdrawals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-teal-100">
          <CardContent className="pt-6">
            <Tabs
  defaultValue={
    new URLSearchParams(window.location.search).get("tab") === "withdraw"
      ? "withdrawal"
      : "deposit"
  }
  className="w-full"
>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit" className="gap-2">
                  <Plus className="w-4 h-4" /> Dépôt
                </TabsTrigger>
                <TabsTrigger value="withdrawal" className="gap-2">
                  <Minus className="w-4 h-4" /> Retrait
                </TabsTrigger>
              </TabsList>

              {/* ── DEPOSIT TAB ──────────────────────────────────────────── */}
              <TabsContent value="deposit" className="mt-6">
                <AnimatePresence mode="wait">

              {/* ⬇️ NOUVEAU : Bannière "Dépôt en cours" */}
{depositStep === "form" && activeDeposit && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-amber-900 text-sm">
          Vous avez un dépôt en cours
        </h4>
        <p className="text-xs text-amber-700 mt-1">
          Référence <strong className="font-mono">{activeDeposit.id}</strong> —{" "}
          {activeDeposit.amount?.toLocaleString()} FCFA via {activeDeposit.method} —{" "}
          <strong>
            {activeDeposit.status === "awaiting_coords" && "en attente de l'admin"}
            {activeDeposit.status === "coords_ready" && "coordonnées prêtes !"}
            {activeDeposit.status === "pending_validation" && "en attente de validation"}
          </strong>
        </p>
        <Button
          size="sm"
          onClick={handleResumeDeposit}
          className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          Reprendre le dépôt →
        </Button>
      </div>
    </div>
  </motion.div>
)}
                  {depositStep === "form" && (
                    <motion.div key="deposit-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg mb-0.5">Recharger votre compte</h3>
                        <p className="text-sm text-gray-600">Ajoutez des fonds à votre portefeuille AYO</p>
                      </div>

                      <form onSubmit={handleDeposit} className="space-y-4">
                        {/* Method cards */}
                        <div className="space-y-2">
                          <Label>Mode de dépôt</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {depositMethods.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setDepositForm({ ...depositForm, method: m.id })}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                  depositForm.method === m.id
                                    ? "border-teal-500 bg-teal-50 scale-[1.02] shadow-sm"
                                    : "border-gray-200 bg-white hover:border-teal-300 hover:scale-[1.02] active:scale-[0.98]"
                                }`}
                              >
                                <div className={`w-9 h-9 ${m.color}/10 rounded-lg flex items-center justify-center shrink-0 p-1.5`}>
                                  <ServiceLogo name={m.id} fallbackIcon={m.icon} className="w-full h-full object-contain" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                                  {m.fee > 0 && <p className="text-[10px] text-gray-400">+{(m.fee * 100).toFixed(1)}% frais</p>}
                                  {m.fee === 0 && <p className="text-[10px] text-emerald-600 font-medium">0% frais</p>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="deposit-amount">Montant (FCFA)</Label>
                          <Input id="deposit-amount" type="number" placeholder="Ex: 50 000" min="1000"
                            value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} required />
                          <p className="text-xs text-gray-500">Minimum : 1 000 FCFA</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="deposit-phone">Numéro de téléphone</Label>
                          <Input id="deposit-phone" type="tel" placeholder="Ex: +237 6XX XX XX XX"
                            value={depositForm.phone} onChange={(e) => setDepositForm({ ...depositForm, phone: e.target.value })} required />
                        </div>

                        {/* Quick amounts */}
                        <div className="space-y-2">
                          <Label>Montants rapides</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[5000, 10000, 25000, 50000].map((a) => (
                              <Button key={a} type="button" variant="outline" size="sm"
                                className={depositForm.amount === a.toString() ? "border-teal-500 text-teal-700 bg-teal-50" : ""}
                                onClick={() => setDepositForm({ ...depositForm, amount: a.toString() })}>
                                {a.toLocaleString()}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Montant à déposer</span>
                            <span className="font-medium">{depositForm.amount ? Number(depositForm.amount).toLocaleString() : "0"} FCFA</span>
                          </div>
                          {depositFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Frais ({depositMethod ? (depositMethod.fee * 100).toFixed(1) : 0}%)</span>
                              <span className="font-medium">{depositFee.toLocaleString()} FCFA</span>
                            </div>
                          )}
                          <div className="border-t border-emerald-200 pt-1.5 flex justify-between">
                            <span className="font-semibold">Nouveau solde</span>
                            <span className="font-semibold text-emerald-600">
                              {depositForm.amount ? depositNewBalance.toLocaleString() : balance.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>

                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-200 active:scale-[0.98]" size="lg" disabled={depositSubmitting || !depositForm.method}>
                          {depositSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Préparation…</> : <><Plus className="w-4 h-4 mr-2" />Confirmer le dépôt</>}
                        </Button>
                      </form>
                    </motion.div>
                  )}
{/* ⬇️ NOUVEAU : attente des coordonnées admin */}
{depositStep === "waiting_coords" && (
  <div className="space-y-4">
    <Card>
      <CardContent className="pt-6 text-center">
        <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-teal-600" />
        <h3 className="text-lg font-semibold mb-1">En attente de l'admin</h3>
        <p className="text-sm text-gray-600">
          Votre demande de dépôt de <strong>{Number(depositForm.amount).toLocaleString()} FCFA</strong> a été envoyée.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          L'admin va vous communiquer les coordonnées de paiement. Restez sur cette page.
        </p>
      </CardContent>
    </Card>
    <Button variant="ghost" onClick={resetDeposit} className="w-full">
      Annuler
    </Button>
  </div>
)}

{/* ⬇️ NOUVEAU : coordonnées + chrono + formulaire */}
{depositStep === "coords_ready" && depositCoords && (
  <div className="space-y-4">
    <Card className="border-teal-200 bg-teal-50/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Coordonnées de paiement</CardTitle>
          <Badge className={depositTimeLeft < 120 ? "bg-red-500" : "bg-teal-600"}>
            <Clock className="w-3 h-3 mr-1" />
            {Math.floor(depositTimeLeft / 60)}:{String(depositTimeLeft % 60).padStart(2, "0")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">{depositCoords.label}</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-mono font-semibold">{depositCoords.value}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(depositCoords.value);
                showSuccess("Copié !");
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {depositCoords.instructions && (
          <p className="text-sm text-gray-700 bg-white p-3 rounded border">
            {depositCoords.instructions}
          </p>
        )}
        <p className="text-xs text-orange-600">
          ⚠️ Effectuez le paiement de <strong>{Number(depositForm.amount).toLocaleString()} FCFA</strong> avant expiration du chrono, puis renseignez le numéro de transaction ci-dessous.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confirmer votre paiement</CardTitle>
        <CardDescription>
          Renseignez le numéro de transaction fourni par l'opérateur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="clientTxRef">Numéro de transaction</Label>
          <Input
            id="clientTxRef"
            placeholder="Ex: MP2024102912345"
            value={depositClientTxRef}
            onChange={(e) => setDepositClientTxRef(e.target.value)}
          />
        </div>
        <Button
          onClick={handleSubmitDepositInfo}
          disabled={depositSubmitting || depositTimeLeft === 0}
          className="w-full bg-teal-600 hover:bg-teal-700 transition-all duration-200 active:scale-[0.98]"
        >
          {depositSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> J'ai payé, confirmer</>
          )}
        </Button>
      </CardContent>
    </Card>
  </div>
)}

{/* ⬇️ NOUVEAU : en attente de validation admin */}
{depositStep === "pending_validation" && (
  <Card>
    <CardContent className="pt-6 text-center">
      <Clock className="w-10 h-10 mx-auto mb-3 text-orange-500" />
      <h3 className="text-lg font-semibold mb-1">En attente de validation</h3>
      <p className="text-sm text-gray-600 mb-4">
        Votre dépôt de <strong>{Number(depositForm.amount).toLocaleString()} FCFA</strong> est en cours de vérification par l'admin.
      </p>
      <Badge variant="secondary">Référence: {depositRef}</Badge>
      <Button variant="outline" onClick={resetDeposit} className="w-full mt-4">
        Retour
      </Button>
    </CardContent>
  </Card>
)}

                                    {/* Transit */}
                  {depositStep === "transit" && depositMethod && (
                    <TransitPage
                      key="deposit-transit"
                      type="deposit"
                      method={depositMethod}
                      amount={Number(depositForm.amount)}
                      phone={depositForm.phone}
                      ref_={depositRef}
                      balance={balance}
                      onConfirmed={onDepositConfirmed}
                      onFailed={(reason) => {
                        setDepositFailedReason(reason);
                        setDepositStep("failed");
                        refreshWallet(); // met à jour le solde au cas où
                      }}
                    />
                  )}

                  {/* Success */}
                  {depositStep === "success" && depositMethod && (
                    <SuccessPage
                      key="deposit-success"
                      type="deposit"
                      method={depositMethod}
                      amount={Number(depositForm.amount)}
                      ref_={depositRef}
                      newBalance={balance}
                      onReset={resetDeposit}
                    />
                  )}

                  {/* Failure (NOUVEAU) */}
                  {depositStep === "failed" && depositMethod && (
                    <FailurePage
                      key="deposit-failed"
                      type="deposit"
                      method={depositMethod}
                      amount={Number(depositForm.amount)}
                      ref_={depositRef}
                      reason={depositFailedReason}
                      onReset={resetDeposit}
                    />
                  )}

                </AnimatePresence>
              </TabsContent>

              {/* ── WITHDRAWAL TAB ─────────────────────────────────────────── */}
              <TabsContent value="withdrawal" className="mt-6">
                <AnimatePresence mode="wait">

                  {/* ⬇️ NOUVEAU : Bannière "Retrait en cours" */}
{withdrawStep === "form" && activeWithdrawal && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-blue-900 text-sm">
          Vous avez un retrait en cours
        </h4>
        <p className="text-xs text-blue-700 mt-1">
          Référence <strong className="font-mono">{activeWithdrawal.id}</strong> —{" "}
          {activeWithdrawal.amount?.toLocaleString()} FCFA via {activeWithdrawal.method} —{" "}
          <strong>en attente de validation par l'admin</strong>
        </p>
        <Button
          size="sm"
          onClick={handleResumeWithdrawal}
          className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          Voir le statut →
        </Button>
      </div>
    </div>
  </motion.div>
)}

                  {/* Form */}
                  {withdrawStep === "form" && (
                    <motion.div key="withdraw-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                      <div className="mb-4">
                        <h3 className="font-semibold text-lg mb-0.5">Retirer vos fonds</h3>
                        <p className="text-sm text-gray-600">Transférez de l'argent vers votre compte externe</p>
                      </div>

                      <form onSubmit={handleWithdrawal} className="space-y-4">
                        {/* Method cards */}
                        <div className="space-y-2">
                          <Label>Mode de retrait</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {withdrawMethods.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setWithdrawForm({ ...withdrawForm, method: m.id })}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                                  withdrawForm.method === m.id
                                    ? "border-blue-500 bg-blue-50 scale-[1.02] shadow-sm"
                                    : "border-gray-200 bg-white hover:border-blue-300 hover:scale-[1.02] active:scale-[0.98]"
                                }`}
                              >
                                <div className={`w-9 h-9 ${m.color}/10 rounded-lg flex items-center justify-center shrink-0 p-1.5`}>
                                  <ServiceLogo name={m.id} fallbackIcon={m.icon} className="w-full h-full object-contain" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
                                  <p className="text-[10px] text-gray-400">{(m.fee * 100).toFixed(1)}% frais</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="withdraw-amount">Montant (FCFA)</Label>
                          <Input id="withdraw-amount" type="number" placeholder="Ex: 30 000" min="1000" max={balance}
                            value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} required />
                          <p className="text-xs text-gray-500">Disponible : {balance.toLocaleString()} FCFA</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="withdraw-phone">Numéro de compte / téléphone</Label>
                          <Input id="withdraw-phone" type="tel" placeholder="Ex: +237 6XX XX XX XX"
                            value={withdrawForm.phone} onChange={(e) => setWithdrawForm({ ...withdrawForm, phone: e.target.value })} required />
                        </div>

                        {/* Quick amounts */}
                        <div className="space-y-2">
                          <Label>Montants rapides</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[5000, 10000, 25000, 50000].map((a) => (
                              <Button key={a} type="button" variant="outline" size="sm" disabled={a > balance}
                                className={withdrawForm.amount === a.toString() ? "border-blue-500 text-blue-700 bg-blue-50" : ""}
                                onClick={() => setWithdrawForm({ ...withdrawForm, amount: a.toString() })}>
                                {a.toLocaleString()}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Montant retiré</span>
                            <span className="font-medium">{withdrawForm.amount ? Number(withdrawForm.amount).toLocaleString() : "0"} FCFA</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Frais ({withdrawMethod ? (withdrawMethod.fee * 100).toFixed(1) : 0}%)</span>
                            <span className="font-medium">{withdrawFee.toLocaleString()} FCFA</span>
                          </div>
                          <div className="border-t border-blue-200 pt-1.5 flex justify-between">
                            <span className="font-semibold">Nouveau solde</span>
                            <span className={`font-semibold ${withdrawNewBalance < 0 ? "text-red-600" : "text-blue-600"}`}>
                              {withdrawForm.amount ? withdrawNewBalance.toLocaleString() : balance.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-[0.98]" size="lg" disabled={withdrawSubmitting || !withdrawForm.method}>
                          {withdrawSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Préparation…</> : <><Minus className="w-4 h-4 mr-2" />Confirmer le retrait</>}
                        </Button>
                      </form>
                    </motion.div>
                  )}

                  {/* Transit */}
                  {withdrawStep === "transit" && withdrawMethod && (
                    <TransitPage
                      key="withdraw-transit"
                      type="withdrawal"
                      method={withdrawMethod}
                      amount={Number(withdrawForm.amount)}
                      phone={withdrawForm.phone}
                      ref_={withdrawRef}
                      balance={balance}
                      onConfirmed={onWithdrawConfirmed}
                    />
                  )}

                  {/* Success */}
                  {withdrawStep === "success" && withdrawMethod && (
                    <SuccessPage
                      key="withdraw-success"
                      type="withdrawal"
                      method={withdrawMethod}
                      amount={Number(withdrawForm.amount)}
                      ref_={withdrawRef}
                      newBalance={balance}
                      onReset={resetWithdraw}
                    />
                  )}

                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Operations */}
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
      </motion.div>

    </motion.div>
  );
}
