<?php

/** Errori API machine-readable — tradotti lato client via apiErrors.* */
function api_err(string $code, int $status = 400, array $vars = []): never {
    json_out(['error' => $code, 'errorVars' => $vars ?: (object) []], $status);
}
