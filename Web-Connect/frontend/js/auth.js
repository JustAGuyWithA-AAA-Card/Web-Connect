// frontend/js/auth.js
const API_BASE = '/api';
export function isLoggedIn() { return !!localStorage.getItem('wc_token'); }
export function logout() { localStorage.removeItem('wc_token'); localStorage.removeItem('wc_user'); }

// initialize - placeholder for token refresh if needed
export async function initAuth() { return; }

// render view for auth (used by dynamic import)
export async function render() {
  const root = document.createElement('div');
  root.className = 'card';
  root.innerHTML = `
    <h3>Login</h3>
    <input id="login_username" placeholder="username">
    <input id="login_password" placeholder="password" type="password">
    <button id="login_btn">Login</button>
    <hr>
    <h3>Register</h3>
    <input id="reg_username" placeholder="username">
    <input id="reg_email" placeholder="email">
    <input id="reg_password" placeholder="password" type="password">
    <button id="reg_btn">Register</button>
    <div id="auth_msg" style="margin-top:8px;color:var(--muted)"></div>
  `;
  const msg = root.querySelector('#auth_msg');

  root.querySelector('#login_btn').onclick = async () => {
    const username = root.querySelector('#login_username').value.trim();
    const password = root.querySelector('#login_password').value.trim();
    if (!username || !password) { msg.textContent = 'Fill username and password'; return; }
    try {
      const res = await fetch(API_BASE + '/login', {
        method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password })
      });
      const j = await res.json();
      if (res.ok && j.token) {
        localStorage.setItem('wc_token', j.token);
        localStorage.setItem('wc_user', username);
        msg.textContent = 'Login success';
        // navigate to dashboard
        window.navigate('dashboard');
      } else {
        msg.textContent = j.error || 'Login failed';
      }
    } catch(e) { msg.textContent = 'Network error'; console.error(e); }
  };

  root.querySelector('#reg_btn').onclick = async () => {
    const username = root.querySelector('#reg_username').value.trim();
    const email = root.querySelector('#reg_email').value.trim();
    const password = root.querySelector('#reg_password').value.trim();
    if (!username || !password || !email) { msg.textContent = 'Fill all fields'; return; }
    try {
      const res = await fetch(API_BASE + '/register', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password })
      });
      const j = await res.json();
      if (res.ok && j.success) {
        msg.textContent = 'Registered — please login';
      } else {
        msg.textContent = j.error || 'Register failed';
      }
    } catch(e) { msg.textContent = 'Network error'; console.error(e); }
  };

  return root;
}
