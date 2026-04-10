import { fetchApi } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');

    // Redirect if already logged in
    const token = localStorage.getItem('tmx_token');
    const user = localStorage.getItem('tmx_user');
    if (token && user) {
        redirectBasedOnRole(JSON.parse(user).rol);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('login-btn');
            
            const originalText = btn.innerText;
            btn.innerText = 'Autenticando...';
            btn.disabled = true;

            try {
                const response = await fetchApi('/users/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });

                // Store session
                localStorage.setItem('tmx_token', response.token);
                localStorage.setItem('tmx_user', JSON.stringify(response.user));

                // Redirect based on role
                redirectBasedOnRole(response.user.rol);
            } catch (error) {
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});

function redirectBasedOnRole(role) {
    switch (role) {
        case 'supervisor':
            window.location.href = 'pages/supervisor.html';
            break;
        case 'ejecutivo':
            window.location.href = 'pages/ejecutivo.html';
            break;
        case 'tecnico':
            window.location.href = 'pages/tecnico.html';
            break;
        default:
            console.error('Unknown role');
            localStorage.clear();
    }
}
