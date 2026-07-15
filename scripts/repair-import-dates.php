<?php
// Ripara le date di visione falsate da un re-import.
//
// library_sync_episodes (prima del fix) cancellava e reinseriva gli episodi
// stampando date('now') su quelli senza data nel CSV: le serie re-importate
// risultavano "viste adesso" e sommergevano quelle davvero recenti nella home
// (prossimi episodi vuoti). La data vera è sopravvissuta in
// user_media.last_watched_at: qui la si rimette sugli episodi timbrati.
//
//   php scripts/repair-import-dates.php <handle> <YYYY-MM-DD HH:MM>          # dry-run
//   php scripts/repair-import-dates.php <handle> <YYYY-MM-DD HH:MM> --apply
//
// Il secondo argomento è il minuto dell'import (finestra +/- 10 minuti).

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('cli only'); }

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';

$apply  = in_array('--apply', $argv, true);
$handle = $argv[1] ?? '';
$when   = $argv[2] ?? '';
if ($handle === '' || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $when)) {
    exit("Uso: php scripts/repair-import-dates.php <handle> \"YYYY-MM-DD HH:MM\" [--apply]\n");
}

$stmt = $pdo->prepare('SELECT id FROM profiles WHERE handle = ?');
$stmt->execute([$handle]);
$userId = $stmt->fetchColumn();
if (!$userId) exit("Utente @$handle non trovato\n");

$from = date('Y-m-d H:i:s', strtotime($when) - 600);
$to   = date('Y-m-d H:i:s', strtotime($when) + 600);
echo ($apply ? "== APPLY ==" : "== DRY-RUN ==") . " @$handle, finestra $from -> $to\n\n";

// Episodi timbrati nella finestra, con la data reale della serie a confronto.
$q = $pdo->prepare(
    'SELECT ue.media_key, um.title, um.last_watched_at AS real_date, COUNT(*) AS eps
     FROM user_episodes ue
     JOIN user_media um ON um.user_id = ue.user_id AND um.media_key = ue.media_key
     WHERE ue.user_id = ? AND ue.watched_at BETWEEN ? AND ?
     GROUP BY ue.media_key, um.title, um.last_watched_at
     ORDER BY eps DESC'
);
$q->execute([$userId, $from, $to]);
$rows = $q->fetchAll();

$upd = $pdo->prepare(
    'UPDATE user_episodes SET watched_at = ?
     WHERE user_id = ? AND media_key = ? AND watched_at BETWEEN ? AND ?'
);

$fixed = 0; $skipped = 0; $touchedEps = 0;
foreach ($rows as $r) {
    // Senza una data reale precedente non c'è nulla da ripristinare: meglio
    // lasciare com'è che inventare.
    if (empty($r['real_date']) || $r['real_date'] >= $from) {
        $skipped++;
        printf("  SKIP  %-34s %3d ep — nessuna data reale precedente\n", mb_substr($r['title'] ?? $r['media_key'], 0, 33), $r['eps']);
        continue;
    }
    printf("  FIX   %-34s %3d ep — %s -> %s\n", mb_substr($r['title'] ?? $r['media_key'], 0, 33), $r['eps'], substr($when, 0, 16), $r['real_date']);
    $fixed++; $touchedEps += (int) $r['eps'];
    if ($apply) $upd->execute([$r['real_date'], $userId, $r['media_key'], $from, $to]);
}

echo "\nSerie da correggere: $fixed ($touchedEps episodi) | saltate: $skipped\n";
if (!$apply && $fixed > 0) echo "Rilancia con --apply per applicare.\n";
