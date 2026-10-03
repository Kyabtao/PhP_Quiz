<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../config/db.php';

function read_secret(string $label): string
{
    fwrite(STDOUT, $label);
    $isTerminal = function_exists('posix_isatty') && posix_isatty(STDIN);
    $canHide = $isTerminal && function_exists('shell_exec') && stripos(PHP_OS_FAMILY, 'Windows') === false;
    if ($canHide) shell_exec('stty -echo 2>/dev/null');
    try {
        $value = fgets(STDIN);
    } finally {
        if ($canHide) {
            shell_exec('stty echo 2>/dev/null');
            fwrite(STDOUT, PHP_EOL);
        }
    }
    return trim($value === false ? '' : $value);
}

$email = strtolower(trim((string) ($argv[1] ?? '')));
if ($email === '') {
    fwrite(STDOUT, 'Account email: ');
    $email = strtolower(trim((string) fgets(STDIN)));
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Provide a valid account email.\n");
    exit(1);
}
$password = read_secret('New password (minimum 12 characters): ');
$confirmation = read_secret('Confirm new password: ');
if (strlen($password) < 12 || strlen($password) > 4096) {
    fwrite(STDERR, "Password must contain between 12 and 4,096 bytes.\n");
    exit(1);
}
if (!hash_equals($password, $confirmation)) {
    fwrite(STDERR, "Passwords do not match.\n");
    exit(1);
}

$statement = $pdo->prepare('UPDATE users SET password = :password WHERE email = :email');
$statement->execute(['password' => password_hash($password, PASSWORD_DEFAULT), 'email' => $email]);
if ($statement->rowCount() === 0) {
    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if (!$check->fetch()) {
        fwrite(STDERR, "No account was found for that email address.\n");
        exit(1);
    }
}
fwrite(STDOUT, sprintf("Password updated for %s.\n", $email));
