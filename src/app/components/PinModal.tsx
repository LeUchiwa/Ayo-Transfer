import { useState, useRef } from "react";
import { Lock, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  title?: string;
  description?: string;
}

export function PinModal({ isOpen, onClose, onSubmit, title = "Code PIN", description = "Entrez votre code à 4 chiffres" }: Props) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const pinString = pin.join("");
    if (pinString.length !== 4) return;
    
    setIsLoading(true);
    try {
      await onSubmit(pinString);
      setPin(["", "", "", ""]);
    } catch (e) {
      setPin(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-teal-600">
            <Lock className="w-5 h-5" />
            <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 text-center mb-6">{description}</p>

        <div className="flex justify-center gap-3 mb-8">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
            />
          ))}
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={pin.join("").length !== 4 || isLoading}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmer"}
        </Button>
      </div>
    </div>
  );
}
