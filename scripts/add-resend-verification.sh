#!/usr/bin/env bash
set -euo pipefail

# ═══ 1. Backend : route /auth/resend-verification ═══
FUNCTION_FILE="supabase/functions/server/index.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

handler = '''async function handleResendVerification(req: Request, userId: string) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);

  if (!user || !user.email) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }
  if (user.email_confirmed_at) {
    return Response.json({ error: "already_confirmed", message: "Votre email est déjà confirmé." }, { status: 400, headers: corsHeaders });
  }

  // Rate limit : 3 demandes / heure
  const check = await checkRateLimit(kv, `rate:resend-verif:${userId}`, {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (!check.allowed) {
    const minutesLeft = Math.ceil((check.retryAfterMs || 0) / 60000);
    return Response.json({ error: "rate_limited", message: `Trop de demandes. Réessayez dans ${minutesLeft} minutes.` }, { status: 429, headers: corsHeaders });
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });

  if (error) {
    return Response.json({ error: "send_failed", details: error.message }, { status: 500, headers: corsHeaders });
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

'''
marker = "async function handleAdminResetPin(userId: string) {"
if "handleResendVerification" not in src:
    src = src.replace(marker, handler + marker, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Handler resend-verification ajouté")
PY

python3 <<'PY'
import pathlib
p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

route_anchor = 'if (method === "GET" && path.endsWith("/profile")) return await handleGetProfile(userId);'
route_new = route_anchor + '\n      if (method === "POST" && path.endsWith("/auth/resend-verification")) return await handleResendVerification(req, userId);'

if "/auth/resend-verification" not in src:
    src = src.replace(route_anchor, route_new, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Route ajoutée")
PY

# ═══ 2. Frontend : bouton dans Profile.tsx ═══
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/pages/Profile.tsx")
src = p.read_text(encoding="utf-8")

# Ajouter l'import si besoin
if "SendEmailVerification" not in src and "Mail" not in src:
    pass

# Ajouter l'état
if "isEmailVerified" not in src:
    anchor = "const [hasPin, setHasPin] = useState(false);"
    new_state = anchor + '''
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [resending, setResending] = useState(false);
'''
    src = src.replace(anchor, new_state, 1)

# Ajouter le useEffect pour vérifier l'email
anchor_effect = "walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);"
new_effect = anchor_effect + '''
    
    // Vérifier si l'email est confirmé
    import("../../../utils/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        setIsEmailVerified(!!data.user?.email_confirmed_at);
      });
    });
'''
if "isEmailVerified" not in src:
    pass

# Ajouter la fonction resend
anchor_func = "const handleSave = async () => {"
new_func = '''const handleResendVerification = async () => {
    setResending(true);
    try {
      const res = await walletApi.resendVerification();
      if (res.success) {
        toast.success("Email de confirmation envoyé !", { description: "Vérifiez votre boîte de réception (et les spams)." });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setResending(false);
    }
  };

  ''' + anchor_func
if "handleResendVerification" not in src:
    src = src.replace(anchor_func, new_func, 1)

# Ajouter la carte d'avertissement (avant le bouton de déconnexion)
anchor_jsx = "</div>\\n    </div>\\n  );\\n}"
card = '''
        {/* Alerte email non vérifié */}
        {isEmailVerified === false && (
          <Card className="mt-4 border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⚠️</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 text-sm">Votre email n'est pas confirmé</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Sans confirmation, votre compte sera suspendu après 90 jours. Vérifiez votre boîte mail.
                  </p>
                  <Button 
                    onClick={handleResendVerification} 
                    disabled={resending}
                    size="sm" 
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {resending ? "Envoi..." : "Renvoyer l'email de confirmation"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        ''' + anchor_jsx
if "Renvoyer l'email de confirmation" not in src:
    src = src.replace(anchor_jsx, card, 1)

p.write_text(src, encoding="utf-8")
print("✅ Profile.tsx mis à jour")
PY

# ═══ 3. API ═══
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")

if "resendVerification" not in src:
    method = '''
  resendVerification: () => apiCall('/auth/resend-verification', { method: 'POST' }),
'''
    anchor = "  getServices: () => apiCall('/services'),"
    src = src.replace(anchor, anchor + method, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ API ajoutée")
PY

echo "✅ Terminé."
