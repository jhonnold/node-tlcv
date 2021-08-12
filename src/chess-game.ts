class Player {
  public name: string;
  public depth: string;
  public score: string;
  public think: string;
  public nodes: string;
  public time: string;
  public startThink: number;
  public pv: string[];

  constructor(name = 'Unknown', depth = '1', score = '0', think = '0', nodes = '0', time = '0') {
    this.name = name;
    this.depth = depth;
    this.score = score;
    this.think = think;
    this.nodes = nodes;
    this.time = time;
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

  constructor(name: string) {
    this.name = name;
    this.white = new Player();
    this.black = new Player();
    this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';
    this.stm = 'w';
  }
}

export default ChessGame;
