import type { ParsedResults, GameRecord } from './services/result-parser.js';

export class BroadcastState {
  readonly chat: Array<string>;
  readonly spectators: Set<string>;
  readonly menu: Map<string, string>;
  results: string;
  parsedResults: ParsedResults | null;
  parsedGames: GameRecord[] | null;
  currentGameNumber: number;
  browserCount: number;

  constructor() {
    this.chat = [];
    this.spectators = new Set();
    this.menu = new Map<string, string>();
    this.results = '';
    this.parsedResults = null;
    this.parsedGames = null;
    this.currentGameNumber = 1;
    this.browserCount = 0;
  }

  toJSON(includeChat = false): {
    spectators: Array<string>;
    chat: Array<string>;
    menu: { [key: string]: string };
  } {
    return {
      spectators: Array.from(this.spectators),
      chat: includeChat ? this.chat.slice(-1000) : [],
      menu: menuToObject(this.menu),
    };
  }
}

export function menuToObject(menu: Map<string, string>): { [key: string]: string } {
  const obj: { [key: string]: string } = {};
  for (const e of menu.entries()) obj[e[0]] = e[1];
  return obj;
}
