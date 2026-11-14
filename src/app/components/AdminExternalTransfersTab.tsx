import { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Globe, CheckCircle, XCircle, Loader2, User, Phone, Building2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { projectId } from "../../../utils/supabase/info";
import { getAdminToken } from "../../../utils/adminApi";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

async function adminCall(endpoint: string, options: { method?: string; body?: any } = {}) {
  const token = getAdminToken();
  if (!token) throw new Error("Admin non authentifié");
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Erreur ${response.status}`);
  }
  return response.json();
}

interface ExternalTransfer {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountLocal: number;
  amountFCFA: number;
  currency: string;
  country: string;
  fee: number;
  totalDebit: number;
  method: string;
  destinationName: string;
  destinationPhone: string;
  reference: string;
  status: string;
  createdAt: string;
}

export function AdminExternalTransfersTab() {
  const [transfers, setTransfers] = useState<ExternalTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminCall("/admin/external-transfers/pending");
      setTransfers(data.transfers || []);
    } catch (e: any) {
      toast.error("Impossible de charger les demandes", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirm = async (tx: ExternalTransfer) => {
    if (!confirm(`Confirmer l'envoi de ${tx.amountLocal.toLocaleString()} ${tx.currency} à ${tx.destinationName} ?\n\nL'argent a bien été envoyé manuellement ?`)) return;
    setProcessingId(tx.id);
    try {
      await adminCall(`/admin/external-transfers/${tx.id}/confirm`, { method: "POST" });
      toast.success("Transfert marqué comme envoyé");
      setTransfers(prev => prev.filter(t => t.id !== tx.id));
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (tx: ExternalTransfer) => {
    const reason = prompt(`Rejeter la demande de ${tx.destinationName} ?\n\nRaison du rejet (le client sera remboursé) :`);
    if (reason === null) return;
    setProcessingId(tx.id);
    try {
      await adminCall(`/admin/external-transfers/${tx.id}/reject`, { method: "POST", body: { reason } });
      toast.success("Demande rejetée, client remboursé");
      setTransfers(prev => prev.filter(t => t.id !== tx.id));
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (transfers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune demande d'envoi externe</p>
          <p className="text-xs mt-1">Les nouvelles demandes apparaîtront ici.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Envois externes en attente ({transfers.length})</h3>
        <Button size="sm" variant="outline" onClick={load}>Rafraîchir</Button>
      </div>
      {transfers.map(tx => (
        <Card key={tx.id} className="border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-orange-100 text-orange-700">⏳ En attente</Badge>
                  <span className="text-xs text-gray-500 font-mono">{tx.reference}</span>
                </div>
                <p className="text-sm text-gray-500">
                  Demandé par <strong>{tx.userName}</strong> ({tx.userEmail})
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-teal-700">{tx.amountFCFA.toLocaleString()} FCFA</p>
                <p className="text-xs text-gray-500">débité (frais : {tx.fee.toLocaleString()} FCFA)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">🌍 Destination</p>
                <p className="font-medium">{tx.country} · {tx.method}</p>
                <p className="font-bold text-teal-700">{tx.amountLocal.toLocaleString()} {tx.currency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">📤 À envoyer à</p>
                <p className="font-medium">{tx.destinationName}</p>
                <p className="text-xs text-gray-600 break-all">{tx.destinationPhone}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => confirm(tx)} disabled={processingId === tx.id} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                {processingId === tx.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-2" />J'ai envoyé l'argent</>}
              </Button>
              <Button onClick={() => reject(tx)} disabled={processingId === tx.id} variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50">
                <XCircle className="w-4 h-4 mr-2" />Rejeter
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
