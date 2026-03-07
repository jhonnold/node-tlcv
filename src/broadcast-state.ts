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

  addChat(message: string): void {
    this.chat.push(message);
  }

  addSpectator(name: string): void {
    this.spectators.add(name);
  }

  removeSpectator(name: string): boolean {
    return this.spectators.delete(name);
  }

  hasSpectator(name: string): boolean {
    return this.spectators.has(name);
  }

  setMenu(name: string, url: string): void {
    this.menu.set(name, url);
  }

  toJSON(includeChat = false): {
    spectators: Array<string>;
    chat: Array<string>;
    menu: { [key: string]: string };
  } {
    const menu: { [key: string]: string } = {};
    for (const e of this.menu.entries()) menu[e[0]] = e[1];

    return {
      spectators: Array.from(this.spectators),
      chat: includeChat ? this.chat.slice(-1000) : [],
      menu,
    };
  }
}
