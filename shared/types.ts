export type MoveMetaData = {
  color: 'w' | 'b';
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
};

export type SerializedLiveData = {
  color: 'w' | 'b';
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  pv: Array<string>;
  pvAlg: Array<string>;
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
  stm: 'w' | 'b';
  moves: MoveMetaData[];
  startFen: string | null;
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
