<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    api_method_not_allowed(['GET']);
}
$user = require_user('student');

try {
    $statement = $pdo->prepare(
        'SELECT a.id, a.score, a.total_score, a.percentage, a.completed_at, q.title AS quiz_title
         FROM attempts a
         INNER JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.user_id = :user_id
         ORDER BY a.completed_at DESC, a.id DESC
         LIMIT 25'
    );
    $statement->execute(['user_id' => $user['id']]);
    json_response(['attempts' => $statement->fetchAll()]);
} catch (Throwable $exception) {
    error_log('Student attempt history retrieval failed: ' . $exception->getMessage());
    json_response(['error' => 'Your assessment history is temporarily unavailable.'], 500);
}
