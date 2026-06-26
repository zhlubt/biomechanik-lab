<?php
/**
 * Vorschaubild (Galerie-Thumbnail) einer Übung hochladen/setzen.
 * Nur mit gültiger Pflege-Anmeldung. Speichert die Datei in public/img/
 * und schreibt den Pfad ins Feld `thumbnail` der Übungs-JSON.
 */
require __DIR__ . '/_boot.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['pflege_auth'])) { http_response_code(403); echo json_encode(['error' => 'Nicht angemeldet.']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Nur POST.']); exit; }

$course   = ex_safe((string)($_POST['course'] ?? ''));
$lesson   = ex_safe((string)($_POST['lesson'] ?? ''));
$exercise = ex_safe((string)($_POST['exercise'] ?? ''));
if (!$course || !$lesson || !$exercise) { http_response_code(400); echo json_encode(['error' => 'course/lesson/exercise fehlen.']); exit; }

$loc = ['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise];
if (!exercise_exists($loc)) { http_response_code(404); echo json_encode(['error' => 'Übung nicht gefunden.']); exit; }

if (empty($_FILES['image']['tmp_name']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(400); echo json_encode(['error' => 'Keine Bilddatei empfangen.']); exit;
}
$ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
$allowed = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif'];
if (!isset($allowed[$ext])) { http_response_code(400); echo json_encode(['error' => 'Format nicht unterstützt (png/jpg/webp/gif).']); exit; }

// Inhalt grob verifizieren (echtes Bild?)
$info = @getimagesize($_FILES['image']['tmp_name']);
if ($info === false) { http_response_code(400); echo json_encode(['error' => 'Datei ist kein gültiges Bild.']); exit; }

$imgdir = __DIR__ . '/img';
if (!is_dir($imgdir) && !@mkdir($imgdir, 0775, true) && !is_dir($imgdir)) {
    http_response_code(500); echo json_encode(['error' => 'img/-Verzeichnis nicht beschreibbar.']); exit;
}

/**
 * Alle Galerie-Thumbnails haben EINHEITLICH 392×194 (Cover-Crop, Maße der
 * Kugelstoß-Videoanalyse). Per GD normalisieren; falls GD fehlt, Original ablegen.
 */
const THUMB_W = 392, THUMB_H = 194;
$tmp = $_FILES['image']['tmp_name'];
$normalized = false;
$outExt = $ext;
if (extension_loaded('gd')) {
    $src = @imagecreatefromstring((string)file_get_contents($tmp));
    if ($src !== false) {
        $sw = imagesx($src); $sh = imagesy($src);
        $scale = max(THUMB_W / $sw, THUMB_H / $sh);
        $rw = (int)round($sw * $scale); $rh = (int)round($sh * $scale);
        $sx = (int)max(0, (($rw - THUMB_W) / 2) / $scale);
        $sy = (int)max(0, (($rh - THUMB_H) / 2) / $scale);
        $cropW = (int)round(THUMB_W / $scale); $cropH = (int)round(THUMB_H / $scale);
        $dst = imagecreatetruecolor(THUMB_W, THUMB_H);
        imagealphablending($dst, false); imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, $sx, $sy, THUMB_W, THUMB_H, $cropW, $cropH);
        $outExt = 'png';
        $destTmp = $imgdir . '/.up_' . $exercise . '.png';
        if (imagepng($dst, $destTmp)) $normalized = true;
        imagedestroy($dst);
        imagedestroy($src);
    }
}

$fname = 'thumb_' . $course . '-' . $lesson . '-' . $exercise . '.' . $outExt;
$dest = $imgdir . '/' . $fname;
if ($normalized) {
    if (!@rename($imgdir . '/.up_' . $exercise . '.png', $dest)) {
        http_response_code(500); echo json_encode(['error' => 'Normalisiertes Bild konnte nicht gespeichert werden.']); exit;
    }
} elseif (!move_uploaded_file($tmp, $dest)) {
    http_response_code(500); echo json_encode(['error' => 'Bild konnte nicht gespeichert werden (Schreibrechte auf img/?).']); exit;
}
@chmod($dest, 0664);

$thumb = 'img/' . $fname;
if (!save_editable_fields($loc, ['thumbnail' => $thumb])) {
    http_response_code(500); echo json_encode(['error' => 'Bild gespeichert, aber Übung nicht beschreibbar.']); exit;
}
echo json_encode(['ok' => true, 'thumbnail' => $thumb], JSON_UNESCAPED_SLASHES);
