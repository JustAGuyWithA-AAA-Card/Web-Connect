// frontend/js/app.js
import { initAuth, isLoggedIn, logout } from './auth.js';

const app = document.getElementById('app');

const LOADING_KEY = 'wc_loading_enabled';
let loadingEnabled = JSON.parse(localStorage.getItem(LOADING_KEY) || 'false');

function createShell() {
  const shell = document.createElement('div');
  shell.className = 'shell container';
  shell.innerHTML = `
    <div class="topbar">
      <div class="brand"><strong>Web-Connect</strong></div>
      <div id="topControls"></div>
    </div>
    <div id="viewArea"></div>
    <div id="loadingOverlay" class="loading-overlay" style="display:none">
      <div style="text-align:center">
        <div class="spinner"></div>
        <div class="progress"><span id="loadingBar"></span></div>
        <div id="loadingText" style="margin-top:8px;color:var(--muted)">Loading...</div>
      </div>
    </div>
  `;
  return shell;
}

function showLoading() {
  if (!loadingEnabled) return;
  const el = document.getElementById('loadingOverlay');
  el.style.display = 'flex';
  const bar = document.getElementById('loadingBar');
  bar.style.width = '0%';
  let p = 0, t = setInterval(()=> {
    p = Math.min(100, p + Math.random()*25);
    bar.style.width = p + '%';
    if (p>=100) { clearInterval(t); setTimeout(()=>el.style.display='none', 300); }
  }, 180);
}
function hideLoadingImmediate(){ const el=document.getElementById('loadingOverlay'); el.style.display='none'; }

async function loadView(viewName, useLoading=true) {
  if (useLoading && loadingEnabled) showLoading();
  const viewArea = document.getElementById('viewArea');
  viewArea.innerHTML = '';
  try {
    const mod = await import(`./${viewName}.js`);
    const node = await mod.render();
    node.classList.add('view');
    viewArea.appendChild(node);
    requestAnimationFrame(()=> node.classList.add('active'));
  } catch (err) {
    viewArea.innerHTML = `<div class="card">Error loading view: ${err}</div>`;
  } finally {
    if (useLoading && !loadingEnabled) hideLoadingImmediate();
  }
}

// router helpers
window.navigate = (name) => {
  if (!isLoggedIn() && name !== 'auth') name = 'auth';
  loadView(name, true);
};

async function boot() {
  // render shell
  app.innerHTML = '';
  const shell = createShell();
  app.appendChild(shell);

  // top controls: show login state if any
  const top = document.getElementById('topControls');
  const btn = document.createElement('button');
  btn.textContent = 'Profile';
  btn.onclick = async () => { if (!isLoggedIn()) navigate('auth'); else {
    await loadView('dashboard');
  } };
  top.appendChild(btn);

  // initial view
  await initAuth();
  if (isLoggedIn()) navigate('dashboard');
  else navigate('auth');
}

boot();
