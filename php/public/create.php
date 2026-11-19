<?php
/**
 * Legt eine neue Übung an. Nimmt die komplette Übung als JSON (Feld
 * `exercise_json`, Dateiformat wie in private/content) plus optionale Dateien
 * (`media_file`, `thumb_file`) entgegen und antwortet mit JSON.
 *
 * Mit `dry_run=1` wird nur geprüft und die gesäuberte Übung zurückgegeben, ohne
 * etwas zu schreiben (Knopf „Prüfen“ und „JSON ansehen“ im Formular).
 *
 * Nur mit gültiger Pflege-Anmeldung. Alle Felder laufen durch
 * normalize_exercise() (Erlaubnisliste, siehe private/lib/exercise.php).
 */
require __DIR__ . '/_boot.php';
app_session_start();
header('Content-Type: application/json; charset=utf-8');

function out(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (empty($_SESSION['pflege_auth'])) out(403, ['errors' => ['Nicht angemeldet. Bitte in der Pflege neu anmelden.']]);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['errors' => ['Nur POST.']]);
csrf_require();

$in = json_decode((string)($_POST['exercise_json'] ?? ''), true);
if (!is_array($in)) out(400, ['errors' => ['Die Übungsdaten sind kein gültiges JSON.']]);

$loc = [
    'course'   => ex_slug($in['course']['id'] ?? ''),
    'lesson'   => ex_slug($in['lesson']['id'] ?? ''),
    'exercise' => ex_slug($in['id'] ?? ''),
];
$errors = [];
if (!$loc['course'] || !$loc['lesson'] || !$loc['exercise']) {
    $errors[] = 'Bereichs-, Lektions- und Übungs-ID sind nötig (nur a–z, 0–9, Bindestrich, Unterstrich).';
}
$dryRun = !empty($_POST['dry_run']);
if (!$errors && exercise_exists($loc)) {
    $errors[] = 'Unter ' . implode('/', $loc) . ' gibt es schon eine Übung. Bitte eine andere Übungs-ID wählen.';
}

// Hochgeladene Dateien: erst prüfen (mit Platzhalterpfad), gespeichert wird erst,
// wenn die Übung insgesamt gültig ist. So bleiben bei Fehlern keine Waisen liegen.
$publicDir = __DIR__;
$kind = (string)($in['media'][0]['type'] ?? '');
$mediaUpload = (!empty($_FILES['media_file']['name'])) ? $_FILES['media_file'] : null;
$thumbUpload = (!empty($_FILES['thumb_file']['name'])) ? $_FILES['thumb_file'] : null;
$uploadRules = [
    'video'   => ['dir' => 'vid',   'ext' => ['mp4', 'webm', 'm4v', 'mov'], 'placeholder' => 'vid/upload.mp4'],
    'image'   => ['dir' => 'img',   'ext' => ['png', 'jpg', 'jpeg', 'webp', 'gif'], 'placeholder' => 'img/upload.png'],
    'model3d' => ['dir' => 'model', 'ext' => ['glb'], 'placeholder' => 'model/upload.glb'],
];
if ($mediaUpload) {
    if (!isset($uploadRules[$kind])) {
        $errors[] = 'Für diesen Medientyp lässt sich keine Datei hochladen.';
    } else {
        $in['media'][0]['src'] = $uploadRules[$kind]['placeholder'];
        $tmp = (string)($mediaUpload['tmp_name'] ?? '');
        if ($kind === 'image' && $tmp !== '' && @getimagesize($tmp) === false) $errors[] = 'Die Bilddatei ist kein gültiges Bild.';
        if ($kind === 'model3d' && $tmp !== '' && (string)@file_get_contents($tmp, false, null, 0, 4) !== 'glTF') $errors[] = 'Die 3D-Datei ist kein gültiges .glb (Binär-glTF).';
    }
}
if ($thumbUpload) {
    $in['thumbnail'] = 'img/upload.png';
    $tmp = (string)($thumbUpload['tmp_name'] ?? '');
    if ($tmp !== '' && @getimagesize($tmp) === false) $errors[] = 'Das Vorschaubild ist kein gültiges Bild.';
}

[$ex, $schemaErrors] = normalize_exercise($in, $loc ?: ['course' => '', 'lesson' => '', 'exercise' => ''], $publicDir);
$errors = array_merge($errors, $schemaErrors);

if ($dryRun) {
    // Platzhalter nicht als echten Pfad zurückgeben.
    if ($mediaUpload && isset($ex['media'][0]['src'])) $ex['media'][0]['src'] = '(wird beim Anlegen hochgeladen)';
    if ($thumbUpload) $ex['thumbnail'] = '(wird beim Anlegen hochgeladen)';
    out($errors ? 422 : 200, ['ok' => !$errors, 'errors' => $errors, 'exercise' => $ex]);
}
if ($errors) out(422, ['errors' => $errors]);

try {
    if ($mediaUpload) {
        $r = $uploadRules[$kind];
        $ex['media'][0]['src'] = store_upload($mediaUpload, $publicDir, $r['dir'], $loc['exercise'], $r['ext']);
    }
    if ($thumbUpload) {
        $ex['thumbnail'] = store_upload($thumbUpload, $publicDir, 'img', 'thumb_' . $loc['exercise'], ['png', 'jpg', 'jpeg', 'webp', 'gif']);
    }
} catch (RuntimeException $e) {
    out(422, ['errors' => [$e->getMessage()]]);
}

if (!create_exercise($loc, $ex)) out(500, ['errors' => ['Anlegen fehlgeschlagen (Schreibrechte im content-Verzeichnis?).']]);

$id = implode('/', $loc);
out(200, ['ok' => true, 'id' => $id, 'edit' => 'pflege.php?ex=' . rawurlencode($id), 'view' => 'uebung.php?ex=' . rawurlencode($id)]);
