<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/translate.php';
cors();

$action = $_GET['action'] ?? 'translate';
$body   = body();
$jwt    = require_auth();

if ($action !== 'translate') {
    json_out(['error' => 'Azione non valida'], 400);
}

json_out(translate_text(
    (string) ($body['text'] ?? ''),
    (string) ($body['target'] ?? 'it'),
    isset($body['source']) ? (string) $body['source'] : null,
));
