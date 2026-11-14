#!/usr/bin/env bash
set -euo pipefail

# 1. Vérifier que le composant existe
if [ ! -f "src/app/components/ThemeToggle.tsx" ]; then
  echo "❌ ThemeToggle.tsx introuvable."
  exit 1
fi

python3 <<'PY'
import pathlib, re
p = pathlib.Path("src/app/components/ProtectedLayout.tsx")
src = p.read_text(encoding="utf-8")

# 1. S'assurer que l'import est là
if "ThemeToggle" not in src:
    src = src.replace(
        'import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";',
        'import { usePendingTransactionsCount } from "../hooks/usePendingTransactionsCount";\nimport { ThemeToggle } from "./ThemeToggle";'
    )
    print("✅ Import ajouté")

# 2. Chercher la section mobile (md:hidden)
# On cherche la div avec md:hidden qui contient le menu mobile
pattern = re.compile(r'(<div className="md:hidden[^"]*">\s*)', re.DOTALL)
match = pattern.search(src)

if match:
    # Vérifier si ThemeToggle n'est pas déjà juste après
    after_div = src[match.end():match.end()+100]
    if "<ThemeToggle" not in after_div:
        # Insérer le bouton juste après l'ouverture de la div mobile
        src = src[:match.end()] + '<ThemeToggle />\n        ' + src[match.end():]
        print("✅ ThemeToggle inséré dans la navigation mobile")
    else:
        print("SKIP: ThemeToggle déjà présent dans la navigation mobile")
else:
    print("❌ Section mobile (md:hidden) introuvable")

p.write_text(src, encoding="utf-8")
PY
