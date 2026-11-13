#!/usr/bin/env bash
set -euo pipefail

# 1. utils/api.ts
API_FILE="utils/api.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")
if "pin?: string;" not in src:
    src = src.replace("fee: number;\n  }) => apiCall('/wallet/transfer'", "fee: number; pin?: string;\n  }) => apiCall('/wallet/transfer'")
    p.write_text(src, encoding="utf-8")
    print("✅ api.ts mis à jour (accepte le PIN)")
PY

# 2. WalletContext.tsx
CTX_FILE="src/app/contexts/WalletContext.tsx"
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/contexts/WalletContext.tsx")
src = p.read_text(encoding="utf-8")
if "pin?: string" not in src:
    src = src.replace("fee: number) => Promise<void>;", "fee: number, pin?: string) => Promise<void>;")
    src = src.replace("fee: number) => {", "fee: number, pin?: string) => {")
if "fee, pin }" not in src:
    src = src.replace("await walletApi.createTransfer({ amount, recipient, method, methodIcon, phone, reference, fee });", "await walletApi.createTransfer({ amount, recipient, method, methodIcon, phone, reference, fee, pin });")
p.write_text(src, encoding="utf-8")
print("✅ WalletContext.tsx mis à jour (transmet le PIN)")
PY

# 3. Transfer.tsx
TRANSFER_FILE="src/app/pages/Transfer.tsx"
python3 <<'PY'
import pathlib, re
p = pathlib.Path("src/app/pages/Transfer.tsx")
src = p.read_text(encoding="utf-8")

# On s'assure que executeTransfer reçoit le PIN et le passe à addTransfer
old_call = """await addTransfer(
        amount,
        formData.recipientEmail,
        "AYO Wallet",
        "💸",
        formData.phone,
        ref,
        fee
      );"""
new_call = """await addTransfer(
        amount,
        formData.recipientEmail,
        "AYO Wallet",
        "💸",
        formData.phone,
        ref,
        fee,
        pin
      );"""

if old_call in src:
    src = src.replace(old_call, new_call)
    print("✅ Transfer.tsx mis à jour (envoie le PIN à addTransfer)")
else:
    # Vérifier si c'est déjà sur une seule ligne
    old_one_line = "await addTransfer(amount, formData.recipientEmail, \"AYO Wallet\", \"💸\", formData.phone, ref, fee);"
    new_one_line = "await addTransfer(amount, formData.recipientEmail, \"AYO Wallet\", \"💸\", formData.phone, ref, fee, pin);"
    if old_one_line in src:
        src = src.replace(old_one_line, new_one_line)
        print("✅ Transfer.tsx mis à jour (ligne unique)")
    else:
        print("⚠️ Ligne addTransfer introuvable, vérification manuelle.")

p.write_text(src, encoding="utf-8")
PY
echo "✅ Script terminé !"
