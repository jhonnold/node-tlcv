export type ColorCode = 'w' | 'b';

export type KibitzerMeta = {
  depth: number;
  score: number;
  nodes: number;
  stm: ColorCode;
  pv: string[] | null;
  pvAlg: string | null;
  pvFen: string | null;
  pvMoveNumber: number | null;
};

export type SerializedKibitzerLiveData = {
  depth: number;
  score: number;
  nodes: number;
  stm: ColorCode;
  pv: string[];
  pvAlg: string;
  pvFen: string;
  pvMoveNumber: number;
  name: string;
};

// Fields only a WINFO/BINFO line carries (uci-to-tlcs `info()`), engine POV where signed. Null when the
// engine did not send them, and absent from moves archived before they were recorded.
export type SearchExtras = {
  seldepth: number | null;
  hashfull: number | null;
  tbhits: number | null;
  // Permille win / draw / loss, engine POV, as sent.
  wdl: [number, number, number] | null;
};

export function emptyExtras(): SearchExtras {
  return { seldepth: null, hashfull: null, tbhits: null, wdl: null };
}

export type MoveMetaData = {
  color: ColorCode;
  number: number;
  move: string;
  depth: number | null;
  score: number | null;
  nodes: number | null;
  // Server wall-clock seconds between moves (Time graph, PGN comment).
  time: number | null;
  // Engine-reported search time in ms, from the same PV line as `nodes`. Absent from
  // moves archived before it was recorded.
  usedTime?: number | null;
  pv: string[] | null;
  pvFen: string | null;
  pvMoveNumber: number | null;
  pvFollowup: string | null;
  pvAlg: string | null;
  kibitzer: KibitzerMeta | null;
} & Partial<SearchExtras>;

export type SerializedLiveData = {
  color: ColorCode;
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  pv: Array<string>;
  pvAlg: string;
  pvFen: string;
  pvMoveNumber: number;
} & SearchExtras;

export type SerializedPlayer = {
  name: string;
  clockTime: number;
  startTime: number;
};

export type SerializedGame = {
  site: string;
  white: SerializedPlayer;
  black: SerializedPlayer;
  liveData: SerializedLiveData;
  fen: string;
  opening: string;
  tablebase: string;
  stm: ColorCode;
  moves: MoveMetaData[];
  startFen: string | null;
  kibitzerLiveData: SerializedKibitzerLiveData | null;
};

/**
 * One board's homepage-style card for the viewer's Boards tab. `score` is the engine's own latest score in
 * pawns, White's view (null if none); `viewerCount` is that board's browsers.
 */
export type BoardSummary = {
  board: number;
  white: string;
  black: string;
  whiteTime: number;
  blackTime: number;
  fen: string;
  score: number | null;
  opening: string;
  moveCount: number;
  viewerCount: number;
};

export type SerializedBroadcast = {
  /** The board this state is for: the one joined, or 1 if that board doesn't exist. */
  board: number;
  /** Every board on the broadcast, ascending; `[1]` for classic TLCS. */
  boards: number[];
  /** Every board's summary, ascending: one per entry of `boards`; empty in replay data, one per board on live data. */
  summaries: BoardSummary[];
  game: SerializedGame;
  spectators: Array<string>;
  chat: Array<string>;
  menu: { [key: string]: string };
};

export enum EmitType {
  UPDATE = 'update',
  CHAT = 'new-chat',
}

export type GameDelta = {
  site?: string;
  white?: SerializedPlayer;
  black?: SerializedPlayer;
  startFen?: string | null;
  fen?: string;
  stm?: ColorCode;
  opening?: string;
  tablebase?: string;
  liveData?: SerializedLiveData;
  newMoves?: MoveMetaData[];
  updatedMoves?: MoveMetaData[];
  resetMoves?: boolean;
  kibitzerLiveData?: SerializedKibitzerLiveData | null;
};

/** Either one board's game delta (`board` + `game`, that board's room) or broadcast-level changes (the port room). */
export type BroadcastDelta = {
  board?: number;
  game?: GameDelta;
  spectators?: Array<string>;
  menu?: { [key: string]: string };
  /** Every board, ascending, after one was added. */
  boards?: number[];
  /** The full list of board summaries, pushed to the port room at most once a second on TLCS-MG broadcasts. */
  summaries?: BoardSummary[];
};

export type H2HCell = {
  results: string;
  wins: number;
  draws: number;
  losses: number;
};

export type StandingsRow = {
  rank: number;
  name: string;
  games: number;
  points: number;
  h2h: H2HCell[];
};

export type ParsedResults = {
  standings: StandingsRow[];
  totalGames: number;
};

export type GameRecord = {
  gameNumber: number;
  white: string;
  black: string;
  result: string;
  pgnUrl?: string;
  metaUrl?: string;
};

export type StoredGameMeta = SerializedGame & { result: string };

export type StoredTournamentResults = {
  site: string;
  port: number;
  updated: string; // ISO 8601 timestamp
  results: string; // raw accumulated CT text dump
  parsedResults: ParsedResults | null;
  parsedGames: GameRecord[];
};

export type ArchiveSummary = {
  slug: string;
  site: string;
  updated: string; // ISO 8601 timestamp
  gameCount: number;
};

/**
 * A lobby card — `GET /broadcasts`. Sorted by viewerCount desc. A board summary for the broadcast's most-watched
 * board (`board`, ties to the lowest id), with these differences: `score` is the kibitzer's, not the engine's
 * own, and null unless `board` is 1 (the kibitzer follows board 1 only); `viewerCount` is browsers on any board.
 */
export type LobbyBroadcast = BoardSummary & {
  port: number;
  /** Boards on the broadcast (1 for classic TLCS). */
  boardCount: number;
  site: string;
};
/** `GET /broadcasts/:port`. `white` / `black` are board 1's; `boards` ascending, `[1]` for classic TLCS. */
export type BroadcastSummary = { port: number; site: string; white: string; black: string; boards: number[] };
/** `GET /archives/:slug` */
export type ArchiveInfo = { site: string; slug: string };
/** `GET /admin/broadcasts` */
export type AdminBroadcast = {
  connection: string;
  host: string;
  port: number;
  site: string;
  ephemeral: boolean;
  viewerCount: number;
};
export type WebhookEventKind = 'game-started' | 'game-finished';
/** `GET /admin/kibitzers` */
export type KibitzerStatus = {
  id: string;
  type: string;
  priority: number;
  enginePath: string;
  threads: number;
  hash: number;
  ready: boolean;
  engineName: string;
  targetPort: number | null;
  targetName: string | null;
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
};
/** `GET /admin/webhooks` */
export type WebhookStatus = {
  id: string;
  type: string;
  name: string;
  url: string;
  ports: number[];
  events: WebhookEventKind[];
};
