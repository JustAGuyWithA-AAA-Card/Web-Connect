// frontend/js/dashboard.js
export async function render() {
  const root = document.createElement('div');
  root.className = 'card';
  const token = localStorage.getItem('wc_token');
  const uname = localStorage.getItem('wc_user') || 'you';
  const code = localStorage.getItem('wc_host_code') || (Math.floor(100000 + Math.random()*900000)).toString();
  localStorage.setItem('wc_host_code', code);

  root.innerHTML = `
    <h3>Dashboard</h3>
    <p>Hello, <b>${uname}</b></p>
    <p>Your 6-digit code: <b>${code}</b></p>
    <div style="margin-top:12px">
      <button id="start_host">Start Hosting</button>
      <button id="to_devices">Devices</button>
      <button id="to_settings">Settings</button>
      <button id="logout_btn" style="background:#ef4444">Logout</button>
    </div>
  `;

  root.querySelector('#to_devices').onclick = () => window.navigate('devices');
  root.querySelector('#to_settings').onclick = () => window.navigate('settings');
  root.querySelector('#logout_btn').onclick = () => { localStorage.removeItem('wc_token'); localStorage.removeItem('wc_user'); window.navigate('auth'); };
  root.querySelector('#start_host').onclick = async () => {
    // request server to create session
    const token = localStorage.getItem('wc_token');
    const name = prompt('Host name', 'My PC');
    const requirePassword = confirm('Require a host password?');
    const password = requirePassword ? prompt('Set host password') : '';
    const res = await fetch('/api/session/create', { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+token }, body: JSON.stringify({ name, requirePassword, password })});
    const j = await res.json();
    if (res.ok && j.session) {
      alert('Hosting started: code ' + j.session.id);
      localStorage.setItem('wc_host_code', j.session.id);
    } else alert(j.error || 'Could not start host');
  };

  return root;
}
