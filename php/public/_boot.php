<?php
/**
 * Bootstrap für alle öffentlichen Skripte: bindet die private Konfiguration +
 * Logik ein. Auf dem Server liegt private/ unter /var/www/private, lokal als
 * Geschwisterordner von public/.
 */
declare(strict_types=1);
$priv = is_dir('/var/www/private') ? '/var/www/private' : realpath(__DIR__ . '/../private');
require $priv . '/lib/lib.php';

// Basis-Sicherheits-Header für alle Antworten (kein CSP, um three.js-CDN/Inline-Skripte
// nicht zu brechen). Verhindert MIME-Sniffing, Clickjacking, Referrer-Leaks.
if (PHP_SAPI !== 'cli' && !headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
