<?php
declare(strict_types=1);

/**
 * Shared session policy and PDO connection for the Quiz Assessment System.
 * Configure with DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD environment
 * variables. Defaults are suitable for a local MySQL development install.
 */

if (PHP_VERSION_ID < 70400) {
    http_response_code(500);
    exit('This application requires PHP 7.4 or newer.');
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.gc_maxlifetime', '7200');

    $isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && strtolower((string) $_SERVER['HTTPS']) !== 'off';
    session_name('quiz_assessment_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

$databaseHost = getenv('DB_HOST') ?: '127.0.0.1';
$databasePort = getenv('DB_PORT') ?: '3306';
$databaseName = getenv('DB_NAME') ?: 'quiz_assessment';
$databaseUser = getenv('DB_USER') ?: 'root';
$databasePassword = getenv('DB_PASSWORD');
$databasePassword = $databasePassword === false ? '' : $databasePassword;

$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $databaseHost, $databasePort, $databaseName);

try {
    $pdo = new PDO($dsn, $databaseUser, $databasePassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
        PDO::ATTR_PERSISTENT => false,
    ]);
} catch (PDOException $exception) {
    error_log('Quiz Assessment System database connection failed: ' . $exception->getMessage());
    http_response_code(500);
    if (PHP_SAPI === 'cli') {
        throw $exception;
    }
    exit('The application database is unavailable. Verify the local database configuration.');
}
