import * as jose from 'jose';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    // Route: POST /api/login
    if (path === '/api/login' && method === 'POST') {
      try {
        const { username, password } = await request.json();
        if (!username || !password)
          return json({ success: false, error: 'Missing credentials' }, 400);

        // Lookup user from KV
        const stored = await env.USERS_KV.get(username, { type: 'json' });
        if (!stored || stored.password !== password)
          return json({ success: false, error: 'Invalid username or password' }, 401);

        // Create session + JWT
        const token = await new jose.SignJWT({ user: username })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(secret);

        // Optionally store active session in KV
        await env.SESSIONS_KV.put(username, token, { expirationTtl: 3600 });

        return json({ success: true, token });
      } catch (err) {
        return json({ success: false, error: 'Malformed JSON' }, 400);
      }
    }

    // Route: GET /api/verify
    if (path === '/api/verify' && method === 'GET') {
      try {
        const auth = request.headers.get('Authorization');
        if (!auth) return json({ success: false, error: 'Missing Authorization header' }, 401);

        const token = auth.split(' ')[1];
        const { payload } = await jose.jwtVerify(token, secret);

        return json({ success: true, user: payload.user });
      } catch {
        return json({ success: false, error: 'Invalid or expired token' }, 401);
      }
    }

    // Route: POST /api/register
    if (path === '/api/register' && method === 'POST') {
      try {
        const { username, password } = await request.json();
        if (!username || !password)
          return json({ success: false, error: 'Missing credentials' }, 400);

        const exists = await env.USERS_KV.get(username);
        if (exists) return json({ success: false, error: 'User already exists' }, 409);

        await env.USERS_KV.put(username, JSON.stringify({ username, password }));
        return json({ success: true, message: 'User registered successfully' });
      } catch {
        return json({ success: false, error: 'Malformed JSON' }, 400);
      }
    }

    // Route: GET /api/messages (protected)
    if (path === '/api/messages' && method === 'GET') {
      try {
        const auth = request.headers.get('Authorization');
        if (!auth) return json({ success: false, error: 'Missing token' }, 401);

        const token = auth.split(' ')[1];
        const { payload } = await jose.jwtVerify(token, secret);
        const messages = await env.MESSAGES_KV.list();

        return json({ success: true, user: payload.user, messages });
      } catch {
        return json({ success: false, error: 'Invalid or expired token' }, 401);
      }
    }

    // Fallback (root)
    return json({
      message: '✅ Web-Connect Worker Active',
      available_routes: [
        'POST /api/register',
        'POST /api/login',
        'GET /api/verify',
        'GET /api/messages',
      ],
    });
  },
};

// Helper to create JSON responses
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
