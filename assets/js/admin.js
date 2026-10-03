(() => {
    'use strict';

    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    const builderMessage = document.getElementById('builder-message');
    const attemptsMessage = document.getElementById('attempts-message');
    const questionList = document.getElementById('question-builder-list');
    const basicsStep = document.getElementById('basics-step');
    const questionsStep = document.getElementById('questions-step');
    let questionSequence = 0;
    let publishInProgress = false;

    function node(tag, className, text) {
        const result = document.createElement(tag);
        if (className) result.className = className;
        if (text !== undefined) result.textContent = text;
        return result;
    }

    function showMessage(target, text, kind = 'error') {
        target.textContent = text;
        target.className = `alert alert-${kind}`;
    }

    function clearMessage(target) {
        target.textContent = '';
        target.className = 'alert hidden';
    }

    function setBuilderStep(step) {
        const isBasics = step === 1;
        basicsStep.classList.toggle('hidden', !isBasics);
        questionsStep.classList.toggle('hidden', isBasics);
        document.getElementById('step-one-mark').classList.toggle('is-current', isBasics);
        document.getElementById('step-two-mark').classList.toggle('is-current', !isBasics);
        clearMessage(builderMessage);
    }

    function appendChoice(optionList, questionKey, selected = false) {
        if (optionList.querySelectorAll('.builder-option').length >= 10) {
            showMessage(builderMessage, 'A question can have no more than 10 choices.');
            return;
        }
        const row = node('div', 'builder-option');
        const correctLabel = node('label', 'correct-choice-label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `correct-${questionKey}`;
        radio.value = 'correct';
        radio.checked = selected;
        radio.setAttribute('aria-label', 'Mark this choice as correct');
        correctLabel.append(radio, node('span', 'correct-choice-mark'), node('span', 'sr-only', 'Correct answer'));
        const text = document.createElement('input');
        text.type = 'text';
        text.className = 'text-input option-text-input';
        text.maxLength = 1000;
        text.required = true;
        text.placeholder = 'Enter a choice';
        text.setAttribute('aria-label', 'Choice text');
        const remove = node('button', 'icon-button remove-option', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove choice');
        row.append(correctLabel, text, remove);
        optionList.append(row);
        clearMessage(builderMessage);
    }

    function addQuestion() {
        if (questionList.children.length >= 100) {
            showMessage(builderMessage, 'An assessment can have no more than 100 questions.');
            return;
        }
        questionSequence += 1;
        const key = `q${questionSequence}`;
        const card = node('article', 'builder-question card');
        card.dataset.questionKey = key;
        const header = node('div', 'builder-question-header');
        const heading = node('div', 'builder-question-heading');
        heading.append(node('span', 'question-number', String(questionList.children.length + 1).padStart(2, '0')));
        heading.append(node('strong', '', 'Question'));
        const removeQuestion = node('button', 'button button-quiet button-small remove-question', 'Remove question');
        removeQuestion.type = 'button';
        header.append(heading, removeQuestion);

        const fields = node('div', 'builder-question-fields');
        const promptField = node('label', 'form-field prompt-field');
        promptField.append(node('span', 'field-label', 'Question prompt'));
        const prompt = document.createElement('textarea');
        prompt.className = 'text-input textarea question-prompt-input';
        prompt.required = true;
        prompt.maxLength = 4000;
        prompt.rows = 2;
        prompt.placeholder = 'Write a clear question…';
        promptField.append(prompt);
        const pointsField = node('label', 'form-field points-field');
        pointsField.append(node('span', 'field-label', 'Points'));
        const points = document.createElement('input');
        points.className = 'text-input question-points-input';
        points.type = 'number';
        points.min = '1';
        points.max = '100';
        points.step = '1';
        points.value = '1';
        points.required = true;
        points.setAttribute('aria-label', 'Points for this question');
        pointsField.append(points);
        fields.append(promptField, pointsField);

        const optionsHeading = node('div', 'choices-heading');
        optionsHeading.append(node('span', 'field-label', 'Answer choices'));
        optionsHeading.append(node('span', 'subtle', 'Select the circle beside the correct answer'));
        const optionList = node('div', 'builder-option-list');
        appendChoice(optionList, key, true);
        appendChoice(optionList, key, false);
        const addOption = node('button', 'button button-text add-option', '＋ Add a choice');
        addOption.type = 'button';
        card.append(header, fields, optionsHeading, optionList, addOption);
        questionList.append(card);
        updateQuestionNumbers();
        clearMessage(builderMessage);
    }

    function updateQuestionNumbers() {
        questionList.querySelectorAll('.builder-question').forEach((card, index) => {
            const number = card.querySelector('.builder-question-heading .question-number');
            number.textContent = String(index + 1).padStart(2, '0');
        });
    }

    function showAttempts(attempts) {
        const tbody = document.getElementById('attempts-body');
        tbody.replaceChildren();
        if (!attempts.length) {
            const row = node('tr');
            const cell = node('td', 'table-empty', 'No submissions yet. Results will appear here after a student completes an assessment.');
            cell.colSpan = 5;
            row.append(cell);
            tbody.append(row);
            return;
        }
        attempts.forEach((attempt) => {
            const row = node('tr');
            const studentCell = node('td', 'student-cell');
            studentCell.append(node('strong', '', attempt.student_name), node('span', 'table-secondary', attempt.student_email));
            const assessmentCell = node('td', 'assessment-cell', attempt.quiz_title);
            const scoreCell = node('td', 'score-cell', `${attempt.score} / ${attempt.total_score}`);
            const percentage = Number(attempt.percentage);
            const resultCell = node('td');
            const badge = node('span', `badge ${percentage >= 80 ? 'badge-green' : percentage >= 50 ? 'badge-amber' : 'badge-slate'}`, `${percentage.toFixed(2).replace(/\.00$/, '')}%`);
            resultCell.append(badge);
            const date = new Date(String(attempt.completed_at).replace(' ', 'T'));
            const dateCell = node('td', 'date-cell', Number.isNaN(date.getTime()) ? attempt.completed_at : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date));
            row.append(studentCell, assessmentCell, scoreCell, resultCell, dateCell);
            tbody.append(row);
        });
    }

    async function loadDashboard() {
        clearMessage(attemptsMessage);
        const tbody = document.getElementById('attempts-body');
        tbody.replaceChildren();
        const loadingRow = node('tr');
        const loadingCell = node('td', 'table-loading', 'Loading recent submissions…');
        loadingCell.colSpan = 5;
        loadingRow.append(loadingCell);
        tbody.append(loadingRow);
        try {
            const response = await fetch('api/attempts.php?limit=100', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load assessment results.');
            document.getElementById('stat-students').textContent = data.stats.students;
            document.getElementById('stat-quizzes').textContent = data.stats.quizzes;
            document.getElementById('stat-attempts').textContent = data.stats.attempts;
            showAttempts(data.attempts || []);
        } catch (error) {
            tbody.replaceChildren();
            showMessage(attemptsMessage, error.message || 'Assessment results could not be loaded.');
        }
    }

    function validateBasics() {
        const fields = [
            document.getElementById('quiz-title'),
            document.getElementById('quiz-time-limit')
        ];
        for (const field of fields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }
        }
        return true;
    }

    function collectAssessment() {
        const questions = [];
        for (const [index, card] of Array.from(questionList.querySelectorAll('.builder-question')).entries()) {
            const prompt = card.querySelector('.question-prompt-input').value.trim();
            const points = Number(card.querySelector('.question-points-input').value);
            const options = Array.from(card.querySelectorAll('.builder-option')).map((row) => ({
                option_text: row.querySelector('.option-text-input').value.trim(),
                is_correct: row.querySelector('input[type="radio"]').checked
            }));
            if (!prompt) throw new Error(`Enter a prompt for question ${index + 1}.`);
            if (!Number.isInteger(points) || points < 1 || points > 100) throw new Error(`Question ${index + 1} must be worth 1 to 100 points.`);
            if (options.length < 2 || options.some((option) => !option.option_text)) throw new Error(`Question ${index + 1} needs at least two complete choices.`);
            if (options.filter((option) => option.is_correct).length !== 1) throw new Error(`Select exactly one correct choice for question ${index + 1}.`);
            questions.push({ question_text: prompt, points, options });
        }
        if (!questions.length) throw new Error('Add at least one question before publishing.');
        return questions;
    }

    async function publishAssessment() {
        if (publishInProgress) return;
        clearMessage(builderMessage);
        if (!validateBasics()) return;
        let questions;
        try {
            questions = collectAssessment();
        } catch (error) {
            showMessage(builderMessage, error.message);
            return;
        }

        const timeLimit = Number(document.getElementById('quiz-time-limit').value);
        if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 360) {
            showMessage(builderMessage, 'Set a time limit between 1 and 360 minutes.');
            setBuilderStep(1);
            document.getElementById('quiz-time-limit').focus();
            return;
        }

        publishInProgress = true;
        const publishButton = document.getElementById('publish-quiz');
        publishButton.disabled = true;
        publishButton.textContent = 'Publishing…';
        try {
            const response = await fetch('api/quizzes.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({
                    action: 'create',
                    title: document.getElementById('quiz-title').value.trim(),
                    description: document.getElementById('quiz-description').value.trim(),
                    time_limit: timeLimit,
                    questions
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'The assessment could not be published.');
            showMessage(builderMessage, result.message || 'Assessment published successfully.', 'success');
            document.getElementById('quiz-title').value = '';
            document.getElementById('quiz-description').value = '';
            document.getElementById('quiz-time-limit').value = '20';
            questionList.replaceChildren();
            addQuestion();
            setBuilderStep(1);
            showMessage(builderMessage, result.message || 'Assessment published successfully.', 'success');
            await loadDashboard();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            showMessage(builderMessage, error.message || 'The assessment could not be published.');
        } finally {
            publishInProgress = false;
            publishButton.disabled = false;
            publishButton.innerHTML = 'Publish assessment <span aria-hidden="true">→</span>';
        }
    }

    document.getElementById('continue-builder').addEventListener('click', () => {
        clearMessage(builderMessage);
        if (!validateBasics()) return;
        setBuilderStep(2);
        window.scrollTo({ top: document.getElementById('quiz-builder').offsetTop - 18, behavior: 'smooth' });
    });
    document.getElementById('back-to-basics').addEventListener('click', () => setBuilderStep(1));
    document.getElementById('add-question').addEventListener('click', addQuestion);
    document.getElementById('publish-quiz').addEventListener('click', publishAssessment);
    document.getElementById('refresh-attempts').addEventListener('click', loadDashboard);

    questionList.addEventListener('click', (event) => {
        const addOptionButton = event.target.closest('.add-option');
        if (addOptionButton) {
            const card = addOptionButton.closest('.builder-question');
            appendChoice(card.querySelector('.builder-option-list'), card.dataset.questionKey);
            return;
        }
        const removeOptionButton = event.target.closest('.remove-option');
        if (removeOptionButton) {
            const row = removeOptionButton.closest('.builder-option');
            const list = row.parentElement;
            if (list.querySelectorAll('.builder-option').length <= 2) {
                showMessage(builderMessage, 'Each question must keep at least two choices.');
                return;
            }
            if (row.querySelector('input[type="radio"]').checked) {
                const nextRadio = row.nextElementSibling?.querySelector('input[type="radio"]') || row.previousElementSibling?.querySelector('input[type="radio"]');
                if (nextRadio) nextRadio.checked = true;
            }
            row.remove();
            clearMessage(builderMessage);
            return;
        }
        const removeQuestionButton = event.target.closest('.remove-question');
        if (removeQuestionButton) {
            if (questionList.children.length <= 1) {
                showMessage(builderMessage, 'An assessment must have at least one question.');
                return;
            }
            removeQuestionButton.closest('.builder-question').remove();
            updateQuestionNumbers();
            clearMessage(builderMessage);
        }
    });

    addQuestion();
    loadDashboard();
})();
