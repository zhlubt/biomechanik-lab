<?php
/**
 * Zentrale Konfiguration (liegt unter private/, NICHT web-ausgeliefert).
 * Liest Secrets aus private/.env (ANTHROPIC_API_KEY, PFLEGE_PASSWORD).
 */
declare(strict_types=1);

define('PRIVATE_DIR', __DIR__);
define('CONTENT_DIR', __DIR__ . '/content');

/** Lädt KEY=VALUE-Zeilen aus private/.env (einfacher Parser, ohne Abhängigkeit). */
function app_load_env(): array {
    static $env = null;
    if ($env !== null) return $env;
    $env = [];
    $file = PRIVATE_DIR . '/.env';
    if (is_readable($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (!preg_match('/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $m)) continue;
            $v = $m[2];
            if ((str_starts_with($v, '"') && str_ends_with($v, '"')) ||
                (str_starts_with($v, "'") && str_ends_with($v, "'"))) {
                $v = substr($v, 1, -1);
            }
            $env[$m[1]] = $v;
        }
    }
    return $env;
}

/** Liest eine Variable: erst echte Umgebungsvariable (Docker), dann private/.env. */
function app_env(string $key, ?string $default = null): ?string {
    $v = getenv($key);
    if ($v !== false && $v !== '') return $v;
    $env = app_load_env();
    return $env[$key] ?? $default;
}

const ANTHROPIC_MODEL_DEFAULT = 'claude-opus-4-8';

// NHR@FAU "LLMs as a Service" (Uni Erlangen-Nuernberg), OpenAI-kompatibles Gateway.
// Default ist gpt-oss-120b: ~17 s statt ~30 s bei gleicher Zitattreue. Qwen3.6-35B-A3B
// ist das Reasoning-Alternativmodell und kann zusaetzlich Bilder lesen (Designer-Modus).
const NHR_BASE_URL_DEFAULT = 'https://hub.nhr.fau.de/api/llmgw/v1';
const NHR_MODEL_DEFAULT    = 'gpt-oss-120b';
const NHR_SERVICE_LABEL    = 'NHR@FAU Erlangen-Nürnberg';
