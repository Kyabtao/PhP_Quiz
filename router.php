<?php
declare(strict_types=1);

// Router used only by PHP's built-in development server. Apache deployments use .htaccess.
$requestedPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$path = str_replace('\\', '/', rawurldecode(is_string($requestedPath) ? $requestedPath : '/'));
$path = preg_replace('~/+~', '/', $path) ?: '/';
$normalizedPath = strtolower($path);
if (strpos($path, "\0") !== false || preg_match('~(^|/)\.\.(?:/|$)~', $path) || preg_match('~(?:^|/)\.[^/]+~', $path)) {
    http_response_code(404);
    exit('Not found.');
}
$protected = [
    '/config', '/config/', '/scripts', '/scripts/', '/.git', '/.git/',
    '/schema.sql', '/readme.md', '/router.php', '/.htaccess',
];
foreach ($protected as $prefix) {
    if ($normalizedPath === rtrim($prefix, '/') || strpos($normalizedPath, $prefix) === 0) {
        http_response_code(404);
        exit('Not found.');
    }
}
return false;
