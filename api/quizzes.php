<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = require_user();
    $quizId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (array_key_exists('id', $_GET) && ($quizId === false || $quizId === null)) {
        json_response(['error' => 'The assessment identifier is invalid.'], 400);
    }

    try {
        if ($quizId === false || $quizId === null) {
            $statement = $pdo->query(
                'SELECT q.id, q.title, q.description, q.time_limit, q.created_at, u.name AS creator_name, COUNT(DISTINCT qu.id) AS question_count, COALESCE(SUM(qu.points), 0) AS total_points
                 FROM quizzes q
                 INNER JOIN users u ON u.id = q.created_by
                 LEFT JOIN questions qu ON qu.quiz_id = q.id
                 GROUP BY q.id, q.title, q.description, q.time_limit, q.created_at, u.name
                 ORDER BY q.created_at DESC, q.id DESC'
            );
            json_response(['quizzes' => $statement->fetchAll()]);
        }

        $statement = $pdo->prepare('SELECT id, title, description, time_limit, created_at FROM quizzes WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $quizId]);
        $quiz = $statement->fetch();
        if (!$quiz) {
            json_response(['error' => 'The requested assessment was not found.'], 404);
        }

        $isAdmin = $user['role'] === 'admin';
        $correctSelection = $isAdmin ? ', o.is_correct' : '';
        $questionsQuery = $pdo->prepare(
            'SELECT qu.id, qu.question_text, qu.points, o.id AS option_id, o.option_text' . $correctSelection . '
             FROM questions qu
             LEFT JOIN options o ON o.question_id = qu.id
             WHERE qu.quiz_id = :quiz_id
             ORDER BY qu.id ASC, o.id ASC'
        );
        $questionsQuery->execute(['quiz_id' => $quizId]);
        $questions = [];
        foreach ($questionsQuery->fetchAll() as $row) {
            $questionId = (int) $row['id'];
            if (!isset($questions[$questionId])) {
                $questions[$questionId] = [
                    'id' => $questionId,
                    'question_text' => (string) $row['question_text'],
                    'points' => (int) $row['points'],
                    'options' => [],
                ];
            }
            if ($row['option_id'] !== null) {
                $option = ['id' => (int) $row['option_id'], 'option_text' => (string) $row['option_text']];
                if ($isAdmin) {
                    $option['is_correct'] = (bool) $row['is_correct'];
                }
                $questions[$questionId]['options'][] = $option;
            }
        }
        $quiz['id'] = (int) $quiz['id'];
        $quiz['time_limit'] = (int) $quiz['time_limit'];
        $quiz['questions'] = array_values($questions);
        $quiz['total_points'] = array_sum(array_column($quiz['questions'], 'points'));

        json_response(['quiz' => $quiz]);
    } catch (Throwable $exception) {
        error_log('Quiz retrieval failed: ' . $exception->getMessage());
        json_response(['error' => 'Assessments are temporarily unavailable. Please try again later.'], 500);
    }
}

if ($method !== 'POST') {
    api_method_not_allowed(['GET', 'POST']);
}

$user = require_user();
$body = request_json();
require_csrf($body);
$action = (string) ($body['action'] ?? 'create');

if ($action === 'start') {
    if ($user['role'] !== 'student') {
        json_response(['error' => 'Only students can start assessments.'], 403);
    }
    $startQuizId = filter_var($body['quiz_id'] ?? null, FILTER_VALIDATE_INT);
    if ($startQuizId === false || $startQuizId < 1) {
        json_response(['error' => 'The assessment identifier is invalid.'], 422);
    }
    try {
        $startQuery = $pdo->prepare('SELECT id, time_limit FROM quizzes WHERE id = :id LIMIT 1');
        $startQuery->execute(['id' => $startQuizId]);
        $startQuiz = $startQuery->fetch();
    } catch (Throwable $exception) {
        error_log('Assessment start failed: ' . $exception->getMessage());
        json_response(['error' => 'The assessment could not be started. Please try again.'], 500);
    }
    if (!$startQuiz) {
        json_response(['error' => 'The requested assessment was not found.'], 404);
    }
    $starts = $_SESSION['quiz_starts'] ?? [];
    if (!isset($starts[$startQuizId]) || !is_numeric($starts[$startQuizId])) {
        $starts[$startQuizId] = time();
        $_SESSION['quiz_starts'] = $starts;
    }
    $startedAt = (int) $starts[$startQuizId];
    json_response([
        'started_at' => $startedAt,
        'expires_at' => $startedAt + ((int) $startQuiz['time_limit'] * 60),
        'server_now' => time(),
    ]);
}

if ($action !== 'create') {
    json_response(['error' => 'Unknown assessment action.'], 400);
}
if ($user['role'] !== 'admin') {
    json_response(['error' => 'You do not have permission to create assessments.'], 403);
}

$title = trim((string) ($body['title'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$timeLimit = filter_var($body['time_limit'] ?? null, FILTER_VALIDATE_INT);
$questions = $body['questions'] ?? null;

if ($title === '' || mb_strlen($title, 'UTF-8') > 180) {
    json_response(['error' => 'Enter a title between 1 and 180 characters.'], 422);
}
if (mb_strlen($description, 'UTF-8') > 10000) {
    json_response(['error' => 'The description cannot exceed 10,000 characters.'], 422);
}
if ($timeLimit === false || $timeLimit < 1 || $timeLimit > 360) {
    json_response(['error' => 'Set a time limit between 1 and 360 minutes.'], 422);
}
if (!is_array($questions) || count($questions) < 1 || count($questions) > 100) {
    json_response(['error' => 'An assessment must contain between 1 and 100 questions.'], 422);
}

$normalizedQuestions = [];
foreach ($questions as $index => $question) {
    if (!is_array($question)) {
        json_response(['error' => 'Question ' . ($index + 1) . ' is invalid.'], 422);
    }
    $questionText = trim((string) ($question['question_text'] ?? ''));
    $points = filter_var($question['points'] ?? null, FILTER_VALIDATE_INT);
    $options = $question['options'] ?? null;
    if ($questionText === '' || mb_strlen($questionText, 'UTF-8') > 4000) {
        json_response(['error' => 'Question ' . ($index + 1) . ' must contain 1 to 4,000 characters.'], 422);
    }
    if ($points === false || $points < 1 || $points > 100) {
        json_response(['error' => 'Question ' . ($index + 1) . ' must be worth 1 to 100 points.'], 422);
    }
    if (!is_array($options) || count($options) < 2 || count($options) > 10) {
        json_response(['error' => 'Question ' . ($index + 1) . ' needs between 2 and 10 choices.'], 422);
    }
    $normalizedOptions = [];
    $correctCount = 0;
    foreach ($options as $optionIndex => $option) {
        if (!is_array($option)) {
            json_response(['error' => 'A choice in question ' . ($index + 1) . ' is invalid.'], 422);
        }
        $optionText = trim((string) ($option['option_text'] ?? ''));
        if ($optionText === '' || mb_strlen($optionText, 'UTF-8') > 1000) {
            json_response(['error' => 'Every choice must contain 1 to 1,000 characters.'], 422);
        }
        $isCorrect = ($option['is_correct'] ?? false) === true || ($option['is_correct'] ?? false) === 1 || ($option['is_correct'] ?? '') === '1';
        if ($isCorrect) {
            $correctCount++;
        }
        $normalizedOptions[] = ['option_text' => $optionText, 'is_correct' => $isCorrect ? 1 : 0];
    }
    if ($correctCount !== 1) {
        json_response(['error' => 'Select exactly one correct choice for question ' . ($index + 1) . '.'], 422);
    }
    $normalizedQuestions[] = ['question_text' => $questionText, 'points' => $points, 'options' => $normalizedOptions];
}

try {
    $pdo->beginTransaction();
    $quizInsert = $pdo->prepare('INSERT INTO quizzes (title, description, time_limit, created_by) VALUES (:title, :description, :time_limit, :created_by)');
    $quizInsert->execute([
        'title' => $title,
        'description' => $description,
        'time_limit' => $timeLimit,
        'created_by' => $user['id'],
    ]);
    $quizId = (int) $pdo->lastInsertId();
    $questionInsert = $pdo->prepare('INSERT INTO questions (quiz_id, question_text, points) VALUES (:quiz_id, :question_text, :points)');
    $optionInsert = $pdo->prepare('INSERT INTO options (question_id, option_text, is_correct) VALUES (:question_id, :option_text, :is_correct)');

    foreach ($normalizedQuestions as $question) {
        $questionInsert->execute([
            'quiz_id' => $quizId,
            'question_text' => $question['question_text'],
            'points' => $question['points'],
        ]);
        $questionId = (int) $pdo->lastInsertId();
        foreach ($question['options'] as $option) {
            $optionInsert->execute([
                'question_id' => $questionId,
                'option_text' => $option['option_text'],
                'is_correct' => $option['is_correct'],
            ]);
        }
    }
    $pdo->commit();
    json_response(['success' => true, 'quiz_id' => $quizId, 'message' => 'Assessment published successfully.'], 201);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Quiz creation failed: ' . $exception->getMessage());
    json_response(['error' => 'The assessment could not be saved. Please try again.'], 500);
}
