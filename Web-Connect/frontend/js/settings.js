// frontend/js/settings.js
export async function render() {
  const root = document.createElement('div');
  root.className = 'card';
  const loading = JSON.parse(localStorage.getItem('wc_loading') || 'false');
  root.innerHTML = `
    <h3>Settings</h3>
    <label><input id="toggleLoading" type="checkbox"> Enable loading screen on swaps</label>
    <div style="margin-top:12px"><button id="back">Back</button></div>
  `;
  const cb = root.querySelector('#toggleLoading');
  cb.checked = loading;
  cb.onchange = () => localStorage.setItem('wc_loading', JSON.stringify(cb.checked));
  root.querySelector('#back').onclick = () => window.navigate('dashboard');
  return root;
}
