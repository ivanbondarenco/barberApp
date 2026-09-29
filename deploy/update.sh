#!/bin/sh
# Publica la última versión: backup, baja el código, recompila y reinicia.
#
#   /opt/barberapp/deploy/update.sh
#
# Si algo sale mal, la versión anterior sigue en git: `git checkout <commit>` y volvé a correrlo.
set -eu
cd "$(dirname "$0")/.."

# Antes de tocar nada, una copia de la base: la versión nueva puede traer migraciones.
if docker compose ps --status running --services 2>/dev/null | grep -qx app; then
  ./deploy/backup.sh
fi

git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null

# La app tarda unos segundos en levantar. Si falta configuración, no arranca y el log dice qué.
echo "Esperando a que la app responda..."
for _ in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "Listo: la app está arriba."
    exit 0
  fi
  sleep 2
done
echo "La app no respondió. Mirá qué pasó con:  docker compose logs app --tail 50"
exit 1
