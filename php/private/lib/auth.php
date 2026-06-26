<?php
/**
 * Authentifizierung (Phase 4): Registrierung/Login für Studierende und Lehrende.
 * Session-basiert ($_SESSION['uid']). Lehrenden-Konto erfordert einen Code
 * (Env TEACHER_CODE, sonst Rückfall auf PFLEGE_PASSWORD).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const DEVICE_COOKIE = 'biomech_device';
const DEVICE_TTL = 31536000; // 1 Jahr

/** Session starten und – falls vorhanden – per Geräte-Cookie automatisch anmelden. */
function auth_boot(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (!empty($_SESSION['uid'])) return;
    $tok = $_COOKIE[DEVICE_COOKIE] ?? '';
    if ($tok === '') return;
    $st = db()->prepare('SELECT id FROM users WHERE device_token = ?');
    $st->execute([$tok]);
    $id = $st->fetchColumn();
    if ($id) {
        $_SESSION['uid'] = (int)$id;
        device_cookie_set($tok); // Ablauf auffrischen
    }
}

/** Geräte-Cookie setzen (sicher, langlebig). */
function device_cookie_set(string $token): void {
    if (headers_sent()) return;
    setcookie(DEVICE_COOKIE, $token, [
        'expires'  => time() + DEVICE_TTL,
        'path'     => '/',
        'secure'   => (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function current_user(): ?array {
    static $cached = false; static $user = null;
    if ($cached) return $user;
    $cached = true;
    auth_boot();
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) { $user = null; return null; }
    $st = db()->prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
    $st->execute([$uid]);
    $user = $st->fetch() ?: null;
    if ($user === null) { unset($_SESSION['uid']); }
    return $user;
}

function is_logged_in(): bool { return current_user() !== null; }
function is_teacher(): bool { $u = current_user(); return $u !== null && $u['role'] === 'teacher'; }

/** Lehrenden-Code prüfen. */
function teacher_code_ok(string $code): bool {
    $expected = app_env('TEACHER_CODE');
    if (!$expected) $expected = app_env('PFLEGE_PASSWORD');
    return $expected !== null && $expected !== '' && hash_equals($expected, $code);
}

/**
 * Registriert ein Konto. Gibt [true, userId] oder [false, Fehlermeldung] zurück.
 */
function auth_register(string $email, string $pass, string $name, bool $wantTeacher, string $teacherCode): array {
    $email = strtolower(trim($email));
    $name = trim($name);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return [false, 'Bitte eine gültige E-Mail angeben.'];
    if (mb_strlen($pass) < 8) return [false, 'Das Passwort muss mindestens 8 Zeichen haben.'];
    if ($name === '') return [false, 'Bitte einen Namen angeben.'];

    $role = 'student';
    if ($wantTeacher) {
        if (!teacher_code_ok($teacherCode)) return [false, 'Lehrenden-Code falsch oder nicht gesetzt.'];
        $role = 'teacher';
    }

    $exists = db()->prepare('SELECT 1 FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetchColumn()) return [false, 'Für diese E-Mail gibt es bereits ein Konto.'];

    $st = db()->prepare('INSERT INTO users (email, pass_hash, name, role) VALUES (?, ?, ?, ?)');
    $st->execute([$email, password_hash($pass, PASSWORD_DEFAULT), $name, $role]);
    $uid = (int)db()->lastInsertId();
    auth_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    return [true, $uid];
}

/**
 * Schnellstart ohne Passwort: nur Name. Erzeugt ein Geräte-Konto und setzt ein
 * langlebiges Cookie — die/der Studierende ist auf diesem Gerät dauerhaft erkannt.
 */
function auth_quickstart(string $name): array {
    $name = trim($name);
    if ($name === '') return [false, 'Bitte einen Namen eingeben.'];
    if (mb_strlen($name) > 80) $name = mb_substr($name, 0, 80);

    $token = bin2hex(random_bytes(16));
    $email = 'geraet-' . $token . '@biomech.local'; // synthetisch (Spalte ist NOT NULL UNIQUE)
    $st = db()->prepare('INSERT INTO users (email, pass_hash, name, role, device_token) VALUES (?, ?, ?, "student", ?)');
    $st->execute([$email, '', $name, $token]);
    $uid = (int)db()->lastInsertId();
    auth_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    device_cookie_set($token);
    return [true, $uid];
}

/** Anmeldung. Gibt [true, userId] oder [false, Fehlermeldung] zurück. */
function auth_login(string $email, string $pass): array {
    $email = strtolower(trim($email));
    $st = db()->prepare('SELECT id, pass_hash FROM users WHERE email = ?');
    $st->execute([$email]);
    $row = $st->fetch();
    if (!$row || !password_verify($pass, $row['pass_hash'])) return [false, 'E-Mail oder Passwort falsch.'];
    auth_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$row['id'];
    return [true, (int)$row['id']];
}

function auth_logout(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    unset($_SESSION['uid']);
    if (!headers_sent()) {
        setcookie(DEVICE_COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
    }
}

/** Leitet zu konto.php um, wenn nicht angemeldet. */
function require_login(string $next = ''): array {
    $u = current_user();
    if ($u === null) {
        $q = $next ? ('?next=' . urlencode($next)) : '';
        header('Location: konto.php' . $q);
        exit;
    }
    return $u;
}

function require_teacher(): array {
    $u = require_login();
    if ($u['role'] !== 'teacher') {
        http_response_code(403);
        echo 'Nur für Lehrende.';
        exit;
    }
    return $u;
}
