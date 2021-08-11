class Player {
  public name: string;
  public depth: string;
  public score: string;

  constructor(name = 'Unknown', depth = '1', score = '0') {
    this.name = name;
    this.depth = depth;
    this.score = score;
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
