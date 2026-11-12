<?php
// Edizione italiana dei titoli in lista (Da vedere / In corso / In pausa), a rate.
//   30 3 * * * flock -n /tmp/nb_ita.lock php /var/www/demos/nerdubbio/scripts/ita-cron.php >> /var/log/nerdubbio-ita.log 2>&1
//
// 1. il tipo (film/serie/anime) e «in arrivo» di ogni titolo, ogni notte: solo TMDB, veloce;
// 2. rilegge le serie che stanno uscendo (20 h) e il resto non ancora completo (7 giorni);
// 3. legge i titoli mai letti, ITA_NUOVI a notte, prima quelli in più liste.
// Tetto: ITA_MAX letture Wikipedia+Haiku a notte. ITA_ONLY=tv-123 rilegge solo quello.

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('cli only');
}

require_once __DIR__ . '/../api/lib/helpers.php';
require_once __DIR__ . '/../api/lib/db.php';
require_once __DIR__ . '/../api/lib/ita.php';

const ITA_NUOVI = 150;
const ITA_MAX = 250;

if ($only = getenv('ITA_ONLY')) {
    echo json_encode(ita_get($pdo, $only, true), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
    exit(0);
}

$open = "SELECT media_key, COUNT(*) AS users, MAX(added_at) AS added FROM user_media
         WHERE status IN ('plan_to_watch','watching','paused') AND media_key REGEXP '^(movie|tv)-[0-9]+$' GROUP BY media_key";

// 1. tipo e «in arrivo»: ogni notte per tutti (una lettura TMDB a titolo, veloce)
$kinds = 0;
foreach ($pdo->query("SELECT o.media_key FROM ($open) o LEFT JOIN media_kind k ON k.media_key = o.media_key
                      WHERE k.media_key IS NULL OR k.fetched_at < NOW() - INTERVAL 20 HOUR")->fetchAll(PDO::FETCH_COLUMN) as $key) {
    if (ita_kind($pdo, (string) $key)) $kinds++;
    usleep(150000);
}

// 2. da rileggere
$stale = $pdo->query("SELECT o.media_key FROM ($open) o JOIN media_ita m ON m.media_key = o.media_key
    WHERE (m.airing = 1 AND m.fetched_at < NOW() - INTERVAL 20 HOUR)
       OR (m.stato <> 'completa' AND m.fetched_at < NOW() - INTERVAL 7 DAY)
    ORDER BY m.airing DESC, o.users DESC")->fetchAll(PDO::FETCH_COLUMN);
// 3. mai letti
$fresh = $pdo->query("SELECT o.media_key FROM ($open) o LEFT JOIN media_ita m ON m.media_key = o.media_key
    WHERE m.media_key IS NULL ORDER BY o.users DESC, o.added DESC LIMIT " . ITA_NUOVI)->fetchAll(PDO::FETCH_COLUMN);

$todo = array_slice(array_values(array_unique(array_merge($stale, $fresh))), 0, ITA_MAX);
$ok = 0;
foreach ($todo as $i => $key) {
    if ($i > 0) sleep(2);
    try {
        if (ita_get($pdo, (string) $key, true)) $ok++;
    } catch (Throwable $e) {
        echo date('Y-m-d H:i') . " ita $key: " . $e->getMessage() . "\n";
    }
}
// i titoli che nessuno ha più in lista escono dalla cache dopo 30 giorni
$pdo->exec("DELETE FROM media_ita WHERE fetched_at < NOW() - INTERVAL 30 DAY");
echo date('Y-m-d H:i') . " ita: tipi $kinds, letti $ok di " . count($todo) . " (" . count($stale) . " da rileggere, " . count($fresh) . " nuovi)\n";
