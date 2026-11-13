#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Correction des fonds opaques (erreur Dark Mode)..."

python3 <<'PY'
import pathlib, re

# On cherche les patterns qui ont été cassés
# Pattern 1 : bg-white dark:bg-slate-900/XX -> bg-white/XX dark:bg-slate-900/XX
pattern1 = re.compile(r'bg-white dark:bg-slate-900/(\d+)')
replacement1 = r'bg-white/\1 dark:bg-slate-900/\1'

# Pattern 2 : hover:bg-white dark:bg-slate-900/XX -> hover:bg-white/XX dark:hover:bg-slate-900/XX
pattern2 = re.compile(r'hover:bg-white dark:bg-slate-900/(\d+)')
replacement2 = r'hover:bg-white/\1 dark:hover:bg-slate-900/\1'

fixed_count = 0
for p in pathlib.Path("src/app").rglob("*.tsx"):
    src = p.read_text(encoding="utf-8")
    original = src
    
    src = pattern1.sub(replacement1, src)
    src = pattern2.sub(replacement2, src)
    
    if src != original:
        p.write_text(src, encoding="utf-8")
        fixed_count += 1
        print(f"  ✅ {p.name} corrigé")

print(f"\n🎉 {fixed_count} fichiers corrigés avec succès !")
PY
