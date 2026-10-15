<?php
/**
 * Eigene Daten: Auskunft/Mitnahme (Art. 15/20 DSGVO) und Löschung (Art. 17).
 *
 * Alles hier wirkt NUR auf das eigene Konto — die Nutzer-ID kommt aus der
 * Sitzung, nie aus der Anfrage. Dadurch kann auch mit geratenen IDs niemand
 * fremde Daten exportieren oder löschen.
 */
require __DIR__ . '/_boot.php';
auth_boot();

$user = require_login('meine-abgaben.php');
$uid  = (int)$user['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: meine-abgaben.php'); exit; }
csrf_require(false);

$action = (string)($_POST['action'] ?? '');

if ($action === 'export') {
    $data = export_user_data($uid);
    $name = 'meine-daten-beschreibungs-lab-' . date('Y-m-d') . '.json';
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($action === 'delete_submission') {
    $id = (int)($_POST['id'] ?? 0);
    $ok = $id > 0 && delete_submission($id, $uid);
    header('Location: meine-abgaben.php?' . ($ok ? 'geloescht=1' : 'fehler=1'));
    exit;
}

if ($action === 'delete_account') {
    // Tippfehler-Schutz: die Löschung muss ausgeschrieben bestätigt werden.
    // Feldname bewusst NICHT "confirm": benannte Felder verdecken in Inline-Handlern
    // die gleichnamige Browser-Funktion, die Rückfrage bliebe sonst aus.
    if (mb_strtoupper(trim((string)($_POST['bestaetigung'] ?? ''))) !== 'LÖSCHEN') {
        header('Location: meine-abgaben.php?fehler=bestaetigung');
        exit;
    }
    delete_user($uid);   // Abgaben gehen per ON DELETE CASCADE mit
    auth_logout();
    header('Location: index.php?konto_geloescht=1');
    exit;
}

header('Location: meine-abgaben.php');
