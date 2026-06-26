<?php
/**
 * Pflege-Speichern: schreibt die pflegbaren Übungsfelder (Prompts, Musterlösung,
 * Prosa) zurück in die Content-JSON. Nur mit gültiger Pflege-Anmeldung (Session).
 */
require __DIR__ . '/_boot.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['pflege_auth'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Nicht angemeldet.']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Nur POST.']);
    exit;
}

$body     = json_decode((string)file_get_contents('php://input'), true);
$course   = $body['course']   ?? null;
$lesson   = $body['lesson']   ?? null;
$exercise = $body['exercise'] ?? null;
$fields   = $body['fields']   ?? null;

if (!$course || !$lesson || !$exercise || !is_array($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'course/lesson/exercise/fields fehlen.']);
    exit;
}

// Nur erlaubte Felder übernehmen (Whitelist).
$clean = [];
foreach (editable_keys() as $key) {
    if (!array_key_exists($key, $fields)) continue;
    if ($key === 'targetConcepts') {
        $clean[$key] = is_array($fields[$key]) ? $fields[$key] : [];
    } elseif (is_string($fields[$key])) {
        $clean[$key] = $fields[$key];
    }
}

$loc = ['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise];
if (!save_editable_fields($loc, $clean)) {
    http_response_code(404);
    echo json_encode(['error' => 'Übung nicht gefunden oder nicht beschreibbar.']);
    exit;
}
echo json_encode(['ok' => true, 'fields' => read_editable_fields($loc)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
