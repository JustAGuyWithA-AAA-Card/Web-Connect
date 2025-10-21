const app = document.getElementById('app');
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.querySelector('.progress-bar span');

let currentView = null;
let loadingEnabled = JSON.parse(localStorage.getItem('loadingEnabled') ?? 'false');

function showLoading(){
  if(!loadingEnabled) return;
  loadingScreen.classList.remove('hidden');
  progressBar.style.width='0%';
  let i=0;
  const interval=setInterval(()=>{
    if(i>=100){clearInterval(interval);}
    progressBar.style.width=i+'%';i+=5;
  },50);
}

function hideLoading(){
  if(!loadingEnabled) return;
  setTimeout(()=>loadingScreen.classList.add('hidden'),500);
}

async function loadView(name){
  showLoading();
  const viewFn = window[`render_${name}`];
  if(!viewFn){console.error(`No view ${name}`);return;}
  app.innerHTML = '';
  const view = await viewFn();
  view.classList.add('view');
  app.appendChild(view);
  requestAnimationFrame(()=>view.classList.add('active'));
  hideLoading();
}

function initRouter(){
  const route = localStorage.getItem('route') || 'auth';
  loadView(route);
}

function navigate(name){
  localStorage.setItem('route',name);
  loadView(name);
}

window.navigate = navigate;
window.addEventListener('load',initRouter);
