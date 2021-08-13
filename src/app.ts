import express, { Response, Request } from 'express';
import cors from 'cors';
import bp from 'body-parser';
import { logging } from './util';
import { game } from './broadcast';

const app = express();

app.set('view engine', 'ejs');

app.use(logging);
app.use(cors());
app.use(bp.json());
app.use(express.static('public'));

app.get('/', (_: Request, res: Response): void => {
  res.render('index', { game });
});

app.get('/data', (_: Request, res: Response): void => {
  res.status(200).send({ ...game, instanceFen: game.instance.fen(), pgn: game.instance.pgn() });
});

export default app;
