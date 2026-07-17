<?php

// Genera (e mette in cache) lo storyboard di un video-recap a partire dalla trama.
// L'unico costo AI e' una singola chiamata di testo per serie+stagione+lingua:
// il rendering del video e' codice deterministico lato client. Vedi RecapReel.tsx.

const RECAP_MODEL_DEFAULT = 'claude-opus-4-8';
const RECAP_MIN_SCENES = 6;
const RECAP_MAX_SCENES = 18;
const RECAP_DUR_MIN = 3200;
const RECAP_DUR_MAX = 6500;
const RECAP_CAPTION_MAX = 155;
const RECAP_MAX_EPISODES = 30;
const RECAP_MAX_CAST = 15;

// Layout dello Story Journey supportati dal renderer (storyScene.tsx).
const RECAP_LAYOUTS = [
    'hero', 'motif', 'character-card', 'quote', 'timeline', 'big-reveal',
    'stat', 'map', 'relationship-graph', 'split-screen', 'threads', 'ending',
];

const RECAP_EMOTIONS = [
    'hope', 'fear', 'tension', 'grief', 'joy', 'anger', 'dread',
    'triumph', 'betrayal', 'love', 'despair', 'awe', 'suspense', 'shock',
];

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
You are the storyboard director for Nerdubbio. You produce a "Story Journey": a short cinematic reel that lets someone who watched this season years ago REMEMBER it in ~40-60 seconds. Not a summary, not slides — a memory reconstruction where each scene lands one memorable idea.

You output a sequence of SCENES. Each scene has a LAYOUT and fills ONLY the fields that layout needs. Ground everything in the provided plot/episode synopses AND your reliable knowledge of THIS specific title (real character names, who dies, betrayals, twists, the cliffhanger). Never contradict the synopses. If you don't truly know the title, rely only on the given data and stay accurate — never invent. Never invent quotes.

CHARACTERS: a CAST list is provided (character name — actor). These are the REAL names — use them EXACTLY as written whenever you name someone. Never rename a character, never merge two characters, never invent a character who is not in the cast or clearly named in the synopses. Every important recurring character of this season should appear at least once (character-card, relationship-graph or split-screen). When a scene involves a person, prefer stating who they are (role/allegiance) so a viewer instantly recognizes them.

MOTIF ids (for fields that take a "motif"; use ONLY these):
$motifs

LAYOUTS (vary them — never the same layout twice in a row):
- hero: opening title card. Fields: title (show/season), subtitle (the hook), motif. Use ONCE, first.
- motif: one animated symbol + a caption. Fields: motif, title (2-3 word chip), subtitle (the concrete event, 12-20 words). The main workhorse beat.
- character-card: focus one character. Fields: title (character name), subtitle (their arc in one line), motif (optional).
- quote: an iconic VERBATIM line. Fields: quote{text, speaker}, title (short context). Use only if you know a real line.
- timeline: a few chronological beats at once. Fields: title (header), items (3-5 very short beats).
- big-reveal: a shocking turn. Fields: title (the reveal), subtitle, motif (danger/secret/betrayal/mystery).
- stat: numbers that define the season. Fields: title (header), stats (1-3 {label, value}, e.g. morti/stagioni/episodi).
- map: a key place. Fields: title (location name), subtitle, motif (map->journey/home/city).
- relationship-graph: a bond between two people. Fields: characters (exactly 2 {name}), subtitle (the relation or what changed between them).
- split-screen: contrast two forces/characters. Fields: characters (2 {name, note}) or title+subtitle.
- threads: "where we left off" memory sheet — the open questions and unresolved plot threads the viewer MUST remember before the next season. Fields: title (e.g. "Da ricordare"), items (3-5 short open threads/questions, each naming who/what), subtitle (the single most burning question). Use ONCE, right before the ending. THIS IS THE MOST USEFUL SCENE: be specific.
- ending: nostalgic closer. Fields: title, subtitle. Use ONCE, last.

RULES:
- 10-18 scenes, and SCALE with the season length: cover every major turning point of the season in chronological order — do not skip beats to save space. A season with many episodes needs more scenes. Start with a hero, end with an ending.
- COMPLETENESS over cleverness: every major death, betrayal, reveal, alliance, and the season-ending cliffhanger MUST appear as its own scene. If you must choose, prefer telling one more real fact over a decorative beat. Never leave a central plot thread unmentioned.
- Be SPECIFIC: name real characters (from the CAST) and state exactly what happened (a death, a betrayal, a reveal). No vague filler ("affrontano nuove sfide", "molti", "vari", "qualcosa cambia").
- EVERY scene MUST have a "subtitle": one clear sentence (12-24 words, target language) that makes the scene understandable on its own. A relationship-graph, split-screen or character-card whose subtitle does not explain who the people are and what happens between them is forbidden.
- Fill the fields the layout needs (relationship-graph and split-screen also need the character names in "characters"); omit only fields the layout truly does not use.
- stat: "value" must be a concrete number or short fact ("10", "4 morti"), never a vague word like "molti".
- quote: only a real verbatim line; keep it in the language it is famous in.
- title: short. items/notes: short. dur: milliseconds 3500-6500. Optionally set "emotion".
- ep: when a beat happens in a specific episode, set "ep" to that episode number — it helps the viewer place the memory ("ah, that was episode 4"). Omit it for scenes spanning the whole season (hero, stat, threads, ending).
- The reel MUST end with: threads (what to remember) then ending.

Respond with ONLY the JSON object matching the schema.
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

    $cast = is_array($media['cast'] ?? null) ? $media['cast'] : [];
    if ($cast) {
        $lines[] = '';
        $lines[] = 'CAST (character — actor; use these exact character names):';
        foreach (array_slice($cast, 0, RECAP_MAX_CAST) as $c) {
            if (!is_array($c)) continue;
            $char = trim((string) ($c['c'] ?? ''));
            if ($char === '') continue;
            $actor = trim((string) ($c['a'] ?? ''));
            $lines[] = $actor !== '' ? "- $char — $actor" : "- $char";
        }
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

// Schema strict per gli structured outputs: scene ricche con layout + campi
// per-layout. Ogni scena riempie solo i campi che il suo layout usa.
function recap_output_schema(): array {
    $strObj = fn (array $props, array $req) => [
        'type' => 'object', 'additionalProperties' => false,
        'properties' => $props, 'required' => $req,
    ];
    $scene = $strObj([
        'layout'     => ['type' => 'string', 'enum' => array_values(RECAP_LAYOUTS)],
        'title'      => ['type' => 'string'],
        'subtitle'   => ['type' => 'string'],
        'motif'      => ['type' => 'string', 'enum' => array_values(RECAP_MOTIFS)],
        'emotion'    => ['type' => 'string', 'enum' => array_values(RECAP_EMOTIONS)],
        'characters' => ['type' => 'array', 'items' => $strObj(
            ['name' => ['type' => 'string'], 'note' => ['type' => 'string']], ['name'],
        )],
        'quote'      => $strObj(
            ['text' => ['type' => 'string'], 'speaker' => ['type' => 'string']], ['text'],
        ),
        'stats'      => ['type' => 'array', 'items' => $strObj(
            ['label' => ['type' => 'string'], 'value' => ['type' => 'string']], ['label', 'value'],
        )],
        'items'      => ['type' => 'array', 'items' => ['type' => 'string']],
        'ep'         => ['type' => 'integer'],
        'dur'        => ['type' => 'integer'],
    ], ['layout', 'title', 'subtitle', 'dur']);

    return [
        'type' => 'object', 'additionalProperties' => false,
        'properties' => ['scenes' => ['type' => 'array', 'items' => $scene]],
        'required' => ['scenes'],
    ];
}

function recap_call_claude(string $system, string $user, string $model): ?array {
    $key = app_config('anthropic_api_key');
    if (!$key) return null;

    // Niente thinking: la qualità arriva dal grounding (cast) e dalle regole di
    // completezza del prompt. Il thinking adattivo, quando si attivava, allungava
    // i tempi e/o troncava il JSON oltre max_tokens (-> recap_unavailable), in modo
    // incostante. Senza thinking la generazione è deterministica e veloce (~20s).
    $payload = [
        'model'         => $model,
        'max_tokens'    => 6000,
        'thinking'      => ['type' => 'disabled'],
        'system'        => $system,
        'messages'      => [['role' => 'user', 'content' => $user]],
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => recap_output_schema()]],
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
        $layout = (string) ($s['layout'] ?? '');
        if (!in_array($layout, RECAP_LAYOUTS, true)) continue;
        $title = trim((string) ($s['title'] ?? ''));
        if ($title === '') continue;

        $scene = ['layout' => $layout, 'title' => mb_substr($title, 0, 80)];

        if (!empty($s['subtitle'])) {
            $scene['subtitle'] = mb_substr(trim((string) $s['subtitle']), 0, RECAP_CAPTION_MAX);
        }
        if (!empty($s['motif']) && in_array($s['motif'], RECAP_MOTIFS, true)) {
            $scene['motif'] = (string) $s['motif'];
        }
        if (!empty($s['emotion']) && in_array($s['emotion'], RECAP_EMOTIONS, true)) {
            $scene['emotion'] = (string) $s['emotion'];
        }
        if (!empty($s['characters']) && is_array($s['characters'])) {
            $cs = [];
            foreach (array_slice($s['characters'], 0, 4) as $c) {
                if (!is_array($c) || empty($c['name'])) continue;
                $cs[] = [
                    'name' => mb_substr((string) $c['name'], 0, 40),
                    'note' => isset($c['note']) ? mb_substr((string) $c['note'], 0, 60) : '',
                ];
            }
            if ($cs) $scene['characters'] = $cs;
        }
        if (!empty($s['quote']['text'])) {
            $scene['quote'] = [
                'text'    => mb_substr((string) $s['quote']['text'], 0, 160),
                'speaker' => isset($s['quote']['speaker']) ? mb_substr((string) $s['quote']['speaker'], 0, 40) : '',
            ];
        }
        if (!empty($s['stats']) && is_array($s['stats'])) {
            $st = [];
            foreach (array_slice($s['stats'], 0, 3) as $x) {
                if (!is_array($x) || !isset($x['value'])) continue;
                $st[] = [
                    'label' => mb_substr((string) ($x['label'] ?? ''), 0, 24),
                    'value' => mb_substr((string) $x['value'], 0, 12),
                ];
            }
            if ($st) $scene['stats'] = $st;
        }
        if (!empty($s['items']) && is_array($s['items'])) {
            $it = [];
            foreach (array_slice($s['items'], 0, 6) as $i) {
                $v = trim((string) $i);
                if ($v !== '') $it[] = mb_substr($v, 0, 80);
            }
            if ($it) $scene['items'] = $it;
        }

        $ep = (int) ($s['ep'] ?? 0);
        if ($ep >= 1 && $ep <= 999) $scene['ep'] = $ep;

        $dur = (int) ($s['dur'] ?? 4800);
        $scene['dur'] = max(RECAP_DUR_MIN, min(RECAP_DUR_MAX, $dur));

        $scenes[] = $scene;
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

    // v2: formato con scena "threads" (da ricordare) + riferimenti episodio.
    // Il bump rigenera gli storyboard alla prossima apertura (pre-gen inclusa).
    $cacheKey = "$type:$tmdbId:$season:$lang:v2";

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
        'cast'        => is_array($body['cast'] ?? null) ? $body['cast'] : [],
        'plot'        => $plot,
        'episodes'    => $episodes,
        'seasonLabel' => $season === 'full' ? 'entire series' : ('season ' . $season),
    ], recap_lang_name($lang));

    // Opus impiega ~20-40s per un recap: alza il limite PHP (default 30s) oltre il
    // timeout curl, altrimenti lo script viene ucciso prima della risposta.
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
