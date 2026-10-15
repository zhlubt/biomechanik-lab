<?php
/**
 * Sitzung + CSRF-Schutz, zentral.
 *
 * Warum eigene Funktion statt session_start(): Hinter dem ZHL-Reverse-Proxy
 * sieht PHP kein $_SERVER['HTTPS'] — die Sitzungs- und Gerätecookies wären
 * sonst ohne `Secure` unterwegs. Das Gerätecookie ist ein JAHRESLANG gültiger
 * Anmeldeschlüssel; es darf nie im Klartext über das Netz gehen.
 */
declare(strict_types=1);

/** Läuft die Anfrage über HTTPS? Berücksichtigt den vorgelagerten Proxy. */
function is_https(): bool {
    $h = $_SERVER['HTTPS'] ?? '';
    if ($h !== '' && strtolower((string)$h) !== 'off') return true;
    $p = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    if ($p !== '') return str_contains($p, 'https');
    if ((string)($_SERVER['HTTP_X_FORWARDED_SSL'] ?? '') === 'on') return true;
    return ((int)($_SERVER['SERVER_PORT'] ?? 0)) === 443;
}

/** Sitzung mit sicheren Cookie-Eigenschaften starten (idempotent). */
function app_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    if (!headers_sent()) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => is_https(),
            'httponly' => true,
            'samesite' => 'Lax', // schützt zusammen mit dem CSRF-Token vor fremden POSTs
        ]);
        ini_set('session.use_strict_mode', '1'); // keine fremd gesetzten Sitzungs-IDs
    }
    session_start();
}

/* ---------- CSRF ---------- */

/** Token der aktuellen Sitzung (wird bei Bedarf erzeugt). */
function csrf_token(): string {
    app_session_start();
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Mitgeschicktes Token einsammeln: Header (fetch) oder Formularfeld. */
function csrf_supplied(): string {
    $h = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (is_string($h) && $h !== '') return $h;
    $f = $_POST['csrf'] ?? '';
    return is_string($f) ? $f : '';
}

/** Stimmt das Token? */
function csrf_valid(): bool {
    app_session_start();
    $have = $_SESSION['csrf'] ?? '';
    $got  = csrf_supplied();
    return is_string($have) && $have !== '' && $got !== '' && hash_equals($have, $got);
}

/**
 * Harter Riegel für schreibende Endpunkte. $asJson steuert nur das Antwortformat.
 * Bricht die Anfrage mit 403 ab, wenn das Token fehlt oder nicht passt.
 */
function csrf_require(bool $asJson = true): void {
    if (csrf_valid()) return;
    http_response_code(403);
    if ($asJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden.']);
    } else {
        echo 'Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden.';
    }
    exit;
}

/** Verstecktes Formularfeld. */
function csrf_field(): string {
    return '<input type="hidden" name="csrf" value="' . htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}
