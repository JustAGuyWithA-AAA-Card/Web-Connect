// frontend/js/auth.js
// exports: initAuth, isLoggedIn, logout, getToken

let token = localStorage.getItem('wc_token') || null;
let username = localStorage.getItem('wc_user') || null;

export async function initAuth(){
  // could refresh token here if we had refresh tokens
  return;
}

export function isLoggedIn(){ return !!token; }
export function getToken(){ return token; }

export function logout(){
  token = null; username = null;
  localStorage.removeItem('wc_token');
  localStorage.removeItem('wc_user');
}

async function api(path, body){
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token?{ 'Authorization': 'Bearer ' + token }: {}) },
    body: JSON.stringify(body || {})
  });
  return res.json();
}

// render auth view
export async function render(){
  const root = document.createElement('div');
  root.className = 'container';
  root.innerHTML = `
    <div class="card" style="max-width:520px;margin:0 auto">
      <h2>Web-Connect — Login</h2>
      <div style="margin:12px 0;">
        <input id="wc_user" placeholder="username/email" style="width:100%;padding:10px;border-radius:8px;margin-bottom:8px"/>
        <input id="wc_pass" placeholder="password" type="password" style="width:100%;padding:10px;border-radius:8px;margin-bottom:8px"/>
        <div style="display:flex;gap:8px">
          <button id="wc_login" class="btn">Login</button>
          <button id="wc_register" class="btn" style="background:#10b981">Register</button>
        </div>
        <div id="wc_msg" style="margin-top:8px;color:var(--muted)"></div>
      </div>
    </div>
  `;
  const inpUser = root.querySelector('#wc_user');
  const inpPass = root.querySelector('#wc_pass');
  const btnLogin = root.querySelector('#wc_login');
  const btnReg = root.querySelector('#wc_register');
  const msg = root.querySelector('#wc_msg');

  btnReg.onclick = async () => {
    const u = inpUser.value.trim();
    const p = inpPass.value;
    if(!u || !p){ msg.textContent = 'enter username+password'; return; }
    const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    const j = await res.json();
    if(j.success) { msg.textContent = 'registered — now login'; }
    else msg.textContent = j.error || 'register failed';
  };

  btnLogin.onclick = async () => {
    const u = inpUser.value.trim();
    const p = inpPass.value;
    if(!u || !p){ msg.textContent = 'enter username+password'; return; }
    const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    const j = await res.json();
    if(j.token){
      token = j.token;
      username = u;
      localStorage.setItem('wc_token', token);
      localStorage.setItem('wc_user', username);
      // navigate to dashboard
      window.navigate('dashboard');
    } else {
      msg.textContent = j.error || 'login failed';
    }
  };

  return root;
}

export { render as renderAuth };
