import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { PWAInstallGuide } from "./PWAInstallGuide";

const DISMISS_KEY = "ayo_pwa_banner_dismissed_until";
const VISITS_KEY = "ayo_pwa_visit_count";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && new Date(dismissedUntil).getTime() > Date.now()) return;

    const visits = Number(localStorage.getItem(VISITS_KEY) || "0") + 1;
    localStorage.setItem(VISITS_KEY, String(visits));

    if (!isIOS && !isInstallable) return;
    const shouldShow = visits === 1 || visits % 3 === 0;
    if (!shouldShow) return;

    const timer = setTimeout(() => { setVisible(true); }, 20_000);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, isIOS]);

  const handleInstall = async () => {
    if (isIOS) { setShowGuide(true); return; }
    const result = await promptInstall();
    if (result === "accepted" || result === "dismissed") setVisible(false);
  };

  const handleDismiss = () => {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    localStorage.setItem(DISMISS_KEY, until.toISOString());
    setVisible(false);
  };

  if (!visible || isInstalled) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Installer AYO</p>
              <p className="text-xs text-muted-foreground mt-1">Accès plus rapide depuis votre écran d'accueil</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleInstall} className="bg-primary hover:bg-primary/90 text-white">Installer</Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>Plus tard</Button>
              </div>
            </div>
            <button onClick={handleDismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {showGuide && <PWAInstallGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
