async function render_devices(){
  const div=document.createElement('div');
  div.innerHTML=`
    <div class="card">
      <h2>Devices</h2>
      <ul id="deviceList"></ul>
      <button onclick="navigate('dashboard')">Back</button>
    </div>`;
  const ul=div.querySelector('#deviceList');
  const devices=JSON.parse(localStorage.getItem('devices')||'[]');
  devices.forEach(d=>{
    const li=document.createElement('li');
    li.textContent=d.name+" ("+d.id+")";
    ul.appendChild(li);
  });
  return div;
}
