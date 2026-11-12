<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/ita.php';
cors();

$action = $_GET['action'] ?? 'map';
$body   = body();
$jwt    = require_auth();
$userId = (string) $jwt['sub'];

// Tipo, bollino e scelta Doppiato/Solo sub per tutta la libreria dell'utente (solo cache).
if ($action === 'map') {
    json_out(['items' => ita_map($pdo, $userId)]);
}

// La scheda di un titolo: se manca o è vecchia si legge adesso (qualche secondo).
if ($action === 'get') {
    $key = (string) ($_GET['key'] ?? '');
    if (!preg_match('/^(movie|tv)-\d+$/', $key)) api_err('invalid_media', 400);
    set_time_limit(120);
    json_out(['ita' => ita_get($pdo, $key), 'lang' => ita_lang($pdo, $userId, $key), 'arriving' => ita_arriving_of($pdo, $key)]);
}

// Doppiato / Solo sub indicato dall'utente (lang: dub | sub | null per togliere).
if ($action === 'lang') {
    $lang = $body['lang'] ?? null;
    ita_set_lang($pdo, $userId, (string) ($body['key'] ?? ''), $lang === null ? null : (string) $lang);
    json_out(['ok' => true, 'lang' => ita_lang($pdo, $userId, (string) ($body['key'] ?? ''))]);
}

api_err('invalid_action', 400);
