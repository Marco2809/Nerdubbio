<?php

// Proxy GIPHY: la chiave resta lato server (giphy_api_key in config.php).

function giphy_request(string $path, array $params): ?array {
    $key = app_config('giphy_api_key');
    if (!$key) return null;

    $params['api_key'] = $key;
    $params['rating']  = 'pg-13';
    $ch = curl_init('https://api.giphy.com/v1/gifs/' . $path . '?' . http_build_query($params));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
    $raw  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !$raw) return null;

    $data = json_decode($raw, true);
    if (!is_array($data['data'] ?? null)) return null;

    $out = [];
    foreach ($data['data'] as $g) {
        $img = $g['images'] ?? [];
        $preview = $img['fixed_width_downsampled']['url'] ?? $img['fixed_width_small']['url'] ?? $img['preview_gif']['url'] ?? null;
        $full    = $img['fixed_width']['url'] ?? $img['downsized']['url'] ?? $preview;
        if (!$full) continue;
        $out[] = ['id' => (string) ($g['id'] ?? ''), 'preview' => $preview ?? $full, 'url' => $full];
    }
    return $out;
}

function giphy_trending(int $offset): array {
    $r = giphy_request('trending', ['limit' => 24, 'offset' => max(0, $offset)]);
    if ($r === null) api_err('giphy_unavailable', 503);
    return ['gifs' => $r];
}

function giphy_search(string $q, int $offset, string $lang): array {
    $q = trim($q);
    if ($q === '') return giphy_trending($offset);
    $r = giphy_request('search', ['q' => $q, 'limit' => 24, 'offset' => max(0, $offset), 'lang' => $lang]);
    if ($r === null) api_err('giphy_unavailable', 503);
    return ['gifs' => $r];
}
