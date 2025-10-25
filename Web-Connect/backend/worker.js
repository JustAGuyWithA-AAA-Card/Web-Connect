// backend/worker.js
// Cloudflare Worker backend - KV-backed users, JWT via env.JWT_SECRET
// KV bindings expected: USERS, SESSIONS, MESSAGES

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256hex(str) {
  const bin = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", bin);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

// hmac-sha256 hex
async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const arr = Array.from(new Uint8Array(sig));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

// base64url helpers
function b64uEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uEncodeJson(obj) {
  return b64uEncode(JSON.stringify(obj));
}
function b64uDecodeToJson(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4);
  return JSON.parse(atob(b64));
}

// issue token: header.payload.signature  (HMAC-SHA256)
async function issueToken(payload, secret, expiresSec = 3600*2) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresSec;
  const pl = { ...payload, exp };
  const headerB64 = b64uEncodeJson(header);
  const payloadB64 = b64uEncodeJson(pl);
  const toSign = `${headerB64}.${payloadB64}`;
  const sigHex = await hmacHex(toSign, secret);
  // represent signature as hex (we'll use hex string to verify)
  return `${toSign}.${sigHex}`;
}

async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = await hmacHex(`${h}.${p}`, secret);
  if (expected !== sig) return null;
  const payload = b64uDecodeToJson(p);
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json"
  };
}

async function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: corsHeaders() });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname; // expect calls like /api/register via Pages function proxy
    // CORS preflight
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    try {
      // POST /api/register { username, password, email }
      if (path === "/api/register" && request.method === "POST") {
        const body = await request.json().catch(()=>({}));
        const { username, password, email } = body;
        if (!username || !password || !email) return jsonResponse({ error: "username, password and email required" }, 400);
        const key = `user:${username}`;
        const existing = await env.USERS.get(key);
        if (existing) return jsonResponse({ error: "user exists" }, 409);
        const pwHash = await sha256hex(password);
        const userObj = { username, email, passwordHash: pwHash, createdAt: new Date().toISOString() };
        await env.USERS.put(key, JSON.stringify(userObj));
        return jsonResponse({ success: true, message: "registered" }, 201);
      }

      // POST /api/login { username, password }
      if (path === "/api/login" && request.method === "POST") {
        const body = await request.json().catch(()=>({}));
        const { username, password } = body;
        if (!username || !password) return jsonResponse({ error: "username & password required" }, 400);
        const key = `user:${username}`;
        const raw = await env.USERS.get(key);
        if (!raw) return jsonResponse({ error: "invalid credentials" }, 401);
        const user = JSON.parse(raw);
        const pwHash = await sha256hex(password);
        if (pwHash !== user.passwordHash) return jsonResponse({ error: "invalid credentials" }, 401);
        const token = await issueToken({ username, email: user.email }, env.JWT_SECRET);
        // store session token in SESSIONS KV for optional session management
        await env.SESSIONS.put(`session:${username}`, token, { expirationTtl: 3600*2 });
        return jsonResponse({ success: true, token });
      }

      // GET /api/profile  (Authorization: Bearer <token>)
      if (path === "/api/profile" && request.method === "GET") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.split(" ")[1];
        if (!token) return jsonResponse({ error: "unauthorized" }, 401);
        const payload = await verifyToken(token, env.JWT_SECRET);
        if (!payload) return jsonResponse({ error: "invalid or expired token" }, 401);
        // payload contains username,email,exp
        return jsonResponse({ success: true, profile: { username: payload.username, email: payload.email } });
      }

      // POST /api/session/create { name, requirePassword, password } - host creates a session code
      if (path === "/api/session/create" && request.method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.split(" ")[1];
        const payload = await verifyToken(token, env.JWT_SECRET);
        if (!payload) return jsonResponse({ error: "unauthorized" }, 401);
        const body = await request.json().catch(()=>({}));
        const name = body.name || `${payload.username}-host`;
        const requirePassword = !!body.requirePassword;
        const password = body.password || "";
        const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
        const sessObj = {
          id: sessionCode, owner: payload.username, ownerEmail: payload.email,
          name, requirePassword, passwordHash: requirePassword ? await sha256hex(password) : null,
          createdAt: new Date().toISOString()
        };
        await env.SESSIONS.put(sessionCode, JSON.stringify(sessObj), { expirationTtl: 60*60*24 });
        return jsonResponse({ success: true, session: sessObj });
      }

      // POST /api/signal/send  { targetCode, kind, payload }
      if (path === "/api/signal/send" && request.method === "POST") {
        const body = await request.json().catch(()=>({}));
        const { targetCode, kind, payload } = body;
        if (!targetCode || !kind) return jsonResponse({ error: "targetCode & kind required" }, 400);
        const key = `msgs:${targetCode}`;
        const existing = await env.MESSAGES.get(key);
        const arr = existing ? JSON.parse(existing) : [];
        arr.push({ kind, payload, ts: Date.now() });
        await env.MESSAGES.put(key, JSON.stringify(arr), { expirationTtl: 60*60 });
        return jsonResponse({ success: true });
      }

      // GET /api/signal/poll?code=123456 -> returns and clears messages
      if (path === "/api/signal/poll" && request.method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return jsonResponse({ error: "code required" }, 400);
        const key = `msgs:${code}`;
        const existing = await env.MESSAGES.get(key);
        if (!existing) return jsonResponse({ msgs: [] });
        await env.MESSAGES.delete(key);
        return new Response(existing, { status: 200, headers: corsHeaders() });
      }

      // GET /api/session/list -> public list of sessions (small)
      if (path === "/api/session/list" && request.method === "GET") {
        const list = await env.SESSIONS.list();
        const sessions = [];
        for (const k of list.keys) {
          const raw = await env.SESSIONS.get(k.name);
          if (!raw) continue;
          const s = JSON.parse(raw);
          sessions.push({ id: s.id, name: s.name, owner: s.owner });
        }
        return jsonResponse({ sessions });
      }

      // default
      return jsonResponse({ ok: true, msg: "Web-Connect worker ready" });
    } catch (err) {
      return jsonResponse({ error: "server error", detail: String(err) }, 500);
    }
  }
};
