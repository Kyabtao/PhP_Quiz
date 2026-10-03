<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    api_method_not_allowed(['GET']);
}
require_user('admin');

$limit = filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 250]]);
$limit = $limit === false || $limit === null ? 100 : $limit;

try {
    $statement = $pdo->prepare(
        'SELECT a.id, a.score, a.total_score, a.percentage, a.completed_at,
                u.name AS student_name, u.email AS student_email, q.title AS quiz_title
         FROM attempts a
         INNER JOIN users u ON u.id = a.user_id
         INNER JOIN quizzes q ON q.id = a.quiz_id
         ORDER BY a.completed_at DESC, a.id DESC
         LIMIT :row_limit'
    );
    $statement->bindValue(':row_limit', $limit, PDO::PARAM_INT);
    $statement->execute();
    $stats = [
        'students' => (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'student'")->fetchColumn(),
        'quizzes' => (int) $pdo->query('SELECT COUNT(*) FROM quizzes')->fetchColumn(),
        'attempts' => (int) $pdo->query('SELECT COUNT(*) FROM attempts')->fetchColumn(),
    ];
    json_response(['attempts' => $statement->fetchAll(), 'stats' => $stats]);
} catch (Throwable $exception) {
    error_log('Attempt list retrieval failed: ' . $exception->getMessage());
    json_response(['error' => 'Assessment results are temporarily unavailable.'], 500);
}
