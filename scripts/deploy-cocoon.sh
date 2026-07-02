#!/bin/bash
set -euo pipefail
APP_DIR=/var/www/demos/nerdubbio
REPO=https://github.com/Marco2809/Nerdubbio.git

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin master
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

DBPASS=$(openssl rand -hex 16)
JWT=$(openssl rand -hex 32)
mysql -u root < api/schema.sql
mysql -u root -e "CREATE USER IF NOT EXISTS 'nerdubbio_user'@'localhost' IDENTIFIED BY '${DBPASS}'; GRANT SELECT, INSERT, UPDATE, DELETE ON nerdubbio.* TO 'nerdubbio_user'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || \
mysql -u root -e "ALTER USER 'nerdubbio_user'@'localhost' IDENTIFIED BY '${DBPASS}'; GRANT SELECT, INSERT, UPDATE, DELETE ON nerdubbio.* TO 'nerdubbio_user'@'localhost'; FLUSH PRIVILEGES;"

GOOGLE_ID=$(grep google_client_id /var/www/demos/questmaster/api/config.php | cut -d"'" -f4)

cat > api/config.php << PHP_EOF
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'nerdubbio',
    'db_user' => 'nerdubbio_user',
    'db_pass' => '${DBPASS}',
    'jwt_secret' => '${JWT}',
    'google_client_id' => '${GOOGLE_ID}',
    'app_url' => 'https://nerdubbio.cocoon-ms.it',
    'smtp_host' => 'smtps.aruba.it',
    'smtp_port' => 465,
    'smtp_secure' => 'ssl',
    'smtp_user' => 'no-reply@cocoon-ms.it',
    'smtp_pass' => 'MarSal1989!',
    'smtp_from' => 'no-reply@cocoon-ms.it',
    'smtp_from_name' => 'Nerdubbio',
];
PHP_EOF
chmod 644 api/config.php

cat > .env << ENV_EOF
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=${GOOGLE_ID}
ENV_EOF

chmod +x scripts/redeploy-build.sh
bash scripts/redeploy-build.sh

echo "DEPLOY_OK"
