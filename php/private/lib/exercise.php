<?php
/**
 * Übungs-Schema: eine vollständige Übung aus beliebiger Eingabe (Formular oder
 * eingefügte KI-JSON) in die Form bringen, die uebung.php rendert.
 *
 * Prinzip: Erlaubnisliste. Nur bekannte Felder werden übernommen, jedes mit Typ,
 * Länge und (bei Pfaden) festem Muster. Unbekanntes fällt still weg. So kann eine
 * eingefügte JSON weder fremde Schlüssel noch Pfade außerhalb von img/, vid/,
 * model/ und anim/ in die Content-Datei schreiben.
 */
declare(strict_types=1);

/** Medientypen, die das Formular anbietet (Schlüssel = Wert im Formular). */
function exercise_media_kinds(): array {
    return [
        'video'     => 'Video',
        'image'     => 'Bild / Diagramm',
        'model3d'   => '3D-Modell',
        'frame'     => 'Animation',
        'jumpforce' => 'Sprung-Simulation (CMJ / Squat Jump)',
    ];
}

/** Schichten des 3D-Betrachters (Schlüssel aus model-viewer.js). */
function exercise_model_layers(): array {
    return ['knochen' => 'Knochen', 'muskel' => 'Muskeln', 'band' => 'Bänder & Sehnen',
            'knorpel' => 'Knorpel', 'gefaess' => 'Gefäße', 'nerv' => 'Nerven'];
}

/** Vorhandene Animationsseiten unter public/anim/ (nur gültige Namen). */
function exercise_available_frames(string $publicDir): array {
    $out = [];
    foreach (glob(rtrim($publicDir, '/') . '/anim/*.html') ?: [] as $f) {
        $rel = 'anim/' . basename($f);
        if (preg_match('~^anim/[a-z0-9-]+\.html$~', $rel)) $out[] = $rel;
    }
    sort($out);
    return $out;
}

function ex_str($v, int $max = 4000): string {
    if (!is_scalar($v)) return '';
    $s = trim(str_replace("\r\n", "\n", (string)$v));
    return mb_substr($s, 0, $max);
}
function ex_num($v, ?float $default = null): ?float {
    if (is_int($v) || is_float($v)) return (float)$v;
    if (is_string($v) && trim($v) !== '') {
        $s = str_replace(',', '.', trim($v));
        if (is_numeric($s)) return (float)$s;
    }
    return $default;
}
function ex_slug($v): string {
    return preg_replace('/[^a-z0-9_-]/', '', strtolower(ex_str($v, 80)));
}
function ex_key($v): string {
    return preg_replace('/[^a-z0-9_]/', '', strtolower(ex_str($v, 40)));
}
function ex_color($v, string $default = '#3a63d8'): string {
    $s = ex_str($v, 9);
    return preg_match('/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/', $s) ? strtolower($s) : $default;
}
function ex_list($v): array {
    return is_array($v) ? array_values($v) : [];
}

/** Medienpfad nach Typ prüfen; leer, wenn er nicht ins erlaubte Muster passt. */
function ex_media_path(string $kind, $v): string {
    $s = ex_str($v, 200);
    $re = [
        'video'   => '~^vid/[A-Za-z0-9._-]+\.(mp4|webm|m4v|mov)$~i',
        'image'   => '~^img/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$~i',
        'model3d' => '~^model/[A-Za-z0-9._-]+\.glb$~i',
        'frame'   => '~^anim/[a-z0-9-]+\.html$~',
        'thumb'   => '~^img/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$~i',
    ][$kind] ?? null;
    if ($re === null || $s === '' || str_contains($s, '..')) return '';
    return preg_match($re, $s) ? $s : '';
}

function ex_phases($v): array {
    $out = [];
    foreach (ex_list($v) as $p) {
        if (!is_array($p)) continue;
        $label = ex_str($p['label'] ?? '', 60);
        $t = ex_num($p['t'] ?? null);
        if ($label === '' || $t === null || $t < 0) continue;
        $out[] = ['label' => $label, 't' => round($t, 3)];
    }
    usort($out, fn($a, $b) => $a['t'] <=> $b['t']);
    return array_slice($out, 0, 20);
}

/** Ablese-Werkzeug (media-methods.js, Methode "readout"). */
function ex_readout($v): ?array {
    if (!is_array($v)) return null;
    $x = is_array($v['x'] ?? null) ? $v['x'] : [];
    $from = ex_num($x['from'] ?? null); $to = ex_num($x['to'] ?? null);
    $min = ex_num($x['min'] ?? null);   $max = ex_num($x['max'] ?? null);
    if ($from === null || $to === null || $min === null || $max === null) return null;
    $from = max(0.0, min(1.0, $from)); $to = max(0.0, min(1.0, $to));
    if ($to <= $from || $max == $min) return null;
    $dec = (int)max(0, min(4, (int)(ex_num($x['decimals'] ?? null, 1.0))));
    $step = ex_num($x['step'] ?? null);
    $ax = ['label' => ex_str($x['label'] ?? 'Wert', 40) ?: 'Wert', 'unit' => ex_str($x['unit'] ?? '', 16),
           'from' => round($from, 6), 'to' => round($to, 6), 'min' => $min, 'max' => $max, 'decimals' => $dec];
    if ($step !== null && $step > 0) $ax['step'] = $step;
    $g = is_array($v['guide'] ?? null) ? $v['guide'] : [];
    $top = ex_num($g['top'] ?? null, 0.0); $bottom = ex_num($g['bottom'] ?? null, 1.0);
    $top = max(0.0, min(1.0, (float)$top)); $bottom = max(0.0, min(1.0, (float)$bottom));
    if ($bottom <= $top) { $top = 0.0; $bottom = 1.0; }
    return ['x' => $ax, 'guide' => ['top' => round($top, 6), 'bottom' => round($bottom, 6)]];
}

/**
 * Primär-Medium aus der Eingabe bauen. Akzeptiert sowohl das Dateiformat
 * (media[] mit type/component) als auch die Formularform ({kind, …}).
 * Liefert [mediaArray, fehlermeldung|null].
 */
function ex_media(array $in, string $publicDir): array {
    $m = null;
    if (isset($in['media']) && is_array($in['media'])) {
        // Dateiformat: das erste renderbare Medium gewinnt (wie in uebung.php).
        foreach (ex_list($in['media']) as $cand) {
            if (!is_array($cand)) continue;
            $t = (string)($cand['type'] ?? '');
            if ($t === 'interactive' && ($cand['component'] ?? '') === 'JumpForceLab') { $m = $cand + ['kind' => 'jumpforce']; break; }
            if (in_array($t, ['video', 'image', 'model3d', 'frame'], true)) { $m = $cand + ['kind' => $t]; break; }
        }
    }
    if ($m === null) return [[], 'Es fehlt ein Medium (Video, Bild, 3D-Modell, Animation oder Simulation).'];

    $kind  = (string)$m['kind'];
    $cfgIn = is_array($m['config'] ?? null) ? $m['config'] : [];
    $base  = ['label' => ex_str($m['label'] ?? '', 120) ?: '01 · ' . (exercise_media_kinds()[$kind] ?? 'Medium')];
    $alt   = ex_str($m['alt'] ?? '', 600);
    $cap   = ex_str($m['caption'] ?? '', 1200);

    switch ($kind) {
        case 'video':
            $src = ex_media_path('video', $m['src'] ?? '');
            if ($src === '') return [[], 'Video: Datei hochladen oder einen Pfad wie vid/datei.mp4 angeben.'];
            $out = ['type' => 'video'] + $base + ['src' => $src, 'config' => [
                'durationSec' => max(0.1, (float)ex_num($cfgIn['durationSec'] ?? null, 5.0)),
                'fps'         => (int)max(1, min(1000, (int)ex_num($cfgIn['fps'] ?? null, 30.0))),
                'phases'      => ex_phases($cfgIn['phases'] ?? []),
            ]];
            break;
        case 'image':
            $src = ex_media_path('image', $m['src'] ?? '');
            if ($src === '') return [[], 'Bild: Datei hochladen oder einen Pfad wie img/diagramm.png angeben.'];
            $out = ['type' => 'image'] + $base + ['src' => $src];
            $roIn = $m['methods']['readout'] ?? null;
            $ro = ex_readout($roIn);
            if ($ro !== null) $out['methods'] = ['readout' => $ro];
            elseif (is_array($roIn)) return [[], 'Ablese-Werkzeug: Es fehlen die Werte an den Achsenenden oder die Lage der Achse im Bild (links muss kleiner als rechts sein).'];
            break;
        case 'model3d':
            $src = ex_media_path('model3d', $m['src'] ?? '');
            if ($src === '') return [[], '3D-Modell: .glb-Datei hochladen oder einen Pfad wie model/modell.glb angeben.'];
            $layers = array_keys(exercise_model_layers());
            $hidden = array_values(array_intersect($layers, array_map('strval', ex_list($cfgIn['initialHidden'] ?? []))));
            $out = ['type' => 'model3d'] + $base + ['src' => $src, 'config' => ['layers' => $layers, 'initialHidden' => $hidden]];
            break;
        case 'frame':
            $src = ex_media_path('frame', $m['src'] ?? '');
            if ($src === '' || !in_array($src, exercise_available_frames($publicDir), true)) {
                return [[], 'Animation: bitte eine vorhandene Animationsseite aus der Liste wählen.'];
            }
            $out = ['type' => 'frame'] + $base + ['src' => $src];
            break;
        default: // jumpforce
            $out = ['type' => 'interactive', 'component' => 'JumpForceLab'] + $base + ['config' => [
                'durationSec' => 3.0, 'fps' => 30, 'phases' => ex_phases($cfgIn['phases'] ?? []),
            ]];
    }
    if ($alt !== '') $out['alt'] = $alt;
    if ($cap !== '') $out['caption'] = $cap;
    $list = [$out];
    // Zur Sprung-Simulation gehört optional die synchron laufende Knie-Ansicht (nur per JSON).
    if ($kind === 'jumpforce') {
        foreach (ex_list($in['media'] ?? []) as $cand) {
            if (is_array($cand) && ($cand['type'] ?? '') === 'interactive' && ($cand['component'] ?? '') === 'KneeFrontal') {
                $knee = ['type' => 'interactive', 'component' => 'KneeFrontal', 'label' => ex_str($cand['label'] ?? '', 120) ?: 'Knie-Detail · Frontalebene'];
                if (($kc = ex_str($cand['caption'] ?? '', 1200)) !== '') $knee['caption'] = $kc;
                $list[] = $knee;
                break;
            }
        }
    }
    return [$list, null];
}

/**
 * Vollständige Übung säubern. $loc = course/lesson/exercise (bereits geslugt).
 * Liefert [übung, fehlerliste]. Fehler = Pflichtangaben, ohne die die Seite
 * nicht funktioniert; Hinweise zur Qualität macht das Formular selbst.
 */
function normalize_exercise(array $in, array $loc, string $publicDir): array {
    $errors = [];
    $c = is_array($in['course'] ?? null) ? $in['course'] : [];
    $l = is_array($in['lesson'] ?? null) ? $in['lesson'] : [];

    $course = ['id' => $loc['course'], 'title' => ex_str($c['title'] ?? '', 120) ?: $loc['course']];
    if (($v = ex_str($c['module'] ?? '', 160)) !== '') $course['module'] = $v;
    if (($v = ex_str($c['appTitle'] ?? '', 60)) !== '') $course['appTitle'] = $v;
    if (($o = ex_num($c['order'] ?? null)) !== null && (int)$o !== 0) $course['order'] = (int)$o;

    [$media, $mErr] = ex_media($in, $publicDir);
    if ($mErr) $errors[] = $mErr;
    // Zeitstempel-Knopf: bei Video ohnehin immer an, bei der Simulation wählbar.
    $hasTimeline = in_array($media[0]['type'] ?? '', ['video'], true) || ($media[0]['component'] ?? '') === 'JumpForceLab';

    // Feedback-Kategorien: Schlüssel eindeutig, 1 bis 6.
    $cats = []; $seen = [];
    foreach (ex_list($in['feedbackCategories'] ?? []) as $cat) {
        if (!is_array($cat)) continue;
        $key = ex_key($cat['key'] ?? '');
        if ($key === '' || isset($seen[$key])) continue;
        $seen[$key] = true;
        $cats[] = ['key' => $key, 'label' => ex_str($cat['label'] ?? '', 60) ?: $key, 'color' => ex_color($cat['color'] ?? '')];
    }
    $cats = array_slice($cats, 0, 6);
    if (!$cats) $errors[] = 'Mindestens eine Feedback-Kategorie ist nötig (besser 3 bis 4).';

    $legend = [];
    foreach (ex_list($in['legend'] ?? []) as $it) {
        if (!is_array($it)) continue;
        $label = ex_str($it['label'] ?? '', 80);
        if ($label === '') continue;
        $row = ['label' => $label, 'color' => ex_color($it['color'] ?? '', '#8a93a6'), 'hint' => ex_str($it['hint'] ?? '', 400)];
        if (($k = ex_key($it['key'] ?? '')) !== '') $row = ['key' => $k] + $row;
        if (($cn = ex_str($it['colorName'] ?? '', 30)) !== '') $row['colorName'] = $cn;
        $legend[] = $row;
    }

    $glossary = [];
    foreach (ex_list($in['glossary'] ?? []) as $g) {
        if (!is_array($g)) continue;
        $term = ex_str($g['term'] ?? '', 80);
        $def = ex_str($g['definition'] ?? '', 600);
        if ($term !== '' && $def !== '') $glossary[] = ['term' => $term, 'definition' => $def];
    }

    $gIn = is_array($in['guidance'] ?? null) ? $in['guidance'] : [];
    $steps = array_values(array_filter(array_map(fn($s) => ex_str($s, 300), ex_list($gIn['steps'] ?? [])), fn($s) => $s !== ''));
    $guidance = ['title' => ex_str($gIn['title'] ?? '', 100) ?: 'So beschreibst du sauber', 'steps' => array_slice($steps, 0, 10)];

    $scaffold = [];
    foreach (ex_list($in['scaffold'] ?? []) as $s) {
        if (!is_array($s)) continue;
        $step = ex_str($s['step'] ?? '', 40); $text = ex_str($s['text'] ?? '', 400);
        if ($step !== '' && $text !== '') $scaffold[] = ['step' => $step, 'text' => $text];
    }

    $concepts = array_values(array_unique(array_filter(array_map(fn($s) => ex_str($s, 80), ex_list($in['targetConcepts'] ?? [])), fn($s) => $s !== '')));

    // Demo: nur Marker, die die Seite auch verorten kann (Zitat wörtlich im Demo-Text, Kategorie bekannt).
    $dIn = is_array($in['demo'] ?? null) ? $in['demo'] : [];
    $demoText = ex_str($dIn['studentText'] ?? '', 6000);
    $markers = [];
    foreach (ex_list($dIn['feedback']['markers'] ?? []) as $mk) {
        if (!is_array($mk)) continue;
        $quote = ex_str($mk['quote'] ?? '', 600);
        $cat = ex_key($mk['category'] ?? '');
        $q = ex_str($mk['question'] ?? '', 600);
        if ($quote === '' || $q === '' || !isset($seen[$cat]) || mb_strpos($demoText, $quote) === false) continue;
        $markers[] = ['category' => $cat, 'quote' => $quote, 'question' => $q, 'nudge' => ex_str($mk['nudge'] ?? '', 400)];
    }

    $title = ex_str($in['title'] ?? '', 200);
    if ($title === '') $errors[] = 'Der Titel fehlt.';
    $task = ex_str($in['task'] ?? '', 3000);
    if ($task === '') $errors[] = 'Die Aufgabe fehlt.';
    $prompt = ex_str($in['feedbackPrompt'] ?? '', 20000);
    if ($prompt === '') $errors[] = 'Der Feedback-Prompt fehlt. Ohne ihn gibt es kein KI-Feedback.';

    $ex = [
        'id'      => $loc['exercise'],
        'course'  => $course,
        'lesson'  => ['id' => $loc['lesson'], 'title' => ex_str($l['title'] ?? '', 160) ?: $loc['lesson']],
        'number'  => ex_str($in['number'] ?? '', 10),
        'title'   => $title,
        'intro'   => ex_str($in['intro'] ?? '', 1500),
        'status'  => ex_str($in['status'] ?? '', 120),
    ];
    if (($th = ex_media_path('thumb', $in['thumbnail'] ?? '')) !== '') $ex['thumbnail'] = $th;
    $ex += [
        'media'              => $media,
        'timestampMode'      => $hasTimeline && !empty($in['timestampMode']),
        'legend'             => $legend,
        'glossary'           => $glossary,
        'guidance'           => $guidance,
        'task'               => $task,
        'scaffold'           => $scaffold,
        'feedbackCategories' => $cats,
        'targetConcepts'     => $concepts,
        'mediaDescription'   => ex_str($in['mediaDescription'] ?? '', 12000),
        'feedbackPrompt'     => $prompt,
        'modelSolution'      => ex_str($in['modelSolution'] ?? '', 12000),
        'demo'               => ['studentText' => $demoText, 'feedback' => ['markers' => $markers]],
    ];
    return [$ex, $errors];
}

/**
 * Hochgeladene Datei unter public/<dir>/ ablegen, ohne Bestehendes zu
 * überschreiben. Liefert den relativen Pfad oder wirft RuntimeException.
 */
function store_upload(array $file, string $publicDir, string $dir, string $baseName, array $allowedExt): string {
    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        $code = (int)($file['error'] ?? 0);
        if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
            throw new RuntimeException('Die Datei ist größer, als der Server annimmt. Bitte per SFTP hochladen und den Pfad angeben.');
        }
        throw new RuntimeException('Datei wurde nicht übertragen.');
    }
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        throw new RuntimeException('Dateiformat nicht erlaubt (' . implode(', ', $allowedExt) . ').');
    }
    $target = rtrim($publicDir, '/') . '/' . $dir;
    if (!is_dir($target) && !@mkdir($target, 0775, true) && !is_dir($target)) {
        throw new RuntimeException('Zielordner ' . $dir . '/ fehlt und lässt sich nicht anlegen.');
    }
    @chmod($target, 0775);
    $base = preg_replace('/[^a-z0-9_-]/', '', strtolower($baseName)) ?: 'datei';
    $name = $base . '.' . $ext;
    for ($i = 2; file_exists($target . '/' . $name); $i++) $name = $base . '-' . $i . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $target . '/' . $name)) {
        throw new RuntimeException('Datei konnte nicht gespeichert werden (Schreibrechte auf ' . $dir . '/?).');
    }
    @chmod($target . '/' . $name, 0664);
    return $dir . '/' . $name;
}
