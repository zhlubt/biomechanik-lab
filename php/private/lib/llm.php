<?php
/**
 * LLM-Provider-Abstraktion. Drei Adapter: Anthropic (Claude), OpenAI (ChatGPT)
 * und NHR@FAU (LLMs as a Service der Uni Erlangen-Nuernberg, OpenAI-kompatibel).
 * Auswahl via LLM_PROVIDER oder opts['provider'].
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
    $p = $override ?: app_env('LLM_PROVIDER', 'nhr');
    return in_array($p, ['openai', 'nhr', 'anthropic'], true) ? $p : 'nhr';
}

/** Modell-Default je Provider. */
function llm_default_model(string $provider): string {
    if ($provider === 'openai') return app_env('OPENAI_MODEL', 'gpt-5.2');
    if ($provider === 'nhr')    return app_env('NHR_MODEL', NHR_MODEL_DEFAULT);
    return app_env('ANTHROPIC_MODEL', ANTHROPIC_MODEL_DEFAULT);
}

/** Label „provider:model" für Protokollierung (welches Modell erzeugte das Feedback). */
function llm_model_label(?string $providerOverride = null): string {
    $p = llm_active_provider($providerOverride);
    return $p . ':' . llm_default_model($p);
}

/**
 * Woher kommt das Feedback? Wird Studierenden sichtbar angezeigt (Transparenz:
 * welches Modell auf wessen Rechner hat den Text gelesen).
 * Liefert ['model'=>…, 'service'=>…] - bei Anthropic/OpenAI die jeweilige Firma.
 */
function llm_provenance(?string $providerOverride = null): array {
    $p = llm_active_provider($providerOverride);
    $service = $p === 'nhr' ? NHR_SERVICE_LABEL : ($p === 'openai' ? 'OpenAI' : 'Anthropic');
    return ['model' => llm_default_model($p), 'service' => $service];
}

/** Einzeiler fuer die Oberflaeche, z. B. „gpt-oss-120b · NHR@FAU Erlangen-Nürnberg". */
function llm_provenance_text(?string $providerOverride = null): string {
    $x = llm_provenance($providerOverride);
    return $x['model'] . ' · ' . $x['service'];
}

/**
 * Das in der Abgabe gespeicherte Kuerzel „provider:model" lesbar machen.
 * Historische Eintraege (anthropic:…) bleiben korrekt beschriftet.
 */
function llm_label_pretty(string $stored): string {
    if ($stored === '') return 'unbekannt';
    $pos = strpos($stored, ':');
    if ($pos === false) return $stored;
    $prov = substr($stored, 0, $pos);
    $model = substr($stored, $pos + 1);
    $service = $prov === 'nhr' ? NHR_SERVICE_LABEL : ($prov === 'openai' ? 'OpenAI' : ($prov === 'anthropic' ? 'Anthropic' : $prov));
    return $model . ' · ' . $service;
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

    if ($provider === 'anthropic') {
        return llm_json_anthropic($system, $parts, $schema, $maxTok, $model, $timeout);
    }
    if ($provider === 'nhr') {
        // NHR@FAU faehrt ueberwiegend Reasoning-Modelle (Qwen3, DeepSeek): die Denkspur
        // zaehlt gegen max_tokens. Zu knapp bemessen bricht die Antwort VOR dem JSON ab
        // (finish_reason=length, content=null) - deshalb ein Mindestbudget.
        $floor = (int)app_env('NHR_MAX_TOKENS_FLOOR', '4000');
        return llm_json_oai_compatible(
            'NHR@FAU',
            rtrim(app_env('NHR_BASE_URL', NHR_BASE_URL_DEFAULT), '/') . '/chat/completions',
            (string)(app_env('NHR_API_KEY') ?? ''),
            $model ?: llm_default_model('nhr'),
            $system, $parts, $schema, max($maxTok, $floor), $timeout
        );
    }
    return llm_json_openai($system, $parts, $schema, $maxTok, $model, $timeout);
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

/* ---------- Generischer OpenAI-kompatibler Adapter (NHR@FAU u. a.) ---------- */
/**
 * Spricht jeden Dienst mit /chat/completions-Schnittstelle an. $label geht nur in
 * Fehlermeldungen ein, damit im Log steht, welcher Dienst geklemmt hat.
 */
function llm_json_oai_compatible(string $label, string $url, string $apiKey, string $model,
                                 string $system, array $parts, array $schema, int $maxTok, int $timeout): array {
    if ($apiKey === '') throw new RuntimeException($label . ': API-Key fehlt (NHR_API_KEY in private/.env).');

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
        'max_tokens' => $maxTok,
        'messages' => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userContent],
        ],
        'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'result', 'strict' => true, 'schema' => $schema]],
    ];
    [$code, $resp, $err] = llm_http_post($url, [
        'content-type: application/json',
        'authorization: Bearer ' . $apiKey,
    ], $body, $timeout);
    if ($resp === '') throw new RuntimeException('Netzwerkfehler (' . $label . '): ' . $err);
    // Bewusst OHNE Antwortkoerper: der kann die gesendete Anfrage spiegeln.
    if ($code < 200 || $code >= 300) throw new RuntimeException($label . '-HTTP ' . $code);

    $data   = json_decode($resp, true);
    $choice = $data['choices'][0] ?? [];
    $text   = $choice['message']['content'] ?? null;

    // Reasoning-Modell ohne Budget fuer die Antwort: die Denkspur hat max_tokens aufgebraucht.
    if (($text === null || $text === '') && ($choice['finish_reason'] ?? '') === 'length') {
        throw new RuntimeException($label . ': Antwort nach der Denkspur abgeschnitten (max_tokens zu klein für ' . $model . ').');
    }
    $parsed = json_decode((string)$text, true);
    if (!is_array($parsed)) throw new RuntimeException($label . '-Antwort war kein JSON.');
    return $parsed;
}
