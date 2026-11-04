import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ShieldCheck, Upload, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../utils/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { projectId } from "../../../utils/supabase/info";

export function Kyc() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState("cni");
  const [idNumber, setIdNumber] = useState("");
  const [rectoFile, setRectoFile] = useState<File | null>(null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/kyc/status`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      setStatus(data.kyc);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rectoFile || !versoFile || !selfieFile || !user) {
      return toast.error("Veuillez fournir tous les documents (Recto, Verso, Selfie).");
    }

    setSubmitting(true);
    try {
      // 1. Upload Recto
      const rectoExt = rectoFile.name.split('.').pop();
      const rectoPath = `${user.id}/recto-${Date.now()}.${rectoExt}`;
      const { error: rectoError } = await supabase.storage.from("kyc-documents").upload(rectoPath, rectoFile);
      if (rectoError) throw rectoError;

      // 2. Upload Verso
      const versoExt = versoFile.name.split('.').pop();
      const versoPath = `${user.id}/verso-${Date.now()}.${versoExt}`;
      const { error: versoError } = await supabase.storage.from("kyc-documents").upload(versoPath, versoFile);
      if (versoError) throw versoError;

      // 3. Upload Selfie
      const selfieExt = selfieFile.name.split('.').pop();
      const selfiePath = `${user.id}/selfie-${Date.now()}.${selfieExt}`;
      const { error: selfieError } = await supabase.storage.from("kyc-documents").upload(selfiePath, selfieFile);
      if (selfieError) throw selfieError;

      // 4. Submit to backend
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/kyc/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          fullName, 
          idType, 
          idNumber, 
          idDocumentRectoUrl: rectoPath,
          idDocumentVersoUrl: versoPath,
          selfieUrl: selfiePath
        }),
      });
      
      if (!res.ok) throw new Error("Erreur lors de la soumission");
      
      toast.success("Dossier KYC soumis !");
      loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Vérification d'identité (KYC)</h2>
        <p className="text-muted-foreground">Requis pour débloquer toutes les fonctionnalités d'AYO.</p>
      </div>

      {status?.status === "pending" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
            <div>
              <h3 className="font-bold text-amber-900">Dossier en cours d'examen</h3>
              <p className="text-sm text-amber-700">Notre équipe vérifie vos documents. Cela prend généralement 24h.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {status?.status === "approved" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-bold text-green-900">Identité vérifiée !</h3>
              <p className="text-sm text-green-700">Votre compte est maintenant entièrement vérifié.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {status?.status === "rejected" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center gap-4">
            <XCircle className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="font-bold text-red-900">Dossier rejeté</h3>
              <p className="text-sm text-red-700">Raison : {status.rejectionReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {(status?.status === "not_submitted" || status?.status === "rejected") && (
        <Card>
          <CardHeader>
            <CardTitle>Soumettre vos documents</CardTitle>
            <CardDescription>Toutes vos données sont chiffrées et sécurisées.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet (comme sur la pièce)</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de pièce</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cni">Carte Nationale d'Identité</SelectItem>
                      <SelectItem value="passport">Passeport</SelectItem>
                      <SelectItem value="license">Permis de conduire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Numéro de la pièce</Label>
                  <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Photo de la pièce (Recto) *</Label>
                  <Input type="file" accept="image/*" onChange={e => setRectoFile(e.target.files?.[0] || null)} required />
                </div>
                <div className="space-y-2">
                  <Label>Photo de la pièce (Verso) *</Label>
                  <Input type="file" accept="image/*" onChange={e => setVersoFile(e.target.files?.[0] || null)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Selfie avec la pièce en main *</Label>
                <Input type="file" accept="image/*" onChange={e => setSelfieFile(e.target.files?.[0] || null)} required />
                <p className="text-xs text-muted-foreground">Tenez votre pièce d'identité à côté de votre visage.</p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-primary text-white">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi...</> : <><Upload className="w-4 h-4 mr-2" /> Soumettre mon dossier</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}