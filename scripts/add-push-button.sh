#!/usr/bin/env bash
set -euo pipefail

NOTIF_FILE="src/app/pages/Notifications.tsx"
[[ -f "$NOTIF_FILE" ]] || { echo "❌ $NOTIF_FILE introuvable"; exit 1; }

cp "$NOTIF_FILE" "${NOTIF_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
echo "🔒 Backup fait"

NOTIF_FILE="$NOTIF_FILE" python3 <<'PY'
import os, sys, pathlib

p = pathlib.Path(os.environ["NOTIF_FILE"])
src = p.read_text(encoding="utf-8")
ops = []

# ── 1. Import useOneSignal + BellOff ──
old_import = 'import { notifyNotificationsChanged } from "../hooks/useUnreadNotificationsCount";'
new_import = old_import + '\nimport { useOneSignal } from "../hooks/useOneSignal";\nimport { BellOff } from "lucide-react";'
if "useOneSignal" not in src:
    if old_import not in src:
        print("ERR: import notifyNotificationsChanged introuvable"); sys.exit(2)
    src = src.replace(old_import, new_import, 1)
    ops.append("import")

# ── 2. Hook dans le composant ──
old_hook = '  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);'
new_hook = old_hook + '\n  const { ready: pushReady, permission: pushPermission, requestPermission } = useOneSignal();'
if "useOneSignal()" not in src or "requestPermission" not in src:
    if old_hook not in src:
        print("ERR: useState lastUpdated introuvable"); sys.exit(2)
    src = src.replace(old_hook, new_hook, 1)
    ops.append("hook")

# ── 3. Bouton dans le header ──
old_header = '''        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            <Bell className="w-3 h-3 mr-1" />
            {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
          </Badge>'''

new_header = '''        <div className="flex items-center gap-2 flex-wrap">
          {pushReady && !pushPermission && (
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                const ok = await requestPermission();
                if (ok) toast.success("Notifications push activées !");
                else toast.error("Permission refusée");
              }}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Bell className="w-4 h-4" />
              Activer les notifications
            </Button>
          )}
          {pushReady && pushPermission && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <Bell className="w-3 h-3 mr-1" />
              Push activées
            </Badge>
          )}
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            <Bell className="w-3 h-3 mr-1" />
            {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
          </Badge>'''

if pushReady_marker := "Activer les notifications" in src:
    print("SKIP: bouton déjà présent")
elif old_header not in src:
    print("ERR: bloc header introuvable"); sys.exit(2)
else:
    src = src.replace(old_header, new_header, 1)
    ops.append("bouton")

p.write_text(src, encoding="utf-8")
print("OK: " + " | ".join(ops) if ops else "SKIP: rien à faire")
PY

echo ""
echo "─── Vérifs ───"
echo "Import useOneSignal   : $(grep -c 'useOneSignal' "$NOTIF_FILE") occurrences (doit être 2)"
echo "Hook appelé           : $(grep -c 'requestPermission' "$NOTIF_FILE") occurrences"
echo "Bouton Activer        : $(grep -c 'Activer les notifications' "$NOTIF_FILE") (doit être 1)"
echo "Balance accolades     : { $(grep -o '{' "$NOTIF_FILE" | wc -l) / } $(grep -o '}' "$NOTIF_FILE" | wc -l)"
