import { Command } from '../handler';

export function splitOnCommand(line: string): [Command, string] {
  const argSplit = Math.min(line.indexOf(':'), line.indexOf(' '));

  if (argSplit < 0) return [line as Command, ''];

  return [line.substring(0, argSplit) as Command, line.substring(argSplit + 1).trim()];
}
