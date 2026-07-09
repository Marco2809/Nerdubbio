<?php
// Copia questo file in config.php e compila con i tuoi dati.
// NON mettere config.php su git!

return [
    'db_host' => 'localhost',
    'db_name' => 'nerdubbio',
    'db_user' => 'nerdubbio_user',
    'db_pass' => 'PASSWORD_SICURA_QUI',

    // php -r "echo bin2hex(random_bytes(32));"
    'jwt_secret' => 'CAMBIA_QUESTA_STRINGA_LUNGA_E_CASUALE',

    'google_client_id' => '',

    'app_url' => 'https://nerdubbio.cocoon-ms.it',

    // SMTP opzionale per reset password (es. smtps.aruba.it)
    'smtp_host'      => '',
    'smtp_port'      => 465,
    'smtp_secure'    => 'ssl',
    'smtp_user'      => '',
    'smtp_pass'      => '',
    'smtp_from'      => 'no-reply@cocoon-ms.it',
    'smtp_from_name' => 'Nerdubbio',

    // Traduzione commenti (DeepL free/pro — opzionale; senza chiave usa MyMemory)
    'deepl_auth_key' => '',
    'deepl_pro'      => false,

    // Video-recap AI (opzionale). Senza chiave il pulsante "Genera recap" resta
    // inattivo. Chiave da console.anthropic.com. recap_model opzionale.
    'anthropic_api_key' => '',
    'recap_model'       => 'claude-sonnet-5',
];
