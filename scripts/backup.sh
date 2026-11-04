#!/bin/bash
set -e

cd "$(dirname "$0")/.."

TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="backups/${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "🔄 Backup AYO — $TIMESTAMP"
echo ""

if [ -f .env.backup ]; then
  source .env.backup
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ SUPABASE_DB_URL non défini dans .env.backup"
  echo ""
  echo "Créez un fichier .env.backup avec :"
  echo "  SUPABASE_DB_URL='postgresql://postgres:VOTRE_MDP@db.dxmmpdtdjmqqapjssmmd.supabase.co:5432/postgres'"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump non installé. Faites :"
  echo "  brew install libpq && brew link --force libpq"
  exit 1
fi

echo "📊 Backup kv_store_ef5daa28..."
pg_dump "$SUPABASE_DB_URL" --data-only --table=public.kv_store_ef5daa28 \
  --file="$BACKUP_DIR/kv_store_${TIMESTAMP}.sql"
echo "✅ kv_store_ef5daa28 ($(du -h "$BACKUP_DIR/kv_store_${TIMESTAMP}.sql" | cut -f1))"

echo ""
echo "📊 Backup auth.users..."
pg_dump "$SUPABASE_DB_URL" --data-only --table=auth.users \
  --file="$BACKUP_DIR/auth_users_${TIMESTAMP}.sql"
echo "✅ auth.users ($(du -h "$BACKUP_DIR/auth_users_${TIMESTAMP}.sql" | cut -f1))"

echo ""
echo "🎉 Backup complet : $BACKUP_DIR"
echo ""
echo "⚠️  IMPORTANT :"
echo "   1. Uploadez $BACKUP_DIR sur Google Drive / iCloud"
echo "   2. Supprimez le dossier local après upload :"
echo "      rm -rf $BACKUP_DIR"
