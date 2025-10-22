const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256hex(text) {
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const b = new Uint8Array(hash);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

// Simple HMAC-SHA256 using the Worker crypto with secret (returns hex)
async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const b = new Uint8Array(sig);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' }});
}

function rand6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function nowISO() { return new Date().toISOString(); }

async function verifyToken(env, token) {
  if(!token) return null;
  try {
    const parts = token.split('.');
    if(parts.length !== 2) return null;
    const payload = JSON.parse(atob(parts[0]));
    const sig = parts[1];
    const expected = await hmacHex(parts[0], env.JWT_SECRET);
    if(expected !== sig) return null;
    // expiry check
    if(payload.exp && Date.now() > payload.exp) return null;
    return payload; // { username }
  } catch(e) { return null; }
}

async function issueToken(env, payload, expiresMs = 1000*60*60*12) {
  const payloadCopy = {...payload, exp: Date.now() + expiresMs};
  const b64 = btoa(JSON.stringify(payloadCopy));
  const sig = await hmacHex(b64, env.JWT_SECRET);
  return `${b64}.${sig}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization"
        }
      });
    }

    // Helper to parse JSON body
    async function bodyJSON() {
      try { return await request.json(); } catch(e) { return {}; }
    }

    // ROUTES
    // POST /api/register { username, password }
    if (path === '/api/register' && request.method === 'POST') {
      const { username, password } = await bodyJSON();
      if (!username || !password) return jsonResponse({ error: 'username & password required' }, 400);
      const existing = await env.USERS_KV.get(username);
      if (existing) return jsonResponse({ error: 'user exists' }, 400);
      const pwHash = await sha256hex(password);
      const userObj = { passwordHash: pwHash, twoFA: false, twoFASecret: null, createdAt: nowISO() };
      await env.USERS_KV.put(username, JSON.stringify(userObj));
      return jsonResponse({ success: true });
    }

    // POST /api/login { username, password, otp? }
    if (path === '/api/login' && request.method === 'POST') {
      const { username, password, otp } = await bodyJSON();
      if (!username || !password) return jsonResponse({ error: 'username & password required' }, 400);
      const data = await env.USERS_KV.get(username);
      if (!data) return jsonResponse({ error: 'no such user' }, 400);
      const user = JSON.parse(data);
      const pwHash = await sha256hex(password);
      if (pwHash !== user.passwordHash) return jsonResponse({ error: 'wrong password' }, 400);
      if (user.twoFA) {
        if(!otp) return jsonResponse({ error: '2fa required' }, 400);
        // Verify TOTP using simple algorithm: compare current & +/-30s codes with stored secret
        // We will implement TOTP verification client-side; here we trust the otp if provided for demo.
        // For production, verify TOTP on server properly (e.g., using otplib in a Worker-compatible way).
      }
      const token = await issueToken(env, { username });
      return jsonResponse({ success: true, token });
    }

    // POST /api/2fa/setup (protected) -> generates a secret and stores it
    if (path === '/api/2fa/setup' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s*/, '');
      const payload = await verifyToken(env, token);
      if(!payload) return jsonResponse({ error: 'unauthenticated' }, 401);
      const username = payload.username;
      // generate a random base32-like secret (simple)
      const secret = btoa(Math.random().toString()).substr(0,16);
      const data = JSON.parse(await env.USERS_KV.get(username));
      data.twoFA = true;
      data.twoFASecret = secret;
      await env.USERS_KV.put(username, JSON.stringify(data));
      // return secret; client can display QR using otplib
      return jsonResponse({ success:true, secret, otpauth: `totp:Web-Connect:${username}?secret=${secret}&issuer=Web-Connect` });
    }

    // POST /api/session/create (protected) -> host registers session, returns 6-digit code
    if (path === '/api/session/create' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s*/, '');
      const payload = await verifyToken(env, token);
      if(!payload) return jsonResponse({ error: 'unauthenticated' }, 401);
      const { name='Host', requirePassword=true, password='' } = await bodyJSON();
      const code = rand6();
      const sess = { id: code, owner: payload.username, name, requirePassword: !!requirePassword, passwordHash: requirePassword ? await sha256hex(password || '') : null, createdAt: nowISO(), status: 'online' };
      await env.SESSIONS_KV.put(code, JSON.stringify(sess));
      return jsonResponse({ success:true, session: sess });
    }

    // POST /api/session/close (protected) -> close sessions owned by user
    if (path === '/api/session/close' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s*/, '');
      const payload = await verifyToken(env, token);
      if(!payload) return jsonResponse({ error: 'unauthenticated' }, 401);
      // iterate keys (KV list) to remove sessions by owner (KV list is limited; for demo it's fine)
      let list = await env.SESSIONS_KV.list();
      for (const key of list.keys) {
        const raw = await env.SESSIONS_KV.get(key.name);
        if(!raw) continue;
        const s = JSON.parse(raw);
        if(s.owner === payload.username) await env.SESSIONS_KV.delete(key.name);
      }
      return jsonResponse({ success:true });
    }

    // GET /api/session/list -> list all sessions (public)
    if (path === '/api/session/list' && request.method === 'GET') {
      const list = await env.SESSIONS_KV.list();
      const sessions = [];
      for(const key of list.keys){
        const raw = await env.SESSIONS_KV.get(key.name);
        if(!raw) continue;
        const s = JSON.parse(raw);
        sessions.push({ id: s.id, name: s.name, owner: s.owner, status: s.status });
      }
      return jsonResponse({ sessions });
    }

    // SIGNALING via HTTP (simple)
    // POST /api/signal/send { targetCode, kind: 'offer'|'answer'|'ice', payload }
    if (path === '/api/signal/send' && request.method === 'POST') {
      const { targetCode, kind, payload } = await bodyJSON();
      if(!targetCode || !kind) return jsonResponse({ error: 'targetCode & kind required' }, 400);
      const key = `msgs:${targetCode}`;
      const existing = await env.MESSAGES_KV.get(key);
      const arr = existing ? JSON.parse(existing) : [];
      arr.push({ kind, payload, ts: Date.now() });
      await env.MESSAGES_KV.put(key, JSON.stringify(arr));
      return jsonResponse({ success:true });
    }

    // GET /api/signal/poll?code=123456 -> returns and clears messages for that code
    if (path === '/api/signal/poll' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      if(!code) return jsonResponse({ error: 'code required' }, 400);
      const key = `msgs:${code}`;
      const existing = await env.MESSAGES_KV.get(key);
      if(!existing) return jsonResponse({ msgs: [] });
      await env.MESSAGES_KV.delete(key); // consume messages
      return new Response(existing, { status:200, headers: { 'Content-Type': 'application/json' }});
    }

    // misc ping
    if (path === '/api/ping') return jsonResponse({ ok:true });

    return new Response('Web-Connect Worker (ok)', { headers: { 'Content-Type': 'text/plain' }});
  }
};