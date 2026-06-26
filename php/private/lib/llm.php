<?php
/**
 * LLM-Provider-Abstraktion. Default = Anthropic (Claude). OpenAI (ChatGPT) als
 * austauschbarer Adapter (via LLM_PROVIDER=openai oder opts['provider']).
 * Einheitliche Funktion llm_json(): erzwingt strukturiertes JSON nach Schema.
 * Unterstützt Text + Bild (Vision) für den Designer-Modus (Phase 5).
 *
 * Konfiguration (private/.env):
 *   ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL (Default claude-opus-4-8)
 *   OPENAI_API_KEY, optional OPENAI_MODEL (Default gpt-5.2)
 *   optional LLM_PROVIDER=anthropic|openai
 */
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

/** Generischer JSON-POST. Gibt [httpCode, bodyString, curlError] zurück. */
function llm_http_post(string $url, array $headers, array $body, int $timeout = 60): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    return [$code, $resp === false ? '' : (string)$resp, $err];
}

/** Welcher Provider ist aktiv? */
function llm_active_provider(?string $override = null): string {
    $p = $override ?: app_env('LLM_PROVIDER', 'anthropic');
    return ($p === 'openai') ? 'openai' : 'anthropic';
}

/** Label „provider:model" für Protokollierung (welches Modell erzeugte das Feedback). */
function llm_model_label(?string $providerOverride = null): string {
    $p = llm_active_provider($providerOverride);
    $m = $p === 'openai' ? app_env('OPENAI_MODEL', 'gpt-5.2') : app_env('ANTHROPIC_MODEL', ANTHROPIC_MODEL_DEFAULT);
    return $p . ':' . $m;
}

/** Nutzer-Inhalt normalisieren: String -> [text-Part]; sonst Part-Liste durchreichen.
 *  Part-Formen: ['type'=>'text','text'=>…] | ['type'=>'image','mime'=>…,'data_b64'=>…] */
function llm_normalize_parts($user): array {
    if (is_string($user)) return [['type' => 'text', 'text' => $user]];
    if (is_array($user) && isset($user['type'])) return [$user];
    return is_array($user) ? $user : [['type' => 'text', 'text' => (string)$user]];
}

/**
 * Einheitlicher Aufruf. $a = [
 *   'system'=>string, 'user'=>string|parts[], 'schema'=>array (JSON-Schema),
 *   'max_tokens'=>int, 'provider'=>?string, 'model'=>?string, 'timeout'=>int
 * ]. Liefert das geparste, schema-konforme Array. Wirft RuntimeException.
 */
function llm_json(array $a): array {
    $provider = llm_active_provider($a['provider'] ?? null);
    $parts    = llm_normalize_parts($a['user'] ?? '');
    $system   = (string)($a['system'] ?? '');
    $schema   = $a['schema'] ?? ['type' => 'object'];
    $maxTok   = (int)($a['max_tokens'] ?? 2000);
    $timeout  = (int)($a['timeout'] ?? 60);
    $model    = $a['model'] ?? null;

    return $provider === 'openai'
        ? llm_json_openai($system, $parts, $schema, $maxTok, $model, $timeout)
        : llm_json_anthropic($system, $parts, $schema, $maxTok, $model, $timeout);
}

/* ---------- Anthropic ---------- */
function llm_json_anthropic(string $system, array $parts, array $schema, int $maxTok, ?string $model, int $timeout): array {
    $apiKey = app_env('ANTHROPIC_API_KEY');
    if (!$apiKey) throw new RuntimeException('ANTHROPIC_API_KEY fehlt.');
    $model = $model ?: app_env('ANTHROPIC_MODEL', ANTHROPIC_MODEL_DEFAULT);

    $content = [];
    foreach ($parts as $p) {
        if (($p['type'] ?? '') === 'image') {
            $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $p['mime'], 'data' => $p['data_b64']]];
        } else {
            $content[] = ['type' => 'text', 'text' => (string)($p['text'] ?? '')];
        }
    }
    $body = [
        'model' => $model,
        'max_tokens' => $maxTok,
        'system' => $system,
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
        'messages' => [['role' => 'user', 'content' => $content]],
    ];
    [$code, $resp, $err] = llm_http_post('https://api.anthropic.com/v1/messages', [
        'content-type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ], $body, $timeout);
    if ($resp === '') throw new RuntimeException('Netzwerkfehler (Anthropic): ' . $err);
    if ($code < 200 || $code >= 300) throw new RuntimeException('Anthropic-HTTP ' . $code);

    $data = json_decode($resp, true);
    $text = '';
    foreach (($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'text') $text .= $block['text'] ?? '';
    }
    $parsed = json_decode($text, true);
    if (!is_array($parsed)) throw new RuntimeException('Anthropic-Antwort war kein JSON.');
    return $parsed;
}

/* ---------- OpenAI (ChatGPT) ---------- */
function llm_json_openai(string $system, array $parts, array $schema, int $maxTok, ?string $model, int $timeout): array {
    $apiKey = app_env('OPENAI_API_KEY');
    if (!$apiKey) throw new RuntimeException('OPENAI_API_KEY fehlt (für ChatGPT erst in private/.env hinterlegen).');
    $model = $model ?: app_env('OPENAI_MODEL', 'gpt-5.2');

    $userContent = [];
    foreach ($parts as $p) {
        if (($p['type'] ?? '') === 'image') {
            $userContent[] = ['type' => 'image_url', 'image_url' => ['url' => 'data:' . $p['mime'] . ';base64,' . $p['data_b64']]];
        } else {
            $userContent[] = ['type' => 'text', 'text' => (string)($p['text'] ?? '')];
        }
    }
    $body = [
        'model' => $model,
        'max_completion_tokens' => $maxTok,
        'messages' => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userContent],
        ],
        'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'result', 'strict' => true, 'schema' => $schema]],
    ];
    [$code, $resp, $err] = llm_http_post('https://api.openai.com/v1/chat/completions', [
        'content-type: application/json',
        'authorization: Bearer ' . $apiKey,
    ], $body, $timeout);
    if ($resp === '') throw new RuntimeException('Netzwerkfehler (OpenAI): ' . $err);
    if ($code < 200 || $code >= 300) throw new RuntimeException('OpenAI-HTTP ' . $code);

    $data = json_decode($resp, true);
    $text = $data['choices'][0]['message']['content'] ?? '';
    $parsed = json_decode((string)$text, true);
    if (!is_array($parsed)) throw new RuntimeException('OpenAI-Antwort war kein JSON.');
    return $parsed;
}
