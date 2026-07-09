<?php

// Genera (e mette in cache) lo storyboard di un video-recap a partire dalla trama.
// L'unico costo AI e' una singola chiamata di testo per serie+stagione+lingua:
// il rendering del video e' codice deterministico lato client. Vedi RecapReel.tsx.

const RECAP_MODEL_DEFAULT = 'claude-opus-4-8';
const RECAP_MIN_SCENES = 5;
const RECAP_MAX_SCENES = 12;
const RECAP_DUR_MIN = 3200;
const RECAP_DUR_MAX = 6500;
const RECAP_CAPTION_MAX = 155;
const RECAP_MAX_EPISODES = 30;

// Vocabolario di motivi animati supportati dal motore lato client (motifs.tsx).
// Ogni nome DEVE avere una resa in src/components/nerdubbio/recap/motifs.tsx.
const RECAP_MOTIFS = [
    'person', 'duo', 'group', 'home', 'city', 'journey', 'money', 'crown',
    'love', 'betrayal', 'danger', 'mystery', 'illness', 'fall', 'secret', 'chem',
    'fight', 'arrest', 'message', 'deal', 'explosion', 'car', 'justice',
    'union', 'time', 'monster',
];

function recap_lang_name(string $lang): string {
    return match ($lang) {
        'en' => 'English',
        'es' => 'Spanish',
        'fr' => 'French',
        'de' => 'German',
        default => 'Italian',
    };
}

function recap_system_prompt(): string {
    $motifs = <<<TXT
- person: protagonist introduced / a lone character
- duo: partnership, two people, a pact
- group: family, crew, team
- home: a house, a place, domestic life
- city: metropolis, the wider world, society
- journey: travel, escape, a road, a new path
- money: money, wealth, an economic stake
- crown: power, ambition, becoming a kingpin, an empire
- love: love, a bond, romance
- betrayal: betrayal, a broken bond, heartbreak
- danger: threat, violence, death, a hunt
- mystery: a mystery, an investigation, a secret to uncover
- illness: illness, decline, loss, a countdown
- fall: downfall, collapse, losing everything
- secret: a double life, a hidden identity, deception
- chem: science, a lab, an experiment, a craft
- fight: a fight, a confrontation, a violent clash between characters
- arrest: an arrest, prison, being captured, the law closing in
- message: a phone call, a letter, a text, a piece of news or a reveal
- deal: a pact, a contract, an agreement, an alliance struck
- explosion: an explosion, an attack, sudden destruction
- car: a car, a chase, a getaway, travel by vehicle
- justice: a trial, a verdict, the law, justice
- union: a wedding, a marriage, a union
- time: a deadline, time running out, a countdown
- monster: a creature, a monster, a supernatural or inhuman threat
TXT;

    return <<<SYS
You are the storyboard writer for Nerdubbio, a TV/movie tracking app. You produce a "recap reel" that helps a viewer REMEMBER what happened before they watch the next season. It is a sequence of scenes, each pairing one visual MOTIF (from a fixed vocabulary) with a one-line caption describing a concrete event.

Motif vocabulary (use ONLY these motif ids):
$motifs

You are given the plot and, when available, a numbered list of episode synopses. Use them as the source of truth. You SHOULD ALSO draw on your own knowledge of this specific title to add precise, accurate details the synopses omit — real character names, who dies, who betrays whom, key twists and the season cliffhanger. Never contradict the provided synopses. If you do not actually know this title, rely only on the provided data and stay accurate rather than inventing.

Rules:
- Be SPECIFIC and CONCRETE. Every caption must name real characters and state exactly what happened — a death, a betrayal, a reveal, an alliance, a confrontation. Prefer "Rick uccide Shane per proteggere il gruppo" over "un personaggio prende una decisione difficile". Never write vague filler like "affrontano nuove sfide" or "la situazione precipita".
- Follow the episodes in chronological order and cover the beats that matter for continuity into the next season.
- Produce between 6 and 12 scenes (more for longer seasons). Do not merge unrelated events into one caption.
- Each scene: pick the single motif that best fits that specific beat. Prefer variety, but repeat a motif if it genuinely fits.
- "label": a very short chip, 1-3 words, in the target language (a place, a name, a turning point).
- "caption": one sentence, 12-24 words, in the target language, naming who did what. No episode numbers, no meta ("in this episode...").
- "dur": display time in milliseconds, 3500-6500, longer for longer captions.
- End on the season's final major event / cliffhanger.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"scenes":[{"motif":"person","label":"...","caption":"...","dur":4800}, ...]}
SYS;
}

function recap_user_message(array $media, string $langName): string {
    $lines = [];
    $lines[] = 'Target language for label and caption: ' . $langName . '.';
    $lines[] = 'Title: ' . ($media['title'] ?? '');
    if (!empty($media['year'])) $lines[] = 'Year: ' . $media['year'];
    $lines[] = 'Type: ' . (($media['type'] ?? 'tv') === 'movie' ? 'film' : 'TV series');
    if (!empty($media['seasonLabel'])) $lines[] = 'Recap scope: ' . $media['seasonLabel'];
    if (!empty($media['genres']) && is_array($media['genres'])) {
        $lines[] = 'Genres: ' . implode(', ', array_slice($media['genres'], 0, 6));
    }
    if (!empty($media['plot'])) {
        $lines[] = '';
        $lines[] = 'Overall plot:';
        $lines[] = (string) $media['plot'];
    }

    $episodes = is_array($media['episodes'] ?? null) ? $media['episodes'] : [];
    if ($episodes) {
        $lines[] = '';
        $lines[] = 'Episode synopses (chronological — base the recap on these):';
        foreach (array_slice($episodes, 0, RECAP_MAX_EPISODES) as $e) {
            if (!is_array($e)) continue;
            $n     = (int) ($e['n'] ?? 0);
            $title = trim((string) ($e['t'] ?? ''));
            $ov    = trim((string) ($e['o'] ?? ''));
            if ($ov === '' && $title === '') continue;
            $head = 'Ep ' . $n . ($title !== '' ? ' — ' . $title : '');
            $lines[] = $ov !== '' ? "$head: $ov" : $head;
        }
    }

    return implode("\n", $lines);
}

function recap_call_claude(string $system, string $user, string $model): ?array {
    $key = app_config('anthropic_api_key');
    if (!$key) return null;

    $payload = [
        'model'      => $model,
        'max_tokens' => 2500,
        'thinking'   => ['type' => 'disabled'],
        'system'     => $system,
        'messages'   => [['role' => 'user', 'content' => $user]],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => to_json($payload),
        CURLOPT_HTTPHEADER     => [
            'content-type: application/json',
            'anthropic-version: 2023-06-01',
            'x-api-key: ' . $key,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 120,
    ]);
    $raw  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$raw) return null;
    $data = json_decode($raw, true);

    // Rifiuto/errore modello: content puo' essere vuoto.
    $text = '';
    foreach (($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'text') $text .= $block['text'];
    }
    if (trim($text) === '') return null;

    return recap_parse_scenes($text);
}

function recap_parse_scenes(string $text): ?array {
    // Estrae il primo oggetto JSON dalla risposta (robusto a fence/testo attorno).
    $start = strpos($text, '{');
    $end   = strrpos($text, '}');
    if ($start === false || $end === false || $end <= $start) return null;
    $json = substr($text, $start, $end - $start + 1);
    $obj  = json_decode($json, true);
    if (!is_array($obj) || !is_array($obj['scenes'] ?? null)) return null;

    $scenes = [];
    foreach ($obj['scenes'] as $s) {
        if (!is_array($s)) continue;
        $motif = (string) ($s['motif'] ?? '');
        if (!in_array($motif, RECAP_MOTIFS, true)) continue;
        $label   = trim((string) ($s['label'] ?? ''));
        $caption = trim((string) ($s['caption'] ?? ''));
        if ($caption === '') continue;
        if (mb_strlen($caption) > RECAP_CAPTION_MAX) {
            $caption = mb_substr($caption, 0, RECAP_CAPTION_MAX - 1) . '…';
        }
        $dur = (int) ($s['dur'] ?? 4500);
        $dur = max(RECAP_DUR_MIN, min(RECAP_DUR_MAX, $dur));
        $scenes[] = [
            'motif'   => $motif,
            'label'   => mb_substr($label, 0, 40),
            'caption' => $caption,
            'dur'     => $dur,
        ];
        if (count($scenes) >= RECAP_MAX_SCENES) break;
    }

    return count($scenes) >= RECAP_MIN_SCENES ? $scenes : null;
}

function recap_get_or_generate(PDO $pdo, array $body, ?string $userId): array {
    $type   = ($body['type'] ?? '') === 'movie' ? 'movie' : 'tv';
    $tmdbId = (int) ($body['tmdbId'] ?? 0);
    $season = preg_replace('/[^a-z0-9]/i', '', (string) ($body['season'] ?? 'full')) ?: 'full';
    $lang   = normalize_locale($body['lang'] ?? 'it');
    if ($tmdbId <= 0) api_err('recap_bad_id', 400);

    $cacheKey = "$type:$tmdbId:$season:$lang";

    $stmt = $pdo->prepare('SELECT storyboard, model FROM recap_storyboard WHERE cache_key = ?');
    $stmt->execute([$cacheKey]);
    $row = $stmt->fetch();
    if ($row) {
        return [
            'scenes' => parse_json($row['storyboard'], []),
            'model'  => $row['model'],
            'cached' => true,
        ];
    }

    $plot = trim((string) ($body['plot'] ?? ''));
    if (mb_strlen($plot) > 6000) $plot = mb_substr($plot, 0, 6000);
    $episodes = is_array($body['episodes'] ?? null) ? $body['episodes'] : [];

    // Servono dati: o una trama sensata, o le sinossi degli episodi.
    if (mb_strlen($plot) < 20 && count($episodes) === 0) api_err('recap_no_plot', 400);

    $model  = (string) (app_config('recap_model') ?: RECAP_MODEL_DEFAULT);
    $system = recap_system_prompt();
    $user   = recap_user_message([
        'title'       => (string) ($body['title'] ?? ''),
        'year'        => $body['year'] ?? null,
        'type'        => $type,
        'genres'      => is_array($body['genres'] ?? null) ? $body['genres'] : [],
        'plot'        => $plot,
        'episodes'    => $episodes,
        'seasonLabel' => $season === 'full' ? 'entire series' : ('season ' . $season),
    ], recap_lang_name($lang));

    // Opus può impiegare 30-60s per un recap dettagliato: alza il limite PHP
    // (default 30s) oltre il timeout curl, altrimenti lo script viene ucciso.
    @set_time_limit(150);

    $scenes = recap_call_claude($system, $user, $model);
    if ($scenes === null) api_err('recap_unavailable', 503);

    // INSERT IGNORE: se due utenti generano in parallelo, vince il primo.
    $ins = $pdo->prepare(
        'INSERT IGNORE INTO recap_storyboard
         (cache_key, media_type, tmdb_id, season, lang, title, storyboard, model, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
        $cacheKey, $type, $tmdbId, $season, $lang,
        mb_substr((string) ($body['title'] ?? ''), 0, 255),
        to_json($scenes), $model, $userId,
    ]);

    return ['scenes' => $scenes, 'model' => $model, 'cached' => false];
}
