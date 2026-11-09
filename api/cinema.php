<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/cinema.php';
cors();

$action = $_GET['action'] ?? 'mine';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

if ($action === 'cities') {
    json_out(['cities' => cinema_cities($pdo)]);
}

if ($action === 'list') {
    json_out(['cinemas' => cinema_city_list($pdo, (string) ($_GET['city'] ?? ''))]);
}

if ($action === 'mine') {
    json_out(cinema_mine($pdo, $userId));
}

if ($action === 'toggle') {
    cinema_toggle($pdo, $userId, (string) ($body['city'] ?? ''), (string) ($body['id'] ?? ''));
    json_out(cinema_mine($pdo, $userId));
}

api_err('invalid_action', 400);
