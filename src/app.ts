import express from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import serveIndex from 'serve-index';
import routes from './routes';
import adminRoutes from './routes/admin';
import { logging } from './util';

export const app = express();

// embedded js view engine (hardly used)
app.set('view engine', 'ejs');

app.use(logging);
app.use(cors());
app.use(bp.json());
app.use(compression());

// TODO: Run static assets through a script for
// production readiness
app.use(express.static('build/public'));

// GET /
// GET /:port
// GET /:port/pgn
// GET /:port/result-table
app.use(routes);

// GET /admin
// POST /admin/new
// POST /admin/reconnect
// POST /admin/close
app.use('/admin', adminRoutes);

// Serve a folder of PGNs
app.use('/pgns', express.static('pgns'), serveIndex('pgns', { icons: true }));
