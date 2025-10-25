// frontend/js/devices.js
export async function render() {
  const root = document.createElement('div');
  root.className = 'card';
  root.innerHTML = `<h3>Devices</h3><div id="list"></div><div style="margin-top:12px"><button id="back">Back</button></div>`;
  root.querySelector('#back').onclick = () => window.navigate('dashboard');
  const list = root.querySelector('#list');
  // fetch session list from server
  try {
    const res = await fetch('/api/session/list');
    const j = await res.json();
    if (j.sessions && j.sessions.length) {
      list.innerHTML = j.sessions.map(s => `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);margin-bottom:8px"><b>${s.name}</b> — code: ${s.id} — owner: ${s.owner} <button data-code="${s.id}" class="connectBtn" style="margin-left:8px">Connect</button></div>`).join('');
      list.querySelectorAll('.connectBtn').forEach(b => b.onclick = async (e) => {
        const code = e.target.dataset.code;
        const pwd = prompt('Host password (if required):');
        // start connection flow (webrtc module would handle)
        alert('Would attempt to connect to ' + code + ' (demo)');
      });
    } else list.textContent = 'No sessions online.';
  } catch (e) {
    list.textContent = 'Error fetching sessions';
  }
  return root;
}
