// frontend/js/settings.js
export async function render(){
  const root = document.createElement('div');
  root.className = 'container';
  const loadingEnabled = JSON.parse(localStorage.getItem('wc_loading') || 'false');
  root.innerHTML = `
    <div class="card" style="max-width:900px;margin:0 auto">
      <h2>Settings</h2>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-top:12px">
        <div>
          <button class="btn" id="tab_general">General</button><br/><br/>
          <button class="btn" id="tab_security" style="background:#10b981">Security</button><br/><br/>
          <button class="btn" id="tab_devices">Devices</button><br/><br/>
          <button class="btn" id="tab_connection">Connection</button><br/><br/>
          <button class="btn" id="tab_advanced" style="background:#f97316">Advanced</button>
        </div>
        <div id="tab_content"></div>
      </div>

      <div style="margin-top:12px">
        <button class="btn" onclick="navigate('dashboard')">Back</button>
      </div>
    </div>
  `;

  const content = root.querySelector('#tab_content');

  function renderGeneral(){
    content.innerHTML = `
      <h3>General</h3>
      <p><label><input type="checkbox" id="loadingToggle"> Enable loading screen (Dashboard swaps)</label></p>
      <p><label>Display name: <input id="displayName" placeholder="Your name"></label></p>
    `;
    const t = content.querySelector('#loadingToggle');
    t.checked = loadingEnabled;
    t.onchange = () => {
      localStorage.setItem('wc_loading', JSON.stringify(t.checked));
      alert('Loading screen setting saved');
    };
    const dn = content.querySelector('#displayName');
    dn.value = localStorage.getItem('wc_displayName') || '';
    dn.onchange = () => localStorage.setItem('wc_displayName', dn.value);
  }

  function renderSecurity(){
    content.innerHTML = `
      <h3>Security</h3>
      <p><button id="setup2fa" class="btn">Setup 2FA (TOTP)</button></p>
      <p><button id="changePass" class="btn" style="background:#ef4444">Change Password</button></p>
    `;
    content.querySelector('#setup2fa').onclick = async () => {
      const token = localStorage.getItem('wc_token');
      const res = await fetch('/api/2fa/setup',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}});
      const j = await res.json();
      if(j.secret) {
        alert('2FA enabled. Secret: ' + j.secret + '\nAdd to your authenticator app.');
      } else alert('2FA failed: ' + (j.error||'unknown'));
    };
    content.querySelector('#changePass').onclick = async () => {
      const cur = prompt('current password:');
      const nw = prompt('new password:');
      if(!cur || !nw) return;
      // For demo: just re-register hash update: call /api/register? Not ideal. You could implement dedicated endpoint.
      alert('Password change is not enabled in demo worker. Implement endpoint for production.');
    };
  }

  function renderDevices(){
    content.innerHTML = `<h3>Devices</h3><p>Paired devices are handled locally in this demo.</p>`;
  }
  function renderConnection(){
    content.innerHTML = `<h3>Connection</h3><p>Default permissions: view only</p>`;
  }
  function renderAdvanced(){
    content.innerHTML = `<h3>Advanced</h3><p>Debug & export options.</p>`;
  }

  root.querySelector('#tab_general').onclick = renderGeneral;
  root.querySelector('#tab_security').onclick = renderSecurity;
  root.querySelector('#tab_devices').onclick = renderDevices;
  root.querySelector('#tab_connection').onclick = renderConnection;
  root.querySelector('#tab_advanced').onclick = renderAdvanced;

  // open default
  renderGeneral();

  return root;
}
