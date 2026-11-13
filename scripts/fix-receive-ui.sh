#!/usr/bin/env bash
set -euo pipefail

# 1. Vérifier que le composant ReceiveMoneyModal existe (créé au message précédent)
if [ ! -f "src/app/components/ReceiveMoneyModal.tsx" ]; then
  echo "❌ Le fichier ReceiveMoneyModal.tsx n'existe pas. Dis-le-moi."
  exit 1
fi

# 2. Modifier Dashboard.tsx (ta page d'accueil)
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/pages/Dashboard.tsx")
src = p.read_text(encoding="utf-8")

# 2a. Ajouter les imports
if "ReceiveMoneyModal" not in src:
    src = src.replace(
        'import { useAuth } from "../contexts/AuthContext";',
        'import { useAuth } from "../contexts/AuthContext";\nimport { ReceiveMoneyModal } from "../components/ReceiveMoneyModal";\nimport { QrCode } from "lucide-react";'
    )
    print("✅ Imports ajoutés")

# 2b. Ajouter l'état
if "showReceiveModal" not in src:
    src = src.replace(
        'const [showBalance, setShowBalance] = useState(true);',
        'const [showBalance, setShowBalance] = useState(true);\n  const [showReceiveModal, setShowReceiveModal] = useState(false);'
    )
    print("✅ État ajouté")

# 2c. Passer la grille de 4 à 5 colonnes
src = src.replace('grid-cols-4', 'grid-cols-5')

# 2d. Insérer le bouton "Recevoir" juste avant le bouton "Déposer"
deposit_anchor = '<Link to="/wallet?tab=deposit">'
receive_button = '''<button onClick={() => setShowReceiveModal(true)} className="w-full text-left">
          <Card className="bg-white hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-teal-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Recevoir</p>
            </CardContent>
          </Card>
        </button>

        '''
if "Recevoir" not in src:
    if deposit_anchor in src:
        src = src.replace(deposit_anchor, receive_button + deposit_anchor)
        print("✅ Bouton 'Recevoir' inséré")
    else:
        print("⚠️ Impossible de trouver le bouton Déposer, insertion à la fin de la grille...")
        # Fallback: insérer juste avant la fermeture de la div de la grille
        grid_end = '</motion.div>\n\n      {/* ─── Stats ─── */}'
        src = src.replace(grid_end, receive_button + grid_end)

# 2e. Ajouter le Modal à la fin du composant
if "<ReceiveMoneyModal" not in src:
    src = src.replace(
        '    </motion.div>\n  );\n}',
        '''      <ReceiveMoneyModal 
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        userId={user?.id || ""}
        userName={user?.name || "Mon compte"}
      />
    </motion.div>
  );
}'''
    )
    print("✅ Modal ajouté")

p.write_text(src, encoding="utf-8")
print("✅ Dashboard.tsx mis à jour avec succès !")
PY
