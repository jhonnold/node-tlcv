export type AnalysisInfo = {
  depth: number;
  score: number; // centipawns, from white's perspective
  nodes: number;
  nps: number;
  pv: string[]; // UCI move strings (e.g. "e2e4")
};

const MATE_SCORE_CP = 1000000;

/**
 * Parse a UCI "info" line into an AnalysisInfo object.
 * Returns null if the line is missing required fields (depth, score, nodes, pv).
 * The score is normalized to white's perspective using the provided side-to-move.
 */
export function parseInfoLine(line: string, stm: 'w' | 'b'): AnalysisInfo | null {
  const tokens = line.split(/\s+/);

  let depth: number | null = null;
  let scoreCp: number | null = null;
  let nodes: number | null = null;
  let nps: number | null = null;
  let pv: string[] | null = null;

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = parseInt(tokens[++i]);
        break;
      case 'score':
        if (tokens[i + 1] === 'cp') {
          scoreCp = parseInt(tokens[i + 2]);
          i += 2;
        } else if (tokens[i + 1] === 'mate') {
          const mateIn = parseInt(tokens[i + 2]);
          scoreCp = mateIn > 0 ? MATE_SCORE_CP : -MATE_SCORE_CP;
          i += 2;
        }
        break;
      case 'nodes':
        nodes = parseInt(tokens[++i]);
        break;
      case 'nps':
        nps = parseInt(tokens[++i]);
        break;
      case 'pv':
        pv = tokens.slice(i + 1);
        i = tokens.length; // break out of loop
        break;
    }
  }

  if (depth === null || scoreCp === null || nodes === null || pv === null || pv.length === 0) {
    return null;
  }

  // Normalize score to white's perspective
  const normalizedScore = stm === 'b' ? -scoreCp : scoreCp;

  return {
    depth,
    score: normalizedScore,
    nodes,
    nps: nps ?? 0,
    pv,
  };
}
