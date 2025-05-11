/* eslint-disable max-classes-per-file */
import { Chess, Move, validateFen } from 'chess.js';
import dayjs from 'dayjs';
import { logger } from './util/index';

export interface SerializedPlayer {
  name: string;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  clockTime: number;
  startTime: number;
  lastMove: Move | null;
  pvAlg: string[];
  pv: string[];
  pvFen: string;
  pvMoveNumber: number;
}

export interface SerializedGame {
  name: string;
  site: string;
  white: SerializedPlayer;
  black: SerializedPlayer;
  fen: string;
  opening: string;
  tablebase: string;
  stm: 'w' | 'b';
  moveNumber: number;
}

export interface MoveMetaData {
  number: number;
  move: string;
  depth: number;
  score: number;
  nodes: number;
}

export interface LichessExplorerResponse {
  opening: { eco: string; name: string } | null;
}

export interface LichessTablebaseResponse {
  category: string | null;
}

export class Player {
  name: string;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  clockTime: number;
  startTime: number;
  lastMove: Move | null;
  pv: string[]; // san representation
  pvFen: string;
  pvMoveNumber: number;
  pvAlg: string[];
  moves: MoveMetaData[];

  constructor() {
    this.name = 'Unknown';
    this.depth = 0;
    this.score = 0.0;
    this.nodes = 0;
    this.usedTime = 0;
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
    this.pv = [];
    this.pvFen = '8/8/8/8/8/8/8/8 w - - 0 1';
    this.pvMoveNumber = 0;
    this.pvAlg = [];
    this.moves = [];
  }

  reset(): void {
    this.name = 'Unknown';
    this.depth = 0;
    this.score = 0.0;
    this.nodes = 0;
    this.usedTime = 0;
    this.clockTime = 0;
    this.startTime = 0;
    this.lastMove = null;
    this.pv = [];
    this.pvMoveNumber = 0;
    this.pvAlg = [];
    this.moves = [];
  }

  toJSON(): SerializedPlayer {
    return {
      name: this.name,
      depth: this.depth,
      score: this.score,
      nodes: this.nodes,
      usedTime: this.usedTime,
      clockTime: this.clockTime,
      startTime: this.startTime,
      lastMove: this.lastMove,
      pv: this.pv,
      pvFen: this.pvFen,
      pvMoveNumber: this.pvMoveNumber,
      pvAlg: this.pvAlg,
    };
  }
}

export class ChessGame {
  name: string;
  site: string;
  white: Player;
  black: Player;
  instance: Chess;
  loaded: boolean;
  fen: string;
  opening: string;
  tablebase: string;
  moveNumber: number;
  fmr: number;

  constructor(name: string) {
    this.name = name;
    this.site = '';
    this.white = new Player();
    this.black = new Player();

    this.instance = new Chess();
    this.loaded = false;

    this.fen = this.instance.fen();
    this.opening = 'Unknown';
    this.tablebase = '';
    this.moveNumber = 1;
    this.fmr = 0;

    this.setPGNHeaders();
  }

  private setPGNHeaders(): void {
    this.instance.setHeader('Site', this.site);
    this.instance.setHeader('Event', this.site);
    this.instance.setHeader('Date', dayjs().format('YYYY.MM.DD'));
    this.instance.setHeader('White', this.white.name);
    this.instance.setHeader('Black', this.black.name);
  }

  reset(): void {
    this.instance = new Chess();
    this.loaded = true;

    this.fen = this.instance.fen();
    this.opening = 'Unknown';
    this.tablebase = '';
    this.moveNumber = this.instance.moveNumber();
    this.fmr = 0;

    this.setPGNHeaders();
  }

  resetFromFen(): void {
    const fen = [this.fen, this.fmr, this.moveNumber].join(' ');

    const { ok: valid, ...err } = validateFen(fen);

    if (valid) {
      logger.info(`Setting fen for game ${this.name} to ${fen}`, { port: this.name });
      this.instance.load(fen);
      this.loaded = true;
      this.setPGNHeaders();
    } else {
      logger.error(`Unable to load fen ${fen} for game ${this.name} - ${err.error}`, { port: this.name });
    }
  }

  async setOpening(): Promise<void> {
    const history = this.instance.history({ verbose: true });
    if (!history.length) return;

    const moves = history.map((move) => `${move.from}${move.to}`).join(',');
    const url = `https://explorer.lichess.ovh/master?play=${moves}`;

    logger.info(`Requesting opening for game ${this.name} from ${url}`, { port: this.name });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = (await response.json()) as LichessExplorerResponse;
      const { opening } = data;

      logger.info(`Received opening response for game ${this.name} - ${JSON.stringify(opening)}`, { port: this.name });

      if (opening) {
        const { eco, name } = opening;

        logger.info(`Setting opening for game ${this.name} to ${eco} ${name}`, { port: this.name });
        this.opening = `${eco} ${name}`;
      }
    } catch (error) {
      logger.warn(`Error requesting opening for game ${this.name} @ ${url}`, { port: this.name });
      logger.error(error);
    }
  }

  async setTablebase(): Promise<void> {
    const url = `https://tablebase.lichess.ovh/standard?fen=${this.fen}`;

    logger.info(`Requesting tablebase for game ${this.name} from ${url}`, { port: this.name });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as LichessTablebaseResponse;
      const { category } = data;

      logger.info(`Received tb category response for game ${this.name}: ${category}`, { port: this.name });

      if (category) {
        switch (category) {
          case 'win':
          case 'maybe-win':
            this.tablebase = this.instance.turn() === 'w' ? 'White Win' : 'Black Win';
            break;
          case 'cursed-win':
          case 'draw':
          case 'cursed-loss':
            this.tablebase = 'Draw';
            break;
          case 'loss':
          case 'maybe-loss':
            this.tablebase = this.instance.turn() === 'w' ? 'Black Win' : 'White Win';
            break;
          case 'unknown':
            this.tablebase = '';
            break;
          default:
            logger.warn(`Unknown tablebase category ${category} for game ${this.name}, setting tablebase to blank`, {
              port: this.name,
            });
            this.tablebase = '';
        }
        logger.info(`Set tablebase for game ${this.name} to ${this.tablebase}`, { port: this.name });
      } else {
        logger.info(`Setting tablebase for game ${this.name} to blank`, { port: this.name });
        this.tablebase = '';
      }
    } catch (error) {
      logger.warn(`Error requesting tablebase for game ${this.name} @ ${url}`, { port: this.name });
      logger.error(error);
      this.tablebase = '';
    }
  }

  toJSON(): SerializedGame {
    return {
      name: this.name,
      site: this.site,
      white: this.white.toJSON(),
      black: this.black.toJSON(),
      fen: this.instance.fen(),
      opening: this.opening,
      tablebase: this.tablebase,
      stm: this.instance.turn(),
      moveNumber: this.moveNumber,
    };
  }
}
