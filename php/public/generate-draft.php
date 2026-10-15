<?php
/**
 * Designer-Modus (Phase 5): erzeugt aus einem hochgeladenen Bild per Vision-LLM
 * einen Übungs-Entwurf (Felder), der das Anlege-Formular vorbefüllt.
 * Nur mit gültiger Pflege-Anmeldung.
 */
require __DIR__ . '/_boot.php';
app_session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['pflege_auth'])) { http_response_code(403); echo json_encode(['error' => 'Nicht angemeldet.']); exit; }
csrf_require();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Nur POST.']); exit; }

// Auch der (passwortgeschützte) Vision-Aufruf ist kostenpflichtig → leichte Drosselung.
$rl = rate_check('draft:ip:' . client_ip(), 5, 3600, 40);
if (!$rl['ok']) { http_response_code(429); echo json_encode(['error' => 'Zu viele Anfragen. Bitte ' . $rl['retry_after'] . ' s warten.']); exit; }

if (empty($_FILES['image']['tmp_name']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400); echo json_encode(['error' => 'Bitte ein Bild des Mediums hochladen.']); exit;
}
$info = @getimagesize($_FILES['image']['tmp_name']);
if ($info === false) { http_response_code(400); echo json_encode(['error' => 'Datei ist kein gültiges Bild.']); exit; }
$mime = $info['mime'] ?? '';
if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true)) {
    http_response_code(400); echo json_encode(['error' => 'Bildformat nicht unterstützt (png/jpg/webp/gif).']); exit;
}
$bytes = (string)file_get_contents($_FILES['image']['tmp_name']);
if (strlen($bytes) > 8 * 1024 * 1024) { http_response_code(400); echo json_encode(['error' => 'Bild zu groß (max. 8 MB).']); exit; }

try {
    $draft = llm_exercise_draft($mime, base64_encode($bytes), trim((string)($_POST['hint'] ?? '')));
    echo json_encode(['ok' => true, 'draft' => $draft], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    // Details nur ins Serverlog - die Meldung kann Interna des LLM-Dienstes enthalten.
    error_log('[generate-draft.php] ' . $e->getMessage());
    http_response_code(502);
    echo json_encode(['error' => 'Entwurf konnte nicht erzeugt werden. Details stehen im Serverlog.']);
}
