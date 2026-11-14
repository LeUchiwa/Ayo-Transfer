#!/usr/bin/env bash
set -euo pipefail

echo "📊 Ajout des filtres pour les revenus plateforme..."

# 1. Mise à jour de Admin.tsx
ADMIN_FILE="src/app/pages/Admin.tsx"
cp "$ADMIN_FILE" "${ADMIN_FILE}.bak.revenue"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/Admin.tsx")
src = p.read_text(encoding="utf-8")

# 1. Ajouter le label pour le type de transaction
old_label = 'case "transfer_received": return "Transfert reçu";'
new_label = 'case "transfer_received": return "Transfert reçu";\n    case "platform_revenue": return "Revenu plateforme";'
if old_label in src and 'case "platform_revenue"' not in src:
    src = src.replace(old_label, new_label)

# 2. Ajouter la couleur pour le type
old_class = 'case "transfer_received": return "bg-teal-50 text-teal-700";'
new_class = 'case "transfer_received": return "bg-teal-50 text-teal-700";\n    case "platform_revenue": return "bg-purple-50 text-purple-700 font-semibold border border-purple-200";'
if old_class in src and 'platform_revenue": return "bg-purple-50' not in src:
    src = src.replace(old_class, new_class)

# 3. Ajouter l'option dans le filtre select
old_select = '<option value="transfer_sent">Transferts</option>'
new_select = '<option value="transfer_sent">Transferts</option>\n                    <option value="platform_revenue">Revenus plateforme</option>'
if old_select in src and 'value="platform_revenue"' not in src:
    src = src.replace(old_select, new_select)

p.write_text(src, encoding="utf-8")
print("✅ Admin.tsx mis à jour (filtre et badges pour les revenus)")
PY

# 2. Mise à jour de History.tsx (pour l'affichage utilisateur/admin)
HISTORY_FILE="src/app/pages/History.tsx"
cp "$HISTORY_FILE" "${HISTORY_FILE}.bak.revenue"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/History.tsx")
src = p.read_text(encoding="utf-8")

# 1. S'assurer que le type est bien pris en compte dans le filtre (si l'admin regarde son propre historique)
old_filter = '<SelectItem value="received">Reçues / Dépôts</SelectItem>'
new_filter = '<SelectItem value="received">Reçues / Dépôts</SelectItem>\n                  <SelectItem value="platform_revenue">Revenus plateforme</SelectItem>'
if old_filter in src and 'value="platform_revenue"' not in src:
    src = src.replace(old_filter, new_filter)

p.write_text(src, encoding="utf-8")
print("✅ History.tsx mis à jour (filtre pour les revenus)")
PY

echo "✅ Terminé !"
