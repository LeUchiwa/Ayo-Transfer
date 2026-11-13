#!/usr/bin/env bash
set -euo pipefail

# 1. Créer le composant ReceiveMoneyModal.tsx
cat > src/app/components/ReceiveMoneyModal.tsx <<'EOF'
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle, X, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function ReceiveMoneyModal({ isOpen, onClose, userId, userName }: Props) {
  const [copied, setCopied] = useState(false);
  
  if (!isOpen) return null;

  // On génère l'URL de paiement basée sur l'origine actuelle (localhost ou prod)
  const payUrl = `${window.location.origin}/pay/${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(payUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payer ${userName} sur AYO`,
          text: `Cliquez sur ce lien pour me payer via AYO Transfer.`,
          url: payUrl,
        });
      } catch (err) {
        console.log("Partage annulé");
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl text-gray-900">Recevoir de l'argent</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-4">Faites scanner ce code à votre client pour être payé instantanément.</p>
          
          <div className="bg-white p-4 rounded-2xl border-2 border-teal-100 inline-block shadow-sm">
            <QRCodeSVG 
              value={payUrl} 
              size={200}
              bgColor={"#ffffff"}
              fgColor={"#0f766e"} // Teal 700
              level={"H"}
              includeMargin={false}
            />
          </div>
          
          <p className="font-semibold text-gray-900 mt-4">{userName}</p>
          <p className="text-xs text-teal-600 font-medium">Compte vérifié AYO</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <input 
              type="text" 
              readOnly 
              value={payUrl} 
              className="flex-1 bg-transparent text-xs text-gray-600 outline-none truncate"
            />
            <button 
              onClick={handleCopy}
              className="p-2 bg-white rounded-lg shadow-sm text-teal-600 hover:text-teal-700"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <Button onClick={handleShare} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 gap-2">
            <Share2 className="w-4 h-4" /> Partager le lien
          </Button>
        </div>
      </div>
    </div>
  );
}
EOF

# 2. Intégrer dans Dashboard.tsx
python3 <<'PY'
import pathlib, re
p = pathlib.Path("src/app/pages/Dashboard.tsx")
src = p.read_text(encoding="utf-8")

# Ajouter l'import
if "ReceiveMoneyModal" not in src:
    src = src.replace('import { WelcomeRotator } from "../components/WelcomeRotator";', 'import { WelcomeRotator } from "../components/WelcomeRotator";\nimport { ReceiveMoneyModal } from "../components/ReceiveMoneyModal";\nimport { QrCode } from "lucide-react";')

# Ajouter l'état
if "showReceiveModal" not in src:
    src = src.replace('const [showBalance, setShowBalance] = useState(true);', 'const [showBalance, setShowBalance] = useState(true);\n  const [showReceiveModal, setShowReceiveModal] = useState(false);')

# Ajouter le bouton dans la grille d'actions rapides
# On va modifier la grille de 4 colonnes en 5 colonnes
src = src.replace('className="grid grid-cols-2 md:grid-cols-4 gap-3"', 'className="grid grid-cols-2 md:grid-cols-5 gap-3"')

# Insérer le bouton "Recevoir" après le bouton "Envoyer"
anchor = '''        <Link to="/transfer">
          <Card className="bg-white hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Envoyer</p>
            </CardContent>
          </Card>
        </Link>'''

new_actions = anchor + '''
        
        <button onClick={() => setShowReceiveModal(true)} className="w-full text-left">
          <Card className="bg-white hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer border-border/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-teal-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Recevoir</p>
            </CardContent>
          </Card>
        </button>'''

if "Recevoir" not in src:
    src = src.replace(anchor, new_actions, 1)

# Ajouter le modal à la fin du composant (avant la dernière accolade)
if "<ReceiveMoneyModal" not in src:
    # On cherche la dernière balise </motion.div> avant la fermeture
    src = src.replace('    </motion.div>\n  );\n}', '''      <ReceiveMoneyModal 
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        userId={user?.id || ""}
        userName={user?.name || "Mon compte"}
      />
    </motion.div>
  );
}''')

p.write_text(src, encoding="utf-8")
print("✅ Dashboard mis à jour avec le bouton Recevoir et le Modal QR Code")
PY
