#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.pubroute"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib, re
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")

# 1. On supprime l'ancienne route mal placée (si elle existe)
pattern = r"    // ═══ ROUTE PUBLIQUE \(Pas de JWT requis\) ═══\n    if \(method === \"GET\" && path\.includes\(\"/profile/public/\"\)\) \{\n.*?\n    \}\n\n"
src = re.sub(pattern, "", src, count=1, flags=re.DOTALL)

# 2. On l'insère au bon endroit : tout en haut, juste avant l'auth globale
# On cherche le début du bloc "AUTH" qui vérifie le token
anchor = "    // ═══ AUTH ═══\n    const authHeader = req.headers.get(\"Authorization\");"

new_route = '''    // ═══ ROUTE PUBLIQUE (Pas de JWT requis) ═══
    if (method === "GET" && path.includes("/profile/public/")) {
      const publicUserId = path.split("/profile/public/")[1];
      return await handleGetPublicProfile(publicUserId);
    }

    // ═══ AUTH ═══
    const authHeader = req.headers.get("Authorization");'''

if anchor in src:
    src = src.replace(anchor, new_route, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Route publique déplacée tout en haut (avant la sécurité JWT).")
else:
    print("❌ Impossible de trouver le point d'insertion (bloc AUTH).")
    sys.exit(2)
PY

echo "✅ Correction terminée."
