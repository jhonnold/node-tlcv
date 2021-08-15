import express, { Response, Request } from 'express';
import cors from 'cors';
import bp from 'body-parser';
import compression from 'compression';
import { logging } from './util';
import broadcasts, { Broadcast } from './broadcast';

const app = express();

app.set('view engine', 'ejs');

app.use(logging);
app.use(cors());
app.use(bp.json());
app.use(compression());
app.use(express.static('public'));

const defaultBroadcast: Broadcast = broadcasts[16093];

app.get('/', (_: Request, res: Response): void => {
  res.render('index', { game: defaultBroadcast.game });
});

app.get('/data', (_: Request, res: Response): void => {
  res.status(200).json(defaultBroadcast.game);
});

app.get('/pgn', (_: Request, res: Response): void => {
  res.status(200).contentType('text/plain').send(defaultBroadcast.game.instance.pgn());
});

app.get('/result-table', (_: Request, res: Response): void => {
  defaultBroadcast.connection.send('RESULTTABLE');
  setTimeout(() => res.status(200).contentType('text/plain').send(defaultBroadcast.results), 5000);
});

app.get('/:name', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.render('index', { game: broadcast.game });
});

app.get('/:name/data', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.status(200).json(broadcast.game);
});

app.get('/:name/pgn', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.status(200).contentType('text/plain').send(broadcast.game.instance.pgn());
});

app.get('/:name/result-table', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else {
    broadcast.connection.send('RESULTTABLE');
    setTimeout(() => res.status(200).contentType('text/plain').send(broadcast.results), 5000);
  }
});

export default app;
