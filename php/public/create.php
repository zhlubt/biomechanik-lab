<?php
/**
 * Legt eine neue Übung (Szenario) an — inkl. optionalem Video-Upload.
 * Nur mit gültiger Pflege-Anmeldung. Danach Weiterleitung in den Editor.
 */
require __DIR__ . '/_boot.php';
session_start();

if (empty($_SESSION['pflege_auth'])) { http_response_code(403); exit('Nicht angemeldet.'); }

function back_err(string $msg): void { $_SESSION['create_error'] = $msg; header('Location: pflege.php?neu=1'); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: pflege.php?neu=1'); exit; }

$slug = function ($s) { return preg_replace('/[^a-z0-9_-]/', '', strtolower(trim((string)$s))); };
$course = $slug($_POST['course'] ?? '');
$lesson = $slug($_POST['lesson'] ?? '');
$exercise = $slug($_POST['exercise'] ?? '');
if (!$course || !$lesson || !$exercise) back_err('Kurs-, Lektions- und Übungs-ID nötig (nur a–z, 0–9, -, _).');

$loc = ['course' => $course, 'lesson' => $lesson, 'exercise' => $exercise];
if (exercise_exists($loc)) back_err('Eine Übung mit dieser Adresse existiert bereits.');

$kind = (($_POST['kind'] ?? 'video') === 'video') ? 'video' : 'jumpforce';
$videoSrc = '';
if ($kind === 'video') {
    if (!empty($_FILES['video']['tmp_name']) && is_uploaded_file($_FILES['video']['tmp_name'])) {
        $ext = strtolower(pathinfo($_FILES['video']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['mp4', 'mov', 'm4v', 'webm'], true)) back_err('Video-Format nicht unterstützt (mp4/mov/m4v/webm).');
        $viddir = __DIR__ . '/vid';
        if (!is_dir($viddir)) @mkdir($viddir, 0775, true);
        $fname = $exercise . '.' . $ext;
        if (!move_uploaded_file($_FILES['video']['tmp_name'], $viddir . '/' . $fname)) back_err('Video konnte nicht gespeichert werden (Schreibrechte auf vid/?).');
        $videoSrc = 'vid/' . $fname;
    } elseif (!empty($_POST['videoSrc'])) {
        $videoSrc = trim((string)$_POST['videoSrc']);
    } else {
        back_err('Bitte ein Video hochladen oder einen Video-Pfad (z. B. vid/datei.mp4) angeben.');
    }
}

// Kategorien: je Zeile "schlüssel | Label | #farbe"
$cats = [];
foreach (preg_split('/\r?\n/', (string)($_POST['categories'] ?? '')) as $line) {
    $line = trim($line); if ($line === '') continue;
    $p = array_map('trim', explode('|', $line));
    if (($p[0] ?? '') !== '') $cats[] = ['key' => $p[0], 'label' => $p[1] ?? $p[0], 'color' => $p[2] ?? '#3a63d8'];
}

$skel = build_exercise_skeleton([
    'course' => $course, 'courseTitle' => $_POST['courseTitle'] ?? '', 'lesson' => $lesson, 'lessonTitle' => $_POST['lessonTitle'] ?? '',
    'exercise' => $exercise, 'number' => $_POST['number'] ?? '', 'title' => $_POST['title'] ?? '', 'intro' => $_POST['intro'] ?? '',
    'kind' => $kind, 'videoSrc' => $videoSrc, 'durationSec' => $_POST['durationSec'] ?? 5, 'fps' => $_POST['fps'] ?? 30,
    'timestampMode' => !empty($_POST['timestampMode']), 'task' => $_POST['task'] ?? '',
    'mediaDescription' => $_POST['mediaDescription'] ?? '', 'feedbackPrompt' => $_POST['feedbackPrompt'] ?? '', 'modelSolution' => $_POST['modelSolution'] ?? '',
    'demoText' => $_POST['demoText'] ?? '', 'categories' => $cats,
    'targetConcepts' => array_map('trim', explode(',', (string)($_POST['targetConcepts'] ?? ''))),
]);

if (!create_exercise($loc, $skel)) back_err('Anlegen fehlgeschlagen (Schreibrechte im content-Verzeichnis?).');
header('Location: pflege.php?ex=' . urlencode($course . '/' . $lesson . '/' . $exercise));
