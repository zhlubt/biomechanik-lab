<?php
/**
 * Kernlogik (private/): Übungen laden/speichern, sokratischen Prompt bauen,
 * Anthropic aufrufen. Wird von public/*.php eingebunden.
 */
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/llm.php';

/** Pfad-Segment säubern (kein ../). */
function ex_safe(string $s): string {
    return preg_replace('/[^A-Za-z0-9_-]/', '', $s);
}

function ex_file(array $loc): string {
    return CONTENT_DIR . '/' . ex_safe($loc['course']) . '/' . ex_safe($loc['lesson']) . '/' . ex_safe($loc['exercise']) . '.json';
}

/** Übung als assoziatives Array laden (oder null). */
function load_exercise(array $loc): ?array {
    $f = ex_file($loc);
    if (!is_readable($f)) return null;
    $data = json_decode((string)file_get_contents($f), true);
    return is_array($data) ? $data : null;
}

/** Alle Übungen finden: content/<course>/<lesson>/<exercise>.json */
function list_exercises(): array {
    $out = [];
    if (!is_dir(CONTENT_DIR)) return $out;
    foreach (scandir(CONTENT_DIR) as $course) {
        if ($course[0] === '.') continue;
        $cdir = CONTENT_DIR . '/' . $course;
        if (!is_dir($cdir)) continue;
        foreach (scandir($cdir) as $lesson) {
            if ($lesson[0] === '.') continue;
            $ldir = $cdir . '/' . $lesson;
            if (!is_dir($ldir)) continue;
            foreach (scandir($ldir) as $file) {
                if (substr($file, -5) !== '.json') continue;
                $out[] = ['course' => $course, 'lesson' => $lesson, 'exercise' => substr($file, 0, -5)];
            }
        }
    }
    return $out;
}

/**
 * Übungen nach Kurs → Lektion gruppieren (Phase 3: Übersichten/Breadcrumbs).
 * Ergebnis: [courseId => ['title'=>, 'module'=>, 'lessons'=>[lessonId => ['title'=>, 'items'=>[ ['loc'=>,'ex'=>], … ]]]]]
 */
function list_courses(): array {
    $out = [];
    foreach (list_exercises() as $loc) {
        $ex = load_exercise($loc);
        if ($ex === null) continue;
        $cId = $loc['course']; $lId = $loc['lesson'];
        if (!isset($out[$cId])) {
            $out[$cId] = [
                'id' => $cId,
                'title' => $ex['course']['title'] ?? $cId,
                'module' => $ex['course']['module'] ?? '',
                'lessons' => [],
            ];
        }
        if (!isset($out[$cId]['lessons'][$lId])) {
            $out[$cId]['lessons'][$lId] = ['id' => $lId, 'title' => $ex['lesson']['title'] ?? $lId, 'items' => []];
        }
        $out[$cId]['lessons'][$lId]['items'][] = ['loc' => $loc, 'ex' => $ex];
    }
    return $out;
}

/** Titel von Kurs und Lektion ermitteln (für Breadcrumbs), tolerant. */
function course_titles(string $course, ?string $lesson = null): array {
    foreach (list_exercises() as $loc) {
        if ($loc['course'] !== $course) continue;
        if ($lesson !== null && $loc['lesson'] !== $lesson) continue;
        $ex = load_exercise($loc);
        if ($ex === null) continue;
        return [
            'course' => $ex['course']['title'] ?? $course,
            'module' => $ex['course']['module'] ?? '',
            'lesson' => $ex['lesson']['title'] ?? ($lesson ?? ''),
        ];
    }
    return ['course' => $course, 'module' => '', 'lesson' => $lesson ?? ''];
}

/**
 * Statische Datei mit Versionsstempel: „app.js?v=1759500000".
 * Ohne das liefert der Browser nach einem Deploy weiter die alte Datei aus - man
 * sieht Aenderungen erst nach hartem Neuladen (ist beim Methoden-Modul passiert).
 * Der Stempel ist die Mtime der Datei, aendert sich also genau dann, wenn noetig.
 */
function asset(string $file): string {
    $path = __DIR__ . '/../../public/' . $file;          // lokal: php/public/
    if (!is_file($path)) $path = $_SERVER['DOCUMENT_ROOT'] . '/' . $file;  // Server: /var/www/html/
    $v = is_file($path) ? (string)filemtime($path) : '0';
    return $file . '?v=' . $v;
}

/**
 * Einheitliche Fußzeile mit den Pflichtangaben. EINE Stelle, damit Impressum und
 * Datenschutz wirklich auf jeder Seite stehen (§ 5 DDG).
 */
function site_footer(string $right = ''): string {
    $h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $extra = ($right !== '' && $right !== 'Beschreibungs-Lab') ? '<span>' . $h($right) . '</span>' : '';
    return '<footer>'
         . '<span><b>Beschreibungs-Lab</b> · Zentrum für Hochschullehre · Universität Bayreuth</span>'
         . '<span class="foot-legal">'
         .   $extra
         .   '<a href="impressum.php">Impressum</a>'
         .   '<a href="impressum.php#datenschutz">Datenschutz</a>'
         . '</span>'
         . '</footer>';
}

/** Header-Navigation mit Anmeldestatus (für alle öffentlichen Seiten). */
function auth_nav_html(): string {
    $h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $u = current_user();
    $btn = 'class="ctrl" style="padding:6px 10px;font-size:12px;text-decoration:none"';
    if ($u === null) {
        return '<a href="konto.php" ' . $btn . '>Loslegen</a>'
             . '<a href="pflege.php" ' . $btn . '>Pflege</a>';
    }
    $out = '<span style="font-size:12px;color:var(--ink-mute)">Hallo, ' . $h($u['name']) . '</span>';
    $out .= '<a href="meine-abgaben.php" ' . $btn . '>Meine Abgaben</a>';
    if ($u['role'] === 'teacher') {
        $out .= '<a href="auswertung.php" ' . $btn . '>Auswertung</a>';
        $out .= '<a href="nutzer.php" ' . $btn . '>Nutzer</a>';
        $out .= '<a href="pflege.php" ' . $btn . '>Pflege</a>';
    }
    $out .= '<a href="konto.php?logout=1" ' . $btn . '>Abmelden</a>';
    return $out;
}

/* ---------- Abgaben (Submissions) ---------- */

function save_submission(int $userId, array $loc, string $text, array $markers, string $model): int {
    // Adresse immer gesaeubert ablegen - sonst landet beliebiger Eingabetext in der DB
    // und spaeter in Auswertungs-Links.
    $loc = ['course' => ex_safe($loc['course']), 'lesson' => ex_safe($loc['lesson']), 'exercise' => ex_safe($loc['exercise'])];
    $st = db()->prepare(
        'INSERT INTO submissions (user_id, course, lesson, exercise, student_text, markers_json, marker_count, model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $st->execute([
        $userId, $loc['course'], $loc['lesson'], $loc['exercise'],
        $text, json_encode($markers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), count($markers), $model,
    ]);
    return (int)db()->lastInsertId();
}

/** Abgaben einer/eines Studierenden (neueste zuerst). */
function list_user_submissions(int $userId): array {
    $st = db()->prepare('SELECT * FROM submissions WHERE user_id = ? ORDER BY created_at DESC, id DESC');
    $st->execute([$userId]);
    return $st->fetchAll();
}

/** Welche Übungen hat die/der Studierende schon abgegeben? -> Set "course/lesson/exercise". */
function user_done_exercises(int $userId): array {
    $st = db()->prepare('SELECT DISTINCT course, lesson, exercise FROM submissions WHERE user_id = ?');
    $st->execute([$userId]);
    $out = [];
    foreach ($st->fetchAll() as $r) $out[$r['course'] . '/' . $r['lesson'] . '/' . $r['exercise']] = true;
    return $out;
}

/** Alle Abgaben zu einer Übung (für Lehrenden-Auswertung), mit Namen. */
function list_exercise_submissions(array $loc): array {
    $st = db()->prepare(
        'SELECT s.*, u.name AS user_name, u.email AS user_email
           FROM submissions s JOIN users u ON u.id = s.user_id
          WHERE s.course = ? AND s.lesson = ? AND s.exercise = ?
          ORDER BY s.created_at DESC, s.id DESC'
    );
    $st->execute([$loc['course'], $loc['lesson'], $loc['exercise']]);
    return $st->fetchAll();
}

/** Übungen, zu denen es überhaupt Abgaben gibt (+ Anzahl) — für Auswertungs-Übersicht. */
function submission_overview(): array {
    $rows = db()->query(
        'SELECT course, lesson, exercise, COUNT(*) AS n, COUNT(DISTINCT user_id) AS students, MAX(created_at) AS last_at
           FROM submissions GROUP BY course, lesson, exercise ORDER BY last_at DESC'
    )->fetchAll();
    return $rows;
}

/* ---------- Nutzer- und Datenverwaltung (DSGVO) ---------- */

/** Eine eigene Abgabe löschen. Gibt true zurück, wenn sie wirklich der/dem Nutzer:in gehörte. */
function delete_submission(int $submissionId, int $userId): bool {
    // user_id in der WHERE-Klausel: so kann niemand fremde Abgaben löschen,
    // auch nicht mit geratener ID.
    $st = db()->prepare('DELETE FROM submissions WHERE id = ? AND user_id = ?');
    $st->execute([$submissionId, $userId]);
    return $st->rowCount() > 0;
}

/** Konto samt aller Abgaben löschen (submissions hängen per ON DELETE CASCADE dran). */
function delete_user(int $userId): bool {
    $st = db()->prepare('DELETE FROM users WHERE id = ?');
    $st->execute([$userId]);
    return $st->rowCount() > 0;
}

/** Alles, was zu einer Person gespeichert ist — für Auskunft und Mitnahme (Art. 15/20 DSGVO). */
function export_user_data(int $userId): array {
    $st = db()->prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
    $st->execute([$userId]);
    $u = $st->fetch();
    if (!$u) return [];
    // Geräte-Konten tragen eine synthetische Adresse — die ist kein Kontaktdatum.
    if (str_ends_with((string)$u['email'], '@biomech.local')) $u['email'] = null;

    $out = [];
    foreach (list_user_submissions($userId) as $r) {
        $out[] = [
            'uebung'       => $r['course'] . '/' . $r['lesson'] . '/' . $r['exercise'],
            'zeitpunkt'    => $r['created_at'],
            'beschreibung' => $r['student_text'],
            'modell'       => $r['model'],
            'hinweise'     => json_decode($r['markers_json'] ?? '[]', true) ?: [],
        ];
    }
    return [
        'erzeugt_am' => gmdate('c'),
        'konto'      => $u,
        'abgaben'    => $out,
    ];
}

/** Nutzerliste mit Abgabenzahl — für die Lehrenden-Verwaltung. */
function list_users_with_counts(): array {
    return db()->query(
        'SELECT u.id, u.name, u.email, u.role, u.created_at,
                (u.device_token IS NOT NULL) AS is_device,
                COUNT(s.id) AS n_subs, MAX(s.created_at) AS last_at
           FROM users u LEFT JOIN submissions s ON s.user_id = u.id
          GROUP BY u.id
          ORDER BY (last_at IS NULL), last_at DESC, u.id DESC'
    )->fetchAll();
}

/** Pflegbare Freitext-/Prompt-Felder. */
function editable_keys(): array {
    return ['title', 'intro', 'task', 'thumbnail', 'mediaDescription', 'feedbackPrompt', 'modelSolution', 'targetConcepts'];
}

function read_editable_fields(array $loc): ?array {
    $ex = load_exercise($loc);
    if ($ex === null) return null;
    return [
        'title'            => $ex['title'] ?? '',
        'intro'            => $ex['intro'] ?? '',
        'task'             => $ex['task'] ?? '',
        'thumbnail'        => $ex['thumbnail'] ?? '',
        'mediaDescription' => $ex['mediaDescription'] ?? '',
        'feedbackPrompt'   => $ex['feedbackPrompt'] ?? '',
        'modelSolution'    => $ex['modelSolution'] ?? '',
        'targetConcepts'   => $ex['targetConcepts'] ?? [],
    ];
}

/** Pflegbare Felder zurückschreiben; übrige Felder bleiben unangetastet. */
function save_editable_fields(array $loc, array $fields): bool {
    $f = ex_file($loc);
    if (!is_readable($f)) return false;
    $obj = json_decode((string)file_get_contents($f), true);
    if (!is_array($obj)) return false;
    foreach (editable_keys() as $key) {
        if (!array_key_exists($key, $fields)) continue;
        if ($key === 'targetConcepts') {
            $arr = is_array($fields[$key]) ? $fields[$key] : [];
            $obj[$key] = array_values(array_filter(array_map('trim', array_map('strval', $arr)), fn($s) => $s !== ''));
        } else {
            $obj[$key] = (string)$fields[$key];
        }
    }
    $json = json_encode($obj, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return file_put_contents($f, $json . "\n") !== false;
}

function exercise_exists(array $loc): bool {
    return is_readable(ex_file($loc));
}

/** Legt eine neue Übung aus einem Skelett an (legt Verzeichnisse mit an). */
function create_exercise(array $loc, array $data): bool {
    $f = ex_file($loc);
    if (file_exists($f)) return false;
    $dir = dirname($f);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) return false;
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return file_put_contents($f, $json . "\n") !== false;
}

/** Baut ein vollständiges Übungs-Skelett (datengetrieben renderbar). */
function build_exercise_skeleton(array $in): array {
    $kind = ($in['kind'] === 'video') ? 'video' : 'jumpforce';
    $cats = [];
    foreach (($in['categories'] ?? []) as $c) {
        $key = preg_replace('/[^a-z0-9_]/', '', strtolower((string)($c['key'] ?? '')));
        if ($key === '') continue;
        $cats[] = ['key' => $key, 'label' => (string)($c['label'] ?? $key), 'color' => (string)($c['color'] ?? '#3a63d8')];
    }
    if (!$cats) $cats = [
        ['key' => 'beobachtung', 'label' => 'Beobachtung', 'color' => '#3a63d8'],
        ['key' => 'fachsprache', 'label' => 'Fachsprache', 'color' => '#d98018'],
        ['key' => 'analyse', 'label' => 'Analyse / Deutung', 'color' => '#1aa56a'],
    ];
    $media = [];
    if ($kind === 'video') {
        $media[] = [
            'type' => 'video',
            'label' => '01 · Video-Analyse',
            'src' => (string)($in['videoSrc'] ?? ''),
            'config' => [
                'durationSec' => (float)($in['durationSec'] ?? 5.0),
                'fps' => (int)($in['fps'] ?? 30),
                'phases' => [],
            ],
        ];
    } else {
        $media[] = [
            'type' => 'interactive',
            'component' => 'JumpForceLab',
            'label' => '01 · Bewegungs- & Kraftanalyse',
            'config' => ['durationSec' => 3.0, 'fps' => 30, 'phases' => []],
        ];
    }
    return [
        'id' => $in['exercise'],
        'course' => ['id' => $in['course'], 'title' => (string)($in['courseTitle'] ?? $in['course'])],
        'lesson' => ['id' => $in['lesson'], 'title' => (string)($in['lessonTitle'] ?? $in['lesson'])],
        'number' => (string)($in['number'] ?? ''),
        'title' => (string)($in['title'] ?? 'Neue Übung'),
        'intro' => (string)($in['intro'] ?? ''),
        'status' => '',
        'media' => $media,
        'timestampMode' => (bool)($in['timestampMode'] ?? false),
        'legend' => [],
        'glossary' => [],
        'guidance' => [
            'title' => 'So beschreibst du sauber',
            'steps' => ['Was siehst du? (Größe + Einheit + Richtung)', 'Welche Phase ist sichtbar?', 'Wo liegt der entscheidende Moment?', 'Was bedeutet das fachlich?'],
        ],
        'task' => (string)($in['task'] ?? 'Beschreibe in eigenen Worten, was du siehst. Dann klick „KI Feedback“.'),
        'scaffold' => [
            ['step' => 'Sehen', 'text' => 'Was zeigt das Medium?'],
            ['step' => 'Benennen', 'text' => 'Welche Fachbegriffe passen?'],
            ['step' => 'Lesen', 'text' => 'Wo ist der entscheidende Moment?'],
            ['step' => 'Interpretieren', 'text' => 'Was bedeutet das biomechanisch?'],
        ],
        'feedbackCategories' => $cats,
        'targetConcepts' => array_values(array_filter(array_map('trim', (array)($in['targetConcepts'] ?? [])), fn($s) => $s !== '')),
        'mediaDescription' => (string)($in['mediaDescription'] ?? ''),
        'feedbackPrompt' => (string)($in['feedbackPrompt'] ?? ''),
        'modelSolution' => (string)($in['modelSolution'] ?? ''),
        'demo' => ['studentText' => (string)($in['demoText'] ?? ''), 'feedback' => ['markers' => []]],
    ];
}

/* ---------- Designer-Modus: Übung aus Bild erzeugen (Phase 5) ---------- */

/**
 * Erzeugt aus einem hochgeladenen Bild einen Übungs-Entwurf (Vision-LLM).
 * Liefert ein Array mit title/intro/task/mediaDescription/feedbackPrompt/
 * modelSolution/targetConcepts/categories. Wirft RuntimeException bei Fehlern.
 */
function llm_exercise_draft(string $mime, string $b64, string $hint = ''): array {
    $schema = [
        'type' => 'object', 'additionalProperties' => false,
        'properties' => [
            'title'            => ['type' => 'string'],
            'intro'            => ['type' => 'string'],
            'task'             => ['type' => 'string'],
            'mediaDescription' => ['type' => 'string'],
            'feedbackPrompt'   => ['type' => 'string'],
            'modelSolution'    => ['type' => 'string'],
            'targetConcepts'   => ['type' => 'array', 'items' => ['type' => 'string']],
            'categories'       => ['type' => 'array', 'items' => [
                'type' => 'object', 'additionalProperties' => false,
                'properties' => ['key' => ['type' => 'string'], 'label' => ['type' => 'string'], 'color' => ['type' => 'string']],
                'required' => ['key', 'label', 'color'],
            ]],
        ],
        'required' => ['title', 'intro', 'task', 'mediaDescription', 'feedbackPrompt', 'modelSolution', 'targetConcepts', 'categories'],
    ];

    $system = implode("\n", [
        'Du hilfst beim Erstellen von Übungen für ein biomechanisches "Beschreibungs-Lab" der Sportwissenschaft (Uni Bayreuth).',
        'Didaktik: Studierende beschreiben ein Medium (Bild/Diagramm/Video/3D-Modell) in eigenen Worten; die KI gibt SOKRATISCHES Feedback — Fragen und Hinweise, NIEMALS fertige Lösungen.',
        'Du bekommst ein Bild des Mediums und entwirfst daraus eine vollständige Übung auf Deutsch (Sie-/Du-Form wie in den Feldern üblich: Du).',
        'Regeln für die Felder:',
        '- title: prägnanter Aufgabentitel.',
        '- intro: 1–2 Sätze, was zu sehen ist und worum es geht.',
        '- task: konkrete Schreibaufgabe an die/den Studierenden.',
        '- mediaDescription: sachliche Beschreibung des Mediums als Kontext fürs Feedback-LLM (was ist zu sehen).',
        '- feedbackPrompt: ein sokratischer System-Prompt, der 2–4 Marker als striktes JSON {"markers":[{"category","quote","question","nudge"}]} fordert; quote = wörtliches Zitat aus dem Studierenden-Text; nur Fragen/Hinweise, keine Lösungen; ordne jede Marke einer der unten gewählten Kategorien-Schlüssel zu.',
        '- modelSolution: fachlich korrekte Referenz-/Musterbeschreibung (wird Studierenden erst auf Wunsch gezeigt, dient auch dem LLM als interne Referenz).',
        '- targetConcepts: 5–12 Fachbegriffe.',
        '- categories: 2–4 Feedback-Kategorien, je {key (klein, a-z0-9_), label (Anzeige), color (#hex)}; Schlüssel müssen zu den im feedbackPrompt genannten passen.',
    ]);
    $userText = 'Entwirf aus diesem Medium eine Übung.' . ($hint !== '' ? (' Hinweis der Lehrkraft: ' . $hint) : '');

    $draft = llm_json([
        'system' => $system,
        'user'   => [
            ['type' => 'image', 'mime' => $mime, 'data_b64' => $b64],
            ['type' => 'text', 'text' => $userText],
        ],
        'schema' => $schema,
        'max_tokens' => 3000,
    ]);
    // Kategorien-Schlüssel säubern.
    if (!empty($draft['categories']) && is_array($draft['categories'])) {
        foreach ($draft['categories'] as &$c) {
            $c['key'] = preg_replace('/[^a-z0-9_]/', '', strtolower((string)($c['key'] ?? '')));
            if ($c['key'] === '') $c['key'] = 'kategorie';
        }
        unset($c);
    }
    return $draft;
}

/* ---------- Feedback / Anthropic ---------- */

function feedback_system(array $ex): string {
    $prompt = trim((string)($ex['feedbackPrompt'] ?? ''));
    $rules = implode("\n", [
        '',
        'Verbindliche Regeln:',
        '- Gib ausschließlich FRAGEN oder kurze Hinweise, niemals fertige Formulierungen oder Lösungen.',
        '- Markiere 2–4 Stellen. Lieber wenige, gute Marker als viele.',
        '- `quote` muss ein WÖRTLICHES, zusammenhängendes Teilstück aus dem Studierenden-Text sein (exakt vorhanden) — sonst nicht markierbar.',
        '- Ordne jeden Marker einer der vorgegebenen Kategorien zu.',
        '- Antworte auf Deutsch.',
        '- Ist der Text schon präzise, gib weniger oder keine Marker zurück statt künstlich welche zu erfinden.',
    ]);
    return $prompt . "\n" . $rules;
}

function feedback_user(array $ex, string $studentText): string {
    $cats = '';
    foreach (($ex['feedbackCategories'] ?? []) as $c) {
        $cats .= '- ' . ($c['key'] ?? '') . ': ' . ($c['label'] ?? '') . "\n";
    }
    $concepts = implode(', ', $ex['targetConcepts'] ?? []);
    $parts = [];
    $parts[] = "AUFGABE:\n" . ($ex['task'] ?? '');
    $parts[] = "\nZIELKONZEPTE: " . $concepts;
    if (!empty($ex['mediaDescription'])) $parts[] = "\nMEDIEN-KONTEXT:\n" . $ex['mediaDescription'];
    $parts[] = "\nKATEGORIEN (Schlüssel: Bedeutung):\n" . $cats;
    if (!empty($ex['modelSolution'])) {
        $parts[] = "\nINTERNE REFERENZ — Musterlösung (NUR zur Einordnung, NICHT ausgeben):\n" . $ex['modelSolution'];
    }
    $parts[] = "\nSTUDIERENDEN-TEXT (kommentiere genau diesen Text):\n\"\"\"\n" . $studentText . "\n\"\"\"";
    return implode("\n", $parts);
}

/**
 * Ruft die Anthropic Messages API (Structured Outputs) auf und liefert
 * validierte Marker. Wirft RuntimeException bei Fehlern.
 */
function get_feedback(array $ex, string $studentText): array {
    $categoryKeys = array_values(array_map(fn($c) => $c['key'] ?? '', $ex['feedbackCategories'] ?? []));
    $schema = [
        'type' => 'object',
        'additionalProperties' => false,
        'properties' => [
            'markers' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => [
                        'category' => ['type' => 'string', 'enum' => $categoryKeys],
                        'quote'    => ['type' => 'string'],
                        'question' => ['type' => 'string'],
                        'nudge'    => ['type' => 'string'],
                    ],
                    'required' => ['category', 'quote', 'question', 'nudge'],
                ],
            ],
        ],
        'required' => ['markers'],
    ];

    // Über die Provider-Abstraktion (Default Claude; ChatGPT via LLM_PROVIDER=openai).
    $parsed = llm_json([
        'system' => feedback_system($ex),
        'user'   => feedback_user($ex, $studentText),
        'schema' => $schema,
        'max_tokens' => 2000,
    ]);
    if (!isset($parsed['markers']) || !is_array($parsed['markers'])) {
        throw new RuntimeException('LLM-Antwort enthielt keine Marker.');
    }

    // Validieren: Kategorie gültig, Zitat wörtlich im Text vorhanden.
    $out = [];
    foreach ($parsed['markers'] as $m) {
        if (!is_array($m)) continue;
        $cat = $m['category'] ?? null;
        $quote = $m['quote'] ?? null;
        $question = $m['question'] ?? null;
        $nudge = $m['nudge'] ?? '';
        if (!is_string($cat) || !is_string($quote) || !is_string($question)) continue;
        if (!in_array($cat, $categoryKeys, true)) continue;
        if (mb_strpos($studentText, $quote) === false) continue;
        $out[] = ['category' => $cat, 'quote' => $quote, 'question' => $question, 'nudge' => is_string($nudge) ? $nudge : ''];
    }
    return $out;
}
