<?php
declare(strict_types=1);
require_once __DIR__ . '/config/bootstrap.php';
$user = current_user();
if ($user === null) {
    header('Location: login.php');
    exit;
}
if ($user['role'] !== 'student') {
    header('Location: admin.php');
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
    <meta name="user-id" content="<?= (int) $user['id'] ?>">
    <meta name="theme-color" content="#0b1118">
    <title>Assessments · Northstar</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <script src="assets/js/common.js" defer></script>
    <script src="assets/js/student.js" defer></script>
</head>
<body>
    <header class="topbar">
        <div class="topbar-inner">
            <a class="brand" href="index.php"><span class="brand-mark" aria-hidden="true">N</span><span>Northstar<span class="brand-light"> Assessments</span></span></a>
            <div class="topbar-actions">
                <span class="user-chip"><span class="avatar" aria-hidden="true"><?= e(strtoupper(substr($user['name'], 0, 1))) ?></span><span><?= e($user['name']) ?></span></span>
                <button class="button button-quiet button-small" type="button" data-logout>Sign out</button>
            </div>
        </div>
    </header>

    <main class="page-shell">
        <section id="catalog-view">
            <div class="page-heading">
                <div>
                    <p class="eyebrow">Your learning workspace</p>
                    <h1>Assessment library</h1>
                    <p class="subtle">Choose an assessment when you’re ready. Your time begins when you start.</p>
                </div>
                <div class="heading-note"><span class="status-dot"></span><span>Progress is saved when you submit</span></div>
            </div>
            <div id="catalog-message" class="alert hidden" role="alert" aria-live="polite"></div>
            <div id="quiz-grid" class="quiz-grid" aria-live="polite">
                <div class="loading-card card"><span class="spinner" aria-hidden="true"></span><span>Loading assessments…</span></div>
            </div>
            <section class="panel card student-history" aria-labelledby="student-history-title">
                <div class="section-heading results-heading">
                    <div><p class="eyebrow">Your progress</p><h2 id="student-history-title">Recent results</h2><p class="subtle">Your latest completed assessments, visible only to you.</p></div>
                </div>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Assessment</th><th>Score</th><th>Result</th><th>Completed</th></tr></thead>
                        <tbody id="student-attempts-body"><tr><td class="table-loading" colspan="4">Loading your results…</td></tr></tbody>
                    </table>
                </div>
            </section>
        </section>

        <section id="runner-view" class="hidden" aria-labelledby="runner-title">
            <div class="runner-toolbar">
                <button id="back-to-catalog" class="button button-quiet" type="button"><span aria-hidden="true">←</span> Assessment library</button>
                <div id="timer-banner" class="timer-banner" role="timer" aria-live="off">
                    <span class="timer-icon" aria-hidden="true">◷</span>
                    <span><span class="timer-caption">TIME LEFT</span><strong id="timer-value">--:--</strong></span>
                </div>
            </div>
            <div class="runner-heading">
                <div>
                    <p class="eyebrow">Assessment in progress</p>
                    <h1 id="runner-title"></h1>
                    <p class="subtle" id="runner-description"></p>
                </div>
                <div class="progress-summary"><strong id="progress-count">0 / 0</strong><span>questions answered</span></div>
            </div>
            <progress id="progress-fill" class="progress-track" value="0" max="1" aria-label="Assessment questions answered"></progress>
            <div id="runner-message" class="alert hidden" role="alert" aria-live="polite"></div>
            <form id="assessment-form" class="question-list"></form>
            <div class="submit-bar card">
                <div><strong>Ready to finish?</strong><p class="subtle">You can submit with unanswered questions.</p></div>
                <button id="submit-assessment" class="button button-primary" type="button">Submit assessment <span aria-hidden="true">→</span></button>
            </div>
        </section>

        <section id="result-view" class="hidden" aria-labelledby="result-title">
            <div class="result-card card">
                <div class="result-emblem" aria-hidden="true">✓</div>
                <p class="eyebrow">Assessment complete</p>
                <h1 id="result-title">Your result is ready</h1>
                <p id="result-quiz-title" class="subtle"></p>
                <div class="result-score"><strong id="result-percentage">0%</strong><span id="result-marks">0 of 0 points</span></div>
                <progress id="result-meter-fill" class="result-meter" value="0" max="100" aria-label="Assessment percentage score"></progress>
                <p id="result-message" class="result-feedback"></p>
                <button id="return-to-library" class="button button-primary" type="button">Return to assessment library <span aria-hidden="true">→</span></button>
            </div>
        </section>
    </main>
    <footer class="site-footer">Northstar Assessments <span>·</span> Your work stays within your organization</footer>
</body>
</html>
