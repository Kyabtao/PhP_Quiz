(() => {
    'use strict';

    const form = document.getElementById('login-form');
    const message = document.getElementById('login-message');
    const button = document.getElementById('login-submit');
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');

    function showMessage(text, type = 'error') {
        message.textContent = text;
        message.className = `alert alert-${type}`;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.textContent = '';
        message.className = 'alert hidden';

        if (!form.reportValidity()) return;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const label = button.querySelector('.button-label');
        button.disabled = true;
        label.textContent = 'Signing in…';
        button.classList.add('is-loading');

        try {
            const response = await fetch('api/auth.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfMeta.content
                },
                body: JSON.stringify({ action: 'login', email, password })
            });
            const result = await response.json();
            if (!response.ok) {
                showMessage(result.error || 'We could not sign you in. Please try again.');
                return;
            }
            csrfMeta.content = result.csrf_token;
            window.location.assign(result.user.role === 'admin' ? 'admin.php' : 'index.php');
        } catch (error) {
            showMessage('Unable to reach the local server. Check your connection and try again.');
        } finally {
            button.disabled = false;
            label.textContent = 'Sign in';
            button.classList.remove('is-loading');
        }
    });
})();
