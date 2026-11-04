#!/usr/bin/env bash
# patch-transfer.sh — Corrige la vérification du destinataire
set -euo pipefail

# ─── Vérifie qu'on est à la racine du projet ───
FUNCTION_FILE="supabase/functions/server/index.ts"
FUNCTION_NAME="server"
MIGRATIONS_DIR="supabase/migrations"

if [[ ! -f "$FUNCTION_FILE" ]]; then
  echo "❌ Erreur : '$FUNCTION_FILE' introuvable."
  echo "   → Place-toi à la racine du projet (là où il y a le dossier 'supabase/')."
  exit 1
fi

# ─── Backup ───
BACKUP="${FUNCTION_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$FUNCTION_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

# ─── 1) Migration SQL ───
mkdir -p "$MIGRATIONS_DIR"
MIGRATION_FILE="${MIGRATIONS_DIR}/$(date +%Y%m%d%H%M%S)_add_get_user_id_by_email.sql"

cat > "$MIGRATION_FILE" <<'SQL'
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_addr text)
RETURNS TABLE (id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, (u.raw_user_meta_data->>'name')::text
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(email_addr))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO service_role;
SQL

echo "📦 Migration SQL → $MIGRATION_FILE"

# ─── 2) Patch de index.ts via Python ───
echo "🩹 Patch de $FUNCTION_FILE…"

PATCH_OUTPUT=$(FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib

path = pathlib.Path(os.environ["FUNCTION_FILE"])
if not path.is_file():
    print(f"ERR: fichier introuvable: {path}")
    sys.exit(2)

src = path.read_text(encoding="utf-8")

# ── A. Remplace le bloc "Trouver le destinataire" ──
start_marker = "  // 1. Trouver le destinataire par son email"
end_marker = "  // 2. Vérifier le solde de l'expéditeur"

start_idx = src.find(start_marker)
end_idx = src.find(end_marker)

if start_idx == -1:
    print("ERR: marqueur '// 1. Trouver le destinataire' introuvable")
    sys.exit(2)
if end_idx == -1:
    print("ERR: marqueur '// 2. Vérifier le solde' introuvable")
    sys.exit(2)
if end_idx <= start_idx:
    print("ERR: ordre des marqueurs incorrect")
    sys.exit(2)

new_block = """  // ═══ 1. Valider et normaliser l'email ═══
  const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const cleanRecipient = String(recipient || "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(cleanRecipient)) {
    return Response.json(
      { error: "invalid_email_format", message: "L'adresse email du destinataire est invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  // ═══ 2. Trouver le destinataire via RPC (rapide, indexé) ═══
  const { data: recipientRows, error: recipientErr } = await supabase.rpc(
    "get_user_id_by_email",
    { email_addr: cleanRecipient }
  );

  if (recipientErr) {
    console.error("[TRANSFER] rpc error:", recipientErr);
    return Response.json({ error: "Erreur serveur" }, { status: 500, headers: corsHeaders });
  }

  if (!recipientRows || recipientRows.length === 0) {
    return Response.json(
      { error: "recipient_not_found", message: "Aucun compte AYO n'est associé à cette adresse email. Vérifiez et réessayez." },
      { status: 404, headers: corsHeaders }
    );
  }

  const recipientUser = {
    id: recipientRows[0].id,
    email: recipientRows[0].email,
    user_metadata: { name: recipientRows[0].name },
  };

  // ═══ 3. Vérifications métier ═══
  if (recipientUser.id === userId) {
    return Response.json(
      { error: "self_transfer", message: "Vous ne pouvez pas vous envoyer de l'argent à vous-même." },
      { status: 400, headers: corsHeaders }
    );
  }

"""

src = src[:start_idx] + new_block + src[end_idx:]
print("OK: bloc destinataire remplacé")

# ── B. Ajoute handleVerifyRecipient ──
if "async function handleVerifyRecipient(" in src:
    print("SKIP: handleVerifyRecipient déjà présent")
else:
    marker = "async function handleGetTransactionStatus(userId: string, transactionId: string) {"
    if marker not in src:
        print("ERR: marqueur handleGetTransactionStatus introuvable")
        sys.exit(2)
    handler = """async function handleVerifyRecipient(req: Request, userId: string) {
  const ip = getClientIp(req);
  const check = await checkRateLimit(kv, `rate:verify-recipient:${userId}:${ip}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    blockMs: 300_000,
  });
  if (!check.allowed) {
    return Response.json({ found: false, reason: "rate_limited" }, { status: 429, headers: corsHeaders });
  }

  const { email } = await req.json().catch(() => ({}));
  const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const clean = String(email || "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(clean)) {
    return Response.json({ found: false, reason: "invalid_format" }, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rows, error } = await supabase.rpc("get_user_id_by_email", { email_addr: clean });
  if (error || !rows || rows.length === 0) {
    return Response.json({ found: false, reason: "not_found" }, { headers: corsHeaders });
  }
  if (rows[0].id === userId) {
    return Response.json({ found: false, reason: "self" }, { headers: corsHeaders });
  }
  return Response.json(
    { found: true, name: rows[0].name || rows[0].email?.split("@")[0] || "Utilisateur AYO" },
    { headers: corsHeaders }
  );
}

"""
    src = src.replace(marker, handler + marker, 1)
    print("OK: handleVerifyRecipient ajouté")

# ── C. Ajoute la route /wallet/verify-recipient ──
if "/wallet/verify-recipient" in src:
    print("SKIP: route déjà présente")
else:
    route_marker = 'if (method === "POST" && path.endsWith("/wallet/transfer")) return await handleTransfer(req, userId);'
    if route_marker not in src:
        print("ERR: route /wallet/transfer introuvable")
        sys.exit(2)
    route_new = (
        'if (method === "POST" && path.endsWith("/wallet/verify-recipient")) '
        'return await handleVerifyRecipient(req, userId);\n      '
        + route_marker
    )
    src = src.replace(route_marker, route_new, 1)
    print("OK: route /wallet/verify-recipient ajoutée")

path.write_text(src, encoding="utf-8")
print("DONE")
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  echo "❌ Patch annulé → restauration du backup"
  cp "$BACKUP" "$FUNCTION_FILE"
  exit 1
fi

# ─── 3) Diff + confirmation ───
echo ""
echo "─── Diff ───"
diff -u "$BACKUP" "$FUNCTION_FILE" || true
echo "────────────"
echo ""

read -r -p "🚀 Appliquer la migration SQL ET déployer la fonction '$FUNCTION_NAME' ? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  echo "⏸️  Annulé."
  echo "   Fichier patché localement : $FUNCTION_FILE"
  echo "   Backup                    : $BACKUP"
  echo "   Pour rollback             : cp \"$BACKUP\" \"$FUNCTION_FILE\""
  exit 0
fi

# ─── 4) Application de la migration ───
if command -v supabase >/dev/null 2>&1; then
  echo "🚀 Migration (supabase db push)…"
  supabase db push --linked || {
    echo "⚠️  'supabase db push' a échoué."
    echo "   → Applique manuellement le contenu de '$MIGRATION_FILE'"
    echo "     dans Supabase Dashboard → SQL Editor"
    exit 1
  }
else
  echo "⚠️  supabase CLI introuvable."
  echo "   → Copie-colle le contenu de '$MIGRATION_FILE'"
  echo "     dans Supabase Dashboard → SQL Editor, puis relance le déploiement manuellement."
  exit 0
fi

# ─── 5) Déploiement ───
echo "🚀 Déploiement…"
supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt

echo ""
echo "✅ Terminé."
echo "   Backup : $BACKUP"
echo "   Rollback : cp \"$BACKUP\" \"$FUNCTION_FILE\" && supabase functions deploy $FUNCTION_NAME --no-verify-jwt"
