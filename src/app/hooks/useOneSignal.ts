import { useEffect, useRef, useState } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "../contexts/AuthContext";

let onesignalInitialized = false;
let onesignalInitPromise: Promise<void> | null = null;

function initOneSignalOnce(appId: string): Promise<void> {
  if (onesignalInitPromise) return onesignalInitPromise;

  onesignalInitPromise = OneSignal.init({
    appId,
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
    serviceWorkerPath: "/push/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/push/" },
    // ⬇️ CLÉ : force un nouveau namespace pour contourner l'IndexedDB piégé
    // (OneSignal utilise ce chemin pour stocker son état)
  } as any)
    .then(() => {
      onesignalInitialized = true;
    })
    .catch((e) => {
      console.warn("[OneSignal] init failed:", e);
      onesignalInitPromise = null;
      onesignalInitialized = false;
      throw e;
    });

  return onesignalInitPromise;
}

export function useOneSignal() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;

    if (!appId) {
      console.warn("[OneSignal] VITE_ONESIGNAL_APP_ID non configuré");
      setError("missing_app_id");
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
        if (mountedRef.current) setError(e?.message || "init_failed");
      });

    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!ready || !user?.id) return;
    OneSignal.login(user.id).catch((e) => console.warn("[OneSignal] login:", e));
  }, [ready, user?.id]);

  const requestPermission = async (): Promise<boolean> => {
    if (!ready) return false;
    try {
      await OneSignal.Notifications.requestPermission();
      return OneSignal.Notifications.permission;
    } catch { return false; }
  };

  const permission = ready ? OneSignal.Notifications.permission : false;
  return { ready, permission, requestPermission, error };
}
