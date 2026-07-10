<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/giphy.php';
cors();

require_auth();

$action = $_GET['action'] ?? 'trending';
$offset = (int) ($_GET['offset'] ?? 0);
$lang   = normalize_locale($_GET['lang'] ?? 'it');

if ($action === 'search') {
    json_out(giphy_search((string) ($_GET['q'] ?? ''), $offset, $lang));
}

if ($action === 'trending') {
    json_out(giphy_trending($offset));
}

api_err('invalid_action', 400);
