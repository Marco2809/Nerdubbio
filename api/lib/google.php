<?php

function google_b64url_decode(string $s): string {
    $r = strlen($s) % 4;
    if ($r) $s .= str_repeat('=', 4 - $r);
    return base64_decode(strtr($s, '-_', '+/')) ?: '';
}

function google_fetch_certs(): array {
    $cache = sys_get_temp_dir() . '/nerdubbio_google_certs.json';
    if (is_file($cache) && (time() - filemtime($cache) < 3600)) {
        $data = json_decode((string) file_get_contents($cache), true);
        if (is_array($data) && $data) return $data;
    }

    $url = 'https://www.googleapis.com/oauth2/v1/certs';
    $json = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6]);
        $json = curl_exec($ch);
        curl_close($ch);
    }
    if ($json === false) {
        $ctx  = stream_context_create(['http' => ['timeout' => 6]]);
        $json = @file_get_contents($url, false, $ctx);
    }
    if ($json === false) return [];

    $data = json_decode((string) $json, true);
    if (!is_array($data)) return [];
    @file_put_contents($cache, $json);
    return $data;
}

function verify_google_id_token(string $idToken, string $clientId): ?array {
    if (!$clientId) return null;

    $parts = explode('.', $idToken);
    if (count($parts) !== 3) return null;
    [$h64, $p64, $s64] = $parts;

    $header  = json_decode(google_b64url_decode($h64), true);
    $payload = json_decode(google_b64url_decode($p64), true);
    if (!is_array($header) || !is_array($payload)) return null;
    if (($header['alg'] ?? '') !== 'RS256') return null;

    $pem = google_fetch_certs()[$header['kid'] ?? ''] ?? null;
    if (!$pem) return null;

    $sig = google_b64url_decode($s64);
    if (openssl_verify("$h64.$p64", $sig, $pem, OPENSSL_ALGO_SHA256) !== 1) return null;

    $iss = $payload['iss'] ?? '';
    if ($iss !== 'https://accounts.google.com' && $iss !== 'accounts.google.com') return null;
    if (($payload['aud'] ?? '') !== $clientId) return null;
    if ((int) ($payload['exp'] ?? 0) < time()) return null;

    return $payload;
}
