<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function request_json(): array
{
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > 8 * 1024 * 1024) {
        json_response(['error' => 'The request is too large.'], 413);
    }

    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        json_response(['error' => 'Send request data as JSON.'], 415);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 8 * 1024 * 1024) {
        json_response(['error' => 'The request could not be read or is too large.'], 413);
    }
    try {
        $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        json_response(['error' => 'The request contains invalid JSON.'], 400);
    }

    if (!is_array($decoded)) {
        json_response(['error' => 'The JSON request must be an object.'], 400);
    }
    return $decoded;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf(?array $body = null): void
{
    $submitted = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($body['csrf_token'] ?? ''));
    $known = (string) ($_SESSION['csrf_token'] ?? '');
    if ($known === '' || $submitted === '' || !hash_equals($known, $submitted)) {
        json_response(['error' => 'Your session security token is missing or expired. Reload the page and try again.'], 419);
    }
}

function current_user(): ?array
{
    if (!isset($_SESSION['user_id'], $_SESSION['user_name'], $_SESSION['role'])) {
        return null;
    }
    return [
        'id' => (int) $_SESSION['user_id'],
        'name' => (string) $_SESSION['user_name'],
        'role' => (string) $_SESSION['role'],
    ];
}

function require_user(?string $role = null): array
{
    $user = current_user();
    if ($user === null) {
        json_response(['error' => 'Please sign in to continue.'], 401);
    }
    if ($role !== null && $user['role'] !== $role) {
        json_response(['error' => 'You do not have permission to perform this action.'], 403);
    }
    return $user;
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function api_method_not_allowed(array $allowed): void
{
    header('Allow: ' . implode(', ', $allowed));
    json_response(['error' => 'This HTTP method is not supported.'], 405);
}
