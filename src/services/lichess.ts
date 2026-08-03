import type { ColorCode } from '../../shared/types.js';
import { env } from '../config/env.js';
import { lichessRequestDuration } from '../metrics.js';
import { logger } from '../util/index.js';

export type LichessExplorerResponse = {
  opening: { eco: string; name: string } | null;
};

export type LichessTablebaseResponse = {
  category: string | null;
};

export type OpeningResult = { failed: boolean; opening: string | null };

// Lichess only has tables up to 7 pieces; anything richer is a guaranteed miss.
const TABLEBASE_MAX_PIECES = 7;

// Tablebase verdicts are reported from the side to move's perspective.
const TABLEBASE_OUTCOME: Record<string, 'stm' | 'draw' | 'opp' | ''> = {
  win: 'stm',
  'maybe-win': 'stm',
  'cursed-win': 'draw',
  draw: 'draw',
  'cursed-loss': 'draw',
  loss: 'opp',
  'maybe-loss': 'opp',
  unknown: '',
};

function lichessHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (env.lichessToken) headers.Authorization = `Bearer ${env.lichessToken}`;

  return headers;
}

/**
 * Looks the position up in the masters explorer. `moves` is the game's move list in
 * coordinate notation, accumulated by the caller as moves are played — asking
 * chess.js to rebuild the history per lookup is quadratic over the course of a game.
 */
export async function fetchOpening(name: string, moves: string[]): Promise<OpeningResult> {
  if (!moves.length) return { failed: false, opening: null };

  const url = `https://explorer.lichess.org/masters?play=${moves.join(',')}`;
  logger.debug(`Requesting opening for game ${name} from ${url}`, { port: name });

  const endTimer = lichessRequestDuration.startTimer({ endpoint: 'opening' });
  try {
    const response = await fetch(url, { method: 'GET', headers: lichessHeaders() });
    const data: LichessExplorerResponse = await response.json();
    const { opening } = data;

    logger.debug(`Received opening response for game ${name} - ${JSON.stringify(opening)}`, { port: name });
    endTimer({ outcome: 'success' });

    if (!opening) return { failed: false, opening: null };

    logger.info(`Setting opening for game ${name} to ${opening.eco} ${opening.name}`, { port: name });
    return { failed: false, opening: `${opening.eco} ${opening.name}` };
  } catch (error) {
    endTimer({ outcome: 'error' });
    logger.warn(`Error requesting opening for game ${name} @ ${url}`, { port: name });
    logger.error(error);
    return { failed: true, opening: null };
  }
}

function pieceCount(fen: string): number {
  const board = fen.split(' ')[0] ?? '';

  let count = 0;
  for (const char of board) if (/[a-z]/i.test(char)) count++;

  return count;
}

export async function fetchTablebase(name: string, fen: string, turn: ColorCode): Promise<string> {
  // Skipping the lookup outright — rather than issuing a request that cannot hit —
  // keeps a per-move HTTPS round trip off the message loop for most of every game.
  if (pieceCount(fen) > TABLEBASE_MAX_PIECES) return '';

  const url = `https://tablebase.lichess.ovh/standard?fen=${fen}`;
  logger.debug(`Requesting tablebase for game ${name} from ${url}`, { port: name });

  const endTimer = lichessRequestDuration.startTimer({ endpoint: 'tablebase' });
  try {
    const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data: LichessTablebaseResponse = await response.json();
    const { category } = data;

    logger.debug(`Received tb category response for game ${name}: ${category}`, { port: name });
    endTimer({ outcome: 'success' });

    if (!category) return '';

    const outcome = TABLEBASE_OUTCOME[category];
    if (outcome === undefined) {
      logger.warn(`Unknown tablebase category ${category} for game ${name}, setting tablebase to blank`, {
        port: name,
      });
      return '';
    }

    // A "stm" verdict names the mover as the winner and an "opp" verdict names the
    // other side, so the winner is white exactly when the two agree.
    const result = outcome === 'draw' ? 'Draw' : outcome === '' ? '' : winner(outcome === 'stm', turn);

    logger.info(`Set tablebase for game ${name} to ${result}`, { port: name });
    return result;
  } catch (error) {
    endTimer({ outcome: 'error' });
    logger.warn(`Error requesting tablebase for game ${name} @ ${url}`, { port: name });
    logger.error(error);
    return '';
  }
}

function winner(moverWins: boolean, turn: ColorCode): string {
  return moverWins === (turn === 'w') ? 'White Win' : 'Black Win';
}
