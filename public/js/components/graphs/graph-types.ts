// public/js/components/graphs/graph-types.js
import type { MoveMetaData } from '../../../../shared/types';

export type GraphTypeConfig = {
  label: string;
  getValue(meta: MoveMetaData, color: string): number | null;
  buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string): object;
  formatTooltip(value: number, datasetIndex: number): string;
};

/** Evals are plotted on a fixed ±10 pawn scale so mate scores don't flatten the curve. */
export function clampEval(score: number) {
  return Math.max(-10, Math.min(10, score));
}

function normalizeScore(score: number, color: string) {
  return clampEval(color === 'black' ? -score : score);
}

// Dataset order is fixed by createChart: white, black, then the optional kibitzer.
const SERIES_LABELS = ['White', 'Black', 'Kibitzer'];
const seriesLabel = (datasetIndex: number) => SERIES_LABELS[datasetIndex] ?? 'Kibitzer';

function peak(datasets: (number | null)[][], transform: (v: number) => number) {
  let max = 0;
  datasets.forEach((data) => {
    data.forEach((val) => {
      if (val !== null) max = Math.max(max, transform(val));
    });
  });
  return max;
}

function computeEvalYBound(whiteData: (number | null)[], blackData: (number | null)[]) {
  const maxAbs = peak([whiteData, blackData], Math.abs);
  const bound = Math.max(1, Math.min(10, Math.ceil(maxAbs)));
  return bound % 2 === 0 ? bound : Math.min(10, bound + 1);
}

function computePositiveYBound(whiteData: (number | null)[], blackData: (number | null)[]) {
  const maxVal = peak([whiteData, blackData], (v) => v);
  if (!maxVal) return 1;
  const withPadding = maxVal * 1.1;
  const magnitude = 10 ** Math.floor(Math.log10(withPadding));
  return Math.ceil(withPadding / magnitude) * magnitude;
}

function abbreviateNumber(n: number) {
  if (n >= 1e12) return `${+(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/**
 * Y-axis shared by every non-eval graph: zero-based, auto-bounded from the data,
 * dashed grid. Only the tick rendering differs between them.
 */
function positiveAxis(ticks: Record<string, unknown>): GraphTypeConfig['buildYAxis'] {
  return (whiteData, blackData, textColor, gridColor) => ({
    min: 0,
    suggestedMax: computePositiveYBound(whiteData, blackData),
    ticks: { color: textColor, font: { size: 10 }, ...ticks },
    grid: { color: gridColor, drawTicks: false },
    border: { dash: [2, 4] },
  });
}

const GRAPH_TYPES: Record<string, GraphTypeConfig> = {
  eval: {
    label: 'Eval',
    getValue(meta: MoveMetaData, color: string) {
      return meta.score != null ? normalizeScore(meta.score, color) : null;
    },
    buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string) {
      const bound = computeEvalYBound(whiteData, blackData);
      return {
        min: -bound,
        max: bound,
        ticks: {
          color: textColor,
          font: { size: 10 },
          stepSize: bound / 2,
          callback(v: number) {
            if (v === 0) return '0';
            return v > 0 ? `+${v}` : String(v);
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value: number, datasetIndex: number) {
      return `${seriesLabel(datasetIndex)}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
    },
  },

  depth: {
    label: 'Depth',
    getValue(meta: MoveMetaData) {
      return meta.depth;
    },
    buildYAxis: positiveAxis({ precision: 0 }),
    formatTooltip(value: number, datasetIndex: number) {
      return `${seriesLabel(datasetIndex)}: ${value}`;
    },
  },

  nodes: {
    label: 'Nodes',
    getValue(meta: MoveMetaData) {
      return meta.nodes;
    },
    buildYAxis: positiveAxis({ callback: (v: number) => abbreviateNumber(v) }),
    formatTooltip(value: number, datasetIndex: number) {
      return `${seriesLabel(datasetIndex)}: ${abbreviateNumber(value)}`;
    },
  },

  nps: {
    label: 'NPS',
    getValue(meta: MoveMetaData) {
      return meta.time != null && meta.time > 0 && meta.nodes != null ? Math.round(meta.nodes / meta.time) : null;
    },
    buildYAxis: positiveAxis({ callback: (v: number) => `${abbreviateNumber(v)}/s` }),
    formatTooltip(value: number, datasetIndex: number) {
      return `${seriesLabel(datasetIndex)}: ${abbreviateNumber(value)} NPS`;
    },
  },

  time: {
    label: 'Time',
    getValue(meta: MoveMetaData) {
      return meta.time;
    },
    buildYAxis: positiveAxis({ callback: (v: number) => `${v}s` }),
    formatTooltip(value: number, datasetIndex: number) {
      return `${seriesLabel(datasetIndex)}: ${value}s`;
    },
  },
};

export default GRAPH_TYPES;
