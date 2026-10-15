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
<link rel="stylesheet" href="<?= esc(asset('styles.css')) ?>" />
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="brand"><div class="logo" aria-hidden="true"></div><div><b>Biomechanik-Lab</b><small>Trainingswissenschaft · Universität Bayreuth</small></div></div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs"><a href="index.php">Übersicht</a> <span>›</span> <b>Meine Abgaben</b></nav>
  <?php if (isset($_GET['geloescht'])): ?>
    <p class="save-ok" style="margin-top:14px">✓ Die Abgabe wurde gelöscht.</p>
  <?php elseif (($_GET['fehler'] ?? '') === 'bestaetigung'): ?>
    <p class="save-err" style="margin-top:14px">⚠ Zum Löschen des Kontos musst du <b>LÖSCHEN</b> eintippen.</p>
  <?php elseif (isset($_GET['fehler'])): ?>
    <p class="save-err" style="margin-top:14px">⚠ Das hat nicht geklappt.</p>
  <?php endif; ?>

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
            <div class="sub-meta"><?= esc($s['created_at']) ?> · <?= (int)$s['marker_count'] ?> Hinweis(e)
              · Feedback von <?= esc(llm_label_pretty((string)($s['model'] ?? ''))) ?></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <form method="post" action="meine-daten.php" onsubmit="return window.confirm('Diese Abgabe endgültig löschen?')" style="margin:0">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="delete_submission">
              <input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
              <button class="ctrl" type="submit" title="Diese Abgabe löschen">Löschen</button>
            </form>
            <a class="ctrl" href="uebung.php?ex=<?= esc(urlencode($exId)) ?>" style="text-decoration:none">Übung öffnen →</a>
          </div>
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

  <section class="card" style="margin-top:28px">
    <h3>Deine Daten</h3>
    <div class="body" style="padding:14px;display:flex;flex-direction:column;gap:14px">
      <p style="margin:0;color:var(--ink-dim);font-size:14px;line-height:1.6">
        Gespeichert sind: dein Name, deine Beschreibungen und das KI-Feedback dazu.
        Deine Texte werden zur Feedback-Erzeugung an <b><?= esc(llm_provenance()['service']) ?></b> übertragen;
        dort werden sie nicht dauerhaft für dich gespeichert.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <form method="post" action="meine-daten.php" style="margin:0">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="export">
          <button class="ctrl" type="submit">Meine Daten herunterladen (JSON)</button>
        </form>
        <span class="hint">Enthält alles, was zu dir gespeichert ist.</span>
      </div>

      <details>
        <summary style="cursor:pointer;color:var(--bad);font-weight:600">Konto und alle Daten löschen</summary>
        <form method="post" action="meine-daten.php" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"
              onsubmit="return window.confirm('Konto und ALLE Abgaben endgültig löschen? Das lässt sich nicht rückgängig machen.')">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="delete_account">
          <label class="field" style="margin:0;max-width:240px">
            <span class="field-label">Zum Bestätigen <code>LÖSCHEN</code> eintippen</span>
            <input name="bestaetigung" autocomplete="off" placeholder="LÖSCHEN">
          </label>
          <button class="ctrl" type="submit" style="border-color:var(--bad);color:var(--bad)">Endgültig löschen</button>
        </form>
        <p class="hint" style="margin:10px 0 0">Danach sind dein Konto, alle Beschreibungen und das Feedback unwiderruflich entfernt.</p>
      </details>
    </div>
  </section>

  <?= site_footer('Meine Abgaben') ?>
</div>
</body>
</html>
