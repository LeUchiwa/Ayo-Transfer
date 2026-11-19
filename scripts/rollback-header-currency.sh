#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Rollback : suppression du sélecteur dans le header..."

python3 <<'PY'
import pathlib, re

# ═══ 1. Nettoyer ProtectedLayout.tsx ═══
p = pathlib.Path("src/app/components/ProtectedLayout.tsx")
src = p.read_text(encoding="utf-8")

# Supprimer TOUTES les occurrences de <CurrencySelector ... />
src = re.sub(r'\s*<CurrencySelector[^/]*/>\s*\n?', '\n', src)

# Supprimer l'import
src = re.sub(r'import \{ CurrencySelector \} from "\./CurrencySelector";\n?', '', src)

# Nettoyer les doubles sauts de ligne
src = re.sub(r'\n{3,}', '\n\n', src)

p.write_text(src, encoding="utf-8")
print("✅ ProtectedLayout.tsx nettoyé (plus de CurrencySelector)")

# ═══ 2. Remettre History.tsx sans le hook si tu veux (optionnel) ═══
# Le hook reste utile, mais on va s'assurer qu'il ne casse pas si on revient en arrière
PY

echo "✅ Rollback terminé."
