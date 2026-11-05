#!/usr/bin/env bash
set -euo pipefail

FUNCTION_FILE="supabase/functions/server/index.ts"
[[ -f "$FUNCTION_FILE" ]] || { echo "❌ $FUNCTION_FILE introuvable"; exit 1; }

BACKUP="${FUNCTION_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$FUNCTION_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

PATCH_OUTPUT=$(FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib

p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ═══ PATCH 1 — handleAdminGetUserActivity ═══
handler_code = '''async function handleAdminGetUserActivity(userId: string) {
  const txs = (await kv.get(`transactions:${userId}`)) || [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const hourAgo = now - 60 * 60 * 1000;

  const recent24h = txs.filter((t: any) => new Date(t.createdAt || 0).getTime() > dayAgo);
  const recent1h = txs.filter((t: any) => new Date(t.createdAt || 0).getTime() > hourAgo);

  const sent24h = recent24h.filter((t: any) => t.type === "transfer_sent");
  const received24h = recent24h.filter((t: any) => t.type === "transfer_received");
  const deposits24h = recent24h.filter((t: any) => t.type === "deposit");
  const withdrawals24h = recent24h.filter((t: any) => t.type === "withdrawal");
  const failed24h = recent24h.filter((t: any) => t.status === "failed" || t.status === "cancelled");

  const uniqueRecipients = new Set(sent24h.map((t: any) => t.recipient).filter(Boolean)).size;
  const totalSent = sent24h.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalReceived = received24h.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const THRESHOLDS = {
    countSent: 20,
    totalSent: 500_000,
    uniqueRecipients: 5,
    failed1h: 3,
  };

  const alerts: string[] = [];
  if (sent24h.length > THRESHOLDS.countSent) alerts.push(`> ${THRESHOLDS.countSent} transferts en 24h (${sent24h.length})`);
  if (totalSent > THRESHOLDS.totalSent) alerts.push(`> ${THRESHOLDS.totalSent.toLocaleString("fr-FR")} FCFA envoyés en 24h (${totalSent.toLocaleString("fr-FR")})`);
  if (uniqueRecipients > THRESHOLDS.uniqueRecipients) alerts.push(`> ${THRESHOLDS.uniqueRecipients} destinataires distincts en 24h (${uniqueRecipients})`);
  if (recent1h.filter((t: any) => t.status === "failed").length > THRESHOLDS.failed1h) alerts.push(`> ${THRESHOLDS.failed1h} échecs en 1h`);

  return Response.json({
    activity: {
      sent24h: sent24h.length,
      sentAmount24h: totalSent,
      received24h: received24h.length,
      receivedAmount24h: totalReceived,
      deposits24h: deposits24h.length,
      withdrawals24h: withdrawals24h.length,
      failed24h: failed24h.length,
      uniqueRecipients24h: uniqueRecipients,
      totalTx24h: recent24h.length,
    },
    thresholds: THRESHOLDS,
    suspicious: alerts.length > 0,
    alerts,
  }, { headers: corsHeaders });
}

'''

marker = "async function handleAdminListUsers(supabase: any) {"
if marker not in src:
    print("ERR: handleAdminListUsers introuvable")
    sys.exit(2)
if "handleAdminGetUserActivity" in src:
    print("SKIP: handleAdminGetUserActivity existe déjà")
else:
    src = src.replace(marker, handler_code + marker, 1)
    ops.append("PATCH-1: handleAdminGetUserActivity ajouté")

# ═══ PATCH 2 — suspicious dans handleAdminListUsers ═══
old_return = '''        return {
          id: u.id,
          email: u.email || "",
          name: u.user_metadata?.name || (u.email ? u.email.split("@")[0] : "Utilisateur"),'''

new_return = '''        const _txs = (await kv.get(`transactions:${u.id}`)) || [];
        const _dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const _recent = _txs.filter((t: any) => new Date(t.createdAt || 0).getTime() > _dayAgo);
        const _sent24h = _recent.filter((t: any) => t.type === "transfer_sent");
        const _suspicious =
          _sent24h.length > 20 ||
          _sent24h.reduce((s: number, t: any) => s + (t.amount || 0), 0) > 500_000 ||
          new Set(_sent24h.map((t: any) => t.recipient).filter(Boolean)).size > 5;

        return {
          id: u.id,
          email: u.email || "",
          name: u.user_metadata?.name || (u.email ? u.email.split("@")[0] : "Utilisateur"),'''

if old_return not in src:
    print("ERR: return handleAdminListUsers introuvable")
    sys.exit(2)
if "_suspicious" in src:
    print("SKIP: suspicious déjà présent")
else:
    src = src.replace(old_return, new_return, 1)
    old_last_field = '''          countReceived: wallet.countReceived || 0,
        };'''
    new_last_field = '''          countReceived: wallet.countReceived || 0,
          suspicious: _suspicious,
        };'''
    if old_last_field not in src:
        print("ERR: fin return handleAdminListUsers introuvable")
        sys.exit(2)
    src = src.replace(old_last_field, new_last_field, 1)
    ops.append("PATCH-2: suspicious ajouté")

# ═══ PATCH 3 — Route /admin/users/:id/activity ═══
route_anchor = 'if (method === "GET" && path.endsWith("/admin/users")) return await handleAdminListUsers(supabaseAdmin);'
route_new = '''if (method === "GET" && path.endsWith("/admin/users")) return await handleAdminListUsers(supabaseAdmin);
        if (method === "GET" && path.includes("/admin/users/") && path.endsWith("/activity")) {
          const _uid = path.split("/admin/users/")[1].replace("/activity", "");
          return await handleAdminGetUserActivity(_uid);
        }'''

if route_anchor not in src:
    print("ERR: route /admin/users introuvable")
    sys.exit(2)
if 'path.endsWith("/activity")' in src:
    print("SKIP: route /activity existe déjà")
else:
    src = src.replace(route_anchor, route_new, 1)
    ops.append("PATCH-3: route /activity ajoutée")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops) if ops else "SKIP: rien à faire")
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP" "$FUNCTION_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "─── Vérifications ───"
echo "handleAdminGetUserActivity : $(grep -c 'async function handleAdminGetUserActivity' "$FUNCTION_FILE") (doit être 1)"
echo "_suspicious dans admin     : $(grep -c '_suspicious' "$FUNCTION_FILE") (doit être 2)"
echo "Route /activity            : $(grep -c 'path.endsWith(\"/activity\")' "$FUNCTION_FILE") (doit être 1)"
echo ""
echo "Balance accolades : { $(grep -o '{' "$FUNCTION_FILE" | wc -l) / } $(grep -o '}' "$FUNCTION_FILE" | wc -l)"
echo ""
echo "✅ Terminé. Backup : $BACKUP"
