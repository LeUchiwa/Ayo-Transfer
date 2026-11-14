#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_FILE="src/app/pages/Dashboard.tsx"
cp "$DASHBOARD_FILE" "${DASHBOARD_FILE}.bak.ext"

python3 <<'PY'
import pathlib, re

p = pathlib.Path("src/app/pages/Dashboard.tsx")
src = p.read_text(encoding="utf-8")
ops = []

# 1. Fallback amountFCFA dans le mapping recentTransactions
old_map = "      amount: t.amount,"
new_map = "      amount: t.amount ?? (t as any).amountFCFA ?? 0,"
if old_map in src and "t.amount ?? (t as any).amountFCFA" not in src:
    src = src.replace(old_map, new_map, 1)
    ops.append("amountFCFA fallback")

# 2. Fallback currency pour affichage
old_currency_anchor = '      methodIcon: t.methodIcon,'
new_currency_anchor = '''      methodIcon: t.methodIcon,
      currency: (t as any).currency,
      originalAmount: (t as any).amountLocal,
      country: (t as any).country,'''
if old_currency_anchor in src and "originalAmount:" not in src:
    src = src.replace(old_currency_anchor, new_currency_anchor, 1)
    ops.append("currency/amountLocal")

# 3. Protéger l'affichage : remplacer les appels directs à transaction.amount.toLocaleString()
# On cible uniquement les patterns exacts et sûrs
patterns = [
    (r'\btransaction\.amount\.toLocaleString\(\)', '(transaction.amount ?? 0).toLocaleString()'),
    (r'\bt\.amount\.toLocaleString\(\)', '(t.amount ?? 0).toLocaleString()'),
]

for pattern, replacement in patterns:
    if re.search(pattern, src):
        src = re.sub(pattern, replacement, src)
        ops.append(f"protect: {pattern}")

# 4. Changer le label pour external_transfer
# La logique actuelle : t.type === 'deposit' || 'transfer_received' → 'received', sinon 'sent'
# external_transfer doit être 'sent', c'est déjà le cas. Mais on peut améliorer le label.
# On cherche le rendu du label
old_label = '''{transaction.type === "sent"
                            ? transaction.recipient || "Transfert"
                            : transaction.sender || "Réception"}'''

new_label = '''{transaction.type === "sent"
                            ? (transaction.recipient || "Transfert")
                            : (transaction.sender || "Réception")}'''

# Pas de changement nécessaire sur ce label pour l'instant

p.write_text(src, encoding="utf-8")
print("✅ " + " | ".join(ops) if ops else "⚠️ Aucune modification (déjà patché?)")
PY
