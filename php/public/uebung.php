<?php
/**
 * Datengetriebene Übungsseite (PHP-Variante). Rendert die statischen Inhalte aus
 * der Übungs-JSON und überlässt Animation + Editor + KI-Feedback der app.js.
 * Der feedbackPrompt verlässt den Server NICHT (wird nicht in den Client injiziert).
 */
require __DIR__ . '/_boot.php';
auth_boot();

function esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

// Übung wählen: ?ex=course/lesson/exercise, sonst erste vorhandene.
$loc = null;
if (!empty($_GET['ex'])) {
    $p = explode('/', (string)$_GET['ex']);
    if (count($p) === 3) $loc = ['course' => $p[0], 'lesson' => $p[1], 'exercise' => $p[2]];
}
if ($loc === null) {
    $all = list_exercises();
    if ($all) $loc = $all[0];
}
$ex = $loc ? load_exercise($loc) : null;

if ($ex === null) {
    http_response_code(404);
    echo '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><div class="shell"><h1 class="title">Keine Übung gefunden</h1><p class="subtitle">Lege eine Übung unter content/&lt;course&gt;/&lt;lesson&gt;/&lt;exercise&gt;.json an.</p></div>';
    exit;
}

// Medien nach Typ/Komponente auflösen
$jumpLab = null; $knee = null; $embed = null; $video = null; $model = null;
foreach (($ex['media'] ?? []) as $m) {
    if (($m['type'] ?? '') === 'interactive' && ($m['component'] ?? '') === 'JumpForceLab') $jumpLab = $m;
    if (($m['type'] ?? '') === 'interactive' && ($m['component'] ?? '') === 'KneeFrontal') $knee = $m;
    if (($m['type'] ?? '') === 'embed') $embed = $m;
    if (($m['type'] ?? '') === 'video' && $video === null) $video = $m;
    if (($m['type'] ?? '') === 'model3d' && $model === null) $model = $m;
}
// Primär-Medium: Video > 3D-Modell > Sprung-Simulation
$isVideo = $video !== null;
$isModel = $model !== null;
$primary = $isVideo ? $video : ($isModel ? $model : $jumpLab);
$cfg = ($primary['config'] ?? []);
$useTimestamps = ((bool)($ex['timestampMode'] ?? false) || $isVideo) && !$isModel;

// Client-sichere Daten (OHNE feedbackPrompt!)
$client = [
    'locator'     => $loc,
    'media'       => [
        'kind'        => $isVideo ? 'video' : ($isModel ? 'model3d' : 'jumpforce'),
        'src'         => $isVideo ? ($video['src'] ?? '') : ($isModel ? ($model['src'] ?? '') : null),
        'durationSec' => $cfg['durationSec'] ?? 3.0,
        'fps'         => $cfg['fps'] ?? 30,
    ],
    'timestamps'  => $useTimestamps,
    'phases'      => $cfg['phases'] ?? [],
    'categories'  => $ex['feedbackCategories'] ?? [],
    'demo'        => $ex['demo'] ?? ['studentText' => '', 'feedback' => ['markers' => []]],
    'loggedIn'    => is_logged_in(),
];
$crumbModule = !empty($ex['course']['module']) ? $ex['course']['module'] . ' · ' : '';
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title><?= esc($ex['title']) ?> · Biomechanik-Lab</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">

  <header class="top">
    <div class="brand">
      <div class="logo" aria-hidden="true"></div>
      <div>
        <b>Biomechanik-Lab</b>
        <small><?= esc($ex['course']['title'] ?? '') ?><?= !empty($ex['course']['module']) ? ' · ' . esc($ex['course']['module']) : '' ?></small>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px"><?= auth_nav_html() ?></div>
  </header>

  <nav class="breadcrumbs">
    <a href="index.php">Übersicht</a> <span>›</span>
    <a href="kurs.php?id=<?= esc(urlencode($loc['course'])) ?>"><?= esc($ex['course']['title'] ?? $loc['course']) ?></a> <span>›</span>
    <b><?= esc($ex['lesson']['title'] ?? $loc['lesson']) ?></b>
    <?php if (!empty($ex['number'])): ?><span>·</span> Übung <?= esc($ex['number']) ?><?php endif; ?>
  </nav>

  <h1 class="title"><?= esc($ex['title']) ?></h1>
  <p class="subtitle"><?= esc($ex['intro']) ?></p>
  <?php if (!empty($ex['status'])): ?><span class="pill"><span class="dot"></span> <?= esc($ex['status']) ?></span><?php endif; ?>

  <!-- LAB: Animation + Konzept/Glossar -->
  <section class="lab" style="margin-top:24px">
    <div class="card">
      <h3><?= esc($primary['label'] ?? '01 · Bewegungs- & Kraftanalyse') ?></h3>
      <div class="body" style="padding:14px">
        <div class="player">
          <?php if ($isModel): ?>
            <!-- 3D-Modell-Betrachter (three.js, Modul unten) -->
            <div id="viewer3d" class="viewer3d" aria-label="Interaktives 3D-Modell des Beins">
              <div class="viewer3d-loading" id="viewer3dLoading">3D-Modell wird geladen … <b id="viewer3dPct">0 %</b></div>
            </div>
            <div class="model-controls">
              <div class="layer-toggles" id="layerToggles" role="group" aria-label="Schichten ein-/ausblenden"></div>
              <div class="model-actions">
                <button class="ctrl" id="resetView" title="Kamera in die Ausgangsperspektive zurücksetzen">⟳ Ansicht zurücksetzen</button>
                <button class="ctrl" id="layersAll" title="Alle Schichten wieder einblenden">Alle Schichten einblenden</button>
                <span class="hint">Drehen: ziehen · Zoom: Mausrad / Pinch · Verschieben: Rechtsklick&nbsp;+&nbsp;ziehen</span>
              </div>
            </div>
          <?php elseif ($isVideo): ?>
            <video id="vid" preload="metadata" playsinline style="display:block;width:100%;max-height:520px;background:#000;object-fit:contain">
              <source src="<?= esc($video['src']) ?>" type="video/mp4" />
              Dein Browser unterstützt das Video-Tag nicht.
            </video>
          <?php else: ?>
            <svg id="stage" class="stage" viewBox="0 0 720 460" preserveAspectRatio="xMidYMid meet" aria-label="Schematische Sprunganimation mit Kraftkurven"></svg>
          <?php endif; ?>
          <?php if (!$isModel): ?>
          <div class="scrub-wrap">
            <div class="scrub" id="scrub"><div class="track"><div class="fill"></div></div><div class="head"></div></div>
            <div class="phases" id="phases">
              <?php foreach (($cfg['phases'] ?? []) as $ph): ?>
                <button data-jump="<?= esc($ph['t']) ?>"><?= esc($ph['label']) ?></button>
              <?php endforeach; ?>
            </div>
          </div>
          <div class="controls">
            <button class="ctrl primary" id="playBtn" aria-label="Abspielen / Pause">
              <svg viewBox="0 0 24 24" fill="currentColor"><path id="playIcon" d="M8 5v14l11-7z"/></svg>
              <span id="playLabel">Abspielen</span>
            </button>
            <button class="ctrl" id="prevFrame" title="Frame zurück (←)">−1 Frame</button>
            <button class="ctrl" id="nextFrame" title="Frame vor (→)">+1 Frame</button>
            <div class="speed" role="group" aria-label="Geschwindigkeit">
              <button data-rate="0.25">0.25×</button>
              <button data-rate="0.5">0.5×</button>
              <button data-rate="1" class="on">1×</button>
              <button data-rate="2">2×</button>
            </div>
            <div class="time" id="time">00:00.000 / 00:03.000</div>
          </div>
          <div class="shortcuts">
            <b>Shortcuts:</b>
            <span><span class="kbd">Space</span> Play/Pause</span>
            <span><span class="kbd">←</span><span class="kbd">→</span> Frame</span>
            <span><span class="kbd">,</span><span class="kbd">.</span> 0.25 s</span>
            <span><span class="kbd">1</span>–<span class="kbd">4</span> Speed</span>
          </div>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>02 · Was bedeutet was?</h3>
      <div class="body">
        <div class="legend">
          <?php foreach (($ex['legend'] ?? []) as $it): ?>
            <div class="axis-row">
              <span class="swatch" style="background:<?= esc($it['color']) ?>"></span>
              <div>
                <b style="color:<?= esc($it['color']) ?>"><?= esc($it['label']) ?></b>
                <span class="hint"><?= esc($it['hint']) ?></span>
              </div>
              <?php if (!empty($it['colorName'])): ?><code><?= esc($it['colorName']) ?></code><?php else: ?><span></span><?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
        <div class="glossary">
          <details>
            <summary>Fachvokabular auf einen Blick</summary>
            <div class="term-body">
              <?php foreach (($ex['glossary'] ?? []) as $g): ?>
                <p><b><?= esc($g['term']) ?></b> — <?= esc($g['definition']) ?></p>
              <?php endforeach; ?>
            </div>
          </details>
          <details>
            <summary><?= esc($ex['guidance']['title'] ?? 'So beschreibst du Messdaten sauber') ?></summary>
            <div class="term-body">
              <ol style="padding-left:18px;margin:0">
                <?php foreach (($ex['guidance']['steps'] ?? []) as $s): ?><li><?= esc($s) ?></li><?php endforeach; ?>
              </ol>
            </div>
          </details>
        </div>
      </div>
    </div>
  </section>

  <!-- Knie-Detail + Embed (nur falls vorhanden) -->
  <?php if ($knee || $embed): ?>
  <section class="lab" style="margin-top:22px;grid-template-columns:1fr 1fr">
    <?php if ($knee): ?>
    <div class="card">
      <h3><?= esc($knee['label'] ?? '06 · Knie-Detail · Frontalebene') ?></h3>
      <div class="body" style="padding:14px">
        <div class="player" style="background:#0e1118">
          <svg id="knee" viewBox="0 0 360 320" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;background:linear-gradient(180deg,#0e1118,#11151d)" aria-label="Schematisches Knie, synchron zur Animation"></svg>
        </div>
        <?php if (!empty($knee['caption'])): ?><p style="margin:10px 2px 0;color:var(--ink-mute);font-size:13px;line-height:1.5"><?= esc($knee['caption']) ?></p><?php endif; ?>
      </div>
    </div>
    <?php endif; ?>
    <?php if ($embed): ?>
    <div class="card">
      <h3><?= esc($embed['label'] ?? '07 · Vom Schema zur echten Anatomie') ?></h3>
      <div class="body">
        <?php if (!empty($embed['description'])): ?><p style="margin:0 0 12px;color:var(--ink-dim);font-size:15px;line-height:1.6"><?= esc($embed['description']) ?></p><?php endif; ?>
        <div class="qr-embed">
          <div aria-label="QR-Code-Platzhalter" style="width:128px;height:128px;border:1px solid var(--border);border-radius:10px;background:repeating-conic-gradient(#0e1118 0% 25%, #1a2230 0% 50%) 0 / 18px 18px;display:flex;align-items:center;justify-content:center;color:#9aa6b6;font-size:11px;text-align:center;padding:8px">URL noch nicht gesetzt</div>
          <div style="flex:1;min-width:160px">
            <p style="margin:0 0 6px;color:var(--ink);font-weight:600;font-size:14px">3D-Modell öffnen</p>
            <p style="margin:0;color:var(--ink-mute);font-size:13px;line-height:1.5">Code mit dem Handy scannen — keine App, kein Login.</p>
          </div>
        </div>
      </div>
    </div>
    <?php endif; ?>
  </section>
  <?php endif; ?>

  <!-- Schreiben + Feedback -->
  <section class="write">
    <h2>03 · Deine Beschreibung</h2>
    <p class="lead"><?= esc($ex['task']) ?></p>
    <div class="editor-shell" id="editorShell">
      <div class="editor-toolbar">
        <span class="live" id="liveLabel">live · Studierende:r tippt</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="ctrl demo-hint" id="skipType" style="padding:5px 10px;font-size:12px">⏭ Sofort fertig</button>
          <button class="ctrl demo-hint" id="replayType" style="padding:5px 10px;font-size:12px">↻ Neu abspielen</button>
        </div>
      </div>
      <?php if ($useTimestamps): ?>
      <div class="ts-bar">
        <button class="ctrl" id="tsInsert" title="Aktuelle Videozeit als [m:ss.xx] an der Cursor-Position einfügen">⏱ Zeitstempel einfügen</button>
        <span>Videozeit: <span class="ts-now" id="tsNow">0:00.00</span></span>
        <span style="margin-left:auto;color:var(--ink-mute)">Beschreibe jede Phase und benenne ihren Zeitpunkt im Video.</span>
      </div>
      <?php endif; ?>
      <div class="editor" id="editor" aria-label="Schreibfeld"></div>
      <div class="hint-banner" id="hintBanner"></div>
      <div class="editor-actions">
        <button class="ctrl primary" id="aiBtn" disabled>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z"/></svg>
          <span id="aiBtnLabel">KI Feedback</span>
        </button>
        <button class="ctrl demo-hint" id="resetBtn">↺ Zurücksetzen</button>
        <span class="hint" id="wordCount">0 Wörter</span>
      </div>
    </div>
  </section>

  <!-- Schreib-Gerüst + Musterlösung -->
  <section class="assistant">
    <div class="card">
      <h3>04 · Schreib-Gerüst</h3>
      <div class="body scaffold">
        <p style="margin:0;color:var(--ink-dim);font-size:13.5px">Nutze diese vier Schritte als Stütze — sie führen vom Sehen zum Verstehen:</p>
        <ol>
          <?php foreach (($ex['scaffold'] ?? []) as $s): ?><li><b><?= esc($s['step']) ?>.</b> <?= esc($s['text']) ?></li><?php endforeach; ?>
        </ol>
      </div>
    </div>
    <div class="card expert" id="expertCard">
      <h3>05 · Vergleich mit Experten-Beschreibung</h3>
      <div class="body">
        <div class="expert-body"><?= esc($ex['modelSolution'] ?? '') ?></div>
        <div class="reveal"><button class="ctrl" id="revealExpert">👁 Experten-Beschreibung einblenden</button></div>
      </div>
    </div>
  </section>

  <footer>
    <span><b>Beschreibungs-Lab · <?= esc($ex['course']['title'] ?? '') ?></b> · Universität Bayreuth</span>
    <span>PHP-Variante · datengetrieben aus content/…/<?= esc($loc['exercise']) ?>.json</span>
  </footer>
</div>

<script>window.EXERCISE = <?= json_encode($client, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>;</script>
<?php if ($isModel): ?>
<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/"
}}
</script>
<script type="module" src="model-viewer.js"></script>
<?php endif; ?>
<script src="app.js"></script>
</body>
</html>
