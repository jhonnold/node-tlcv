import express, { Response, Request } from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import { logging } from './util';
import { game } from './broadcast';

const app = express();

app.set('view engine', 'ejs');

app.use(logging);
app.use(cors());
app.use(bp.json());
app.use(compression());
app.use(express.static('public'));

app.get('/', (_: Request, res: Response): void => {
  res.render('index', { game });
});

app.get('/data', (_: Request, res: Response): void => {
  res.status(200).json(game);
});

export default app;
