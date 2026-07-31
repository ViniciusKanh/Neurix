// Builds a normalized ctx from a Node/Vercel/Express request.
// The client sends every call as /api/<resource>?path=<sub/segments>, so the
// route segments come from the `path` query param (single fixed function path
// per resource — reliable on Vercel). Falls back to URL parsing otherwise.
export function makeCtx(req, base) {
  const url = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(url.searchParams.entries());

  let parts;
  const pathParam = query.path;
  if (pathParam !== undefined && pathParam !== null) {
    parts = String(pathParam).split('/').filter(Boolean);
    delete query.path;
  } else {
    // Fallback: derive segments from the URL pathname.
    let segs = url.pathname.split('/').filter(Boolean);
    const apiIdx = segs.indexOf('api');
    if (apiIdx !== -1) segs = segs.slice(apiIdx + 1);
    if (segs[0] === base) segs = segs.slice(1);
    parts = segs;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body == null) body = {};

  return {
    segments: parts.map((p) => decodeURIComponent(p)),
    method: (req.method || 'GET').toUpperCase(),
    query,
    body,
  };
}
