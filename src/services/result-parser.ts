import type { H2HCell, StandingsRow, ParsedResults, GameRecord } from '../../shared/types.js';
export type { H2HCell, StandingsRow, ParsedResults, GameRecord } from '../../shared/types.js';

function parseH2HCell(raw: string): H2HCell {
  const content = raw.replace(/\s/g, '');
  return {
    results: content,
    wins: (content.match(/1/g) || []).length,
    draws: (content.match(/=/g) || []).length,
    losses: (content.match(/0/g) || []).length,
  };
}

function isSelfCell(raw: string): boolean {
  return raw.includes('*');
}

function isUnplayedCell(raw: string): boolean {
  const trimmed = raw.replace(/\s/g, '');
  return trimmed === '.' || trimmed === '';
}

type HeaderInfo = {
  headerIdx: number;
  gamesCol: number;
  numH2HCols: number;
  h2hColWidth: number;
};

function findHeaderColumns(lines: string[]): HeaderInfo | null {
  const headerIdx = lines.findIndex((l) => /^\s*RANK\s/i.test(l));
  if (headerIdx === -1) return null;

  const header = lines[headerIdx];
  const gamesCol = header.indexOf('GAMES');
  const pointsCol = header.indexOf('POINTS');
  if (gamesCol === -1 || pointsCol === -1) return null;

  const afterPoints = header.slice(pointsCol + 'POINTS'.length);
  const h2hHeaderPositions: number[] = [];
  const colPattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = colPattern.exec(afterPoints)) !== null) {
    h2hHeaderPositions.push(match.index);
  }

  return {
    headerIdx,
    gamesCol,
    numH2HCols: h2hHeaderPositions.length,
    h2hColWidth: h2hHeaderPositions.length > 1 ? h2hHeaderPositions[1] - h2hHeaderPositions[0] : 3,
  };
}

function parseStandingRow(line: string, header: HeaderInfo): StandingsRow | null {
  const rankMatch = /^\s*(\d+)\.\s+/.exec(line);
  if (!rankMatch) return null;

  const afterGamesStr = line.slice(header.gamesCol);
  const gamesPointsMatch = /^\s*\S+\s+\S+\s+/.exec(afterGamesStr);
  if (!gamesPointsMatch) return null;

  const h2hDataStart = header.gamesCol + gamesPointsMatch[0].length;
  const beforeH2H = line.slice(0, h2hDataStart).trimEnd();
  const gpTailMatch = /(\d+)\s+(\d+\.?\d*)$/.exec(beforeH2H);
  if (!gpTailMatch) return null;

  const h2h: H2HCell[] = [];
  for (let col = 0; col < header.numH2HCols; col++) {
    const pos = h2hDataStart + col * header.h2hColWidth;
    const cellStr = line.slice(pos, pos + header.h2hColWidth);
    if (isSelfCell(cellStr)) {
      h2h.push({ results: '**', wins: 0, draws: 0, losses: 0 });
    } else if (isUnplayedCell(cellStr)) {
      h2h.push({ results: '.', wins: 0, draws: 0, losses: 0 });
    } else {
      h2h.push(parseH2HCell(cellStr));
    }
  }

  return {
    rank: parseInt(rankMatch[1], 10),
    name: beforeH2H.slice(rankMatch[0].length, gpTailMatch.index).trim(),
    games: parseInt(gpTailMatch[1], 10),
    points: parseFloat(gpTailMatch[2]),
    h2h,
  };
}

function findTotalGames(lines: string[]): number {
  const totalLine = lines.find((l) => /total\s+games\s*=\s*(\d+)/i.test(l));
  if (!totalLine) return 0;
  const m = /total\s+games\s*=\s*(\d+)/i.exec(totalLine);
  return m ? parseInt(m[1], 10) : 0;
}

export function parseResults(raw: string): ParsedResults {
  const empty: ParsedResults = { standings: [], totalGames: 0 };
  if (!raw || !raw.trim()) return empty;

  const lines = raw.split('\n');
  const header = findHeaderColumns(lines);
  if (!header) return empty;

  const standings: StandingsRow[] = [];
  let i = header.headerIdx + 1;

  // Skip separator line
  if (i < lines.length && /^[-\s]+$/.test(lines[i])) i++;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^[-\s]+$/.test(line)) continue;
    if (/total\s+games/i.test(line)) continue;
    if (/most\s+recent|game\s+no/i.test(line)) break;

    const row = parseStandingRow(line, header);
    if (row) standings.push(row);
  }

  return { standings, totalGames: findTotalGames(lines) };
}

function stripEngineSuffix(name: string): string {
  return name
    .replace(/\s*\d+CPU\b/i, '')
    .replace(/\s*(64|32)-BIT\b/i, '')
    .trim();
}

export function parseGames(raw: string): GameRecord[] {
  if (!raw || !raw.trim()) return [];

  const lines = raw.split('\n');

  // Find the start of the games section
  const headerIdx = lines.findIndex((l) => /game\s+no\./i.test(l));
  if (headerIdx === -1) return [];

  // Skip separator line(s) after header
  let i = headerIdx + 1;
  while (i < lines.length && /^[-\s]*$/.test(lines[i])) i++;

  const games: GameRecord[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const match = /^\s*(\d+)\s+(.+?)\s{3,}(.+?)\s{3,}(1-0|0-1|1\/2-1\/2|\*)\s*$/.exec(line);
    if (!match) continue;

    games.push({
      gameNumber: parseInt(match[1], 10),
      white: stripEngineSuffix(match[2].trim()),
      black: stripEngineSuffix(match[3].trim()),
      result: match[4],
    });
  }

  return games;
}
