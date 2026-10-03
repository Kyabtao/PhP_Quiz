<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../config/db.php';

function prompt_value(string $label): string
{
    fwrite(STDOUT, $label);
    $value = fgets(STDIN);
    return trim($value === false ? '' : $value);
}

function prompt_secret(string $label): string
{
    fwrite(STDOUT, $label);
    $isTerminal = function_exists('posix_isatty') && posix_isatty(STDIN);
    $canHide = $isTerminal && function_exists('shell_exec') && stripos(PHP_OS_FAMILY, 'Windows') === false;
    if ($canHide) {
        shell_exec('stty -echo 2>/dev/null');
    }
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

$name = prompt_value('Full name: ');
$email = strtolower(prompt_value('Email address: '));
$role = strtolower(prompt_value('Role (student or admin): '));
$password = prompt_secret('Password (minimum 12 characters): ');
$confirmation = prompt_secret('Confirm password: ');

if ($name === '' || strlen($name) > 120) {
    fwrite(STDERR, "Name must contain between 1 and 120 characters.\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    fwrite(STDERR, "Enter a valid email address no longer than 190 characters.\n");
    exit(1);
}
if (!in_array($role, ['student', 'admin'], true)) {
    fwrite(STDERR, "Role must be either student or admin.\n");
    exit(1);
}
if (strlen($password) < 12 || strlen($password) > 4096) {
    fwrite(STDERR, "Password must contain between 12 and 4,096 bytes.\n");
    exit(1);
}
if (!hash_equals($password, $confirmation)) {
    fwrite(STDERR, "Passwords do not match.\n");
    exit(1);
}

try {
    $statement = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (:name, :email, :password, :role)');
    $statement->execute([
        'name' => $name,
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
    ]);
    fwrite(STDOUT, sprintf("Created %s account for %s (user id %d).\n", $role, $email, (int) $pdo->lastInsertId()));
} catch (PDOException $exception) {
    if ($exception->getCode() === '23000') {
        fwrite(STDERR, "An account already exists with that email address.\n");
        exit(1);
    }
    error_log('User creation failed: ' . $exception->getMessage());
    fwrite(STDERR, "The account could not be created. Verify database access and try again.\n");
    exit(1);
}
