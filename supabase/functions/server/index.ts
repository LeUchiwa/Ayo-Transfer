import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { checkRateLimit, resetRateLimit, getClientIp } from "./rate-limit.ts";

console.log("AYO Server starting...");

// ═══════════════════════════════════════════════
// HASH DE MOT DE PASSE (PBKDF2 natif)
// ═══════════════════════════════════════════════

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 },
    key,
    256
  );
  const hash = new Uint8Array(bits);
  return `${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...hash))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const expected = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 },
    key,
    256
  );
  const actual = new Uint8Array(bits);

  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

// ═══════════════════════════════════════════════
// JWT ADMIN
// ═══════════════════════════════════════════════

function base64UrlEncode(data: Uint8Array | string): string {
  const str = typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  return atob(padded);
}

async function signJwt(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${data}.${encodedSignature}`;
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

    const data = `${encodedHeader}.${encodedPayload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = Uint8Array.from(base64UrlDecode(encodedSignature), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(data)
    );
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Max-Age": "86400",
};

async function getUserWallet(userId: string) {
  const wallet = await kv.get(`wallet:${userId}`);
  if (!wallet) {
    const defaultWallet = {
      userId,
      balance: 0,
      totalSent: 0,
      totalReceived: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      countSent: 0,
      countReceived: 0,
      countDeposits: 0,
      countWithdrawals: 0,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`wallet:${userId}`, defaultWallet);
    return defaultWallet;
  }
  return wallet;
}

async function getUserTransactions(userId: string) {
  const transactions = await kv.get(`transactions:${userId}`);
  return transactions || [];
}

async function getAllPendingDeposits() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const pendingDeposits: any[] = [];

  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;

    for (const tx of txs) {
      if (tx.type === "deposit" && tx.status === "pending") {
        pendingDeposits.push({ ...tx, userId });
      }
    }
  }

  return pendingDeposits.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function findTransactionAcrossUsers(transactionId: string) {
  const allRows = await kv.getByPrefixWithKeys("transactions:");

  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;

    const found = txs.find((t: any) => t.id === transactionId);
    if (found) {
      return { userId, transactions: txs, transaction: found };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
// EMAIL — Resend
// ═══════════════════════════════════════════════

const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "AYO Transfer <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[EMAIL] RESEND_API_KEY missing");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[EMAIL] Send failed:", errorData);
      return false;
    }

    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error("[EMAIL] Error:", err);
    return false;
  }
}

function emailTemplate(title: string, content: string, buttonText?: string, buttonUrl?: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0fdfa;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#14b8a6 0%,#0891b2 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">AYO</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Transfert d'argent</p>
    </div>
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      ${content}
      ${buttonText && buttonUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${buttonUrl}" style="display:inline-block;background:#14b8a6;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${buttonText}</a></div>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">Cet email a été envoyé par AYO. Contact : contact@ayo-transfer.com</p>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">© 2026 AYO Transfer</p>
  </div>
</body>
</html>
  `.trim();
}

async function sendDepositConfirmedEmail(to: string, userName: string, amount: number, reference: string, newBalance: number) {
  const html = emailTemplate("Dépôt confirmé",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName} 👋</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Votre dépôt a été confirmé !</p>
     <div style="background:#f0fdfa;border-left:4px solid #14b8a6;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant crédité</p>
       <p style="color:#0f172a;font-size:28px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#14b8a6;font-size:14px;font-weight:600;">Nouveau solde : ${newBalance.toLocaleString()} FCFA</p>`,
    "Voir mon portefeuille", `${APP_URL}/wallet`);
  return sendEmail(to, `✅ Dépôt confirmé - ${amount.toLocaleString()} FCFA`, html);
}

async function sendDepositRejectedEmail(to: string, userName: string, amount: number, reference: string, reason: string) {
  const html = emailTemplate("Dépôt rejeté",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName},</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Votre dépôt n'a pas pu être validé.</p>
     <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant concerné</p>
       <p style="color:#0f172a;font-size:24px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#ef4444;font-size:14px;font-weight:600;">Raison : ${reason}</p>`,
    "Contacter le support", "mailto:contact@ayo-transfer.com");
  return sendEmail(to, `❌ Dépôt rejeté - ${reference}`, html);
}

async function sendAccountSuspendedEmail(to: string, userName: string, reason: string) {
  const html = emailTemplate("Compte suspendu",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName},</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Votre compte AYO a été suspendu.</p>
     <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Raison</p>
       <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0;">${reason}</p>
     </div>`,
    "Contacter le support", "mailto:contact@ayo-transfer.com");
  return sendEmail(to, "🚫 Votre compte AYO a été suspendu", html);
}

async function sendWithdrawalConfirmedEmail(to: string, userName: string, amount: number, reference: string, newBalance: number) {
  const html = emailTemplate("Retrait confirmé",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName} 👋</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Bonne nouvelle ! Votre retrait a été effectué.</p>
     <div style="background:#f0fdfa;border-left:4px solid #14b8a6;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant retiré</p>
       <p style="color:#0f172a;font-size:28px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#14b8a6;font-size:14px;font-weight:600;">Nouveau solde : ${newBalance.toLocaleString()} FCFA</p>`,
    "Voir mon portefeuille", `${APP_URL}/wallet`);
  return sendEmail(to, `✅ Retrait confirmé - ${amount.toLocaleString()} FCFA`, html);
}

async function sendWithdrawalRejectedEmail(to: string, userName: string, amount: number, reference: string, reason: string) {
  const html = emailTemplate("Retrait rejeté",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName},</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Votre demande de retrait n'a pas pu être validée.</p>
     <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant concerné</p>
       <p style="color:#0f172a;font-size:24px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#ef4444;font-size:14px;font-weight:600;">Raison : ${reason}</p>`,
    "Contacter le support", "mailto:contact@ayo-transfer.com");
  return sendEmail(to, `❌ Retrait rejeté - ${reference}`, html);
}

async function sendTransferSentEmail(to: string, userName: string, amount: number, recipientName: string, reference: string, newBalance: number) {
  const html = emailTemplate("Transfert envoyé",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName} 👋</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Votre transfert a été envoyé avec succès.</p>
     <div style="background:#f0fdfa;border-left:4px solid #14b8a6;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant envoyé</p>
       <p style="color:#0f172a;font-size:28px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Destinataire : <strong>${recipientName}</strong></p>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#14b8a6;font-size:14px;font-weight:600;">Nouveau solde : ${newBalance.toLocaleString()} FCFA</p>`,
    "Voir mon portefeuille", `${APP_URL}/wallet`);
  return sendEmail(to, `✅ Transfert envoyé - ${amount.toLocaleString()} FCFA`, html);
}

async function sendTransferReceivedEmail(to: string, userName: string, amount: number, senderName: string, reference: string, newBalance: number) {
  const html = emailTemplate("Fonds reçus",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName} 🎉</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">Vous venez de recevoir de l'argent sur votre compte AYO !</p>
     <div style="background:#f0fdfa;border-left:4px solid #14b8a6;padding:20px;border-radius:8px;margin:24px 0;">
       <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">Montant reçu</p>
       <p style="color:#0f172a;font-size:28px;font-weight:700;margin:0;">${amount.toLocaleString()} FCFA</p>
     </div>
     <p style="color:#6b7280;font-size:14px;">Expéditeur : <strong>${senderName}</strong></p>
     <p style="color:#6b7280;font-size:14px;">Référence : <strong>${reference}</strong></p>
     <p style="color:#14b8a6;font-size:14px;font-weight:600;">Nouveau solde : ${newBalance.toLocaleString()} FCFA</p>`,
    "Voir mon portefeuille", `${APP_URL}/wallet`);
  return sendEmail(to, `💰 Vous avez reçu ${amount.toLocaleString()} FCFA`, html);
}

async function getKycTransferThreshold(): Promise<number> {
  try {
    const settings = await kv.get("admin:settings");
    const threshold = settings?.kycTransferThreshold;
    if (typeof threshold === "number" && threshold > 0) return threshold;
  } catch (e) {
    console.log("[kyc] getKycTransferThreshold failed:", e);
  }
  return 100000; // 100 000 FCFA par défaut
}

// ═══════════════════════════════════════════════
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

async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  
  if (!appId || !apiKey) {
    console.warn("[PUSH] OneSignal keys missing");
    return;
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: { external_id: [userId] },
        target_channel: "push",
        headings: { en: payload.title, fr: payload.title },
        contents: { en: payload.body, fr: payload.body },
        url: payload.url ? `${Deno.env.get("APP_URL") || ""}${payload.url}` : undefined,
        chrome_web_icon: "https://ayo-transfer.pages.dev/icons/icon-192.png",
        tag: payload.tag,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[PUSH] OneSignal API Error:`, JSON.stringify(data));
    } else {
      console.log(`[PUSH] Sent successfully to ${userId}:`, data.id);
    }
  } catch (err) {
    console.error("[PUSH] Failed to fetch OneSignal API:", err);
  }
}

async function handleTransfer(req: Request, userId: string) {
  // [RATE-LIMIT:handleTransfer]
  {
    const _ip = getClientIp(req);
    const _key = `rate:wallet:transfer:${userId}:${_ip}`;
    const _check = await checkRateLimit(kv, _key, {
      maxAttempts: 10,
      windowMs: 60_000,
      blockMs: 300000,
    });
    if (!_check.allowed) {
      const _retrySec = Math.ceil((_check.retryAfterMs || 0) / 1000);
      return Response.json(
        {
          error: "rate_limited",
          message: `Trop de requêtes. Réessayez dans ${Math.ceil(_retrySec / 60)} minute${_retrySec > 60 ? "s" : ""}.`,
        },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(_retrySec) } }
      );
    }
  }

  const body = await req.json();
  const { amount, recipient, method, methodIcon, phone, reference } = body;

  // ⬇️ SÉCURITÉ : Recalculer le fee côté serveur (1% par défaut)
  const transferRate = await getTransferFeeRate();
  const fee = computeTransferFee(Number(amount), transferRate);

  if (!amount || !recipient || !method || !reference) {
    return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
  }

  // ⬇️ SÉCURITÉ : Seuil KYC obligatoire pour les gros transferts
  const kycThreshold = await getKycTransferThreshold();
  if (Number(amount) > kycThreshold) {
    const kyc = await kv.get(`kyc:${userId}`);
    if (!kyc || kyc.status !== "approved") {
      return Response.json({
        error: "kyc_required",
        message: `Vérification d'identité requise pour les transferts supérieurs à ${kycThreshold.toLocaleString("fr-FR")} FCFA. Complétez votre KYC.`,
        kyc_status: kyc?.status || "not_submitted",
        threshold: kycThreshold,
      }, { status: 403, headers: corsHeaders });
    }
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ═══ 1. Valider et normaliser l'email ═══
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

  // ═══ NEW: limites
  const _limitCheck = await checkLimits(userId, "sent", Number(amount) + fee);
  if (!_limitCheck.ok) {
    return Response.json({ error: "limit_exceeded", scope: _limitCheck.scope, limit: _limitCheck.limit, used: _limitCheck.used, remaining: _limitCheck.remaining, message: `Limite ${_limitCheck.scope === "daily" ? "journalière" : "mensuelle"} dépassée. Reste : ${_limitCheck.remaining.toLocaleString("fr-FR")} FCFA.` }, { status: 403, headers: corsHeaders });
  }

  // 2. Vérifier le solde de l'expéditeur
  const senderWallet = await getUserWallet(userId);
  const totalAmount = Number(amount) + (Number(fee) || 0);

  if (senderWallet.balance < totalAmount) {
    return Response.json(
      { error: "Insufficient balance", message: `Solde insuffisant. Disponible: ${senderWallet.balance} FCFA, Requis: ${totalAmount} FCFA` },
      { status: 400, headers: corsHeaders }
    );
  }

  // 3. Débiter l'expéditeur
  senderWallet.balance -= totalAmount;
  senderWallet.totalSent += Number(amount);
  senderWallet.countSent += 1;
  senderWallet.updatedAt = new Date().toISOString();

  const senderTx = {
    id: reference,
    userId,
    type: "transfer_sent",
    amount: Number(amount),
    fee: Number(fee) || 0,
    status: "completed",
    reference,
    method,
    methodIcon,
    recipient: recipientUser.user_metadata?.name || recipientUser.email,
    phone,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const senderTxs = await getUserTransactions(userId);
  senderTxs.unshift(senderTx);
  await kv.set(`wallet:${userId}`, senderWallet);
  await kv.set(`transactions:${userId}`, senderTxs);

  // 4. Créditer le destinataire
  const recipientWallet = await getUserWallet(recipientUser.id);
  recipientWallet.balance += Number(amount);
  recipientWallet.totalReceived += Number(amount);
  recipientWallet.countReceived += 1;
  recipientWallet.updatedAt = new Date().toISOString();

  const recipientTx = {
    id: `RCV-${reference}`, // ID unique pour le destinataire
    userId: recipientUser.id,
    type: "transfer_received",
    amount: Number(amount),
    fee: 0,
    status: "completed",
    reference,
    method,
    methodIcon,
    sender: senderWallet.userId, // On pourrait chercher le nom de l'expéditeur, mais l'ID suffit
    phone,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const recipientTxs = await getUserTransactions(recipientUser.id);
  recipientTxs.unshift(recipientTx);
  await kv.set(`wallet:${recipientUser.id}`, recipientWallet);
  await kv.set(`transactions:${recipientUser.id}`, recipientTxs);

  await recordUsage(userId, "sent", Number(amount) + fee);

  // ⬇️ NOUVEAU : Créditer le compte de revenus plateforme
  await creditPlatformRevenue(fee, reference, "transfer_fee");

  // 5. Envoyer les emails et les pushs (asynchrone)
  (async () => {
    const { data: { user: senderUser } } = await supabase.auth.admin.getUserById(userId);
    const senderName = senderUser?.user_metadata?.name || senderUser?.email || "Un utilisateur AYO";
    const recipientName = recipientUser.user_metadata?.name || recipientUser.email || "Utilisateur";

    // 5a. Envoi des emails (isolé pour ne pas bloquer les pushs)
    try {
      if (senderUser?.email) {
        await sendTransferSentEmail(senderUser.email, senderName, Number(amount), recipientName, reference, senderWallet.balance);
      }
      if (recipientUser.email) {
        await sendTransferReceivedEmail(recipientUser.email, recipientName, Number(amount), senderName, reference, recipientWallet.balance);
      }
    } catch (err) {
      console.error("[EMAIL] Failed to send transfer emails:", err);
    }

    // 5b. Envoi du Push au destinataire (isolé pour être TOUJOURS exécuté)
    try {
      await sendPushToUser(recipientUser.id, {
        title: "Vous avez reçu de l'argent !",
        body: `+${Number(amount).toLocaleString()} FCFA de ${senderName}`,
        url: "/history",
        tag: `received-${reference}`,
      });
    } catch (pushErr) {
      console.error("[PUSH] Failed to send push:", pushErr);
    }
  })();

  return Response.json({ success: true, transaction: senderTx }, { headers: corsHeaders });
}
// ═══════════════════════════════════════════════
// HANDLERS — WALLET
// ═══════════════════════════════════════════════

async function handleGetWallet(userId: string) {
  const wallet = await getUserWallet(userId);
  const transactions = await getUserTransactions(userId);
  return Response.json(
    { stats: wallet, transactions: transactions.slice(0, 20) },
    { headers: corsHeaders }
  );
}

async function handleVerifyRecipient(req: Request, userId: string) {
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
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

async function handleListBeneficiaries(userId: string) {
  const list = (await kv.get(`beneficiaries:${userId}`)) || [];
  const sorted = [...list].sort((a: any, b: any) => new Date(b.lastUsedAt || b.createdAt || 0).getTime() - new Date(a.lastUsedAt || a.createdAt || 0).getTime());
  return Response.json({ beneficiaries: sorted }, { headers: corsHeaders });
}

async function handleCreateBeneficiary(req: Request, userId: string) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) return Response.json({ error: "invalid_email" }, { status: 400, headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await supabase.rpc("get_user_id_by_email", { email_addr: email });
  if (error) return Response.json({ error: "server_error", details: error.message }, { status: 500, headers: corsHeaders });
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

async function handleGetTransactionStatus(userId: string, transactionId: string) {
  const transactions = await getUserTransactions(userId);
  const tx = transactions.find((t: any) => t.id === transactionId);
  
  if (!tx) {
    return Response.json({ error: "Transaction not found" }, { status: 404, headers: corsHeaders });
  }
  
  return Response.json({
    status: tx.status,
    transaction: tx,
    failureReason: tx.failureReason || null,
  }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — NOTIFICATIONS (dérivées des données réelles)
// ═══════════════════════════════════════════════

async function handleGetNotifications(userId: string) {
  const transactions = await getUserTransactions(userId);
  const kyc = await kv.get(`kyc:${userId}`);

  const notifications: any[] = [];

  // 1. Transactions → notifications
  for (const tx of transactions) {
    const isDeposit = tx.type === "deposit";
    const isWithdrawal = tx.type === "withdrawal";
    const isSent = tx.type === "transfer_sent";
    const isReceived = tx.type === "transfer_received";

    let title = "";
    let message = "";

    if (isDeposit) {
  if (tx.status === "awaiting_coords") {
    title = "Dépôt en préparation";
    message = `Votre demande de dépôt de ${tx.amount?.toLocaleString?.() ?? tx.amount} FCFA est en attente de traitement par l'admin.`;
     } else if (tx.status === "coords_ready") {
    title = "Coordonnées disponibles";
    message = `Les coordonnées pour votre dépôt de ${tx.amount?.toLocaleString?.() ?? tx.amount} FCFA sont prêtes. Vous avez 10 minutes pour effectuer le paiement.`;
     } else if (tx.status === "pending_validation" || tx.status === "pending") {
    title = "Dépôt en vérification";
    message = `Votre dépôt de ${tx.amount?.toLocaleString?.() ?? tx.amount} FCFA est en cours de validation.`;
      } else if (tx.status === "completed") {
    title = "Dépôt confirmé";
    message = `Votre dépôt de ${tx.amount?.toLocaleString?.() ?? tx.amount} FCFA a été crédité sur votre compte.`;
     } else if (tx.status === "failed") {
    title = "Dépôt rejeté";
    message = `Votre dépôt de ${tx.amount} FCFA a été rejeté.${tx.failureReason ? ` Raison : ${tx.failureReason}` : ""}`;
     } else if (tx.status === "cancelled") {
    title = "Dépôt annulé";
    message = `Votre dépôt de ${tx.amount?.toLocaleString?.() ?? tx.amount} FCFA a été annulé.${tx.cancelReason ? ` Raison : ${tx.cancelReason}` : ""}`;
     } else continue;
  } else if (isWithdrawal) {
      if (tx.status === "pending") {
        title = "Retrait en cours";
        message = `Votre demande de retrait de ${tx.amount} FCFA est en cours de traitement.`;
      } else if (tx.status === "completed") {
        title = "Retrait confirmé";
        message = `Votre retrait de ${tx.amount} FCFA a été effectué.`;
      } else if (tx.status === "failed") {
        title = "Retrait rejeté";
        message = `Votre retrait de ${tx.amount} FCFA a été rejeté.${tx.failureReason ? ` Raison : ${tx.failureReason}` : ""}`;
      } else continue;
    } else if (isSent) {
      title = "Transfert envoyé";
      message = `Vous avez envoyé ${tx.amount} FCFA à ${tx.recipient || "—"}.`;
    } else if (isReceived) {
      title = "Transfert reçu";
      message = `Vous avez reçu ${tx.amount} FCFA.`;
    } else {
      continue;
    }

    notifications.push({
      id: `tx_${tx.id}`,
      type: isDeposit ? "deposit" : isWithdrawal ? "withdrawal" : isSent ? "transfer_sent" : "transfer_received",
      status: tx.status,
      title,
      message,
      amount: tx.amount ?? null,
      reference: tx.reference ?? null,
      createdAt: tx.createdAt || new Date().toISOString(),
    });
  }

  // 2. KYC → notification
  if (kyc) {
    let title = "";
    let message = "";
    if (kyc.status === "pending") {
      title = "Vérification d'identité en cours";
      message = "Vos documents KYC ont bien été reçus et sont en cours d'examen.";
    } else if (kyc.status === "approved") {
      title = "Identité vérifiée ✓";
      message = "Votre KYC a été approuvé. Vos limites de transfert sont désormais étendues.";
    } else if (kyc.status === "rejected") {
      title = "KYC rejeté";
      message = `Votre KYC a été rejeté.${kyc.rejectionReason ? ` Raison : ${kyc.rejectionReason}` : ""}`;
    }
    if (title) {
      notifications.push({
        id: `kyc_${userId}_${kyc.status}_${kyc.submittedAt || ""}`,
        type: "kyc",
        status: kyc.status,
        title,
        message,
        amount: null,
        reference: null,
        createdAt: kyc.approvedAt || kyc.rejectedAt || kyc.submittedAt || new Date().toISOString(),
      });
    }
  }

  // 3. Tri chronologique décroissant
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

    return Response.json({ notifications }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — HISTORIQUE DES TRANSACTIONS
// ═══════════════════════════════════════════════

async function handleGetTransactions(userId: string, req: Request) {
  const transactions = await getUserTransactions(userId);
  const url = new URL(req.url);
  if (!url.searchParams.has("page")) {
    const sorted = [...transactions].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return Response.json({ transactions: sorted }, { headers: corsHeaders });
  }
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const direction = url.searchParams.get("direction");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.toLowerCase().trim();

  let filtered: any[] = [...transactions];
  if (type && type !== "all") filtered = filtered.filter((t: any) => t.type === type);
  if (status && status !== "all") filtered = filtered.filter((t: any) => t.status === status);
  if (direction === "sent") filtered = filtered.filter((t: any) => t.type === "withdrawal" || t.type === "transfer_sent");
  if (direction === "received") filtered = filtered.filter((t: any) => t.type === "deposit" || t.type === "transfer_received");
  if (from) filtered = filtered.filter((t: any) => (t.createdAt || "") >= from);
  if (to) filtered = filtered.filter((t: any) => (t.createdAt || "") <= to);
  if (q) filtered = filtered.filter((t: any) => (t.recipient?.toLowerCase() || "").includes(q) || (t.reference?.toLowerCase() || "").includes(q) || (t.method?.toLowerCase() || "").includes(q));

  filtered.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return Response.json({ transactions: filtered.slice(start, start + limit), page, limit, total, totalPages, hasMore: page < totalPages }, { headers: corsHeaders });
}

async function handleAdminGetUserActivity(userId: string) {
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

// ═══════════════════════════════════════════════
// HANDLERS — DÉPÔTS (flux en 2 étapes)
// ═══════════════════════════════════════════════

const DEPOSIT_COORDS_TTL_MS = 10 * 60 * 1000; // 10 min

async function handleDeposit(req: Request, userId: string) {
  // [RATE-LIMIT:handleDeposit]
  {
    const _ip = getClientIp(req);
    const _key = `rate:wallet:deposit:${userId}:${_ip}`;
    const _check = await checkRateLimit(kv, _key, {
      maxAttempts: 20,
      windowMs: 60_000,
      blockMs: 300000,
    });
    if (!_check.allowed) {
      const _retrySec = Math.ceil((_check.retryAfterMs || 0) / 1000);
      return Response.json(
        {
          error: "rate_limited",
          message: `Trop de requêtes. Réessayez dans ${Math.ceil(_retrySec / 60)} minute${_retrySec > 60 ? "s" : ""}.`,
        },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(_retrySec) } }
      );
    }
  }

  const body = await req.json();
  const { amount, method, methodIcon, phone, reference } = body;

  if (!amount || !method || !reference) {
    return Response.json(
      { error: "Missing required fields: amount, method, reference" },
      { status: 400, headers: corsHeaders }
    );
  }

  // ⬇️ SÉCURITÉ : Recalculer le fee côté serveur
  const fee = await computeDepositFee(Number(amount), method);
  if (Number(amount) <= 0) {
    return Response.json({ error: "Amount must be greater than 0" }, { status: 400, headers: corsHeaders });
  }

  const transaction = {
    id: reference,
    userId,
    type: "deposit",
    amount: Number(amount),
    fee: Number(fee) || 0,
    status: "awaiting_coords", // ⬅️ nouveau statut initial
    reference,
    method,
    methodIcon: methodIcon || "",
    phone: phone || "",
    createdAt: new Date().toISOString(),
  };

  const transactions = await getUserTransactions(userId);
  transactions.unshift(transaction);
  await kv.set(`transactions:${userId}`, transactions);

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleGetDepositStatus(userId: string, depositId: string) {
  const transactions = await getUserTransactions(userId);
  const tx = transactions.find((t: any) => t.id === depositId && t.type === "deposit");

  if (!tx) return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });

  // Auto-cancel si expiré et pas encore soumis
  if (tx.status === "coords_ready" && tx.coords?.expiresAt) {
    if (new Date(tx.coords.expiresAt).getTime() < Date.now()) {
      tx.status = "cancelled";
      tx.cancelledAt = new Date().toISOString();
      tx.cancelReason = "Délai de 10 minutes dépassé";
      await kv.set(`transactions:${userId}`, transactions);
    }
  }

  return Response.json({ transaction: tx }, { headers: corsHeaders });
}

async function handleSubmitDepositInfo(req: Request, userId: string, depositId: string) {
  const body = await req.json();
  const { txRef, screenshotUrl } = body;

  if (!txRef || typeof txRef !== "string" || txRef.trim().length < 3) {
    return Response.json(
      { error: "Numéro de transaction requis (min. 3 caractères)" },
      { status: 400, headers: corsHeaders }
    );
  }

  const transactions = await getUserTransactions(userId);
  const tx = transactions.find((t: any) => t.id === depositId && t.type === "deposit");

  if (!tx) return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });
  if (tx.status !== "coords_ready") {
    return Response.json(
      { error: "Ce dépôt n'attend pas vos informations", currentStatus: tx.status },
      { status: 400, headers: corsHeaders }
    );
  }

  if (tx.coords?.expiresAt && new Date(tx.coords.expiresAt).getTime() < Date.now()) {
    tx.status = "cancelled";
    tx.cancelledAt = new Date().toISOString();
    tx.cancelReason = "Délai dépassé";
    await kv.set(`transactions:${userId}`, transactions);
    return Response.json({ error: "Délai dépassé, veuillez recommencer" }, { status: 400, headers: corsHeaders });
  }

  tx.clientInfo = {
    txRef: txRef.trim(),
    screenshotUrl: screenshotUrl || null,
    submittedAt: new Date().toISOString(),
  };
  tx.status = "pending_validation";

  await kv.set(`transactions:${userId}`, transactions);
  return Response.json({ success: true, transaction: tx }, { headers: corsHeaders });
}

async function handleCancelExpiredDeposit(userId: string, depositId: string) {
  const transactions = await getUserTransactions(userId);
  const tx = transactions.find((t: any) => t.id === depositId && t.type === "deposit");
  if (!tx) return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });
  if (tx.status !== "coords_ready") {
    return Response.json({ error: "Ce dépôt ne peut plus être annulé", currentStatus: tx.status }, { status: 400, headers: corsHeaders });
  }
  if (!tx.coords?.expiresAt || new Date(tx.coords.expiresAt).getTime() > Date.now()) {
    return Response.json({ error: "Le délai n'est pas encore expiré" }, { status: 400, headers: corsHeaders });
  }
  tx.status = "cancelled";
  tx.cancelledAt = new Date().toISOString();
  tx.cancelReason = "Délai de 10 minutes dépassé";
  await kv.set(`transactions:${userId}`, transactions);
  return Response.json({ success: true, transaction: tx }, { headers: corsHeaders });
}

async function handleAdminSetDepositCoords(req: Request, depositId: string) {
  const body = await req.json();
  const { label, value, instructions } = body;

  if (!label || !value) {
    return Response.json({ error: "Champs requis: label, value" }, { status: 400, headers: corsHeaders });
  }

  const result = await findTransactionAcrossUsers(depositId);
  if (!result) return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });
  const { userId, transactions, transaction } = result;

  if (transaction.type !== "deposit") {
    return Response.json({ error: "Not a deposit" }, { status: 400, headers: corsHeaders });
  }
  if (transaction.status !== "awaiting_coords") {
    return Response.json(
      { error: "Ce dépôt n'attend pas de coordonnées", currentStatus: transaction.status },
      { status: 400, headers: corsHeaders }
    );
  }

  const now = new Date();
  transaction.coords = {
    label,
    value,
    instructions: instructions || "",
    setBy: "AYO-ADMIN",
    setAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEPOSIT_COORDS_TTL_MS).toISOString(),
  };
  transaction.status = "coords_ready";

  await kv.set(`transactions:${userId}`, transactions);
  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleGetPendingDepositsCount() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  let awaiting = 0;
  let pendingValidation = 0;
  const now = Date.now();

  for (const row of allRows) {
    const txs = row.value;
    if (!Array.isArray(txs)) continue;
    for (const tx of txs) {
      if (tx.type !== "deposit") continue;
      if (tx.status === "coords_ready" && tx.coords?.expiresAt && new Date(tx.coords.expiresAt).getTime() < now) continue;
      if (tx.status === "awaiting_coords") awaiting++;
      if (tx.status === "pending_validation" || tx.status === "pending") pendingValidation++;
    }
  }

  return Response.json(
    { awaitingCoords: awaiting, pendingValidation, total: awaiting + pendingValidation },
    { headers: corsHeaders }
  );
}


async function handleWithdraw(req: Request, userId: string) {
  // [RATE-LIMIT:handleWithdraw]
  {
    const _ip = getClientIp(req);
    const _key = `rate:wallet:withdraw:${userId}:${_ip}`;
    const _check = await checkRateLimit(kv, _key, {
      maxAttempts: 10,
      windowMs: 60_000,
      blockMs: 300000,
    });
    if (!_check.allowed) {
      const _retrySec = Math.ceil((_check.retryAfterMs || 0) / 1000);
      return Response.json(
        {
          error: "rate_limited",
          message: `Trop de requêtes. Réessayez dans ${Math.ceil(_retrySec / 60)} minute${_retrySec > 60 ? "s" : ""}.`,
        },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(_retrySec) } }
      );
    }
  }

  const body = await req.json();
  const { amount, method, methodIcon, phone, reference } = body;

  // KYC check pour retrait [kyc_required_withdraw]
  const _kycThresholdW = await getKycTransferThreshold();
  if (Number(amount) > _kycThresholdW) {
    const _kycW = await kv.get(`kyc:${userId}`);
    if (!_kycW || _kycW.status !== "approved") {
      return Response.json({
        error: "kyc_required",
        message: `Vérification d'identité requise pour les retraits supérieurs à ${_kycThresholdW.toLocaleString("fr-FR")} FCFA. Complétez votre KYC.`,
        kyc_status: _kycW?.status || "not_submitted",
        threshold: _kycThresholdW,
      }, { status: 403, headers: corsHeaders });
    }
  }

  if (!amount || !method || !reference) {
    return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
  }

  // ⬇️ SÉCURITÉ : Recalculer le fee côté serveur (ignorer celui du client)
  const fee = await computeWithdrawFee(Number(amount), method);

  const wallet = await getUserWallet(userId);
  const totalAmount = Number(amount) + fee;

  const _limitCheckW = await checkLimits(userId, "withdrawn", Number(amount) + fee);
  if (!_limitCheckW.ok) {
    return Response.json({ error: "limit_exceeded", scope: _limitCheckW.scope, limit: _limitCheckW.limit, used: _limitCheckW.used, remaining: _limitCheckW.remaining, message: `Limite ${_limitCheckW.scope === "daily" ? "journalière" : "mensuelle"} dépassée. Reste : ${_limitCheckW.remaining.toLocaleString("fr-FR")} FCFA.` }, { status: 403, headers: corsHeaders });
  }

  // ⬇️ NOUVEAU : Récupérer les transactions AVANT la vérification
  const transactions = await getUserTransactions(userId);

  // ⬇️ NOUVEAU : Calculer le total des retraits déjà en attente
  const pendingWithdrawalsTotal = transactions
    .filter((t: any) => t.type === "withdrawal" && t.status === "pending")
    .reduce((sum: number, t: any) => sum + (t.amount || 0) + (t.fee || 0), 0);

  // ⬇️ MODIFIÉ : Vérifier solde - pending >= totalAmount
  const availableBalance = wallet.balance - pendingWithdrawalsTotal;

  if (availableBalance < totalAmount) {
    return Response.json(
      {
        error: "Insufficient available balance",
        message: pendingWithdrawalsTotal > 0
          ? `Solde insuffisant. Vous avez ${pendingWithdrawalsTotal.toLocaleString()} FCFA déjà engagés en retraits en attente. Disponible : ${availableBalance.toLocaleString()} FCFA, Requis : ${totalAmount.toLocaleString()} FCFA.`
          : `Solde insuffisant. Disponible : ${availableBalance.toLocaleString()} FCFA, Requis : ${totalAmount.toLocaleString()} FCFA.`
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const transaction = {
    id: reference,
    userId,
    type: "withdrawal",
    amount: Number(amount),
    fee: Number(fee) || 0,
    status: "pending",
    reference,
    method,
    methodIcon,
    phone,
    createdAt: new Date().toISOString(),
  };

  transactions.unshift(transaction);
  await kv.set(`transactions:${userId}`, transactions);

  await recordUsage(userId, "withdrawn", Number(amount) + fee);

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleConfirm(transactionId: string, userId: string) {
  const wallet = await getUserWallet(userId);
  const transactions = await getUserTransactions(userId);

  const idx = transactions.findIndex((t: any) => t.id === transactionId);
  if (idx === -1) {
    return Response.json({ error: "Transaction not found" }, { status: 404, headers: corsHeaders });
  }

  const transaction = transactions[idx];

  if (transaction.status !== "pending") {
    return Response.json(
      { error: "Transaction already processed", message: `Cette transaction est déjà en statut "${transaction.status}"` },
      { status: 400, headers: corsHeaders }
    );
  }

  transaction.status = "completed";
  transaction.completedAt = new Date().toISOString();
  transactions[idx] = transaction;

  if (transaction.type === "deposit") {
    wallet.balance += transaction.amount;
    wallet.totalDeposits += transaction.amount;
    wallet.countDeposits += 1;
    wallet.totalReceived += transaction.amount;
  } else if (transaction.type === "withdrawal") {
    wallet.balance -= transaction.amount + transaction.fee;
    wallet.totalWithdrawals += transaction.amount + transaction.fee;
    wallet.countWithdrawals += 1;
  } else if (transaction.type === "transfer_sent") {
    wallet.balance -= transaction.amount + transaction.fee;
    wallet.totalSent += transaction.amount;
    wallet.countSent += 1;
  }

  wallet.updatedAt = new Date().toISOString();
  await kv.set(`wallet:${userId}`, wallet);
  await kv.set(`transactions:${userId}`, transactions);

  return Response.json({ success: true, wallet, transaction }, { headers: corsHeaders });
}

async function handleCheckBalance(req: Request, userId: string) {
  const body = await req.json();
  const { amount, fee } = body;

  if (!amount) {
    return Response.json({ error: "Missing required field: amount" }, { status: 400, headers: corsHeaders });
  }

  const wallet = await getUserWallet(userId);
  const totalAmount = Number(amount) + (Number(fee) || 0);
  const hasSufficientBalance = wallet.balance >= totalAmount;

  return Response.json(
    { hasSufficientBalance, balance: wallet.balance, required: totalAmount, shortfall: hasSufficientBalance ? 0 : totalAmount - wallet.balance },
    { headers: corsHeaders }
  );
}

// ═══════════════════════════════════════════════
// HANDLERS — PROFIL CLIENT
// ═══════════════════════════════════════════════

async function handleGetProfile(userId: string) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }
  return Response.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || "",
    phone: user.user_metadata?.phone || "",
  }, { headers: corsHeaders });
}

async function handleUpdateProfile(req: Request, userId: string) {
  const body = await req.json();
  const { name, phone } = body;

  if (!name || name.trim().length < 2) {
    return Response.json({ error: "Le nom doit contenir au moins 2 caractères." }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { name: name.trim(), phone: phone?.trim() || "" },
  });

  if (error) {
    return Response.json({ error: "Failed to update profile", details: error.message }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true, user: { id: data.user.id, name: data.user.user_metadata?.name, phone: data.user.user_metadata?.phone } }, { headers: corsHeaders });
}

async function handleChangePassword(req: Request, userId: string) {
  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return Response.json({ error: "Les deux champs sont requis." }, { status: 400, headers: corsHeaders });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères." }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Récupère l'email du user pour vérifier le mot de passe actuel
  const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError || !user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }

  // Vérifie le mot de passe actuel en tentant un signIn
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return Response.json({ error: "Mot de passe actuel incorrect." }, { status: 401, headers: corsHeaders });
  }

  // Met à jour le mot de passe
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return Response.json({ error: "Failed to update password", details: updateError.message }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — ADMIN : Dépôts & Retraits
// ═══════════════════════════════════════════════

async function handleAdminListPendingDeposits() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const pendingDeposits: any[] = [];
  const now = Date.now();
  const toPersist: Array<{ userId: string; txs: any[] }> = [];

  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;
    let modified = false;

    for (const tx of txs) {
      if (tx.type !== "deposit") continue;

      // Auto-cancel si expiré
      if (tx.status === "coords_ready" && tx.coords?.expiresAt && new Date(tx.coords.expiresAt).getTime() < now) {
        tx.status = "cancelled";
        tx.cancelledAt = new Date().toISOString();
        tx.cancelReason = "Délai de 10 minutes dépassé";
        modified = true;
        continue;
      }

      if (
        tx.status === "awaiting_coords" ||
        tx.status === "coords_ready" ||
        tx.status === "pending_validation" ||
        tx.status === "pending" // legacy compat
      ) {
        pendingDeposits.push({ ...tx, userId });
      }
    }
    if (modified) toPersist.push({ userId, txs });
  }

  for (const p of toPersist) {
    await kv.set(`transactions:${p.userId}`, p.txs);
  }

  return Response.json(
    { deposits: pendingDeposits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) },
    { headers: corsHeaders }
  );
}

async function handleAdminConfirmDeposit(depositId: string) {
  const result = await findTransactionAcrossUsers(depositId);
  if (!result) {
    return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });
  }

  const { userId, transactions, transaction } = result;

 if (transaction.status !== "pending_validation" && transaction.status !== "pending") {
  return Response.json(
    { error: "Dépôt non validable", currentStatus: transaction.status },
    { status: 400, headers: corsHeaders }
  );
}


  transaction.status = "completed";
  transaction.completedAt = new Date().toISOString();
  transaction.confirmedByAdmin = true;

  const wallet = await getUserWallet(userId);
  wallet.balance += transaction.amount;
  wallet.totalDeposits += transaction.amount;
  wallet.countDeposits += 1;
  wallet.totalReceived += transaction.amount;
  wallet.updatedAt = new Date().toISOString();

  await kv.set(`wallet:${userId}`, wallet);
  await kv.set(`transactions:${userId}`, transactions);

  // Email de confirmation
  (async () => {
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (user?.email) {
        await sendDepositConfirmedEmail(user.email, user.user_metadata?.name || "Utilisateur", transaction.amount, transaction.reference, wallet.balance);
      }
    } catch (emailErr) {
      console.error("[EMAIL] Failed to send confirmation:", emailErr);
    }
  })();
  return Response.json({ success: true, wallet, transaction }, { headers: corsHeaders });
}

async function handleAdminRejectDeposit(depositId: string, reason: string) {
  const result = await findTransactionAcrossUsers(depositId);
  if (!result) {
    return Response.json({ error: "Deposit not found" }, { status: 404, headers: corsHeaders });
  }

  const { userId, transactions, transaction } = result;

  if (transaction.status !== "pending") {
    return Response.json({ error: "Deposit already processed", status: transaction.status }, { status: 400, headers: corsHeaders });
  }

  transaction.status = "failed";
  transaction.failedAt = new Date().toISOString();
  transaction.failureReason = reason || "Rejeté par l'administrateur";
  transaction.rejectedByAdmin = true;

  await kv.set(`transactions:${userId}`, transactions);

  // Email de rejet
  (async () => {
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (user?.email) {
        await sendDepositRejectedEmail(user.email, user.user_metadata?.name || "Utilisateur", transaction.amount, transaction.reference, transaction.failureReason);
      }
    } catch (emailErr) {
      console.error("[EMAIL] Failed to send rejection:", emailErr);
    }
  })();
  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

async function handleAdminListPendingWithdrawals() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const pending: any[] = [];
  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;
    for (const tx of txs) {
      if (tx.type === "withdrawal" && tx.status === "pending") pending.push({ ...tx, userId });
    }
  }
  return Response.json({ withdrawals: pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }, { headers: corsHeaders });
}

async function handleAdminConfirmWithdrawal(withdrawalId: string) {
  const result = await findTransactionAcrossUsers(withdrawalId);
  if (!result) return Response.json({ error: "Withdrawal not found" }, { status: 404, headers: corsHeaders });
  const { userId, transactions, transaction } = result;
  if (transaction.status !== "pending") return Response.json({ error: "Already processed" }, { status: 400, headers: corsHeaders });

  const wallet = await getUserWallet(userId);
  const totalCost = transaction.amount + (transaction.fee || 0);

  // ⬇️ NOUVEAU : Vérifier que le solde est toujours suffisant
  if (wallet.balance < totalCost) {
    return Response.json(
      {
        error: "Solde insuffisant",
        message: `Le client n'a plus assez de fonds. Solde actuel : ${wallet.balance.toLocaleString()} FCFA. Retrait demandé : ${totalCost.toLocaleString()} FCFA.`
      },
      { status: 400, headers: corsHeaders }
    );
  }

  transaction.status = "completed";
  transaction.completedAt = new Date().toISOString();
  transaction.confirmedByAdmin = true;

  wallet.balance -= totalCost;
  wallet.totalWithdrawals += totalCost;
  wallet.countWithdrawals += 1;
  wallet.updatedAt = new Date().toISOString();

  await kv.set(`wallet:${userId}`, wallet);
  await kv.set(`transactions:${userId}`, transactions);

  // ⬇️ NOUVEAU : Créditer le compte de revenus plateforme
  await creditPlatformRevenue(transaction.fee || 0, transaction.reference, "withdrawal_fee");

  (async () => {
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (user?.email) await sendWithdrawalConfirmedEmail(user.email, user.user_metadata?.name || "Utilisateur", transaction.amount, transaction.reference, wallet.balance);
    } catch (err) { console.error("[EMAIL] Failed:", err); }
  })();

  return Response.json({ success: true, wallet, transaction }, { headers: corsHeaders });
}

async function handleAdminRejectWithdrawal(withdrawalId: string, reason: string) {
  const result = await findTransactionAcrossUsers(withdrawalId);
  if (!result) return Response.json({ error: "Withdrawal not found" }, { status: 404, headers: corsHeaders });
  const { userId, transactions, transaction } = result;
  if (transaction.status !== "pending") return Response.json({ error: "Already processed" }, { status: 400, headers: corsHeaders });

  transaction.status = "failed";
  transaction.failedAt = new Date().toISOString();
  transaction.failureReason = reason || "Rejeté par l'administrateur";
  transaction.rejectedByAdmin = true;

  await kv.set(`transactions:${userId}`, transactions);

  (async () => {
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      if (user?.email) await sendWithdrawalRejectedEmail(user.email, user.user_metadata?.name || "Utilisateur", transaction.amount, transaction.reference, transaction.failureReason);
    } catch (err) { console.error("[EMAIL] Failed:", err); }
  })();

  return Response.json({ success: true, transaction }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — ADMIN : Utilisateurs & KYC
// ═══════════════════════════════════════════════

async function handleAdminListUsers(supabase: any) {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    return Response.json({ error: "Failed to list users", details: error.message }, { status: 500, headers: corsHeaders });
  }

  const enriched = await Promise.all(
    users.map(async (u: any) => {
      let wallet = await kv.get(`wallet:${u.id}`);
      
      // Créer le wallet s'il n'existe pas
      if (!wallet) {
        wallet = {
          userId: u.id,
          balance: 0,
          totalSent: 0,
          totalReceived: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          countSent: 0,
          countReceived: 0,
          countDeposits: 0,
          countWithdrawals: 0,
          updatedAt: new Date().toISOString(),
        };
        await kv.set(`wallet:${u.id}`, wallet);
      }
            // Calcul rapide de suspicious
      const txs = (await kv.get(`transactions:${u.id}`)) || [];
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = txs.filter((t: any) => new Date(t.createdAt || 0).getTime() > dayAgo);
      const sent24h = recent.filter((t: any) => t.type === "transfer_sent");
      const suspicious =
        sent24h.length > 20 ||
        sent24h.reduce((s: number, t: any) => s + (t.amount || 0), 0) > 500_000 ||
        new Set(sent24h.map((t: any) => t.recipient).filter(Boolean)).size > 5;
      return {
        id: u.id,
        email: u.email || "",
        name: u.user_metadata?.name || (u.email ? u.email.split("@")[0] : "Utilisateur"),
        role: u.app_metadata?.role || "user",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        emailConfirmedAt: u.email_confirmed_at,
        bannedUntil: u.banned_until,
        balance: wallet.balance || 0,
        totalSent: wallet.totalSent || 0,
        totalReceived: wallet.totalReceived || 0,
        totalDeposits: wallet.totalDeposits || 0,
        totalWithdrawals: wallet.totalWithdrawals || 0,
        countSent: wallet.countSent || 0,
        countReceived: wallet.countReceived || 0,
        suspicious,
      };
    })
  );

  return Response.json({ users: enriched }, { headers: corsHeaders });
}

async function handleAdminSuspendUser(supabase: any, userId: string, reason: string) {
  const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError || !user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }
  if (user.app_metadata?.role === "admin") {
    return Response.json({ error: "Cannot suspend an admin" }, { status: 400, headers: corsHeaders });
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (error) {
    return Response.json({ error: "Failed to suspend", details: error.message }, { status: 500, headers: corsHeaders });
  }

  // Email de suspension
  (async () => {
    try {
      if (user.email) {
        await sendAccountSuspendedEmail(user.email, user.user_metadata?.name || "Utilisateur", reason || "Non spécifiée");
      }
    } catch (emailErr) {
      console.error("[EMAIL] Failed to send suspension:", emailErr);
    }
  })();

  return Response.json({ success: true, userId, action: "suspend", reason }, { headers: corsHeaders });
}

async function handleAdminReactivateUser(supabase: any, userId: string) {
  const { data: { user }, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError || !user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    return Response.json({ error: "Failed to reactivate", details: error.message }, { status: 500, headers: corsHeaders });
  }
  return Response.json({ success: true, userId, action: "reactivate" }, { headers: corsHeaders });
}

// ─── KYC ───────────────────────────────────────

async function handleGetKycStatus(userId: string) {
  const kyc = await kv.get(`kyc:${userId}`);
  return Response.json({ kyc: kyc || { status: "not_submitted" } }, { headers: corsHeaders });
}

async function handleSubmitKyc(req: Request, userId: string) {
  const body = await req.json();
  const { fullName, idType, idNumber, idDocumentRectoUrl, idDocumentVersoUrl, selfieUrl } = body;

  if (!fullName || !idType || !idNumber || !idDocumentRectoUrl || !idDocumentVersoUrl || !selfieUrl) {
    return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
  }

  const kycData = {
    userId,
    fullName,
    idType,
    idNumber,
    idDocumentRectoUrl,
    idDocumentVersoUrl,
    selfieUrl,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  await kv.set(`kyc:${userId}`, kycData);
  return Response.json({ success: true, kyc: kycData }, { headers: corsHeaders });
}

async function handleAdminListKyc() {
  const allKyc = await kv.getByPrefixWithKeys("kyc:");
  const list = allKyc
    .map((row: any) => row.value)
    .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  return Response.json({ kyc: list }, { headers: corsHeaders });
}

async function handleAdminApproveKyc(supabase: any, userId: string) {
  const kyc = await kv.get(`kyc:${userId}`);
  if (!kyc) return Response.json({ error: "KYC not found" }, { status: 404, headers: corsHeaders });

  kyc.status = "approved";
  kyc.approvedAt = new Date().toISOString();
  await kv.set(`kyc:${userId}`, kyc);

  return Response.json({ success: true, kyc }, { headers: corsHeaders });
}

async function handleAdminRejectKyc(supabase: any, userId: string, reason: string) {
  const kyc = await kv.get(`kyc:${userId}`);
  if (!kyc) return Response.json({ error: "KYC not found" }, { status: 404, headers: corsHeaders });

  kyc.status = "rejected";
  kyc.rejectedAt = new Date().toISOString();
  kyc.rejectionReason = reason || "Documents non conformes";
  await kv.set(`kyc:${userId}`, kyc);

  return Response.json({ success: true, kyc }, { headers: corsHeaders });
}

async function handleAdminGetKycDocument(supabase: any, userId: string, docType: string) {
  const kyc = await kv.get(`kyc:${userId}`);
  if (!kyc) return Response.json({ error: "KYC not found" }, { status: 404, headers: corsHeaders });

  let path = "";
  if (docType === "recto") path = kyc.idDocumentRectoUrl || kyc.idDocumentUrl; // compatibilité
  else if (docType === "verso") path = kyc.idDocumentVersoUrl;
  else if (docType === "selfie") path = kyc.selfieUrl;

  if (!path) return Response.json({ error: "Document not found" }, { status: 404, headers: corsHeaders });

  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 3600);
  
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  return Response.json({ url: data.signedUrl }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — ADMIN : Services, Transactions & Stats
// ═══════════════════════════════════════════════

const ALL_SERVICES = [
  { id: "mtn",     name: "MTN Mobile Money",  icon: "📱", color: "bg-yellow-500", type: "mobile-money", depositFee: 0,     withdrawFee: 0.005 },
  { id: "orange",  name: "Orange Money",      icon: "📱", color: "bg-orange-500", type: "mobile-money", depositFee: 0,     withdrawFee: 0.005 },
  { id: "wave",    name: "Wave",              icon: "🌊", color: "bg-sky-500",    type: "mobile-money", depositFee: 0,     withdrawFee: 0.003 },
  { id: "djamo",   name: "Djamo",             icon: "💜", color: "bg-violet-600", type: "digital",      depositFee: 0,     withdrawFee: 0.005 },
  { id: "express", name: "Express Union",     icon: "🏪", color: "bg-blue-600",   type: "agent",        depositFee: 0,     withdrawFee: 0.015 },
  { id: "card",    name: "Carte bancaire",    icon: "💳", color: "bg-gray-700",   type: "card",         depositFee: 0.015, withdrawFee: 0     },
  { id: "bank",    name: "Virement bancaire", icon: "🏛️", color: "bg-emerald-700",type: "bank",         depositFee: 0,     withdrawFee: 0.01  },
];

// ═══════════════════════════════════════════════
// SERVICES DE PAIEMENT — Configuration dynamique
// ═══════════════════════════════════════════════

type ServiceConfig = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: "mobile-money" | "digital" | "agent" | "card" | "bank";
  depositFee: number;
  withdrawFee: number;
  active: boolean;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  mtn: "Mobile Money MTN",
  orange: "Mobile Money Orange",
  wave: "Wave (0% frais)",
  djamo: "Wallet Djamo",
  express: "Agence Express Union",
  card: "Visa, Mastercard",
  bank: "Virement bancaire",
};

function migrateServicesToConfig(): ServiceConfig[] {
  const now = new Date().toISOString();
  return ALL_SERVICES.map(svc => ({
    id: svc.id,
    name: svc.name,
    description: SERVICE_DESCRIPTIONS[svc.id] || `${svc.name} — dépôt et retrait`,
    icon: svc.icon,
    color: svc.color,
    type: svc.type as any,
    depositFee: svc.depositFee,
    withdrawFee: svc.withdrawFee,
    active: true,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }));
}

async function getServicesConfig(): Promise<ServiceConfig[]> {
  const config = await kv.get("admin:services_config");
  if (!config || !Array.isArray(config)) {
    const migrated = migrateServicesToConfig();
    await kv.set("admin:services_config", migrated);
    console.log(`[SERVICES] Migrated ${migrated.length} services to config`);
    return migrated;
  }
  return config;
}

async function saveServicesConfig(services: ServiceConfig[]): Promise<void> {
  await kv.set("admin:services_config", services);
}

async function handleAdminListServices() {
  const config = await getServicesConfig();
  const visible = config.filter(s => !s.deleted);

  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const stats: Record<string, { count: number; volume: number; deposits: number; withdrawals: number; transfers: number }> = {};
  for (const svc of visible) stats[svc.id] = { count: 0, volume: 0, deposits: 0, withdrawals: 0, transfers: 0 };

  for (const row of allRows) {
    const txs = row.value;
    if (!Array.isArray(txs)) continue;
    for (const tx of txs) {
      if (tx.status !== "completed") continue;
      const methodName = tx.method || "";
      let svcId = "";
      if (methodName.includes("MTN")) svcId = "mtn";
      else if (methodName.includes("Orange")) svcId = "orange";
      else if (methodName.includes("Wave")) svcId = "wave";
      else if (methodName.includes("Djamo")) svcId = "djamo";
      else if (methodName.includes("Express")) svcId = "express";
      else if (methodName.includes("Carte")) svcId = "card";
      else if (methodName.includes("Virement") || methodName.includes("bancaire")) svcId = "bank";
      if (!svcId) continue;
      stats[svcId].count += 1;
      stats[svcId].volume += tx.amount || 0;
      if (tx.type === "deposit") stats[svcId].deposits += 1;
      else if (tx.type === "withdrawal") stats[svcId].withdrawals += 1;
      else if (tx.type === "transfer_sent") stats[svcId].transfers += 1;
    }
  }

  const services = visible.map(svc => ({
    ...svc,
    transactions: stats[svc.id]?.count || 0,
    volume: stats[svc.id]?.volume || 0,
    deposits: stats[svc.id]?.deposits || 0,
    withdrawals: stats[svc.id]?.withdrawals || 0,
    transfers: stats[svc.id]?.transfers || 0,
  }));

  return Response.json({ services }, { headers: corsHeaders });
}

async function handleAdminToggleService(serviceId: string, active: boolean) {
  const services = await getServicesConfig();
  const idx = services.findIndex(s => s.id === serviceId && !s.deleted);
  if (idx === -1) {
    return Response.json({ error: "Service non trouvé" }, { status: 404, headers: corsHeaders });
  }
  services[idx].active = active;
  services[idx].updatedAt = new Date().toISOString();
  await saveServicesConfig(services);
  return Response.json({ success: true, serviceId, active }, { headers: corsHeaders });
}

async function handleAdminCreateService(req: Request) {
  const body = await req.json();
  const { id, name, description, icon, color, type, depositFee, withdrawFee } = body;

  if (!id || !name || !type) {
    return Response.json({ error: "Champs requis : id, name, type" }, { status: 400, headers: corsHeaders });
  }

  const cleanId = String(id).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleanId || cleanId.length < 2) {
    return Response.json({ error: "ID invalide (min. 2 caractères alphanumériques)" }, { status: 400, headers: corsHeaders });
  }

  const services = await getServicesConfig();
  if (services.some(s => s.id === cleanId && !s.deleted)) {
    return Response.json({ error: "Un service avec cet ID existe déjà" }, { status: 400, headers: corsHeaders });
  }

  const now = new Date().toISOString();
  const newService: ServiceConfig = {
    id: cleanId,
    name: String(name).trim(),
    description: String(description || "").trim(),
    icon: String(icon || "💳").trim(),
    color: String(color || "bg-gray-500").trim(),
    type,
    depositFee: Number(depositFee) || 0,
    withdrawFee: Number(withdrawFee) || 0,
    active: true,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };

  services.push(newService);
  await saveServicesConfig(services);

  return Response.json({ success: true, service: newService }, { headers: corsHeaders });
}

async function handleAdminUpdateService(req: Request, id: string) {
  const body = await req.json();
  const services = await getServicesConfig();
  const idx = services.findIndex(s => s.id === id && !s.deleted);

  if (idx === -1) {
    return Response.json({ error: "Service non trouvé" }, { status: 404, headers: corsHeaders });
  }

  const current = services[idx];
  services[idx] = {
    ...current,
    name: body.name !== undefined ? String(body.name).trim() : current.name,
    description: body.description !== undefined ? String(body.description).trim() : current.description,
    icon: body.icon !== undefined ? String(body.icon).trim() : current.icon,
    color: body.color !== undefined ? String(body.color).trim() : current.color,
    type: body.type !== undefined ? body.type : current.type,
    depositFee: body.depositFee !== undefined ? Number(body.depositFee) : current.depositFee,
    withdrawFee: body.withdrawFee !== undefined ? Number(body.withdrawFee) : current.withdrawFee,
    active: body.active !== undefined ? Boolean(body.active) : current.active,
    updatedAt: new Date().toISOString(),
  };

  await saveServicesConfig(services);
  return Response.json({ success: true, service: services[idx] }, { headers: corsHeaders });
}

async function handleAdminDeleteService(id: string) {
  const services = await getServicesConfig();
  const idx = services.findIndex(s => s.id === id && !s.deleted);

  if (idx === -1) {
    return Response.json({ error: "Service non trouvé" }, { status: 404, headers: corsHeaders });
  }

  services[idx].deleted = true;
  services[idx].active = false;
  services[idx].updatedAt = new Date().toISOString();
  await saveServicesConfig(services);

  return Response.json({ success: true, id }, { headers: corsHeaders });
}

async function handleGetPublicServices() {
  const config = await getServicesConfig();
  const activeServices = config.filter(s => !s.deleted && s.active !== false);

  return Response.json({
    services: activeServices.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      color: s.color,
      type: s.type,
      depositFee: s.depositFee,
      withdrawFee: s.withdrawFee,
    })),
  }, { headers: corsHeaders });
}

async function handleAdminListTransactions(filters: { type?: string; status?: string; limit?: number }) {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const all: any[] = [];
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userCache: Record<string, { name: string; email: string }> = {};

  for (const row of allRows) {
    const userId = row.key.replace("transactions:", "");
    const txs = row.value;
    if (!Array.isArray(txs)) continue;

    if (!userCache[userId]) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        userCache[userId] = {
          name: user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur",
          email: user?.email || "",
        };
      } catch {
        userCache[userId] = { name: "Inconnu", email: "" };
      }
    }

    for (const tx of txs) {
      all.push({ ...tx, userId, userName: userCache[userId].name, userEmail: userCache[userId].email });
    }
  }

  let filtered = all;
  if (filters.type && filters.type !== "all") filtered = filtered.filter(t => t.type === filters.type);
  if (filters.status && filters.status !== "all") filtered = filtered.filter(t => t.status === filters.status);

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  filtered = filtered.slice(0, filters.limit || 100);

  return Response.json({ transactions: filtered, total: all.length }, { headers: corsHeaders });
}

async function handleAdminStats() {
  const allRows = await kv.getByPrefixWithKeys("transactions:");
  const walletRows = await kv.getByPrefixWithKeys("wallet:");

  let totalDeposits = 0, totalWithdrawals = 0, totalTransfers = 0;
  let countDeposits = 0, countWithdrawals = 0, countTransfers = 0, countPending = 0;

  for (const row of allRows) {
    const txs = row.value;
    if (!Array.isArray(txs)) continue;
    for (const tx of txs) {
      if (tx.status === "completed") {
        if (tx.type === "deposit") { totalDeposits += tx.amount; countDeposits += 1; }
        else if (tx.type === "withdrawal") { totalWithdrawals += tx.amount; countWithdrawals += 1; }
        else if (tx.type === "transfer_sent") { totalTransfers += tx.amount; countTransfers += 1; }
      } else if (tx.status === "pending") countPending += 1;
    }
  }

  let totalBalance = 0;
  for (const row of walletRows) {
    const wallet = row.value;
    if (wallet && typeof wallet.balance === "number") totalBalance += wallet.balance;
  }

  return Response.json({
    stats: { totalDeposits, totalWithdrawals, totalTransfers, countDeposits, countWithdrawals, countTransfers, countPending, totalBalance, totalWalletCount: walletRows.length },
  }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — COORDONNÉES DE DÉPÔT
// ═══════════════════════════════════════════════

const DEFAULT_DEPOSIT_COORDS = {
  mtn: { label: "Numéro MTN MoMo", value: "+237 6 55 00 11 22", instruction: "Envoyez le montant exact sur ce numéro en ajoutant votre référence dans le libellé." },
  orange: { label: "Numéro Orange Money", value: "+237 6 99 00 33 44", instruction: "Envoyez le montant exact sur ce numéro en ajoutant votre référence dans le libellé." },
  wave: { label: "Numéro Wave", value: "+237 6 55 00 11 22", instruction: "Envoyez le montant via l'application Wave." },
  djamo: { label: "Numéro Djamo", value: "+237 6 55 00 11 22", instruction: "Envoyez le montant via l'application Djamo." },
  express: { label: "Code Agent Express Union", value: "CAMERPAY-XU-9847", instruction: "Rendez-vous en agence Express Union et présentez ce code." },
  card: { label: "Lien de paiement sécurisé", value: "pay.camerpay.cm/depot/secure", instruction: "Accédez au lien et entrez vos coordonnées de carte." },
  bank: { label: "IBAN AYO", value: "CM21 1000 0100 5000 0017 8906 001", instruction: "Effectuez un virement depuis votre banque vers cet IBAN." },
};


// ═══════════════════════════════════════════════
// FRAIS — Calcul serveur (autorité unique)
// ═══════════════════════════════════════════════

function getMethodId(methodName: string): string {
  const name = (methodName || "").toLowerCase();
  if (name.includes("mtn")) return "mtn";
  if (name.includes("orange")) return "orange";
  if (name.includes("wave")) return "wave";
  if (name.includes("djamo")) return "djamo";
  if (name.includes("express")) return "express";
  if (name.includes("carte") || name.includes("card")) return "card";
  if (name.includes("virement") || name.includes("bancaire") || name.includes("bank")) return "bank";
  return "";
}

const DEPOSIT_FEES: Record<string, number> = {
  mtn: 0,
  orange: 0,
  wave: 0,
  djamo: 0,
  express: 0,
  card: 0.015,
  bank: 0,
};

const WITHDRAW_FEES: Record<string, number> = {
  mtn: 0.005,
  orange: 0.005,
  wave: 0.003,
  djamo: 0.005,
  express: 0.015,
  bank: 0.01,
};

async function getTransferFeeRate(): Promise<number> {
  const settings = await kv.get("admin:settings");
  const rate = settings?.transferFee;
  return typeof rate === "number" && rate >= 0 ? rate / 100 : 0.01; // 1% par défaut
}

async function computeDepositFee(amount: number, methodName: string): Promise<number> {
  const id = getMethodId(methodName);
  const services = await getServicesConfig();
  const svc = services.find(s => s.id === id && !s.deleted);
  const rate = svc ? svc.depositFee : (DEPOSIT_FEES[id] ?? 0);
  return Math.ceil(amount * rate);
}

async function computeWithdrawFee(amount: number, methodName: string): Promise<number> {
  const id = getMethodId(methodName);
  const services = await getServicesConfig();
  const svc = services.find(s => s.id === id && !s.deleted);
  const rate = svc ? svc.withdrawFee : (WITHDRAW_FEES[id] ?? 0.005);
  return Math.ceil(amount * rate);
}

function computeTransferFee(amount: number, rate: number): number {
  return Math.ceil(amount * rate);
}

// ═══════════════════════════════════════════════
// REVENUS PLATEFORME — Crédit des frais sur wallet admin
// ═══════════════════════════════════════════════

async function creditPlatformRevenue(
  fee: number,
  sourceRef: string,
  sourceType: "transfer_fee" | "withdrawal_fee"
) {
  if (!fee || fee <= 0) return;

  const platformWalletId = await kv.get("admin:platform_wallet_id");
  if (!platformWalletId) {
    console.error("[REVENUE] admin:platform_wallet_id not configured");
    return;
  }

  try {
    const platformWallet = await getUserWallet(platformWalletId);
    platformWallet.balance += fee;
    platformWallet.totalReceived += fee;
    platformWallet.countReceived += 1;
    platformWallet.updatedAt = new Date().toISOString();
    await kv.set(`wallet:${platformWalletId}`, platformWallet);

    const platformTxs = await getUserTransactions(platformWalletId);
    platformTxs.unshift({
      id: `REV-${sourceRef}`,
      userId: platformWalletId,
      type: "platform_revenue",
      sourceType,
      amount: fee,
      fee: 0,
      status: "completed",
      reference: sourceRef,
      createdAt: new Date().toISOString(),
    });
    await kv.set(`transactions:${platformWalletId}`, platformTxs);

    console.log(`[REVENUE] +${fee} FCFA from ${sourceType} (${sourceRef})`);
  } catch (err) {
    console.error("[REVENUE] Failed:", err);
  }
}

async function handleGetDepositCoords() {
  const coords = (await kv.get("admin:deposit_coords")) || DEFAULT_DEPOSIT_COORDS;
  return Response.json({ coords: { ...DEFAULT_DEPOSIT_COORDS, ...coords } }, { headers: corsHeaders });
}

async function handleAdminUpdateDepositCoords(req: Request) {
  const body = await req.json();
  await kv.set("admin:deposit_coords", body);
  return Response.json({ success: true, coords: body }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// HANDLERS — ADMIN : Settings
// ═══════════════════════════════════════════════

const DEFAULT_SETTINGS = { platformName: "AYO Transfer", transferFee: 1, minAmount: 1000, maxAmount: 5000000, kycTransferThreshold: 100000 };

async function handleAdminGetSettings() {
  const settings = (await kv.get("admin:settings")) || DEFAULT_SETTINGS;
  return Response.json({ settings: { ...DEFAULT_SETTINGS, ...settings } }, { headers: corsHeaders });
}

async function handleAdminUpdateSettings(req: Request) {
  const body = await req.json();
  const validated = {
    platformName: String(body.platformName || DEFAULT_SETTINGS.platformName).trim() || DEFAULT_SETTINGS.platformName,
    transferFee: Number(body.transferFee) >= 0 && Number(body.transferFee) <= 100 ? Number(body.transferFee) : DEFAULT_SETTINGS.transferFee,
    minAmount: Number(body.minAmount) >= 0 ? Number(body.minAmount) : DEFAULT_SETTINGS.minAmount,
    maxAmount: Number(body.maxAmount) >= Number(body.minAmount) ? Number(body.maxAmount) : DEFAULT_SETTINGS.maxAmount,
    kycTransferThreshold: Number(body.kycTransferThreshold) >= 0 ? Number(body.kycTransferThreshold) : DEFAULT_SETTINGS.kycTransferThreshold,
  };
  await kv.set("admin:settings", validated);
  return Response.json({ success: true, settings: validated }, { headers: corsHeaders });
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

export default {
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    console.log(`[REQUEST] ${method} ${path}`);

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (path.endsWith("/health")) return Response.json({ status: "ok" }, { headers: corsHeaders });

    // ═══ ROUTES ADMIN AUTH ═══
        if (method === "POST" && path.endsWith("/admin/auth")) {
      // ⬇️ NOUVEAU : Vérifier le rate limit avant tout
      const clientIp = getClientIp(req);
      const rateLimitKey = `rate:auth:${clientIp}`;
      const rateCheck = await checkRateLimit(kv, rateLimitKey);

      if (!rateCheck.allowed) {
        const retryMin = Math.ceil((rateCheck.retryAfterMs || 0) / 60000);
        return Response.json(
          {
            error: "Trop de tentatives",
            message: `Trop de tentatives de connexion. Réessayez dans ${retryMin} minute${retryMin > 1 ? "s" : ""}.`,
            retryAfterMs: rateCheck.retryAfterMs,
          },
          {
            status: 429,
            headers: { ...corsHeaders, "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) },
          }
        );
      }

      try {
        const body = await req.json();
        const { id, password } = body;
        if (!id || !password) return Response.json({ error: "Missing id or password" }, { status: 400, headers: corsHeaders });

        const credentials = await kv.get("admin:credentials");
        if (!credentials) return Response.json({ error: "Admin not initialized" }, { status: 500, headers: corsHeaders });
        if (id !== credentials.id) return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });

        const valid = await verifyPassword(password, credentials.passwordHash);
        if (!valid) return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });

        const secret = Deno.env.get("ADMIN_JWT_SECRET");
        if (!secret) return Response.json({ error: "Server config error" }, { status: 500, headers: corsHeaders });

        const now = Math.floor(Date.now() / 1000);
        const exp = now + 3600;
        const token = await signJwt({ sub: "AYO-ADMIN", role: "admin", iat: now, exp }, secret);

        // ⬇️ NOUVEAU : Reset le compteur après succès
        await resetRateLimit(kv, rateLimitKey);

        return Response.json({ success: true, token, expiresAt: exp * 1000 }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: "Auth failed", details: String(err) }, { status: 500, headers: corsHeaders });
      }
    }

        if (method === "POST" && path.endsWith("/admin/verify")) {
      // ⬇️ NOUVEAU : Rate limit (20 tentatives/min, blocage 1 min)
      const clientIp = getClientIp(req);
      const verifyRateKey = `rate:verify:${clientIp}`;
      const verifyCheck = await checkRateLimit(kv, verifyRateKey, {
        maxAttempts: 20,
        windowMs: 60_000,
        blockMs: 60_000,
      });
      if (!verifyCheck.allowed) {
        return Response.json(
          { error: "Trop de tentatives de vérification" },
          { status: 429, headers: corsHeaders }
        );
      }

      try {
        const body = await req.json().catch(() => ({}));
        const authH = req.headers.get("Authorization");
        const token = body.token || (authH?.startsWith("Bearer ") ? authH.replace("Bearer ", "") : null);
        if (!token) return Response.json({ valid: false, error: "Missing token" }, { status: 400, headers: corsHeaders });

        const secret = Deno.env.get("ADMIN_JWT_SECRET");
        if (!secret) return Response.json({ valid: false, error: "Server config error" }, { status: 500, headers: corsHeaders });

        const payload = await verifyJwt(token, secret);
        if (!payload) return Response.json({ valid: false, error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });

        return Response.json({ valid: true, payload, expiresAt: payload.exp * 1000 }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ valid: false, error: String(err) }, { status: 500, headers: corsHeaders });
      }
    }

    if (method === "POST" && path.endsWith("/admin/rotate-password")) {
      try {
        const authH = req.headers.get("Authorization");
        const token = authH?.startsWith("Bearer ") ? authH.replace("Bearer ", "") : null;
        if (!token) return Response.json({ error: "Missing admin token" }, { status: 401, headers: corsHeaders });

        const secret = Deno.env.get("ADMIN_JWT_SECRET");
        if (!secret) return Response.json({ error: "Server config error" }, { status: 500, headers: corsHeaders });

        const payload = await verifyJwt(token, secret);
        if (!payload || payload.role !== "admin") return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        let suffix = "";
        const randomBytes = crypto.getRandomValues(new Uint8Array(6));
        for (const byte of randomBytes) suffix += chars[byte % chars.length];
        const plainPassword = `AYO-${year}-${month}-${suffix}`;

        const passwordHash = await hashPassword(plainPassword);
        const credentials = { id: "AYO-ADMIN", passwordHash, rotatedAt: now.toISOString(), nextRotation: new Date(year, now.getMonth() + 1, 1).toISOString() };
        await kv.set("admin:credentials", credentials);

        return Response.json({
          success: true, id: "AYO-ADMIN", password: plainPassword,
          warning: "⚠️ Notez ce mot de passe maintenant.",
          rotatedAt: credentials.rotatedAt, nextRotation: credentials.nextRotation,
        }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: "Rotation failed", details: String(err) }, { status: 500, headers: corsHeaders });
      }
    }

    // ═══ AUTH ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Missing or invalid Authorization header" }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminSecret = Deno.env.get("ADMIN_JWT_SECRET");

    let isAdminToken = false;
    let adminPayload: Record<string, any> | null = null;
    if (adminSecret) {
      adminPayload = await verifyJwt(token, adminSecret);
      if (adminPayload && adminPayload.role === "admin") isAdminToken = true;
    }

    if (isAdminToken && adminPayload) {
      try {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        if (method === "GET" && path.endsWith("/admin/users")) return await handleAdminListUsers(supabaseAdmin);
        if (method === "GET" && path.includes("/admin/users/") && path.endsWith("/activity")) {
          const userId = path.split("/admin/users/")[1].replace("/activity", "");
          return await handleAdminGetUserActivity(userId);
        }
        if (method === "POST" && path.includes("/admin/users/") && path.endsWith("/suspend")) {
          const userId = path.split("/admin/users/")[1].replace("/suspend", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminSuspendUser(supabaseAdmin, userId, body.reason);
        }

        if (method === "POST" && path.includes("/admin/users/") && path.endsWith("/reactivate")) {
          const userId = path.split("/admin/users/")[1].replace("/reactivate", "");
          return await handleAdminReactivateUser(supabaseAdmin, userId);
        }

        if (method === "GET" && path.endsWith("/admin/services")) return await handleAdminListServices();

        if (method === "POST" && path.includes("/admin/services/") && path.endsWith("/toggle")) {
          const serviceId = path.split("/admin/services/")[1].replace("/toggle", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminToggleService(serviceId, body.active === true);
        }

        if (method === "POST" && path.endsWith("/admin/services")) {
          return await handleAdminCreateService(req);
        }

        if (method === "PUT" && path.includes("/admin/services/")) {
          const serviceId = path.split("/admin/services/")[1].replace(/\/$/, "");
          return await handleAdminUpdateService(req, serviceId);
        }

        if (method === "DELETE" && path.includes("/admin/services/")) {
          const serviceId = path.split("/admin/services/")[1].replace(/\/$/, "");
          return await handleAdminDeleteService(serviceId);
        }

        if (method === "GET" && path.endsWith("/admin/stats")) return await handleAdminStats();

        if (method === "GET" && path.endsWith("/admin/transactions")) {
          const u = new URL(req.url);
          return await handleAdminListTransactions({
            type: u.searchParams.get("type") || "all",
            status: u.searchParams.get("status") || "all",
            limit: Number(u.searchParams.get("limit")) || 100,
          });
        }

        if (method === "GET" && path.endsWith("/admin/settings")) return await handleAdminGetSettings();
        if (method === "GET" && path.endsWith("/admin/deposit-coords")) return await handleGetDepositCoords();
        if (method === "POST" && path.endsWith("/admin/deposit-coords")) return await handleAdminUpdateDepositCoords(req);
        if (method === "POST" && path.endsWith("/admin/settings")) return await handleAdminUpdateSettings(req);

        if (method === "GET" && path.endsWith("/admin/deposits/pending")) return await handleAdminListPendingDeposits();
        if (method === "POST" && path.includes("/admin/deposits/") && path.endsWith("/coords")) {
  const id = path.split("/admin/deposits/")[1].replace("/coords", "");
  return await handleAdminSetDepositCoords(req, id);
}
if (method === "GET" && path.endsWith("/admin/deposits/count")) {
  return await handleGetPendingDepositsCount();
}

        if (method === "POST" && path.includes("/admin/deposits/") && path.endsWith("/confirm")) {
          const depositId = path.split("/admin/deposits/")[1].replace("/confirm", "");
          return await handleAdminConfirmDeposit(depositId);
        }

        if (method === "POST" && path.includes("/admin/deposits/") && path.endsWith("/reject")) {
          const depositId = path.split("/admin/deposits/")[1].replace("/reject", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminRejectDeposit(depositId, body.reason);
        }

        // ═══ Retraits ═══
        if (method === "GET" && path.endsWith("/admin/withdrawals/pending")) return await handleAdminListPendingWithdrawals();
        if (method === "POST" && path.includes("/admin/withdrawals/") && path.endsWith("/confirm")) {
          const id = path.split("/admin/withdrawals/")[1].replace("/confirm", "");
          return await handleAdminConfirmWithdrawal(id);
        }
        if (method === "POST" && path.includes("/admin/withdrawals/") && path.endsWith("/reject")) {
          const id = path.split("/admin/withdrawals/")[1].replace("/reject", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminRejectWithdrawal(id, body.reason);
        }

        // ═══ KYC ═══
        if (method === "GET" && path.endsWith("/admin/kyc")) return await handleAdminListKyc();
        
        if (method === "POST" && path.includes("/admin/kyc/") && path.endsWith("/approve")) {
          const id = path.split("/admin/kyc/")[1].replace("/approve", "");
          return await handleAdminApproveKyc(supabaseAdmin, id);
        }
        
        if (method === "POST" && path.includes("/admin/kyc/") && path.endsWith("/reject")) {
          const id = path.split("/admin/kyc/")[1].replace("/reject", "");
          const body = await req.json().catch(() => ({}));
          return await handleAdminRejectKyc(supabaseAdmin, id, body.reason);
        }

        if (method === "GET" && path.includes("/admin/kyc/") && path.endsWith("/document")) {
          const url = new URL(req.url);
          const userId = path.split("/admin/kyc/")[1].split("/")[0];
          const docType = url.searchParams.get("type") || "id";
          return await handleAdminGetKycDocument(supabaseAdmin, userId, docType);
        }

        return Response.json({ error: "Admin route not found", path, method }, { status: 404, headers: corsHeaders });
      } catch (err) {
        console.error("Admin route error:", err);
        return Response.json({ error: "Internal server error", details: String(err) }, { status: 500, headers: corsHeaders });
      }
    }

    // ═══ WALLET & KYC (JWT Supabase) ═══
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return Response.json({ error: "Unauthorized", details: error?.message }, { status: 401, headers: corsHeaders });
    }

    const userId = user.id;

    try {
      if (method === "GET" && path.endsWith("/wallet")) return await handleGetWallet(userId);
      if (method === "GET" && path.endsWith("/services") && !path.includes("/admin/")) return await handleGetPublicServices();
      if (method === "GET" && path.endsWith("/notifications")) return await handleGetNotifications(userId);

  // ─── News ───────────────────────────────────────
  if (method === "GET" && path.endsWith("/news")) return await handleGetNews();
  if (method === "POST" && path.endsWith("/news")) return await handleCreateNews(req, userId);

  const newsIdMatch = path.match(/\/news\/([^/]+)$/);
  if (newsIdMatch) {
    const newsId = newsIdMatch[1];
    if (method === "PUT")    return await handleUpdateNews(req, userId, newsId);
    if (method === "DELETE") return await handleDeleteNews(userId, newsId);
  }
      if (method === "GET" && path.endsWith("/transactions")) return await handleGetTransactions(userId, req);
      if (method === "GET"    && path.endsWith("/beneficiaries")) return await handleListBeneficiaries(userId);
      if (method === "POST"   && path.endsWith("/beneficiaries")) return await handleCreateBeneficiary(req, userId);
      if (method === "DELETE" && path.includes("/beneficiaries/")) {
        const bId = path.split("/beneficiaries/")[1];
        return await handleDeleteBeneficiary(userId, bId);
      }
      if (method === "POST"   && path.includes("/beneficiaries/") && path.endsWith("/touch")) {
        const bId = path.split("/beneficiaries/")[1].replace("/touch", "");
        return await handleTouchBeneficiary(userId, bId);
      }
      if (method === "GET" && path.includes("/wallet/deposit/") && path.endsWith("/status")) {
        const id = path.split("/wallet/deposit/")[1].replace("/status", "");
        return await handleGetDepositStatus(userId, id);
      }
      if (method === "POST" && path.includes("/wallet/deposit/") && path.endsWith("/info")) {
        const id = path.split("/wallet/deposit/")[1].replace("/info", "");
        return await handleSubmitDepositInfo(req, userId, id);
      }
      if (method === "POST" && path.includes("/wallet/deposit/") && path.endsWith("/cancel-expired")) {
        const id = path.split("/wallet/deposit/")[1].replace("/cancel-expired", "");
        return await handleCancelExpiredDeposit(userId, id);
      }
      if (method === "GET" && path.endsWith("/profile")) return await handleGetProfile(userId);
      if (method === "POST" && path.endsWith("/profile")) return await handleUpdateProfile(req, userId);
      if (method === "POST" && path.endsWith("/profile/change-password")) return await handleChangePassword(req, userId);
if (method === "GET" && path.endsWith("/deposit-coords")) return await handleGetDepositCoords();
      if (method === "GET" && path.includes("/wallet/transaction/") && path.endsWith("/status")) {
        const transactionId = path.split("/wallet/transaction/")[1].replace("/status", "");
        return await handleGetTransactionStatus(userId, transactionId);
      }
      if (method === "POST" && path.endsWith("/wallet/deposit")) return await handleDeposit(req, userId);
      if (method === "POST" && path.endsWith("/wallet/withdraw")) return await handleWithdraw(req, userId);
      if (method === "POST" && path.endsWith("/wallet/verify-recipient")) return await handleVerifyRecipient(req, userId);
      if (method === "POST" && path.endsWith("/wallet/transfer")) return await handleTransfer(req, userId);
      if (method === "POST" && path.includes("/wallet/confirm/")) {
        const transactionId = path.split("/wallet/confirm/")[1];
        return await handleConfirm(transactionId, userId);
      }
      if (method === "POST" && path.endsWith("/wallet/check-balance")) return await handleCheckBalance(req, userId);
      if (method === "GET" && path.endsWith("/kyc/status")) return await handleGetKycStatus(userId);
      if (method === "POST" && path.endsWith("/kyc/submit")) return await handleSubmitKyc(req, userId);

      return Response.json({ error: "Route not found", path, method }, { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error("Server error:", err);
      return Response.json({ error: "Internal server error", details: String(err) }, { status: 500, headers: corsHeaders });
    }
  },
};
// ═══════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════

async function getAllNews(): Promise<any[]> {
  const rows = await kv.get("news:all");
  if (!Array.isArray(rows)) return [];
  return rows.slice().sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supa.auth.admin.getUserById(userId);
    if (error) return false;
    return data?.user?.app_metadata?.role === "admin";
  } catch {
    return false;
  }
}

async function handleGetNews() {
  try {
    const news = await getAllNews();
    return Response.json({ news }, { headers: corsHeaders });
  } catch (error) {
    console.log("Error fetching news:", error);
    return Response.json({ error: "Failed to fetch news" }, { status: 500, headers: corsHeaders });
  }
}

async function handleCreateNews(req: Request, userId: string) {
  try {
    if (!(await isAdminUser(userId))) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await req.json();
    const { title, description, source, category, region, tag, image, content } = body;

    if (!title || !description || !source || !category || !region) {
      return Response.json(
        { error: "Missing required fields: title, description, source, category, region" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!["finance", "general"].includes(category)) {
      return Response.json({ error: "Invalid category" }, { status: 400, headers: corsHeaders });
    }
    if (!["cameroun", "monde"].includes(region)) {
      return Response.json({ error: "Invalid region" }, { status: 400, headers: corsHeaders });
    }

    const item = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      description: String(description).trim(),
      source: String(source).trim(),
      category,
      region,
      tag: tag ? String(tag).trim() : null,
      image: image || null,
      content: content || null,
      publishedAt: new Date().toISOString(),
    };

    const news = await getAllNews();
    news.unshift(item);
    await kv.set("news:all", news);

    return Response.json({ success: true, item }, { headers: corsHeaders });
  } catch (error) {
    console.log("Error creating news:", error);
    return Response.json({ error: "Failed to create news" }, { status: 500, headers: corsHeaders });
  }
}

async function handleUpdateNews(req: Request, userId: string, newsId: string) {
  try {
    if (!(await isAdminUser(userId))) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await req.json();
    const news = await getAllNews();
    const idx = news.findIndex((n) => n.id === newsId);
    if (idx === -1) {
      return Response.json({ error: "News not found" }, { status: 404, headers: corsHeaders });
    }

    const current = news[idx];
    const updated = {
      ...current,
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.description !== undefined && { description: String(body.description).trim() }),
      ...(body.source !== undefined && { source: String(body.source).trim() }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.region !== undefined && { region: body.region }),
      ...(body.tag !== undefined && { tag: body.tag || null }),
      ...(body.image !== undefined && { image: body.image || null }),
      ...(body.content !== undefined && { content: body.content || null }),
      id: current.id,
      publishedAt: current.publishedAt,
    };

    news[idx] = updated;
    await kv.set("news:all", news);

    return Response.json({ success: true, item: updated }, { headers: corsHeaders });
  } catch (error) {
    console.log("Error updating news:", error);
    return Response.json({ error: "Failed to update news" }, { status: 500, headers: corsHeaders });
  }
}

async function handleDeleteNews(userId: string, newsId: string) {
  try {
    if (!(await isAdminUser(userId))) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }
    const news = await getAllNews();
    const filtered = news.filter((n) => n.id !== newsId);
    if (filtered.length === news.length) {
      return Response.json({ error: "News not found" }, { status: 404, headers: corsHeaders });
    }
    await kv.set("news:all", filtered);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.log("Error deleting news:", error);
    return Response.json({ error: "Failed to delete news" }, { status: 500, headers: corsHeaders });
  }
}
