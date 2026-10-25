import express from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import serveIndex from 'serve-index';
import routes from './routes/index.js';
import adminRoutes from './routes/admin.js';
import { PGNS_ROOT } from './services/pgn-storage.js';
import { logging, httpMetrics } from './util/index.js';

export const app = express();

app.use(logging);
app.use(httpMetrics);
app.use(cors());
app.use(bp.json());
app.use(compression());

// TODO: Run static assets through a script for
// production readiness
// Directory requests don't fall back to index.html; page routes send the shell via
// sendApp (`/index.html` itself is still served directly).
app.use(express.static('build/public', { index: false }));

// Serve a folder of PGNs
app.use('/pgns', express.static(PGNS_ROOT), serveIndex(PGNS_ROOT, { icons: true }));

// SPA shell: GET /, GET /:port, GET /archive/:slug
// JSON API: GET /broadcasts[/…], GET /archives[/…]
// Legacy text: GET /:port/pgn, GET /:port/result-table
app.use(routes);

// SPA shell: GET /admin
// JSON API: GET|POST|DELETE /admin/broadcasts, /admin/kibitzers, /admin/webhooks,
//           GET /admin/connection-history, GET /admin/metrics
app.use('/admin', adminRoutes);

// Just forward to the base route on 404
app.use('*', (_, res) => res.redirect('/'));
