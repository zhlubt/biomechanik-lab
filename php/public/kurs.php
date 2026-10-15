<?php
/**
 * Kurs-Übersicht (Phase 3): Lektionen + Übungen eines Kurses, mit Breadcrumb.
 */
require __DIR__ . '/_boot.php';
require __DIR__ . '/_partials.php';
auth_boot();

$id = (string)($_GET['id'] ?? '');
$courses = list_courses();
$course = $courses[$id] ?? null;

if ($course === null) {
    http_response_code(404);
    echo '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' . asset('styles.css') . '"><div class="shell"><h1 class="title">Kurs nicht gefunden</h1><p class="subtitle"><a href="index.php">← Zur Übersicht</a></p></div>';
    exit;
}
$user = current_user();
$done = $user ? user_done_exercises((int)$user['id']) : [];
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title><?= esc($course['title']) ?> · Biomechanik-Lab</title>
<link rel="stylesheet" href="<?= esc(asset('styles.css')) ?>" />
</head>
<body>
<div class="shell">

  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Biomechanik-Lab</b><small>Trainingswissenschaft · Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <b><?= esc($course['title']) ?></b></nav>

  <h1 class="title"><?= esc($course['title']) ?></h1>
  <?php if ($course['module']): ?><span class="pill"><span class="dot"></span> <?= esc($course['module']) ?></span><?php endif; ?>
  <p class="subtitle">Wähle eine Übung aus. Jede Übung folgt der Schleife: sehen → verstehen → beschreiben → KI-Feedback → mit Musterlösung vergleichen.</p>

  <?php foreach ($course['lessons'] as $lesson): ?>
    <section class="course-block">
      <div class="lesson-label" style="margin-top:6px"><?= esc($lesson['title']) ?></div>
      <div class="gallery">
        <?php foreach ($lesson['items'] as $it) ex_card($it['loc'], $it['ex'], $done); ?>
      </div>
    </section>
  <?php endforeach; ?>

  <?= site_footer($course['title']) ?>
</div>

<script>
(function () {
  var progress = {};
  try { progress = JSON.parse(localStorage.getItem("biomech_progress") || "{}"); } catch (e) {}
  document.querySelectorAll(".ex-card").forEach(function (card) {
    if (card.dataset.done === "1") return;
    var p = progress[card.dataset.exid]; if (!p) return;
    var st = card.querySelector("[data-status]"), txt = card.querySelector("[data-status-text]");
    if (p.feedback) { st.classList.add("done"); txt.textContent = "Abgeschlossen"; }
    else if (p.opened) { txt.textContent = "Begonnen"; }
  });
})();
</script>
</body>
</html>
