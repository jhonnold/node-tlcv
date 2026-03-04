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
}

export function splitOnCommand(line: string): [Command, string] {
  const semiIdx = line.indexOf(':');
  const spaceIdx = line.indexOf(' ');

  // Assign the split to the semi-colon
  let argSplit = semiIdx;

  // If no semi-colon assign it to space
  if (semiIdx < 0) argSplit = spaceIdx;
  // If both, then choose the first one
  else if (spaceIdx >= 0) argSplit = Math.min(semiIdx, spaceIdx);

  if (argSplit < 0) return [line as Command, ''];

  return [line.substring(0, argSplit) as Command, line.substring(argSplit + 1).trim()];
}
