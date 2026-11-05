#!/usr/bin/env bash
set -euo pipefail

ADMIN_FILE="src/app/pages/Admin.tsx"

[[ -f "$ADMIN_FILE" ]] || { echo "❌ $ADMIN_FILE introuvable — place-toi à la racine du projet"; exit 1; }

BACKUP="${ADMIN_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$ADMIN_FILE" "$BACKUP"
echo "🔒 Backup → $BACKUP"

echo "🩹 Correction des 2 erreurs critiques…"

PATCH_OUTPUT=$(ADMIN_FILE="$ADMIN_FILE" python3 <<'PY' 2>&1
import os, re, sys, pathlib

p = pathlib.Path(os.environ["ADMIN_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ═══ FIX 1 : useState serviceModal/suspendModal cassés ═══
# Cherche le bloc à partir de "const [serviceModal" jusqu'à avant "const [serviceSaving"
start_marker = "  const [serviceModal, setServiceModal] = useState<{"
end_marker = "  const [serviceSaving, setServiceSaving] = useState(false);"

start_idx = src.find(start_marker)
end_idx = src.find(end_marker)

if start_idx == -1:
    print("ERR: 'const [serviceModal' introuvable"); sys.exit(2)
if end_idx == -1:
    print("ERR: 'const [serviceSaving' introuvable"); sys.exit(2)
if end_idx <= start_idx:
    print("ERR: ordre des marqueurs incorrect"); sys.exit(2)

new_block = '''  const [serviceModal, setServiceModal] = useState<{
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
      id: "", name: "", description: "", icon: "💳",
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

  const [deleteServiceModal, setDeleteServiceModal] = useState<{ open: boolean; service: AdminService | null }>({
    open: false, service: null,
  });

'''

src = src[:start_idx] + new_block + src[end_idx:]
ops.append("FIX-1: useState serviceModal/suspendModal reconstruits")

# ═══ FIX 2 : retirer le bloc suspendModal imbriqué dans UserDetailModal ═══
# Cherche "      {/* ─── Modal de suspension ─── */}" puis le bloc suivant jusqu'à "    </div>\n  </div>\n  <button onClick={onClose}"
nested_start = src.find("      {/* ─── Modal de suspension ─── */}")
if nested_start == -1:
    print("SKIP: bloc suspendModal imbriqué introuvable (peut-être déjà retiré)")
else:
    # On cherche la fin du bloc = "      )}\n" qui termine le {suspendModal.open && ...}
    # puis on cherche le </div> qui suit
    search_from = nested_start
    # Trouve la première occurrence de "      )}" après nested_start qui ferme le bloc
    end_pattern = "      )}"
    end_idx2 = src.find(end_pattern, search_from)
    if end_idx2 == -1:
        print("ERR: fin du bloc suspendModal imbriqué introuvable"); sys.exit(2)
    end_idx2 += len(end_pattern)
    
    # Supprime le bloc
    src = src[:nested_start] + src[end_idx2:]
    ops.append("FIX-2a: bloc suspendModal imbriqué retiré de UserDetailModal")

# ═══ FIX 3 : ajouter le modal Suspend à la bonne place (après rejectModal) ═══
if "{suspendModal.open && suspendModal.user && (" in src:
    print("SKIP: modal Suspend déjà présent à la bonne place")
else:
    # Trouve le bloc rejectModal
    reject_marker = "      {/* Reject Modal */}"
    reject_idx = src.find(reject_marker)
    if reject_idx == -1:
        print("ERR: 'Reject Modal' introuvable pour ancrage"); sys.exit(2)
    
    # Trouve la fin du bloc rejectModal : cherche le "      )}" qui le ferme
    # On cherche à partir du reject_idx, le prochain "      )}" après "{rejectModal.open"
    reject_open = src.find("{rejectModal.open", reject_idx)
    if reject_open == -1:
        print("ERR: '{rejectModal.open' introuvable"); sys.exit(2)
    reject_close = src.find("      )}", reject_open)
    if reject_close == -1:
        print("ERR: fermeture rejectModal introuvable"); sys.exit(2)
    reject_close += len("      )}")
    
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
print("DONE")
PY
) || true

echo "$PATCH_OUTPUT"

if echo "$PATCH_OUTPUT" | grep -q "^ERR:"; then
  cp "$BACKUP" "$ADMIN_FILE"
  echo "❌ Patch annulé → backup restauré"
  exit 1
fi

echo ""
echo "─── Vérification syntaxe ───"
grep -c "suspendModal" "$ADMIN_FILE" | xargs -I{} echo "Occurrences de suspendModal : {}"
grep -c "const \[serviceModal" "$ADMIN_FILE" | xargs -I{} echo "Déclarations serviceModal : {} (doit être 1)"
grep -c "const \[suspendModal" "$ADMIN_FILE" | xargs -I{} echo "Déclarations suspendModal : {} (doit être 1)"

echo ""
echo "─── Diff (60 premières lignes) ───"
diff -u "$BACKUP" "$ADMIN_FILE" | head -60 || true
echo "──────────────────────────"
echo ""

echo "✅ Terminé."
echo "   Backup : $BACKUP"
echo "   Rollback : cp \"$BACKUP\" \"$ADMIN_FILE\""
