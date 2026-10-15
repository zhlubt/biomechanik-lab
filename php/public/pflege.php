<?php
/**
 * Pflege-Oberfläche (Lehrende): Login + Übersicht + Editor für Prompts,
 * Musterlösung und Prosa je Übung. Speichert über content.php (Session-geschützt).
 * Passwort: PFLEGE_PASSWORD in private/.env.
 */
require __DIR__ . '/_boot.php';
app_session_start();
function esc($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

if (isset($_GET['logout'])) { $_SESSION = []; session_destroy(); header('Location: pflege.php'); exit; }

$pw = app_env('PFLEGE_PASSWORD');
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    // Das Pflege-Passwort ist zugleich der Lehrenden-Code und damit der Schluessel
    // zu ALLEN Abgaben. Raten muss teuer sein.
    $rl = rate_check('pflege:ip:' . client_ip(), 2, 900, 10);
    if (!$rl['ok']) {
        $loginError = 'Zu viele Versuche. Bitte ' . $rl['retry_after'] . ' s warten.';
    } elseif ($pw && hash_equals($pw, (string)$_POST['password'])) {
        session_regenerate_id(true);
        $_SESSION['pflege_auth'] = true;
        header('Location: pflege.php' . (isset($_GET['ex']) ? '?ex=' . urlencode($_GET['ex']) : ''));
        exit;
    } else {
        $loginError = 'Falsches Passwort.';
    }
}
$authed = !empty($_SESSION['pflege_auth']);

header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Übungen pflegen · Biomechanik-Lab</title><link rel="stylesheet" href="' . asset('styles.css') . '"></head><body><div class="shell">';

if (!$authed) {
    if (!$pw) {
        echo '<h1 class="title">Pflege gesperrt</h1><p class="subtitle">Es ist kein <code>PFLEGE_PASSWORD</code> in <code>private/.env</code> gesetzt. Bitte serverseitig hinterlegen.</p></div></body></html>';
        exit;
    }
    echo '<div class="admin-head"><h1 class="title" style="margin-bottom:6px">Anmeldung Pflege</h1><a class="ctrl" href="index.php" style="text-decoration:none">← Startseite</a></div>';
    if ($loginError) echo '<p class="save-err" style="margin-top:10px">⚠ ' . esc($loginError) . '</p>';
    echo '<form method="post" class="form" style="margin-top:18px;max-width:420px">'
       . csrf_field()
       . '<label class="field"><span class="field-label">Passwort</span><input type="password" name="password" autofocus></label>'
       . '<div class="form-actions"><button class="ctrl primary" type="submit">Anmelden</button></div></form>';
    echo '</div></body></html>';
    exit;
}

// --- angemeldet ---

/**
 * Einladungslink für Lehrpersonen. Er trägt den TEACHER_CODE und wird NUR hier
 * gezeigt — die Pflege ist passwortgeschützt, also der richtige Ort dafür.
 * Wer den Link öffnet, braucht nur noch seinen Namen einzugeben.
 */
function teacher_invite_link(): string {
    $code = (string)(app_env('TEACHER_CODE') ?? '');
    if ($code === '') return '';
    $scheme = is_https() ? 'https' : 'http';
    $host   = (string)($_SERVER['HTTP_HOST'] ?? 'biomechanik.zhl-ubt.de');
    $base   = rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/pflege.php')), '/');
    return $scheme . '://' . $host . $base . '/konto.php?lehrcode=' . rawurlencode($code);
}

$inviteLink = teacher_invite_link();
if ($inviteLink !== '' && !isset($_GET['neu']) && !isset($_GET['ex'])) {
    echo '<section class="invite">'
       . '<div class="invite-head"><b>Einladungslink für Lehrpersonen</b>'
       . '<span class="field-hint">Wer diesen Link öffnet, gibt nur seinen Namen ein und ist als Lehrperson angemeldet — mit Zugriff auf Abgaben und Nutzerverwaltung. Nicht öffentlich posten.</span></div>'
       . '<div class="invite-row">'
       .   '<input type="text" id="inviteLink" readonly value="' . esc($inviteLink) . '">'
       .   '<button class="ctrl" type="button" id="inviteCopy">Kopieren</button>'
       . '</div>'
       . '</section>'
       . '<script>document.getElementById("inviteCopy").addEventListener("click",function(){'
       . 'var f=document.getElementById("inviteLink");f.select();f.setSelectionRange(0,9999);'
       . 'var done=function(){this.textContent="Kopiert";var b=this;setTimeout(function(){b.textContent="Kopieren";},1600);}.bind(this);'
       . 'if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(f.value).then(done,done);}'
       . 'else{try{document.execCommand("copy");done();}catch(e){}}});</script>';
} elseif ($inviteLink === '' && !isset($_GET['neu']) && !isset($_GET['ex'])) {
    echo '<p class="admin-note">Kein <code>TEACHER_CODE</code> in <code>private/.env</code> hinterlegt — '
       . 'ohne ihn kann sich niemand als Lehrperson anmelden.</p>';
}

// Neue Übung anlegen
if (isset($_GET['neu'])) {
    $err = $_SESSION['create_error'] ?? ''; unset($_SESSION['create_error']);
    echo '<div class="admin-head"><h1 class="title" style="margin-bottom:6px">Neue Übung anlegen</h1><a class="ctrl" href="pflege.php" style="text-decoration:none">← Übersicht</a></div>';
    if ($err) echo '<p class="save-err" style="margin-top:10px">⚠ ' . esc($err) . '</p>';
    echo '<p class="admin-note">Lege das Grundgerüst an (Adresse, Medium, Prompt, Musterlösung). Feinschliff danach im Editor; Legende/Glossar bei Bedarf direkt in der JSON.</p>';
    ?>
    <div class="designer">
      <div class="designer-head"><b>Aus Bild per KI vorbefüllen</b> <span class="field-hint">(optional) — lade ein Bild des Mediums (Diagramm, Videostandbild, 3D-Ansicht) hoch; die KI entwirft Titel, Aufgabe, Prompt, Musterlösung &amp; Kategorien.</span></div>
      <div class="designer-row">
        <input type="file" id="dz_image" accept="image/png,image/jpeg,image/webp,image/gif">
        <input id="dz_hint" placeholder="Optionaler Hinweis (z. B. „Sprunggelenk-Winkel im Absprung")" style="flex:1;min-width:220px">
        <button class="ctrl primary" type="button" id="dz_go">Entwurf erzeugen</button>
        <span id="dz_status" class="field-hint"></span>
      </div>
    </div>
    <form class="form" method="post" action="create.php" enctype="multipart/form-data" style="margin-top:18px">
      <?= csrf_field() ?>
      <div class="lab" style="grid-template-columns:1fr 1fr;gap:14px">
        <label class="field"><span class="field-label">Kurs-ID <span class="field-hint">(z. B. trainingswissenschaft)</span></span><input name="course" required pattern="[a-z0-9_-]+"></label>
        <label class="field"><span class="field-label">Kurs-Titel</span><input name="courseTitle" placeholder="Trainingswissenschaft"></label>
        <label class="field"><span class="field-label">Lektions-ID <span class="field-hint">(z. B. wurfdisziplinen)</span></span><input name="lesson" required pattern="[a-z0-9_-]+"></label>
        <label class="field"><span class="field-label">Lektions-Titel</span><input name="lessonTitle" placeholder="Wurf- & Stoßdisziplinen"></label>
        <label class="field"><span class="field-label">Übungs-ID <span class="field-hint">(Dateiname, z. B. speerwurf-phasen)</span></span><input name="exercise" required pattern="[a-z0-9_-]+"></label>
        <label class="field"><span class="field-label">Nummer <span class="field-hint">(Anzeige, z. B. 02)</span></span><input name="number" placeholder="01"></label>
      </div>
      <label class="field"><span class="field-label">Titel</span><input name="title" required placeholder="Die Phasen des … erkennen und benennen."></label>
      <label class="field"><span class="field-label">Intro</span><textarea name="intro" rows="2"></textarea></label>
      <label class="field"><span class="field-label">Aufgabe</span><textarea name="task" rows="2"></textarea></label>

      <div class="field">
        <span class="field-label">Medium</span>
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="kind" value="video" checked> Video</label>
          <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="kind" value="jumpforce"> Sprung-Simulation (CMJ)</label>
          <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="timestampMode" value="1"> Zeitstempel-Funktion (Phasen)</label>
        </div>
      </div>
      <div class="lab" style="grid-template-columns:2fr 1fr 1fr;gap:14px">
        <label class="field"><span class="field-label">Video-Datei <span class="field-hint">(mp4/mov/webm, web-tauglich)</span></span><input type="file" name="video" accept="video/*"></label>
        <label class="field"><span class="field-label">fps</span><input name="fps" value="30"></label>
        <label class="field"><span class="field-label">Dauer (s)</span><input name="durationSec" value="5"></label>
      </div>

      <label class="field"><span class="field-label">Medien-Beschreibung <span class="field-hint">(Kontext fürs LLM)</span></span><textarea name="mediaDescription" rows="3"></textarea></label>
      <label class="field field-accent"><span class="field-label">Feedback-Prompt <span class="field-hint">(sokratisch — Fragen, keine Lösungen; fordert striktes JSON)</span></span><textarea name="feedbackPrompt" rows="6"></textarea></label>
      <label class="field field-accent"><span class="field-label">Musterlösung</span><textarea name="modelSolution" rows="5"></textarea></label>
      <label class="field"><span class="field-label">Zielkonzepte <span class="field-hint">(kommagetrennt)</span></span><input name="targetConcepts"></label>
      <label class="field"><span class="field-label">Feedback-Kategorien <span class="field-hint">(je Zeile: schluessel | Label | #farbe)</span></span><textarea name="categories" rows="3" placeholder="phasen | Phasen-Zuordnung | #3a63d8&#10;zeit | Zeitpunkte | #d98018&#10;technik | Technik | #1aa56a"></textarea></label>
      <label class="field demo-note"><span class="field-label">Demo-Text <span class="field-hint">(optionaler Beispieltext für die Tipp-Animation)</span></span><textarea name="demoText" rows="2"></textarea></label>

      <div class="form-actions">
        <button class="ctrl primary" type="submit">➕ Übung anlegen</button>
        <a class="ctrl" href="pflege.php" style="text-decoration:none">Abbrechen</a>
      </div>
    </form>
    <script>
    (function () {
      var CSRF = <?= json_encode(csrf_token()) ?>;
      var go = document.getElementById('dz_go'), st = document.getElementById('dz_status'),
          img = document.getElementById('dz_image'), hint = document.getElementById('dz_hint');
      function setVal(name, val) { var el = document.querySelector('[name="' + name + '"]'); if (el && val != null) el.value = val; }
      go.addEventListener('click', function () {
        if (!img.files || !img.files[0]) { st.textContent = '⚠ Bitte erst ein Bild wählen.'; st.className = 'field-hint save-err'; return; }
        var fd = new FormData(); fd.append('image', img.files[0]); fd.append('hint', hint.value || '');
        go.disabled = true; st.textContent = 'KI entwirft … (kann ~15 s dauern)'; st.className = 'field-hint';
        fd.append('csrf', CSRF);
        fetch('generate-draft.php', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (r) {
            if (!r.ok) throw new Error((r.j && r.j.error) || 'Fehler'); var d = r.j.draft || {};
            setVal('title', d.title); setVal('intro', d.intro); setVal('task', d.task);
            setVal('mediaDescription', d.mediaDescription); setVal('feedbackPrompt', d.feedbackPrompt); setVal('modelSolution', d.modelSolution);
            if (Array.isArray(d.targetConcepts)) setVal('targetConcepts', d.targetConcepts.join(', '));
            if (Array.isArray(d.categories)) setVal('categories', d.categories.map(function (c) { return c.key + ' | ' + c.label + ' | ' + (c.color || '#3a63d8'); }).join('\n'));
            st.textContent = '✓ Entwurf eingefügt — bitte prüfen und ggf. anpassen.'; st.className = 'field-hint save-ok';
          })
          .catch(function (e) { st.textContent = '⚠ ' + e.message; st.className = 'field-hint save-err'; })
          .finally(function () { go.disabled = false; });
      });
    })();
    </script>
    <?php
    echo '</div></body></html>';
    exit;
}

$editLoc = null;
if (!empty($_GET['ex'])) {
    $p = explode('/', (string)$_GET['ex']);
    if (count($p) === 3) $editLoc = ['course' => $p[0], 'lesson' => $p[1], 'exercise' => $p[2]];
}

if ($editLoc) {
    $f = read_editable_fields($editLoc);
    if ($f === null) { echo '<h1 class="title">Übung nicht gefunden</h1><a class="ctrl" href="pflege.php">← Übersicht</a></div></body></html>'; exit; }
    $exId = $editLoc['course'] . '/' . $editLoc['lesson'] . '/' . $editLoc['exercise'];
    echo '<div class="admin-head"><div><h1 class="title" style="margin-bottom:6px">' . esc($f['title'] ?: 'Übung pflegen') . '</h1><p class="subtitle" style="margin-bottom:0"><code>' . esc($exId) . '</code></p></div>'
       . '<div style="display:flex;gap:8px"><a class="ctrl" href="uebung.php?ex=' . esc(urlencode($exId)) . '" style="text-decoration:none">Ansehen</a><a class="ctrl" href="pflege.php" style="text-decoration:none">← Übersicht</a><a class="ctrl" href="pflege.php?logout=1" style="text-decoration:none">Abmelden</a></div></div>';
    ?>
    <div class="form" id="form" style="margin-top:22px">
      <label class="field"><span class="field-label">Titel</span><input id="f_title" value="<?= esc($f['title']) ?>"></label>
      <label class="field"><span class="field-label">Intro (Untertitel)</span><textarea id="f_intro" rows="3"><?= esc($f['intro']) ?></textarea></label>
      <label class="field"><span class="field-label">Aufgabenstellung</span><textarea id="f_task" rows="3"><?= esc($f['task']) ?></textarea></label>

      <div class="field">
        <span class="field-label">Vorschaubild (Galerie-Kachel) <span class="field-hint">(png/jpg/webp · wird auf der Startseite gezeigt)</span></span>
        <div class="thumb-edit">
          <div class="thumb-prev" id="thumbPrev"><?php if ($f['thumbnail']): ?><img src="<?= esc($f['thumbnail']) ?>" alt=""><?php else: ?><span>kein Bild</span><?php endif; ?></div>
          <div class="thumb-edit-ctrls">
            <input type="file" id="f_thumbfile" accept="image/png,image/jpeg,image/webp,image/gif">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
              <button class="ctrl" type="button" id="thumbUpload">⬆ Bild hochladen</button>
              <span id="thumbStatus" class="field-hint"></span>
            </div>
            <label class="field" style="margin-top:10px"><span class="field-label" style="font-size:12px">…oder Pfad direkt setzen</span><input id="f_thumbnail" value="<?= esc($f['thumbnail']) ?>" placeholder="img/thumb_beispiel.png"></label>
          </div>
        </div>
      </div>

      <label class="field"><span class="field-label">Zielkonzepte <span class="field-hint">(kommagetrennt)</span></span><input id="f_concepts" value="<?= esc(implode(', ', $f['targetConcepts'])) ?>"></label>
      <label class="field"><span class="field-label">Medien-Beschreibung <span class="field-hint">(geht als Kontext ans LLM)</span></span><textarea id="f_media" rows="4"><?= esc($f['mediaDescription']) ?></textarea></label>
      <label class="field field-accent"><span class="field-label">Feedback-Prompt <span class="field-hint">(sokratisch — Fragen, keine Lösungen)</span></span><textarea id="f_prompt" rows="8"><?= esc($f['feedbackPrompt']) ?></textarea></label>
      <label class="field field-accent"><span class="field-label">Musterlösung <span class="field-hint">(verborgen; auch interne LLM-Referenz)</span></span><textarea id="f_solution" rows="8"><?= esc($f['modelSolution']) ?></textarea></label>
      <div class="form-actions">
        <button class="ctrl primary" id="saveBtn">💾 Speichern</button>
        <span id="status"></span>
      </div>
    </div>
    <script>
      var LOC = <?= json_encode($editLoc, JSON_UNESCAPED_SLASHES) ?>;
      var CSRF = <?= json_encode(csrf_token()) ?>;
      document.getElementById('saveBtn').addEventListener('click', function () {
        var btn = this, st = document.getElementById('status');
        btn.disabled = true; st.textContent = ''; st.className = '';
        var fields = {
          title: document.getElementById('f_title').value,
          intro: document.getElementById('f_intro').value,
          task: document.getElementById('f_task').value,
          thumbnail: document.getElementById('f_thumbnail').value.trim(),
          mediaDescription: document.getElementById('f_media').value,
          feedbackPrompt: document.getElementById('f_prompt').value,
          modelSolution: document.getElementById('f_solution').value,
          targetConcepts: document.getElementById('f_concepts').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        };
        fetch('content.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(Object.assign({}, LOC, { fields: fields })) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (r) { if (!r.ok) throw new Error((r.j && r.j.error) || 'Fehler'); st.textContent = '✓ Gespeichert.'; st.className = 'save-ok'; })
          .catch(function (e) { st.textContent = '⚠ ' + e.message; st.className = 'save-err'; })
          .finally(function () { btn.disabled = false; });
      });

      // Vorschaubild hochladen (separater Multipart-Upload; setzt thumbnail direkt in der JSON)
      document.getElementById('thumbUpload').addEventListener('click', function () {
        var btn = this, st = document.getElementById('thumbStatus'), fileEl = document.getElementById('f_thumbfile');
        if (!fileEl.files || !fileEl.files[0]) { st.textContent = '⚠ Bitte erst eine Bilddatei wählen.'; st.className = 'field-hint save-err'; return; }
        var fd = new FormData();
        fd.append('course', LOC.course); fd.append('lesson', LOC.lesson); fd.append('exercise', LOC.exercise);
        fd.append('image', fileEl.files[0]);
        btn.disabled = true; st.textContent = 'lädt …'; st.className = 'field-hint';
        fd.append('csrf', CSRF);
        fetch('thumbnail.php', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (r) {
            if (!r.ok) throw new Error((r.j && r.j.error) || 'Upload fehlgeschlagen');
            var path = r.j.thumbnail;
            document.getElementById('f_thumbnail').value = path;
            document.getElementById('thumbPrev').innerHTML = '<img src="' + path + '?t=' + Date.now() + '" alt="">';
            st.textContent = '✓ Hochgeladen & gesetzt.'; st.className = 'field-hint save-ok';
          })
          .catch(function (e) { st.textContent = '⚠ ' + e.message; st.className = 'field-hint save-err'; })
          .finally(function () { btn.disabled = false; });
      });
    </script>
    <?php
    echo '</div></body></html>';
    exit;
}

// Übersicht
echo '<div class="admin-head"><div><h1 class="title" style="margin-bottom:6px">Übungen pflegen</h1><p class="subtitle" style="margin-bottom:0">Prompts, Musterlösungen und Texte je Übung bearbeiten.</p></div><div style="display:flex;gap:8px"><a class="ctrl primary" href="pflege.php?neu=1" style="text-decoration:none">➕ Neue Übung</a><a class="ctrl" href="index.php" style="text-decoration:none">← Startseite</a><a class="ctrl" href="pflege.php?logout=1" style="text-decoration:none">Abmelden</a></div></div>';
echo '<p class="admin-note">ℹ️ Neue Übung = neue JSON-Datei unter <code>content/&lt;course&gt;/&lt;lesson&gt;/&lt;exercise&gt;.json</code> (in <code>private/</code>); sie erscheint dann automatisch hier.</p>';
$items = list_exercises();
if (!$items) { echo '<p class="subtitle" style="margin-top:18px">Noch keine Übung vorhanden.</p>'; }
else {
    echo '<ul class="admin-list">';
    foreach ($items as $loc) {
        $ex = load_exercise($loc);
        $exId = $loc['course'] . '/' . $loc['lesson'] . '/' . $loc['exercise'];
        echo '<li class="admin-row"><div><div style="font-weight:600">' . esc($ex['title'] ?? $exId) . '</div>'
           . '<div class="meta">' . esc($ex['course']['title'] ?? '') . ' · ' . esc($ex['lesson']['title'] ?? '') . ' · ' . esc($exId) . '</div></div>'
           . '<div class="actions"><a class="ctrl" href="uebung.php?ex=' . esc(urlencode($exId)) . '">Ansehen</a>'
           . '<a class="ctrl primary" href="pflege.php?ex=' . esc(urlencode($exId)) . '">✏ Pflegen</a></div></li>';
    }
    echo '</ul>';
}
echo '</div></body></html>';
