export enum Command {
  FEN = 'FEN',
  WPLAYER = 'WPLAYER',
  BPLAYER = 'BPLAYER',
  WPV = 'WPV',
  BPV = 'BPV',
  WTIME = 'WTIME',
  BTIME = 'BTIME',
  WMOVE = 'WMOVE',
  BMOVE = 'BMOVE',
  SITE = 'SITE',
  CT = 'CT',
  CTRESET = 'CTRESET',
  PONG = 'PONG',
  ADDUSER = 'ADDUSER',
  DELUSER = 'DELUSER',
  CHAT = 'CHAT',
  MENU = 'MENU',
  RESULT = 'result',
  FMR = 'FMR',
  LOGON = 'LOGON',
  FEATURE = 'FEATURE',
  LEVEL = 'level',
  MSG = 'MSG',
}

const KNOWN_COMMANDS = new Set<string>(Object.values(Command));

/**
 * Whether receiving a command proves the broadcast is still fed with live data.
 *
 * The false entries all arrive whether or not the session is alive: `PONG` is a
 * keepalive TLCS keeps answering after it has logged us out, `MSG` is how it
 * announces that logout, and `LOGON`/`FEATURE`/`level`/`MENU` are connection-time
 * lines a re-login provokes on its own. So is `ADDUSER`: a login is answered with the
 * spectator list, our own name included (see `onAddUser`), and join/leave traffic
 * says nothing about the game feed anyway. Counting any of them would let a
 * re-login that is acknowledged but restores nothing look like recovery, which is
 * exactly what `ccrl_broadcast_seconds_since_data` exists to catch.
 *
 * Typed as a total map on purpose: adding a `Command` forces a decision here
 * rather than silently defaulting to "this counts". Lines `splitOnCommand`
 * can't parse are dropped before this is consulted and so never count — during a
 * real game the known commands (`FEN`, moves, times, PVs) always accompany them.
 */
export const PROVES_LIVENESS: Record<Command, boolean> = {
  [Command.FEN]: true,
  [Command.WPLAYER]: true,
  [Command.BPLAYER]: true,
  [Command.WPV]: true,
  [Command.BPV]: true,
  [Command.WTIME]: true,
  [Command.BTIME]: true,
  [Command.WMOVE]: true,
  [Command.BMOVE]: true,
  [Command.SITE]: true,
  [Command.CT]: true,
  [Command.CTRESET]: true,
  [Command.CHAT]: true,
  [Command.RESULT]: true,
  [Command.FMR]: true,
  [Command.PONG]: false,
  [Command.MSG]: false,
  [Command.LOGON]: false,
  [Command.FEATURE]: false,
  [Command.LEVEL]: false,
  [Command.MENU]: false,
  [Command.ADDUSER]: false,
  [Command.DELUSER]: false,
};

/**
 * Splits a protocol line into its command and argument. Returns null when the
 * leading token isn't a command we know — validating here means callers can trust
 * the `Command` in the result rather than re-checking a cast.
 */
export function splitOnCommand(line: string): [Command, string] | null {
  const semiIdx = line.indexOf(':');
  const spaceIdx = line.indexOf(' ');

  // Assign the split to the semi-colon
  let argSplit = semiIdx;

  // If no semi-colon assign it to space
  if (semiIdx < 0) argSplit = spaceIdx;
  // If both, then choose the first one
  else if (spaceIdx >= 0) argSplit = Math.min(semiIdx, spaceIdx);

  const command = argSplit < 0 ? line : line.substring(0, argSplit);
  if (!KNOWN_COMMANDS.has(command)) return null;

  return [command as Command, argSplit < 0 ? '' : line.substring(argSplit + 1).trim()];
}
