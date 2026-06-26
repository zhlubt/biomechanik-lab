<?php
/**
 * Konto (Phase 4). Reibungsarm:
 *  - SCHNELLSTART: nur Name → Geräte-Cookie, sofort startklar (keine E-Mail/Passwort).
 *  - Optional: E-Mail-Konto (geräteübergreifend) anmelden/registrieren.
 *  - Lehrende: Registrierung mit dem Pflege-Passwort als Lehrenden-Code.
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

if (isset($_GET['logout'])) { auth_logout(); header('Location: index.php'); exit; }

$next = (string)($_GET['next'] ?? '');
$safeNext = (preg_match('/^[a-zA-Z0-9_.\-]+\.php(\?[^"\'<>]*)?$/', $next)) ? $next : 'index.php';
if (is_logged_in()) { header('Location: ' . $safeNext); exit; }

$error = ''; $mode = ($_POST['mode'] ?? $_GET['mode'] ?? 'start');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $m = $_POST['mode'] ?? '';
    $ip = client_ip();
    if ($m === 'quickstart') {
        // Account-Spam bremsen, aber großzügig: ganze Vorlesungen teilen sich oft EINE IP.
        $rl = rate_check('qs:ip:' . $ip, 0, 3600, 200);
        if (!$rl['ok']) { $error = 'Zu viele Starts von hier. Bitte in ' . $rl['retry_after'] . ' s erneut.'; $mode = 'start'; }
        else {
            [$ok, $res] = auth_quickstart((string)($_POST['name'] ?? ''));
            if ($ok) { header('Location: ' . $safeNext); exit; }
            $error = $res; $mode = 'start';
        }
    } elseif ($m === 'register') {
        $rl = rate_check('reg:ip:' . $ip, 3, 3600, 60);
        if (!$rl['ok']) {
            $error = 'Zu viele Registrierungen von hier. Bitte später erneut.'; $mode = 'register';
        } else {
            [$ok, $res] = auth_register(
                (string)($_POST['email'] ?? ''), (string)($_POST['password'] ?? ''), (string)($_POST['name'] ?? ''),
                !empty($_POST['as_teacher']), (string)($_POST['teacher_code'] ?? '')
            );
            if ($ok) { header('Location: ' . $safeNext); exit; }
            $error = $res; $mode = 'register';
        }
    } else {
        $rl = rate_check('login:ip:' . $ip, 0, 900, 25);
        if (!$rl['ok']) {
            $error = 'Zu viele Anmeldeversuche. Bitte ein paar Minuten warten.'; $mode = 'login';
        } else {
            [$ok, $res] = auth_login((string)($_POST['email'] ?? ''), (string)($_POST['password'] ?? ''));
            if ($ok) { header('Location: ' . $safeNext); exit; }
            $error = $res; $mode = 'login';
        }
    }
}
$nq = $next ? ('&next=' . esc(urlencode($next))) : '';
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Loslegen · Biomechanik-Lab</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Biomechanik-Lab</b><small>Trainingswissenschaft · Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:14px"><a href="index.php" class="ctrl" style="padding:6px 10px;font-size:12px;text-decoration:none">← Übersicht</a></div>
  </header>

  <h1 class="title">Loslegen</h1>
  <p class="subtitle">Gib einfach deinen Namen ein — schon werden deine Beschreibungen und das KI-Feedback auf diesem Gerät gespeichert. Keine E-Mail, kein Passwort nötig.</p>

  <?php if ($error): ?><p class="save-err" style="margin-top:14px">⚠ <?= esc($error) ?></p><?php endif; ?>

  <!-- SCHNELLSTART -->
  <form method="post" class="form quickstart-card">
    <input type="hidden" name="mode" value="quickstart">
    <label class="field"><span class="field-label">Dein Name <span class="field-hint">(wird deinen Lehrenden angezeigt)</span></span><input name="name" value="<?= esc($_POST['name'] ?? '') ?>" placeholder="z. B. Lisa M." autofocus required></label>
    <div class="form-actions"><button class="ctrl primary" type="submit">▶ Starten</button></div>
  </form>

  <details class="account-more" <?= in_array($mode, ['login', 'register'], true) ? 'open' : '' ?>>
    <summary>Lieber ein Konto mit E-Mail? (geräteübergreifend, z. B. Uni-PC + eigener Laptop)</summary>
    <div class="auth-tabs" style="margin-top:14px">
      <a class="auth-tab <?= $mode !== 'register' ? 'on' : '' ?>" href="konto.php?mode=login<?= $nq ?>">Anmelden</a>
      <a class="auth-tab <?= $mode === 'register' ? 'on' : '' ?>" href="konto.php?mode=register<?= $nq ?>">Registrieren</a>
    </div>

    <?php if ($mode === 'register'): ?>
    <form method="post" class="form auth-form">
      <input type="hidden" name="mode" value="register">
      <label class="field"><span class="field-label">Name</span><input name="name" value="<?= esc($_POST['name'] ?? '') ?>" required></label>
      <label class="field"><span class="field-label">E-Mail</span><input type="email" name="email" value="<?= esc($_POST['email'] ?? '') ?>" required></label>
      <label class="field"><span class="field-label">Passwort <span class="field-hint">(mind. 8 Zeichen)</span></span><input type="password" name="password" required></label>
      <label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="as_teacher" id="as_teacher" value="1" <?= !empty($_POST['as_teacher']) ? 'checked' : '' ?>><span class="field-label" style="margin:0">Ich bin Lehrende:r</span></label>
      <label class="field" id="tc_field" style="display:none"><span class="field-label">Lehrenden-Code <span class="field-hint">(= das Pflege-Passwort)</span></span><input name="teacher_code"></label>
      <div class="form-actions"><button class="ctrl primary" type="submit">Konto anlegen</button></div>
    </form>
    <script>(function(){var cb=document.getElementById('as_teacher'),f=document.getElementById('tc_field');function t(){f.style.display=cb.checked?'':'none';}cb.addEventListener('change',t);t();})();</script>
    <?php else: ?>
    <form method="post" class="form auth-form">
      <input type="hidden" name="mode" value="login">
      <label class="field"><span class="field-label">E-Mail</span><input type="email" name="email" value="<?= esc($_POST['email'] ?? '') ?>" required></label>
      <label class="field"><span class="field-label">Passwort</span><input type="password" name="password" required></label>
      <div class="form-actions"><button class="ctrl primary" type="submit">Anmelden</button></div>
    </form>
    <?php endif; ?>
  </details>

  <p class="admin-note" style="margin-top:20px">Datenschutz: Deine Daten liegen ausschließlich auf dem Server der Universität (eigene Datenbank dieser Plattform). Deine Beschreibungen werden zur Feedback-Erzeugung an das KI-Modell gesendet.</p>

  <footer><span><b>Beschreibungs-Lab</b> · Universität Bayreuth</span><span>PHP-Variante</span></footer>
</div>
</body>
</html>
