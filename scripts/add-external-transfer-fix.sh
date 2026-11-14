#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.ext2"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, pathlib, sys

p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ═══ 1. Ajouter la fonction handleExternalTransfer ═══
if "async function handleExternalTransfer" not in src:
    handler = '''// ═══════════════════════════════════════════════
// ENVOI EXTERNE (Manual Payout)
// ═══════════════════════════════════════════════

async function handleExternalTransfer(req: Request, userId: string) {
  const ip = getClientIp(req);
  const check = await checkRateLimit(kv, `rate:ext:${userId}:${ip}`, {
    maxAttempts: 5,
    windowMs: 60_000,
    blockMs: 300_000,
  });
  if (!check.allowed) {
    return Response.json({ error: "rate_limited", message: "Trop de demandes. Réessayez dans quelques minutes." }, { status: 429, headers: corsHeaders });
  }

  const body = await req.json();
  const { amountFCFA, currency, country, method, destinationName, destinationPhone, pin, reference } = body;

  if (!amountFCFA || !currency || !country || !method || !destinationName || !destinationPhone || !reference) {
    return Response.json({ error: "missing_fields", message: "Tous les champs sont requis." }, { status: 400, headers: corsHeaders });
  }

  const isPinValid = await verifyPin(userId, pin);
  if (!isPinValid) {
    return Response.json({ error: "invalid_pin", message: "Code PIN incorrect ou manquant." }, { status: 401, headers: corsHeaders });
  }

  const settings = (await kv.get("admin:settings")) || {};
  const rates = settings.exchangeRates || { XAF: 1, XOF: 1, EUR: 655.957, USD: 610, NGN: 0.4 };
  const rate = rates[currency];
  if (!rate) {
    return Response.json({ error: "unsupported_currency", message: "Devise non supportée." }, { status: 400, headers: corsHeaders });
  }

  const transferFeeRate = typeof settings.transferFee === "number" ? settings.transferFee / 100 : 0.01;
  const amountFCFAVal = Number(amountFCFA);
  const amountLocal = Math.floor(amountFCFAVal / rate);
  const fee = Math.ceil(amountFCFAVal * transferFeeRate);
  const totalDebit = amountFCFAVal + fee;

  const wallet = await getUserWallet(userId);
  if (wallet.balance < totalDebit) {
    return Response.json({
      error: "insufficient_balance",
      message: `Solde insuffisant. Requis : ${totalDebit.toLocaleString()} FCFA, Disponible : ${wallet.balance.toLocaleString()} FCFA.`
    }, { status: 400, headers: corsHeaders });
  }

  const transaction = {
    id: reference,
    userId,
    type: "external_transfer",
    amountLocal: amountLocal,
    amountFCFA: amountFCFAVal,
    currency,
    country,
    fee,
    totalDebit,
    method,
    destinationName,
    destinationPhone,
    status: "pending",
    reference,
    createdAt: new Date().toISOString(),
  };

  const transactions = await getUserTransactions(userId);
  transactions.unshift(transaction);
  await kv.set(`transactions:${userId}`, transactions);

  wallet.balance -= totalDebit;
  wallet.updatedAt = new Date().toISOString();
  await kv.set(`wallet:${userId}`, wallet);

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleAdminListExternalTransfers() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const pending: any[] = [];
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userCache: Record<string, any> = {};

  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;

    for (const tx of txs) {
      if (tx.type === "external_transfer" && tx.status === "pending") {
        if (!userCache[userId]) {
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);
            userCache[userId] = { name: user?.user_metadata?.name || user?.email, email: user?.email };
          } catch { userCache[userId] = { name: "Inconnu", email: "" }; }
        }
        pending.push({ ...tx, userId, userName: userCache[userId].name, userEmail: userCache[userId].email });
      }
    }
  }

  return Response.json({ transfers: pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }, { headers: corsHeaders });
}

async function handleAdminConfirmExternalTransfer(transferId: string) {
  const result = await findTransactionAcrossUsers(transferId);
  if (!result) return Response.json({ error: "Transfer not found" }, { status: 404, headers: corsHeaders });
  const { userId, transactions, transaction } = result;

  if (transaction.type !== "external_transfer" || transaction.status !== "pending") {
    return Response.json({ error: "Invalid status" }, { status: 400, headers: corsHeaders });
  }

  transaction.status = "completed";
  transaction.completedAt = new Date().toISOString();
  transaction.confirmedByAdmin = true;

  await kv.set(`transactions:${userId}`, transactions);
  await creditPlatformRevenue(transaction.fee || 0, transaction.reference, "transfer_fee");

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleAdminRejectExternalTransfer(transferId: string, reason: string) {
  const result = await findTransactionAcrossUsers(transferId);
  if (!result) return Response.json({ error: "Transfer not found" }, { status: 404, headers: corsHeaders });
  const { userId, transactions, transaction } = result;

  if (transaction.type !== "external_transfer" || transaction.status !== "pending") {
    return Response.json({ error: "Invalid status" }, { status: 400, headers: corsHeaders });
  }

  transaction.status = "failed";
  transaction.failedAt = new Date().toISOString();
  transaction.failureReason = reason || "Rejeté par l'administrateur";

  await kv.set(`transactions:${userId}`, transactions);

  const wallet = await getUserWallet(userId);
  wallet.balance += transaction.totalDebit;
  wallet.updatedAt = new Date().toISOString();
  await kv.set(`wallet:${userId}`, wallet);

  return Response.json({ success: true, transaction, refunded: transaction.totalDebit }, { headers: corsHeaders });
}

'''
    marker = "async function handleDeposit(req: Request, userId: string) {"
    if marker not in src:
        print("ERR: handleDeposit introuvable pour insertion"); sys.exit(2)
    src = src.replace(marker, handler + marker, 1)
    ops.append("Handlers externes ajoutés")

# ═══ 2. Route utilisateur ═══
if "/wallet/external-transfer" not in src:
    route_anchor = 'if (method === "POST" && path.endsWith("/wallet/withdraw")) return await handleWithdraw(req, userId);'
    if route_anchor not in src:
        print("ERR: route withdraw introuvable"); sys.exit(2)
    route_new = route_anchor + '\n      if (method === "POST" && path.endsWith("/wallet/external-transfer")) return await handleExternalTransfer(req, userId);'
    src = src.replace(route_anchor, route_new, 1)
    ops.append("Route /wallet/external-transfer ajoutée")

# ═══ 3. Routes admin ═══
if "/admin/external-transfers/pending" not in src:
    admin_anchor = 'if (method === "GET" && path.endsWith("/admin/withdrawals/pending")) return await handleAdminListPendingWithdrawals();'
    if admin_anchor not in src:
        print("ERR: route admin withdrawals introuvable"); sys.exit(2)
    admin_routes = admin_anchor + '''
        if (method === "GET" && path.endsWith("/admin/external-transfers/pending")) return await handleAdminListExternalTransfers();
        if (method === "POST" && path.includes("/admin/external-transfers/") && path.endsWith("/confirm")) {
          const id = path.split("/admin/external-transfers/")[1].replace("/confirm", "");
          return await handleAdminConfirmExternalTransfer(id);
        }
        if (method === "POST" && path.includes("/admin/external-transfers/") && path.endsWith("/reject")) {
          const id = path.split("/admin/external-transfers/")[1].replace("/reject", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminRejectExternalTransfer(id, body.reason);
        }'''
    src = src.replace(admin_anchor, admin_routes, 1)
    ops.append("Routes admin ajoutées")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops) if ops else "SKIP: tout existe déjà")
PY

echo ""
echo "─── Vérifications ───"
echo "handleExternalTransfer : $(grep -c 'async function handleExternalTransfer' "$FUNCTION_FILE") (attendu 1)"
echo "route external-transfer : $(grep -c '/wallet/external-transfer' "$FUNCTION_FILE") (attendu 1)"
echo "route admin pending    : $(grep -c '/admin/external-transfers/pending' "$FUNCTION_FILE") (attendu 1)"
