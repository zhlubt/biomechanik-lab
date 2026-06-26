<?php
/**
 * Auswertung (Phase 4, nur Lehrende): Übersicht aller Übungen mit Abgaben,
 * Detailansicht je Übung mit allen Studierenden-Beschreibungen + Feedback.
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

require_teacher();

$exParam = (string)($_GET['ex'] ?? '');
$detail = null;
if ($exParam) {
    $p = explode('/', $exParam);
    if (count($p) === 3) $detail = ['course' => $p[0], 'lesson' => $p[1], 'exercise' => $p[2]];
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Auswertung · Biomechanik-Lab</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Biomechanik-Lab</b><small>Lehrenden-Auswertung</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

<?php if ($detail === null):
    $overview = submission_overview();
?>
  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <b>Auswertung</b></nav>
  <h1 class="title">Auswertung der Abgaben</h1>
  <p class="subtitle">Übungen, zu denen Studierende Beschreibungen abgegeben haben. Klick auf eine Übung für die Detailansicht.</p>

  <?php if (!$overview): ?>
    <p class="admin-note" style="margin-top:18px">Es liegen noch keine Abgaben vor.</p>
  <?php else: ?>
    <ul class="admin-list">
      <?php foreach ($overview as $row):
        $loc = ['course' => $row['course'], 'lesson' => $row['lesson'], 'exercise' => $row['exercise']];
        $ex = load_exercise($loc);
        $exId = $row['course'] . '/' . $row['lesson'] . '/' . $row['exercise'];
      ?>
        <li class="admin-row">
          <div>
            <div style="font-weight:600"><?= esc($ex['title'] ?? $exId) ?></div>
            <div class="meta"><?= (int)$row['n'] ?> Abgabe(n) · <?= (int)$row['students'] ?> Studierende · zuletzt <?= esc($row['last_at']) ?></div>
          </div>
          <div class="actions"><a class="ctrl primary" href="auswertung.php?ex=<?= esc(urlencode($exId)) ?>">Abgaben ansehen →</a></div>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>

<?php else:
    $ex = load_exercise($detail);
    $subs = list_exercise_submissions($detail);
    $exId = $detail['course'] . '/' . $detail['lesson'] . '/' . $detail['exercise'];
?>
  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <a href="auswertung.php">Auswertung</a> <span>›</span> <b><?= esc($ex['title'] ?? $exId) ?></b></nav>
  <h1 class="title"><?= esc($ex['title'] ?? $exId) ?></h1>
  <p class="subtitle"><?= count($subs) ?> Abgabe(n). Musterlösung und Prompt findest du in der <a href="pflege.php?ex=<?= esc(urlencode($exId)) ?>">Pflege</a>.</p>

  <?php if (!$subs): ?>
    <p class="admin-note" style="margin-top:18px">Noch keine Abgaben zu dieser Übung.</p>
  <?php else: ?>
    <div class="sub-list">
      <?php foreach ($subs as $s):
        $markers = json_decode($s['markers_json'] ?? '[]', true) ?: [];
      ?>
      <div class="sub-card">
        <div class="sub-head">
          <div>
            <span class="sub-title" style="cursor:default"><?= esc($s['user_name']) ?></span>
            <div class="sub-meta"><?= esc($s['user_email']) ?> · <?= esc($s['created_at']) ?> · <?= (int)$s['marker_count'] ?> Hinweis(e) · <?= esc($s['model']) ?></div>
          </div>
        </div>
        <div class="sub-body" style="padding-top:6px">
          <p class="sub-label">Beschreibung</p>
          <div class="sub-text"><?= nl2br(esc($s['student_text'])) ?></div>
          <?php if ($markers): ?>
            <details><summary>KI-Hinweise (<?= count($markers) ?>)</summary>
              <ul class="sub-markers">
                <?php foreach ($markers as $m): ?>
                  <li><span class="sub-q">„<?= esc($m['quote'] ?? '') ?>"</span> — <?= esc($m['question'] ?? '') ?></li>
                <?php endforeach; ?>
              </ul>
            </details>
          <?php endif; ?>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
<?php endif; ?>

  <footer><span><b>Beschreibungs-Lab</b> · Lehrenden-Auswertung · Universität Bayreuth</span><span>PHP-Variante</span></footer>
</div>
</body>
</html>
