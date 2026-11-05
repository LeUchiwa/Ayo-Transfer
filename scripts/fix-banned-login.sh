#!/usr/bin/env bash
set -euo pipefail

AUTH_FILE="src/app/contexts/AuthContext.tsx"
LOGIN_FILE="src/app/pages/Login.tsx"

[[ -f "$AUTH_FILE" ]] || { echo "❌ $AUTH_FILE introuvable"; exit 1; }
[[ -f "$LOGIN_FILE" ]] || { echo "❌ $LOGIN_FILE introuvable"; exit 1; }

BACKUP_AUTH="${AUTH_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
BACKUP_LOGIN="${LOGIN_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$AUTH_FILE" "$BACKUP_AUTH"
cp "$LOGIN_FILE" "$BACKUP_LOGIN"
echo "🔒 Backup AuthContext → $BACKUP_AUTH"
echo "🔒 Backup Login       → $BACKUP_LOGIN"

PATCH_OUTPUT=$(AUTH_FILE="$AUTH_FILE" LOGIN_FILE="$LOGIN_FILE" python3 <<'PY' 2>&1
import os, sys, pathlib

auth_p = pathlib.Path(os.environ["AUTH_FILE"])
login_p = pathlib.Path(os.environ["LOGIN_FILE"])
auth = auth_p.read_text(encoding="utf-8")
login = login_p.read_text(encoding="utf-8")
ops = []

# ═══════════════════════════════════════════════
# PATCH 1 — AuthContext.tsx : détection du ban
# ═══════════════════════════════════════════════
old_login = '''  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };'''

new_login = '''  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        const code = (error as any).code || "";
        const status = (error as any).status;
        if (
          msg.includes("banned") ||
          msg.includes("suspend") ||
          code === "user_banned" ||
          status === 403
        ) {
          throw new Error("BANNED");
        }
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };'''

if old_login not in auth:
    print("ERR: bloc login() introuvable dans AuthContext.tsx")
    sys.exit(2)
auth = auth.replace(old_login, new_login, 1)
ops.append("PATCH-1: AuthContext login() détecte BANNED")

# ═══════════════════════════════════════════════
# PATCH 2 — Login.tsx : import Ban
# ═══════════════════════════════════════════════
old_import = "import { Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, Zap, TrendingUp, ArrowRight } from 'lucide-react';"
new_import = "import { Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, Zap, TrendingUp, ArrowRight, Ban } from 'lucide-react';"

if old_import not in login:
    print("ERR: import lucide-react introuvable")
    sys.exit(2)
login = login.replace(old_import, new_import, 1)
ops.append("PATCH-2: import Ban ajouté")

# ═══════════════════════════════════════════════
# PATCH 3 — Login.tsx : state isBanned
# ═══════════════════════════════════════════════
old_state = "  const [isLoading, setIsLoading] = useState(false);"
new_state = "  const [isLoading, setIsLoading] = useState(false);\n  const [isBanned, setIsBanned] = useState(false);"

if old_state not in login:
    print("ERR: state isLoading introuvable")
    sys.exit(2)
login = login.replace(old_state, new_state, 1)
ops.append("PATCH-3: state isBanned ajouté")

# ═══════════════════════════════════════════════
# PATCH 4 — Login.tsx : catch handleSubmit
# ═══════════════════════════════════════════════
old_catch = """    } catch (error) {
      toast.error('Erreur de connexion. Vérifiez vos identifiants.');
    } finally {"""

new_catch = """    } catch (error) {
      if ((error as Error).message === "BANNED") {
        setIsBanned(true);
        toast.error("Compte suspendu");
      } else {
        toast.error('Erreur de connexion. Vérifiez vos identifiants.');
      }
    } finally {"""

if old_catch not in login:
    print("ERR: bloc catch de handleSubmit introuvable")
    sys.exit(2)
login = login.replace(old_catch, new_catch, 1)
ops.append("PATCH-4: catch handleSubmit gère BANNED")

# ═══════════════════════════════════════════════
# PATCH 5 — Login.tsx : bannière rouge
# ═══════════════════════════════════════════════
banner_anchor = """          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-poppins font-bold text-foreground">
              Connexion
            </h2>"""

banner_block = """          {isBanned && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Compte temporairement suspendu</p>
                <p className="text-sm text-red-700 mt-1">
                  Votre compte a été suspendu par un administrateur. Veuillez contacter le support pour plus d'informations.
                </p>
                <a
                  href="mailto:contact@ayo-transfer.com"
                  className="inline-block mt-2 text-sm text-red-800 font-medium underline hover:no-underline"
                >
                  📧 contact@ayo-transfer.com
                </a>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-poppins font-bold text-foreground">
              Connexion
            </h2>"""

if banner_anchor not in login:
    print("ERR: ancre bannière (titre Connexion) introuvable")
    sys.exit(2)
login = login.replace(banner_anchor, banner_block, 1)
ops.append("PATCH-5: bannière suspendu ajoutée")

# ═══════════════════════════════════════════════
# PATCH 6 — Login.tsx : reset isBanned sur onChange
# ═══════════════════════════════════════════════
# Email onChange
old_email_onchange = """                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}"""
new_email_onchange = """                  onChange={(e) => { setEmail(e.target.value); setIsBanned(false); }}
                  disabled={isLoading}"""

if old_email_onchange in login:
    login = login.replace(old_email_onchange, new_email_onchange, 1)
    ops.append("PATCH-6a: reset isBanned sur email")
else:
    print("SKIP: email onChange pattern introuvable")

# Password onChange
old_pwd_onchange = """                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}"""
new_pwd_onchange = """                  onChange={(e) => { setPassword(e.target.value); setIsBanned(false); }}
                  disabled={isLoading}"""

if old_pwd_onchange in login:
    login = login.replace(old_pwd_onchange, new_pwd_onchange, 1)
    ops.append("PATCH-6b: reset isBanned sur password")
else:
    print("SKIP: password onChange pattern introuvable")

# Écriture
auth_p.write_text(auth, encoding="utf-8")
login_p.write_text(login, encoding="utf-8")
print("OK: " + " | ".join(ops))
print("DONE")
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP_AUTH" "$AUTH_FILE"
  cp "$BACKUP_LOGIN" "$LOGIN_FILE"
  echo "❌ Patch annulé → backups restaurés"
  exit 1
fi

echo ""
echo "─── Vérifications ───"
echo "AuthContext → BANNED détecté : $(grep -c 'throw new Error(\"BANNED\")' "$AUTH_FILE") (doit être 1)"
echo "Login       → import Ban     : $(grep -c 'ArrowRight, Ban' "$LOGIN_FILE") (doit être 1)"
echo "Login       → state isBanned : $(grep -c 'const \[isBanned' "$LOGIN_FILE") (doit être 1)"
echo "Login       → bannière       : $(grep -c 'Compte temporairement suspendu' "$LOGIN_FILE") (doit être 1)"
echo "Login       → catch BANNED   : $(grep -c 'message === \"BANNED\"' "$LOGIN_FILE") (doit être 1)"
echo ""
echo "Balance accolades Login : { $(grep -o '{' "$LOGIN_FILE" | wc -l) / } $(grep -o '}' "$LOGIN_FILE" | wc -l)"
echo "Balance accolades Auth  : { $(grep -o '{' "$AUTH_FILE" | wc -l) / } $(grep -o '}' "$AUTH_FILE" | wc -l)"
echo ""

echo "✅ Terminé."
echo "   Rollback : cp \"$BACKUP_AUTH\" \"$AUTH_FILE\" && cp \"$BACKUP_LOGIN\" \"$LOGIN_FILE\""
