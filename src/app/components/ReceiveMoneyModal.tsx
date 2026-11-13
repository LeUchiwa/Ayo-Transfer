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
