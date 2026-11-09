<?php
/**
 * I miei cinema: ogni utente sceglie città e fino a CINEMA_MAX sale, e vede gli
 * orari a confronto. Gli orari vengono da ComingSoon (che permette /cinema/ nel
 * robots.txt): ogni cinema si legge una volta per tutti gli utenti che l'hanno
 * scelto, al massimo CINEMA_READS_DAY volte al giorno, con pausa tra le pagine.
 * Niente link verso ComingSoon nella pagina (scelta di Marco, 09/11/2026).
 */

const CS_BASE = 'https://www.comingsoon.it';
const CINEMA_MAX = 6;
const CINEMA_READS_DAY = 4;
const CINEMA_FRESH_SEC = 3 * 3600;        // una scelta nuova rilegge solo se più vecchio di così
const CINEMA_MONTHS = ['GEN' => 1, 'FEB' => 2, 'MAR' => 3, 'APR' => 4, 'MAG' => 5, 'GIU' => 6,
    'LUG' => 7, 'AGO' => 8, 'SET' => 9, 'OTT' => 10, 'NOV' => 11, 'DIC' => 12];
// Sotto /cinema/ ci sono anche sezioni che non sono città.
const CINEMA_NOT_CITIES = ['news', 'video', 'boxoffice', 'calendariouscite', 'film-da-vedere',
    'filmalcinema', 'recensioni', 'trovacinema'];

function cinema_now(): DateTimeImmutable {
    return new DateTimeImmutable('now', new DateTimeZone('Europe/Rome'));
}

function cinema_page(string $path): string {
    $ch = curl_init(CS_BASE . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Nerdubbio; guida cinema)',
    ]);
    $html = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 200 ? $html : '';
}

function cinema_text(string $s): string {
    return trim(html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

/** «Il Gatto col Cappello» e «Il gatto col cappello» sono lo stesso film. */
function cinema_title_norm(string $t): string {
    $t = mb_strtolower(cinema_text($t));
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $t);
    return mb_substr((string) preg_replace('/[^a-z0-9]+/', '', $ascii !== false ? $ascii : $t), 0, 190);
}

/** Cache su tabella: se il sito non risponde si tiene la copia vecchia. */
function cinema_cached(PDO $pdo, string $key, int $maxAge, callable $load): array {
    // l'età si misura in SQL: il DB è in ora italiana, PHP in UTC
    $st = $pdo->prepare('SELECT payload, fetched_at > NOW() - INTERVAL ? SECOND AS fresh FROM cinema_cache WHERE cache_key = ?');
    $st->execute([$maxAge, $key]);
    $row = $st->fetch();
    $old = $row ? (json_decode((string) $row['payload'], true) ?: []) : [];
    if ($row && $row['fresh']) return $old;
    $fresh = $load();
    if (!$fresh) return $old;
    $pdo->prepare('REPLACE INTO cinema_cache (cache_key, payload, fetched_at) VALUES (?, ?, NOW())')
        ->execute([$key, to_json($fresh)]);
    return $fresh;
}

/** Le città (province) di ComingSoon: [{slug, name}]. */
function cinema_cities(PDO $pdo): array {
    return cinema_cached($pdo, 'cities', 30 * 86400, function (): array {
        $html = cinema_page('/cinema/');
        $out = [];
        if (preg_match_all('~href="?/cinema/([a-z0-9-]+)/"?>([^<]{2,60})<~', $html, $m, PREG_SET_ORDER)) {
            foreach ($m as $x) {
                if (in_array($x[1], CINEMA_NOT_CITIES, true)) continue;
                $name = cinema_text($x[2]);
                if ($name !== '') $out[$x[1]] = ['slug' => $x[1], 'name' => $name];
            }
        }
        $out = array_values($out);
        usort($out, fn($a, $b) => strcoll($a['name'], $b['name']));
        return $out;
    });
}

function cinema_valid_city(PDO $pdo, string $city): bool {
    return preg_match('/^[a-z0-9-]{2,60}$/', $city) === 1
        && in_array($city, array_column(cinema_cities($pdo), 'slug'), true);
}

/** I cinema di una città: [{id, slug, name}]. */
function cinema_city_list(PDO $pdo, string $city): array {
    if (!cinema_valid_city($pdo, $city)) api_err('cinema_city_unknown', 404);
    return cinema_cached($pdo, 'city:' . $city, 7 * 86400, function () use ($city): array {
        $html = cinema_page("/cinema/$city/");
        $out = [];
        $re = '~href="?/cinema/' . preg_quote($city, '~') . '/([a-z0-9-]+)/(\d+)/"?\s[^>]*?title="([^"]+)"~';
        if (preg_match_all($re, $html, $m, PREG_SET_ORDER)) {
            foreach ($m as $x) $out[$x[2]] = ['id' => $x[2], 'slug' => $x[1], 'name' => cinema_text($x[3])];
        }
        $out = array_values($out);
        usort($out, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        return $out;
    });
}

/** Può essere letto ancora oggi? Se sì conta la lettura. */
function cinema_take_read(PDO $pdo, string $id): bool {
    $today = cinema_now()->format('Y-m-d');
    $st = $pdo->prepare(
        'UPDATE cinemas SET reads_n = IF(reads_day = ?, reads_n + 1, 1), reads_day = ?
         WHERE id = ? AND (reads_day IS NULL OR reads_day <> ? OR reads_n < ?)'
    );
    $st->execute([$today, $today, $id, $today, CINEMA_READS_DAY]);
    return $st->rowCount() > 0;
}

/**
 * Rilegge la programmazione di un cinema: la pagina del cinema dà i film, la
 * pagina di ogni film dà giorni e orari. Se il sito non risponde restano gli
 * orari di prima. Ritorna le righe scritte (0 = niente di nuovo).
 */
function cinema_read(PDO $pdo, array $c): int {
    if (!cinema_take_read($pdo, (string) $c['id'])) return 0;
    $base = "/cinema/{$c['city']}/{$c['slug']}/{$c['id']}/";
    $html = cinema_page($base);
    $now = cinema_now();
    $rows = [];
    foreach (array_slice(explode('class="tit_olo h1">', $html), 1) as $chunk) {
        if (!preg_match('~^(.*?)</a>~s', $chunk, $t) || !preg_match('~/ticket/\?idf=(\d+)~', $chunk, $idf)) continue;
        $title = cinema_text($t[1]);
        preg_match('~/\s*([\d,]+€)~u', $chunk, $price);
        usleep(800000);
        $page = cinema_page($base . 'ticket/?idf=' . $idf[1]);
        foreach (array_slice(explode('class="calendar-icon tac"', $page), 1) as $day) {
            if (!preg_match('~class="day">(\d{1,2})<.*?class="month">([A-Z]{3})<~s', $day, $g) || !isset(CINEMA_MONTHS[$g[2]])) continue;
            if (!preg_match_all('~<button[^>]*title="([^"]*)"[^>]*>\s*(\d{1,2}:\d{2})\s*</button>~', $day, $o, PREG_SET_ORDER)) continue;
            $month = CINEMA_MONTHS[$g[2]];
            // la pagina non dice l'anno: gennaio visto a dicembre è l'anno dopo
            $year = (int) $now->format('Y') + ($month < (int) $now->format('n') ? 1 : 0);
            $halls = array_unique(array_filter(array_map(fn($x) => mb_convert_case(cinema_text($x[1]), MB_CASE_TITLE), $o)));
            $rows[] = [$c['id'], mb_substr($title, 0, 200), cinema_title_norm($title), sprintf('%04d-%02d-%02d', $year, $month, (int) $g[1]),
                mb_substr(implode(',', array_column($o, 2)), 0, 190), mb_substr(implode(', ', $halls), 0, 190) ?: null, $price[1] ?? null];
        }
    }
    $pdo->prepare('UPDATE cinemas SET read_at = NOW() WHERE id = ?')->execute([$c['id']]);
    if (!$rows) return 0;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM cinema_showtimes WHERE cinema_id = ?')->execute([$c['id']]);
        $ins = $pdo->prepare('INSERT INTO cinema_showtimes (cinema_id, title, title_norm, day, times, hall, price) VALUES (?,?,?,?,?,?,?)');
        foreach ($rows as $r) $ins->execute($r);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return count($rows);
}

/** I cinema che nessuno ha più scelto escono dalla cache (gli orari vanno via a cascata). */
function cinema_drop_orphans(PDO $pdo): void {
    $pdo->exec('DELETE FROM cinemas WHERE id NOT IN (SELECT cinema_id FROM user_cinemas)');
}

/** Tocca un cinema: se c'è si toglie, se non c'è si aggiunge e si leggono i suoi orari. */
function cinema_toggle(PDO $pdo, string $uid, string $city, string $id): void {
    if (!preg_match('/^\d{1,12}$/', $id)) api_err('cinema_not_found', 404);
    $has = $pdo->prepare('SELECT 1 FROM user_cinemas WHERE user_id = ? AND cinema_id = ?');
    $has->execute([$uid, $id]);
    if ($has->fetch()) {
        $pdo->prepare('DELETE FROM user_cinemas WHERE user_id = ? AND cinema_id = ?')->execute([$uid, $id]);
        cinema_drop_orphans($pdo);
        return;
    }
    $n = $pdo->prepare('SELECT COUNT(*) FROM user_cinemas WHERE user_id = ?');
    $n->execute([$uid]);
    if ((int) $n->fetchColumn() >= CINEMA_MAX) api_err('cinema_max', 400, ['max' => CINEMA_MAX]);

    $found = null;
    foreach (cinema_city_list($pdo, $city) as $c) if ($c['id'] === $id) { $found = $c; break; }
    if (!$found) api_err('cinema_not_found', 404);

    $pdo->prepare('INSERT INTO cinemas (id, city, slug, name) VALUES (?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE city = VALUES(city), slug = VALUES(slug), name = VALUES(name)')
        ->execute([$id, $city, $found['slug'], $found['name']]);
    $pdo->prepare('INSERT IGNORE INTO user_cinemas (user_id, cinema_id) VALUES (?, ?)')->execute([$uid, $id]);

    $st = $pdo->prepare('SELECT *, read_at IS NULL OR read_at < NOW() - INTERVAL ? SECOND AS stale FROM cinemas WHERE id = ?');
    $st->execute([CINEMA_FRESH_SEC, $id]);
    $c = $st->fetch();
    if ($c['stale']) {
        // un multisala sono 20-30 pagine con la pausa: non si interrompe a metà
        set_time_limit(180);
        ignore_user_abort(true);
        cinema_read($pdo, $c);
    }
}

/** Giorno → film → un cinema per riga: gli orari si confrontano a colpo d'occhio. */
function cinema_mine(PDO $pdo, string $uid): array {
    $st = $pdo->prepare('SELECT c.id, c.city, c.name, c.read_at FROM user_cinemas uc JOIN cinemas c ON c.id = uc.cinema_id
                         WHERE uc.user_id = ? ORDER BY uc.created_at');
    $st->execute([$uid]);
    $cinemas = $st->fetchAll();

    $st = $pdo->prepare('SELECT s.cinema_id, c.name, s.title, s.title_norm, s.day, s.times, s.hall, s.price
                         FROM cinema_showtimes s
                         JOIN user_cinemas uc ON uc.cinema_id = s.cinema_id AND uc.user_id = ?
                         JOIN cinemas c ON c.id = s.cinema_id
                         WHERE s.day >= ? ORDER BY s.day, s.title, c.name');
    $st->execute([$uid, cinema_now()->format('Y-m-d')]);
    $days = [];
    foreach ($st->fetchAll() as $r) {
        $film = &$days[$r['day']][$r['title_norm']];
        $film ??= ['title' => $r['title'], 'cinemas' => []];
        // alcuni cinema pubblicano lo stesso film due volte (sale o versioni diverse): una riga sola
        $row = &$film['cinemas'][$r['cinema_id']];
        $row ??= ['id' => $r['cinema_id'], 'name' => $r['name'], 'times' => [], 'halls' => [], 'prices' => []];
        $row['times'] = array_merge($row['times'], explode(',', (string) $r['times']));
        if ($r['hall']) $row['halls'] = array_merge($row['halls'], explode(', ', (string) $r['hall']));
        if ($r['price']) $row['prices'][] = (string) $r['price'];
        unset($row, $film);
    }
    $out = [];
    foreach ($days as $day => $films) {
        $list = [];
        foreach ($films as $f) {
            $f['cinemas'] = array_values(array_map(function ($x) {
                $times = array_values(array_unique($x['times']));
                sort($times);
                return ['id' => $x['id'], 'name' => $x['name'], 'times' => $times,
                    'hall' => implode(', ', array_unique($x['halls'])), 'price' => implode(' / ', array_unique($x['prices']))];
            }, $f['cinemas']));
            $list[] = $f;
        }
        $out[] = ['day' => $day, 'films' => $list];
    }
    return ['cinemas' => $cinemas, 'max' => CINEMA_MAX, 'days' => $out];
}
