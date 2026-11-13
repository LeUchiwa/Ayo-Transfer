#!/usr/bin/env bash
set -euo pipefail

echo "🛡️ Sécurisation du changement de code PIN..."

# 1. Backend
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.pinchg"
python3 <<'PY'
import pathlib
p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

start_idx = src.find("async function handleSetPin(req: Request, userId: string) {")
if start_idx == -1:
    print("❌ handleSetPin introuvable")
    exit(1)

# Trouver la fin de la fonction (la première accolade fermante suivie d'un retour à la ligne)
end_idx = src.find("\n}", start_idx)
if end_idx == -1:
    print("❌ Fin de handleSetPin introuvable")
    exit(1)
end_idx += 2

new_func = """async function handleSetPin(req: Request, userId: string) {
  const body = await req.json().catch(() => ({}));
  const { pin, currentPin } = body;

  if (!pin || !/^\\d{4}$/.test(pin)) {
    return Response.json({ error: "Le nouveau code PIN doit contenir exactement 4 chiffres." }, { status: 400, headers: corsHeaders });
  }

  const existingPin = await kv.get(`pin:${userId}`);
  
  if (existingPin) {
    if (!currentPin) {
      return Response.json({ error: "L'ancien code PIN est requis." }, { status: 400, headers: corsHeaders });
    }
    const isCurrentValid = await verifyPassword(currentPin, existingPin);
    if (!isCurrentValid) {
      return Response.json({ error: "Ancien code PIN incorrect." }, { status: 401, headers: corsHeaders });
    }
  }

  const hashedPin = await hashPassword(pin);
  await kv.set(`pin:${userId}`, hashedPin);

  return Response.json({ success: true }, { headers: corsHeaders });
}"""

src = src[:start_idx] + new_func + src[end_idx:]
p.write_text(src, encoding="utf-8")
print("✅ Backend handleSetPin sécurisé")
PY

# 2. API
API_FILE="utils/api.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")
old = "setPin: async (pin: string): Promise<{ success: boolean }> => {"
new = "setPin: async (pin: string, currentPin?: string): Promise<{ success: boolean }> => {"
if old in src:
    src = src.replace(old, new)
    src = src.replace("body: { pin } });", "body: { pin, currentPin } });")
    p.write_text(src, encoding="utf-8")
    print("✅ API setPin sécurisée")
else:
    print("⚠️ API setPin déjà modifiée ou introuvable")
PY

# 3. Profile.tsx
PROFILE_FILE="src/app/pages/Profile.tsx"
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/pages/Profile.tsx")
src = p.read_text(encoding="utf-8")
old_submit = """onSubmit={async (pin) => {
            await walletApi.setPin(pin);"""
new_submit = """onSubmit={async (pin, currentPin) => {
            await walletApi.setPin(pin, currentPin);"""
if old_submit in src:
    src = src.replace(old_submit, new_submit)

if 'isChanging={hasPin}' not in src:
    src = src.replace("isOpen={showPinModal}", "isOpen={showPinModal}\n          isChanging={hasPin}")

p.write_text(src, encoding="utf-8")
print("✅ Profile.tsx mis à jour (gère l'ancien PIN)")
PY

# 4. PinModal.tsx
cat > src/app/components/PinModal.tsx <<'EOF'
import { useState, useRef, useEffect } from "react";
import { Lock, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string, currentPin?: string) => Promise<void>;
  title?: string;
  description?: string;
  isChanging?: boolean;
}

export function PinModal({ isOpen, onClose, onSubmit, title = "Code PIN", description, isChanging = false }: Props) {
  const [step, setStep] = useState<"current" | "new">(isChanging ? "current" : "new");
  const [currentPin, setCurrentPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const currentRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep(isChanging ? "current" : "new");
      setCurrentPin(["", "", "", ""]);
      setNewPin(["", "", "", ""]);
    }
  }, [isOpen, isChanging]);

  if (!isOpen) return null;

  const handlePinChange = (index: number, value: string, pinState: string[], setPinState: any, refs: any) => {
    if (value.length > 1) return;
    const newArr = [...pinState];
    newArr[index] = value;
    setPinState(newArr);
    if (value && index < 3) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, pinState: string[], refs: any) => {
    if (e.key === "Backspace" && !pinState[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleNext = () => {
    if (currentPin.join("").length === 4) setStep("new");
  };

  const handleSubmit = async () => {
    const newPinStr = newPin.join("");
    if (newPinStr.length !== 4) return;
    
    setIsLoading(true);
    try {
      await onSubmit(newPinStr, isChanging ? currentPin.join("") : undefined);
      setCurrentPin(["", "", "", ""]);
      setNewPin(["", "", "", ""]);
    } catch (e) {
      setNewPin(["", "", "", ""]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputs = (pinState: string[], setPinState: any, refs: any) => (
    <div className="flex justify-center gap-3 mb-6">
      {pinState.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handlePinChange(i, e.target.value.replace(/\D/g, ""), pinState, setPinState, refs)}
          onKeyDown={(e) => handleKeyDown(i, e, pinState, refs)}
          className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-teal-600">
            <Lock className="w-5 h-5" />
            <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {step === "current" ? (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">Saisissez votre code PIN actuel</p>
            {renderInputs(currentPin, setCurrentPin, currentRefs)}
            <Button 
              onClick={handleNext} 
              disabled={currentPin.join("").length !== 4}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12"
            >
              Suivant
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">{description || "Choisissez un nouveau code à 4 chiffres"}</p>
            {renderInputs(newPin, setNewPin, newRefs)}
            <Button 
              onClick={handleSubmit} 
              disabled={newPin.join("").length !== 4 || isLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmer"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
EOF

echo "✅ Terminé !"
