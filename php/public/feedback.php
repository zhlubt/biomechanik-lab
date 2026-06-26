<?php
/**
 * Serverseitiger Feedback-Endpunkt: nimmt Übungs-Adresse + Studierenden-Text,
 * ruft das LLM (Anthropic) und liefert { markers: [...] }. Der feedbackPrompt,
 * die Musterlösung und der API-Key bleiben serverseitig.
 */
require __DIR__ . '/_boot.php';
auth_boot();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Nur POST.']);
    exit;
}

// Missbrauchsschutz: Feedback nur mit (reibungsloser) Identität — so kann pro
// Nutzer gedrosselt werden statt pro IP (Seminarraum = geteilte IP!).
$u = current_user();
if ($u === null) {
    http_response_code(401);
    echo json_encode(['error' => 'login_required']);
    exit;
}

$body = json_decode((string)file_get_contents('php://input'), true);
$course   = $body['course']   ?? null;
$lesson   = $body['lesson']   ?? null;
$exercise = $body['exercise'] ?? null;
$text     = trim((string)($body['studentText'] ?? ''));

if (!$course || !$lesson || !$exercise) {
    http_response_code(400);
    echo json_encode(['error' => 'course/lesson/exercise fehlen.']);
    exit;
}
if (mb_strlen($text) < 10) {
    http_response_code(400);
    echo json_encode(['error' => 'Bitte schreibe zuerst ein paar Sätze.']);
    exit;
}
if (mb_strlen($text) > 6000) {
    http_response_code(413);
    echo json_encode(['error' => 'Dein Text ist zu lang (max. 6000 Zeichen).']);
    exit;
}

// Drosselung: 1×/Minute pro Nutzer, max. 20/Stunde; globaler Notdeckel.
$uid = (int)$u['id'];
$r = rate_check('fb:u:' . $uid, 60, 3600, 20);
if (!$r['ok']) {
    http_response_code(429);
    echo json_encode(['error' => 'cooldown', 'retry_after' => $r['retry_after']]);
    exit;
}
$g = rate_check('fb:global', 0, 60, 300);
if (!$g['ok']) {
    http_response_code(429);
    echo json_encode(['error' => 'busy', 'retry_after' => $g['retry_after']]);
    exit;
}

$ex = load_exercise(['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise]);
if ($ex === null) {
    http_response_code(404);
    echo json_encode(['error' => 'Übung nicht gefunden.']);
    exit;
}
if (empty($ex['feedbackPrompt'])) {
    http_response_code(422);
    echo json_encode(['error' => 'Kein Feedback-Prompt hinterlegt.']);
    exit;
}

try {
    $markers = get_feedback($ex, $text);
    save_submission($uid, ['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise], $text, $markers, llm_model_label());
    echo json_encode(['markers' => $markers, 'saved' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    // Keine personenbezogenen Daten loggen (DSGVO).
    error_log('[feedback.php] ' . $e->getMessage());
    http_response_code(502);
    echo json_encode(['error' => 'Feedback konnte nicht erzeugt werden.']);
}
