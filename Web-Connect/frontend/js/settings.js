async function render_settings(){
  const div=document.createElement('div');
  div.innerHTML=`
    <div class="card">
      <h2>Settings</h2>
      <p><label><input type="checkbox" id="loadingToggle"/> Enable loading screen</label></p>
      <button onclick="navigate('dashboard')">Back</button>
    </div>`;
  const toggle=div.querySelector('#loadingToggle');
  toggle.checked=JSON.parse(localStorage.getItem('loadingEnabled')??'false');
  toggle.onchange=()=>{
    localStorage.setItem('loadingEnabled',toggle.checked);
    loadingEnabled=toggle.checked;
  };
  return div;
}
