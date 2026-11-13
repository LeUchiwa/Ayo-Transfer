#!/usr/bin/env bash
set -euo pipefail

# 1. Mise à jour de utils/api.ts
API_FILE="utils/api.ts"
cp "$API_FILE" "${API_FILE}.bak.pin"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")

if "getPinStatus" not in src:
    methods = '''
  // ═══ SÉCURITÉ PIN ═══
  getPinStatus: async (): Promise<{ hasPin: boolean }> => {
    return await apiCall('/profile/pin');
  },
  setPin: async (pin: string): Promise<{ success: boolean }> => {
    return await apiCall('/profile/pin', { method: 'POST', body: { pin } });
  },
'''
    anchor = "  getBeneficiaries: async (): Promise<Beneficiary[]> => {"
    src = src.replace(anchor, methods + anchor, 1)

# Mettre à jour la signature de createTransfer
old_transfer = "phone: string; reference: string; fee: number;\n  }) => apiCall('/wallet/transfer'"
new_transfer = "phone: string; reference: string; fee: number; pin?: string;\n  }) => apiCall('/wallet/transfer'"
if old_transfer in src:
    src = src.replace(old_transfer, new_transfer, 1)

p.write_text(src, encoding="utf-8")
print("✅ utils/api.ts mis à jour")
PY

# 2. Mise à jour de WalletContext.tsx
CTX_FILE="src/app/contexts/WalletContext.tsx"
cp "$CTX_FILE" "${CTX_FILE}.bak.pin"
python3 <<'PY'
import pathlib
p = pathlib.Path("src/app/contexts/WalletContext.tsx")
src = p.read_text(encoding="utf-8")

# Type de addTransfer
old_type = "addTransfer: (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number) => Promise<void>;"
new_type = "addTransfer: (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number, pin?: string) => Promise<void>;"
if old_type in src:
    src = src.replace(old_type, new_type, 1)

# Implémentation de addTransfer
old_impl = "const addTransfer = async (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number) => {"
new_impl = "const addTransfer = async (amount: number, recipient: string, method: string, methodIcon: string, phone: string, reference: string, fee: number, pin?: string) => {"
if old_impl in src:
    src = src.replace(old_impl, new_impl, 1)

# Appel API
old_api = "const result = await walletApi.createTransfer({ amount, recipient, method, methodIcon, phone, reference, fee });"
new_api = "const result = await walletApi.createTransfer({ amount, recipient, method, methodIcon, phone, reference, fee, pin });"
if old_api in src:
    src = src.replace(old_api, new_api, 1)

p.write_text(src, encoding="utf-8")
print("✅ WalletContext.tsx mis à jour")
PY
echo "✅ Frontend (API & Context) prêt !"
