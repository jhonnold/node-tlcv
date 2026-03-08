import { Chess } from 'chess.js';
import type { ColorCode } from '../../shared/types.js';
import { logger } from '../util/index.js';

export type LichessExplorerResponse = {
  opening: { eco: string; name: string } | null;
};

export type LichessTablebaseResponse = {
  category: string | null;
};

export async function fetchOpening(name: string, instance: Chess): Promise<string | null> {
  const history = instance.history({ verbose: true });
  if (!history.length) return null;

  const moves = history.map((move) => `${move.from}${move.to}`).join(',');
  const url = `https://explorer.lichess.org/masters?play=${moves}`;

  logger.info(`Requesting opening for game ${name} from ${url}`, { port: name });

  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (process.env.LICHESS_OAUTH_TOKEN) {
      headers.Authorization = `Bearer ${process.env.LICHESS_OAUTH_TOKEN}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    const data: LichessExplorerResponse = await response.json();
    const { opening } = data;

    logger.info(`Received opening response for game ${name} - ${JSON.stringify(opening)}`, { port: name });

    if (opening) {
      const { eco, name: openingName } = opening;

      logger.info(`Setting opening for game ${name} to ${eco} ${openingName}`, { port: name });
      return `${eco} ${openingName}`;
    }
  } catch (error) {
    logger.warn(`Error requesting opening for game ${name} @ ${url}`, { port: name });
    logger.error(error);
  }

  return null;
}

export async function fetchTablebase(name: string, fen: string, turn: ColorCode): Promise<string> {
  const url = `https://tablebase.lichess.ovh/standard?fen=${fen}`;

  logger.info(`Requesting tablebase for game ${name} from ${url}`, { port: name });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data: LichessTablebaseResponse = await response.json();
    const { category } = data;

    logger.info(`Received tb category response for game ${name}: ${category}`, { port: name });

    if (category) {
      const outcome: Record<string, 'stm' | 'draw' | 'opp' | ''> = {
        win: 'stm',
        'maybe-win': 'stm',
        'cursed-win': 'draw',
        draw: 'draw',
        'cursed-loss': 'draw',
        loss: 'opp',
        'maybe-loss': 'opp',
        unknown: '',
      };

      const mapped = outcome[category];
      let result: string;

      if (mapped === undefined) {
        logger.warn(`Unknown tablebase category ${category} for game ${name}, setting tablebase to blank`, {
          port: name,
        });
        result = '';
      } else if (mapped === 'stm') {
        result = turn === 'w' ? 'White Win' : 'Black Win';
      } else if (mapped === 'opp') {
        result = turn === 'w' ? 'Black Win' : 'White Win';
      } else if (mapped === 'draw') {
        result = 'Draw';
      } else {
        result = '';
      }

      logger.info(`Set tablebase for game ${name} to ${result}`, { port: name });
      return result;
    } else {
      logger.info(`Setting tablebase for game ${name} to blank`, { port: name });
      return '';
    }
  } catch (error) {
    logger.warn(`Error requesting tablebase for game ${name} @ ${url}`, { port: name });
    logger.error(error);
    return '';
  }
}
