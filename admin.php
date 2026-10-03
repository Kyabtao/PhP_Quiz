<?php
declare(strict_types=1);
require_once __DIR__ . '/config/bootstrap.php';
$user = current_user();
if ($user === null) {
    header('Location: login.php');
    exit;
}
if ($user['role'] !== 'admin') {
    header('Location: index.php');
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
    <title>Admin workspace · Northstar</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <script src="assets/js/common.js" defer></script>
    <script src="assets/js/admin.js" defer></script>
</head>
<body>
    <header class="topbar">
        <div class="topbar-inner">
            <a class="brand" href="admin.php"><span class="brand-mark" aria-hidden="true">N</span><span>Northstar<span class="brand-light"> Assessments</span></span></a>
            <div class="topbar-actions">
                <span class="admin-badge">Administrator</span>
                <span class="user-chip"><span class="avatar" aria-hidden="true"><?= e(strtoupper(substr($user['name'], 0, 1))) ?></span><span><?= e($user['name']) ?></span></span>
                <button class="button button-quiet button-small" type="button" data-logout>Sign out</button>
            </div>
        </div>
    </header>

    <main class="page-shell admin-shell">
        <div class="page-heading admin-heading">
            <div>
                <p class="eyebrow">Administration</p>
                <h1>Assessment workspace</h1>
                <p class="subtle">Create assessments, review results, and keep learning on track.</p>
            </div>
            <a class="button button-primary" href="#quiz-builder">Create an assessment <span aria-hidden="true">＋</span></a>
        </div>

        <section class="stats-grid" aria-label="Workspace overview">
            <article class="stat-card card"><span class="stat-icon stat-icon-violet" aria-hidden="true">◉</span><div><span class="stat-label">Students</span><strong id="stat-students">—</strong><span class="stat-caption">Accounts in the system</span></div></article>
            <article class="stat-card card"><span class="stat-icon stat-icon-blue" aria-hidden="true">▤</span><div><span class="stat-label">Assessments</span><strong id="stat-quizzes">—</strong><span class="stat-caption">Available to students</span></div></article>
            <article class="stat-card card"><span class="stat-icon stat-icon-green" aria-hidden="true">↗</span><div><span class="stat-label">Submissions</span><strong id="stat-attempts">—</strong><span class="stat-caption">Completed attempts</span></div></article>
        </section>

        <section id="quiz-builder" class="panel card" aria-labelledby="builder-title">
            <div class="section-heading">
                <div><p class="eyebrow">Build and publish</p><h2 id="builder-title">Create an assessment</h2><p class="subtle">Add a clear brief, then write questions and set the correct choice for each.</p></div>
                <div class="step-indicator" aria-label="Builder step"><span id="step-one-mark" class="step-mark is-current">1</span><span class="step-line"></span><span id="step-two-mark" class="step-mark">2</span></div>
            </div>
            <div id="builder-message" class="alert hidden" role="alert" aria-live="polite"></div>

            <div id="basics-step" class="builder-step">
                <div class="builder-section-title"><span class="step-kicker">STEP 01</span><h3>Assessment details</h3></div>
                <div class="builder-fields">
                    <label class="form-field form-field-wide"><span class="field-label">Assessment title <span class="required-mark">*</span></span><input class="text-input" id="quiz-title" type="text" maxlength="180" required placeholder="e.g. Foundations of Biology"></label>
                    <label class="form-field form-field-wide"><span class="field-label">Description <span class="optional-label">Optional</span></span><textarea class="text-input textarea" id="quiz-description" maxlength="10000" rows="3" placeholder="Share what this assessment covers and what students should know."></textarea></label>
                    <label class="form-field"><span class="field-label">Time limit <span class="required-mark">*</span></span><span class="input-suffix"><input class="text-input" id="quiz-time-limit" type="number" min="1" max="360" value="20" required><span>minutes</span></span></label>
                </div>
                <div class="builder-actions builder-actions-end"><button id="continue-builder" class="button button-primary" type="button">Continue to questions <span aria-hidden="true">→</span></button></div>
            </div>

            <div id="questions-step" class="builder-step hidden">
                <div class="builder-section-title question-step-title"><div><span class="step-kicker">STEP 02</span><h3>Questions and choices</h3></div><p class="subtle">Each question needs at least two choices and one correct answer.</p></div>
                <div id="question-builder-list" class="builder-question-list"></div>
                <button id="add-question" class="button button-dashed" type="button"><span aria-hidden="true">＋</span> Add another question</button>
                <div class="builder-actions">
                    <button id="back-to-basics" class="button button-secondary" type="button"><span aria-hidden="true">←</span> Back</button>
                    <button id="publish-quiz" class="button button-primary" type="button">Publish assessment <span aria-hidden="true">→</span></button>
                </div>
            </div>
        </section>

        <section class="panel card results-panel" aria-labelledby="attempts-title">
            <div class="section-heading results-heading">
                <div><p class="eyebrow">Student outcomes</p><h2 id="attempts-title">Recent submissions</h2><p class="subtle">The latest 100 completed assessment attempts.</p></div>
                <button id="refresh-attempts" class="button button-secondary button-small" type="button"><span aria-hidden="true">↻</span> Refresh</button>
            </div>
            <div id="attempts-message" class="alert hidden" role="alert" aria-live="polite"></div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Student</th><th>Assessment</th><th>Score</th><th>Result</th><th>Submitted</th></tr></thead>
                    <tbody id="attempts-body"><tr><td class="table-loading" colspan="5">Loading recent submissions…</td></tr></tbody>
                </table>
            </div>
        </section>
        <p class="admin-footnote">To add or manage student accounts, use the secure local command-line account tool described in the setup guide.</p>
    </main>
    <footer class="site-footer">Northstar Assessments <span>·</span> Administrative workspace</footer>
</body>
</html>
