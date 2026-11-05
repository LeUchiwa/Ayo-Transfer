#!/usr/bin/env bash
set -euo pipefail

ADMIN_FILE="src/app/pages/Admin.tsx"
[[ -f "$ADMIN_FILE" ]] || { echo "❌ $ADMIN_FILE introuvable"; exit 1; }

BACKUP="${ADMIN_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$ADMIN_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

PATCH_OUTPUT=$(ADMIN_FILE="$ADMIN_FILE" python3 <<'PY' 2>&1
import os, re, sys, pathlib

p = pathlib.Path(os.environ["ADMIN_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ═══ FIX 1 : reconstruction des useState serviceModal/suspendModal ═══
start_marker = "  const [serviceModal, setServiceModal] = useState<{"
end_marker = "  const [serviceSaving, setServiceSaving] = useState(false);"

# On utilise find sur "\n" pour ancrer
start_idx = src.find("\n" + start_marker)
end_idx = src.find("\n" + end_marker)

if start_idx == -1: print("ERR: serviceModal introuvable"); sys.exit(2)
if end_idx == -1: print("ERR: serviceSaving introuvable"); sys.exit(2)
if end_idx <= start_idx: print("ERR: ordre incorrect"); sys.exit(2)

# Vérifie qu'il n'y a pas d'autres useState entre (detection du bloc cassé)
between = src[start_idx:end_idx]
if "const [suspendModal" in between and "const [serviceModal" in between[10:]:
    # Bloc cassé détecté (2 useState imbriqués)
    pass
elif "const [suspendModal" not in between:
    print("SKIP: le bloc ne contient pas de suspendModal imbriqué (déjà corrigé ?)")

new_block = '''
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    service: {
      id: string;
      name: string;
      description: string;
      icon: string;
      color: string;
      type: string;
      depositFee: number;
      withdrawFee: number;
      active: boolean;
    };
  }>({
    open: false,
    mode: "create",
    service: {
      id: "", name: "", description: "", icon: "\U0001F4B3",
      color: "bg-gray-500", type: "mobile-money",
      depositFee: 0, withdrawFee: 0, active: true,
    },
  });

  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    user: AdminUser | null;
    reason: string;
    activity: any | null;
    loadingActivity: boolean;
  }>({ open: false, user: null, reason: "", activity: null, loadingActivity: false });

'''

src = src[:start_idx] + new_block + src[end_idx:]
ops.append("FIX-1: useState serviceModal/suspendModal reconstruits")

# ═══ FIX 2 : retirer le bloc suspendModal imbriqué dans UserDetailModal ═══
# Cherche "      {/* ─── Modal de suspension ─── */}" (avec ses 6 espaces)
nested_start_marker = "\n      {/* ─── Modal de suspension ─── */}"
nested_start = src.find(nested_start_marker)

if nested_start == -1:
    print("SKIP: pas de bloc imbriqué à retirer")
else:
    # On cherche la fin du bloc : "\n      )}\n" (ancré début+fin de ligne)
    # Ce pattern existe à la fermeture du bloc {suspendModal.open && (...)}
    search_from = nested_start + len(nested_start_marker)
    
    # On cherche "\n      )}" suivi de "\n" ou fin de fichier
    # On itère sur les occurrences pour trouver la bonne
    end_idx = -1
    search_pos = search_from
    while True:
        candidate = src.find("\n      )}", search_pos)
        if candidate == -1:
            break
        # Vérifie que c'est bien un début de ligne (caractère suivant est \n ou fin)
        after = src[candidate + len("\n      )}"):candidate + len("\n      )}") + 1]
        if after in ("\n", ""):
            end_idx = candidate + len("\n      )}")
            break
        search_pos = candidate + 1
    
    if end_idx == -1:
        print("ERR: fin du bloc modal imbriqué introuvable"); sys.exit(2)
    
    src = src[:nested_start] + src[end_idx:]
    ops.append("FIX-2: bloc imbriqué retiré de UserDetailModal")

# ═══ FIX 3 : ajouter le modal Suspend après rejectModal ═══
if "\n      {/* Modal de suspension */}" in src:
    print("SKIP: modal Suspend déjà présent")
else:
    reject_marker = "\n      {/* Reject Modal */}"
    reject_idx = src.find(reject_marker)
    if reject_idx == -1:
        print("ERR: Reject Modal introuvable"); sys.exit(2)
    
    # Cherche le "      )}" qui ferme le bloc rejectModal
    reject_open = src.find("{rejectModal.open", reject_idx)
    if reject_open == -1:
        print("ERR: {rejectModal.open introuvable"); sys.exit(2)
    
    # Trouve "\n      )}" ancré après reject_open
    reject_close = -1
    search_pos = reject_open
    while True:
        candidate = src.find("\n      )}", search_pos)
        if candidate == -1: break
        after = src[candidate + len("\n      )}"):candidate + len("\n      )}") + 1]
        if after in ("\n", ""):
            reject_close = candidate + len("\n      )}")
            break
        search_pos = candidate + 1
    
    if reject_close == -1:
        print("ERR: fermeture rejectModal introuvable"); sys.exit(2)
    
    modal_block = '''

      {/* Modal de suspension */}
      {suspendModal.open && suspendModal.user && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSuspendModal(s => ({ ...s, open: false }))}
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Suspendre l'utilisateur</h3>
                <p className="text-sm text-muted-foreground">
                  {suspendModal.user.name} · {suspendModal.user.email}
                </p>
              </div>
            </div>

            {suspendModal.loadingActivity ? (
              <div className="text-center py-4 text-muted-foreground">Chargement de l'activité…</div>
            ) : suspendModal.activity && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <p className="font-medium mb-2">Activité des dernières 24h</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Transferts envoyés : <strong>{suspendModal.activity.activity?.sent24h ?? 0}</strong></div>
                  <div>Montant envoyé : <strong>{(suspendModal.activity.activity?.sentAmount24h ?? 0).toLocaleString()} FCFA</strong></div>
                  <div>Destinataires uniques : <strong>{suspendModal.activity.activity?.uniqueRecipients24h ?? 0}</strong></div>
                  <div>Échecs : <strong>{suspendModal.activity.activity?.failed24h ?? 0}</strong></div>
                </div>
                {suspendModal.activity.suspicious && (suspendModal.activity.alerts?.length ?? 0) > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-200">
                    <p className="text-red-700 font-medium text-xs">⚠️ Activité suspecte détectée :</p>
                    <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                      {suspendModal.activity.alerts.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <label className="block text-sm font-medium mb-2">Raison de la suspension</label>
            <textarea
              className="w-full border rounded-lg p-3 min-h-20 text-sm"
              placeholder="Ex : Série de transferts inhabituels"
              value={suspendModal.reason}
              onChange={(e) => setSuspendModal(s => ({ ...s, reason: e.target.value }))}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSuspendModal(s => ({ ...s, open: false }))}
                className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmSuspend}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Suspendre
              </button>
            </div>
          </div>
        </div>
      )}'''
    
    src = src[:reject_close] + modal_block + src[reject_close:]
    ops.append("FIX-3: modal Suspend ajouté après rejectModal")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops))
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP" "$ADMIN_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "─── Vérifs ───"
echo "Déclarations serviceModal : $(grep -c 'const \[serviceModal' "$ADMIN_FILE") (doit être 1)"
echo "Déclarations suspendModal : $(grep -c 'const \[suspendModal' "$ADMIN_FILE") (doit être 1)"
echo "Occurrences modal Suspend rendu : $(grep -c 'suspendModal.open && suspendModal.user' "$ADMIN_FILE") (doit être 1)"
echo ""
echo "Balance des accolades : { $(grep -o '{' "$ADMIN_FILE" | wc -l) / } $(grep -o '}' "$ADMIN_FILE" | wc -l)"
echo ""

echo "✅ Terminé. Backup : $BACKUP"
