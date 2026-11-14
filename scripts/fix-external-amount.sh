#!/usr/bin/env bash
set -euo pipefail

# ═══ 1. Backend ═══
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.extamt"

python3 <<'PY'
import pathlib

p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

# On change la signature : on attend amountFCFA au lieu de amountLocal
old_block = '''  const body = await req.json();
  const { amountLocal, currency, country, method, destinationName, destinationPhone, pin, reference } = body;

  if (!amountLocal || !currency || !country || !method || !destinationName || !destinationPhone || !reference) {
    return Response.json({ error: "missing_fields", message: "Tous les champs sont requis." }, { status: 400, headers: corsHeaders });
  }'''

new_block = '''  const body = await req.json();
  const { amountFCFA, currency, country, method, destinationName, destinationPhone, pin, reference } = body;

  if (!amountFCFA || !currency || !country || !method || !destinationName || !destinationPhone || !reference) {
    return Response.json({ error: "missing_fields", message: "Tous les champs sont requis." }, { status: 400, headers: corsHeaders });
  }'''

if old_block in src:
    src = src.replace(old_block, new_block, 1)
    print("✅ Signature mise à jour (amountFCFA)")

# On change le calcul : on reçoit en FCFA, on convertit vers la devise locale
old_calc = '''  const transferFeeRate = typeof settings.transferFee === "number" ? settings.transferFee / 100 : 0.01;
  const amountFCFA = Math.ceil(Number(amountLocal) * rate);
  const fee = Math.ceil(amountFCFA * transferFeeRate);
  const totalDebit = amountFCFA + fee;'''

new_calc = '''  const transferFeeRate = typeof settings.transferFee === "number" ? settings.transferFee / 100 : 0.01;
  const amountFCFAVal = Number(amountFCFA);
  const amountLocal = Math.floor(amountFCFAVal / rate); // Inversion : FCFA → devise locale
  const fee = Math.ceil(amountFCFAVal * transferFeeRate);
  const totalDebit = amountFCFAVal + fee;'''

if old_calc in src:
    src = src.replace(old_calc, new_calc, 1)
    print("✅ Calcul inversé (FCFA → local)")

# On met à jour le stockage
old_store = '''    amountLocal: Number(amountLocal),
    currency,'''
new_store = '''    amountLocal: amountLocal,
    amountFCFA: amountFCFAVal,
    currency,'''

if old_store in src:
    src = src.replace(old_store, new_store, 1)
    print("✅ Stockage mis à jour")

p.write_text(src, encoding="utf-8")
PY

# ═══ 2. Frontend : Formulaire ═══
FORM_FILE="src/app/pages/ExternalTransfer.tsx"
cp "$FORM_FILE" "${FORM_FILE}.bak.extamt"

python3 <<'PY'
import pathlib

p = pathlib.Path("src/app/pages/ExternalTransfer.tsx")
src = p.read_text(encoding="utf-8")

# Inverser les calculs
old_calc = '''  const amountFCFA = Math.ceil(Number(amount) * country.rate);
  const fee = Math.ceil(amountFCFA * 0.01);
  const totalDebit = amountFCFA + fee;'''

new_calc = '''  const amountFCFA = Number(amount);
  const amountLocal = country.rate > 0 ? Math.floor(amountFCFA / country.rate) : 0;
  const fee = Math.ceil(amountFCFA * 0.01);
  const totalDebit = amountFCFA + fee;'''

if old_calc in src:
    src = src.replace(old_calc, new_calc, 1)
    print("✅ Calculs frontend inversés")

# Renommer le champ "Montant en {currency}" par "Montant à envoyer (FCFA)"
old_label = '''<Label>Montant en {country.currency}</Label>
              <Input type="number" placeholder="Ex: 10000" value={amount} onChange={e => setAmount(e.target.value)} required />
              {Number(amount) > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Équivalent : <strong>{amountFCFA.toLocaleString()} FCFA</strong> + frais ({fee.toLocaleString()} FCFA)
                </p>
              )}'''

new_label = '''<Label>Montant à envoyer (FCFA)</Label>
              <Input type="number" placeholder="Ex: 50000" value={amount} onChange={e => setAmount(e.target.value)} required />
              {Number(amount) > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Solde disponible : <strong>{stats.balance.toLocaleString()} FCFA</strong>
                </p>
              )}'''

if old_label in src:
    src = src.replace(old_label, new_label, 1)
    print("✅ Label changé en FCFA")

# Remplacer le récap
old_recap = '''                <div className="flex justify-between"><span>Montant reçu par le destinataire</span><strong>{Number(amount).toLocaleString()} {country.currency}</strong></div>
                <div className="flex justify-between"><span>Équivalent FCFA</span><strong>{amountFCFA.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between"><span>Frais AYO</span><strong>{fee.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between border-t border-teal-200 pt-2 mt-2"><span className="font-semibold">Total débité</span><span className="font-bold text-teal-700">{totalDebit.toLocaleString()} FCFA</span></div>'''

new_recap = '''                <div className="flex justify-between"><span>Vous envoyez</span><strong>{amountFCFA.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between"><span>Frais AYO (1%)</span><strong>{fee.toLocaleString()} FCFA</strong></div>
                <div className="flex justify-between border-t border-teal-200 pt-2 mt-2"><span className="font-semibold">Total débité de votre solde</span><span className="font-bold text-teal-700">{totalDebit.toLocaleString()} FCFA</span></div>
                <div className="flex justify-between bg-teal-100/50 -mx-2 px-2 py-2 rounded mt-2">
                  <span className="font-semibold">🎁 Le destinataire reçoit</span>
                  <span className="font-bold text-teal-700">{amountLocal.toLocaleString()} {country.currency}</span>
                </div>'''

if old_recap in src:
    src = src.replace(old_recap, new_recap, 1)
    print("✅ Récapitulatif refait (FCFA → local)")

# Corriger l'appel API : envoyer amountFCFA au lieu de amountLocal
old_api = '''      await walletApi.createExternalTransfer({
        amountLocal: Number(amount),
        currency: country.currency,'''

new_api = '''      await walletApi.createExternalTransfer({
        amountFCFA: Number(amount),
        currency: country.currency,'''

if old_api in src:
    src = src.replace(old_api, new_api, 1)
    print("✅ Appel API corrigé (amountFCFA)")

# Corriger le modal PIN (description)
old_pin = '''description={`Envoyer ${Number(amount).toLocaleString()} ${country.currency} à ${destinationName}`}'''
new_pin = '''description={`Envoyer ${Number(amount).toLocaleString()} FCFA à ${destinationName}`}'''
if old_pin in src:
    src = src.replace(old_pin, new_pin, 1)

p.write_text(src, encoding="utf-8")
PY

# ═══ 3. Type API ═══
API_FILE="utils/api.ts"
python3 <<'PY'
import pathlib
p = pathlib.Path("utils/api.ts")
src = p.read_text(encoding="utf-8")

old = '''  createExternalTransfer: (data: {
    amountLocal: number;
    currency: string;
    country: string;
    method: string;
    destinationName: string;
    destinationPhone: string;
    pin?: string;
    reference: string;
  }) => apiCall('/wallet/external-transfer', { method: 'POST', body: data }),'''

new = '''  createExternalTransfer: (data: {
    amountFCFA: number;
    currency: string;
    country: string;
    method: string;
    destinationName: string;
    destinationPhone: string;
    pin?: string;
    reference: string;
  }) => apiCall('/wallet/external-transfer', { method: 'POST', body: data }),'''

if old in src:
    src = src.replace(old, new, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Type API corrigé")
PY

echo "✅ Correction terminée."
