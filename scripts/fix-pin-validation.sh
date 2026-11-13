#!/usr/bin/env bash
set -euo pipefail

# 1. Fix Transfer.tsx
TRANSFER_FILE="src/app/pages/Transfer.tsx"
cp "$TRANSFER_FILE" "${TRANSFER_FILE}.bak.pinval"
TRANSFER_FILE="$TRANSFER_FILE" python3 <<'PY'
import os, pathlib
p = pathlib.Path(os.environ["TRANSFER_FILE"])
src = p.read_text(encoding="utf-8")

# Rendre l'erreur "throw" pour que le modal la capte
old_catch = '''    } catch (error) {
      toast.error("Échec du transfert", {
        description: error instanceof Error ? error.message : "Une erreur s'est produite",
      });
    } finally {'''

new_catch = '''    } catch (error) {
      toast.error("Échec du transfert", {
        description: error instanceof Error ? error.message : "Une erreur s'est produite",
      });
      throw error; // ⬅️ Crucial : le modal reçoit l'erreur et reste ouvert
    } finally {'''

if old_catch in src:
    src = src.replace(old_catch, new_catch, 1)
    print("✅ Transfer.tsx : l'erreur est maintenant transmise au modal.")

# Empêcher le modal de se fermer en cas d'erreur
old_on_submit = '''        onSubmit={async (pin) => {
          await executeTransfer(pin);
          setShowPinModal(false);
        }}'''
new_on_submit = '''        onSubmit={async (pin) => {
          try {
            await executeTransfer(pin);
            setShowPinModal(false);
          } catch (e) {
            // L'erreur est déjà affichée par le toast, on garde le modal ouvert
            console.log("Code PIN incorrect, le modal reste ouvert.");
          }
        }}'''
if old_on_submit in src:
    src = src.replace(old_on_submit, new_on_submit, 1)
    print("✅ Transfer.tsx : le modal restera ouvert si le PIN est faux.")

p.write_text(src, encoding="utf-8")
PY

# 2. Fix Profile.tsx
PROFILE_FILE="src/app/pages/Profile.tsx"
cp "$PROFILE_FILE" "${PROFILE_FILE}.bak.pinval"
PROFILE_FILE="$PROFILE_FILE" python3 <<'PY'
import os, pathlib
p = pathlib.Path(os.environ["PROFILE_FILE"])
src = p.read_text(encoding="utf-8")

old_on_submit = '''        onSubmit={async (pin) => {
          await walletApi.setPin(pin);
          setHasPin(true);
          setShowPinModal(false);
          toast.success("Code PIN configuré avec succès !");
        }}'''

new_on_submit = '''        onSubmit={async (pin) => {
          try {
            await walletApi.setPin(pin);
            setHasPin(true);
            setShowPinModal(false);
            toast.success("Code PIN configuré avec succès !");
          } catch (error) {
            toast.error("Erreur", { description: (error as Error).message });
            throw error; // Garde le modal ouvert si la config échoue
          }
        }}'''

if old_on_submit in src:
    src = src.replace(old_on_submit, new_on_submit, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Profile.tsx : gestion des erreurs ajoutée.")
PY
echo "✅ Correction terminée."
