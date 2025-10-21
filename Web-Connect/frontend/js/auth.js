async function render_auth(){
  const div=document.createElement('div');
  div.innerHTML=`
    <div class="card">
      <h2>Login</h2>
      <input id="email" placeholder="Email"/><br/>
      <input id="pass" placeholder="Password" type="password"/><br/>
      <button id="loginBtn">Login</button>
      <p>No account? <a id="registerLink" href="#">Register</a></p>
    </div>
  `;
  div.querySelector('#loginBtn').onclick=async()=>{
    const email=document.getElementById('email').value;
    const pass=document.getElementById('pass').value;
    const res=await fetch('/api/login',{method:'POST',body:JSON.stringify({email,pass})});
    if(res.ok){navigate('dashboard');}
    else alert('Invalid login');
  };
  div.querySelector('#registerLink').onclick=()=>{
    const email=prompt('Email:');
    const pass=prompt('Password:');
    fetch('/api/register',{method:'POST',body:JSON.stringify({email,pass})})
      .then(r=>r.ok?alert('Registered!'):alert('Failed'));
  };
  return div;
}
