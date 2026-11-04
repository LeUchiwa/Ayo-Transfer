import { useState, FormEvent, ReactNode } from "react";
import { Shield, Lock, User, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ayoLogo from "@/imports/AYO.png";

interface AdminGateProps {
  children: ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { isAdminAuthenticated, isLoading, error, login } = useAdminAuth();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(id, password);
    } catch {
      // L'erreur est déjà gérée par le hook
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pendant la vérification initiale
  if (isLoading && !isAdminAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <div className="text-white text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
          <p className="text-sm opacity-80">Vérification...</p>
        </div>
      </div>
    );
  }

  // Admin authentifié → affiche le contenu
  if (isAdminAuthenticated) {
    return <>{children}</>;
  }

  // Sinon → formulaire
  return (
    <div className="min-h-screen flex items-center justify-center bg-foreground relative overflow-hidden">
      {/* Cercles décoratifs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-5 bg-accent"
            style={{
              width: `${Math.random() * 200 + 50}px`,
              height: `${Math.random() * 200 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 relative">
        <div className="flex justify-center mb-6">
          <ImageWithFallback src={ayoLogo} alt="AYO" className="h-14 w-auto object-contain" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Espace Administrateur</h1>
        </div>

        <p className="text-center text-xs text-gray-500 mb-6">
          Authentification renforcée requise
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ID Admin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant admin
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="AYO-ADMIN"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
                autoFocus
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary/85 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Accéder au panneau admin
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Accès réservé — Toute tentative est enregistrée
        </p>
      </div>
    </div>
  );
}