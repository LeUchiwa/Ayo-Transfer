import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2, ArrowRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "../contexts/WalletContext";
import { useAuth } from "../contexts/AuthContext";
import { PinModal } from "../components/PinModal";
import { projectId } from "../../../utils/supabase/info";

export function PayPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { addTransfer, checkBalance, refreshWallet } = useWallet();

  const [recipient, setRecipient] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    // On attend que l'authentification soit chargée pour éviter les redirections prématurées
    if (authLoading) return;

    // Si l'utilisateur n'est pas connecté, on le redirige vers la connexion
    if (!isAuthenticated) {
      navigate(`/login?redirect=/pay/${userId}`, { replace: true });
      return;
    }

    // Charger le nom du destinataire (route publique, pas de token requis)
    fetch(`https://${projectId}.supabase.co/functions/v1/server/profile/public/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setRecipient(data);
      })
      .catch(() => toast.error("Destinataire introuvable"))
      .finally(() => setLoading(false));

    // Vérifier si l'utilisateur a un code PIN (seulement si connecté)
    if (isAuthenticated) {
      import("../../../utils/api").then(({ walletApi }) => {
        walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);
      });
    }
  }, [userId, isAuthenticated, authLoading, navigate]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || Number(amount) <= 0) return;
    
    if (hasPin) {
      setShowPinModal(true);
      return;
    }
    await executePayment("");
  };

  const executePayment = async (pin: string) => {
    if (!recipient) return;
    setIsSubmitting(true);
    try {
      const amountNum = Number(amount);
      const fee = Math.ceil(amountNum * 0.01);
      
      const hasBalance = await checkBalance(amountNum, fee);
      if (!hasBalance) {
        toast.error("Solde insuffisant");
        return;
      }

      const ref = "PAY-" + Math.random().toString(36).toUpperCase().slice(2, 8);
      
      await addTransfer(
        amountNum,
        recipient.email,
        "Lien de paiement",
        "🔗",
        "",
        ref,
        fee,
        pin
      );

      await refreshWallet();
      toast.success("Paiement effectué avec succès !");
      navigate("/history");
    } catch (error: any) {
      toast.error("Échec du paiement", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;
  }

  if (!recipient) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Lien de paiement invalide ou expiré.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-t-4 border-t-teal-600">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-teal-600" />
          </div>
          <CardTitle className="text-2xl">Payer {recipient.name}</CardTitle>
          <CardDescription>Via AYO Transfert d'argent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePay} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Montant à payer (FCFA)</Label>
              <Input
                type="number"
                placeholder="Ex: 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-semibold h-14"
                required
              />
              {Number(amount) > 0 && (
                <p className="text-xs text-gray-500 text-right">Frais AYO (1%) : {Math.ceil(Number(amount) * 0.01).toLocaleString()} FCFA</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || Number(amount) <= 0}
              className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white text-lg font-semibold"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Payer maintenant"}
              {!isSubmitting && <ArrowRight className="w-5 h-5 ml-2" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Confirmer le paiement"
        description={`Payer ${amount} FCFA à ${recipient.name}`}
        onSubmit={async (pin) => {
          await executePayment(pin);
          setShowPinModal(false);
        }}
      />
    </div>
  );
}
