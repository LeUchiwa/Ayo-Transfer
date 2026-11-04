#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
FUNCTION_NAME="server"

[[ -f "$FUNCTION_FILE" ]] || { echo "❌ $FUNCTION_FILE introuvable"; exit 1; }
grep -q "handleVerifyRecipient" "$FUNCTION_FILE" || { echo "❌ Fix transfert absent"; exit 1; }

BACKUP="${FUNCTION_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$FUNCTION_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

PATCH_OUTPUT=$(FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

def replace(old, new, label):
    global src
    if old not in src:
        print(f"ERR: marqueur introuvable → {label}"); sys.exit(2)
    if src.count(old) > 1 and label != "handleTransfer.recordUsage":
        print(f"ERR: ambigu ({src.count(old)}x) → {label}"); sys.exit(2)
    src = src.replace(old, new, 1); ops.append(label)

HELPERS = '''// ═══════════════════════════════════════════════
// LIMITES JOURNALIÈRES / MENSUELLES
// ═══════════════════════════════════════════════

type LimitCheck =
  | { ok: true }
  | { ok: false; scope: "daily" | "monthly"; limit: number; used: number; remaining: number };

async function getLimitsForUser(userId: string) {
  const settings = await kv.get("admin:settings");
  const lim = settings?.limits || {};
  const kyc = await kv.get(`kyc:${userId}`);
  const approved = kyc?.status === "approved";
  return {
    daily:   approved ? (lim.kycDaily   ?? 2_000_000)  : (lim.daily   ?? 500_000),
    monthly: approved ? (lim.kycMonthly ?? 10_000_000) : (lim.monthly ?? 2_000_000),
  };
}

async function checkLimits(userId: string, field: "sent" | "withdrawn", amount: number): Promise<LimitCheck> {
  const { daily, monthly } = await getLimitsForUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const counters = (await kv.get(`counters:${userId}`)) || {};
  const dailyUsed = counters[today] || 0;
  const monthlyUsed = counters[month] || 0;
  if (dailyUsed + amount > daily) {
    return { ok: false, scope: "daily", limit: daily, used: dailyUsed, remaining: Math.max(0, daily - dailyUsed) };
  }
  if (monthlyUsed + amount > monthly) {
    return { ok: false, scope: "monthly", limit: monthly, used: monthlyUsed, remaining: Math.max(0, monthly - monthlyUsed) };
  }
  return { ok: true };
}

async function recordUsage(userId: string, _field: "sent" | "withdrawn", amount: number) {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const counters = (await kv.get(`counters:${userId}`)) || {};
  counters[today] = (counters[today] || 0) + amount;
  counters[month] = (counters[month] || 0) + amount;
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const k of Object.keys(counters)) {
    if (k.length === 10 && k < cutoffStr) delete counters[k];
  }
  await kv.set(`counters:${userId}`, counters);
}

'''
m = "async function handleTransfer(req: Request, userId: string) {"
if m not in src: print("ERR: handleTransfer introuvable"); sys.exit(2)
src = src.replace(m, HELPERS + m, 1); ops.append("helpers-limits")

replace(
  "  // 2. Vérifier le solde de l'expéditeur\n  const senderWallet = await getUserWallet(userId);",
  '''  // ═══ NEW: limites
  const _limitCheck = await checkLimits(userId, "sent", Number(amount) + fee);
  if (!_limitCheck.ok) {
    return Response.json({ error: "limit_exceeded", scope: _limitCheck.scope, limit: _limitCheck.limit, used: _limitCheck.used, remaining: _limitCheck.remaining, message: `Limite ${_limitCheck.scope === "daily" ? "journalière" : "mensuelle"} dépassée. Reste : ${_limitCheck.remaining.toLocaleString("fr-FR")} FCFA.` }, { status: 403, headers: corsHeaders });
  }

  // 2. Vérifier le solde de l'expéditeur
  const senderWallet = await getUserWallet(userId);''',
  "handleTransfer.checkLimits"
)

replace(
  '  // ⬇️ NOUVEAU : Créditer le compte de revenus plateforme\n  await creditPlatformRevenue(fee, reference, "transfer_fee");',
  '  await recordUsage(userId, "sent", Number(amount) + fee);\n\n  // ⬇️ NOUVEAU : Créditer le compte de revenus plateforme\n  await creditPlatformRevenue(fee, reference, "transfer_fee");',
  "handleTransfer.recordUsage"
)

replace(
  '  // ⬇️ NOUVEAU : Récupérer les transactions AVANT la vérification\n  const transactions = await getUserTransactions(userId);',
  '''  const _limitCheckW = await checkLimits(userId, "withdrawn", Number(amount) + fee);
  if (!_limitCheckW.ok) {
    return Response.json({ error: "limit_exceeded", scope: _limitCheckW.scope, limit: _limitCheckW.limit, used: _limitCheckW.used, remaining: _limitCheckW.remaining, message: `Limite ${_limitCheckW.scope === "daily" ? "journalière" : "mensuelle"} dépassée. Reste : ${_limitCheckW.remaining.toLocaleString("fr-FR")} FCFA.` }, { status: 403, headers: corsHeaders });
  }

  // ⬇️ NOUVEAU : Récupérer les transactions AVANT la vérification
  const transactions = await getUserTransactions(userId);''',
  "handleWithdraw.checkLimits"
)

replace(
  '''  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleConfirm''',
  '''  await recordUsage(userId, "withdrawn", Number(amount) + fee);

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleConfirm''',
  "handleWithdraw.recordUsage"
)

old_hgt = '''async function handleGetTransactions(userId: string) {
  const transactions = await getUserTransactions(userId);
  const sorted = [...transactions].sort(
    (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  return Response.json({ transactions: sorted }, { headers: corsHeaders });
}'''

new_hgt = '''async function handleGetTransactions(userId: string, req: Request) {
  const transactions = await getUserTransactions(userId);
  const url = new URL(req.url);
  if (!url.searchParams.has("page")) {
    const sorted = [...transactions].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return Response.json({ transactions: sorted }, { headers: corsHeaders });
  }
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.toLowerCase().trim();

  let filtered: any[] = [...transactions];
  if (type && type !== "all") filtered = filtered.filter((t: any) => t.type === type);
  if (from) filtered = filtered.filter((t: any) => (t.createdAt || "") >= from);
  if (to) filtered = filtered.filter((t: any) => (t.createdAt || "") <= to);
  if (q) filtered = filtered.filter((t: any) => (t.recipient?.toLowerCase() || "").includes(q) || (t.reference?.toLowerCase() || "").includes(q) || (t.method?.toLowerCase() || "").includes(q));

  filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return Response.json({ transactions: filtered.slice(start, start + limit), page, limit, total, totalPages, hasMore: page < totalPages }, { headers: corsHeaders });
}'''

if old_hgt not in src: print("ERR: handleGetTransactions introuvable"); sys.exit(2)
src = src.replace(old_hgt, new_hgt, 1); ops.append("handleGetTransactions.paginated")

BENEF = '''async function handleListBeneficiaries(userId: string) {
  const list = (await kv.get(`beneficiaries:${userId}`)) || [];
  const sorted = [...list].sort((a: any, b: any) => new Date(b.lastUsedAt || b.createdAt || 0).getTime() - new Date(a.lastUsedAt || a.createdAt || 0).getTime());
  return Response.json({ beneficiaries: sorted }, { headers: corsHeaders });
}

async function handleCreateBeneficiary(req: Request, userId: string) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!EMAIL_REGEX.test(email)) return Response.json({ error: "invalid_email" }, { status: 400, headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await supabase.rpc("get_user_id_by_email", { email_addr: email });
  if (error) return Response.json({ error: "server_error" }, { status: 500, headers: corsHeaders });
  if (!rows || rows.length === 0) return Response.json({ error: "recipient_not_found", message: "Aucun compte AYO avec cet email." }, { status: 404, headers: corsHeaders });
  if (rows[0].id === userId) return Response.json({ error: "self_transfer" }, { status: 400, headers: corsHeaders });

  const list = (await kv.get(`beneficiaries:${userId}`)) || [];
  if (list.some((b: any) => b.email === email)) return Response.json({ error: "already_exists" }, { status: 409, headers: corsHeaders });
  if (list.length >= 50) return Response.json({ error: "limit_reached" }, { status: 400, headers: corsHeaders });

  const beneficiary = { id: crypto.randomUUID(), name: name || rows[0].name || email.split("@")[0], email, phone, createdAt: new Date().toISOString(), lastUsedAt: null };
  list.unshift(beneficiary);
  await kv.set(`beneficiaries:${userId}`, list);
  return Response.json({ success: true, beneficiary }, { headers: corsHeaders });
}

async function handleDeleteBeneficiary(userId: string, beneficiaryId: string) {
  const list = (await kv.get(`beneficiaries:${userId}`)) || [];
  const filtered = list.filter((b: any) => b.id !== beneficiaryId);
  if (filtered.length === list.length) return Response.json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  await kv.set(`beneficiaries:${userId}`, filtered);
  return Response.json({ success: true }, { headers: corsHeaders });
}

async function handleTouchBeneficiary(userId: string, beneficiaryId: string) {
  const list = (await kv.get(`beneficiaries:${userId}`)) || [];
  const idx = list.findIndex((b: any) => b.id === beneficiaryId);
  if (idx === -1) return Response.json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  list[idx].lastUsedAt = new Date().toISOString();
  await kv.set(`beneficiaries:${userId}`, list);
  return Response.json({ success: true, beneficiary: list[idx] }, { headers: corsHeaders });
}

'''
m2 = "async function handleGetTransactionStatus(userId: string, transactionId: string) {"
if m2 not in src: print("ERR: handleGetTransactionStatus introuvable"); sys.exit(2)
src = src.replace(m2, BENEF + m2, 1); ops.append("beneficiaries-handlers")

replace(
  'if (method === "GET" && path.endsWith("/transactions")) return await handleGetTransactions(userId);',
  'if (method === "GET" && path.endsWith("/transactions")) return await handleGetTransactions(userId, req);',
  "route.transactions.passReq"
)

ANCHOR = 'if (method === "GET" && path.endsWith("/transactions")) return await handleGetTransactions(userId, req);'
NEW = ANCHOR + '''
      if (method === "GET"    && path.endsWith("/beneficiaries")) return await handleListBeneficiaries(userId);
      if (method === "POST"   && path.endsWith("/beneficiaries")) return await handleCreateBeneficiary(req, userId);
      if (method === "DELETE" && path.includes("/beneficiaries/")) {
        const bId = path.split("/beneficiaries/")[1];
        return await handleDeleteBeneficiary(userId, bId);
      }
      if (method === "POST"   && path.includes("/beneficiaries/") && path.endsWith("/touch")) {
        const bId = path.split("/beneficiaries/")[1].replace("/touch", "");
        return await handleTouchBeneficiary(userId, bId);
      }'''
replace(ANCHOR, NEW, "routes.beneficiaries")

p.write_text(src, encoding="utf-8")
print("OK: " + ", ".join(ops))
print("DONE")
PY
) || true

echo "$PATCH_OUTPUT"
if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP" "$FUNCTION_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "─── Diff (80 premières lignes) ───"
diff -u "$BACKUP" "$FUNCTION_FILE" | head -80 || true
echo "────────────────────────────────"
echo ""

read -r -p "🚀 Déployer '$FUNCTION_NAME' ? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[yY]$ ]] || { echo "⏸️  Annulé"; exit 0; }

supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt
echo "✅ Terminé. Backup : $BACKUP"
