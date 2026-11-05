import { useState } from "react";
import { Download, Check } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { PWAInstallGuide } from "./PWAInstallGuide";

interface Props {
  onClose?: () => void;
}

/**
 * Bouton "Installer l'app" à insérer dans le menu profil.
 * - Si déjà installé → affiche "App installée" (disabled)
 * - Si installable → déclenche le popup natif
 * - Si iOS → ouvre le guide manuel
 * - Sinon → petit message d'aide
 */
export function PWAInstallMenuItem({ onClose }: Props) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handleClick = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowGuide(true);
      return;
    }

    if (isInstallable) {
      const result = await promptInstall();
      if (result === "accepted" || result === "dismissed") {
        onClose?.();
      }
      return;
    }

    // Fallback : navigateur ne supporte pas l'API
    setUnavailable(true);
    setTimeout(() => setUnavailable(false), 4000);
  };

  if (isInstalled) {
    return (
      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground opacity-60 cursor-default">
        <Check className="w-4 h-4" />
        <span className="flex-1 text-left">App installée</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
      >
        <Download className="w-4 h-4 text-primary" />
        <span className="flex-1 text-left">Installer l'app</span>
      </button>

      {unavailable && (
        <p className="text-xs text-muted-foreground px-3 pb-2">
          Ouvrez le menu de votre navigateur → "Ajouter à l'écran d'accueil"
        </p>
      )}

      {showGuide && <PWAInstallGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
