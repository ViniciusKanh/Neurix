// Builds a normalized ctx object from a Node/Vercel/Express request so the same
// handler logic runs in both the Vercel serverless runtime and the local dev server.
export function makeCtx(req, base) {
  const url = new URL(req.url, 'http://localhost');
  let parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','auth','login']
  const apiIdx = parts.indexOf('api');
  if (apiIdx !== -1) parts = parts.slice(apiIdx + 1);
  if (parts[0] === base) parts = parts.slice(1);

  const query = Object.fromEntries(url.searchParams.entries());

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (body == null) body = {};

  return {
    segments: parts.map((p) => decodeURIComponent(p)),
    method: (req.method || 'GET').toUpperCase(),
    query,
    body,
  };
}
