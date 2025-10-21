export default {
  async fetch(request, env){
    const url=new URL(request.url);
    if(request.method==='POST' && url.pathname==='/api/register'){
      const body=await request.json();
      await env.USERS.put(body.email,JSON.stringify({pass:body.pass}));
      return new Response('ok');
    }
    if(request.method==='POST' && url.pathname==='/api/login'){
      const body=await request.json();
      const data=await env.USERS.get(body.email);
      if(!data)return new Response('no', {status:401});
      const user=JSON.parse(data);
      if(user.pass!==body.pass)return new Response('bad',{status:401});
      return new Response('ok');
    }
    if(request.method==='POST' && url.pathname.startsWith('/api/')){
      // mock signaling endpoints
      return new Response('ok');
    }
    return new Response('Web-Connect API');
  }
}
