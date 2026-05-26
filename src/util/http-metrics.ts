import { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import { httpRequestDuration } from '../metrics.js';

// Static assets are served from build/public: JS bundles + CSS at the root
// (main.bundle.js, main.css, …), the img/ and audio/ dirs, favicon, and the /pgns
// mount. These URLs are unbounded (one path per asset/game), so collapse them all
// into a single `<static>` label to defend against a cardinality explosion. Match
// by asset extension + dir so root-level bundles are covered too, not just subdirs.
const STATIC_PATH = /^\/(img|audio|pgns)(\/|$)|\.(js|mjs|css|map|ico|png|svg|jpe?g|gif|webp|mp3|wav|woff2?|ttf)$/i;

// Reduce a request to a low-cardinality `route` label. Read inside `onFinished`,
// where routing has completed and `req.route` is populated. `originalPath` is the
// request path captured at entry — see the note in the middleware on why req.path
// can't be trusted here.
const routeLabel = (req: Request, originalPath: string): string => {
  if (req.route?.path) {
    // `baseUrl` is the router mount prefix (e.g. "/admin"); `route.path` is the
    // in-router pattern (e.g. "/:port([0-9]+)/pgn"). Strip Express inline regex
    // constraints so "/:port([0-9]+)/pgn" -> "/:port/pgn".
    const raw = (req.baseUrl || '') + req.route.path;
    const cleaned = raw.replace(/\([^)]*\)/g, '');
    return cleaned === '' ? '/' : cleaned;
  }

  // No matched handler: static assets vs the `app.use('*')` catch-all.
  return STATIC_PATH.test(originalPath) ? '<static>' : '<unmatched>';
};

export default (req: Request, res: Response, next: NextFunction): void => {
  // Skip the Prometheus self-scrape (hit every ~30s) and Socket.IO transport
  // polling — neither is a content route, and both would dominate the per-route
  // panels and pollute latency.
  if (req.path === '/admin/metrics' || req.path.startsWith('/socket.io')) {
    next();
    return;
  }

  // Capture the path now: a fall-through to `app.use('*')` rewrites req.url/req.path
  // by the time `onFinished` fires, so the static-vs-unmatched fallback must
  // classify against the original path captured here, not the mutated req.path.
  const originalPath = req.path;
  const start = process.hrtime.bigint();

  const observe = (): void => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(
      { method: req.method, route: routeLabel(req, originalPath), status: String(res.statusCode) },
      seconds,
    );
  };

  onFinished(res, observe);
  next();
};
