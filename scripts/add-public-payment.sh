#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.payment"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")

# 1. Ajouter le handler
handler = '''async function handleGetPublicProfile(userId: string) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
  
  if (error || !user) {
    return Response.json({ error: "Utilisateur introuvable" }, { status: 404, headers: corsHeaders });
  }
  
  return Response.json({
    id: user.id,
    name: user.user_metadata?.name || user.email?.split("@")[0] || "Utilisateur AYO",
    email: user.email
  }, { headers: corsHeaders });
}

'''
marker = "async function handleGetProfile(userId: string) {"
if "handleGetPublicProfile" not in src:
    src = src.replace(marker, handler + marker, 1)

# 2. Ajouter la route publique (avant le check auth)
# On la place juste avant la vérification du token utilisateur
route_anchor = '    // ═══ WALLET & KYC (JWT Supabase) ═══'
route_new = '''    // ═══ ROUTE PUBLIQUE (Pas de JWT requis) ═══
    if (method === "GET" && path.includes("/profile/public/")) {
      const publicUserId = path.split("/profile/public/")[1];
      return await handleGetPublicProfile(publicUserId);
    }

    // ═══ WALLET & KYC (JWT Supabase) ═══'''

if "/profile/public/" not in src:
    src = src.replace(route_anchor, route_new, 1)

p.write_text(src, encoding="utf-8")
print("✅ Backend mis à jour : Route publique de paiement ajoutée.")
PY
