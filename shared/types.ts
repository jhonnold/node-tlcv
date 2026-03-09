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

export type MoveMetaData = {
  color: ColorCode;
  number: number;
  move: string;
  depth: number | null;
  score: number | null;
  nodes: number | null;
  time: number | null;
  pv: string[] | null;
  pvFen: string | null;
  pvMoveNumber: number | null;
  pvFollowup: string | null;
  pvAlg: string | null;
  kibitzer: KibitzerMeta | null;
};

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
};

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

export type SerializedBroadcast = {
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
  resetMoves?: boolean;
  kibitzerLiveData?: SerializedKibitzerLiveData | null;
};

export type BroadcastDelta = {
  game?: GameDelta;
  spectators?: Array<string>;
  menu?: { [key: string]: string };
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
