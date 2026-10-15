<?php
/**
 * Nutzerverwaltung (nur Lehrende): Übersicht aller Konten mit Abgabenzahl,
 * Löschen einzelner Konten. Gedacht für Aufräumarbeiten (Testkonten,
 * Löschersuchen nach Art. 17 DSGVO, die nicht selbst ausgeführt werden).
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$me = require_teacher();
$notice = ''; $noticeClass = 'save-ok';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_require(false);
    $id = (int)($_POST['id'] ?? 0);
    if (($_POST['action'] ?? '') === 'delete_user' && $id > 0) {
        if ($id === (int)$me['id']) {
            $notice = 'Das eigene Lehrenden-Konto lässt sich hier nicht löschen.';
            $noticeClass = 'save-err';
        } else {
            $notice = delete_user($id)
                ? 'Konto und zugehörige Abgaben wurden gelöscht.'
                : 'Konto nicht gefunden.';
            if ($notice === 'Konto nicht gefunden.') $noticeClass = 'save-err';
        }
    }
}

$users = list_users_with_counts();
$nStud = 0; $nSubs = 0;
foreach ($users as $u) { if ($u['role'] !== 'teacher') $nStud++; $nSubs += (int)$u['n_subs']; }
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Nutzerverwaltung · Beschreibungs-Lab</title>
<link rel="stylesheet" href="<?= esc(asset('styles.css')) ?>" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Beschreibungs-Lab</b><small>Nutzerverwaltung</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <a href="auswertung.php">Auswertung</a> <span>›</span> <b>Nutzer</b></nav>
  <h1 class="title">Nutzerverwaltung</h1>
  <p class="subtitle"><?= count($users) ?> Konten (<?= $nStud ?> Studierende) · <?= $nSubs ?> Abgaben insgesamt.
     Löschen entfernt das Konto <b>und alle Abgaben</b> dieser Person unwiderruflich.</p>

  <?php if ($notice): ?><p class="<?= esc($noticeClass) ?>" style="margin-top:14px"><?= esc($notice) ?></p><?php endif; ?>

  <ul class="admin-list" style="margin-top:18px">
    <?php foreach ($users as $u): ?>
      <li class="admin-row">
        <div>
          <div style="font-weight:600">
            <?= esc($u['name']) ?>
            <?php if ($u['role'] === 'teacher'): ?><span class="pill" style="margin-left:6px">Lehrende:r</span><?php endif; ?>
            <?php if ((int)$u['id'] === (int)$me['id']): ?><span class="pill" style="margin-left:6px">du</span><?php endif; ?>
          </div>
          <div class="meta">
            <?= $u['is_device'] ? 'Geräte-Konto' : esc($u['email']) ?>
            · angelegt <?= esc($u['created_at']) ?>
            · <?= (int)$u['n_subs'] ?> Abgabe(n)
            <?= $u['last_at'] ? ' · zuletzt ' . esc($u['last_at']) : '' ?>
          </div>
        </div>
        <div class="actions">
          <?php if ((int)$u['id'] !== (int)$me['id']): ?>
          <form method="post" style="margin:0"
                onsubmit="return window.confirm('Konto „<?= esc(addslashes($u['name'])) ?>“ und <?= (int)$u['n_subs'] ?> Abgabe(n) endgültig löschen?')">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="delete_user">
            <input type="hidden" name="id" value="<?= (int)$u['id'] ?>">
            <button class="ctrl" type="submit" style="border-color:var(--bad);color:var(--bad)">Löschen</button>
          </form>
          <?php endif; ?>
        </div>
      </li>
    <?php endforeach; ?>
  </ul>

  <p class="admin-note" style="margin-top:20px">
    Studierende können ihr Konto auch selbst löschen und ihre Daten herunterladen —
    unter „Meine Abgaben“, Abschnitt <i>Deine Daten</i>.
  </p>

  <?= site_footer('Nutzerverwaltung') ?>
</div>
</body>
</html>
