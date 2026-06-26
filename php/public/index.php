<?php
/**
 * Startseite (Phase 3): Zielsetzung + nach Kursen/Lektionen gruppierte Galerie,
 * Anmeldestatus in der Kopfzeile, Fortschritt (DB für Angemeldete, sonst localStorage).
 */
require __DIR__ . '/_boot.php';
require __DIR__ . '/_partials.php';
auth_boot();

$courses = list_courses();
$user = current_user();
$done = $user ? user_done_exercises((int)$user['id']) : [];
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Biomechanik-Lab · Übungsübersicht</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">

  <header class="top">
    <div class="brand">
      <div class="logo" aria-hidden="true"></div>
      <div><b>Biomechanik-Lab</b><small>Trainingswissenschaft · Universität Bayreuth</small></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <h1 class="title">Messgrößen erkennen, beschreiben, analysieren.</h1>
  <div class="mission">
    <h2>Worum es hier geht</h2>
    <p>
      Als Sportstudent:in lernst du in diesen Übungen, <b>biomechanische Messgrößen zu erkennen, sie in der
      Fachsprache präzise zu beschreiben und zu analysieren</b> — von Bodenreaktionskräften beim Absprung über
      Gelenkbelastungen bis zu den Phasen einer Wurfbewegung. In jeder Übung beobachtest du ein Medium
      (Simulation, Video oder 3D-Modell), beschreibst es in eigenen Worten und erhältst <b>sokratisches KI-Feedback</b>:
      gezielte Fragen und Hinweise, die dich präziser machen — niemals fertige Lösungen.
    </p>
    <div class="steps">
      <span class="step"><b>1</b> Sehen</span>
      <span class="step"><b>2</b> Verstehen</span>
      <span class="step"><b>3</b> Beschreiben</span>
      <span class="step"><b>4</b> KI-Feedback</span>
      <span class="step"><b>5</b> Mit Musterlösung vergleichen</span>
    </div>
  </div>

  <?php if (!$courses): ?>
    <p class="subtitle">Noch keine Übung vorhanden. Lege eine über die <a href="pflege.php">Pflege</a> an.</p>
  <?php else: ?>
    <?php foreach ($courses as $course): ?>
      <section class="course-block">
        <div class="course-head">
          <h2><a href="kurs.php?id=<?= esc(urlencode($course['id'])) ?>"><?= esc($course['title']) ?></a></h2>
          <?php if ($course['module']): ?><span class="course-module"><?= esc($course['module']) ?></span><?php endif; ?>
        </div>
        <?php foreach ($course['lessons'] as $lesson): ?>
          <div class="lesson-label"><?= esc($lesson['title']) ?></div>
          <div class="gallery">
            <?php foreach ($lesson['items'] as $it) ex_card($it['loc'], $it['ex'], $done); ?>
          </div>
        <?php endforeach; ?>
      </section>
    <?php endforeach; ?>
  <?php endif; ?>

  <footer>
    <span><b>Beschreibungs-Lab</b> · Trainingswissenschaft · Universität Bayreuth</span>
    <span>PHP-Variante · sokratisches KI-Feedback</span>
  </footer>
</div>

<script>
/* Fortschritt: serverseitig „Abgeschlossen" (DB) hat Vorrang; sonst localStorage (anonym). */
(function () {
  var progress = {};
  try { progress = JSON.parse(localStorage.getItem("biomech_progress") || "{}"); } catch (e) {}
  document.querySelectorAll(".ex-card").forEach(function (card) {
    if (card.dataset.done === "1") return; // schon serverseitig als abgeschlossen markiert
    var p = progress[card.dataset.exid];
    if (!p) return;
    var st = card.querySelector("[data-status]"), txt = card.querySelector("[data-status-text]");
    if (p.feedback) { st.classList.add("done"); txt.textContent = "Abgeschlossen"; }
    else if (p.opened) { txt.textContent = "Begonnen"; }
  });
})();
</script>
</body>
</html>
