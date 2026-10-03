<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    api_method_not_allowed(['POST']);
}
$user = require_user('student');
$body = request_json();
require_csrf($body);

$quizId = filter_var($body['quiz_id'] ?? null, FILTER_VALIDATE_INT);
$answers = $body['answers'] ?? null;
if ($quizId === false || $quizId < 1 || !is_array($answers)) {
    json_response(['error' => 'The assessment submission is invalid.'], 422);
}

$starts = $_SESSION['quiz_starts'] ?? [];
if (!isset($starts[$quizId]) || !is_numeric($starts[$quizId])) {
    json_response(['error' => 'Start the assessment before submitting your answers.'], 409);
}
$startedAt = (int) $starts[$quizId];

try {
    $quizQuery = $pdo->prepare('SELECT id, title, time_limit FROM quizzes WHERE id = :id LIMIT 1');
    $quizQuery->execute(['id' => $quizId]);
    $quiz = $quizQuery->fetch();
    if (!$quiz) {
        json_response(['error' => 'The assessment was not found.'], 404);
    }

    // Allow a brief network transit window after the countdown reaches zero.
    // The UI submits immediately at the deadline; late submissions are rejected.
    if (time() > $startedAt + ((int) $quiz['time_limit'] * 60) + 5) {
        json_response(['error' => 'The assessment time has expired. Your late submission was not accepted.', 'code' => 'time_expired'], 410);
    }

    $questionQuery = $pdo->prepare(
        'SELECT qu.id AS question_id, qu.points, o.id AS option_id, o.is_correct
         FROM questions qu
         INNER JOIN options o ON o.question_id = qu.id
         WHERE qu.quiz_id = :quiz_id
         ORDER BY qu.id, o.id'
    );
    $questionQuery->execute(['quiz_id' => $quizId]);
    $answerKey = [];
    foreach ($questionQuery->fetchAll() as $row) {
        $questionKey = (int) $row['question_id'];
        if (!isset($answerKey[$questionKey])) {
            $answerKey[$questionKey] = [
                'points' => (int) $row['points'],
                'correct_option' => null,
                'options' => [],
            ];
        }
        $answerKey[$questionKey]['options'][] = (int) $row['option_id'];
        if ((int) $row['is_correct'] === 1) {
            $answerKey[$questionKey]['correct_option'] = (int) $row['option_id'];
        }
    }
    if (!$answerKey) {
        json_response(['error' => 'This assessment has no questions and cannot be submitted.'], 409);
    }

    $selectedAnswers = [];
    foreach ($answers as $rawQuestionId => $rawOptionId) {
        if (!is_scalar($rawQuestionId) || !ctype_digit((string) $rawQuestionId)) {
            json_response(['error' => 'One or more submitted answers are invalid.'], 422);
        }
        $questionId = (int) $rawQuestionId;
        if (!isset($answerKey[$questionId])) {
            json_response(['error' => 'An answer refers to a question outside this assessment.'], 422);
        }
        if (!is_scalar($rawOptionId) || !ctype_digit((string) $rawOptionId)) {
            json_response(['error' => 'One or more submitted choices are invalid.'], 422);
        }
        $optionId = (int) $rawOptionId;
        if (!in_array($optionId, $answerKey[$questionId]['options'], true)) {
            json_response(['error' => 'A selected choice does not belong to its question.'], 422);
        }
        $selectedAnswers[$questionId] = $optionId;
    }

    $score = 0;
    $totalScore = 0;
    foreach ($answerKey as $questionId => $question) {
        $totalScore += $question['points'];
        if (isset($selectedAnswers[$questionId]) && $question['correct_option'] !== null && $selectedAnswers[$questionId] === $question['correct_option']) {
            $score += $question['points'];
        }
    }
    if ($totalScore < 1 || $totalScore > 10000) {
        json_response(['error' => 'This assessment has an invalid score configuration.'], 409);
    }
    $percentage = round(($score / $totalScore) * 100, 2);

    $pdo->beginTransaction();
    $attemptInsert = $pdo->prepare(
        'INSERT INTO attempts (user_id, quiz_id, score, total_score, percentage, completed_at)
         VALUES (:user_id, :quiz_id, :score, :total_score, :percentage, CURRENT_TIMESTAMP)'
    );
    $attemptInsert->execute([
        'user_id' => $user['id'],
        'quiz_id' => $quizId,
        'score' => $score,
        'total_score' => $totalScore,
        'percentage' => number_format($percentage, 2, '.', ''),
    ]);
    $attemptId = (int) $pdo->lastInsertId();
    $pdo->commit();
    unset($_SESSION['quiz_starts'][$quizId]);

    json_response([
        'success' => true,
        'attempt_id' => $attemptId,
        'quiz_title' => (string) $quiz['title'],
        'score' => $score,
        'total_score' => $totalScore,
        'percentage' => $percentage,
        'completed_at' => gmdate('c'),
    ]);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Assessment submission failed: ' . $exception->getMessage());
    json_response(['error' => 'Your submission could not be saved. Please try again.'], 500);
}
