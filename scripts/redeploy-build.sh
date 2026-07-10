#!/usr/bin/env bash
# Deploy Nerdubbio su cocoon via git pull.
# Primo setup: bash scripts/deploy-cocoon.sh
# Deploy successivi: bash scripts/redeploy-build.sh
set -euo pipefail

APP=/var/www/demos/nerdubbio
REPO="${NB_GIT_REPO:-https://github.com/Marco2809/Nerdubbio.git}"
BRANCH="${NB_GIT_BRANCH:-master}"

backup_secrets() {
  cp "$APP/api/config.php" /tmp/nb-config.php.bak 2>/dev/null || true
  cp "$APP/.env" /tmp/nb-env.bak 2>/dev/null || true
}

restore_secrets() {
  cp /tmp/nb-config.php.bak "$APP/api/config.php" 2>/dev/null || true
  cp /tmp/nb-env.bak "$APP/.env" 2>/dev/null || true
  chmod 644 "$APP/api/config.php" 2>/dev/null || true
}

run_migrations() {
  cd "$APP"
  mysql -u root nerdubbio < api/schema.sql 2>/dev/null || true
  for f in api/schema-phase*.sql; do
    [ -f "$f" ] || continue
    mysql -u root nerdubbio < "$f" 2>/dev/null && echo "migrated:$f" || true
  done
  # Cartella upload immagini commenti: scrivibile dal web server.
  mkdir -p "$APP/api/uploads"
  chown -R www-data:www-data "$APP/api/uploads" 2>/dev/null || true
  chmod 775 "$APP/api/uploads" 2>/dev/null || true
}

verify_assets() {
  cd "$APP"
  local manifest
  manifest=$(ls .output/server/_tanstack-start-manifest_v-*.mjs 2>/dev/null | head -1)
  if [ -z "$manifest" ]; then
    echo "ERRORE: manifest SSR mancante"
    return 1
  fi
  local missing=0
  while IFS= read -r asset; do
    local path=".output/public${asset}"
    if [ ! -f "$path" ]; then
      echo "MANCANTE: $path"
      missing=$((missing + 1))
    fi
  done < <(grep -oE '"/assets/[^"]+"' "$manifest" | tr -d '"' | sort -u)
  for static in manifest.webmanifest favicon.svg favicon.png apple-touch-icon.png icon-192.png icon-512.png; do
    if [ ! -f ".output/public/$static" ]; then
      echo "MANCANTE: .output/public/$static"
      missing=$((missing + 1))
    fi
  done
  if [ "$missing" -gt 0 ]; then
    echo "ERRORE: $missing asset mancanti"
    return 1
  fi
  echo "verify_assets: ok"
}

build_and_start() {
  cd "$APP"
  rm -rf node_modules/.vite
  npm install
  echo "==> Build (scratch .output — .output.live resta servita)"
  if ! npm run build; then
    echo "ERRORE: build fallito — nessun downtime, .output.live intatto"
    exit 1
  fi
  if ! verify_assets; then
    echo "ERRORE: verifica asset fallita — .output.live intatto"
    exit 1
  fi
  echo "==> Pubblico build (.output -> .output.live)"
  rm -rf .output.live.new .output.live.old
  cp -a .output .output.live.new
  [ -d .output.live ] && mv .output.live .output.live.old
  mv .output.live.new .output.live
  rm -rf .output.live.old
  set -a; [ -f .env ] && . ./.env; set +a
  if pm2 describe nerdubbio 2>/dev/null | grep -q "\.output\.live/server/index\.mjs"; then
    pm2 reload nerdubbio --update-env
  else
    echo "==> Ripunto pm2 a .output.live"
    pm2 delete nerdubbio >/dev/null 2>&1 || true
    PORT=3002 pm2 start "$APP/.output.live/server/index.mjs" --name nerdubbio --update-env
  fi
  pm2 save
  sleep 1
  curl -s -o /dev/null -w "node:%{http_code}\n" http://127.0.0.1:3002/
  echo "BUILD_OK"
}

if [ ! -d "$APP/.git" ]; then
  echo "==> Primo deploy: esegui scripts/deploy-cocoon.sh"
  exit 1
fi

backup_secrets

echo "==> git pull ($BRANCH)"
cd "$APP"
# File generati/auto-modificati dalla build: scartali per evitare che il pull
# si blocchi con "local changes would be overwritten". Vengono rigenerati.
git checkout -- src/routeTree.gen.ts package-lock.json 2>/dev/null || true
git pull origin "$BRANCH"

restore_secrets
run_migrations
build_and_start
