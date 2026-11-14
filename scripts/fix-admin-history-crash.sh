#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Correction du crash sur l'onglet Transactions admin..."

# ═══ 1. Admin.tsx ═══
ADMIN_FILE="src/app/pages/Admin.tsx"
cp "$ADMIN_FILE" "${ADMIN_FILE}.bak.crash"

python3 <<'PY'
import pathlib, re

p = pathlib.Path("src/app/pages/Admin.tsx")
src = p.read_text(encoding="utf-8")

# 1. Ajouter le label pour external_transfer
if '"external_transfer":' not in src:
    old = '"platform_revenue": "Revenu plateforme",'
    new = '"platform_revenue": "Revenu plateforme",\n    "external_transfer": "Envoi externe",'
    if old in src:
        src = src.replace(old, new, 1)
        print("✅ Label external_transfer ajouté")

# 2. Ajouter la couleur pour external_transfer
if 'case "external_transfer": return' not in src:
    old = 'case "platform_revenue": return "bg-purple-50 text-purple-700 font-semibold border border-purple-200";'
    new = 'case "platform_revenue": return "bg-purple-50 text-purple-700 font-semibold border border-purple-200";\n    case "external_transfer": return "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200";'
    if old in src:
        src = src.replace(old, new, 1)
        print("✅ Couleur external_transfer ajoutée")

# 3. PROTECTION : remplacer les appels directs à tx.amount.toLocaleString()
# On cherche toutes les formes de rendu qui peuvent planter
patterns = [
    # tx.amount.toLocaleString() -> (tx.amount || tx.amountFCFA || 0).toLocaleString()
    (r'\btx\.amount\.toLocaleString\(\)', '(tx.amount ?? (tx as any).amountFCFA ?? 0).toLocaleString()'),
    # transaction.amount.toLocaleString() -> protection
    (r'\btransaction\.amount\.toLocaleString\(\)', '(transaction.amount ?? (transaction as any).amountFCFA ?? 0).toLocaleString()'),
    # deposit.amount.toLocaleString() (dans les sections deposit)
    (r'\bdeposit\.amount\.toLocaleString\(\)', '(deposit.amount ?? (deposit as any).amountFCFA ?? 0).toLocaleString()'),
    # withdraw.amount.toLocaleString() 
    (r'\bw\.amount\.toLocaleString\(\)', '(w.amount ?? (w as any).amountFCFA ?? 0).toLocaleString()'),
]

for pattern, replacement in patterns:
    if re.search(pattern, src):
        src = re.sub(pattern, replacement, src)
        print(f"✅ Protection ajoutée pour {pattern}")

# 4. Interface AdminTransaction : ajouter les champs optionnels
if "amountFCFA?" not in src:
    old = '''interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  amount: number;'''
    new = '''interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  amount?: number;
  amountFCFA?: number;
  amountLocal?: number;
  currency?: string;
  country?: string;
  destinationName?: string;
  destinationPhone?: string;'''
    if old in src:
        src = src.replace(old, new, 1)
        print("✅ Type AdminTransaction étendu")

# 5. Dans le rendu du tableau, gérer le cas external_transfer
# Cherche la cellule qui affiche tx.amount.toLocaleString()
old_render = '''<td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{(tx.amount ?? (tx as any).amountFCFA ?? 0).toLocaleString()} FCFA</p>
                            {tx.fee > 0 && <p className="text-xs text-gray-400">Frais: {tx.fee.toLocaleString()}</p>}
                          </td>'''

new_render = '''<td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{(tx.amount ?? tx.amountFCFA ?? 0).toLocaleString()} FCFA</p>
                            {tx.type === "external_transfer" && tx.amountLocal && (
                              <p className="text-xs text-indigo-600 font-medium mt-0.5">
                                → {tx.amountLocal.toLocaleString()} {tx.currency} ({tx.country})
                              </p>
                            )}
                            {tx.fee > 0 && <p className="text-xs text-gray-400">Frais: {tx.fee.toLocaleString()}</p>}
                          </td>'''

if old_render in src:
    src = src.replace(old_render, new_render, 1)
    print("✅ Affichage external_transfer ajouté dans le tableau")

p.write_text(src, encoding="utf-8")
PY

echo "✅ Correction terminée."
