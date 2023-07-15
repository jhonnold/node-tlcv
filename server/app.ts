import express from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import serveIndex from 'serve-index';
import routes from './routes/index.js';
import adminRoutes from './routes/admin.js';
import { logging } from './util/index.js';

export const app = express();

app.use(logging);
app.use(cors());
app.use(bp.json());
app.use(compression());
app.use(express.static('build/public'));
app.use('/pgns', express.static('pgns'), serveIndex('pgns', { icons: true }));

// GET /api/:port/pgn
// GET /api/:port/result-table
app.use('/api', routes);

// GET  /admin
// POST /admin/new
// POST /admin/reconnect
// POST /admin/close
app.use('/admin', adminRoutes);
