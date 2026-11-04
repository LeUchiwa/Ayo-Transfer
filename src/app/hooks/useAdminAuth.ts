import { useState, useEffect, useCallback } from "react";
import {
  adminLogin,
  adminVerify,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
} from "../../../utils/adminApi";

export function useAdminAuth() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vérifie le token au montage
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAdminToken();
      if (!token) {
        setIsAdminAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const result = await adminVerify(token);
        if (result.valid) {
          setIsAdminAuthenticated(true);
        } else {
          clearAdminToken();
          setIsAdminAuthenticated(false);
        }
      } catch {
        clearAdminToken();
        setIsAdminAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (id: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminLogin(id, password);
      setAdminToken(result.token, result.expiresAt);
      setIsAdminAuthenticated(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setIsAdminAuthenticated(false);
  }, []);

  return {
    isAdminAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}