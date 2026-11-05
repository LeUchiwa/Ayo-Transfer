#!/usr/bin/env bash
set -euo pipefail

echo "📦 Setup PWA AYO"
echo "════════════════"

# ─── Créer les dossiers ───
mkdir -p public/icons src/app/hooks src/app/components

# ═══════════════════════════════════════════════
# 1. public/manifest.json
# ═══════════════════════════════════════════════
cat > public/manifest.json <<'EOF'
{
  "name": "AYO Transfert d'argent",
  "short_name": "AYO",
  "description": "Envoyez de l'argent en toute simplicité avec AYO",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#14b8a6",
  "background_color": "#ffffff",
  "lang": "fr",
  "categories": ["finance", "productivity"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
EOF
echo "✅ public/manifest.json"

# ═══════════════════════════════════════════════
# 2. public/sw.js
# ═══════════════════════════════════════════════
cat > public/sw.js <<'EOF'
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", () => { /* pass-through */ });
EOF
echo "✅ public/sw.js"

# ═══════════════════════════════════════════════
# 3. Hook usePWAInstall
# ═══════════════════════════════════════════════
cat > src/app/hooks/usePWAInstall.ts <<'EOF'
import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PWAInstallState = {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return { isInstallable: !!deferredPrompt, isInstalled, isIOS, promptInstall };
}
EOF
echo "✅ src/app/hooks/usePWAInstall.ts"

# ═══════════════════════════════════════════════
# 4. PWAInstallGuide (iOS)
# ═══════════════════════════════════════════════
cat > src/app/components/PWAInstallGuide.tsx <<'EOF'
import { Share, Plus, X } from "lucide-react";
import { Button } from "./ui/button";

export function PWAInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Installer AYO sur iPhone</h3>
            <p className="text-sm text-muted-foreground mt-1">Suivez ces étapes dans Safari</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">1</span>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1">Appuyez sur <Share className="w-4 h-4 text-primary" /> en bas</p>
              <p className="text-xs text-muted-foreground">L'icône de partage de Safari</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">2</span>
            <p className="text-sm font-medium text-foreground flex items-center gap-1">Choisissez <Plus className="w-4 h-4 text-primary" /> "Sur l'écran d'accueil"</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">3</span>
            <p className="text-sm font-medium text-foreground">Appuyez sur "Ajouter"</p>
          </li>
        </ol>
        <Button onClick={onClose} className="w-full mt-6 bg-primary hover:bg-primary/90 text-white">Compris</Button>
      </div>
    </div>
  );
}
EOF
echo "✅ src/app/components/PWAInstallGuide.tsx"

# ═══════════════════════════════════════════════
# 5. PWAInstallBanner
# ═══════════════════════════════════════════════
cat > src/app/components/PWAInstallBanner.tsx <<'EOF'
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { PWAInstallGuide } from "./PWAInstallGuide";

const DISMISS_KEY = "ayo_pwa_banner_dismissed_until";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && new Date(dismissedUntil).getTime() > Date.now()) return;
    if (sessionStorage.getItem("ayo_pwa_banner_shown") === "1") return;
    if (!isIOS && !isInstallable) return;

    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem("ayo_pwa_banner_shown", "1");
    }, 30_000);
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
        <div className="bg-white rounded-xl shadow-2xl border border-border/50 p-4">
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
EOF
echo "✅ src/app/components/PWAInstallBanner.tsx"

# ═══════════════════════════════════════════════
# 6. Balises PWA dans index.html
# ═══════════════════════════════════════════════
if ! grep -q "manifest.json" index.html; then
  cp index.html index.html.bak.$(date +%Y%m%d_%H%M%S)
  python3 <<'PY'
import pathlib
p = pathlib.Path("index.html")
src = p.read_text(encoding="utf-8")
pwa = """
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#14b8a6" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="AYO" />
  </head>"""
src = src.replace("</head>", pwa, 1)
sw = """
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
      }
    </script>
  </body>"""
src = src.replace("</body>", sw, 1)
p.write_text(src, encoding="utf-8")
print("OK: balises PWA + SW ajoutés dans index.html")
PY
else
  echo "SKIP: balises PWA déjà présentes dans index.html"
fi

# ═══════════════════════════════════════════════
# Vérification finale
# ═══════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════"
echo "✅ Setup PWA terminé"
echo "════════════════════════════════════════════════"
echo "Fichiers créés :"
echo "  public/manifest.json"
echo "  public/sw.js"
echo "  public/icons/icon-192.png (déjà généré)"
echo "  public/icons/icon-512.png (déjà généré)"
echo "  public/icons/icon-512-maskable.png (déjà généré)"
echo "  src/app/hooks/usePWAInstall.ts"
echo "  src/app/components/PWAInstallGuide.tsx"
echo "  src/app/components/PWAInstallBanner.tsx"
echo ""
echo "Prochaine étape : brancher <PWAInstallBanner /> dans App.tsx"
