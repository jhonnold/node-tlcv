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

const DEFAULT_PORT = 16093;

app.get('/', (_: Request, res: Response): void => {
  res.redirect(`/${DEFAULT_PORT}`);
});

app.get('/:name(160[0-9]{2})', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.render('index', { game: broadcast.game, port: broadcast.port });
});

app.get('/:name(160[0-9]{2})/data', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.status(200).json(broadcast.game);
});

app.get('/:name(160[0-9]{2})/pgn', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else res.status(200).contentType('text/plain').send(broadcast.game.instance.pgn());
});

app.get('/:name(160[0-9]{2})/result-table', (req: Request, res: Response): void => {
  const name: number = +req.params.name;
  const broadcast: Broadcast | undefined = broadcasts[name];

  if (!broadcast) res.sendStatus(404);
  else {
    broadcast.connection.send('RESULTTABLE');
    setTimeout(() => res.status(200).contentType('text/plain').send(broadcast.results), 5000);
  }
});

export default app;
