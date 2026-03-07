import type { H2HCell, StandingsRow, ParsedResults } from '../../shared/types.js';
export type { H2HCell, StandingsRow, ParsedResults } from '../../shared/types.js';

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

export function parseResults(raw: string): ParsedResults {
  const empty: ParsedResults = { standings: [], totalGames: 0 };
  if (!raw || !raw.trim()) return empty;

  const lines = raw.split('\n');

  // Find the standings header line
  const headerIdx = lines.findIndex((l) => /^\s*RANK\s/i.test(l));
  if (headerIdx === -1) return empty;

  const header = lines[headerIdx];

  // Find column positions from header
  const gamesCol = header.indexOf('GAMES');
  const pointsCol = header.indexOf('POINTS');
  if (gamesCol === -1 || pointsCol === -1) return empty;

  // Count H2H columns and determine cell width from header spacing
  const afterPoints = header.slice(pointsCol + 'POINTS'.length);
  const h2hHeaderPositions: number[] = [];
  const colPattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = colPattern.exec(afterPoints)) !== null) {
    h2hHeaderPositions.push(match.index);
  }
  const numH2HCols = h2hHeaderPositions.length;
  const h2hColWidth = h2hHeaderPositions.length > 1 ? h2hHeaderPositions[1] - h2hHeaderPositions[0] : 3;

  // Parse standings rows: skip header and separator line(s)
  const standings: StandingsRow[] = [];
  let totalGames = 0;
  let i = headerIdx + 1;

  // Skip separator line
  if (i < lines.length && /^[-\s]+$/.test(lines[i])) i++;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^[-\s]+$/.test(line)) continue;

    // Stop at "Total games" or "Most recent" or non-standings lines
    if (/total\s+games/i.test(line)) {
      const totalMatch = /total\s+games\s*=\s*(\d+)/i.exec(line);
      if (totalMatch) totalGames = parseInt(totalMatch[1], 10);
      continue;
    }
    if (/most\s+recent|game\s+no/i.test(line)) break;

    // Parse rank: leading number with trailing dot
    const rankMatch = /^\s*(\d+)\.\s+/.exec(line);
    if (!rankMatch) continue;

    const rank = parseInt(rankMatch[1], 10);

    // Find H2H start: use gamesCol as approximate anchor to locate
    // the games+points tokens, then H2H data begins after them.
    // The gamesCol position may be off by a few chars due to rank width
    // differences, but the leading \s* in the regex absorbs this.
    const afterGamesStr = line.slice(gamesCol);
    const gamesPointsMatch = /^\s*\S+\s+\S+\s+/.exec(afterGamesStr);
    if (!gamesPointsMatch) continue;
    const h2hDataStart = gamesCol + gamesPointsMatch[0].length;

    // Extract name, games, and points from the text before H2H data.
    // This avoids relying on exact header column alignment.
    const beforeH2H = line.slice(0, h2hDataStart).trimEnd();
    const gpTailMatch = /(\d+)\s+(\d+\.?\d*)$/.exec(beforeH2H);
    if (!gpTailMatch) continue;

    const games = parseInt(gpTailMatch[1], 10);
    const points = parseFloat(gpTailMatch[2]);
    const nameStart = rankMatch[0].length;
    const name = beforeH2H.slice(nameStart, gpTailMatch.index).trim();

    // H2H cells — each cell width is derived from header column spacing
    const h2h: H2HCell[] = [];
    for (let col = 0; col < numH2HCols; col++) {
      const pos = h2hDataStart + col * h2hColWidth;
      const cellStr = line.slice(pos, pos + h2hColWidth);
      if (isSelfCell(cellStr)) {
        h2h.push({ results: '**', wins: 0, draws: 0, losses: 0 });
      } else if (isUnplayedCell(cellStr)) {
        h2h.push({ results: '.', wins: 0, draws: 0, losses: 0 });
      } else {
        h2h.push(parseH2HCell(cellStr));
      }
    }

    standings.push({ rank, name, games, points, h2h });
  }

  // Fallback: find "Total games" line if we haven't found it yet
  if (!totalGames) {
    const totalLine = lines.find((l) => /total\s+games\s*=\s*(\d+)/i.test(l));
    if (totalLine) {
      const m = /total\s+games\s*=\s*(\d+)/i.exec(totalLine);
      if (m) totalGames = parseInt(m[1], 10);
    }
  }

  return { standings, totalGames };
}
