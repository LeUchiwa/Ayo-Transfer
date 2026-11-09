import { useEffect, useRef, useState } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "../contexts/AuthContext";

// ── Verrou global au niveau du module (survit aux re-renders et à StrictMode) ──
let onesignalInitialized = false;
let onesignalInitPromise: Promise<void> | null = null;

/**
 * Initialise OneSignal une seule fois, même si le hook est monté plusieurs fois.
 * Retourne la même Promise à tous les appelants.
 */
function initOneSignalOnce(appId: string): Promise<void> {
  if (onesignalInitPromise) return onesignalInitPromise;

  onesignalInitPromise = OneSignal.init({
    appId,
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
    serviceWorkerPath: "/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/" },
  })
    .then(() => {
      onesignalInitialized = true;
    })
    .catch((e) => {
      console.warn("[OneSignal] init failed:", e);
      // Reset pour permettre une nouvelle tentative si l'erreur est transitoire
      onesignalInitPromise = null;
      onesignalInitialized = false;
      throw e;
    });

  return onesignalInitPromise;
}

export function useOneSignal() {
  const { user } = useAuth();
  const [ready, setReady] = useState(onesignalInitialized);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ── Initialisation ──
  useEffect(() => {
    mountedRef.current = true;

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;

    if (!appId) {
      console.warn("[OneSignal] VITE_ONESIGNAL_APP_ID non configuré");
      setError("missing_app_id");
      return;
    }

    if (onesignalInitialized) {
      setReady(true);
      return;
    }

    initOneSignalOnce(appId)
      .then(() => {
        if (mountedRef.current) {
          setReady(true);
          setError(null);
        }
      })
      .catch((e) => {
        if (mountedRef.current) {
          setError(e?.message || "init_failed");
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Login du user Supabase dans OneSignal ──
  useEffect(() => {
    if (!ready || !user?.id) return;

    OneSignal.login(user.id).catch((e) => {
      // Erreur silencieuse (par ex : si déjà loggé)
      console.warn("[OneSignal] login:", e);
    });
  }, [ready, user?.id]);

  // ── Logout ──
  useEffect(() => {
    if (!ready || user) return;
    OneSignal.logout().catch(() => {});
  }, [ready, user]);

  // ── Demande de permission ──
  const requestPermission = async (): Promise<boolean> => {
    if (!ready) return false;
    try {
      await OneSignal.Notifications.requestPermission();
      return OneSignal.Notifications.permission;
    } catch (e) {
      console.warn("[OneSignal] requestPermission failed:", e);
      return false;
    }
  };

  const permission = ready ? OneSignal.Notifications.permission : false;

  return { ready, permission, requestPermission, error };
}
