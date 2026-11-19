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
    // Daten fürs Formular: vorhandene Bereiche/Lektionen (Vorschläge + Übernahme der
    // Bereichs-Einstellungen), Animationsseiten, Medientypen, 3D-Schichten.
    $known = [];
    foreach (list_exercises() as $l) {
        $e = load_exercise($l);
        if (!$e) continue;
        $cid = $l['course'];
        if (!isset($known[$cid])) {
            $known[$cid] = ['title' => $e['course']['title'] ?? $cid, 'module' => $e['course']['module'] ?? '',
                            'appTitle' => $e['course']['appTitle'] ?? '', 'order' => $e['course']['order'] ?? 0, 'lessons' => []];
        }
        $known[$cid]['lessons'][$l['lesson']] = $e['lesson']['title'] ?? $l['lesson'];
    }
    $guidePath = PRIVATE_DIR . '/llm-anleitung.md';
    $guide = is_readable($guidePath) ? (string)file_get_contents($guidePath) : '';
    $nuData = [
        'csrf'    => csrf_token(),
        'courses' => $known,
        'frames'  => exercise_available_frames(__DIR__),
        'kinds'   => exercise_media_kinds(),
        'layers'  => exercise_model_layers(),
    ];
    echo '<div class="admin-head"><h1 class="title" style="margin-bottom:6px">Neue Übung anlegen</h1><a class="ctrl" href="pflege.php" style="text-decoration:none">← Übersicht</a></div>';
    ?>
    <p class="admin-note">Hier lässt sich alles angeben, was die Übungsseite darstellen kann. Pflicht sind Adresse, Titel, Medium, Aufgabe, Feedback-Kategorien und Feedback-Prompt. Die Abschnitte folgen der Reihenfolge, in der Studierende die Übung erleben.</p>

    <section class="nu-ki" aria-labelledby="nu-ki-h">
      <h2 id="nu-ki-h">Mit einer KI entwickeln</h2>
      <ol class="nu-ki-steps">
        <li>
          <b>Anleitung kopieren</b> und als erste Nachricht in einen KI-Chat einfügen (z. B. ChatGPT, Claude oder den Chat des NHR@FAU).
          <div class="nu-row">
            <button class="ctrl primary" type="button" id="nu_guideCopy"<?= $guide === '' ? ' disabled' : '' ?>>Anleitung kopieren</button>
            <span class="field-hint" id="nu_guideStatus"><?= $guide === '' ? 'Anleitung fehlt auf dem Server (private/llm-anleitung.md).' : '' ?></span>
          </div>
          <details class="nu-guide"><summary>Anleitung ansehen</summary><textarea id="nu_guide" readonly rows="18"><?= esc($guide) ?></textarea></details>
        </li>
        <li><b>Gemeinsam mit der KI planen.</b> Sie fragt nach Zielgruppe, Lernziel, Schwierigkeit und Medium und schreibt am Ende die komplette Übung als JSON.</li>
        <li>
          <b>Ergebnis hier einfügen.</b> Das Formular wird befüllt, danach prüfen, Dateien hochladen und anlegen.
          <textarea id="nu_import" rows="4" placeholder='{ "id": "…", "course": { … }, … }'></textarea>
          <div class="nu-row">
            <button class="ctrl" type="button" id="nu_importGo">In das Formular übernehmen</button>
            <span class="field-hint" id="nu_importStatus"></span>
          </div>
        </li>
      </ol>
      <details class="nu-draft">
        <summary>Schnellentwurf aus einem Bild</summary>
        <p class="field-hint">Die KI der App entwirft aus einem Bild des Mediums Titel, Aufgabe, Prompt, Musterlösung und Kategorien. Funktioniert nur, wenn das eingestellte Modell Bilder lesen kann.</p>
        <div class="designer-row">
          <input type="file" id="dz_image" accept="image/png,image/jpeg,image/webp,image/gif">
          <input id="dz_hint" placeholder="Optionaler Hinweis, z. B. „Sprunggelenk-Winkel im Absprung“" style="flex:1;min-width:220px">
          <button class="ctrl" type="button" id="dz_go">Entwurf erzeugen</button>
          <span id="dz_status" class="field-hint"></span>
        </div>
      </details>
    </section>

    <form class="form nu" id="nuForm" novalidate>

      <fieldset class="nu-sec">
        <legend>Adresse und Bereich</legend>
        <p class="nu-why">Ein Bereich ist eine Kachelgruppe auf der Startseite. Bei einem vorhandenen Bereich werden Titel und Einstellungen übernommen.</p>
        <div class="nu-grid c3">
          <label class="field"><span class="field-label">Bereichs-ID</span><input id="n_course" list="nu_courses" placeholder="biomechanik" pattern="[a-z0-9_-]+" autocomplete="off"></label>
          <label class="field"><span class="field-label">Bereichs-Titel</span><input id="n_courseTitle" placeholder="Biomechanik"></label>
          <label class="field"><span class="field-label">Modul <span class="field-hint">(Unterzeile)</span></span><input id="n_module" placeholder="Bodenphysik im Labor"></label>
          <label class="field"><span class="field-label">App-Name <span class="field-hint">(leer = Biomechanik-Lab)</span></span><input id="n_appTitle" placeholder="Bodenphysik-Lab"></label>
          <label class="field"><span class="field-label">Reihenfolge <span class="field-hint">(0 = oben)</span></span><input id="n_order" type="number" step="1" placeholder="0"></label>
          <span></span>
          <label class="field"><span class="field-label">Lektions-ID</span><input id="n_lesson" list="nu_lessons" placeholder="bodenwasser" pattern="[a-z0-9_-]+" autocomplete="off"></label>
          <label class="field"><span class="field-label">Lektions-Titel</span><input id="n_lessonTitle" placeholder="Von der Probe zur Leitfähigkeit"></label>
          <span></span>
          <label class="field"><span class="field-label">Übungs-ID <span class="field-hint">(Dateiname)</span></span><input id="n_exercise" placeholder="ksat-durchfluss" pattern="[a-z0-9_-]+" autocomplete="off"></label>
          <label class="field"><span class="field-label">Nummer</span><input id="n_number" placeholder="01"></label>
          <label class="field"><span class="field-label">Statuszeile <span class="field-hint">(Pille unter dem Titel)</span></span><input id="n_status" placeholder="Teil 1 von 2"></label>
        </div>
        <datalist id="nu_courses"></datalist><datalist id="nu_lessons"></datalist>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>Einstieg</legend>
        <label class="field"><span class="field-label">Titel <span class="field-hint">(Frage oder Arbeitsauftrag in einem Satz)</span></span><input id="n_title" placeholder="Warum springt man mit Ausholbewegung höher?"></label>
        <label class="field"><span class="field-label">Intro <span class="field-hint">(1 bis 3 Sätze: was zu sehen ist, worauf es ankommt)</span></span><textarea id="n_intro" rows="3"></textarea></label>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>1 · Sehen: das Medium</legend>
        <div class="nu-kinds" role="radiogroup" aria-label="Medientyp" id="nu_kinds"></div>
        <div class="nu-grid c2">
          <label class="field"><span class="field-label">Überschrift des Mediums</span><input id="n_mlabel" placeholder="01 · Kraft- und Leistungsschrieb im Vergleich"></label>
          <label class="field"><span class="field-label">Alternativtext <span class="field-hint">(für Screenreader: was ist zu sehen)</span></span><input id="n_malt"></label>
        </div>
        <label class="field"><span class="field-label">Bildunterschrift <span class="field-hint">(Quelle, Bedienhinweis)</span></span><textarea id="n_mcaption" rows="2"></textarea></label>

        <div class="nu-panel" data-kind="video">
          <div class="nu-grid c3">
            <label class="field"><span class="field-label">Videodatei <span class="field-hint">(mp4/webm)</span></span><input type="file" id="n_vfile" accept="video/mp4,video/webm,video/quicktime"></label>
            <label class="field"><span class="field-label">…oder Pfad</span><input id="n_vsrc" placeholder="vid/kugelstossen.mp4"></label>
            <span></span>
            <label class="field"><span class="field-label">Bilder pro Sekunde</span><input id="n_fps" type="number" step="1" value="30"></label>
            <label class="field"><span class="field-label">Dauer (s)</span><input id="n_dur" type="number" step="0.01" value="5"></label>
          </div>
          <p class="field-hint">Videos haben immer Zeitleiste, Einzelbild-Schritte und den Knopf „Zeitstempel einfügen“. Große Dateien besser per SFTP nach <code>vid/</code> laden und den Pfad angeben.</p>
        </div>

        <div class="nu-panel" data-kind="image">
          <div class="nu-grid c2">
            <label class="field"><span class="field-label">Bilddatei <span class="field-hint">(png/jpg/webp)</span></span><input type="file" id="n_ifile" accept="image/png,image/jpeg,image/webp,image/gif"></label>
            <label class="field"><span class="field-label">…oder Pfad <span class="field-hint">(auch .svg)</span></span><input id="n_isrc" placeholder="img/diagramm.svg"></label>
          </div>
          <label class="nu-check"><input type="checkbox" id="n_ro"> Ablese-Werkzeug: Studierende lesen Werte auf der x-Achse ab und übernehmen sie in ihren Text</label>
          <div id="nu_ro" class="nu-sub">
            <div class="nu-grid c3">
              <label class="field"><span class="field-label">Achse</span><input id="n_ro_label" placeholder="Zeit"></label>
              <label class="field"><span class="field-label">Einheit</span><input id="n_ro_unit" placeholder="s"></label>
              <label class="field"><span class="field-label">Nachkommastellen</span><input id="n_ro_dec" type="number" min="0" max="4" value="1"></label>
              <label class="field"><span class="field-label">Wert am linken Achsenende</span><input id="n_ro_min" type="number" step="any" placeholder="0"></label>
              <label class="field"><span class="field-label">Wert am rechten Achsenende</span><input id="n_ro_max" type="number" step="any" placeholder="60"></label>
              <label class="field"><span class="field-label">Schrittweite (Pfeiltasten)</span><input id="n_ro_step" type="number" step="any" placeholder="0.5"></label>
            </div>
            <p class="field-hint">Lage im Bild als Anteil (0 bis 1). Am einfachsten: unten im Bild nacheinander die vier Punkte anklicken.</p>
            <div class="nu-grid c4">
              <label class="field"><span class="field-label">Achse links</span><input id="n_ro_from" type="number" step="any" min="0" max="1"></label>
              <label class="field"><span class="field-label">Achse rechts</span><input id="n_ro_to" type="number" step="any" min="0" max="1"></label>
              <label class="field"><span class="field-label">Kurven oben</span><input id="n_ro_top" type="number" step="any" min="0" max="1" value="0"></label>
              <label class="field"><span class="field-label">Kurven unten</span><input id="n_ro_bottom" type="number" step="any" min="0" max="1" value="1"></label>
            </div>
            <div class="nu-cal">
              <div class="nu-row" id="nu_calBtns">
                <button class="ctrl" type="button" data-cal="from">Achse links klicken</button>
                <button class="ctrl" type="button" data-cal="to">Achse rechts klicken</button>
                <button class="ctrl" type="button" data-cal="top">Oberkante klicken</button>
                <button class="ctrl" type="button" data-cal="bottom">Unterkante klicken</button>
                <span class="field-hint" id="nu_calStatus">Erst ein Bild wählen.</span>
              </div>
              <div class="nu-cal-stage" id="nu_calStage"><img id="nu_calImg" alt=""><div class="nu-cal-lines" id="nu_calLines"></div></div>
            </div>
          </div>
        </div>

        <div class="nu-panel" data-kind="model3d">
          <div class="nu-grid c2">
            <label class="field"><span class="field-label">3D-Datei <span class="field-hint">(.glb)</span></span><input type="file" id="n_gfile" accept=".glb,model/gltf-binary"></label>
            <label class="field"><span class="field-label">…oder Pfad</span><input id="n_gsrc" placeholder="model/lower-limb.glb"></label>
          </div>
          <div class="field"><span class="field-label">Anfangs ausgeblendete Schichten</span><div class="nu-row" id="nu_layers"></div></div>
          <p class="field-hint">Die Schichten ordnet der Betrachter über die Namen der Teile im Modell zu (z. B. „femur“ → Knochen, „vastus“ → Muskeln). Teile ohne erkennbaren Namen landen unter „Sonstiges“.</p>
        </div>

        <div class="nu-panel" data-kind="frame">
          <label class="field"><span class="field-label">Animationsseite</span><select id="n_frame"></select></label>
          <p class="field-hint">Animationen sind eigene Seiten unter <code>anim/</code> mit eigener Steuerung. Neue Animationen entstehen in der Entwicklung, nicht hier.</p>
        </div>

        <div class="nu-panel" data-kind="jumpforce">
          <p class="field-hint">Feste Simulation: Counter-Movement Jump und Squat Jump mit synchronen Kraftkurven. Sinnvoll nur für Übungen zu genau diesem Vergleich.</p>
          <label class="nu-check"><input type="checkbox" id="n_ts"> Knopf „Zeitstempel einfügen“ anbieten</label>
        </div>

        <div class="nu-panel" data-kind="video jumpforce">
          <div class="field"><span class="field-label">Sprungmarken <span class="field-hint">(Knöpfe unter der Zeitleiste)</span></span><div class="rows" data-rows="phases"></div></div>
        </div>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>2 · Verstehen: Legende, Glossar, Leitfaden</legend>
        <div class="field"><span class="field-label">Legende <span class="field-hint">(was welche Farbe, Linie oder Struktur im Medium bedeutet)</span></span><div class="rows" data-rows="legend"></div></div>
        <div class="field"><span class="field-label">Glossar <span class="field-hint">(Fachbegriffe, die im Text vorkommen sollen)</span></span><div class="rows" data-rows="glossary"></div></div>
        <div class="nu-grid c2">
          <label class="field"><span class="field-label">Leitfaden: Überschrift</span><input id="n_gtitle" placeholder="So liest du zwei Messschriebe im Vergleich"></label>
          <span></span>
        </div>
        <label class="field"><span class="field-label">Leitfaden: Schritte <span class="field-hint">(je Zeile ein Schritt)</span></span><textarea id="n_gsteps" rows="4"></textarea></label>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>3 · Beschreiben: Aufgabe und Schreibgerüst</legend>
        <label class="field"><span class="field-label">Aufgabe <span class="field-hint">(steht über dem Schreibfeld)</span></span><textarea id="n_task" rows="3"></textarea></label>
        <div class="field"><span class="field-label">Schreibgerüst <span class="field-hint">(3 bis 5 Schritte vom Sehen zum Deuten)</span></span><div class="rows" data-rows="scaffold"></div></div>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>4 · KI-Feedback</legend>
        <p class="nu-why">Diese Felder sehen Studierende nicht. Sie gehen zusammen mit dem Text an das Sprachmodell.</p>
        <div class="field"><span class="field-label">Feedback-Kategorien <span class="field-hint">(3 bis 4; jeder Marker gehört zu genau einer)</span></span><div class="rows" data-rows="categories"></div></div>
        <label class="field"><span class="field-label">Zielkonzepte <span class="field-hint">(kommagetrennt, 5 bis 12 Fachbegriffe)</span></span><input id="n_concepts"></label>
        <label class="field"><span class="field-label">Medienbeschreibung <span class="field-hint">(was genau im Medium zu sehen ist, mit Zahlen und Zeiten; das Modell sieht das Medium nicht)</span></span><textarea id="n_mdesc" rows="6"></textarea></label>
        <label class="field field-accent"><span class="field-label">Feedback-Prompt <span class="field-hint">(sokratisch: Fragen und Hinweise, keine Lösungen)</span></span><textarea id="n_prompt" rows="12"></textarea></label>
        <div class="nu-row"><button class="ctrl" type="button" id="nu_promptTpl">Gerüst für den Prompt einfügen</button><span class="field-hint">Vorlage mit Rolle, Aufgabe, Markerregeln und Kategorien. Danach fachlich ausfüllen.</span></div>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>5 · Vergleichen: Musterlösung</legend>
        <label class="field field-accent"><span class="field-label">Musterlösung <span class="field-hint">(erscheint erst auf Knopfdruck; das Modell nutzt sie als interne Referenz)</span></span><textarea id="n_solution" rows="8"></textarea></label>
      </fieldset>

      <fieldset class="nu-sec">
        <legend>Demo und Vorschaubild</legend>
        <p class="nu-why">Der Demo-Text tippt sich beim Öffnen der Übung als Beispiel ein. Das Demo-Feedback erscheint, wenn das Modell nicht erreichbar ist.</p>
        <label class="field"><span class="field-label">Demo-Text <span class="field-hint">(typischer Erstversuch mit 2 bis 4 Schwächen)</span></span><textarea id="n_demo" rows="4"></textarea></label>
        <div class="field"><span class="field-label">Demo-Feedback <span class="field-hint">(das Zitat muss wörtlich im Demo-Text stehen)</span></span><div class="rows" data-rows="markers"></div></div>
        <div class="nu-grid c2">
          <label class="field"><span class="field-label">Vorschaubild <span class="field-hint">(Kachel auf der Startseite)</span></span><input type="file" id="n_tfile" accept="image/png,image/jpeg,image/webp,image/gif"></label>
          <label class="field"><span class="field-label">…oder Pfad</span><input id="n_tsrc" placeholder="img/thumb_beispiel.png"></label>
        </div>
      </fieldset>

      <div class="nu-result" id="nu_result" hidden></div>
      <pre class="nu-json" id="nu_json" hidden></pre>
      <div class="form-actions nu-actions">
        <button class="ctrl" type="button" id="nu_check">Prüfen</button>
        <button class="ctrl" type="button" id="nu_showJson">JSON ansehen</button>
        <button class="ctrl primary" type="submit" id="nu_submit">Übung anlegen</button>
        <a class="ctrl" href="pflege.php" style="text-decoration:none">Abbrechen</a>
      </div>
    </form>
    <script>window.NU = <?= json_encode($nuData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>;</script>
    <script src="<?= esc(asset('pflege-neu.js')) ?>"></script>
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
