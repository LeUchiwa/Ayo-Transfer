#!/usr/bin/env bash
set -euo pipefail

echo "🛡️ Ajout des protections anti-bot..."

# ═══════════════════════════════════════════════
# 1. BACKEND
# ═══════════════════════════════════════════════
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.antibots"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib, re

p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ═══ A. Limites progressives : modifier getLimitsForUser ═══
old_limits = '''async function getLimitsForUser(userId: string) {
  const settings = await kv.get("admin:settings");
  const lim = settings?.limits || {};
  const kyc = await kv.get(`kyc:${userId}`);
  const approved = kyc?.status === "approved";
  return {
    daily:   approved ? (lim.kycDaily   ?? 2_000_000)  : (lim.daily   ?? 500_000),
    monthly: approved ? (lim.kycMonthly ?? 10_000_000) : (lim.monthly ?? 2_000_000),
  };
}'''

new_limits = '''async function getLimitsForUser(userId: string) {
  const settings = await kv.get("admin:settings");
  const lim = settings?.limits || {};
  const kyc = await kv.get(`kyc:${userId}`);
  const approved = kyc?.status === "approved";

  // Récupérer l'ancienneté du compte
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let accountAgeDays = 999; // Par défaut : très ancien (au cas où)
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    if (user?.created_at) {
      const created = new Date(user.created_at).getTime();
      accountAgeDays = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
    }
  } catch (e) { console.warn("[LIMITS] Failed to get user age:", e); }

  // Si KYC approuvé : limites max
  if (approved) {
    return {
      daily: lim.kycDaily ?? 2_000_000,
      monthly: lim.kycMonthly ?? 10_000_000,
      stage: "kyc",
    };
  }

  // Compte < 7 jours : limites réduites (anti-bot)
  if (accountAgeDays < 7) {
    return {
      daily: lim.newAccountDaily ?? 100_000,
      monthly: lim.newAccountMonthly ?? 300_000,
      stage: "new",
    };
  }

  // Compte 7-30 jours : limites normales
  if (accountAgeDays < 30) {
    return {
      daily: lim.daily ?? 500_000,
      monthly: lim.monthly ?? 2_000_000,
      stage: "standard",
    };
  }

  // Compte > 30 jours : limites normales aussi
  return {
    daily: lim.daily ?? 500_000,
    monthly: lim.monthly ?? 2_000_000,
    stage: "trusted",
  };
}'''

if old_limits in src:
    src = src.replace(old_limits, new_limits, 1)
    ops.append("limites progressives")

# ═══ B. KYC 24h : modifier handleSubmitKyc ═══
old_kyc = '''async function handleSubmitKyc(req: Request, userId: string) {
  const body = await req.json();
  const { fullName, idType, idNumber, idDocumentRectoUrl, idDocumentVersoUrl, selfieUrl } = body;'''

new_kyc = '''async function handleSubmitKyc(req: Request, userId: string) {
  // ═══ ANTI-BOT : Le compte doit avoir au moins 24h ═══
  const supabaseCheck = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data: { user } } = await supabaseCheck.auth.admin.getUserById(userId);
    if (user?.created_at) {
      const ageHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        const hoursRemaining = Math.ceil(24 - ageHours);
        return Response.json({
          error: "account_too_new",
          message: `Votre compte doit avoir au moins 24h pour soumettre un KYC. Réessayez dans ${hoursRemaining}h.`,
          hours_remaining: hoursRemaining,
        }, { status: 403, headers: corsHeaders });
      }
    }
  } catch (e) {
    console.error("[KYC] Failed to check account age:", e);
    // On laisse passer en cas d'erreur de lecture pour ne pas bloquer
  }

  // Vérifier qu'aucun KYC n'existe déjà (pending ou approved)
  const existingKyc = await kv.get(`kyc:${userId}`);
  if (existingKyc?.status === "approved") {
    return Response.json({
      error: "kyc_already_approved",
      message: "Votre identité est déjà vérifiée.",
    }, { status: 400, headers: corsHeaders });
  }
  if (existingKyc?.status === "pending") {
    return Response.json({
      error: "kyc_already_pending",
      message: "Votre KYC est déjà en cours d'examen.",
    }, { status: 400, headers: corsHeaders });
  }

  const body = await req.json();
  const { fullName, idType, idNumber, idDocumentRectoUrl, idDocumentVersoUrl, selfieUrl } = body;'''

if old_kyc in src:
    src = src.replace(old_kyc, new_kyc, 1)
    ops.append("KYC 24h")

# ═══ C. Ajouter la route /register/rate-check (pour le rate limit IP) ═══
# Cette route est appelée AVANT l'inscription, elle ne nécessite pas de JWT
rate_route = '''
    // ═══ RATE LIMIT REGISTER (public) ═══
    if (method === "POST" && path.endsWith("/register/check-rate")) {
      const ip = getClientIp(req);
      const check = await checkRateLimit(kv, `rate:register:${ip}`, {
        maxAttempts: 3,
        windowMs: 60 * 60 * 1000, // 1 heure
        blockMs: 60 * 60 * 1000,   // Bloque 1 heure
      });
      if (!check.allowed) {
        const minutesLeft = Math.ceil((check.retryAfterMs || 0) / 60000);
        return Response.json({
          allowed: false,
          message: `Trop de créations de compte depuis cette IP. Réessayez dans ${minutesLeft} minutes.`,
          retry_after_ms: check.retryAfterMs,
        }, { status: 429, headers: corsHeaders });
      }
      return Response.json({ allowed: true }, { headers: corsHeaders });
    }

'''

# Insérer juste avant la route publique /profile/public/
if "/register/check-rate" not in src:
    anchor = '    // ═══ ROUTE PUBLIQUE (Pas de JWT requis) ═══'
    if anchor in src:
        src = src.replace(anchor, rate_route + anchor, 1)
        ops.append("route rate-check")

p.write_text(src, encoding="utf-8")
print("✅ " + " | ".join(ops) if ops else "⚠️ Aucune modification")
PY

# ═══════════════════════════════════════════════
# 2. FRONTEND : Register.tsx — Email vérifié + rate limit
# ═══════════════════════════════════════════════
REGISTER_FILE="src/app/pages/Register.tsx"
cp "$REGISTER_FILE" "${REGISTER_FILE}.bak.antibots"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/Register.tsx")
src = p.read_text(encoding="utf-8")
ops = []

# Ajouter le check de rate limit AVANT l'inscription
# Trouver la fonction handleSubmit
old_submit = "const handleSubmit = async (e: React.FormEvent) => {"
new_submit = '''const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ═══ ANTI-BOT : Vérifier le rate limit par IP ═══
    try {
      const rateRes = await fetch(`https://${projectId}.supabase.co/functions/v1/server/register/check-rate`, {
        method: "POST",
      });
      if (rateRes.status === 429) {
        const data = await rateRes.json();
        toast.error("Trop de tentatives", { description: data.message });
        return;
      }
    } catch (err) {
      console.warn("[REGISTER] Rate check failed, continuing:", err);
    }
'''

if old_submit in src and "check-rate" not in src:
    src = src.replace(old_submit, new_submit, 1)
    ops.append("rate check avant register")

# Ajouter un message si le compte est créé mais l'email non confirmé
# Chercher la redirection après inscription réussie
old_redirect = "navigate(\"/login\");"
new_redirect = '''toast.success("Compte créé ! Vérifiez votre email pour confirmer.", { duration: 6000 });
      navigate("/login");'''

if old_redirect in src and "Vérifiez votre email" not in src:
    src = src.replace(old_redirect, new_redirect, 1)
    ops.append("message confirmation email")

# Ajouter l'import projectId si absent
if "projectId" not in src:
    src = src.replace(
        'import { useAuth } from "../contexts/AuthContext";',
        'import { useAuth } from "../contexts/AuthContext";\nimport { projectId } from "../../../utils/supabase/info";'
    )
    ops.append("import projectId")

p.write_text(src, encoding="utf-8")
print("✅ Register.tsx: " + " | ".join(ops) if ops else "⚠️ Aucune modification")
PY

# ═══════════════════════════════════════════════
# 3. FRONTEND : Kyc.tsx — Afficher le message 24h
# ═══════════════════════════════════════════════
KYC_FILE="src/app/pages/Kyc.tsx"
if [ -f "$KYC_FILE" ]; then
  cp "$KYC_FILE" "${KYC_FILE}.bak.antibots"
  
  python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/Kyc.tsx")
src = p.read_text(encoding="utf-8")

# Ajouter la gestion de l'erreur account_too_new dans le catch
old_catch = '''} catch (err) {
      toast.error("Erreur", { description: (err as Error).message });
    }'''

new_catch = '''} catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("au moins 24h")) {
        toast.error("Compte trop récent", { description: msg, duration: 8000 });
      } else {
        toast.error("Erreur", { description: msg });
      }
    }'''

if old_catch in src:
    src = src.replace(old_catch, new_catch, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Kyc.tsx: message 24h ajouté")
else:
    print("⚠️ Kyc.tsx: catch introuvable")
PY
else
  echo "⚠️ Kyc.tsx introuvable"
fi

echo ""
echo "✅ Terminé !"
