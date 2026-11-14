#!/usr/bin/env bash
set -euo pipefail

# 1. API
API_FILE="utils/api.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")
if "createExternalTransfer" not in src:
    method = '''
  // ═══ ENVOI EXTERNE ═══
  createExternalTransfer: (data: {
    amountLocal: number;
    currency: string;
    country: string;
    method: string;
    destinationName: string;
    destinationPhone: string;
    pin?: string;
    reference: string;
  }) => apiCall('/wallet/external-transfer', { method: 'POST', body: data }),
'''
    anchor = "  getServices: () => apiCall('/services'),"
    src = src.replace(anchor, anchor + method, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ API createExternalTransfer ajoutée")
PY

# 2. Nouvelle page
cat > src/app/pages/ExternalTransfer.tsx <<'EOF'
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowRight, Globe, Loader2, Phone, CreditCard, Building2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "../contexts/WalletContext";
import { PinModal } from "../components/PinModal";
import { walletApi } from "../../../utils/api";

const COUNTRIES = [
  { code: "CM", name: "Cameroun", currency: "XAF", flag: "🇨🇲", rate: 1 },
  { code: "SN", name: "Sénégal", currency: "XOF", flag: "🇸🇳", rate: 1 },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", rate: 1 },
  { code: "BF", name: "Burkina Faso", currency: "XOF", flag: "🇧🇫", rate: 1 },
  { code: "ML", name: "Mali", currency: "XOF", flag: "🇲🇱", rate: 1 },
  { code: "FR", name: "France", currency: "EUR", flag: "🇫🇷", rate: 655.957 },
  { code: "BE", name: "Belgique", currency: "EUR", flag: "🇧🇪", rate: 655.957 },
  { code: "US", name: "États-Unis", currency: "USD", flag: "🇺🇸", rate: 610 },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", rate: 0.4 },
];

const METHODS = [
  { id: "mtn", label: "MTN Mobile Money", icon: Phone, type: "mobile" },
  { id: "orange", label: "Orange Money", icon: Phone, type: "mobile" },
  { id: "wave", label: "Wave", icon: Phone, type: "mobile" },
  { id: "djamo", label: "Djamo", icon: Wallet, type: "mobile" },
  { id: "express", label: "Express Union", icon: Building2, type: "agent" },
  { id: "card", label: "Carte bancaire", icon: CreditCard, type: "card" },
  { id: "bank", label: "Virement bancaire", icon: Building2, type: "bank" },
];

export function ExternalTransfer() {
  const navigate = useNavigate();
  const { stats, checkBalance, refreshWallet } = useWallet();
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [destinationDetail, setDestinationDetail] = useState("");
  const [destinationBank, setDestinationBank] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    walletApi.getPinStatus().then(r => setHasPin(r.hasPin)).catch(console.error);
  }, []);

  const amountFCFA = Math.ceil(Number(amount) * country.rate);
  const fee = Math.ceil(amountFCFA * 0.01);
  const totalDebit = amountFCFA + fee;

  const validate = () => {
    if (Number(amount) <= 0) { toast.error("Montant invalide"); return false; }
    if (!destinationName.trim()) { toast.error("Nom du destinataire requis"); return false; }
    if (!destinationDetail.trim()) { toast.error("Coordonnées requises"); return false; }
    if (method.type === "bank" && !destinationBank.trim()) { toast.error("Nom de la banque requis"); return false; }
    if (stats.balance < totalDebit) { toast.error(`Solde insuffisant. Requis : ${totalDebit.toLocaleString()} FCFA`); return false; }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (hasPin) { setShowPinModal(true); return; }
    execute();
  };

  const execute = async (pin?: string) => {
    setSubmitting(true);
    try {
      const ref = "EXT-" + Math.random().toString(36).toUpperCase().slice(2, 8) + "-" + Date.now().toString().slice(-4);
      const fullDetail = method.type === "bank"
        ? `${destinationDetail} | Banque: ${destinationBank}`
        : destinationDetail;

      await walletApi.createExternalTransfer({
        amountLocal: Number(amount),
        currency: country.currency,
        country: country.name,
        method: method.label,
        destinationName: destinationName.trim(),
        destinationPhone: fullDetail.trim(),
        pin,
        reference: ref,
      });

      await refreshWallet();
      toast.success("Demande envoyée ! L'admin va traiter votre transfert sous 10 minutes.");
      navigate("/history");
    } catch (e: any) {
      toast.error("Échec de la demande", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const renderDestinationField = () => {
    if (method.type === "mobile") {
      return (
        <>
          <Label>Numéro {method.label}</Label>
          <Input type="tel" placeholder="+237 6XX XX XX XX" value={destinationDetail} onChange={e => setDestinationDetail(e.target.value)} required />
        </>
      );
    }
    if (method.type === "agent") {
      return (
        <>
          <Label>Ville de retrait (agence)</Label>
          <Input placeholder="Ex: Douala, Yaoundé..." value={destinationDetail} onChange={e => setDestinationDetail(e.target.value)} required />
        </>
      );
    }
    if (method.type === "card") {
      return (
        <>
          <Label>Numéro de carte</Label>
          <Input placeholder="1234 5678 9012 3456" value={destinationDetail} onChange={e => setDestinationDetail(e.target.value)} required />
        </>
      );
    }
    if (method.type === "bank") {
      return (
        <>
          <Label>IBAN / Numéro de compte</Label>
          <Input placeholder="FR76 3000 4000 0300 0000 0000 123" value={destinationDetail} onChange={e => setDestinationDetail(e.target.value)} required />
          <Label className="mt-2">Nom de la banque</Label>
          <Input placeholder="Ex: BNP, Ecobank..." value={destinationBank} onChange={e => setDestinationBank(e.target.value)} required />
        </>
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Envoyer à l'extérieur</h2>
        <p className="text-muted-foreground mt-1">Envoyez vers un compte Mobile Money, une banque ou une carte, dans n'importe quel pays.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pays */}
            <div>
              <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> Pays de destination</Label>
              <Select value={country.code} onValueChange={code => setCountry(COUNTRIES.find(c => c.code === code)!)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Moyen */}
            <div>
              <Label>Moyen de réception</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {METHODS.map(m => {
                  const Icon = m.icon;
                  return (
                    <button key={m.id} type="button" onClick={() => { setMethod(m); setDestinationDetail(""); }}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${method.id === m.id ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"}`}>
                      <Icon className={`w-4 h-4 ${method.id === m.id ? "text-teal-600" : "text-gray-400"}`} />
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Montant */}
            <div>
              <Label>Montant en {country.currency}</Label>
              <Input type="number" placeholder="Ex: 10000" value={amount} onChange={e => setAmount(e.target.value)} required />
              {Number(amount) > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Équivalent : <strong>{amountFCFA.toLocaleString()} FCFA</strong> + frais ({fee.toLocaleString()} FCFA)
                </p>
              )}
            </div>

            {/* Nom */}
            <div>
              <Label>Nom complet du destinataire</Label>
              <Input placeholder="Ex: Jean Mballa" value={destinationName} onChange={e => setDestinationName(e.target.value)} required />
            </div>

            {/* Champ dynamique */}
            <div className="space-y-2">{renderDestinationField()}</div>

            {/* Récap */}
            {Number(amount) > 0 && (
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-xl text-sm space-y-1">
                <div className="flex justify-between"><span>Montant reçu par le destinataire</span><strong>{Number(amount).toLocaleString()} {country.currency}</strong></div>
                <div className="flex justify-between"><span>Équivalent FCFA</span><strong>{amountFCFA.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between"><span>Frais AYO</span><strong>{fee.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between border-t border-teal-200 pt-2 mt-2"><span className="font-semibold">Total débité</span><span className="font-bold text-teal-700">{totalDebit.toLocaleString()} FCFA</span></div>
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Envoyer la demande <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              ⏱️ Votre demande sera traitée par un administrateur sous 10 minutes.
            </p>
          </form>
        </CardContent>
      </Card>

      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Confirmer l'envoi"
        description={`Envoyer ${Number(amount).toLocaleString()} ${country.currency} à ${destinationName}`}
        onSubmit={async (pin) => { await execute(pin); setShowPinModal(false); }}
      />
    </div>
  );
}
EOF

# 3. Route
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/routes.tsx")
src = p.read_text(encoding="utf-8")
if "ExternalTransfer" not in src:
    src = src.replace('import { Transfer } from "./pages/Transfer";', 'import { Transfer } from "./pages/Transfer";\nimport { ExternalTransfer } from "./pages/ExternalTransfer";')
    src = src.replace('{ path: "transfer", Component: Transfer },', '{ path: "transfer", Component: Transfer },\n      { path: "external-transfer", Component: ExternalTransfer },')
    p.write_text(src, encoding="utf-8")
    print("✅ Route /external-transfer ajoutée")
PY

echo "✅ Page /external-transfer prête."
