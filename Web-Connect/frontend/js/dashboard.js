async function render_dashboard(){
  const div=document.createElement('div');
  const code=Math.floor(100000+Math.random()*900000);
  localStorage.setItem('connectCode',code);
  div.innerHTML=`
    <div class="card">
      <h2>Dashboard</h2>
      <p>Your code: <strong>${code}</strong></p>
      <input id="target" placeholder="Enter 6-digit code"/>
      <button id="connectBtn">Connect</button>
      <button onclick="navigate('devices')">Devices</button>
      <button onclick="navigate('settings')">Settings</button>
    </div>
  `;
  div.querySelector('#connectBtn').onclick=()=>{
    const target=document.getElementById('target').value;
    if(target.length!==6)return alert('Invalid code');
    startConnection(target);
  };
  return div;
}
