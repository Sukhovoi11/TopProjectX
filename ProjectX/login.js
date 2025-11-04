// check user
if (localStorage.getItem('mg_user')) {
    location.href = 'index.html';
}

const loginBox = document.querySelector('.auth-box');
const registerBox = document.getElementById('register-box');

// switch to reg !
document.getElementById('to-register').onclick = () => {
    loginBox.classList.add('hidden');
    registerBox.classList.remove('hidden');
};

// switch to log
document.getElementById('to-login').onclick = () => {
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
};

// reg
document.getElementById('register-btn').onclick = () => {
    const user = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-password').value.trim();

    if (!user || !pass) return alert('Please enter a username and password');
    localStorage.setItem('mg_user', JSON.stringify({ user, pass }));
    alert('Account created! Now log in.');
    registerBox.classList.add('hidden');
    loginBox.classList.remove('hidden');
};
// log
document.getElementById('login-btn').onclick = () => {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const saved = JSON.parse(localStorage.getItem('mg_user') || '{}');

    if (user === saved.user && pass === saved.pass) {
        alert(`Welcome, ${user}!`);
        location.href = 'index.html';
    } else {
        alert('Invalid username or password');
    }
};
