// The chat line BoardService.onResult posts when a game ends. It goes to the port room, so every board's page gets
// it; on TLCS-MG the client refreshes Games and Standings on it. Server and client share the format through here.

/** "[Server] - Game 5: White - Black (1-0)"; no "Game N: " when the game has no number (TLCS-MG without GAMENO). */
export const resultLine = (gameNumber: number | null, white: string, black: string, result: string): string =>
  `[Server] - ${gameNumber === null ? '' : `Game ${gameNumber}: `}${white} - ${black} (${result})`;

const RESULT_LINE = /^\[Server\] - .+ - .+ \(.+\)$/;
/** Whether a chat line is a resultLine(). Loose on names; a false match costs one debounced refresh. */
export const isResultLine = (line: string): boolean => RESULT_LINE.test(line);
