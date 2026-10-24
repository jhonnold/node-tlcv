import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from 'chart.js';
import type { ChartConfiguration, Plugin } from 'chart.js';
import type { ColorCode, MoveMetaData } from '$shared/types';
import { DASH, formatCount, formatDuration, formatScore, npsSeconds, whiteScore } from './format';
import { isBook } from './moves';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

export type GraphId = 'eval' | 'depth' | 'nodes' | 'nps' | 'time';
export type Pt = { x: number; y: number };
type GraphType = {
  label: string;
  title: string;
  value(m: MoveMetaData): number | null;
  tick(v: number): string;
  tip(v: number): string;
};

const clampEval = (v: number): number => Math.max(-10, Math.min(10, v));

export const GRAPH_TYPES: Record<GraphId, GraphType> = {
  eval: {
    label: 'Eval',
    title: 'Evaluation (White’s view)',
    value: (m) => (m.score == null ? null : clampEval(whiteScore(m.score, m.color))),
    tick: (v) => (v === 0 ? '0' : v > 0 ? `+${v}` : String(v)),
    tip: (v) => formatScore(v),
  },
  depth: {
    label: 'Depth',
    title: 'Search depth',
    value: (m) => m.depth,
    tick: (v) => String(Math.round(v)),
    tip: (v) => String(v),
  },
  nodes: { label: 'Nodes', title: 'Nodes searched', value: (m) => m.nodes, tick: formatCount, tip: formatCount },
  nps: {
    label: 'NPS',
    title: 'Nodes per second',
    value: (m) => {
      const s = npsSeconds(m);
      return s && m.nodes != null ? Math.round(m.nodes / s) : null;
    },
    tick: (v) => `${formatCount(v)}/s`,
    tip: (v) => `${formatCount(v)}/s`,
  },
  time: {
    label: 'Time',
    title: 'Time per move',
    value: (m) => m.time,
    tick: (v) => `${Math.round(v)}s`,
    tip: (v) => `${v}s`,
  },
};
export const GRAPH_IDS = Object.keys(GRAPH_TYPES) as GraphId[];

/** x = move number; black's move sits half a move later, so integer ticks label move numbers. */
export const plyX = (m: MoveMetaData): number => m.number + (m.color === 'b' ? 0.5 : 0);

/** One dataset per side plus the kibitzer. plies[d][i] is the nav index of dataset d's point i (for clicks). */
/** raw[d][i] is the unclamped value, for the tooltip (a mate reads +M, not +10.00). */
export type Series = {
  white: Pt[];
  black: Pt[];
  kibitzer: Pt[];
  plies: [number[], number[], number[]];
  raw: [number[], number[], number[]];
};
export function buildSeries(moves: MoveMetaData[], id: GraphId): Series {
  const s: Series = { white: [], black: [], kibitzer: [], plies: [[], [], []], raw: [[], [], []] };
  const t = GRAPH_TYPES[id];
  moves.forEach((m, i) => {
    const x = plyX(m);
    const y = isBook(m) ? null : t.value(m);
    if (y != null) {
      const d = m.color === 'w' ? 0 : 1;
      (d === 0 ? s.white : s.black).push({ x, y });
      s.plies[d].push(i + 1);
      s.raw[d].push(id === 'eval' && m.score != null ? whiteScore(m.score, m.color) : y);
    }
    if (id === 'eval' && m.kibitzer?.score != null) {
      s.kibitzer.push({ x, y: clampEval(m.kibitzer.score) });
      s.plies[2].push(i + 1);
      s.raw[2].push(m.kibitzer.score); // already White's view
    }
  });
  return s;
}

function evalBound(vals: number[]): number {
  const b = Math.max(1, Math.min(10, Math.ceil(Math.max(0, ...vals.map(Math.abs)))));
  return b % 2 === 0 ? b : Math.min(10, b + 1);
}
function positiveBound(vals: number[]): number {
  const max = Math.max(0, ...vals);
  if (!max) return 1;
  const padded = max * 1.1;
  const mag = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / mag) * mag;
}

export type Averages = { depth: string; nps: string; clock: string };
/** The averages table (PD:168-181): mean depth, total nodes ÷ total search seconds, clock used = Σ move time. */
export function averages(moves: MoveMetaData[], color: ColorCode): Averages {
  let dSum = 0,
    dN = 0,
    nodes = 0,
    secs = 0,
    clock = 0;
  for (const m of moves) {
    if (m.color !== color) continue;
    if (m.time != null) clock += m.time;
    if (isBook(m)) continue;
    if (m.depth != null) {
      dSum += m.depth;
      dN += 1;
    }
    const s = npsSeconds(m);
    if (m.nodes != null && s) {
      nodes += m.nodes;
      secs += s;
    }
  }
  return {
    depth: dN ? (dSum / dN).toFixed(1) : DASH,
    nps: secs ? formatCount(nodes / secs) : DASH,
    clock: clock ? formatDuration(clock * 1000) : DASH,
  };
}

/** Mutated in place by GraphsTab before each update; the plugin is registered once per chart. */
export type Markers = { zero: boolean; x: number | null; zeroColor: string; markColor: string };
export function markersPlugin(m: Markers): Plugin<'line'> {
  return {
    id: 'tlcvMarkers',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales } = chart;
      const seg = (x1: number, y1: number, x2: number, y2: number, color: string, dash: number[]) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      };
      if (m.zero) {
        const y = scales.y.getPixelForValue(0);
        seg(a.left, y, a.right, y, m.zeroColor, [4, 4]);
      }
      if (m.x != null) {
        const x = scales.x.getPixelForValue(m.x);
        seg(x, a.top, x, a.bottom, m.markColor, []);
      }
    },
  };
}

export type ChartColors = {
  w: string;
  b: string;
  k: string;
  text: string;
  muted: string;
  line: string;
  surface2: string;
  font: string;
};
export function chartConfig(
  id: GraphId,
  moves: MoveMetaData[],
  s: Series,
  names: { white: string; black: string; kibitzer: string },
  c: ChartColors,
  onPick: (ply: number) => void,
): ChartConfiguration<'line', Pt[]> {
  const t = GRAPH_TYPES[id];
  const all = [...s.white, ...s.black, ...s.kibitzer];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const bound = id === 'eval' ? evalBound(ys) : positiveBound(ys);
  const ds = (label: string, data: Pt[], color: string, width: number, dash: number[]) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: width,
    borderDash: dash,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHitRadius: 8,
    tension: 0,
  });
  const axisFont = { family: c.font, size: 11 };
  const moveName = (ply: number) => {
    const m = moves[ply - 1];
    return m ? `${m.number}${m.color === 'w' ? '.' : '…'} ${m.move}` : '';
  };
  return {
    type: 'line',
    data: {
      datasets: [
        ds(names.white, s.white, c.w, 2, []),
        ds(names.black, s.black, c.b, 2, []),
        ds(names.kibitzer, s.kibitzer, c.k, 1.5, [5, 4]), // always present so datasetIndex lines up with s.plies
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      onClick(_e, els) {
        const el = els[0];
        if (el) onPick(s.plies[el.datasetIndex][el.index]);
      },
      scales: {
        x: {
          type: 'linear',
          min: xs.length ? Math.min(...xs) : 1,
          max: xs.length ? Math.max(...xs) : 2,
          grid: { display: false },
          border: { color: c.line },
          ticks: {
            color: c.muted,
            font: axisFont,
            maxRotation: 0,
            callback: (v) => (Number.isInteger(Number(v)) ? String(v) : ''),
          },
        },
        y: {
          type: 'linear',
          min: id === 'eval' ? -bound : 0,
          max: bound,
          grid: { color: (ctx) => (ctx.index === 1 ? c.line : 'transparent'), drawTicks: false }, // the mid line (PD:149)
          border: { color: c.line },
          ticks: { count: 3, padding: 6, color: c.muted, font: axisFont, callback: (v) => t.tick(Number(v)) },
        },
      },
      plugins: {
        legend: { display: false }, // HTML legend instead (PD:163-167)
        tooltip: {
          backgroundColor: c.surface2,
          titleColor: c.text,
          bodyColor: c.text,
          borderColor: c.line,
          borderWidth: 1,
          cornerRadius: 0,
          titleFont: axisFont,
          bodyFont: axisFont,
          callbacks: {
            title: (items) => (items[0] ? moveName(s.plies[items[0].datasetIndex][items[0].dataIndex]) : ''),
            label: (item) => `${item.dataset.label}: ${t.tip(s.raw[item.datasetIndex][item.dataIndex] ?? 0)}`,
          },
        },
      },
    },
  };
}
