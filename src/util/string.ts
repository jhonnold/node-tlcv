import { Command } from '../handler';

export function splitOnCommand(line: string): [Command, string] {
  const match = line.match(/[: ]/);
  if (!match) return [line as Command, ''];

  return [line.substring(0, match.index) as Command, line.substring(match.index + 1).trim()];
}
