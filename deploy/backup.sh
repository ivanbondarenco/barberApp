#!/bin/sh
# Backup de la base: una copia con fecha dentro del volumen, otra en el disco del VPS y, si hay
# RCLONE_REMOTE, otra fuera del servidor. Pensado para cron (ver deploy/VPS.md, paso 8):
#
#   0 3 * * * /opt/barberapp/deploy/backup.sh >> /var/log/barberapp-backup.log 2>&1
#
# La app escribe la base con temporal + rename, así que la copia siempre es consistente.
set -eu
cd "$(dirname "$0")/.."

echo "== $(date -Iseconds) backup"

# 1) Copia con fecha dentro del volumen; rota y conserva las últimas BACKUP_KEEP.
docker compose exec -T app npm run --silent backup

# 2) Al disco del VPS, fuera de Docker: sobrevive aunque se borre el volumen por error.
rm -rf backups.tmp
docker compose cp app:/data/backups backups.tmp
rm -rf backups
mv backups.tmp backups

# 3) Fuera del VPS. Sin esto, si se pierde el servidor se pierden los backups con él.
remote=$(grep -E '^RCLONE_REMOTE=' .env.production | cut -d= -f2- | tr -d '"' || true)
if [ -n "$remote" ]; then
  rclone sync backups "$remote"
  echo "Copiado a $remote"
else
  echo "AVISO: sin RCLONE_REMOTE los backups quedan solo en este servidor."
fi
