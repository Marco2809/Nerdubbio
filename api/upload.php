<?php
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';
cors();

require_auth();

const UPLOAD_MAX_BYTES = 5242880; // 5 MB
const UPLOAD_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];

$file = $_FILES['file'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    api_err('upload_failed', 400);
}
if (($file['size'] ?? 0) > UPLOAD_MAX_BYTES) {
    api_err('upload_too_large', 400, ['max' => UPLOAD_MAX_BYTES]);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);
if (!isset(UPLOAD_TYPES[$mime])) {
    api_err('upload_bad_type', 400);
}

$dir = __DIR__ . '/uploads';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
if (!is_dir($dir) || !is_writable($dir)) {
    api_err('upload_dir_unavailable', 500);
}

$name = uuid() . '.' . UPLOAD_TYPES[$mime];
if (!move_uploaded_file($file['tmp_name'], "$dir/$name")) {
    api_err('upload_failed', 500);
}
@chmod("$dir/$name", 0644);

json_out(['url' => '/api/uploads/' . $name]);
