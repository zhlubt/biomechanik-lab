<?php
/**
 * „Meine Abgaben" (Phase 4): eigene Beschreibungen + erhaltenes Feedback,
 * neueste zuerst. Nur für angemeldete Nutzer.
 */
require __DIR__ . '/_boot.php';
auth_boot();
function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$user = require_login('meine-abgaben.php');
$subs = list_user_submissions((int)$user['id']);

/** Übungstitel (für die Anzeige) cachen. */
$titleCache = [];
function ex_title(array $loc, array &$cache): string {
    $key = $loc['course'] . '/' . $loc['lesson'] . '/' . $loc['exercise'];
    if (!isset($cache[$key])) { $ex = load_exercise($loc); $cache[$key] = $ex['title'] ?? $key; }
    return $cache[$key];
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Meine Abgaben · Biomechanik-Lab</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Biomechanik-Lab</b><small>Trainingswissenschaft · Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <b>Meine Abgaben</b></nav>
  <h1 class="title">Meine Abgaben</h1>
  <p class="subtitle">Deine gespeicherten Beschreibungen und das KI-Feedback dazu — neueste zuerst.</p>

  <?php if (!$subs): ?>
    <p class="admin-note" style="margin-top:18px">Du hast noch nichts abgegeben. Öffne eine <a href="index.php">Übung</a>, schreibe eine Beschreibung und hol dir KI-Feedback — es wird dann hier gespeichert.</p>
  <?php else: ?>
    <div class="sub-list">
      <?php foreach ($subs as $s):
        $loc = ['course' => $s['course'], 'lesson' => $s['lesson'], 'exercise' => $s['exercise']];
        $exId = $s['course'] . '/' . $s['lesson'] . '/' . $s['exercise'];
        $markers = json_decode($s['markers_json'] ?? '[]', true) ?: [];
      ?>
      <div class="sub-card">
        <div class="sub-head">
          <div>
            <a class="sub-title" href="uebung.php?ex=<?= esc(urlencode($exId)) ?>"><?= esc(ex_title($loc, $titleCache)) ?></a>
            <div class="sub-meta"><?= esc($s['created_at']) ?> · <?= (int)$s['marker_count'] ?> Hinweis(e)</div>
          </div>
          <a class="ctrl" href="uebung.php?ex=<?= esc(urlencode($exId)) ?>" style="text-decoration:none">Übung öffnen →</a>
        </div>
        <details>
          <summary>Beschreibung &amp; Feedback ansehen</summary>
          <div class="sub-body">
            <p class="sub-label">Deine Beschreibung</p>
            <div class="sub-text"><?= nl2br(esc($s['student_text'])) ?></div>
            <?php if ($markers): ?>
              <p class="sub-label">KI-Hinweise (Fragen, keine Lösungen)</p>
              <ul class="sub-markers">
                <?php foreach ($markers as $m): ?>
                  <li><span class="sub-q">„<?= esc($m['quote'] ?? '') ?>"</span> — <?= esc($m['question'] ?? '') ?><?php if (!empty($m['nudge'])): ?> <span class="sub-nudge">💡 <?= esc($m['nudge']) ?></span><?php endif; ?></li>
                <?php endforeach; ?>
              </ul>
            <?php else: ?>
              <p class="sub-label">Kein Marker — die Beschreibung war schon präzise.</p>
            <?php endif; ?>
          </div>
        </details>
      </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <footer><span><b>Beschreibungs-Lab</b> · Universität Bayreuth</span><span>PHP-Variante</span></footer>
</div>
</body>
</html>
