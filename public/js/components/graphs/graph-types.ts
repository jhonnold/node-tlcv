// public/js/components/graphs/graph-types.js
import type { MoveMetaData } from '../../../../shared/types';

export type GraphTypeConfig = {
  label: string;
  getValue(meta: MoveMetaData, color: string): number | null;
  buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string): object;
  formatTooltip(value: number, datasetIndex: number): string;
};

function normalizeScore(score: number, color: string) {
  const signed = color === 'black' ? -score : score;
  return Math.max(-10, Math.min(10, signed));
}

function computeEvalYBound(whiteData: (number | null)[], blackData: (number | null)[]) {
  let maxAbs = 0;
  whiteData.forEach((val: number | null) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  blackData.forEach((val: number | null) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  const bound = Math.max(1, Math.min(10, Math.ceil(maxAbs)));
  return bound % 2 === 0 ? bound : Math.min(10, bound + 1);
}

function computePositiveYBound(whiteData: (number | null)[], blackData: (number | null)[]) {
  let maxVal = 0;
  whiteData.forEach((val: number | null) => {
    if (val !== null) maxVal = Math.max(maxVal, val);
  });
  blackData.forEach((val: number | null) => {
    if (val !== null) maxVal = Math.max(maxVal, val);
  });
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
      const prefix = datasetIndex === 0 ? 'White' : datasetIndex === 1 ? 'Black' : 'Kibitzer';
      return `${prefix}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
    },
  },

  depth: {
    label: 'Depth',
    getValue(meta: MoveMetaData) {
      return meta.depth;
    },
    buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          precision: 0,
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value: number, datasetIndex: number) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${value}`;
    },
  },

  nodes: {
    label: 'Nodes',
    getValue(meta: MoveMetaData) {
      return meta.nodes;
    },
    buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v: number) {
            return abbreviateNumber(v);
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value: number, datasetIndex: number) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${abbreviateNumber(value)}`;
    },
  },

  nps: {
    label: 'NPS',
    getValue(meta: MoveMetaData) {
      return meta.time != null && meta.time > 0 && meta.nodes != null ? Math.round(meta.nodes / meta.time) : null;
    },
    buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v: number) {
            return `${abbreviateNumber(v)}/s`;
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value: number, datasetIndex: number) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${abbreviateNumber(value)} NPS`;
    },
  },

  time: {
    label: 'Time',
    getValue(meta: MoveMetaData) {
      return meta.time;
    },
    buildYAxis(whiteData: (number | null)[], blackData: (number | null)[], textColor: string, gridColor: string) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v: number) {
            return `${v}s`;
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value: number, datasetIndex: number) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${value}s`;
    },
  },
};

export default GRAPH_TYPES;
