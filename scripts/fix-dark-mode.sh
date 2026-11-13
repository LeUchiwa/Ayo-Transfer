#!/usr/bin/env bash
set -euo pipefail

# 1. Configurer Tailwind v4 pour utiliser la classe .dark
# On cherche le fichier CSS principal
CSS_FILE=$(find src -name "index.css" -o -name "globals.css" -o -name "styles.css" | head -1)
if [ -z "$CSS_FILE" ]; then
  echo "❌ Fichier CSS principal introuvable."
  exit 1
fi

echo "🎨 Fichier CSS trouvé : $CSS_FILE"

if ! grep -q "custom-variant dark" "$CSS_FILE"; then
  # Ajouter tout en haut du fichier (après les @import s'il y en a)
  cat >> "$CSS_FILE" <<'EOF'

@custom-variant dark (&:where(.dark, .dark *));

/* Fond par défaut en mode sombre */
body {
  background-color: white;
  color: #111827;
  transition: background-color 0.2s ease;
}

html.dark body {
  background-color: #0f172a;
  color: #f1f5f9;
}
EOF
  echo "✅ Configuration Tailwind v4 ajoutée au CSS."
else
  echo "SKIP: Configuration Tailwind déjà présente."
fi

# 2. Corriger les fonds avec opacité (bg-white/XX) qui ont été oubliés
python3 <<'PY'
import pathlib, re

fixed = 0
for p in pathlib.Path("src/app").rglob("*.tsx"):
    if "components/ui" in str(p):
        continue
    src = p.read_text(encoding="utf-8")
    original = src
    
    # Fonds avec opacité (background flou, etc.)
    replacements = {
        r'\bbg-white/95\b': 'bg-white/95 dark:bg-slate-900/95',
        r'\bbg-white/90\b': 'bg-white/90 dark:bg-slate-900/90',
        r'\bbg-white/80\b': 'bg-white/80 dark:bg-slate-900/80',
        r'\bbg-white/70\b': 'bg-white/70 dark:bg-slate-900/70',
        r'\bbg-white/50\b': 'bg-white/50 dark:bg-slate-900/50',
        # Attention : on ne touche pas à bg-white/10 ou /5 (utilisés sur fonds sombres fixes)
    }
    
    for pattern, replacement in replacements.items():
        if re.search(pattern, src) and replacement not in src:
            src = re.sub(pattern, replacement, src)
    
    if src != original:
        p.write_text(src, encoding="utf-8")
        fixed += 1

print(f"✅ {fixed} fichiers mis à jour pour les fonds avec opacité.")
PY
