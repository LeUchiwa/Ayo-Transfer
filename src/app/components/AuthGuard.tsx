import { Navigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirige vers la landing page au lieu de /login
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
