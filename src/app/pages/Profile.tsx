import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { User, Lock, Loader2, CheckCircle, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../utils/supabase/client";
import { projectId } from "../../../utils/supabase/info";
import { useAuth } from "../contexts/AuthContext";
import { PinModal } from "../components/PinModal";
import { walletApi } from "../../../utils/api";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

export function Profile() {
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);
  }, []);

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profil
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Chargement initial
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setName(data.name || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
      } catch (err) {
        console.error("Failed to load profile:", err);
        toast.error("Impossible de charger le profil");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Sauvegarde du profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, phone }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }

      toast.success("Profil mis à jour !");
      // Rafraîchit la session pour que le nom soit à jour dans l'UI
      await supabase.auth.refreshSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingProfile(false);
    }
  };

  // Changement de mot de passe
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setSavingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE}/profile/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors du changement de mot de passe");
      }

      toast.success("Mot de passe modifié !");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
      </div>
);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Mon profil</h2>
        <p className="text-muted-foreground">Gérez vos informations personnelles</p>
      </div>

      {/* Carte : Infos personnelles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>Votre nom et numéro de téléphone</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="pl-10 bg-muted/50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                L'email ne peut pas être modifié. Contactez le support si nécessaire.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: +237 6XX XX XX XX"
              />
            </div>

            <Button type="submit" disabled={savingProfile} className="bg-primary hover:bg-primary/90 text-white">
              {savingProfile ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sauvegarde...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Enregistrer</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Carte : Mot de passe */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Sécurité</CardTitle>
              <CardDescription>Changer votre mot de passe</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mot de passe actuel *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 6 caractères"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <Button type="submit" disabled={savingPassword} className="bg-primary hover:bg-primary/90 text-white">
              {savingPassword ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Modification...</>
              ) : (
                <><ShieldCheck className="w-4 h-4 mr-2" />Changer le mot de passe</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

  
        <Card className="mt-6 border-teal-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${hasPin ? "bg-green-100 text-green-600" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400"}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Code PIN de sécurité</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{hasPin ? "Activé" : "Non configuré (recommandé)"}</p>
              </div>
            </div>
            <Button onClick={() => setShowPinModal(true)} variant={hasPin ? "outline" : "default"} className={!hasPin ? "bg-teal-600 text-white" : ""}>
              {hasPin ? "Modifier" : "Configurer"}
            </Button>
          </CardContent>
        </Card>

        <PinModal 
          isOpen={showPinModal}
          isChanging={hasPin}
          onClose={() => setShowPinModal(false)}
          title="Configurer le PIN"
          description="Choisissez un code à 4 chiffres pour sécuriser vos transferts."
          onSubmit={async (pin, currentPin) => {
            await walletApi.setPin(pin, currentPin);
            setHasPin(true);
            setShowPinModal(false);
            toast.success("Code PIN configuré avec succès !");
          }}
        />
  
    </div>
  );
}