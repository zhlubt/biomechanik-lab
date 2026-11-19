<?php
/** Gemeinsame Render-Bausteine für Startseite und Kurs-Übersicht (Phase 3). */
declare(strict_types=1);

if (!function_exists('esc')) {
    function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}

function exercise_kind(array $ex): string {
    foreach (($ex['media'] ?? []) as $m) { if (in_array($m['type'] ?? '', ['video', 'youtube'], true)) return 'video'; }
    foreach (($ex['media'] ?? []) as $m) { if (($m['type'] ?? '') === 'model3d') return 'model3d'; }
    foreach (($ex['media'] ?? []) as $m) { if (($m['type'] ?? '') === 'frame') return 'frame'; }
    foreach (($ex['media'] ?? []) as $m) { if (($m['type'] ?? '') === 'interactive') return 'animation'; }
    return 'medium';
}

/** Eine Übungs-Kachel. $done = Set "course/lesson/exercise" der erledigten Übungen. */
function ex_card(array $loc, array $ex, array $done): void {
    $kind = exercise_kind($ex);
    $exId = $loc['course'] . '/' . $loc['lesson'] . '/' . $loc['exercise'];
    $kindLabel = $kind === 'video' ? 'Video-Analyse' : ($kind === 'model3d' ? '3D-Modell' : ($kind === 'frame' ? '3D-Animation' : ($kind === 'animation' ? 'Simulation' : 'Medium')));
    // Schlichte Glyphen statt Piktogrammen (Hausregel: Symbole minimalistisch).
    $icon = $kind === 'video' ? '▷' : ($kind === 'model3d' || $kind === 'frame' ? '◳' : ($kind === 'image' ? '◱' : '◰'));
    $thumb = trim((string)($ex['thumbnail'] ?? ''));
    $isDone = isset($done[$exId]);
    ?>
    <a class="ex-card" href="uebung.php?ex=<?= esc(urlencode($exId)) ?>" data-exid="<?= esc($exId) ?>" data-done="<?= $isDone ? '1' : '0' ?>">
      <div class="thumb<?= $thumb ? ' has-img' : '' ?>">
        <span class="kind"><?= esc($kindLabel) ?></span>
        <?php if ($thumb): ?><img class="thumb-img" src="<?= esc($thumb) ?>" alt="" loading="lazy"><?php else: ?><span style="font-size:34px"><?= $icon ?></span><?php endif; ?>
      </div>
      <div class="ex-body">
        <div class="ex-course"><?= esc($ex['lesson']['title'] ?? '') ?></div>
        <p class="ex-title"><?= esc($ex['title']) ?></p>
        <p class="ex-intro"><?= esc($ex['intro']) ?></p>
        <div class="ex-foot">
          <span class="ex-status<?= $isDone ? ' done' : '' ?>" data-status><span class="dot"></span><span data-status-text><?= $isDone ? 'Abgeschlossen' : 'Neu' ?></span></span>
          <span class="ex-open">Öffnen →</span>
        </div>
      </div>
    </a>
    <?php
}
