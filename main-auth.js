import { signInWithEmail, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const modal = document.getElementById('login-modal');
    const closeModal = document.querySelector('.close-modal');
    const loginForm = document.getElementById('email-login-form');

    // Expose a safe helper so inline onclick can open the modal (fallback)
    if (modal) {
        window.showLoginModal = () => { modal.style.display = 'block'; };
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'block';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            signInWithEmail(email, password);
        });
    }
});
