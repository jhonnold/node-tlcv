import express from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import routes from './routes';
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
app.use(express.static('public'));

// GET /
// GET /:port
// GET /:port/pgn
// GET /:port/result-table
app.use(routes);
