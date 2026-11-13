import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";

export function PWAInstallPopup() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Écouter l'événement d'installation
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // 2. Afficher le pop-up après 3 visites (exemple de logique)
      const visits = Number(localStorage.getItem("ayo_visits") || "0") + 1;
      localStorage.setItem("ayo_visits", String(visits));
      
      if (visits >= 3 && !localStorage.getItem("ayo_install_dismissed")) {
        setTimeout(() => setIsVisible(true), 5000); // Attendre 5s
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("ayo_install_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-white rounded-xl shadow-2xl border border-teal-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900">Installer AYO</h3>
            <p className="text-xs text-gray-500 mt-1">Accédez à votre portefeuille plus rapidement depuis votre écran d'accueil.</p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleInstall} className="bg-teal-600 hover:bg-teal-700 text-white">
                Installer
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Plus tard
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
