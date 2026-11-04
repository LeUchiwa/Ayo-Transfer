import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // Pendant le chargement de la session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm opacity-80">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Pas connecté → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Connecté mais pas admin → retour dashboard
  const userRole = (user as any).role;
  if (userRole !== "admin") {
    return <Navigate to="/" replace />;
  }

  // ✅ Admin confirmé
  return <>{children}</>;
}