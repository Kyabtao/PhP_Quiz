<?php
declare(strict_types=1);
require_once __DIR__ . '/config/bootstrap.php';
$user = current_user();
if ($user !== null) {
    header('Location: ' . ($user['role'] === 'admin' ? 'admin.php' : 'index.php'));
    exit;
}
header('Cache-Control: no-store, private');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
    <meta name="theme-color" content="#0b1118">
    <title>Sign in · Northstar Assessments</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <script src="assets/js/login.js" defer></script>
</head>
<body class="auth-page">
    <main class="auth-layout">
        <section class="auth-intro" aria-labelledby="brand-title">
            <a class="brand brand-large" href="login.php" aria-label="Northstar Assessments home">
                <span class="brand-mark" aria-hidden="true">N</span>
                <span>Northstar<span class="brand-light"> Assessments</span></span>
            </a>
            <div class="auth-copy">
                <p class="eyebrow">A clearer way to measure progress</p>
                <h1 id="brand-title">Knowledge, put into practice.</h1>
                <p class="muted-copy">A focused space for thoughtful assessment. Sign in to continue to your learning workspace.</p>
            </div>
            <div class="auth-footnote"><span class="status-dot"></span> Private workspace · Secure session</div>
        </section>

        <section class="auth-card card" aria-labelledby="login-title">
            <div class="auth-card-heading">
                <p class="eyebrow">Welcome back</p>
                <h2 id="login-title">Sign in to your account</h2>
                <p class="subtle">Use the email address associated with your account.</p>
            </div>
            <div id="login-message" class="alert hidden" role="alert" aria-live="polite"></div>
            <form id="login-form" class="form-stack" novalidate>
                <label class="field-label" for="email">Email address</label>
                <input class="text-input" type="email" id="email" name="email" autocomplete="username" maxlength="190" required placeholder="you@example.com">
                <label class="field-label" for="password">Password</label>
                <input class="text-input" type="password" id="password" name="password" autocomplete="current-password" required placeholder="Enter your password">
                <button class="button button-primary button-full" id="login-submit" type="submit">
                    <span class="button-label">Sign in</span><span class="button-arrow" aria-hidden="true">→</span>
                </button>
            </form>
            <p class="auth-note">Need an account? Contact your system administrator.</p>
        </section>
    </main>
    <footer class="site-footer auth-footer">Northstar Assessments <span>·</span> Self-hosted for your organization</footer>
</body>
</html>
