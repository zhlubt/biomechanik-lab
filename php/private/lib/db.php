<?php
/**
 * Persistenz (Phase 4): selbst-enthaltene SQLite-DB unter private/data/.
 * Bewusst NICHT die geteilte ZHL-MariaDB — diese App hält ihre eigenen
 * Nutzer/Abgaben isoliert (DSGVO-Eingrenzung, kein Fremd-Schema-Risiko).
 * Auto-Migration bei jedem Verbindungsaufbau (idempotent).
 */
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function db_path(): string {
    // Override per Env möglich (z. B. anderer Pfad im Container).
    $p = app_env('BIOMECH_DB');
    if ($p) return $p;
    return PRIVATE_DIR . '/data/biomech.sqlite';
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $path = db_path();
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // WAL = nebenläufige Leser blockieren Schreiber nicht; busy_timeout lässt
    // Schreiber bis 8 s auf die Sperre warten statt sofort zu scheitern
    // (robust für ~30 gleichzeitig angemeldete Nutzer — Schreibzugriffe sind selten).
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 8000');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    @chmod($path, 0664);
    db_migrate($pdo);
    return $pdo;
}

function db_migrate(PDO $pdo): void {
    // SQLite: String-Literale MÜSSEN einfach-quotiert sein (doppelte = Bezeichner).
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            email       TEXT NOT NULL UNIQUE,
            pass_hash   TEXT NOT NULL,
            name        TEXT NOT NULL DEFAULT '',
            role        TEXT NOT NULL DEFAULT 'student',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS submissions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL,
            course       TEXT NOT NULL,
            lesson       TEXT NOT NULL,
            exercise     TEXT NOT NULL,
            student_text TEXT NOT NULL,
            markers_json TEXT NOT NULL DEFAULT '[]',
            marker_count INTEGER NOT NULL DEFAULT 0,
            model        TEXT NOT NULL DEFAULT '',
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )"
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_sub_ex ON submissions(course, lesson, exercise)');

    // Cookie-Schnellstart: device_token nachrüsten (Spalte ggf. ergänzen).
    $cols = [];
    foreach ($pdo->query('PRAGMA table_info(users)') as $c) $cols[] = $c['name'];
    if (!in_array('device_token', $cols, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN device_token TEXT');
    }
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device ON users(device_token) WHERE device_token IS NOT NULL');

    // Rate-Limiting (Missbrauchsschutz): pro Schlüssel ein Min-Intervall + ein Fensterzähler.
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS rate_limits (
            rkey      TEXT PRIMARY KEY,
            last_ts   INTEGER NOT NULL DEFAULT 0,
            win_start INTEGER NOT NULL DEFAULT 0,
            win_count INTEGER NOT NULL DEFAULT 0
        )"
    );
}

/** Echte Client-IP (hinter ZHL-Proxy via X-Forwarded-For). Nur als weicher Zusatz. */
function client_ip(): string {
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff !== '') {
        $first = trim(explode(',', $xff)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * Rate-Limit-Prüfung für einen Schlüssel.
 *  - $minInterval: Mindestabstand in Sekunden zwischen zwei Aktionen (0 = aus).
 *  - $windowSec/$windowMax: höchstens $windowMax Aktionen je gleitendem Fenster (0 = aus).
 * Bei Erfolg wird die Aktion gezählt. Rückgabe: ['ok'=>bool, 'retry_after'=>int Sekunden].
 */
function rate_check(string $key, int $minInterval, int $windowSec, int $windowMax): array {
    $now = time();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT last_ts, win_start, win_count FROM rate_limits WHERE rkey = ?');
        $st->execute([$key]);
        $row = $st->fetch() ?: ['last_ts' => 0, 'win_start' => 0, 'win_count' => 0];
        $lastTs = (int)$row['last_ts']; $winStart = (int)$row['win_start']; $winCount = (int)$row['win_count'];

        $retry = 0;
        if ($minInterval > 0 && ($now - $lastTs) < $minInterval) {
            $retry = max($retry, $minInterval - ($now - $lastTs));
        }
        if ($windowSec > 0) {
            if (($now - $winStart) >= $windowSec) { $winStart = $now; $winCount = 0; }
            if ($winCount >= $windowMax) { $retry = max($retry, $windowSec - ($now - $winStart)); }
        }
        if ($retry > 0) { $pdo->commit(); return ['ok' => false, 'retry_after' => (int)$retry]; }

        // erlaubt → zählen
        if ($windowSec > 0 && ($now - $winStart) >= $windowSec) { $winStart = $now; $winCount = 0; }
        $winCount++;
        $pdo->prepare(
            'INSERT INTO rate_limits (rkey, last_ts, win_start, win_count) VALUES (?, ?, ?, ?)
             ON CONFLICT(rkey) DO UPDATE SET last_ts = excluded.last_ts, win_start = excluded.win_start, win_count = excluded.win_count'
        )->execute([$key, $now, $winStart, $winCount]);
        $pdo->commit();
        return ['ok' => true, 'retry_after' => 0];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // Im Zweifel erlauben (Verfügbarkeit vor perfekter Drosselung), aber Fehler protokollieren.
        error_log('[rate_check] ' . $e->getMessage());
        return ['ok' => true, 'retry_after' => 0];
    }
}

/** Anzahl Nutzer (für „erster Account wird Lehrkraft"-Logik / Diagnose). */
function db_user_count(): int {
    return (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
}
