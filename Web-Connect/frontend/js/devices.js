// frontend/js/devices.js
export async function render(){
  const root = document.createElement('div');
  root.className = 'container';
  // load local devices (demo)
  const devices = JSON.parse(localStorage.getItem('wc_devices') || '[]');
  root.innerHTML = `
    <div class="card" style="max-width:900px;margin:0 auto">
      <h2>Devices</h2>
      <div id="devlist"></div>
      <div style="margin-top:12px">
        <button class="btn" onclick="navigate('dashboard')">Back</button>
      </div>
    </div>
  `;
  const devlist = root.querySelector('#devlist');
  if(devices.length===0) devlist.innerHTML = '<div style="color:var(--muted)">No paired devices yet.</div>';
  else {
    devlist.innerHTML = devices.map(d=>`<div style="padding:8px;border-radius:8px;margin-bottom:8px;background:rgba(255,255,255,0.02)"><b>${d.name}</b> <span style="color:var(--muted)">(${d.id})</span></div>`).join('');
  }
  return root;
}
