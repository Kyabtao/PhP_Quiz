(() => {
    'use strict';

    const catalogView = document.getElementById('catalog-view');
    const runnerView = document.getElementById('runner-view');
    const resultView = document.getElementById('result-view');
    const grid = document.getElementById('quiz-grid');
    const catalogMessage = document.getElementById('catalog-message');
    const runnerMessage = document.getElementById('runner-message');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    const form = document.getElementById('assessment-form');
    const submitButton = document.getElementById('submit-assessment');
    const timerValue = document.getElementById('timer-value');
    const timerBanner = document.getElementById('timer-banner');

    let currentQuiz = null;
    let answers = Object.create(null);
    let deadline = 0;
    let timerHandle = null;
    let submissionInProgress = false;
    let currentCacheKey = null;
    const userId = document.querySelector('meta[name="user-id"]').content;

    function saveAnswers() {
        if (!currentCacheKey) return;
        try {
            sessionStorage.setItem(currentCacheKey, JSON.stringify(answers));
        } catch (error) {
            // The assessment still works when browser storage is unavailable.
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function showAlert(node, text, kind = 'error') {
        node.textContent = text;
        node.className = `alert alert-${kind}`;
    }

    function hideAlert(node) {
        node.textContent = '';
        node.className = 'alert hidden';
    }

    async function getJson(url) {
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
        return body;
    }

    function renderCatalog(quizzes) {
        grid.replaceChildren();
        if (!quizzes.length) {
            const empty = element('div', 'empty-state card');
            empty.append(element('span', 'empty-mark', '✦'));
            empty.append(element('h2', '', 'Nothing to take just yet'));
            empty.append(element('p', 'subtle', 'New assessments will appear here when they are published.'));
            grid.append(empty);
            return;
        }

        quizzes.forEach((quiz) => {
            const card = element('article', 'quiz-card card');
            const icon = element('div', 'quiz-card-icon', 'Q');
            icon.setAttribute('aria-hidden', 'true');
            const content = element('div', 'quiz-card-content');
            const title = element('h2', 'quiz-card-title', quiz.title);
            const description = element('p', 'quiz-card-description', quiz.description || 'No description provided.');
            const metadata = element('div', 'quiz-metadata');
            metadata.append(
                element('span', 'metadata-item', `${Number(quiz.time_limit)} min`),
                element('span', 'metadata-item', `${Number(quiz.question_count)} ${Number(quiz.question_count) === 1 ? 'question' : 'questions'}`),
                element('span', 'metadata-item', `${Number(quiz.total_points)} pts`)
            );
            content.append(title, description, metadata);
            const action = element('div', 'quiz-card-action');
            const button = element('button', 'button button-secondary', 'View assessment');
            button.type = 'button';
            button.addEventListener('click', () => startQuiz(Number(quiz.id)));
            button.append(element('span', 'button-arrow', '→'));
            action.append(button);
            card.append(icon, content, action);
            grid.append(card);
        });
    }

    async function loadCatalog() {
        grid.replaceChildren();
        const loading = element('div', 'loading-card card');
        loading.append(element('span', 'spinner'), element('span', '', 'Loading assessments…'));
        grid.append(loading);
        try {
            const data = await getJson('api/quizzes.php');
            hideAlert(catalogMessage);
            renderCatalog(data.quizzes || []);
        } catch (error) {
            grid.replaceChildren();
            showAlert(catalogMessage, error.message || 'Assessments could not be loaded.');
        }
    }

    function renderQuestion(question, index) {
        const card = element('fieldset', 'question-card card');
        const legend = element('legend', 'question-legend');
        const number = element('span', 'question-number', String(index + 1).padStart(2, '0'));
        const text = element('span', 'question-text', question.question_text);
        const points = element('span', 'question-points', `${question.points} ${Number(question.points) === 1 ? 'point' : 'points'}`);
        legend.append(number, text, points);
        card.append(legend);

        const choices = element('div', 'choice-list');
        (question.options || []).forEach((option, optionIndex) => {
            const label = element('label', 'choice-option');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `question-${question.id}`;
            radio.value = String(option.id);
            radio.setAttribute('aria-label', option.option_text);
            radio.checked = answers[String(question.id)] === Number(option.id);
            radio.addEventListener('change', () => {
                answers[String(question.id)] = Number(option.id);
                saveAnswers();
                updateProgress();
            });
            const custom = element('span', 'radio-mark');
            const choiceLetter = element('span', 'choice-letter', String.fromCharCode(65 + optionIndex));
            const choiceText = element('span', 'choice-text', option.option_text);
            label.append(radio, custom, choiceLetter, choiceText);
            choices.append(label);
        });
        card.append(choices);
        return card;
    }

    async function startQuiz(id) {
        hideAlert(catalogMessage);
        const cards = grid.querySelectorAll('button');
        cards.forEach((button) => { button.disabled = true; });
        try {
            const data = await getJson(`api/quizzes.php?id=${encodeURIComponent(id)}`);
            const startResponse = await fetch('api/quizzes.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ action: 'start', quiz_id: id })
            });
            const timer = await startResponse.json();
            if (!startResponse.ok) throw new Error(timer.error || 'The assessment could not be started.');
            currentQuiz = Object.assign(data.quiz, timer);
            currentCacheKey = `northstar:${userId}:quiz:${currentQuiz.id}`;
            answers = Object.create(null);
            let savedAnswers = {};
            try {
                savedAnswers = JSON.parse(sessionStorage.getItem(currentCacheKey) || '{}');
            } catch (error) {
                savedAnswers = {};
            }
            currentQuiz.questions.forEach((question) => {
                const savedOption = Number(savedAnswers[String(question.id)]);
                const isValidSavedOption = (question.options || []).some((option) => Number(option.id) === savedOption);
                answers[String(question.id)] = isValidSavedOption ? savedOption : null;
            });
            document.getElementById('runner-title').textContent = currentQuiz.title;
            document.getElementById('runner-description').textContent = currentQuiz.description || 'Take your time and read each question carefully.';
            form.replaceChildren();
            currentQuiz.questions.forEach((question, index) => form.append(renderQuestion(question, index)));
            const remaining = Math.max(0, Number(currentQuiz.expires_at) - Number(currentQuiz.server_now));
            deadline = performance.now() + (remaining * 1000);
            submissionInProgress = false;
            hideAlert(runnerMessage);
            catalogView.classList.add('hidden');
            resultView.classList.add('hidden');
            runnerView.classList.remove('hidden');
            updateProgress();
            updateTimer();
            clearInterval(timerHandle);
timerHandle = window.setInterval(updateTimer, 1000);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            showAlert(catalogMessage, error.message || 'This assessment could not be opened.');
        } finally {
            cards.forEach((button) => { button.disabled = false; });
        }
    }

    function updateProgress() {
        if (!currentQuiz) return;
        const total = currentQuiz.questions.length;
        const answered = Object.values(answers).filter((value) => value !== null).length;
        document.getElementById('progress-count').textContent = `${answered} / ${total}`;
        document.getElementById('progress-fill').value = total ? answered / total : 0;
    }

    function updateTimer() {
        if (!currentQuiz) return;
        const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
        const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secondsText = String(seconds % 60).padStart(2, '0');
        timerValue.textContent = `${minutesText}:${secondsText}`;
        timerBanner.classList.toggle('timer-warning', seconds <= 60);
        if (seconds === 0 && !submissionInProgress) {
            submitAssessment(true);
        }
    }

    async function submitAssessment(automatic = false) {
        if (!currentQuiz || submissionInProgress) return;
        if (!automatic && !window.confirm('Submit this assessment now? You will not be able to change your answers afterward.')) return;

        submissionInProgress = true;
        clearInterval(timerHandle);
        submitButton.disabled = true;
        submitButton.textContent = automatic ? 'Time is up · submitting…' : 'Submitting…';
        hideAlert(runnerMessage);
        const submittedAnswers = {};
        Object.entries(answers).forEach(([questionId, optionId]) => {
            if (optionId !== null) submittedAnswers[questionId] = optionId;
        });

        try {
            const response = await fetch('api/submit.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ quiz_id: currentQuiz.id, answers: submittedAnswers })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Your assessment could not be submitted.');
            showResult(result);
        } catch (error) {
            showAlert(runnerMessage, error.message || 'Your assessment could not be submitted. Please check your connection.');
            submissionInProgress = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Try submission again →';
            if (performance.now() < deadline) timerHandle = window.setInterval(updateTimer, 1000);
        }
    }

    function showResult(result) {
        if (currentCacheKey) {
            try { sessionStorage.removeItem(currentCacheKey); } catch (error) { /* storage is optional */ }
        }
        currentCacheKey = null;
        currentQuiz = null;
        clearInterval(timerHandle);
        runnerView.classList.add('hidden');
        resultView.classList.remove('hidden');
        document.getElementById('result-quiz-title').textContent = result.quiz_title;
        document.getElementById('result-percentage').textContent = `${Number(result.percentage).toFixed(2).replace(/\.00$/, '')}%`;
        document.getElementById('result-marks').textContent = `${result.score} of ${result.total_score} points`;
        document.getElementById('result-meter-fill').value = Math.max(0, Math.min(100, Number(result.percentage)));
        const pct = Number(result.percentage);
        document.getElementById('result-message').textContent = pct >= 80
            ? 'Excellent work. You demonstrated a strong understanding of this material.'
            : pct >= 50
                ? 'Good effort. Review the topics you found challenging and keep building on your progress.'
                : 'Your result is a useful starting point. Revisit the material and try again when you are ready.';
        submitButton.disabled = false;
        submitButton.textContent = 'Submit assessment →';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function backToCatalog() {
        if (currentQuiz && !window.confirm('Leave this assessment? Your timer will continue if you return.')) return;
        clearInterval(timerHandle);
        currentQuiz = null;
        runnerView.classList.add('hidden');
        resultView.classList.add('hidden');
        catalogView.classList.remove('hidden');
        loadCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('back-to-catalog').addEventListener('click', backToCatalog);
    document.getElementById('return-to-library').addEventListener('click', backToCatalog);
    submitButton.addEventListener('click', () => submitAssessment(false));
    loadCatalog();
})();
