import { ChessGame } from './chess-game.js';
import { logger } from './util/index.js';
import type { Broadcast } from './broadcast.js';
import type { KibitzerManager } from './kibitzer/kibitzer-manager.js';
import { getWebhookManager } from './broadcast-manager.js';
import { fetchOpening, fetchTablebase } from './services/lichess.js';
import type { OpeningResult } from './services/lichess.js';
import { savePgn } from './services/pgn.js';
import { saveGameMeta } from './services/game-meta.js';
import { Command } from './protocol.js';
import { replayUciFromFen } from './util/uci.js';
import { colorName } from '../shared/colors.js';
import type { ColorName } from '../shared/colors.js';
import type { ColorCode, GameDelta, MoveMetaData, SearchExtras } from '../shared/types.js';
import { emptyExtras } from '../shared/types.js';

export type CommandTokens = [Command, ...Array<string>];

// A handler returns a chat line to emit, or nothing. Everything else it changed is
// signalled through `dirty`, which drives the delta the batch ends up emitting.
export type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<string | void> | string | void;
  split: boolean;
};

// The per-game commands, handled by a BoardService. Every other `Command` is broadcast-level (GameService).
const BOARD_COMMANDS = [
  Command.FEN,
  Command.WPLAYER,
  Command.BPLAYER,
  Command.WPV,
  Command.BPV,
  Command.WINFO,
  Command.BINFO,
  Command.WTIME,
  Command.BTIME,
  Command.WMOVE,
  Command.BMOVE,
  Command.RESULT,
  Command.FMR,
  Command.LEVEL,
  Command.GAMENO,
] as const;

export type BoardCommand = (typeof BOARD_COMMANDS)[number];

const BOARD_COMMAND_SET: ReadonlySet<Command> = new Set(BOARD_COMMANDS);

export function isBoardCommand(cmd: Command): cmd is BoardCommand {
  return BOARD_COMMAND_SET.has(cmd);
}

type BoardCommandConfig = {
  [key in BoardCommand]: ConfigItem;
};

type DirtyKey = 'liveData' | 'clocks' | 'move' | 'movesPatched' | 'players' | 'site';

type ParsedPv = {
  depth: number;
  score: number;
  nodes: number;
  usedTime: number;
  pv: string[];
  // Only WINFO/BINFO carry these; null for a WPV/BPV line.
  ext: SearchExtras | null;
};

type PvUpdate = Omit<ParsedPv, 'pv'> & {
  pvMoveNumber: number;
  san: string[];
  alg: string[];
  fen: string;
};

// WINFO tags whose value is a single integer.
const INFO_INT_TAGS = new Set(['depth', 'seldepth', 'nodes', 'time', 'hashfull', 'tbhits']);

/** One game on a broadcast: its ChessGame, the per-game command handlers, and the state behind its GameDelta. */
class BoardService {
  readonly commandConfig: BoardCommandConfig;
  readonly id: number;
  readonly game: ChessGame;
  // Browsers watching this board (socket-io-adapter); Broadcast.browserCount sums them.
  browserCount = 0;
  private broadcast: Broadcast;
  // A board created mid-batch never sees beginBatch(); these defaults (empty sets,
  // moveCountBefore 0) are exactly what it would set for a fresh game.
  private dirty = new Set<DirtyKey>();
  private moveCountBefore = 0;
  // The moveMeta array the batch started with; reset() / resetFromFen() replace it.
  private movesAtBatchStart: MoveMetaData[] = [];
  // Moves whose meta was patched retroactively this batch, and the position the most
  // recent move was played from (the base a trailing PV replays against).
  private patchedMoves = new Set<MoveMetaData>();
  private fenBeforeLastMove: string | null = null;
  // "Game started" detection: armed for the first game, re-armed after each
  // RESULT. Fires once both colors have been (re)announced for the new game.
  private gameStartArmed = true;
  private startColorsSeen = new Set<ColorName>();
  // TLCS-MG: the tournament number of the game whose `result:` comes next (spec §5.1).
  private pendingGameNo: number | null = null;
  // What the last move left for the Lichess lookups, run by lookUpPosition(): once per batch, not
  // per move (a snapshot batch holds thousands). A reset replaces uciHistory and so voids it.
  private pendingLookup: { fen: string; turn: ColorCode; uciHistory: string[] } | null = null;

  constructor(broadcast: Broadcast, id: number) {
    this.broadcast = broadcast;
    this.id = id;
    this.game = new ChessGame(id === 1 ? String(broadcast.port) : `${broadcast.port}:${id}`, () => broadcast.site);
    // Board 1 starts unloaded so classic TLCS's first FEN (possibly mid-game) loads as is. A
    // TLCS-MG board's first FEN is always startpos (a new game, or a snapshot's position steps),
    // which only a loaded game treats as a plain new game rather than a SetUp position.
    if (id !== 1) this.game.reset();

    this.commandConfig = {
      [Command.FEN]: { fn: this.onFen.bind(this), split: true },
      [Command.WPLAYER]: { fn: this.onPlayer.bind(this), split: false },
      [Command.BPLAYER]: { fn: this.onPlayer.bind(this), split: false },
      [Command.WPV]: { fn: this.onPV.bind(this), split: true },
      [Command.BPV]: { fn: this.onPV.bind(this), split: true },
      [Command.WINFO]: { fn: this.onInfo.bind(this), split: true },
      [Command.BINFO]: { fn: this.onInfo.bind(this), split: true },
      [Command.WTIME]: { fn: this.onTime.bind(this), split: true },
      [Command.BTIME]: { fn: this.onTime.bind(this), split: true },
      [Command.WMOVE]: { fn: this.onMove.bind(this), split: true },
      [Command.BMOVE]: { fn: this.onMove.bind(this), split: true },
      [Command.RESULT]: { fn: this.onResult.bind(this), split: false },
      [Command.FMR]: { fn: this.onFmr.bind(this), split: false },
      [Command.GAMENO]: { fn: this.onGameNo.bind(this), split: false },
      // Recognized but intentionally ignored — connection-time handshake/config
      // lines the viewer derives nothing from (see docs/protocol.md "No-op protocol commands").
      [Command.LEVEL]: { fn: () => {}, split: false },
    };
  }

  // One kibitzer per broadcast; it follows board 1.
  private get kibitzer(): KibitzerManager | null {
    return this.id === 1 ? this.broadcast.kibitzerManager : null;
  }

  private onGameNo(tokens: CommandTokens): void {
    const gameNo = parseInt(tokens[1]);
    this.pendingGameNo = gameNo > 0 ? gameNo : null;
    logger.debug(`Updated game ${this.game.name} - GAMENO: ${this.pendingGameNo}`, { port: this.broadcast.port });
  }

  private onFmr(tokens: CommandTokens): void {
    const [, fmr] = tokens;

    this.game.fmr = parseInt(fmr);
    logger.debug(`Updated game ${this.game.name} - FMR: ${this.game.fmr}`, {
      port: this.broadcast.port,
    });
  }

  private onFen(tokens: CommandTokens): void {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken === 'w' || lastToken === 'b') fenTokens.push('-');

    // Always push on ep square
    fenTokens.push('-');

    this.game.fen = fenTokens.join(' '); // build the fen

    if (!this.game.loaded) {
      this.game.resetFromFen();
      this.dirty.add('move').add('liveData');
      logger.info(`Unloaded game ${this.game.name}, setting to FEN: ${this.game.instance.fen()}`, {
        port: this.broadcast.port,
      });
    } else if (this.game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this.game.reset();
      this.dirty.add('move').add('liveData');
      logger.info(`Received startpos for game ${this.game.name}, reseting the game.`, { port: this.broadcast.port });
    } else {
      logger.debug(`Set backup FEN for ${this.game.name}: ${this.game.fen}`, { port: this.broadcast.port });
    }
  }

  private onPlayer(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color = colorName(command === Command.WPLAYER ? 'w' : 'b');
    // A new game: a GAMENO still pending belongs to a game whose result was lost (spec §7).
    if (command === Command.WPLAYER) this.pendingGameNo = null;
    this.game[color].reset();
    this.game[color].name = name;
    this.game.liveData.reset(this.game.instance.turn(), this.game.moveNumber);
    logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`, {
      port: this.broadcast.port,
    });

    this.dirty.add('players').add('liveData');

    // onPlayer fires once per color. Notify "game started" exactly once, when
    // both colors have been announced for this game (independent of the
    // 100ms-debounced currentGameNumber advance).
    if (this.gameStartArmed) {
      this.startColorsSeen.add(color);
      if (this.startColorsSeen.size === 2) {
        this.gameStartArmed = false;
        this.startColorsSeen.clear();
        // Board 1 only for now: the event names no board, and its CT-derived number
        // means nothing for a concurrent game.
        if (this.id === 1) {
          getWebhookManager()?.dispatch({
            kind: 'game-started',
            port: this.broadcast.port,
            gameNumber: this.broadcast.currentGameNumber,
            white: this.game.white.name,
            black: this.game.black.name,
            site: this.broadcast.site,
          });
        }
      }
    }
  }

  // WPV/BPV payloads are positional: depth score time nodes pv... Null if any number is malformed.
  private parsePvTokens(rest: string[]): ParsedPv | null {
    const [depthStr, scoreStr, timeStr, nodesStr, ...pv] = rest;
    const parsed: ParsedPv = {
      depth: parseInt(depthStr),
      score: parseInt(scoreStr) / 100,
      nodes: parseInt(nodesStr),
      usedTime: parseInt(timeStr) * 10,
      pv,
      ext: null,
    };

    const { depth, score, nodes, usedTime } = parsed;
    return [depth, score, nodes, usedTime].every(Number.isFinite) ? parsed : null;
  }

  // WINFO/BINFO payloads are tag/value pairs in raw UCI units (ms, engine POV), `pv` last.
  // Tags are read by walking the line, so unknown ones (nps, lowerbound, ...) are skipped
  // without knowing their arity. Null if a core field or the pv is missing.
  private parseInfoTokens(tokens: string[]): ParsedPv | null {
    const ints: Partial<Record<string, number>> = {};
    let score = NaN;
    let wdl: SearchExtras['wdl'] = null;
    let pv: string[] | null = null;

    for (let i = 0; i < tokens.length && pv === null; i++) {
      const tag = tokens[i];
      if (INFO_INT_TAGS.has(tag)) {
        const value = parseInt(tokens[++i]);
        if (Number.isFinite(value)) ints[tag] = value;
        continue;
      }
      switch (tag) {
        case 'score': {
          const value = parseInt(tokens[i + 2]);
          if (tokens[i + 1] === 'cp') score = value / 100;
          // Same encoding as WPV: the mate distance rides as cp, so ±M renders without special-casing.
          else if (tokens[i + 1] === 'mate') score = ((value >= 0 ? 1 : -1) * (100000 - Math.abs(value))) / 100;
          i += 2;
          break;
        }
        case 'wdl': {
          const triple = tokens.slice(i + 1, i + 4).map((t) => parseInt(t));
          if (triple.every(Number.isFinite)) wdl = triple as SearchExtras['wdl'];
          i += 3;
          break;
        }
        case 'pv':
          pv = tokens.slice(i + 1);
          break;
      }
    }

    const { depth = NaN, nodes = NaN, time: usedTime = NaN } = ints;
    if (pv === null || ![depth, score, nodes, usedTime].every(Number.isFinite)) return null;
    const ext: SearchExtras = {
      seldepth: ints.seldepth ?? null,
      hashfull: ints.hashfull ?? null,
      tbhits: ints.tbhits ?? null,
      wdl,
    };
    return { depth, score, nodes, usedTime, pv, ext };
  }

  private applyPvToMeta(
    meta: MoveMetaData,
    { depth, score, nodes, usedTime, ext, pvMoveNumber, san, alg, fen }: PvUpdate,
  ): void {
    meta.depth = depth;
    meta.score = score;
    meta.nodes = nodes;
    meta.usedTime = usedTime;
    // A WPV-only update leaves the extras a prior WINFO set on this move alone.
    if (ext) Object.assign(meta, ext);
    meta.pv = san.length ? [...san] : null;
    meta.pvFen = fen;
    meta.pvMoveNumber = pvMoveNumber;
    meta.pvFollowup = alg[1] || null;
    meta.pvAlg = alg[0] || null;

    this.game.instance.setComment(`(${san.join(' ')}) ${score.toFixed(2)}/${depth} ${meta.time ?? 0}`);
  }

  // A PV for the non-thinking color may be that engine's final flush for the move it
  // just played (see the "optional trailing XPV flush" in docs/protocol.md). If so,
  // patch the recorded move's meta rather than dropping the line.
  private applyTrailingPv(colorCode: ColorCode, parsed: ParsedPv): void {
    const lastMove = this.game.moveMeta[this.game.moveMeta.length - 1];
    if (!lastMove || lastMove.color !== colorCode || !this.fenBeforeLastMove) return;

    const { depth, nodes, pv } = parsed;

    // A shallower line, or one with fewer nodes (unsequenced XPV reordered), is a stale
    // iteration, not the final flush.
    if (depth < (lastMove.depth ?? 0) || nodes < (lastMove.nodes ?? 0)) return;

    // The trailing PV describes the search that produced the move just played, so it
    // replays from the position that move was made from.
    const playout = replayUciFromFen(this.fenBeforeLastMove, pv);
    // The PV must open with the move actually played; otherwise it belongs to a
    // different position and must not overwrite this move's meta.
    if (!playout || playout.san[0] !== lastMove.move) return;

    this.applyPvToMeta(lastMove, { ...parsed, pvMoveNumber: lastMove.number, ...playout });

    logger.info(
      `Updated game ${this.game.name} - Trailing PV for move ${lastMove.number}: Color: ${colorCode}, Depth: ${depth}, Score: ${parsed.score}, Nodes: ${nodes}`,
      { port: this.broadcast.port },
    );

    this.patchedMoves.add(lastMove);
    this.dirty.add('movesPatched');
  }

  private onPV(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;
    this.applyPvLine(command === Command.WPV ? 'w' : 'b', this.parsePvTokens(rest));
  }

  // WINFO is sent right after the WPV/BPV it refines, so it carries the same search and
  // overwrites that line's core fields when the node counts match.
  private onInfo(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;
    this.applyPvLine(command === Command.WINFO ? 'w' : 'b', this.parseInfoTokens(rest));
  }

  private applyPvLine(color: ColorCode, parsed: ParsedPv | null): void {
    if (!parsed) return;

    // Discard PV updates for the non-thinking color (handles stale post-move flush, issue #9),
    // unless it is the trailing flush for the move that color just played.
    if (color !== this.game.liveData.color) {
      this.applyTrailingPv(color, parsed);
      return;
    }

    // Unsequenced XPV can arrive out of order; node count is the only reliable ordering
    // signal within a search (see docs/protocol.md "XPV lines are unsequenced").
    if (parsed.nodes < this.game.liveData.nodes) {
      logger.debug(
        `Skipping stale PV for game ${this.game.name} - Color: ${color}, Depth: ${parsed.depth}, Nodes: ${parsed.nodes}, UsedTime: ${parsed.usedTime}`,
        { port: this.broadcast.port },
      );
      return;
    }

    this.game.liveData.depth = parsed.depth;
    this.game.liveData.score = parsed.score;
    this.game.liveData.nodes = parsed.nodes;
    this.game.liveData.usedTime = parsed.usedTime;
    if (parsed.ext) this.game.liveData.ext = parsed.ext;

    const playout = replayUciFromFen(this.game.instance.fen(), parsed.pv);
    if (playout) {
      this.game.liveData.pv = playout.san;
      this.game.liveData.pvAlg = playout.alg;
      this.game.liveData.pvFen = playout.fen;
    }

    // 20-60 PV lines land per move per broadcast, so these stay off the default level.
    logger.debug(
      `Updated game ${this.game.name} - Color: ${color}, Depth: ${this.game.liveData.depth}, Score: ${this.game.liveData.score}, Nodes: ${this.game.liveData.nodes}, UsedTime: ${this.game.liveData.usedTime}`,
      { port: this.broadcast.port },
    );
    logger.debug(
      `Updated game ${this.game.name} - Color: ${color}, PVFen: ${
        this.game.liveData.pvFen
      }, PV: ${this.game.liveData.pv.join(' ')}`,
      {
        port: this.broadcast.port,
      },
    );

    this.dirty.add('liveData');
  }

  private onTime(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    const color = colorName(command === Command.WTIME ? 'w' : 'b');
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.debug(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`, {
      port: this.broadcast.port,
    });

    this.dirty.add('clocks');
  }

  private onMove(tokens: CommandTokens): void {
    const [command, ...rest] = tokens;

    const code: ColorCode = command === Command.WMOVE ? 'w' : 'b';
    const nextColorCode: ColorCode = code === 'w' ? 'b' : 'w';
    const color = colorName(code);
    const notColor = colorName(nextColorCode);

    this.game.moveNumber = parseInt(rest[0].replace('.', ''));
    const nextPvMoveNumber = code === 'w' ? this.game.moveNumber : this.game.moveNumber + 1;

    try {
      const fenBefore = this.game.instance.fen();
      const move = this.game.instance.move(rest[1], { strict: false });
      this.fenBeforeLastMove = fenBefore;
      this.game.uciHistory.push(`${move.from}${move.to}${move.promotion ?? ''}`);

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      const meta: MoveMetaData = {
        color: code,
        number: this.game.moveNumber,
        move: move.san,
        depth: null,
        score: null,
        nodes: null,
        usedTime: null,
        time:
          this.game[color].startTime > 0
            ? Math.round((new Date().getTime() - this.game[color].startTime) / 1000)
            : null,
        pv: null,
        pvFen: null,
        pvMoveNumber: null,
        pvFollowup: null,
        pvAlg: null,
        kibitzer: null,
        ...emptyExtras(),
      };
      this.game.moveMeta.push(meta);

      if (this.game.liveData.depth > 0) {
        meta.kibitzer = this.kibitzer?.snapshotForMove(this.broadcast.port) ?? null;
        this.applyPvToMeta(meta, {
          depth: this.game.liveData.depth,
          score: this.game.liveData.score,
          nodes: this.game.liveData.nodes,
          usedTime: this.game.liveData.usedTime,
          ext: this.game.liveData.ext,
          pvMoveNumber: this.game.liveData.pvMoveNumber,
          san: this.game.liveData.pv,
          alg: this.game.liveData.pvAlg,
          fen: this.game.liveData.pvFen,
        });
      } else {
        this.game.instance.setComment('(Book)');
      }

      // Reset liveData for the next thinker
      this.game.liveData.reset(nextColorCode, nextPvMoveNumber);
    } catch {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this.game.name}, fen ${this.game.instance.fen()}! Loading from FEN...`,
        { port: this.broadcast.port },
      );
      this.game.resetFromFen();
    }

    // start the timer for the other side
    this.game[notColor].startTime = new Date().getTime();
    this.dirty.add('clocks');

    this.kibitzer?.onPositionChange(this.broadcast.port, this.game.instance.fen());

    // Captured now: the batch may end on the next move's FEN line, which game.fen would then hold.
    this.pendingLookup = { fen: this.game.fen, turn: this.game.instance.turn(), uciHistory: this.game.uciHistory };
    this.dirty.add('move').add('liveData');
  }

  private async onResult(tokens: CommandTokens): Promise<string> {
    // The archived meta and the webhook carry the opening and tablebase of the final position.
    await this.lookUpPosition();

    const result = tokens[1].trim();
    // TLCS-MG names each game by the GAMENO sent just before its result: with concurrent games
    // the CT-derived number is wrong. Without one the game has no number and is not saved.
    const gameNumber = this.broadcast.multigameMode === 'mg' ? this.pendingGameNo : this.broadcast.currentGameNumber;
    this.pendingGameNo = null;

    const message = `[Server] - ${gameNumber === null ? '' : `Game ${gameNumber}: `}${this.game.white.name} - ${
      this.game.black.name
    } (${result})`;
    this.broadcast.pushChat(message);

    this.game.instance.header('Result', result);

    if (gameNumber === null) {
      logger.info(`No GAMENO for game ${this.game.name} (${message}), not saving it`, { port: this.broadcast.port });
    } else {
      await savePgn(this.game, this.broadcast.port, gameNumber);
      await saveGameMeta(this.game, this.broadcast.port, gameNumber, result);

      getWebhookManager()?.dispatch({
        kind: 'game-finished',
        port: this.broadcast.port,
        gameNumber,
        white: this.game.white.name,
        black: this.game.black.name,
        site: this.broadcast.site,
        result,
        opening: this.game.opening,
      });
    }

    // Re-arm "game started" detection for the next game.
    this.gameStartArmed = true;
    this.startColorsSeen.clear();

    this.broadcast.reloadResults();

    return message;
  }

  private buildGameDelta(): GameDelta {
    const d = this.dirty;
    const gameDelta: GameDelta = {};

    if (d.has('players')) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
      gameDelta.startFen = this.game.startFen;
      gameDelta.resetMoves = true;
    }

    if (d.has('clocks')) {
      gameDelta.white = this.game.white.toJSON();
      gameDelta.black = this.game.black.toJSON();
    }

    if (d.has('site')) {
      gameDelta.site = this.broadcast.site;
    }

    if (d.has('move')) {
      gameDelta.fen = this.game.instance.fen();
      gameDelta.stm = this.game.instance.turn();
      gameDelta.opening = this.game.opening;
      gameDelta.tablebase = this.game.tablebase;

      // reset() / resetFromFen() replace moveMeta. If the browser had moves it drops them, and
      // every move since the reset is new to it, even at indices it already had. The start
      // position goes out either way: a setup position loaded after an earlier batch's reset
      // finds the browser with no moves but still on the old start.
      const replaced = this.game.moveMeta !== this.movesAtBatchStart;
      const wasReset = replaced && this.moveCountBefore > 0;
      const newMoves = this.game.moveMeta.slice(wasReset ? 0 : this.moveCountBefore);
      if (newMoves.length > 0) {
        gameDelta.newMoves = newMoves;
      }

      if (replaced) gameDelta.startFen = this.game.startFen;
      if (wasReset) gameDelta.resetMoves = true;
    }

    if (d.has('movesPatched')) {
      // Filtering moveMeta by identity drops entries a reset() discarded mid-batch.
      const updatedMoves = this.game.moveMeta.filter((m) => this.patchedMoves.has(m));
      if (updatedMoves.length > 0) {
        gameDelta.updatedMoves = updatedMoves;
      }
    }

    if (d.has('liveData') || d.has('move') || d.has('players')) {
      gameDelta.liveData = this.game.liveData.toJSON();
    }

    return gameDelta;
  }

  /** Start of a batch: forget last batch's changes and snapshot the count new moves are sliced from. */
  beginBatch(): void {
    this.dirty.clear();
    this.moveCountBefore = this.game.moveMeta.length;
    this.movesAtBatchStart = this.game.moveMeta;
    this.patchedMoves.clear();
  }

  /**
   * Discards this board's game. Entering TLCS-MG mode drops everything built from bare lines
   * (spec §3); the server's snapshot then rebuilds each board in progress. The game stays
   * loaded, so the snapshot's startpos FEN is a plain new game. Game-start arming is left
   * alone: the snapshot re-announces the players of a game that may already have fired it.
   */
  reset(): void {
    this.game.white.reset();
    this.game.black.reset();
    this.game.reset();
    this.pendingGameNo = null;
    this.fenBeforeLastMove = null;
    this.patchedMoves.clear();
    this.dirty.add('players').add('move').add('liveData');
  }

  /** SITE is a broadcast-level line, but its value rides in each board's GameDelta. */
  markSiteDirty(): void {
    this.dirty.add('site');
  }

  /**
   * The opening and tablebase lookups for the position the last move left, if a reset has not
   * discarded that game since. Run once per batch (GameService.onMessages) and before a result is saved.
   */
  async lookUpPosition(): Promise<void> {
    const pending = this.pendingLookup;
    this.pendingLookup = null;
    if (!pending || pending.uciHistory !== this.game.uciHistory) return;

    const skipOpening = this.game.openingLookupDisabled || this.game.startFen !== null;

    const [openingResult, tablebase] = await Promise.all([
      skipOpening
        ? Promise.resolve<OpeningResult>({ failed: false, opening: null })
        : fetchOpening(this.game.name, pending.uciHistory),
      fetchTablebase(this.game.name, pending.fen, pending.turn),
    ]);

    if (openingResult.failed) {
      this.game.openingLookupDisabled = true;
    } else if (openingResult.opening) {
      this.game.opening = openingResult.opening;
    }
    this.game.tablebase = tablebase;
    // Already set when this batch played the move; not when the lookup was left over from a rejected batch.
    this.dirty.add('move');
  }

  /** End of a batch: this board's delta, or null if none of its state changed. */
  takeDelta(): GameDelta | null {
    return this.dirty.size > 0 ? this.buildGameDelta() : null;
  }
}

export default BoardService;
