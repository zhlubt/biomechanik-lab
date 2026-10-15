<?php
/**
 * Liefert die Experten-/Musterlösung einer Übung auf Anfrage.
 *
 * Warum ein eigener Endpunkt: vorher stand die Musterlösung im HTML der
 * Übungsseite und war nur per Knopf eingeblendet — über „Seitenquelltext
 * anzeigen" konnte sie jede:r lesen, bevor überhaupt geschrieben wurde. Das
 * untergräbt die Kernschleife (erst beschreiben, dann vergleichen).
 * Jetzt verlässt sie den Server erst auf ausdrückliche Anforderung.
 */
require __DIR__ . '/_boot.php';
auth_boot();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Nur POST.']);
    exit;
}
csrf_require();

if (!is_logged_in()) {
    http_response_code(401);
    echo json_encode(['error' => 'login_required']);
    exit;
}

$body     = json_decode((string)file_get_contents('php://input'), true);
$course   = $body['course']   ?? null;
$lesson   = $body['lesson']   ?? null;
$exercise = $body['exercise'] ?? null;
if (!$course || !$lesson || !$exercise) {
    http_response_code(400);
    echo json_encode(['error' => 'course/lesson/exercise fehlen.']);
    exit;
}

$ex = load_exercise(['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise]);
if ($ex === null) {
    http_response_code(404);
    echo json_encode(['error' => 'Übung nicht gefunden.']);
    exit;
}

$solution = trim((string)($ex['modelSolution'] ?? ''));
if ($solution === '') {
    echo json_encode(['solution' => '', 'empty' => true]);
    exit;
}

echo json_encode(['solution' => $solution], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
