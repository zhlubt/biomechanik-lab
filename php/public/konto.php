<?php
/**
 * Konto. Bewusst minimal: nur ein Name, kein Passwort, keine E-Mail.
 *
 *  - STUDIERENDE: Name eingeben → Geräte-Konto + langlebiges Cookie.
 *  - LEHRPERSONEN: über einen Einladungslink `konto.php?lehrcode=<TEACHER_CODE>`.
 *    Der Code steckt im Link, die Lehrperson gibt nur noch ihren Namen ein.
 *    Die Rolle kommt NIE aus dem Formular, sondern ausschließlich aus dem
 *    serverseitig geprüften Code — ein manipuliertes Formularfeld bringt nichts.
 *    Den fertigen Link zeigt die Pflege-Oberfläche an.
 *
 * E-Mail-Konten (auth_register/auth_login) gibt es in der Oberfläche nicht mehr;
 * die Funktionen bleiben in auth.php, falls sie später gebraucht werden.
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

if (isset($_GET['logout'])) { auth_logout(); header('Location: index.php'); exit; }

$next = (string)($_GET['next'] ?? '');
$safeNext = (preg_match('/^[a-zA-Z0-9_.\-]+\.php(\?[^"\'<>]*)?$/', $next)) ? $next : 'index.php';
if (is_logged_in()) { header('Location: ' . $safeNext); exit; }

// Einladungscode aus Link (GET) oder Formular (POST, damit er den Absendevorgang übersteht).
$code        = (string)($_POST['lehrcode'] ?? $_GET['lehrcode'] ?? '');
$codeGiven   = $code !== '';
$codeOk      = $codeGiven && teacher_code_ok($code);
$asTeacher   = $codeOk;

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Ganze Jahrgänge teilen sich eine NAT-IP — großzügig drosseln, aber drosseln.
    $rl = rate_check('qs:ip:' . client_ip(), 0, 3600, 200);
    if (!$rl['ok']) {
        $error = 'Zu viele Starts von hier. Bitte in ' . $rl['retry_after'] . ' s erneut.';
    } elseif ($codeGiven && !$codeOk) {
        $error = 'Dieser Einladungslink gilt nicht (mehr). Bitte neu anfordern.';
    } else {
        [$ok, $res] = auth_quickstart((string)($_POST['name'] ?? ''), $asTeacher ? 'teacher' : 'student');
        // Ziel ohne Code in der Adresszeile — der soll nicht im Verlauf stehen bleiben.
        if ($ok) { header('Location: ' . $safeNext); exit; }
        $error = $res;
    }
}
$nq = $next ? ('&next=' . urlencode($next)) : '';
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="referrer" content="same-origin" />
<title><?= $asTeacher ? 'Als Lehrperson starten' : 'Loslegen' ?> · Beschreibungs-Lab</title>
<link rel="stylesheet" href="<?= esc(asset('styles.css')) ?>" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Beschreibungs-Lab</b><small>Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:14px"><a href="index.php" class="ctrl" style="padding:6px 10px;font-size:12px;text-decoration:none">← Übersicht</a></div>
  </header>

<?php if ($asTeacher): ?>
  <h1 class="title">Als Lehrperson starten</h1>
  <p class="subtitle">Dein Einladungslink ist gültig. Gib deinen Namen ein — danach siehst du die Abgaben deiner Studierenden und die Nutzerverwaltung.</p>
<?php elseif ($codeGiven): ?>
  <h1 class="title">Einladungslink ungültig</h1>
  <p class="subtitle">Dieser Link gilt nicht (mehr). Du kannst unten trotzdem als Studierende:r starten — oder einen neuen Link anfordern.</p>
<?php else: ?>
  <h1 class="title">Loslegen</h1>
  <p class="subtitle">Gib einfach deinen Namen ein — schon werden deine Beschreibungen und das KI-Feedback auf diesem Gerät gespeichert. Kein Passwort, keine E-Mail nötig.</p>
<?php endif; ?>

  <?php if ($error): ?><p class="save-err" style="margin-top:14px"><?= esc($error) ?></p><?php endif; ?>

  <form method="post" class="form quickstart-card">
    <?php if ($codeOk): ?><input type="hidden" name="lehrcode" value="<?= esc($code) ?>"><?php endif; ?>
    <label class="field">
      <span class="field-label">Dein Name
        <span class="field-hint"><?= $asTeacher ? '(erscheint in der Nutzerverwaltung)' : '(wird deinen Lehrenden angezeigt)' ?></span>
      </span>
      <input name="name" value="<?= esc($_POST['name'] ?? '') ?>" placeholder="<?= $asTeacher ? 'z. B. Dr. Uli Fehr' : 'z. B. Lisa M.' ?>" autofocus required>
    </label>
    <div class="form-actions">
      <button class="ctrl primary" type="submit"><?= $asTeacher ? 'Als Lehrperson starten' : 'Starten' ?></button>
    </div>
  </form>

  <p class="admin-note" style="margin-top:20px">
    Datenschutz: Deine Daten liegen auf dem Server der Universität Bayreuth. Deine Beschreibungen werden zur
    Erzeugung des Feedbacks an <b><?= esc(llm_provenance()['service']) ?></b> übertragen.
    Du kannst sie jederzeit unter „Meine Abgaben“ herunterladen oder löschen.
    Mehr dazu im <a href="impressum.php">Impressum und Datenschutz</a>.
  </p>

  <?= site_footer() ?>
</div>
</body>
</html>
