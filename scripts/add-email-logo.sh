#!/usr/bin/env bash
set -euo pipefail

# ═══ 1. Copier le logo dans public/ pour le rendre accessible ═══
if [ ! -f "public/logo-email.png" ]; then
  if [ -f "src/imports/AYO.png" ]; then
    # Copier et compresser si ImageMagick est dispo
    if command -v convert >/dev/null; then
      convert src/imports/AYO.png -resize 200x200 -quality 90 public/logo-email.png
      echo "✅ Logo copié et compressé dans public/logo-email.png"
    else
      cp src/imports/AYO.png public/logo-email.png
      echo "✅ Logo copié dans public/logo-email.png (non compressé - installer ImageMagick pour optimiser)"
    fi
  else
    echo "⚠️ src/imports/AYO.png introuvable"
  fi
fi

# ═══ 2. Modifier le template d'email ═══
FUNCTION_FILE="supabase/functions/server/index.ts"
cp "$FUNCTION_FILE" "${FUNCTION_FILE}.bak.logo"

python3 <<'PY'
import pathlib

p = pathlib.Path("supabase/functions/server/index.ts")
src = p.read_text(encoding="utf-8")

old_template = '''function emailTemplate(title: string, content: string, buttonText?: string, buttonUrl?: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0fdfa;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#14b8a6 0%,#0891b2 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">AYO</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Transfert d'argent</p>
    </div>
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      ${content}
      ${buttonText && buttonUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${buttonUrl}" style="display:inline-block;background:#14b8a6;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${buttonText}</a></div>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">Cet email a été envoyé par AYO. Contact : contact@ayo-transfer.com</p>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">© 2026 AYO Transfer</p>
  </div>
</body>
</html>
  `.trim();
}'''

new_template = '''const EMAIL_LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") || "https://ayo-transfer.pages.dev/logo-email.png";

function emailTemplate(title: string, content: string, buttonText?: string, buttonUrl?: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0fdfa;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#14b8a6 0%,#0891b2 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <img src="${EMAIL_LOGO_URL}" alt="AYO Transfert d'argent" width="80" height="80" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;max-width:80px;height:auto;" />
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;">AYO</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Transfert d'argent</p>
    </div>
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      ${content}
      ${buttonText && buttonUrl ? `<div style="text-align:center;margin:32px 0;"><a href="${buttonUrl}" style="display:inline-block;background:#14b8a6;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${buttonText}</a></div>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
        Cet email a été envoyé par <strong>AYO</strong>.<br>
        Contact : <a href="mailto:contact@ayo-transfer.com" style="color:#14b8a6;text-decoration:none;">contact@ayo-transfer.com</a>
      </p>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">© 2026 AYO Transfer · Tous droits réservés</p>
  </div>
</body>
</html>
  `.trim();
}'''

if old_template in src:
    src = src.replace(old_template, new_template, 1)
    p.write_text(src, encoding="utf-8")
    print("✅ Template d'email modifié avec logo")
else:
    print("⚠️ Template introuvable, vérification manuelle nécessaire")
PY
