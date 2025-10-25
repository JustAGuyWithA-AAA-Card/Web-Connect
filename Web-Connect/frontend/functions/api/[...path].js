// frontend/functions/api/[...path].js
export async function onRequest(context) {
  // Service binding name 'API' — set this in Pages > Settings > Bindings
  const { API } = context.env;
  const url = new URL(context.request.url);
  // remove /api prefix
  const path = url.pathname.replace(/^\/api/, '') || '/';
  // Forward to Worker (we use fake origin because service.fetch needs absolute URL)
  const forwardUrl = `https://web-connect-worker${path}`; // hostname doesn't matter for service fetch
  const forwarded = new Request(forwardUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });
  const resp = await API.fetch(forwarded);
  // Return response to client (preserve headers/body)
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(resp.body, { status: resp.status, headers });
}
