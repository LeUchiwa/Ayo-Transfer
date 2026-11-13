#!/usr/bin/env bash
set -euo pipefail

# 1. Mise à jour de Profile.tsx
PROFILE_FILE="src/app/pages/Profile.tsx"
cp "$PROFILE_FILE" "${PROFILE_FILE}.bak.pin"
PROFILE_FILE="$PROFILE_FILE" python3 <<'PY'
import os, pathlib, sys
p = pathlib.Path(os.environ["PROFILE_FILE"])
src = p.read_text(encoding="utf-8")

# Ajout des imports
if "PinModal" not in src:
    src = src.replace('import { useAuth } from "../contexts/AuthContext";', 'import { useAuth } from "../contexts/AuthContext";\nimport { PinModal } from "../components/PinModal";\nimport { walletApi } from "../../../utils/api";\nimport { Lock } from "lucide-react";')
    src = src.replace('import { toast } from "sonner";', 'import { toast } from "sonner";')

# Ajout des états et useEffect (chercher une ligne connue dans Profile)
anchor_state = "export function Profile() {"
if "hasPin" not in src:
    src = src.replace(anchor_state, anchor_state + '''
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);
  }, []);
''', 1)

# Ajout de la carte dans le JSX (avant la dernière fermeture de div ou dans une grille)
# On l'insère juste avant le bouton de déconnexion ou à la fin
anchor_jsx = "  );"
card_jsx = '''
        <Card className="mt-6 border-teal-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${hasPin ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Code PIN de sécurité</p>
                <p className="text-sm text-gray-500">{hasPin ? "Activé" : "Non configuré (recommandé)"}</p>
              </div>
            </div>
            <Button onClick={() => setShowPinModal(true)} variant={hasPin ? "outline" : "default"} className={!hasPin ? "bg-teal-600 text-white" : ""}>
              {hasPin ? "Modifier" : "Configurer"}
            </Button>
          </CardContent>
        </Card>

        <PinModal 
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          title="Configurer le PIN"
          description="Choisissez un code à 4 chiffres pour sécuriser vos transferts."
          onSubmit={async (pin) => {
            await walletApi.setPin(pin);
            setHasPin(true);
            setShowPinModal(false);
            toast.success("Code PIN configuré avec succès !");
          }}
        />
'''
if "Code PIN de sécurité" not in src:
    src = src.replace(anchor_jsx, card_jsx + anchor_jsx, 1)

p.write_text(src, encoding="utf-8")
print("✅ Profile.tsx mis à jour")
PY

# 2. Mise à jour de Transfer.tsx
TRANSFER_FILE="src/app/pages/Transfer.tsx"
cp "$TRANSFER_FILE" "${TRANSFER_FILE}.bak.pin"
TRANSFER_FILE="$TRANSFER_FILE" python3 <<'PY'
import os, pathlib, sys
p = pathlib.Path(os.environ["TRANSFER_FILE"])
src = p.read_text(encoding="utf-8")

# Imports
if "PinModal" not in src:
    src = src.replace('import { useWallet } from "../contexts/WalletContext";', 'import { useWallet } from "../contexts/WalletContext";\nimport { PinModal } from "../components/PinModal";\nimport { walletApi } from "../../../utils/api";')

# État
anchor_state = "const [isSubmitting, setIsSubmitting] = useState(false);"
if "hasPin" not in src:
    src = src.replace(anchor_state, anchor_state + '''
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTxData, setPendingTxData] = useState<any>(null);
''', 1)
    
    # useEffect
    anchor_effect = "const fee = useMemo(() => {"
    src = src.replace(anchor_effect, '''  useEffect(() => {
    walletApi.getPinStatus().then(res => setHasPin(res.hasPin)).catch(console.error);
  }, []);

  const fee = useMemo(() => {''', 1)

# Modifier handleSubmit
old_submit = "const handleSubmit = async (e: React.FormEvent) => {"
new_submit = "const handleSubmit = async (e: React.FormEvent) => {"
if "await executeTransfer" not in src:
    # On renomme la fonction existante
    src = src.replace("const handleSubmit = async (e: React.FormEvent) => {", "const executeTransfer = async (pin?: string) => {\n    e.preventDefault();", 1) # Attention, e n'existe plus
    # Mieux vaut juste ajouter un wrapper propre
    pass

# Approche plus propre pour handleSubmit :
old_handle = '''  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (amount <= 0) {
      toast.error("Montant invalide", { description: "Le montant doit être supérieur à 0" });
      return;
    }

    if (!formData.recipientEmail || !formData.recipientEmail.includes("@")) {
      toast.error("Email invalide", { description: "Veuillez entrer l'email du destinataire AYO." });
      return;
    }

    const hasSufficientBalance = await checkBalance(amount, fee);
    if (!hasSufficientBalance) {
      toast.error("Solde insuffisant", {
        description: `Solde disponible: ${stats.balance.toLocaleString()} FCFA, Requis: ${totalDebit.toLocaleString()} FCFA`,
      });
      return;
    }

    setIsSubmitting(true);'''

new_handle = '''  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (amount <= 0) {
      toast.error("Montant invalide", { description: "Le montant doit être supérieur à 0" });
      return;
    }

    if (!formData.recipientEmail || !formData.recipientEmail.includes("@")) {
      toast.error("Email invalide", { description: "Veuillez entrer l'email du destinataire AYO." });
      return;
    }

    const hasSufficientBalance = await checkBalance(amount, fee);
    if (!hasSufficientBalance) {
      toast.error("Solde insuffisant", {
        description: `Solde disponible: ${stats.balance.toLocaleString()} FCFA, Requis: ${totalDebit.toLocaleString()} FCFA`,
      });
      return;
    }

    if (hasPin) {
      setShowPinModal(true);
      return;
    }

    await executeTransfer();
  };

  const executeTransfer = async (pin?: string) => {
    const amount = Number(formData.amount);
    setIsSubmitting(true);'''

if old_handle in src:
    src = src.replace(old_handle, new_handle, 1)
    # Mettre à jour l'appel à addTransfer pour inclure le PIN
    old_add = "await addTransfer(\n        amount,\n        formData.recipientEmail,\n        \"AYO Wallet\",\n        \"💸\",\n        formData.phone,\n        ref,\n        fee\n      );"
    new_add = "await addTransfer(\n        amount,\n        formData.recipientEmail,\n        \"AYO Wallet\",\n        \"💸\",\n        formData.phone,\n        ref,\n        fee,\n        pin\n      );"
    if old_add in src:
        src = src.replace(old_add, new_add, 1)

# Ajout du Modal dans le JSX
anchor_jsx = "    </motion.div>\n  );\n}"
modal_jsx = '''
      <PinModal 
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        title="Confirmer le transfert"
        description={`Envoyer ${formData.amount} FCFA à ${formData.recipientEmail}`}
        onSubmit={async (pin) => {
          await executeTransfer(pin);
          setShowPinModal(false);
        }}
      />
    </motion.div>
  );
}'''
if "Confirmer le transfert" not in src:
    src = src.replace(anchor_jsx, modal_jsx, 1)

p.write_text(src, encoding="utf-8")
print("✅ Transfer.tsx mis à jour")
PY
echo "✅ Interface intégrée !"
