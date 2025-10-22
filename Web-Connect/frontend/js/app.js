// frontend/js/app.js
import { initAuth, isLoggedIn, logout } from './auth.js';

const app = document.getElementById('app');
const loadingScreen = document.getElementById('loading-screen');
const progressBar = loadingScreen.querySelector('.progress > span');

let loadingEnabled = JSON.parse(localStorage.getItem('wc_loading') || 'false');

function showLoading(){
  if(!loadingEnabled) return;
  loadingScreen.style.display = 'flex';
  progressBar.style.width = '0%';
}
function setLoadingPct(p){ if(!loadingEnabled) return; progressBar.style.width = `${p}%`; }
function hideLoading(){ if(!loadingEnabled) return; setTimeout(()=>loadingScreen.style.display='none',300); }

async function lazyLoadView(name){
  showLoading();
  setLoadingPct(10);
  let mod;
  try {
    mod = await import(`./${name}.js`);
    setLoadingPct(60);
  } catch(e){
    console.error('Failed load',name,e);
    hideLoading();
    throw e;
  }
  const viewEl = await mod.render();
  setLoadingPct(100);
  hideLoading();
  return viewEl;
}

async function navigate(name, data){
  // simple client-side auth guard
  if(!isLoggedIn() && name !== 'auth') {
    name = 'auth';
  }
  // load view
  const view = await lazyLoadView(name);
  app.innerHTML = '';
  app.appendChild(view);
  requestAnimationFrame(()=>view.classList.add('active'));
  // expose navigate globally for inline handlers
  window.navigate = navigate;
}

async function boot(){
  await initAuth(); // init local login state
  const start = isLoggedIn() ? 'dashboard' : 'auth';
  navigate(start);
}

// global logout
window.wcLogout = () => {
  logout();
  navigate('auth');
};

boot();
