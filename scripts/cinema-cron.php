<?php
// Rilegge gli orari dei cinema scelti dagli utenti (I miei cinema, pagina Prossimamente).
// Ogni cinema una volta sola per tutti, al massimo 4 letture al giorno (vedi api/lib/cinema.php).
//   0 7,12,16,20 * * * flock -n /tmp/nb_cinema.lock php /var/www/demos/nerdubbio/scripts/cinema-cron.php >> /var/log/nerdubbio-cinema.log 2>&1

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('cli only');
}

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';
require_once __DIR__ . '/../api/lib/cinema.php';

cinema_drop_orphans($pdo);
$pdo->prepare('DELETE FROM cinema_showtimes WHERE day < ?')->execute([cinema_now()->format('Y-m-d')]);

$cinemas = $pdo->query('SELECT * FROM cinemas ORDER BY id')->fetchAll();
$rows = 0;
foreach ($cinemas as $i => $c) {
    if ($i > 0) sleep(2);
    try {
        $rows += cinema_read($pdo, $c);
    } catch (Throwable $e) {
        echo cinema_now()->format('Y-m-d H:i') . " cinema {$c['id']}: " . $e->getMessage() . "\n";
    }
}
echo cinema_now()->format('Y-m-d H:i') . ' cinema: ' . count($cinemas) . " sale, $rows righe\n";
