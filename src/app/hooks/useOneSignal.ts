import { useEffect, useRef, useState } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "../contexts/AuthContext";

// Verrou global pour éviter la double initialisation due à React StrictMode
let onesignalInitialized = false;
let onesignalInitPromise: Promise<void> | null = null;

function initOneSignalOnce(appId: string): Promise<void> {
  if (onesignalInitPromise) return onesignalInitPromise;

  onesignalInitPromise = OneSignal.init({
    appId,
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
    // ⬇️ Configuration CRUCIALE pour éviter le conflit avec ton PWA
    serviceWorkerPath: "/push/onesignal/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/push/onesignal/" },
  })
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
  const [ready, setReady] = useState(onesignalInitialized);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
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
      .then(() => { setReady(true); setError(null); })
      .catch((e) => setError(e?.message || "init_failed"));
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
