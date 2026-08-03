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
}

const KNOWN_COMMANDS = new Set<string>(Object.values(Command));

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
