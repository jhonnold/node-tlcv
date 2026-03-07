import { Chess } from 'chess.js';
import { ChessGame } from './chess-game.js';
import { logger } from './util/index.js';
import { Broadcast, SerializedBroadcast, username } from './broadcast.js';
import { fetchOpening, fetchTablebase } from './services/lichess.js';
import { savePgn } from './services/pgn.js';
import { Command, splitOnCommand } from './protocol.js';
import { EmitType } from './socket-io-adapter.js';
import { parseResults } from './services/result-parser.js';

type Color = 'white' | 'black';

type CommandTokens = [Command, ...Array<string>];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateResult = [EmitType, boolean, ...Array<any>];

type ConfigItem = {
  fn: (tokens: CommandTokens) => Promise<UpdateResult> | UpdateResult;
  split: boolean;
  lowPrio: boolean;
};

type CommandConfig = {
  [key in Command]: ConfigItem;
};

export type GameServiceResult = {
  update: SerializedBroadcast | null;
  chat: string[];
};

class GameService {
  private commandConfig: CommandConfig;
  private broadcast: Broadcast;
  private game: ChessGame;

  constructor(broadcast: Broadcast) {
    this.broadcast = broadcast;
    this.game = this.broadcast.game;

    this.commandConfig = {
      [Command.FEN]: { fn: this.onFen.bind(this), split: true, lowPrio: false },
      [Command.WPLAYER]: { fn: this.onPlayer.bind(this), split: false, lowPrio: false },
      [Command.BPLAYER]: { fn: this.onPlayer.bind(this), split: false, lowPrio: false },
      [Command.WPV]: { fn: this.onPV.bind(this), split: true, lowPrio: false },
      [Command.BPV]: { fn: this.onPV.bind(this), split: true, lowPrio: false },
      [Command.WTIME]: { fn: this.onTime.bind(this), split: true, lowPrio: false },
      [Command.BTIME]: { fn: this.onTime.bind(this), split: true, lowPrio: false },
      [Command.WMOVE]: { fn: this.onMove.bind(this), split: true, lowPrio: false },
      [Command.BMOVE]: { fn: this.onMove.bind(this), split: true, lowPrio: false },
      [Command.SITE]: { fn: this.onSite.bind(this), split: false, lowPrio: false },
      [Command.CTRESET]: { fn: this.onCTReset.bind(this), split: false, lowPrio: false },
      [Command.CT]: { fn: this.onCT.bind(this), split: false, lowPrio: false },
      [Command.PONG]: { fn: () => [EmitType.UPDATE, false], split: false, lowPrio: false },
      [Command.ADDUSER]: { fn: this.onAddUser.bind(this), split: false, lowPrio: false },
      [Command.DELUSER]: { fn: this.onDelUser.bind(this), split: false, lowPrio: false },
      [Command.CHAT]: { fn: this.onChat.bind(this), split: false, lowPrio: false },
      [Command.MENU]: { fn: this.onMenu.bind(this), split: true, lowPrio: false },
      [Command.RESULT]: { fn: this.onResult.bind(this), split: false, lowPrio: false },
      [Command.FMR]: { fn: this.onFmr.bind(this), split: false, lowPrio: false },
    };
  }

  private onFmr(tokens: CommandTokens): UpdateResult {
    const [, fmr] = tokens;

    this.game.fmr = parseInt(fmr);
    logger.info(`Updated game ${this.game.name} - FMR: ${this.game.fmr}`, {
      port: this.broadcast.port,
    });

    return [EmitType.UPDATE, false];
  }

  private onFen(tokens: CommandTokens): UpdateResult {
    const [, ...fenTokens] = tokens;
    const lastToken = fenTokens.slice(-1)[0];

    // Sometimes we don't get castling info
    if (lastToken === 'w' || lastToken === 'b') fenTokens.push('-');

    // Always push on ep square
    fenTokens.push('-');

    this.game.fen = fenTokens.join(' '); // build the fen

    if (!this.game.loaded) {
      this.game.resetFromFen();
      logger.info(`Unloaded game ${this.game.name}, setting to FEN: ${this.game.instance.fen()}`, {
        port: this.broadcast.port,
      });
    } else if (this.game.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')) {
      // Reset everything on startpos
      this.game.reset();
      logger.info(`Received startpos for game ${this.game.name}, reseting the game.`, { port: this.broadcast.port });
    } else {
      logger.info(`Set backup FEN for ${this.game.name}: ${this.game.fen}`, { port: this.broadcast.port });
    }

    // Never update on the FEN since we maintain our own state
    return [EmitType.UPDATE, false];
  }

  private onPlayer(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;
    const name = rest.join(' ');

    const color: Color = command === Command.WPLAYER ? 'white' : 'black';
    this.game[color].reset();
    this.game[color].name = name;
    logger.info(`Updated game ${this.game.name} - Color: ${color}, Name: ${this.game[color].name}`, {
      port: this.broadcast.port,
    });

    return [EmitType.UPDATE, true];
  }

  private onPV(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WPV ? 'white' : 'black';

    this.game[color].depth = parseInt(rest[0]);
    this.game[color].score = parseInt(rest[1]) / 100;
    this.game[color].nodes = parseInt(rest[3]);
    this.game[color].usedTime = parseInt(rest[2]) * 10;

    const pv = rest.slice(4);

    const pvPlayout = new Chess();
    pvPlayout.loadPgn(this.game.instance.pgn());

    const parsed = new Array<string>();
    const pvAlg = new Array<string>();

    // If the PV is not for the current STM then we undo the last move
    // and attempt to parse the PV from that position. This will happen when
    // the final pv is sent after the best move was sent. (See issue #9)
    if (!color.startsWith(pvPlayout.turn())) pvPlayout.undo();

    for (let i = 0; i < pv.length; i++) {
      const alg = pv[i];
      try {
        const move = pvPlayout.move(alg, { strict: false });

        parsed.push(move.san);
        pvAlg.push(`${move.from}${move.to}`);
      } catch {
        break; // failed to parse a move
      }
    }

    // Only if we could parse at least 1 do
    if (parsed.length) {
      this.game[color].pv = parsed;
      this.game[color].pvAlg = pvAlg;
      this.game[color].pvFen = pvPlayout.fen();
    }

    logger.info(
      `Updated game ${this.game.name} - Color: ${color}, Depth: ${this.game[color].depth}, Score: ${this.game[color].score}, Nodes: ${this.game[color].nodes}, UsedTime: ${this.game[color].usedTime}`,
      { port: this.broadcast.port },
    );
    logger.info(
      `Updated game ${this.game.name} - Color: ${color}, PVFen: ${this.game[color].pvFen}, PV: ${this.game[
        color
      ].pv.join(' ')}`,
      {
        port: this.broadcast.port,
      },
    );

    return [EmitType.UPDATE, true];
  }

  private onTime(tokens: CommandTokens): UpdateResult {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WTIME ? 'white' : 'black';
    this.game[color].clockTime = parseInt(rest[0]) * 10;

    logger.info(`Updated game ${this.game.name} - Color: ${color}, ClockTime: ${this.game[color].clockTime}`, {
      port: this.broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onMove(tokens: CommandTokens): Promise<UpdateResult> {
    const [command, ...rest] = tokens;

    const color: Color = command === Command.WMOVE ? 'white' : 'black';
    const notColor: Color = command === Command.WMOVE ? 'black' : 'white';

    this.game.moveNumber = parseInt(rest[0].replace('.', ''));
    if (color === 'white') this.game.black.pvMoveNumber = this.game.moveNumber;
    else this.game.white.pvMoveNumber = this.game.moveNumber + 1;

    try {
      const move = this.game.instance.move(rest[1], { strict: false });
      const colorCode: 'w' | 'b' = color === 'white' ? 'w' : 'b';

      this.game[color].lastMove = move;
      logger.info(`Updated game ${this.game.name} - Color: ${color}, Last Move: ${this.game[color].lastMove?.san}`, {
        port: this.broadcast.port,
      });

      if (this.game[color].depth > 0) {
        this.game.moveMeta.push({
          color: colorCode,
          number: this.game.moveNumber,
          move: move.san,
          depth: this.game[color].depth,
          score: this.game[color].score,
          nodes: this.game[color].nodes,
          time:
            this.game[color].startTime > 0
              ? Math.round((new Date().getTime() - this.game[color].startTime) / 1000)
              : null,
          pv: this.game[color].pv.length ? [...this.game[color].pv] : null,
          pvFen: this.game[color].pvFen,
          pvMoveNumber: this.game[color].pvMoveNumber,
          pvFollowup: this.game[color].pvAlg[1] || null,
        });

        // Set the PGN comment for this move
        const comment = `(${this.game[color].pv.join(' ')}) ${this.game[color].score.toFixed(2)}/${
          this.game[color].depth
        } ${Math.round((new Date().getTime() - this.game[color].startTime) / 1000)}`;
        this.game.instance.setComment(comment);
      } else {
        this.game.moveMeta.push({
          color: colorCode,
          number: this.game.moveNumber,
          move: move.san,
          depth: null,
          score: null,
          nodes: null,
          time: null,
          pv: null,
          pvFen: null,
          pvMoveNumber: null,
          pvFollowup: null,
        });

        this.game.instance.setComment('(Book)');
      }
    } catch {
      logger.warn(
        `Failed to parse ${rest[1]} for game ${this.game.name}, fen ${this.game.instance.fen()}! Loading from FEN...`,
        { port: this.broadcast.port },
      );
      this.game.resetFromFen();
    }

    // start the timer for the other side
    this.game[notColor].startTime = new Date().getTime();

    const [opening, tablebase] = await Promise.all([
      fetchOpening(this.game.name, this.game.instance),
      fetchTablebase(this.game.name, this.game.fen, this.game.instance.turn()),
    ]);

    if (opening) this.game.opening = opening;
    this.game.tablebase = tablebase;

    return [EmitType.UPDATE, true];
  }

  private onSite(tokens: CommandTokens): UpdateResult {
    const site = tokens.slice(1).join(' ');

    this.game.site = site.replace('GrahamCCRL.dyndns.org\\', '').replace(/\.[\w]+$/, '');

    logger.info(`Updated game ${this.game.name} - Site: ${this.game.site}`, { port: this.broadcast.port });
    return [EmitType.UPDATE, true];
  }

  private onCTReset(): UpdateResult {
    this.broadcast.results = '';
    this.broadcast.parsedResults = null;

    return [EmitType.UPDATE, false];
  }

  private onCT(tokens: CommandTokens): UpdateResult {
    this.broadcast.results += `${tokens[1]}\n`;

    if (/total\s+games\s*=/i.test(tokens[1])) {
      this.broadcast.parsedResults = parseResults(this.broadcast.results);
    }

    return [EmitType.UPDATE, false];
  }

  private onAddUser(tokens: CommandTokens): UpdateResult {
    if (username === tokens[1] || this.broadcast.spectators.has(tokens[1])) return [EmitType.UPDATE, false];

    this.broadcast.spectators.add(tokens[1]);
    return [EmitType.UPDATE, true];
  }

  private onDelUser(tokens: CommandTokens): UpdateResult {
    const result = this.broadcast.spectators.delete(tokens[1]);

    return [EmitType.UPDATE, result];
  }

  private onChat(tokens: CommandTokens): UpdateResult {
    // Disable connection messages. TODO: Make this configurable
    if (tokens[1].endsWith('has arrived!') || tokens[1].endsWith('has left!')) return [EmitType.CHAT, false];

    this.broadcast.chat.push(tokens[1]);
    return [EmitType.CHAT, true, tokens[1]];
  }

  private onMenu(tokens: CommandTokens): UpdateResult {
    let nameIdx = -1;
    let valueIdx = -1;

    tokens.forEach((v, i) => {
      if (v.startsWith('NAME=')) nameIdx = i;
      if (v.startsWith('URL=')) valueIdx = i;
    });

    if (nameIdx === -1 || valueIdx === -1) return [EmitType.UPDATE, false];

    const name = tokens[nameIdx].slice(6, -1).toLowerCase(); // chop NAME="
    const url = tokens[valueIdx].slice(5, -1); // chop URL="

    this.broadcast.menu.set(name, url);

    logger.info(`Updated broadcast ${this.broadcast.port} Menu - Name: ${name}, Value: ${url}`, {
      port: this.broadcast.port,
    });
    return [EmitType.UPDATE, true];
  }

  private async onResult(tokens: CommandTokens): Promise<UpdateResult> {
    const message = `[Server] - ${this.game.white.name} - ${this.game.black.name} (${tokens[1].trim()})`;
    this.broadcast.chat.push(message);

    this.game.instance.header('Result', tokens[1].trim());

    await savePgn(this.game, this.broadcast.port);

    this.broadcast.reloadResults();

    return [EmitType.CHAT, true, message];
  }

  async onMessages(messages: string[]): Promise<GameServiceResult> {
    // We collect results after processing all messages.
    // updateEmit is the board result after the last processed message
    // chatEmit is all the chats received across these messages
    let updateEmit: SerializedBroadcast | null = null;
    const chatEmit: string[] = [];

    const processLowPrio = this.broadcast.browserCount > 0;
    if (!processLowPrio)
      logger.info('No one viewing broadcast, skipping processing of low-priority messages.', {
        port: this.broadcast.port,
      });

    const highPrioMessages: [Command, string][] = [];
    const lowPriorityMessages = new Map<Command, string>();

    messages
      .map((msg) => splitOnCommand(msg))
      .forEach(([cmd, rest]) => {
        const config = this.commandConfig[cmd] as ConfigItem | undefined;
        if (!config) {
          logger.warn(`Unable to process ${cmd}!`, { port: this.broadcast.port });
          return;
        }

        if (config.lowPrio) {
          lowPriorityMessages.set(cmd, rest);
        } else {
          highPrioMessages.push([cmd, rest]);
        }
      });

    for (const [cmd, rest] of [...highPrioMessages, ...(processLowPrio ? lowPriorityMessages : [])]) {
      const commandConfig = this.commandConfig[cmd];

      const [emit, updated, ...updateData] = await commandConfig.fn(
        commandConfig.split ? [cmd, ...rest.trim().split(/\s+/)] : [cmd, rest],
      );

      if (updated) {
        switch (emit) {
          case EmitType.UPDATE:
            updateEmit = this.broadcast.toJSON();
            break;
          case EmitType.CHAT:
            chatEmit.push(updateData[0]);
            break;
        }
      }
    }

    logger.info(`Successfully processed ${messages.length} message(s)`, { port: this.broadcast.port });

    return { update: updateEmit, chat: chatEmit };
  }
}

export default GameService;
