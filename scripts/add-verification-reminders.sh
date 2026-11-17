#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.reminders"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")

# ═══ 1. Templates d'email ═══
emails = '''// ═══════════════════════════════════════════════
// RAPPELS VÉRIFICATION EMAIL
// ═══════════════════════════════════════════════

async function sendVerificationReminder(to: string, name: string | undefined, ageDays: number, reminderNumber: number, daysUntilBlock: number) {
  const userName = name || to.split("@")[0];
  const isFinalWarning = daysUntilBlock <= 14;
  
  // Générer un lien de confirmation valide
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: to,
    password: "Temp-" + crypto.randomUUID() + "-!" + crypto.randomUUID().slice(0, 8),
  });
  
  if (linkError || !linkData?.properties?.action_link) {
    throw new Error(`Failed to generate link: ${linkError?.message || "unknown"}`);
  }
  
  const confirmLink = linkData.properties.action_link;
  const subject = isFinalWarning 
    ? `⚠️ Dernier avertissement : votre compte sera suspendu dans ${daysUntilBlock} jours`
    : `📧 Vérifiez votre email pour activer votre compte AYO`;
  
  const html = emailTemplate(
    "Vérifiez votre email",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName} 👋</h2>
     <p style="color:#6b7280;font-size:15px;margin:0 0 16px;">Vous avez créé un compte AYO il y a ${ageDays} jours, mais votre email n'est toujours pas confirmé.</p>
     ${isFinalWarning 
       ? `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="color:#991b1b;font-weight:600;margin:0;">⚠️ Sans confirmation, votre compte sera suspendu dans ${daysUntilBlock} jours.</p>
          </div>`
       : `<p style="color:#6b7280;font-size:15px;">Pour recevoir de l'argent et effectuer des transferts, vous devez confirmer votre adresse email.</p>`
     }
     <p style="color:#6b7280;font-size:14px;">Cliquez sur le bouton ci-dessous pour confirmer votre email maintenant.</p>
     <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>`,
    "Confirmer mon email",
    confirmLink
  );
  
  return sendEmail(to, subject, html);
}

async function sendVerificationBlockedEmail(to: string, name?: string) {
  const userName = name || to.split("@")[0];
  const html = emailTemplate(
    "Compte suspendu",
    `<h2 style="color:#0f172a;font-size:22px;margin:0 0 8px;">Bonjour ${userName},</h2>
     <p style="color:#6b7280;font-size:15px;">Votre compte AYO a été suspendu car votre adresse email n'a jamais été confirmée après 3 mois et plusieurs rappels.</p>
     <p style="color:#6b7280;font-size:15px;">Pour réactiver votre compte, contactez notre support en précisant votre email.</p>
     <p style="color:#6b7280;font-size:15px;">Nous réactiverons votre compte sous 24h après confirmation de votre email.</p>`,
    "Contacter le support",
    "mailto:contact@ayo-transfer.com"
  );
  return sendEmail(to, "🚫 Votre compte AYO a été suspendu", html);
}

'''

marker = "async function handleAdminResetPin(userId: string) {"
if marker not in src:
    print("ERR: handleAdminResetPin introuvable"); sys.exit(2)
if "sendVerificationReminder" not in src:
    src = src.replace(marker, emails + marker, 1)
    print("✅ Templates d'email ajoutés")

# ═══ 2. Handler principal ═══
handler = '''async function handleVerificationReminders(req: Request) {
  // Vérifier le secret cron
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Lister tous les utilisateurs (pagination)
  let allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
    if (!data.users || data.users.length === 0) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
    if (page > 50) break;
  }
  
  const now = Date.now();
  const stats = { total: allUsers.length, unverified: 0, reminded: 0, blocked: 0, skipped: 0, errors: [] as any[] };
  
  for (const user of allUsers) {
    // Skip si email déjà confirmé
    if (user.email_confirmed_at) continue;
    if (!user.email) continue;
    
    stats.unverified++;
    const createdAt = new Date(user.created_at).getTime();
    const ageDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    // Skip si banni
    if (user.banned_until && new Date(user.banned_until).getTime() > now) {
      stats.skipped++;
      continue;
    }
    
    const reminderKey = `reminder:${user.id}`;
    const reminderData = (await kv.get(reminderKey)) || { count: 0, lastSentAt: null, blockedAt: null };
    
    // Déjà bloqué
    if (reminderData.blockedAt) {
      stats.skipped++;
      continue;
    }
    
    // ═══ RÈGLE 1 : Bloquer après 90 jours ═══
    if (ageDays >= 90) {
      try {
        await supabase.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
        await sendVerificationBlockedEmail(user.email, user.user_metadata?.name);
        await kv.set(reminderKey, { ...reminderData, blockedAt: new Date().toISOString() });
        stats.blocked++;
        console.log(`[REMINDER] Blocked user ${user.id} (${user.email}) after ${ageDays} days`);
      } catch (e) {
        stats.errors.push({ userId: user.id, step: "block", error: String(e) });
      }
      continue;
    }
    
    // ═══ RÈGLE 2 : Rappel hebdomadaire (max 1 tous les 6 jours) ═══
    const lastSent = reminderData.lastSentAt ? new Date(reminderData.lastSentAt).getTime() : 0;
    const hoursSinceLast = (now - lastSent) / (1000 * 60 * 60);
    
    if (lastSent > 0 && hoursSinceLast < 144) { // 6 jours
      stats.skipped++;
      continue;
    }
    
    // Skip si compte trop récent (< 7 jours) — laisse le temps de vérifier
    if (ageDays < 7) {
      stats.skipped++;
      continue;
    }
    
    const daysUntilBlock = 90 - ageDays;
    const reminderCount = (reminderData.count || 0) + 1;
    
    try {
      await sendVerificationReminder(user.email, user.user_metadata?.name, ageDays, reminderCount, daysUntilBlock);
      await kv.set(reminderKey, { count: reminderCount, lastSentAt: new Date().toISOString(), blockedAt: null });
      stats.reminded++;
      console.log(`[REMINDER] Sent #${reminderCount} to ${user.id} (${user.email}), age ${ageDays}d, ${daysUntilBlock}d until block`);
    } catch (e) {
      stats.errors.push({ userId: user.id, step: "remind", error: String(e) });
    }
  }
  
  return Response.json({ success: true, stats }, { headers: corsHeaders });
}

'''

marker2 = "async function handleAdminResetPin(userId: string) {"
if "handleVerificationReminders" not in src:
    src = src.replace(marker2, handler + marker2, 1)
    print("✅ Handler ajouté")

# ═══ 3. Route (avant la vérif JWT) ═══
rate_anchor = '    // ═══ RATE LIMIT REGISTER (public) ═══'
if rate_anchor not in src:
    print("ERR: anchor rate-limit introuvable"); sys.exit(2)

route = '''    // ═══ CRON : Rappels de vérification ═══
    if (method === "POST" && path.endsWith("/cron/verification-reminders")) {
      return await handleVerificationReminders(req);
    }

''' + rate_anchor

if "/cron/verification-reminders" not in src:
    src = src.replace(rate_anchor, route, 1)
    print("✅ Route /cron/verification-reminders ajoutée")

p.write_text(src, encoding="utf-8")
print("DONE")
PY
