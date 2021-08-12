import { Chess, ChessInstance } from 'chess.js';

class Player {
  public name: string;
  public depth: string;
  public score: string;
  public think: string;
  public nodes: string;
  public time: string;
  public startThink: number;
  public lastStart: string;
  public lastEnd: string;
  public pv: string[];

  constructor() {
    this.name = 'Unknown';
    this.depth = '0';
    this.score = '0';
    this.think = '0';
    this.nodes = '0';
    this.time = '0';
    this.lastStart = '';
    this.lastEnd = '';
    this.pv = [];
    this.startThink = new Date().getTime();
  }
}

class ChessGame {
  public name: string;
  public white: Player;
  public black: Player;
  public fen: string;
  public stm: string;

  public instance: ChessInstance;
  public loaded: boolean;

  constructor(name: string) {
    this.name = name;
    this.white = new Player();
    this.black = new Player();
    this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';
    this.stm = 'w';

    this.instance = new Chess();
    this.loaded = false;
  }
}

export default ChessGame;
