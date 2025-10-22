export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (pathname === "/api/register" && request.method === "POST") {
        return await handleRegister(request, env);
      } else if (pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env);
      } else if (pathname === "/api/profile" && request.method === "GET") {
        return await handleProfile(request, env);
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ error: "Server Error" }), {
        status: 500,
        headers: corsHeaders(),
      });
    }
  },
};

// --- Utility: CORS ---
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

// --- Register ---
async function handleRegister(request, env) {
  const { username, password } = await request.json();

  if (!username || !password)
    return json({ error: "Missing username or password" }, 400);

  const existing = await env.USERS_KV.get(`user:${username}`);
  if (existing)
    return json({ error: "User already exists" }, 400);

  await env.USERS_KV.put(`user:${username}`, JSON.stringify({ username, password }));

  return json({ message: "Registration successful" }, 201);
}

// --- Login ---
async function handleLogin(request, env) {
  const { username, password } = await request.json();

  if (!username || !password)
    return json({ error: "Missing username or password" }, 400);

  const userRaw = await env.USERS_KV.get(`user:${username}`);
  if (!userRaw) return json({ error: "Invalid credentials" }, 401);

  const user = JSON.parse(userRaw);
  if (user.password !== password) return json({ error: "Invalid credentials" }, 401);

  const token = await generateJWT({ username }, env.JWT_SECRET);
  await env.SESSIONS_KV.put(`session:${username}`, token);

  return json({ token });
}

// --- Profile ---
async function handleProfile(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer "))
    return json({ error: "Unauthorized" }, 401);

  const token = auth.split(" ")[1];
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return json({ error: "Invalid or expired token" }, 401);

  const userRaw = await env.USERS_KV.get(`user:${payload.username}`);
  if (!userRaw) return json({ error: "User not found" }, 404);

  const user = JSON.parse(userRaw);
  return json({ username: user.username });
}

// --- JSON Response Helper ---
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders(),
  });
}

// --- JWT Encode ---
async function generateJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

  const encodedHeader = enc(header);
  const encodedPayload = enc({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2h expiration
  });

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// --- JWT Verify ---
async function verifyJWT(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  if (!valid) return null;

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
