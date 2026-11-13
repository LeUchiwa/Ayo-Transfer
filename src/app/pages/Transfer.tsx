import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  CheckCircle2, Send, Loader2, Plus, X,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useWallet } from "../contexts/WalletContext";
import { PinModal } from "../components/PinModal";
import { walletApi } from "../../../utils/api";
import { BeneficiarySelector } from "../components/BeneficiarySelector";
import type { Beneficiary } from "../../../utils/api";

function generateRef(): string {
  return "TRF-" + Math.random().toString(36).toUpperCase().slice(2, 8) + "-" + Date.now().toString().slice(-4);
}

const TRANSFER_FEE_RATE = 0.01;

type Step = "form" | "success";
type RecipientStatus = "idle" | "checking" | "found" | "not_found" | "self" | "invalid" | "rate_limited";

export function Transfer() {
  const {
    stats, addTransfer, checkBalance, refreshWallet,
    beneficiaries, beneficiariesLoading, createBeneficiary, deleteBeneficiary,
    touchBeneficiary, verifyRecipient,
  } = useWallet();

  const [step, setStep] = useState<Step>("form");
  const [formData, setFormData] = useState({
    recipientEmail: "", recipientName: "", phone: "", amount: "", note: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTxData, setPendingTxData] = useState<any>(null);

  const [lastRef, setLastRef] = useState("");
  const [selectedBenefId, setSelectedBenefId] = useState<string | null>(null);
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus>("idle");
  const [recipientName, setRecipientName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBenef, setNewBenef] = useState({ email: "", name: "", phone: "" });
  const debounceRef = useRef<number | undefined>(undefined);

    useEffect(() => {
    walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);
  }, []);

  const fee = useMemo(() => {
    const amt = Number(formData.amount);
    if (!amt) return 0;
    return Math.ceil(amt * TRANSFER_FEE_RATE);
  }, [formData.amount]);

  const totalDebit = useMemo(() => Number(formData.amount || 0) + fee, [formData.amount, fee]);

  // ─── Vérification email (debounce 400ms) ───
  useEffect(() => {
    const email = formData.recipientEmail.trim().toLowerCase();
    clearTimeout(debounceRef.current);

    if (!email) { setRecipientStatus("idle"); setRecipientName(""); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setRecipientStatus("invalid"); return; }

    setRecipientStatus("checking");
    debounceRef.current = window.setTimeout(async () => {
      const res = await verifyRecipient(email);
      if (res.found) { setRecipientStatus("found"); setRecipientName(res.name ?? ""); }
      else if (res.reason === "self") setRecipientStatus("self");
      else if (res.reason === "invalid_format") setRecipientStatus("invalid");
      else if (res.reason === "rate_limited") setRecipientStatus("rate_limited");
      else setRecipientStatus("not_found");
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [formData.recipientEmail, verifyRecipient]);

  const handleSelectBeneficiary = (b: Beneficiary) => {
    setSelectedBenefId(b.id);
    setFormData((p) => ({
      ...p,
      recipientEmail: b.email,
      recipientName: b.name,
      phone: b.phone || p.phone,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (amount <= 0) {
      toast.error("Montant invalide", { description: "Le montant doit être supérieur à 0" });
      return;
    }

    if (!formData.recipientEmail || !formData.recipientEmail.includes("@")) {
      toast.error("Email invalide", { description: "Veuillez entrer l'email du destinataire AYO." });
      return;
    }

    const hasSufficientBalance = await checkBalance(amount, fee);
    if (!hasSufficientBalance) {
      toast.error("Solde insuffisant", {
        description: `Solde disponible: ${stats.balance.toLocaleString()} FCFA, Requis: ${totalDebit.toLocaleString()} FCFA`,
      });
      return;
    }

    if (hasPin) {
      setShowPinModal(true);
      return;
    }

    await executeTransfer();
  };

  const executeTransfer = async (pin?: string) => {
    

    const amount = Number(formData.amount);
    if (amount <= 0) { toast.error("Montant invalide"); return; }
    if (recipientStatus !== "found") {
      toast.error("Destinataire non vérifié", { description: "Vérifiez l'email avant d'envoyer." });
      return;
    }

    const hasSufficientBalance = await checkBalance(amount, fee);
    if (!hasSufficientBalance) {
      toast.error("Solde insuffisant", { description: `Solde: ${stats.balance.toLocaleString()} FCFA` });
      return;
    }

    setIsSubmitting(true);
    try {
      const ref = generateRef();
      setLastRef(ref);

      await addTransfer(amount, formData.recipientEmail, "AYO Wallet", "💸", formData.phone, ref, fee, pin);

      // ⭐ Auto-save / touch bénéficiaire (non bloquant)
      try {
        if (selectedBenefId) await touchBeneficiary(selectedBenefId);
        else await createBeneficiary({
          email: formData.recipientEmail,
          name: formData.recipientName || recipientName,
          phone: formData.phone,
        });
      } catch { /* silencieux */ }

      await refreshWallet();
      setStep("success");
    } catch (error) {
      toast.error("Échec du transfert", {
        description: error instanceof Error ? error.message : "Erreur",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("form");
    setFormData({ recipientEmail: "", recipientName: "", phone: "", amount: "", note: "" });
    setLastRef(""); setSelectedBenefId(null);
    setRecipientStatus("idle"); setRecipientName(""); setShowAddForm(false);
  };

  const handleAddNewBenef = async () => {
    if (!newBenef.email) { toast.error("Email requis"); return; }
    try {
      await createBeneficiary(newBenef);
      toast.success("Bénéficiaire ajouté");
      setNewBenef({ email: "", name: "", phone: "" });
      setShowAddForm(false);
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleDeleteBenef = async (id: string) => {
    if (!confirm("Supprimer ce bénéficiaire ?")) return;
    try { await deleteBeneficiary(id); toast.success("Supprimé"); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-semibold text-foreground">Nouveau transfert</h2>
        <p className="text-muted-foreground mt-1">Envoyez de l'argent à un autre utilisateur AYO</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Card className="bg-white dark:bg-slate-900 shadow-xl border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Send className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Informations du transfert</CardTitle>
                    <CardDescription>Choisissez un bénéficiaire ou saisissez un email</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* ═══ BÉNÉFICIAIRES ═══ */}
                  {!formData.recipientEmail && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Bénéficiaires récents</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                          <Plus className="w-4 h-4 mr-1" /> Nouveau
                        </Button>
                      </div>
                      {showAddForm ? (
                        <div className="border rounded-lg p-3 space-y-2 bg-accent/30">
                          <Input placeholder="Email *" value={newBenef.email}
                            onChange={(e) => setNewBenef({ ...newBenef, email: e.target.value })} />
                          <Input placeholder="Nom (optionnel)" value={newBenef.name}
                            onChange={(e) => setNewBenef({ ...newBenef, name: e.target.value })} />
                          <Input placeholder="Téléphone (optionnel)" value={newBenef.phone}
                            onChange={(e) => setNewBenef({ ...newBenef, phone: e.target.value })} />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={handleAddNewBenef}>Ajouter</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
                          </div>
                        </div>
                      ) : (
                        <BeneficiarySelector
                          beneficiaries={beneficiaries}
                          loading={beneficiariesLoading}
                          onSelect={handleSelectBeneficiary}
                          onDelete={handleDeleteBenef}
                        />
                      )}
                    </div>
                  )}

                  {/* ═══ EMAIL DESTINATAIRE ═══ */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="recipientEmail">Email du destinataire AYO *</Label>
                      {formData.recipientEmail && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          setFormData({ ...formData, recipientEmail: "" });
                          setSelectedBenefId(null);
                          setRecipientStatus("idle");
                          setRecipientName("");
                        }}>
                          <X className="w-4 h-4 mr-1" /> Changer
                        </Button>
                      )}
                    </div>
                    <Input
                      id="recipientEmail" type="email"
                      placeholder="destinataire@email.com"
                      value={formData.recipientEmail}
                      onChange={(e) => {
                        setFormData({ ...formData, recipientEmail: e.target.value });
                        setSelectedBenefId(null);
                      }}
                      required
                    />
                    {recipientStatus === "checking" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Vérification…
                      </p>
                    )}
                    {recipientStatus === "found" && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Compte vérifié : {recipientName}
                      </p>
                    )}
                    {recipientStatus === "not_found" && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Aucun compte AYO avec cet email
                      </p>
                    )}
                    {recipientStatus === "self" && (
                      <p className="text-xs text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> C'est votre propre compte
                      </p>
                    )}
                    {recipientStatus === "invalid" && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Format d'email invalide
                      </p>
                    )}
                    {recipientStatus === "rate_limited" && (
                      <p className="text-xs text-orange-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Trop de vérifications, patientez
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipientName">Nom du destinataire (optionnel)</Label>
                    <Input id="recipientName" placeholder="Ex: Jean Mballa"
                      value={formData.recipientName}
                      onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input id="phone" type="tel" placeholder="Ex: +237 6XX XX XX XX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Montant (FCFA) *</Label>
                    <Input id="amount" type="number" placeholder="Ex: 10000" min="100"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required />
                    <p className="text-xs text-muted-foreground">
                      Solde disponible : <span className="font-semibold text-foreground">{stats.balance.toLocaleString()} FCFA</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Motif (optionnel)</Label>
                    <Input id="note" placeholder="Ex: Aide familiale"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
                  </div>

                  {Number(formData.amount) > 0 && (
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-2">
                      <h4 className="font-semibold text-foreground text-sm mb-2">Récapitulatif</h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Montant envoyé</span>
                        <span className="font-medium">{Number(formData.amount).toLocaleString()} FCFA</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais ({(TRANSFER_FEE_RATE * 100).toFixed(1)}%)</span>
                        <span className="font-medium">{fee.toLocaleString()} FCFA</span>
                      </div>
                      <div className="border-t border-primary/20 pt-2 flex justify-between">
                        <span className="font-semibold text-foreground">Total débité</span>
                        <span className="font-bold text-primary">{totalDebit.toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                    size="lg"
                    disabled={isSubmitting || recipientStatus !== "found"}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" />Envoyer</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="bg-white dark:bg-slate-900 shadow-xl border-green-200 text-center">
              <CardContent className="pt-10 pb-8 space-y-5">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">Transfert envoyé !</h3>
                  <p className="text-muted-foreground mt-1">
                    Les fonds ont été envoyés instantanément.<br />
                    Un email de confirmation a été envoyé aux deux parties.
                  </p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2 text-left">
                  {[
                    { label: "Référence", value: lastRef, mono: true },
                    { label: "Destinataire", value: formData.recipientEmail },
                    { label: "Montant", value: `${Number(formData.amount).toLocaleString()} FCFA`, highlight: "primary" },
                    { label: "Frais", value: `${fee.toLocaleString()} FCFA` },
                    { label: "Nouveau solde", value: `${stats.balance.toLocaleString()} FCFA`, highlight: "green" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`${row.mono ? "font-mono" : "font-semibold"} ${
                        row.highlight === "primary" ? "text-primary font-bold text-base" :
                        row.highlight === "green" ? "text-green-700 font-bold text-base" : "text-foreground"
                      }`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleReset} className="w-full bg-primary hover:bg-primary/90 text-white" size="lg">
                  Nouveau transfert
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <PinModal 
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Confirmer le transfert"
        description={`Envoyer ${formData.amount} FCFA à ${formData.recipientEmail}`}
        onSubmit={async (pin) => {
          try {
            await executeTransfer(pin);
            setShowPinModal(false);
          } catch (e) {
            // On garde le modal ouvert, mais on affiche la vraie raison dans la console
            console.error("Échec du transfert :", e);
          }
        }}
      />
    </motion.div>
  );
}