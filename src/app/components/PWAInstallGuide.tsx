import { Share, Plus, X } from "lucide-react";
import { Button } from "./ui/button";

export function PWAInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Installer AYO sur iPhone</h3>
            <p className="text-sm text-muted-foreground mt-1">Suivez ces étapes dans Safari</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">1</span>
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1">Appuyez sur <Share className="w-4 h-4 text-primary" /> en bas</p>
              <p className="text-xs text-muted-foreground">L'icône de partage de Safari</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">2</span>
            <p className="text-sm font-medium text-foreground flex items-center gap-1">Choisissez <Plus className="w-4 h-4 text-primary" /> "Sur l'écran d'accueil"</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">3</span>
            <p className="text-sm font-medium text-foreground">Appuyez sur "Ajouter"</p>
          </li>
        </ol>
        <Button onClick={onClose} className="w-full mt-6 bg-primary hover:bg-primary/90 text-white">Compris</Button>
      </div>
    </div>
  );
}
