<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    api_method_not_allowed(['POST']);
}

$body = request_json();
require_csrf($body);
$action = (string) ($body['action'] ?? 'login');

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'] ?: '/',
            'domain' => $params['domain'],
            'secure' => (bool) $params['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
    json_response(['success' => true]);
}

if ($action !== 'login') {
    json_response(['error' => 'Unknown authentication action.'], 400);
}

$email = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190 || $password === '' || strlen($password) > 4096) {
    json_response(['error' => 'Enter a valid email address and password.'], 422);
}

$now = time();
$loginWindow = $_SESSION['login_window'] ?? ['started' => $now, 'failures' => 0];
if (!is_array($loginWindow) || !isset($loginWindow['started'], $loginWindow['failures']) || $now - (int) $loginWindow['started'] >= 900) {
    $loginWindow = ['started' => $now, 'failures' => 0];
}
if ((int) $loginWindow['failures'] >= 8) {
    json_response(['error' => 'Too many sign-in attempts. Wait 15 minutes and try again.'], 429);
}

try {
    $statement = $pdo->prepare('SELECT id, name, email, password, role FROM users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => $email]);
    $account = $statement->fetch();
} catch (Throwable $exception) {
    error_log('Authentication query failed: ' . $exception->getMessage());
    json_response(['error' => 'Sign-in is temporarily unavailable. Please try again later.'], 500);
}

if ($account) {
    $validPassword = password_verify($password, (string) $account['password']);
} else {
    // Do one bcrypt verification for an unknown account to reduce email-enumeration timing differences.
    password_verify($password, '$2y$12$nPMlHxT7bFE8nDWS5oLgdON4C1cX1SeBeyUW9aLAQ1jAca6KSuyPC');
    $validPassword = false;
}
if (!$account || !$validPassword) {
    $loginWindow['failures'] = (int) $loginWindow['failures'] + 1;
    $_SESSION['login_window'] = $loginWindow;
    json_response(['error' => 'The email or password you entered is incorrect.'], 401);
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $account['id'];
$_SESSION['user_name'] = (string) $account['name'];
$_SESSION['role'] = (string) $account['role'];
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));
$_SESSION['quiz_starts'] = [];
unset($_SESSION['login_window']);

json_response([
    'success' => true,
    'user' => ['id' => (int) $account['id'], 'name' => (string) $account['name'], 'role' => (string) $account['role']],
    'csrf_token' => $_SESSION['csrf_token'],
]);
