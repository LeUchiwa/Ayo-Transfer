#!/usr/bin/env bash
set -euo pipefail

echo "🎨 Application des couleurs sombres..."

python3 <<'PY'
import pathlib, re

# Dictionnaire des remplacements (Light -> Light + Dark)
replacements = {
    # Fonds
    r'\bbg-white\b': 'bg-white dark:bg-slate-900',
    r'\bbg-gray-50\b': 'bg-gray-50 dark:bg-slate-800/50',
    r'\bbg-gray-100\b': 'bg-gray-100 dark:bg-slate-800',
    r'\bbg-gray-200\b': 'bg-gray-200 dark:bg-slate-700',
    
    # Textes
    r'\btext-gray-900\b': 'text-gray-900 dark:text-gray-100',
    r'\btext-gray-800\b': 'text-gray-800 dark:text-gray-200',
    r'\btext-gray-700\b': 'text-gray-700 dark:text-gray-300',
    r'\btext-gray-600\b': 'text-gray-600 dark:text-gray-400',
    r'\btext-gray-500\b': 'text-gray-500 dark:text-gray-400',
    
    # Bordures
    r'\bborder-gray-100\b': 'border-gray-100 dark:border-slate-800',
    r'\bborder-gray-200\b': 'border-gray-200 dark:border-slate-700',
    
    # Hovers
    r'\bhover:bg-gray-50\b': 'hover:bg-gray-50 dark:hover:bg-slate-800',
    r'\bhover:bg-gray-100\b': 'hover:bg-gray-100 dark:hover:bg-slate-700',
}

files_changed = 0

# On parcourt tous les fichiers TSX dans src/app
for p in pathlib.Path("src/app").rglob("*.tsx"):
    # On ignore les fichiers de composants UI de base pour ne pas tout casser
    if "components/ui" in str(p):
        continue

    src = p.read_text(encoding="utf-8")
    original = src

    for pattern, replacement in replacements.items():
        # On remplace uniquement si le dark: n'est pas déjà là
        # Regex pour trouver le mot entier
        def repl(match):
            text = match.group(0)
            if "dark:" in src[match.start():match.start()+50]: # vérification basique
                return text
            return replacement
        
        src = re.sub(pattern, replacement, src)

    if src != original:
        p.write_text(src, encoding="utf-8")
        files_changed += 1

print(f"✅ {files_changed} fichiers mis à jour avec les couleurs sombres.")
PY
