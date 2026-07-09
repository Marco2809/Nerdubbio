<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/recap.php';
cors();

$action = $_GET['action'] ?? 'get';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'get') {
    json_out(recap_get_or_generate($pdo, $body, $userId));
}

api_err('invalid_action', 400);
