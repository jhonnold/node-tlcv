declare module 'chessboardjs' {
  type Position = string | 'start' | Record<string, string>;

  interface ChessboardConfig {
    position?: Position;
    orientation?: 'white' | 'black';
    showNotation?: boolean;
    draggable?: boolean;
    pieceTheme?: string | ((piece: string) => string);
    appearSpeed?: number | string;
    moveSpeed?: number | string;
    snapSpeed?: number | string;
    snapbackSpeed?: number | string;
    trashSpeed?: number | string;
  }

  interface ChessboardInstance {
    position(position: Position, useAnimation?: boolean): void;
    position(query: 'fen'): string;
    resize(): void;
    destroy(): void;
    clear(useAnimation?: boolean): void;
    fen(): string;
    flip(): string;
    orientation(arg?: 'white' | 'black' | 'flip'): string;
    move(...moves: Array<string | false>): Record<string, string>;
    start(useAnimation?: boolean): void;
  }

  function ChessBoard(elementId: string, config?: ChessboardConfig | Position): ChessboardInstance;

  export = ChessBoard;
}
