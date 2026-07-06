<?php

const TRANSLATE_BODY_MAX = 2000;

function translate_deepl_code(string $lang): string {
    return match (normalize_locale($lang)) {
        'en' => 'EN',
        'es' => 'ES',
        'fr' => 'FR',
        'de' => 'DE',
        default => 'IT',
    };
}

function translate_deepl(string $text, string $target, ?string $source): ?string {
    $key = app_config('deepl_auth_key');
    if (!$key) return null;

    $fields = [
        'text'        => $text,
        'target_lang' => translate_deepl_code($target),
    ];
    if ($source) {
        $fields['source_lang'] = translate_deepl_code($source);
    }

    $host = app_config('deepl_pro') ? 'https://api.deepl.com' : 'https://api-free.deepl.com';
    $ch = curl_init("$host/v2/translate");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_HTTPHEADER     => ["Authorization: DeepL-Auth-Key $key"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$raw) return null;
    $data = json_decode($raw, true);
    $out = $data['translations'][0]['text'] ?? null;
    return is_string($out) && $out !== '' ? $out : null;
}

function translate_mymemory(string $text, string $target, ?string $source): ?string {
    $target = normalize_locale($target);
    $source = $source !== null ? normalize_locale($source) : null;
    $pair = $source ? "$source|$target" : "autodetect|$target";

    $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
        'q'        => $text,
        'langpair' => $pair,
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_USERAGENT      => 'Nerdubbio/1.0',
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);

    if (!$raw) return null;
    $data = json_decode($raw, true);
    $out = $data['responseData']['translatedText'] ?? null;
    if (!is_string($out) || $out === '') return null;
    if (stripos($out, 'QUERY LENGTH LIMIT') !== false) return null;
    return $out;
}

function translate_text(string $text, string $targetLang, ?string $sourceLang = null): array {
    $text = trim($text);
    if ($text === '') {
        api_err('translate_empty', 400);
    }
    if (mb_strlen($text) > TRANSLATE_BODY_MAX) {
        api_err('translate_too_long', 400);
    }

    $target = normalize_locale($targetLang);
    $source = $sourceLang !== null ? normalize_locale($sourceLang) : null;
    if ($source && $source === $target) {
        return ['text' => $text, 'provider' => 'none'];
    }

    $translated = translate_deepl($text, $target, $source);
    $provider = 'deepl';
    if ($translated === null) {
        $translated = translate_mymemory($text, $target, $source);
        $provider = 'mymemory';
    }
    if ($translated === null) {
        api_err('translate_unavailable', 503);
    }

    return [
        'text'     => $translated,
        'provider' => $provider,
        'target'   => $target,
        'source'   => $source,
    ];
}
