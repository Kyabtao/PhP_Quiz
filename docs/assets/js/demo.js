(() => {
    'use strict';

    const STORE_KEY = 'northstar.assessment.demo.v1';
    const SESSION_KEY = 'northstar.assessment.demo.session.v1';
    const ACTIVE_ATTEMPT_KEY = 'northstar.assessment.demo.active-attempt.v1';
    const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
    const DEFAULT_ADMIN_PASSWORD = 'Admin@123';
    const PBKDF2_ITERATIONS = 120000;

    let data = { users: [], quizzes: [], attempts: [] };
    let activeUser = null;
    let registering = false;
    let questionSequence = 0;
    let timerHandle = null;
    let activeAttempt = null;
    let activeQuiz = null;
    let isSubmitting = false;

    const authView = document.getElementById('demo-auth');
    const appView = document.getElementById('demo-app');
    const authForm = document.getElementById('auth-form');
    const authMessage = document.getElementById('auth-message');
    const builderMessage = document.getElementById('builder-message');
    const questionList = document.getElementById('demo-question-list');

    function element(tag, className, text) {
        const item = document.createElement(tag);
        if (className) item.className = className;
        if (text !== undefined) item.textContent = text;
        return item;
    }

    function showMessage(target, text, kind = 'error') {
        target.textContent = text;
        target.className = `alert alert-${kind}`;
    }

    function clearMessage(target) {
        target.textContent = '';
        target.className = 'alert hidden';
    }

    function loadData() {
        const saved = localStorage.getItem(STORE_KEY);
        if (!saved) return { users: [], quizzes: [], attempts: [] };
        const parsed = JSON.parse(saved);
        if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.quizzes) || !Array.isArray(parsed.attempts)) {
            throw new Error('Demo storage is not in the expected format. Use Reset demo data to start over.');
        }
        return parsed;
    }

    function saveData() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(data));
        } catch (error) {
            throw new Error('The browser could not save demo data. Check available storage and privacy settings.');
        }
    }

    function randomId(prefix) {
        const suffix = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        return `${prefix}-${suffix}`;
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function hexToBytes(hex) {
        const result = new Uint8Array(hex.length / 2);
        for (let index = 0; index < result.length; index += 1) {
            result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
        }
        return result;
    }

    async function hashPassword(password, saltHex) {
        if (!window.crypto || !window.crypto.subtle || !window.isSecureContext) {
            throw new Error('Password hashing needs a secure browser context. Open this demo on localhost or over HTTPS.');
        }
        const salt = saltHex ? hexToBytes(saltHex) : window.crypto.getRandomValues(new Uint8Array(16));
        const inputKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const bits = await window.crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        }, inputKey, 256);
        return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
    }

    async function passwordMatches(password, saved) {
        const candidate = await hashPassword(password, saved.salt);
        if (candidate.hash.length !== saved.hash.length) return false;
        let difference = 0;
        for (let index = 0; index < candidate.hash.length; index += 1) {
            difference |= candidate.hash.charCodeAt(index) ^ saved.hash.charCodeAt(index);
        }
        return difference === 0;
    }

    async function initialize() {
        try {
            data = loadData();
            let admin = data.users.find((user) => user.email === DEFAULT_ADMIN_EMAIL);
            if (!admin) {
                const credential = await hashPassword(DEFAULT_ADMIN_PASSWORD);
                admin = {
                    id: 'demo-admin',
                    name: 'Demo Administrator',
                    email: DEFAULT_ADMIN_EMAIL,
                    role: 'admin',
                    credential,
                    createdAt: new Date().toISOString()
                };
                data.users.push(admin);
                saveData();
            }
            restoreSession();
        } catch (error) {
            showMessage(authMessage, error.message || 'The browser demo could not start.');
        }
    }

    function restoreSession() {
        let session = null;
        try {
            session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        } catch (error) {
            sessionStorage.removeItem(SESSION_KEY);
        }
        const user = session && data.users.find((item) => item.id === session.userId);
        if (!user || !['admin', 'student'].includes(user.role)) {
            showAuthentication();
            return;
        }
        activeUser = user;
        showApplication();
    }

    function showAuthentication() {
        clearInterval(timerHandle);
        activeUser = null;
        authView.classList.remove('hidden');
        appView.classList.add('hidden');
        setRegisterMode(false);
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        clearMessage(authMessage);
    }

    function showApplication() {
        authView.classList.add('hidden');
        appView.classList.remove('hidden');
        const chip = document.getElementById('demo-user-chip');
        chip.replaceChildren();
        const avatar = element('span', 'avatar', activeUser.name.slice(0, 1).toUpperCase());
        avatar.setAttribute('aria-hidden', 'true');
        const name = element('span', '', activeUser.name);
        chip.append(avatar, name);
        const isAdmin = activeUser.role === 'admin';
        document.getElementById('admin-view').classList.toggle('hidden', !isAdmin);
        document.getElementById('student-view').classList.toggle('hidden', isAdmin);
        if (isAdmin) {
            renderAdminDashboard();
            if (!questionList.children.length) addQuestion();
        } else {
            renderStudentCatalog();
            restoreAttempt();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setRegisterMode(value) {
        registering = value;
        document.getElementById('register-name-wrap').classList.toggle('hidden', !value);
        document.getElementById('register-name').required = value;
        document.getElementById('auth-password').autocomplete = value ? 'new-password' : 'current-password';
        document.getElementById('auth-eyebrow').textContent = value ? 'Create a demo account' : 'Browser-only demo';
        document.getElementById('demo-auth-title').textContent = value ? 'Create a student account' : 'Sign in to the demo';
        document.getElementById('auth-description').textContent = value
            ? 'The new student account will be saved in this browser.'
            : 'Use the sample administrator or create a student account.';
        document.getElementById('auth-submit').textContent = value ? 'Create student account' : 'Sign in';
        document.getElementById('switch-prompt').textContent = value ? 'Already have a demo account?' : 'New to the demo?';
        document.getElementById('toggle-register').textContent = value ? 'Sign in instead' : 'Create a student account';
        clearMessage(authMessage);
    }

    function createSession(user) {
        activeUser = user;
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
        } catch (error) {
            throw new Error('The browser could not create a demo session. Check session storage settings.');
        }
        showApplication();
    }

    async function handleAuthentication(event) {
        event.preventDefault();
        clearMessage(authMessage);
        const email = document.getElementById('auth-email').value.trim().toLowerCase();
        const password = document.getElementById('auth-password').value;
        if (!authForm.reportValidity()) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
            showMessage(authMessage, 'Enter a valid email address.');
            return;
        }

        const submit = document.getElementById('auth-submit');
        submit.disabled = true;
        submit.textContent = registering ? 'Creating account…' : 'Signing in…';
        try {
            if (registering) {
                const name = document.getElementById('register-name').value.trim();
                if (!name || name.length > 120) throw new Error('Enter a name between 1 and 120 characters.');
                if (password.length < 8 || password.length > 256) throw new Error('Use a demo password between 8 and 256 characters.');
                if (data.users.some((user) => user.email === email)) throw new Error('An account with that email already exists in this browser.');
                const credential = await hashPassword(password);
                const user = { id: randomId('student'), name, email, role: 'student', credential, createdAt: new Date().toISOString() };
                data.users.push(user);
                saveData();
                createSession(user);
            } else {
                const user = data.users.find((item) => item.email === email);
                if (!user || !(await passwordMatches(password, user.credential))) {
                    throw new Error('The email or password you entered is incorrect.');
                }
                createSession(user);
            }
        } catch (error) {
            showMessage(authMessage, error.message || 'Authentication failed.');
        } finally {
            submit.disabled = false;
            submit.textContent = registering ? 'Create student account' : 'Sign in';
        }
    }

    function logout() {
        clearInterval(timerHandle);
        try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* session storage may be disabled */ }
        activeUser = null;
        showAuthentication();
    }

    function setBuilderStep(step) {
        const basics = step === 1;
        document.getElementById('demo-basics-step').classList.toggle('hidden', !basics);
        document.getElementById('demo-questions-step').classList.toggle('hidden', basics);
        document.getElementById('demo-step-one').classList.toggle('is-current', basics);
        document.getElementById('demo-step-two').classList.toggle('is-current', !basics);
        clearMessage(builderMessage);
    }

    function appendChoice(list, key, selected = false) {
        if (list.querySelectorAll('.builder-option').length >= 10) {
            showMessage(builderMessage, 'A question can have no more than 10 choices.');
            return;
        }
        const row = element('div', 'builder-option');
        const correctLabel = element('label', 'correct-choice-label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `demo-correct-${key}`;
        radio.checked = selected;
        radio.setAttribute('aria-label', 'Mark this choice as correct');
        correctLabel.append(radio, element('span', 'correct-choice-mark'), element('span', 'sr-only', 'Correct answer'));
        const text = document.createElement('input');
        text.type = 'text';
        text.className = 'text-input option-text-input';
        text.maxLength = 1000;
        text.required = true;
        text.placeholder = 'Enter a choice';
        text.setAttribute('aria-label', 'Choice text');
        const remove = element('button', 'icon-button remove-option', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove choice');
        row.append(correctLabel, text, remove);
        list.append(row);
    }

    function addQuestion() {
        if (questionList.children.length >= 100) {
            showMessage(builderMessage, 'A demo assessment can have no more than 100 questions.');
            return;
        }
        questionSequence += 1;
        const key = `demo-q${questionSequence}`;
        const card = element('article', 'builder-question card');
        card.dataset.questionKey = key;
        const header = element('div', 'builder-question-header');
        const heading = element('div', 'builder-question-heading');
        heading.append(element('span', 'question-number', String(questionList.children.length + 1).padStart(2, '0')));
        heading.append(element('strong', '', 'Question'));
        const removeQuestion = element('button', 'button button-quiet button-small remove-question', 'Remove question');
        removeQuestion.type = 'button';
        header.append(heading, removeQuestion);

        const fields = element('div', 'builder-question-fields');
        const promptField = element('label', 'form-field prompt-field');
        promptField.append(element('span', 'field-label', 'Question prompt'));
        const prompt = document.createElement('textarea');
        prompt.className = 'text-input textarea question-prompt-input';
        prompt.maxLength = 4000;
        prompt.rows = 2;
        prompt.required = true;
        prompt.placeholder = 'Write a clear question…';
        promptField.append(prompt);
        const pointsField = element('label', 'form-field points-field');
        pointsField.append(element('span', 'field-label', 'Points'));
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

        const choicesHeading = element('div', 'choices-heading');
        choicesHeading.append(element('span', 'field-label', 'Answer choices'));
        choicesHeading.append(element('span', 'subtle', 'Select the circle beside the correct answer'));
        const list = element('div', 'builder-option-list');
        appendChoice(list, key, true);
        appendChoice(list, key, false);
        const addOption = element('button', 'button button-text add-option', '＋ Add a choice');
        addOption.type = 'button';
        card.append(header, fields, choicesHeading, list, addOption);
        questionList.append(card);
        updateQuestionNumbers();
    }

    function updateQuestionNumbers() {
        questionList.querySelectorAll('.builder-question').forEach((card, index) => {
            card.querySelector('.builder-question-heading .question-number').textContent = String(index + 1).padStart(2, '0');
        });
    }

    function collectQuestions() {
        const questions = [];
        for (const [index, card] of Array.from(questionList.querySelectorAll('.builder-question')).entries()) {
            const questionText = card.querySelector('.question-prompt-input').value.trim();
            const points = Number(card.querySelector('.question-points-input').value);
            const options = Array.from(card.querySelectorAll('.builder-option')).map((row) => ({
                text: row.querySelector('.option-text-input').value.trim(),
                correct: row.querySelector('input[type="radio"]').checked,
                id: randomId('option')
            }));
            if (!questionText) throw new Error(`Enter a prompt for question ${index + 1}.`);
            if (!Number.isInteger(points) || points < 1 || points > 100) throw new Error(`Question ${index + 1} must be worth 1 to 100 points.`);
            if (options.length < 2 || options.some((option) => !option.text)) throw new Error(`Question ${index + 1} needs at least two complete choices.`);
            if (options.filter((option) => option.correct).length !== 1) throw new Error(`Select exactly one correct choice for question ${index + 1}.`);
            questions.push({ id: randomId('question'), text: questionText, points, options });
        }
        if (!questions.length) throw new Error('Add at least one question before publishing.');
        return questions;
    }

    function renderAdminDashboard() {
        const students = data.users.filter((user) => user.role === 'student');
        document.getElementById('demo-stat-students').textContent = String(students.length);
        document.getElementById('demo-stat-quizzes').textContent = String(data.quizzes.length);
        document.getElementById('demo-stat-attempts').textContent = String(data.attempts.length);
        renderAttempts();
    }

    function renderAttempts() {
        const body = document.getElementById('demo-attempts-body');
        body.replaceChildren();
        const attempts = [...data.attempts].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 100);
        if (!attempts.length) {
            const row = element('tr');
            const cell = element('td', 'table-empty', 'No demo submissions yet. Create a student account, take a quiz, and results will appear here.');
            cell.colSpan = 5;
            row.append(cell);
            body.append(row);
            return;
        }
        attempts.forEach((attempt) => {
            const row = element('tr');
            const studentCell = element('td', 'student-cell');
            studentCell.append(element('strong', '', attempt.studentName), element('span', 'table-secondary', attempt.studentEmail));
            const quizCell = element('td', 'assessment-cell', attempt.quizTitle);
            const scoreCell = element('td', 'score-cell', `${attempt.score} / ${attempt.totalScore}`);
            const percentage = Number(attempt.percentage);
            const resultCell = element('td');
            resultCell.append(element('span', `badge ${percentage >= 80 ? 'badge-green' : percentage >= 50 ? 'badge-amber' : 'badge-slate'}`, `${percentage.toFixed(2).replace(/\.00$/, '')}%`));
            const date = new Date(attempt.completedAt);
            const dateCell = element('td', 'date-cell', Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date));
            row.append(studentCell, quizCell, scoreCell, resultCell, dateCell);
            body.append(row);
        });
    }

    function publishQuiz() {
        clearMessage(builderMessage);
        const title = document.getElementById('demo-title').value.trim();
        const description = document.getElementById('demo-description').value.trim();
        const timeLimit = Number(document.getElementById('demo-time-limit').value);
        if (!title || title.length > 180) {
            setBuilderStep(1);
            showMessage(builderMessage, 'Enter an assessment title between 1 and 180 characters.');
            document.getElementById('demo-title').focus();
            return;
        }
        if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 360) {
            setBuilderStep(1);
            showMessage(builderMessage, 'Set a time limit between 1 and 360 minutes.');
            document.getElementById('demo-time-limit').focus();
            return;
        }
        let questions;
        try {
            questions = collectQuestions();
        } catch (error) {
            showMessage(builderMessage, error.message);
            return;
        }
        const quiz = {
            id: randomId('quiz'), title, description, timeLimit,
            createdBy: activeUser.id, createdAt: new Date().toISOString(), questions
        };
        data.quizzes.unshift(quiz);
        try {
            saveData();
        } catch (error) {
            data.quizzes.shift();
            showMessage(builderMessage, error.message);
            return;
        }
        document.getElementById('demo-title').value = '';
        document.getElementById('demo-description').value = '';
        document.getElementById('demo-time-limit').value = '5';
        questionList.replaceChildren();
        addQuestion();
        setBuilderStep(1);
        showMessage(builderMessage, 'Assessment saved to this browser and published for demo students.', 'success');
        renderAdminDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderStudentHistory() {
        const body = document.getElementById('demo-student-history-body');
        body.replaceChildren();
        const attempts = data.attempts
            .filter((attempt) => attempt.userId === activeUser.id)
            .sort((first, second) => new Date(second.completedAt) - new Date(first.completedAt))
            .slice(0, 25);
        if (!attempts.length) {
            const row = element('tr');
            const cell = element('td', 'table-empty', 'You have not completed a demo assessment yet. Your results will appear here.');
            cell.colSpan = 4;
            row.append(cell);
            body.append(row);
            return;
        }
        attempts.forEach((attempt) => {
            const row = element('tr');
            row.append(element('td', 'assessment-cell', attempt.quizTitle));
            row.append(element('td', 'score-cell', `${attempt.score} / ${attempt.totalScore}`));
            const result = element('td');
            const percentage = Number(attempt.percentage);
            result.append(element('span', `badge ${percentage >= 80 ? 'badge-green' : percentage >= 50 ? 'badge-amber' : 'badge-slate'}`, `${percentage.toFixed(2).replace(/\.00$/, '')}%`));
            const date = new Date(attempt.completedAt);
            row.append(result, element('td', 'date-cell', Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)));
            body.append(row);
        });
    }

    function renderStudentCatalog() {
        const grid = document.getElementById('demo-quiz-grid');
        grid.replaceChildren();
        if (!data.quizzes.length) {
            const empty = element('div', 'empty-state card');
            empty.append(element('span', 'empty-mark', '✦'), element('h2', '', 'No demo assessments yet'), element('p', 'subtle', 'Sign out and use the sample administrator to create a quiz in this browser.'));
            grid.append(empty);
            renderStudentHistory();
            return;
        }
        const savedAttempt = readActiveAttempt();
        data.quizzes.forEach((quiz) => {
            const totalPoints = quiz.questions.reduce((sum, question) => sum + Number(question.points), 0);
            const card = element('article', 'quiz-card card');
            const icon = element('div', 'quiz-card-icon', 'Q');
            icon.setAttribute('aria-hidden', 'true');
            const content = element('div', 'quiz-card-content');
            content.append(element('h2', 'quiz-card-title', quiz.title));
            content.append(element('p', 'quiz-card-description', quiz.description || 'No description provided.'));
            const metadata = element('div', 'quiz-metadata');
            metadata.append(
                element('span', 'metadata-item', `${quiz.timeLimit} min`),
                element('span', 'metadata-item', `${quiz.questions.length} ${quiz.questions.length === 1 ? 'question' : 'questions'}`),
                element('span', 'metadata-item', `${totalPoints} pts`)
            );
            content.append(metadata);
            const action = element('div', 'quiz-card-action');
            const isResume = savedAttempt && savedAttempt.quizId === quiz.id;
            const button = element('button', 'button button-secondary', isResume ? 'Resume assessment' : savedAttempt ? 'Another assessment is in progress' : 'Start assessment');
            button.type = 'button';
            button.disabled = Boolean(savedAttempt && !isResume);
            if (!button.disabled) button.append(element('span', 'button-arrow', '→'));
            button.addEventListener('click', () => startQuiz(quiz.id));
            action.append(button);
            card.append(icon, content, action);
            grid.append(card);
        });
        renderStudentHistory();
    }

    function readActiveAttempt() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(ACTIVE_ATTEMPT_KEY) || 'null');
            if (!saved || saved.userId !== activeUser.id) return null;
            return saved;
        } catch (error) {
            sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
            return null;
        }
    }

    function saveActiveAttempt() {
        try {
            sessionStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify(activeAttempt));
        } catch (error) {
            showMessage(document.getElementById('student-view').querySelector('.alert') || authMessage, 'This browser could not save your in-progress demo answers.');
        }
    }

    function restoreAttempt() {
        const attempt = readActiveAttempt();
        const quiz = attempt && data.quizzes.find((item) => item.id === attempt.quizId);
        if (!attempt || !quiz) {
            sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
            return;
        }
        activeAttempt = attempt;
        activeQuiz = quiz;
        renderRunner();
    }

    function startQuiz(quizId) {
        const quiz = data.quizzes.find((item) => item.id === quizId);
        if (!quiz) return;
        activeQuiz = quiz;
        const savedAttempt = readActiveAttempt();
        activeAttempt = savedAttempt && savedAttempt.quizId === quizId
            ? savedAttempt
            : { quizId, userId: activeUser.id, startedAt: Date.now(), answers: {} };
        saveActiveAttempt();
        renderRunner();
    }

    function renderRunner() {
        clearInterval(timerHandle);
        document.getElementById('demo-catalog-view').classList.add('hidden');
        document.getElementById('demo-result-view').classList.add('hidden');
        document.getElementById('demo-runner-view').classList.remove('hidden');
        document.getElementById('demo-runner-title').textContent = activeQuiz.title;
        document.getElementById('demo-runner-description').textContent = activeQuiz.description || 'Read each question carefully and select one answer.';
        const container = document.getElementById('demo-question-render');
        container.replaceChildren();
        activeQuiz.questions.forEach((question, index) => container.append(renderQuestion(question, index)));
        updateProgress();
        isSubmitting = false;
        document.getElementById('demo-submit').disabled = false;
        document.getElementById('demo-submit').textContent = 'Submit assessment →';
        updateTimer();
        timerHandle = window.setInterval(updateTimer, 1000);
    }

    function renderQuestion(question, index) {
        const fieldset = element('fieldset', 'question-card card');
        const legend = element('legend', 'question-legend');
        legend.append(element('span', 'question-number', String(index + 1).padStart(2, '0')));
        legend.append(element('span', 'question-text', question.text));
        legend.append(element('span', 'question-points', `${question.points} ${question.points === 1 ? 'point' : 'points'}`));
        fieldset.append(legend);
        const choices = element('div', 'choice-list');
        question.options.forEach((option, optionIndex) => {
            const label = element('label', 'choice-option');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `demo-answer-${question.id}`;
            radio.checked = activeAttempt.answers[question.id] === option.id;
            radio.setAttribute('aria-label', option.text);
            radio.addEventListener('change', () => {
                activeAttempt.answers[question.id] = option.id;
                saveActiveAttempt();
                updateProgress();
            });
            label.append(radio, element('span', 'radio-mark'), element('span', 'choice-letter', String.fromCharCode(65 + optionIndex)), element('span', 'choice-text', option.text));
            choices.append(label);
        });
        fieldset.append(choices);
        return fieldset;
    }

    function updateProgress() {
        if (!activeQuiz || !activeAttempt) return;
        const total = activeQuiz.questions.length;
        const answered = activeQuiz.questions.filter((question) => Boolean(activeAttempt.answers[question.id])).length;
        document.getElementById('demo-progress-count').textContent = `${answered} / ${total}`;
        document.getElementById('demo-progress').value = total ? answered / total : 0;
    }

    function updateTimer() {
        if (!activeQuiz || !activeAttempt) return;
        const endAt = activeAttempt.startedAt + (activeQuiz.timeLimit * 60 * 1000);
        const seconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        document.getElementById('demo-timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        document.getElementById('demo-timer-banner').classList.toggle('timer-warning', seconds <= 60);
        if (seconds === 0 && !isSubmitting) submitAssessment(true);
    }

    function submitAssessment(automatic = false) {
        if (!activeQuiz || !activeAttempt || isSubmitting) return;
        if (!automatic && !window.confirm('Submit this demo assessment now?')) return;
        isSubmitting = true;
        clearInterval(timerHandle);
        const submit = document.getElementById('demo-submit');
        submit.disabled = true;
        submit.textContent = automatic ? 'Time is up · submitting…' : 'Submitting…';
        let score = 0;
        let totalScore = 0;
        activeQuiz.questions.forEach((question) => {
            totalScore += Number(question.points);
            const selected = activeAttempt.answers[question.id];
            const correct = question.options.find((option) => option.correct);
            if (correct && selected === correct.id) score += Number(question.points);
        });
        const percentage = totalScore ? Number(((score / totalScore) * 100).toFixed(2)) : 0;
        const attempt = {
            id: randomId('attempt'), userId: activeUser.id, studentName: activeUser.name,
            studentEmail: activeUser.email, quizId: activeQuiz.id, quizTitle: activeQuiz.title,
            score, totalScore, percentage, completedAt: new Date().toISOString()
        };
        data.attempts.push(attempt);
        try {
            saveData();
            sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
            showResult(attempt);
        } catch (error) {
            data.attempts.pop();
            isSubmitting = false;
            submit.disabled = false;
            submit.textContent = 'Try submission again →';
            window.alert(error.message || 'The demo result could not be saved.');
        }
    }

    function showResult(attempt) {
        clearInterval(timerHandle);
        renderStudentHistory();
        activeQuiz = null;
        activeAttempt = null;
        document.getElementById('demo-runner-view').classList.add('hidden');
        document.getElementById('demo-catalog-view').classList.add('hidden');
        document.getElementById('demo-result-view').classList.remove('hidden');
        document.getElementById('demo-result-quiz').textContent = attempt.quizTitle;
        document.getElementById('demo-result-percent').textContent = `${Number(attempt.percentage).toFixed(2).replace(/\.00$/, '')}%`;
        document.getElementById('demo-result-marks').textContent = `${attempt.score} of ${attempt.totalScore} points`;
        document.getElementById('demo-result-meter').value = Math.max(0, Math.min(100, Number(attempt.percentage)));
        const score = Number(attempt.percentage);
        document.getElementById('demo-result-feedback').textContent = score >= 80
            ? 'Excellent work. You demonstrated a strong understanding of this material.'
            : score >= 50
                ? 'Good effort. Review the topics you found challenging and keep building on your progress.'
                : 'Your result is a useful starting point. Revisit the material and try again when you are ready.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function returnToCatalog() {
        clearInterval(timerHandle);
        activeQuiz = null;
        activeAttempt = null;
        document.getElementById('demo-result-view').classList.add('hidden');
        document.getElementById('demo-runner-view').classList.add('hidden');
        document.getElementById('demo-catalog-view').classList.remove('hidden');
        renderStudentCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetDemo() {
        if (!window.confirm('Clear all demo accounts, assessments, results, and the current session from this browser?')) return;
        localStorage.removeItem(STORE_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
        data = { users: [], quizzes: [], attempts: [] };
        questionList.replaceChildren();
        initialize();
    }

    document.getElementById('toggle-register').addEventListener('click', () => setRegisterMode(!registering));
    authForm.addEventListener('submit', handleAuthentication);
    document.getElementById('demo-logout').addEventListener('click', logout);
    document.getElementById('reset-demo').addEventListener('click', resetDemo);
    document.getElementById('demo-continue').addEventListener('click', () => {
        clearMessage(builderMessage);
        const title = document.getElementById('demo-title');
        const timeLimit = document.getElementById('demo-time-limit');
        if (!title.checkValidity()) { title.reportValidity(); return; }
        if (!timeLimit.checkValidity()) { timeLimit.reportValidity(); return; }
        setBuilderStep(2);
    });
    document.getElementById('demo-back').addEventListener('click', () => setBuilderStep(1));
    document.getElementById('demo-add-question').addEventListener('click', addQuestion);
    document.getElementById('demo-publish').addEventListener('click', publishQuiz);
    document.getElementById('demo-submit').addEventListener('click', () => submitAssessment(false));
    document.getElementById('demo-back-catalog').addEventListener('click', () => {
        if (!window.confirm('Leave this assessment? Your demo timer will continue if you return.')) return;
        clearInterval(timerHandle);
        activeQuiz = null;
        activeAttempt = null;
        document.getElementById('demo-runner-view').classList.add('hidden');
        document.getElementById('demo-catalog-view').classList.remove('hidden');
        renderStudentCatalog();
    });
    document.getElementById('demo-return-catalog').addEventListener('click', returnToCatalog);

    questionList.addEventListener('click', (event) => {
        const addOption = event.target.closest('.add-option');
        if (addOption) {
            const card = addOption.closest('.builder-question');
            appendChoice(card.querySelector('.builder-option-list'), card.dataset.questionKey);
            return;
        }
        const removeOption = event.target.closest('.remove-option');
        if (removeOption) {
            const row = removeOption.closest('.builder-option');
            const list = row.parentElement;
            if (list.querySelectorAll('.builder-option').length <= 2) {
                showMessage(builderMessage, 'Each question must keep at least two choices.');
                return;
            }
            if (row.querySelector('input[type="radio"]').checked) {
                const next = row.nextElementSibling?.querySelector('input[type="radio"]') || row.previousElementSibling?.querySelector('input[type="radio"]');
                if (next) next.checked = true;
            }
            row.remove();
            clearMessage(builderMessage);
            return;
        }
        const removeQuestion = event.target.closest('.remove-question');
        if (removeQuestion) {
            if (questionList.children.length <= 1) {
                showMessage(builderMessage, 'A demo assessment must have at least one question.');
                return;
            }
            removeQuestion.closest('.builder-question').remove();
            updateQuestionNumbers();
            clearMessage(builderMessage);
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key !== STORE_KEY) return;
        try {
            data = loadData();
            if (!activeUser) return;
            const refreshedUser = data.users.find((user) => user.id === activeUser.id);
            if (!refreshedUser) {
                sessionStorage.removeItem(SESSION_KEY);
                activeUser = null;
                showAuthentication();
                initialize();
                return;
            }
            activeUser = refreshedUser;
            if (activeUser.role === 'admin') {
                renderAdminDashboard();
            } else {
                renderStudentCatalog();
                renderStudentHistory();
            }
        } catch (error) {
            window.alert(error.message || 'Could not refresh the browser demo data.');
        }
    });

    initialize();
})();
