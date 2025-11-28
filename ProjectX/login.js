/* login.js — полностью исправленный и рабочий
   - Błąd 30: Hasła są haszowane (passHash)
   - Błąd 31: Dodana walidacja długości (username/password)
   - Błąd 32: Dodana sanitacja nazwy użytkownika (sanitizeUsername)
   - Błąd 32: Zmieniono location.href na window.location.replace
   - Błąd 25: Użycie showToast() zamiast alert()
*/

'use strict';

/* ============================================
   HELPERS
   ============================================ */

/**
 * Wyświetla komunikat toast, zastępując alert().
 */
function showToast(message, timeout = 3000) {
    const t = document.createElement('div');
    t.className = 'toast-notice';
    t.setAttribute('role', 'status');
    t.textContent = message;
    document.body.appendChild(t);

    setTimeout(() => t.classList.add('hide'), timeout - 200);
    setTimeout(() => t.remove(), timeout);
}

/**
 * Błąd 32: Sanitacja nazwy użytkownika.
 * Usuwa znaki inne niż alfanumeryczne i podkreślenie. Ogranicza długość do 20 znaków.
 */
function sanitizeUsername(username) {
    return username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20);
}

/**
 * Błąd 30: Funkcja haszująca hasło (używa SHA-256).
 * Zapewnia, że hasło nie jest przechowywane w postaci zwykłego tekstu.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================
   MAIN LOGIC
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');

    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    const toRegister = document.getElementById('to-register');
    const toLogin = document.getElementById('to-login');

    /* auto-login if already logged */
    try {
        const session = sessionStorage.getItem('mg_session');
        if (session) {
            // Błąd 32: Użycie replace()
            window.location.replace('index.html');
            return;
        }
    } catch (e) {
        console.warn('session read error', e);
    }

    /* ---------- Switch screens ---------- */
    toRegister.addEventListener('click', () => {
        loginBox.classList.add('hidden');
        registerBox.classList.remove('hidden');
    });

    toLogin.addEventListener('click', () => {
        registerBox.classList.add('hidden');
        loginBox.classList.remove('hidden');
    });

    /* ---------- REGISTER ---------- */
    registerBtn.addEventListener('click', async () => {
        const rawUser = document.getElementById('reg-username').value.trim();
        const rawPass = document.getElementById('reg-password').value.trim();

        // Błąd 32: Sanitacja nazwy użytkownika
        const user = sanitizeUsername(rawUser);

        if (!user || !rawPass) {
            showToast('Fill all fields');
            return;
        }

        // Błąd 31: Walidacja długości
        if (user.length < 3) {
            showToast('Username must be ≥ 3 characters');
            return;
        }
        // Błąd 31: Walidacja długości hasła
        if (rawPass.length < 6) {
            showToast('Password must be ≥ 6 characters');
            return;
        }

        const stored = JSON.parse(localStorage.getItem('mg_user') || '{}');

        if (stored.user === user) {
            showToast('Account already exists');
            return;
        }

        // Błąd 30: Haszowanie hasła przed zapisem (KRYTYCZNE)
        const passHash = await hashPassword(rawPass);

        // Błąd 30: Przechowywanie tylko hasza
        localStorage.setItem(
            'mg_user',
            JSON.stringify({ user, passHash })
        );

        showToast('Account created! Log in now.'); // Błąd 25

        registerBox.classList.add('hidden');
        loginBox.classList.remove('hidden');
    });

    /* ---------- LOGIN ---------- */
    loginBtn.addEventListener('click', async () => {
        const rawUser = document.getElementById('username').value.trim();
        const rawPass = document.getElementById('password').value.trim();

        // Błąd 32: Sanitacja
        const user = sanitizeUsername(rawUser);

        if (!user || !rawPass) {
            showToast('Fill all fields');
            return;
        }

        const saved = JSON.parse(localStorage.getItem('mg_user') || '{}');

        if (!saved.user) {
            showToast('No account exists — please register');
            return;
        }

        // Haszowanie wprowadzonego hasła do porównania
        const passHash = await hashPassword(rawPass);

        if (saved.user !== user) {
            showToast('No such account');
            return;
        }

        // Błąd 30: Porównanie haszy zamiast plaintext
        if (saved.passHash !== passHash) {
            showToast('Wrong password');
            return;
        }

        /* success */
        sessionStorage.setItem(
            'mg_session',
            JSON.stringify({ user, ts: Date.now() })
        );

        showToast(`Welcome, ${user}!`); // Błąd 25

        setTimeout(() => {
            // Błąd 32: Użycie window.location.replace()
            window.location.replace('index.html');
        }, 800);
    });
});