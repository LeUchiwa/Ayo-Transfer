#!/usr/bin/env bash
set -euo pipefail

LAYOUT_FILE="src/app/components/ProtectedLayout.tsx"
BANNER_FILE="src/app/components/PWAInstallBanner.tsx"

[[ -f "$LAYOUT_FILE" ]] || { echo "❌ $LAYOUT_FILE introuvable"; exit 1; }

# ═══════════════════════════════════════════════
# 1. Créer PWAInstallMenuItem.tsx (s'il n'existe pas)
# ═══════════════════════════════════════════════
if [[ ! -f src/app/components/PWAInstallMenuItem.tsx ]]; then
cat > src/app/components/PWAInstallMenuItem.tsx <<'EOF'
import { useState } from "react";
import { Download, Check } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { PWAInstallGuide } from "./PWAInstallGuide";

interface Props {
  onClose?: () => void;
}

export function PWAInstallMenuItem({ onClose }: Props) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handleClick = async () => {
    if (isInstalled) return;
    if (isIOS) { setShowGuide(true); return; }
    if (isInstallable) {
      const result = await promptInstall();
      if (result === "accepted" || result === "dismissed") onClose?.();
      return;
    }
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
EOF
echo "✅ PWAInstallMenuItem.tsx créé"
else
echo "SKIP: PWAInstallMenuItem.tsx existe déjà"
fi

# ═══════════════════════════════════════════════
# 2. Améliorer PWAInstallBanner (retour toutes les 3 visites)
# ═══════════════════════════════════════════════
if [[ -f "$BANNER_FILE" ]]; then
  BACKUP_BANNER="${BANNER_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
  cp "$BANNER_FILE" "$BACKUP_BANNER"
  echo "🔒 Backup Banner → $BACKUP_BANNER"

cat > "$BANNER_FILE" <<'EOF'
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
  echo "✅ PWAInstallBanner.tsx amélioré (3 visites + 20s)"
else
  echo "SKIP: PWAInstallBanner.tsx absent"
fi

# ═══════════════════════════════════════════════
# 3. Patcher ProtectedLayout.tsx (2 menus + import)
# ═══════════════════════════════════════════════
BACKUP_LAYOUT="${LAYOUT_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$LAYOUT_FILE" "$BACKUP_LAYOUT"
echo "🔒 Backup Layout → $BACKUP_LAYOUT"

PATCH_OUTPUT=$(LAYOUT_FILE="$LAYOUT_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib

p = pathlib.Path(os.environ["LAYOUT_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ── Import ──
if "PWAInstallMenuItem" in src and "import { PWAInstallMenuItem }" in src:
    print("SKIP: import déjà présent")
else:
    old_import = 'import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";'
    new_import = old_import + '\nimport { PWAInstallMenuItem } from "./PWAInstallMenuItem";'
    if old_import not in src:
        print("ERR: import usePendingTransactionsCount introuvable")
        sys.exit(2)
    src = src.replace(old_import, new_import, 1)
    ops.append("import")

# ── Menu desktop + mobile : les 2 blocs "Déconnexion" sont précédés du même séparateur ──
# Pattern à remplacer (apparaît 2 fois : desktop et mobile)
old_pattern = """                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="w-4 h-4 mr-2" />
                      Mon profil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>"""

new_pattern = """                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="w-4 h-4 mr-2" />
                      Mon profil
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <PWAInstallMenuItem />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>"""

count = src.count(old_pattern)
if count == 0:
    print("ERR: bloc menu profil introuvable")
    sys.exit(2)
src = src.replace(old_pattern, new_pattern)
ops.append(f"menus({count})")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops))
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP_LAYOUT" "$LAYOUT_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════"
echo "✅ Terminé"
echo "════════════════════════════════════════════════"
echo "Vérifs :"
echo "  PWAInstallMenuItem : $(grep -c 'PWAInstallMenuItem' "$LAYOUT_FILE") occurrences (doit être 3)"
echo "  Import ajouté      : $(grep -c 'import { PWAInstallMenuItem }' "$LAYOUT_FILE") (doit être 1)"
echo "  Balance accolades  : { $(grep -o '{' "$LAYOUT_FILE" | wc -l) / } $(grep -o '}' "$LAYOUT_FILE" | wc -l)"
echo ""
echo "Prochaines étapes :"
echo "  1. npm run dev"
echo "  2. Tester /admin ou /transfer → menu profil → 'Installer l'app'"
echo "  3. Si OK : git commit + push + wrangler deploy"
