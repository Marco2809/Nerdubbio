<?php
/**
 * Edizione italiana dei titoli (Marco, 12/11/2026, portato da Nexus Lite).
 *
 * TMDB dà le stagioni, l'uscita originale, le date italiane dei film e le
 * piattaforme, ma non la lingua: per le serie il dato sta su it.wikipedia
 * («Episodi di …», colonna «Prima TV Italia» o sotto-pagine per stagione).
 * Gli anime usano il modello {{Episodio Anime}} con «data italia» per ogni
 * puntata e si contano da codice; le tabelle delle serie, sempre diverse, le
 * legge Haiku con una risposta a schema JSON. Un guasto (rete, TMDB, Claude)
 * non diventa mai «sconosciuto»: si tiene il dato di prima.
 * AnimeClick no (Cloudflare challenge), AnimeWorld no (sito pirata).
 */

const ITA_UA = 'Nerdubbio/1.0 (https://nerdubbio.cocoon-ms.it; edizione italiana)';
const ITA_MODEL = 'claude-haiku-5-5';
const ITA_FRESH_AIRING = 20 * 3600;     // serie che stanno uscendo
const ITA_FRESH_OTHER = 7 * 86400;      // il resto: l'edizione italiana può arrivare dopo
const ITA_MONTHS = ['gennaio' => 1, 'febbraio' => 2, 'marzo' => 3, 'aprile' => 4, 'maggio' => 5, 'giugno' => 6, 'luglio' => 7,
    'agosto' => 8, 'settembre' => 9, 'ottobre' => 10, 'novembre' => 11, 'dicembre' => 12];

function ita_today(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('Europe/Rome')))->format('Y-m-d');
}

/** GET su TMDB in italiano; null se non risponde. */
function ita_tmdb(string $path, array $q = []): ?array {
    $key = (string) app_config('tmdb_api_key');
    if ($key === '') return null;
    $ch = curl_init('https://api.themoviedb.org/3/' . $path . '?' . http_build_query($q + ['api_key' => $key, 'language' => 'it-IT']));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
    $r = json_decode((string) curl_exec($ch), true);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 200 && is_array($r) ? $r : null;
}

/** JSON da Wikipedia/Wikidata, con un secondo tentativo. Fallisce due volte = guasto. */
function ita_wiki_json(string $url): array {
    for ($try = 0; $try < 2; $try++) {
        if ($try) sleep(2);
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_USERAGENT => ITA_UA]);
        $r = json_decode((string) curl_exec($ch), true);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && is_array($r)) return $r;
    }
    throw new RuntimeException('wikipedia_unavailable');
}

/** Wikitesto di una pagina di it.wikipedia (pagina assente = null). */
function ita_wiki_text(string $title): ?string {
    $r = ita_wiki_json('https://it.wikipedia.org/w/api.php?' . http_build_query(['action' => 'parse', 'format' => 'json', 'formatversion' => 2,
        'prop' => 'wikitext', 'redirects' => 1, 'page' => $title]));
    $t = $r['parse']['wikitext'] ?? null;
    return is_string($t) && $t !== '' ? $t : null;
}

/** Le pagine italiane di un titolo: voce principale e lista episodi (Wikidata P1811 o per nome). */
function ita_wiki_pages(string $key): array {
    [$type, $id] = explode('-', $key);
    $ext = ita_tmdb("$type/$id/external_ids");
    if ($ext === null) throw new RuntimeException('tmdb_unavailable');
    $q = $ext['wikidata_id'] ?? null;
    if (!$q) return [];
    $w = ita_wiki_json("https://www.wikidata.org/wiki/Special:EntityData/$q.json")['entities'][$q] ?? [];
    $main = $w['sitelinks']['itwiki']['title'] ?? null;
    $eps = null;
    if ($type === 'tv') {
        $list = $w['claims']['P1811'][0]['mainsnak']['datavalue']['value']['id'] ?? null;
        if ($list) $eps = ita_wiki_json("https://www.wikidata.org/wiki/Special:EntityData/$list.json")['entities'][$list]['sitelinks']['itwiki']['title'] ?? null;
        if (!$eps && $main) {
            $names = array_values(array_unique(["Episodi di $main", 'Episodi di ' . trim((string) preg_replace('/\s*\([^)]*\)$/', '', $main))]));
            $r = ita_wiki_json('https://it.wikipedia.org/w/api.php?' . http_build_query(['action' => 'query', 'format' => 'json', 'formatversion' => 2, 'titles' => implode('|', $names)]));
            foreach ($r['query']['pages'] ?? [] as $p) if (empty($p['missing'])) { $eps = $p['title']; break; }
        }
    }
    return array_values(array_filter([$main, $eps]));
}

/** «21 maggio 2026», «1º marzo 2024» → 2026-05-21. */
function ita_wiki_date(string $s): ?string {
    if (!preg_match('/(\d{1,2})º?\s+(' . implode('|', array_keys(ITA_MONTHS)) . ')\s+(\d{4})/iu', $s, $m)) return null;
    return sprintf('%04d-%02d-%02d', (int) $m[3], ITA_MONTHS[mb_strtolower($m[2])], (int) $m[1]);
}

function ita_wiki_clean(string $t): string {
    $t = (string) preg_replace(['/<ref[^>]*\/>/s', '/<ref[^>]*>.*?<\/ref>/s', '/<!--.*?-->/s', '/\{\{\s*[Cc]ita[^{}]*\}\}/s'], '', $t);
    $t = (string) preg_replace('/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/', '$1', $t);
    return (string) preg_replace("/'{2,}/", '', $t);
}

/** Anime: {{Episodio Anime}} con «data italia» per ogni puntata. */
function ita_wiki_anime(string $t, string $today): ?array {
    $blocks = preg_split('/\{\{\s*Episodio Anime/u', $t);
    if (count($blocks) < 2) return null;
    $tot = $it = $jp = 0;
    $next = null;
    foreach (array_slice($blocks, 1) as $b) {
        if (!preg_match('/\|\s*numero episodio\s*=/u', $b)) continue;
        $tot++;
        preg_match('/\|\s*data giappone\s*=([^\n|]*)/u', $b, $g);
        preg_match('/\|\s*data italia\s*=([^\n|]*)/u', $b, $i);
        $dj = ita_wiki_date($g[1] ?? '');
        $di = ita_wiki_date($i[1] ?? '');
        if ($dj && $dj <= $today) $jp++;
        if ($di && $di <= $today) $it++;
        elseif ($di && (!$next || $di < $next)) $next = $di;
    }
    return $tot ? ['episodes' => $tot, 'aired_jp' => $jp, 'aired_it' => $it, 'next_it' => $next] : null;
}

/** Introduzione, sezioni sull'edizione italiana e tabelle con stagioni o colonna italiana. */
function ita_wiki_pieces(string $t): string {
    $t = ita_wiki_clean($t);
    $out = [];
    $intro = trim((string) preg_split('/^==/m', $t)[0]);
    $out[] = mb_substr((string) preg_replace('/\{\{[^{}]*\}\}/s', '', $intro), 0, 1800);
    if (preg_match_all('/^==+\s*([^=\n]*(?:italian|distribuzion|doppiaggi|trasmission|pubblicazion|edizion)[^=\n]*)\s*==+\s*$(.*?)(?=^==|\z)/imsu', $t, $s, PREG_SET_ORDER)) {
        foreach ($s as $x) $out[] = "== {$x[1]} ==\n" . mb_substr(trim((string) preg_replace('/\{\{\s*Episodio Anime.*\z/su', '', $x[2])), 0, 1500);
    }
    if (preg_match_all('/\{\|.*?\n\|\}/s', $t, $tab)) {
        foreach ($tab[0] as $x) {
            if (!preg_match('/ital|\bIT\b|stagion/iu', mb_substr($x, 0, 1500))) continue;
            $out[] = mb_substr((string) preg_replace('/^\|\s*bgcolor=[^\n]*\n/mi', '', $x), 0, 5000);
        }
    }
    return mb_substr(implode("\n\n", array_filter($out)), 0, 16000);
}

/** Schema della risposta di Haiku: sempre JSON valido. */
function ita_schema(): array {
    return ['type' => 'object', 'additionalProperties' => false, 'required' => ['seasons', 'dubbing', 'where', 'next'],
        'properties' => [
            'seasons' => ['type' => 'array', 'items' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['n', 'ita', 'note'],
                'properties' => ['n' => ['type' => 'integer'], 'ita' => ['type' => 'string', 'enum' => ['si', 'in_corso', 'no', '?']], 'note' => ['type' => 'string']]]],
            'dubbing' => ['type' => 'string', 'enum' => ['doppiato', 'sottotitolato', 'misto', '?']],
            'where' => ['type' => 'string'],
            'next' => ['type' => 'object', 'additionalProperties' => false, 'required' => ['date', 'text'],
                'properties' => ['date' => ['type' => 'string'], 'text' => ['type' => 'string']]],
        ]];
}

function ita_claude(string $system, string $user): array {
    $key = (string) app_config('anthropic_api_key');
    if ($key === '') throw new RuntimeException('claude_unavailable');
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . $key],
        CURLOPT_POSTFIELDS => to_json(['model' => ITA_MODEL, 'max_tokens' => 2500, 'system' => $system,
            'messages' => [['role' => 'user', 'content' => $user]],
            'output_config' => ['format' => ['type' => 'json_schema', 'schema' => ita_schema()]]])]);
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $text = '';
    foreach ((json_decode($raw, true)['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $text .= $b['text'];
    $j = $code === 200 ? json_decode($text, true) : null;
    if (!is_array($j)) throw new RuntimeException('claude_unavailable');
    return $j;
}

/**
 * Cosa deve ancora uscire: la prossima stagione (o la serie nuova) o il film, con data
 * e dove. Per i film le date italiane per tipo (3 cinema, 4 digitale con la piattaforma
 * nella nota, 6 TV); per le serie il primo episodio della prossima stagione, con la rete.
 * italy = la data vale per l'Italia; worldwide = esce ovunque lo stesso giorno (Netflix…).
 * Ritorna {date, season, where, kind: cinema|streaming|tv|homevideo|season|series|release, italy, worldwide} o null.
 */
function ita_arriving(string $type, array $d, array $providers, string $today): ?array {
    if ($type === 'movie') {
        $future = [];
        foreach ($d['release_dates']['results'] ?? [] as $p) {
            if (($p['iso_3166_1'] ?? '') !== 'IT') continue;
            foreach ($p['release_dates'] ?? [] as $x) {
                $date = substr((string) ($x['release_date'] ?? ''), 0, 10);
                if ($date > $today) $future[] = [$date, (int) ($x['type'] ?? 0), trim((string) ($x['note'] ?? ''))];
            }
        }
        sort($future);
        if ($f = $future[0] ?? null) {
            [$date, $t, $note] = $f;
            $kind = in_array($t, [1, 2, 3], true) ? 'cinema' : ($t === 4 ? 'streaming' : ($t === 6 ? 'tv' : 'homevideo'));
            $where = $kind === 'streaming' ? ($note ?: ($providers[0] ?? '')) : ($kind === 'tv' ? $note : '');
            return ['date' => $date, 'season' => null, 'where' => $where, 'kind' => $kind, 'italy' => true, 'worldwide' => false];
        }
        $rel = (string) ($d['release_date'] ?? '');
        return $rel > $today ? ['date' => $rel, 'season' => null, 'where' => '', 'kind' => 'release', 'italy' => false, 'worldwide' => false] : null;
    }
    $network = (string) ($d['networks'][0]['name'] ?? ($providers[0] ?? ''));
    $next = $d['next_episode_to_air'] ?? null;
    $season = null;
    $date = null;
    if ($next && (int) ($next['episode_number'] ?? 0) === 1 && (string) ($next['air_date'] ?? '') > $today) {
        $season = (int) $next['season_number'];
        $date = (string) $next['air_date'];
    } else {
        foreach ($d['seasons'] ?? [] as $x) {
            $a = (string) ($x['air_date'] ?? '');
            if ((int) ($x['season_number'] ?? 0) > 0 && $a > $today && (!$date || $a < $date)) { $date = $a; $season = (int) $x['season_number']; }
        }
    }
    if (!$date) return null;
    $worldwide = $network !== '' && (in_array($network, $providers, true) || preg_match('/netflix|prime video|amazon|disney|apple tv|paramount|hbo max|crunchyroll/i', $network));
    return ['date' => $date, 'season' => $season, 'where' => $network, 'kind' => $season === 1 ? 'series' : 'season', 'italy' => (bool) $worldwide, 'worldwide' => (bool) $worldwide];
}

/** Film, serie o anime, da un dettaglio TMDB. */
function ita_kind_of(array $d, string $type): string {
    $anime = in_array(16, array_column($d['genres'] ?? [], 'id'), true)
        && (in_array('JP', (array) ($d['origin_country'] ?? []), true) || ($d['original_language'] ?? '') === 'ja');
    return $anime ? 'anime' : ($type === 'movie' ? 'film' : 'serie');
}

/**
 * Calcola da capo lo stato italiano di un titolo.
 * Ritorna i dati per la pagina: kind, stato (completa|in_corso|inedita|ignoto),
 * short (bollino), text, seasons, next, dubbing, where, source, read_at, airing.
 */
/**
 * Il calendario di una stagione (Marco, 12/11) da [[numero, data|null], ...]: ritmo, date e
 * date mancanti in fondo stimate dal ritmo. Stessa forma di src/lib/airing-schedule.ts, così la
 * pagina formatta tutto nella lingua dell'utente. null se non ci sono date o è già uscito tutto.
 */
function ita_schedule(array $ep, string $today): ?array {
    $ep = array_values(array_filter($ep, fn($e) => $e[0] > 0));
    usort($ep, fn($x, $y) => $x[0] <=> $y[0]);
    $byDate = [];
    foreach ($ep as [$num, $a]) if ($a) $byDate[$a][] = $num;
    if (!$byDate) return null;
    ksort($byDate);
    $dates = array_keys($byDate);
    $rhythm = null;
    $step = 0;
    $perDrop = 1;
    if (count($dates) === 1 && count($ep) > 1 && count($byDate[$dates[0]]) === count($ep)) {
        $rhythm = ['kind' => 'allAtOnce'];
    } elseif (count($dates) >= 3) {
        $gaps = [];
        for ($i = 1; $i < count($dates); $i++) $gaps[] = (int) round((strtotime($dates[$i]) - strtotime($dates[$i - 1])) / 86400);
        sort($gaps);
        $median = $gaps[intdiv(count($gaps), 2)];
        $freq = array_count_values(array_map('count', array_slice(array_values($byDate), 1)));
        arsort($freq);
        $perDrop = (int) array_key_first($freq);
        $premiere = count($byDate[$dates[0]]) > $perDrop ? count($byDate[$dates[0]]) : null;
        $weekdays = array_values(array_unique(array_map(fn($a) => (int) date('w', strtotime($a)), array_slice($dates, 1))));
        sort($weekdays);
        if ($median === 7 && count($weekdays) === 1) { $step = 7; $rhythm = ['kind' => 'weekly', 'weekdays' => $weekdays, 'perDrop' => $perDrop, 'premiere' => $premiere]; }
        elseif ($median === 1) { $step = 1; $rhythm = ['kind' => 'daily', 'perDrop' => $perDrop, 'premiere' => $premiere]; }
        elseif ($gaps[count($gaps) - 1] <= 7 && count($weekdays) <= 3) $rhythm = ['kind' => 'weekly', 'weekdays' => $weekdays, 'perDrop' => $perDrop, 'premiere' => $premiere];
    }
    $calendar = [];
    foreach ($byDate as $a => $nn) $calendar[] = ['date' => $a, 'episodes' => $nn, 'estimated' => false];
    $lastKnown = max(array_merge(...array_values($byDate)));
    $missing = array_values(array_filter(array_column($ep, 0), fn($x) => $x > $lastKnown));
    if ($missing && $step) {
        $a = end($dates);
        foreach (array_chunk($missing, $perDrop) as $group) {
            $a = date('Y-m-d', strtotime("$a +$step days"));
            $calendar[] = ['date' => $a, 'episodes' => $group, 'estimated' => true];
        }
    }
    if (end($calendar)['date'] < $today) return null;
    return ['rhythm' => $rhythm, 'calendar' => $calendar, 'total' => count($ep), 'undated' => $missing && !$step ? count($missing) : 0];
}

const ITA_ORDINALS = ['prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima', 'undicesima',
    'dodicesima', 'tredicesima', 'quattordicesima', 'quindicesima', 'sedicesima', 'diciassettesima', 'diciottesima', 'diciannovesima', 'ventesima'];

/** Il numero di stagione in «seconda stagione», «Stagione 2», «2ª stagione». */
function ita_wiki_season_n(string $s): ?int {
    if (preg_match('/\b(\w+)\s+stagione\b/iu', $s, $m) && ($i = array_search(mb_strtolower($m[1]), ITA_ORDINALS, true)) !== false) return $i + 1;
    if (preg_match('/\bstagione\s+(\d{1,2})\b|\b(\d{1,2})\s*[ªa°]\s+stagione\b/iu', $s, $m)) return (int) (($m[1] ?? '') !== '' ? $m[1] : $m[2]);
    return null;
}

/** Una cella di wikitesto senza attributi (style="…" | testo) né modelli. */
function ita_wiki_cell(string $c): string {
    $c = (string) preg_replace('/^\s*(?:[a-z-]+\s*=\s*(?:"[^"]*"|\S+)\s*)+\|(?!\|)/i', '', $c);
    return trim(strip_tags((string) preg_replace('/\{\{[^{}]*\}\}/', '', $c)));
}

/**
 * Le date italiane di una tabella episodi: [numero => data|null]. La colonna è quella con «Italia»
 * nell'intestazione, oppure l'unica colonna di date senza paese se il testo dice che esce ovunque insieme.
 */
function ita_wiki_table_dates(string $tab, string $context): ?array {
    $tab = ita_wiki_clean($tab);
    $head = [];
    $rows = [];
    foreach (preg_split('/^\s*\|-.*$/m', $tab) as $block) {
        $cells = [];
        $isHead = null;
        foreach (explode("\n", $block) as $l) {
            $l = ltrim($l);
            if ($l === '' || str_starts_with($l, '{|') || str_starts_with($l, '|}') || str_starts_with($l, '|+')) continue;
            if ($l[0] === '!') { $isHead ??= true; foreach (preg_split('/!!|\|\|/', substr($l, 1)) as $c) $cells[] = ita_wiki_cell($c); }
            elseif ($l[0] === '|') { $isHead ??= false; foreach (explode('||', substr($l, 1)) as $c) $cells[] = ita_wiki_cell($c); }
            elseif ($cells) $cells[count($cells) - 1] .= ' ' . trim($l);
        }
        if (!$cells) continue;
        if ($isHead && !$head && !$rows) $head = $cells; else $rows[] = $cells;
    }
    if (!$head || !$rows) return null;
    $dateRe = '/prima|tv|visione|pubblicazion|trasmission|uscita|data|distribuzion|debutto/i';
    $col = null;
    foreach ($head as $i => $h) if (preg_match('/ital/i', $h) && preg_match($dateRe, $h) && !preg_match('/titolo/i', $h)) { $col = $i; break; }
    if ($col === null) {
        $dateCols = array_keys(array_filter($head, fn($h) => preg_match($dateRe, $h) && !preg_match('/titolo/i', $h)));
        $country = '/usa|stati uniti|regno unito|\buk\b|giappon|origin|canad|australi|franc|spagn|germani|corea|svezi|danimar|norveg|brasil|messic|internaz|mondo/i';
        if (count($dateCols) !== 1 || preg_match($country, $head[$dateCols[0]])) return null;
        if (!preg_match('/tutti i paesi|in contemporanea mondiale|in tutto il mondo|a livello globale|in tutte le regioni/iu', $context)) return null;
        $col = $dateCols[0];
    }
    $first = $second = [];
    foreach ($rows as $r) {
        $first[] = preg_match('/^\d{1,3}$/', $r[0] ?? '') ? (int) $r[0] : null;
        $second[] = preg_match('/^\d{1,3}$/', $r[1] ?? '') ? (int) $r[1] : null;
    }
    $numbered = array_filter($first);
    if (!$numbered) return null;
    $useSecond = !in_array(null, $second, true) && min($second) === 1 && min($numbered) > 1;
    $out = [];
    foreach ($rows as $i => $r) {
        $num = $useSecond ? $second[$i] : $first[$i];
        if (!$num) continue;
        $out[$num] = isset($r[$col]) ? ita_wiki_date($r[$col]) : null;
    }
    return array_filter($out) ? $out : null;
}

/** Il calendario italiano: la stagione che in Italia ha la prossima uscita più vicina. $episodes = [stagione => puntate su TMDB]. */
function ita_wiki_schedule(array $texts, string $today, array $episodes): ?array {
    $best = null;
    foreach ($texts as $title => $t) {
        $nTitle = ita_wiki_season_n((string) $title);
        if (!preg_match_all('/\{\|.*?\n\|\}/s', $t, $tab, PREG_OFFSET_CAPTURE)) continue;
        $intro = ita_wiki_clean((string) preg_split('/^==/m', $t)[0]);
        foreach ($tab[0] as [$x, $pos]) {
            $before = substr($t, 0, $pos);
            $n = $nTitle;
            if (!$n && preg_match_all('/^==+\s*(.*?)\s*==+\s*$/m', $before, $h)) $n = ita_wiki_season_n((string) end($h[1]));
            if (!$n && count($episodes) === 1) $n = (int) array_key_first($episodes);
            if (!$n) continue;
            $dates = ita_wiki_table_dates($x, $intro . "\n" . mb_substr(ita_wiki_clean($before), -1500));
            if (!$dates) continue;
            $c = ita_schedule(array_map(fn($k, $v) => [(int) $k, $v], array_keys($dates), $dates), $today);
            if (!$c) continue;
            $next = '';
            foreach ($c['calendar'] as $u) if ($u['date'] >= $today) { $next = $u['date']; break; }
            if (!$best || $next < $best[0]) $best = [$next, ['season' => $n] + $c + ['closed' => isset($episodes[$n]) && count($dates) >= $episodes[$n]]];
        }
    }
    return $best[1] ?? null;
}

function ita_compute(string $key): array {
    if (!preg_match('/^(movie|tv)-(\d+)$/', $key, $mm)) throw new InvalidArgumentException('invalid_media');
    [, $type, $id] = $mm;
    $today = ita_today();
    $d = ita_tmdb("$type/$id", ['append_to_response' => 'release_dates,watch/providers']);
    if ($d === null) throw new RuntimeException('tmdb_unavailable');
    $providers = array_column($d['watch/providers']['results']['IT']['flatrate'] ?? [], 'provider_name');
    $out = ['kind' => ita_kind_of($d, $type), 'stato' => 'ignoto', 'short' => '', 'text' => '', 'seasons' => [], 'next' => null,
        'dubbing' => null, 'where' => implode(', ', $providers), 'source' => null,
        'read_at' => (new DateTimeImmutable('now', new DateTimeZone('Europe/Rome')))->format('Y-m-d H:i'), 'airing' => false];

    if ($type === 'movie') {
        $dates = [];
        foreach ($d['release_dates']['results'] ?? [] as $p) {
            if (($p['iso_3166_1'] ?? '') !== 'IT') continue;
            foreach ($p['release_dates'] ?? [] as $x) $dates[] = substr((string) $x['release_date'], 0, 10);
        }
        sort($dates);
        $first = $dates[0] ?? null;
        if (($first && $first <= $today) || $providers) {
            $out['stato'] = 'completa';
            $out['short'] = 'ITA';
            $out['text'] = $first && $first <= $today ? 'Uscito in Italia il ' . date('d/m/Y', strtotime($first)) : 'Disponibile in Italia';
        } elseif ($first) {
            $out['stato'] = 'inedita';
            $out['short'] = 'ITA ' . date('d/m', strtotime($first));
            $out['text'] = 'In Italia dal ' . date('d/m/Y', strtotime($first));
            $out['next'] = ['date' => $first, 'text' => 'Uscita in Italia'];
            $out['airing'] = true;
        } else {
            $out['text'] = 'Nessuna data di uscita in Italia su TMDB';
        }
        if ($providers) $out['text'] .= ' · su ' . $out['where'];
        return $out;
    }

    $last = $d['last_episode_to_air'] ?? null;
    $out['airing'] = !empty($d['next_episode_to_air']) || in_array($d['status'] ?? '', ['Returning Series', 'In Production'], true);
    $seasons = [];
    foreach ($d['seasons'] ?? [] as $s) {
        $n = (int) ($s['season_number'] ?? 0);
        if ($n < 1) continue;
        $aired = !$last ? 0 : ($n < (int) $last['season_number'] ? (int) $s['episode_count']
            : ($n === (int) $last['season_number'] ? (int) $last['episode_number'] : 0));
        $seasons[] = ['n' => $n, 'episodes' => (int) $s['episode_count'], 'aired' => $aired, 'start' => $s['air_date'] ?? null, 'ita' => '?', 'note' => ''];
    }
    $texts = [];
    foreach (ita_wiki_pages($key) as $p) if ($t = ita_wiki_text($p)) $texts[$p] = $t;
    if (!$texts) {
        $out['text'] = 'Su Wikipedia italiana non c\'è una pagina: stato in italiano sconosciuto' . ($providers ? ' · su ' . $out['where'] : '');
        $out['seasons'] = $seasons;
        return $out;
    }
    $sub = [];
    foreach ($texts as $t) if (preg_match_all('/\[\[(Episodi di [^\]|#]+\([^)\]]*stagione[^)\]]*\))/u', $t, $sp)) $sub = array_merge($sub, $sp[1]);
    foreach (array_slice(array_values(array_unique($sub)), -2) as $p) if (!isset($texts[$p]) && ($t = ita_wiki_text($p))) $texts[$p] = $t;
    if (!$sub && $seasons) {
        // la voce non porta alle pagine delle stagioni: si provano per nome, «Episodi di X (seconda stagione)» (Marco, 12/11)
        $base = '';
        foreach (array_keys($texts) as $p) if (str_starts_with((string) $p, 'Episodi di ')) $base = (string) $p;
        $base = $base ?: 'Episodi di ' . preg_replace('/\s*\([^)]*\)$/', '', (string) array_key_first($texts));
        $names = [];
        foreach (array_slice($seasons, -2) as $s) if (isset(ITA_ORDINALS[$s['n'] - 1])) $names[] = "$base (" . ITA_ORDINALS[$s['n'] - 1] . ' stagione)';
        $r = $names ? ita_wiki_json('https://it.wikipedia.org/w/api.php?' . http_build_query(['action' => 'query', 'format' => 'json', 'formatversion' => 2, 'titles' => implode('|', $names)])) : [];
        foreach ($r['query']['pages'] ?? [] as $p) if (empty($p['missing']) && ($t = ita_wiki_text($p['title']))) $texts[$p['title']] = $t;
    }
    // le date italiane delle puntate dalle tabelle: la pagina le preferisce a quelle originali di TMDB
    $out['schedule_it'] = ita_wiki_schedule($texts, $today, array_column($seasons, 'episodes', 'n'));
    if ($out['schedule_it']) $out['airing'] = true;     // si rilegge ogni giorno finché esce
    $out['source'] = 'https://it.wikipedia.org/wiki/' . rawurlencode(str_replace(' ', '_', (string) array_key_first($texts)));
    $anime = null;
    foreach ($texts as $t) if ($anime = ita_wiki_anime($t, $today)) break;

    $tmdbRows = implode("\n", array_map(fn($s) => "Stagione {$s['n']}: {$s['episodes']} episodi, {$s['aired']} già usciti in originale, inizio {$s['start']}", $seasons));
    $pieces = mb_substr(implode("\n\n---\n\n", array_map('ita_wiki_pieces', $texts)), 0, 32000);
    $system = "Leggi brani di Wikipedia italiana su una serie TV e dici a che punto è l'edizione italiana. Oggi è $today. "
        . "Usa SOLO quello che c'è nei brani: se un dato manca usa \"?\" o testo vuoto, non indovinare. "
        . "Per ogni stagione: \"si\" se tutti gli episodi già usciti in originale sono usciti anche in Italia (doppiati o sottotitolati in italiano), "
        . "\"in_corso\" se in Italia ne è uscita solo una parte o esce adesso, \"no\" se in Italia è inedita, \"?\" se i brani non lo dicono. "
        . "Se la serie è di una piattaforma internazionale (Netflix, Prime Video, Disney+, Apple TV+) e i brani dicono che esce in tutto il mondo "
        . "o in contemporanea, l'uscita italiana coincide con quella originale. Una sezione «Edizione italiana» con direzione del doppiaggio vuol dire \"doppiato\". "
        . "dubbing: doppiato, sottotitolato (in Italia solo coi sottotitoli), misto (solo alcune stagioni doppiate) o \"?\". "
        . "next: la prossima uscita italiana con data futura (AAAA-MM-GG) citata nei brani, altrimenti date e text vuoti. where: piattaforma o canale italiano, o vuoto. "
        . "note: una frase breve in italiano.";
    $user = 'Titolo: ' . ($d['name'] ?? '') . "\nStagioni secondo TMDB:\n$tmdbRows\n"
        . ($anime ? "Dal modello Episodio Anime: {$anime['episodes']} episodi in elenco, {$anime['aired_it']} con data italiana già passata.\n" : '')
        . "\nBrani:\n$pieces";
    $ai = ita_claude($system, $user);
    $byN = [];
    foreach ((array) ($ai['seasons'] ?? []) as $s) if (isset($s['n'])) $byN[(int) $s['n']] = $s;
    foreach ($seasons as &$s) {
        $v = (string) ($byN[$s['n']]['ita'] ?? '?');
        $s['ita'] = in_array($v, ['si', 'in_corso', 'no'], true) ? $v : '?';
        $s['note'] = mb_substr((string) ($byN[$s['n']]['note'] ?? ''), 0, 160);
    }
    unset($s);

    if ($anime && $anime['aired_jp'] > 0) {
        $out['stato'] = $anime['aired_it'] === 0 ? 'inedita' : ($anime['aired_it'] >= $anime['aired_jp'] ? 'completa' : 'in_corso');
        $out['text'] = "In Italia {$anime['aired_it']} episodi su {$anime['aired_jp']} usciti in Giappone";
        if ($anime['next_it']) $out['next'] = ['date' => $anime['next_it'], 'text' => 'Prossimo episodio in Italia'];
        foreach ($seasons as &$s) { $s['ita'] = '?'; $s['note'] = ''; }    // il conteggio vale per tutte: niente righe vuote
        unset($s);
    } else {
        // se è uscita in Italia una stagione, lo sono anche quelle prima
        $lastSi = 0;
        foreach ($seasons as $s) if ($s['aired'] > 0 && $s['ita'] === 'si') $lastSi = max($lastSi, $s['n']);
        foreach ($seasons as &$s) if ($s['n'] < $lastSi && $s['ita'] === '?') { $s['ita'] = 'si'; $s['note'] = 'In Italia: è già uscita una stagione successiva'; }
        unset($s);
        $aired = array_values(array_filter($seasons, fn($s) => $s['aired'] > 0));
        $lastAired = end($aired) ?: null;
        $ita = array_column($aired, 'ita');
        if ($lastAired && $lastAired['ita'] === 'si' && !array_intersect($ita, ['in_corso', 'no'])) $out['stato'] = 'completa';
        elseif ($lastSi || in_array('in_corso', $ita, true)) $out['stato'] = 'in_corso';
        elseif ($aired && !array_diff($ita, ['no'])) $out['stato'] = 'inedita';
        $out['text'] = match ($out['stato']) {
            'completa' => count($aired) > 1 ? 'Tutte le ' . count($aired) . ' stagioni uscite sono in Italia' : 'Uscita in Italia',
            'in_corso' => $lastAired && $lastAired['ita'] === 'in_corso' ? 'In Italia sta uscendo la stagione ' . $lastAired['n']
                : ($lastSi ? 'In Italia fino alla stagione ' . $lastSi . ' di ' . count($aired) : 'In Italia sta uscendo adesso'),
            'inedita' => 'Non ancora uscita in Italia',
            default => 'Wikipedia non dice a che punto è l\'edizione italiana',
        };
        $n = $ai['next'] ?? [];
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($n['date'] ?? '')) && $n['date'] > $today)
            $out['next'] = ['date' => $n['date'], 'text' => mb_substr((string) ($n['text'] ?? ''), 0, 120)];
    }
    $out['seasons'] = $seasons;
    $dub = (string) ($ai['dubbing'] ?? '?');
    $out['dubbing'] = in_array($dub, ['doppiato', 'sottotitolato', 'misto'], true) ? $dub : null;
    $where = trim((string) ($ai['where'] ?? ''), " ?");
    if ($where !== '') $out['where'] = mb_substr($where, 0, 80);
    $subOnly = $out['dubbing'] === 'sottotitolato';
    $out['short'] = match ($out['stato']) {
        'completa' => $subOnly ? 'SUB ITA' : 'ITA',
        'in_corso' => ($subOnly ? 'SUB' : 'ITA') . ' …',
        'inedita' => 'no ITA',
        default => '',
    };
    if ($out['dubbing']) $out['text'] .= ' · ' . ['doppiato' => 'doppiata in italiano', 'sottotitolato' => 'solo sottotitoli', 'misto' => 'doppiata solo in parte'][$out['dubbing']];
    if ($out['where']) $out['text'] .= ' · su ' . $out['where'];
    if ($out['stato'] !== 'completa') $out['airing'] = $out['airing'] || $out['stato'] === 'in_corso';
    return $out;
}

/** Stato italiano dalla cache se fresca, altrimenti ricalcolato. $force = rileggi comunque (cron). */
function ita_get(PDO $pdo, string $key, bool $force = false): ?array {
    $st = $pdo->prepare('SELECT data, airing, fetched_at > NOW() - INTERVAL IF(airing = 1, ?, ?) SECOND AS fresh FROM media_ita WHERE media_key = ?');
    $st->execute([ITA_FRESH_AIRING, ITA_FRESH_OTHER, $key]);
    $row = $st->fetch();
    if ($row && $row['fresh'] && !$force) return json_decode((string) $row['data'], true);
    try {
        $data = ita_compute($key);
    } catch (RuntimeException $e) {
        return $row ? json_decode((string) $row['data'], true) : null;
    }
    $pdo->prepare('REPLACE INTO media_ita (media_key, data, stato, airing, fetched_at) VALUES (?, ?, ?, ?, NOW())')
        ->execute([$key, to_json($data), $data['stato'], $data['airing'] ? 1 : 0]);
    $pdo->prepare('INSERT INTO media_kind (media_key, kind, fetched_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE kind = VALUES(kind)')
        ->execute([$key, $data['kind']]);
    return $data;
}

/** Il tipo di un titolo (film/serie/anime), con una sola lettura TMDB. */
function ita_kind(PDO $pdo, string $key): ?string {
    if (!preg_match('/^(movie|tv)-(\d+)$/', $key, $m)) return null;
    $d = ita_tmdb("$m[1]/$m[2]", ['append_to_response' => $m[1] === 'movie' ? 'release_dates,watch/providers' : 'watch/providers']);
    if ($d === null) return null;
    $kind = ita_kind_of($d, $m[1]);
    $providers = array_column($d['watch/providers']['results']['IT']['flatrate'] ?? [], 'provider_name');
    $arriving = ita_arriving($m[1], $d, $providers, ita_today());
    $pdo->prepare('REPLACE INTO media_kind (media_key, kind, arriving, fetched_at) VALUES (?, ?, ?, NOW())')
        ->execute([$key, $kind, $arriving ? to_json($arriving) : null]);
    return $kind;
}

/** Per la lista dell'utente: tipo, bollino e scelta Doppiato/Solo sub, solo da cache. */
function ita_map(PDO $pdo, string $userId): array {
    $today = ita_today();
    $st = $pdo->prepare("SELECT um.media_key, mk.kind, mk.arriving, mi.stato, mi.data, ul.lang FROM user_media um
        LEFT JOIN media_kind mk ON mk.media_key = um.media_key
        LEFT JOIN media_ita mi ON mi.media_key = um.media_key
        LEFT JOIN user_ita_lang ul ON ul.user_id = um.user_id AND ul.media_key = um.media_key
        WHERE um.user_id = ?");
    $st->execute([$userId]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        if (!$r['kind'] && !$r['stato'] && !$r['lang']) continue;
        $d = $r['data'] ? (json_decode((string) $r['data'], true) ?: []) : [];
        $arr = $r['arriving'] ? json_decode((string) $r['arriving'], true) : null;
        if (!is_array($arr) || ($arr['date'] ?? '') <= $today) $arr = null;    // uscito da ieri: niente bollino vecchio
        $out[$r['media_key']] = array_filter(['kind' => $r['kind'], 'stato' => $r['stato'], 'short' => $d['short'] ?? null, 'lang' => $r['lang'], 'arriving' => $arr],
            fn($v) => $v !== null && $v !== '');
    }
    return $out;
}

function ita_arriving_of(PDO $pdo, string $key): ?array {
    $st = $pdo->prepare('SELECT arriving FROM media_kind WHERE media_key = ?');
    $st->execute([$key]);
    $a = json_decode((string) ($st->fetchColumn() ?: ''), true);
    return is_array($a) && ($a['date'] ?? '') > ita_today() ? $a : null;
}

function ita_lang(PDO $pdo, string $userId, string $key): ?string {
    $st = $pdo->prepare('SELECT lang FROM user_ita_lang WHERE user_id = ? AND media_key = ?');
    $st->execute([$userId, $key]);
    return $st->fetchColumn() ?: null;
}

function ita_set_lang(PDO $pdo, string $userId, string $key, ?string $lang): void {
    if (!preg_match('/^(movie|tv)-\d+$/', $key)) api_err('invalid_media', 400);
    if ($lang === null || $lang === '') {
        $pdo->prepare('DELETE FROM user_ita_lang WHERE user_id = ? AND media_key = ?')->execute([$userId, $key]);
        return;
    }
    if (!in_array($lang, ['dub', 'sub'], true)) api_err('invalid_action', 400);
    $pdo->prepare('INSERT INTO user_ita_lang (user_id, media_key, lang) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lang = VALUES(lang)')
        ->execute([$userId, $key, $lang]);
}
