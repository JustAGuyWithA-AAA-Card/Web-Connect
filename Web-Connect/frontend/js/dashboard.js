// frontend/js/dashboard.js
import { getToken } from './auth.js';

export async function render(){
  const root = document.createElement('div');
  root.className = 'container';
  // generate or fetch your 6-digit code: call server to create session when hosting,
  // but for display we show user's personal code (stored locally as well)
  let myCode = localStorage.getItem('wc_connect_code');
  if(!myCode){
    myCode = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('wc_connect_code', myCode);
  }

  root.innerHTML = `
    <div class="card" style="max-width:900px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <h2>Dashboard</h2>
          <div style="color:var(--muted)">Your connection code (share this with people who should connect to you)</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:20px">${myCode}</div>
          <div style="font-size:12px;color:var(--muted)">6-digit code</div>
        </div>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <input id="target_code" placeholder="Enter 6-digit target code" style="flex:1;padding:10px;border-radius:8px"/>
        <input id="host_pwd" placeholder="Host password (if required)" style="width:220px;padding:10px;border-radius:8px"/>
        <button id="connect_btn" class="btn">Connect</button>
        <button id="host_btn" class="btn" style="background:#10b981">Start Hosting</button>
      </div>

      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="btn" onclick="navigate('devices')">Devices</button>
        <button class="btn" onclick="navigate('settings')">Settings</button>
        <button class="btn" onclick="wcLogout()" style="background:#ef4444">Logout</button>
      </div>

      <div id="status_area" style="margin-top:14px;color:var(--muted)"></div>
    </div>
  `;

  const connectBtn = root.querySelector('#connect_btn');
  const hostBtn = root.querySelector('#host_btn');
  const statusArea = root.querySelector('#status_area');

  connectBtn.onclick = async () => {
    const code = root.querySelector('#target_code').value.trim();
    const pwd = root.querySelector('#host_pwd').value;
    if(!/^\d{6}$/.test(code)) { alert('Enter 6-digit code'); return; }
    statusArea.textContent = 'Requesting connection...';
    // Create RTCPeerConnection & offer in frontend, send to worker via /api/signal/send
    await import('./webrtc.js').then(m => m.startClientOffer(code, pwd, (s) => { statusArea.textContent = s; }));
  };

  hostBtn.onclick = async () => {
    // create session on server
    const name = prompt('Host name (friendly):','My PC') || 'My PC';
    const requirePassword = confirm('Require a host password? (OK = yes)');
    let password = '';
    if(requirePassword) password = prompt('Enter host password (users need this to connect)');
    const token = localStorage.getItem('wc_token');
    const res = await fetch('/api/session/create', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ name, requirePassword, password })
    });
    const j = await res.json();
    if(j.session){
      // save local connect code for host
      localStorage.setItem('wc_host_session', JSON.stringify(j.session));
      alert(`Hosting started. Your public code is: ${j.session.id}`);
      // start host poller (handle offers)
      await import('./webrtc.js').then(m => m.startHostPoller(j.session.id));
    } else {
      alert('Could not start host: ' + (j.error||'unknown'));
    }
  };

  return root;
}
