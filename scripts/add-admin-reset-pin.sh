#!/usr/bin/env bash
set -euo pipefail

# ═══ 1. Backend : ajouter handleAdminResetPin ═══
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.resetpin"

FUNCTION_FILE="$FUNCTION_FILE" python3 <<'PY'
import os, sys, pathlib

p = pathlib.Path(os.environ["FUNCTION_FILE"])
src = p.read_text(encoding="utf-8")

# Ajouter le handler juste avant handleAdminSuspendUser
handler = '''async function handleAdminResetPin(userId: string) {
  // Vérifier que l'utilisateur existe
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !user) {
    return Response.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
  }

  // Vérifier qu'un PIN existe
  const hashedPin = await kv.get(`pin:${userId}`);
  if (!hashedPin) {
    return Response.json({
      success: false,
      message: "Cet utilisateur n'a pas de code PIN configuré."
    }, { status: 400, headers: corsHeaders });
  }

  // Supprimer le PIN
  try {
    await kv.delete(`pin:${userId}`);
  } catch (e) {
    // Fallback si delete n'existe pas : set à null
    await kv.set(`pin:${userId}`, null);
  }

  // Audit log
  try {
    const audit = (await kv.get("admin:audit")) || [];
    audit.unshift({
      timestamp: new Date().toISOString(),
      action: "reset_pin",
      targetUserId: userId,
      targetEmail: user.email,
      admin: "AYO-ADMIN",
    });
    await kv.set("admin:audit", audit.slice(0, 500));
  } catch (e) {
    console.error("[AUDIT] Failed to log PIN reset:", e);
  }

  console.log(`[ADMIN] PIN reset for user ${userId} (${user.email})`);

  // Email de notification à l'utilisateur
  if (user.email) {
    (async () => {
      try {
        await sendEmail(user.email, "🔐 Votre code PIN a été réinitialisé",
          `<p>Bonjour ${user.user_metadata?.name || "Utilisateur"},</p>
           <p>Votre code PIN a été réinitialisé par un administrateur AYO.</p>
           <p>Pour des raisons de sécurité, veuillez en configurer un nouveau dès maintenant depuis votre profil.</p>
           <p>Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement le support.</p>`);
      } catch (err) { console.error("[EMAIL]", err); }
    })();
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

'''

marker = "async function handleAdminSuspendUser(supabase: any, userId: string, reason: string) {"
if marker not in src:
    print("ERR: handleAdminSuspendUser introuvable"); sys.exit(2)
if "handleAdminResetPin" not in src:
    src = src.replace(marker, handler + marker, 1)
    print("✅ Handler handleAdminResetPin ajouté")

# Ajouter la route
route_anchor = '''if (method === "POST" && path.includes("/admin/users/") && path.endsWith("/suspend")) {'''
route_new = '''if (method === "POST" && path.includes("/admin/users/") && path.endsWith("/reset-pin")) {
          const userId = path.split("/admin/users/")[1].replace("/reset-pin", "");
          return await handleAdminResetPin(userId);
        }

        ''' + route_anchor

if "/reset-pin" not in src:
    src = src.replace(route_anchor, route_new, 1)
    print("✅ Route /admin/users/:id/reset-pin ajoutée")

p.write_text(src, encoding="utf-8")
PY

# ═══ 2. Admin.tsx : ajouter le bouton + modal ═══
ADMIN_FILE="src/app/pages/Admin.tsx"
cp "$ADMIN_FILE" "${ADMIN_FILE}.bak.resetpin"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/Admin.tsx")
src = p.read_text(encoding="utf-8")
ops = []

# 1. Ajouter l'état pour le modal de reset PIN
if "resetPinModal" not in src:
    anchor = 'const [suspendModal, setSuspendModal] = useState<{'
    new_state = '''const [resetPinModal, setResetPinModal] = useState<{
    open: boolean;
    user: AdminUser | null;
    loading: boolean;
  }>({ open: false, user: null, loading: false });

  ''' + anchor
    if anchor in src:
        src = src.replace(anchor, new_state, 1)
        ops.append("state")

# 2. Ajouter la fonction de reset
if "handleResetPin" not in src:
    anchor = "const handleReactivateUser = async (user: AdminUser) => {"
    new_func = '''const handleResetPin = async (user: AdminUser) => {
    setResetPinModal({ open: true, user, loading: false });
  };

  const confirmResetPin = async () => {
    if (!resetPinModal.user) return;
    setResetPinModal(s => ({ ...s, loading: true }));
    try {
      const res = await adminCall(`/admin/users/${resetPinModal.user.id}/reset-pin`, {
        method: "POST",
      });
      if (res.success) {
        toast.success(`PIN de ${resetPinModal.user.name} réinitialisé`);
        setResetPinModal({ open: false, user: null, loading: false });
      }
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
      setResetPinModal(s => ({ ...s, loading: false }));
    }
  };

  ''' + anchor
    if anchor in src:
        src = src.replace(anchor, new_func, 1)
        ops.append("handleResetPin")

# 3. Ajouter le bouton dans la liste des users (à côté de "Suspendre")
button_anchor = '''<button
                                      onClick={() => openSuspendModal(user)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Suspendre"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      Suspendre
                                    </button>'''

new_button = '''<button
                                      onClick={() => handleResetPin(user)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                      title="Réinitialiser le PIN"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                      PIN
                                    </button>

                                    ''' + button_anchor

if "handleResetPin(user)" not in src and button_anchor in src:
    src = src.replace(button_anchor, new_button, 1)
    ops.append("bouton PIN")

# 4. Ajouter le modal à la fin (à côté des autres modals)
if "resetPinModal.open && resetPinModal.user" not in src:
    anchor = "      {/* Modal de suspension */}"
    modal = '''      {/* Modal de réinitialisation du PIN */}
      {resetPinModal.open && resetPinModal.user && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !resetPinModal.loading && setResetPinModal(s => ({ ...s, open: false }))}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Réinitialiser le PIN</h3>
                <p className="text-sm text-muted-foreground">
                  {resetPinModal.user.name} · {resetPinModal.user.email}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              ⚠️ Le code PIN de cet utilisateur sera supprimé. Il devra en configurer un nouveau lors de sa prochaine transaction. Un email de notification lui sera envoyé.
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Cette action est enregistrée dans les logs d'audit.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setResetPinModal({ open: false, user: null, loading: false })}
                disabled={resetPinModal.loading}
                className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmResetPin}
                disabled={resetPinModal.loading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetPinModal.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" />Réinitialiser</>}
              </button>
            </div>
          </div>
        </div>
      )}

      ''' + anchor
    if anchor in src:
        src = src.replace(anchor, modal, 1)
        ops.append("modal")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops) if ops else "SKIP: rien à faire")
PY

echo "✅ Terminé."
