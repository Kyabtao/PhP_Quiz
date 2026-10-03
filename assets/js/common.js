(() => {
    'use strict';

    document.querySelectorAll('[data-logout]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
                const response = await fetch('api/auth.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                    body: JSON.stringify({ action: 'logout' })
                });
                if (!response.ok) throw new Error('Sign-out request failed.');
                window.location.assign('login.php');
            } catch (error) {
                button.disabled = false;
                window.alert('Unable to sign out right now. Check your connection and try again.');
            }
        });
    });
})();
