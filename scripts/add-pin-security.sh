#!/usr/bin/env bash
set -euo pipefail
FUNCTION_FILE="supabase/functions/server/index.ts"
[[ -f "$FUNCTION_FILE" ]] || { echo "❌ introuvable"; exit 1; }
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.pin"
echo "🔒 Backup fait"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib
p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# 1. Ajouter les handlers PIN avant handleTransfer
pin_handlers = '''// ═══════════════════════════════════════════════
// SÉCURITÉ — CODE PIN
// ═══════════════════════════════════════════════

async function handleGetPinStatus(userId: string) {
  const hashedPin = await kv.get(`pin:${userId}`);
  return Response.json({ hasPin: !!hashedPin }, { headers: corsHeaders });
}

async function handleSetPin(req: Request, userId: string) {
  const body = await req.json().catch(() => ({}));
  const { pin } = body;

  if (!pin || !/^\\d{4}$/.test(pin)) {
    return Response.json({ error: "Le code PIN doit contenir exactement 4 chiffres." }, { status: 400, headers: corsHeaders });
  }

  const hashedPin = await hashPassword(pin);
  await kv.set(`pin:${userId}`, hashedPin);

  return Response.json({ success: true }, { headers: corsHeaders });
}

async function verifyPin(userId: string, pin: string): Promise<boolean> {
  if (!pin) return false;
  const hashedPin = await kv.get(`pin:${userId}`);
  if (!hashedPin) return true; // Pas de PIN configuré = on laisse passer
  
  return await verifyPassword(pin, hashedPin);
}

'''
marker = "async function handleTransfer(req: Request, userId: string) {"
if marker not in src: print("ERR: handleTransfer introuvable"); sys.exit(2)
if "handleGetPinStatus" not in src:
    src = src.replace(marker, pin_handlers + marker, 1)
    ops.append("Handlers PIN")

# 2. Injecter la vérification du PIN dans handleTransfer
old_transfer_check = '''  const body = await req.json();
  const { amount, recipient, method, methodIcon, phone, reference } = body;'''

new_transfer_check = '''  const body = await req.json();
  const { amount, recipient, method, methodIcon, phone, reference, pin } = body;

  // ═══ VÉRIFICATION DU CODE PIN ═══
  const isPinValid = await verifyPin(userId, pin);
  if (!isPinValid) {
    return Response.json({ error: "invalid_pin", message: "Code PIN incorrect ou manquant." }, { status: 401, headers: corsHeaders });
  }
'''

if old_transfer_check not in src: print("ERR: extraction body transfert introuvable"); sys.exit(2)
if "invalid_pin" not in src:
    src = src.replace(old_transfer_check, new_transfer_check, 1)
    ops.append("Vérification PIN dans transfert")

# 3. Ajouter les routes
route_anchor = 'if (method === "GET" && path.endsWith("/profile")) return await handleGetProfile(userId);'
route_new = route_anchor + '''
      if (method === "GET" && path.endsWith("/profile/pin")) return await handleGetPinStatus(userId);
      if (method === "POST" && path.endsWith("/profile/pin")) return await handleSetPin(req, userId);'''

if route_anchor not in src: print("ERR: route profile introuvable"); sys.exit(2)
if "/profile/pin" not in src:
    src = src.replace(route_anchor, route_new, 1)
    ops.append("Routes PIN")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops))
PY
echo "✅ Backend mis à jour !"
