// public/js/components/graphs/graph-types.js

function normalizeScore(score, color) {
  const signed = color === 'black' ? -score : score;
  return Math.max(-10, Math.min(10, signed));
}

function computeEvalYBound(whiteData, blackData) {
  let maxAbs = 0;
  whiteData.forEach((val) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  blackData.forEach((val) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  const bound = Math.max(1, Math.min(10, Math.ceil(maxAbs)));
  return bound % 2 === 0 ? bound : Math.min(10, bound + 1);
}

function computePositiveYBound(whiteData, blackData) {
  let maxVal = 0;
  whiteData.forEach((val) => {
    if (val !== null) maxVal = Math.max(maxVal, val);
  });
  blackData.forEach((val) => {
    if (val !== null) maxVal = Math.max(maxVal, val);
  });
  if (!maxVal) return 1;
  const withPadding = maxVal * 1.1;
  const magnitude = 10 ** Math.floor(Math.log10(withPadding));
  return Math.ceil(withPadding / magnitude) * magnitude;
}

function abbreviateNumber(n) {
  if (n >= 1e12) return `${+(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

const GRAPH_TYPES = {
  eval: {
    label: 'Eval',
    getValue(meta, color) {
      return normalizeScore(meta.score, color);
    },
    buildYAxis(whiteData, blackData, textColor, gridColor) {
      const bound = computeEvalYBound(whiteData, blackData);
      return {
        min: -bound,
        max: bound,
        ticks: {
          color: textColor,
          font: { size: 10 },
          stepSize: bound / 2,
          callback(v) {
            if (v === 0) return '0';
            return v > 0 ? `+${v}` : String(v);
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value, datasetIndex) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
    },
  },

  depth: {
    label: 'Depth',
    getValue(meta) {
      return meta.depth;
    },
    buildYAxis(whiteData, blackData, textColor, gridColor) {
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
    formatTooltip(value, datasetIndex) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${value}`;
    },
  },

  nodes: {
    label: 'Nodes',
    getValue(meta) {
      return meta.nodes;
    },
    buildYAxis(whiteData, blackData, textColor, gridColor) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v) {
            return abbreviateNumber(v);
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value, datasetIndex) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${abbreviateNumber(value)}`;
    },
  },

  nps: {
    label: 'NPS',
    getValue(meta) {
      return meta.time > 0 ? Math.round(meta.nodes / meta.time) : null;
    },
    buildYAxis(whiteData, blackData, textColor, gridColor) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v) {
            return `${abbreviateNumber(v)}/s`;
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value, datasetIndex) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${abbreviateNumber(value)} NPS`;
    },
  },

  time: {
    label: 'Time',
    getValue(meta) {
      return meta.time;
    },
    buildYAxis(whiteData, blackData, textColor, gridColor) {
      const maxVal = computePositiveYBound(whiteData, blackData);
      return {
        min: 0,
        suggestedMax: maxVal,
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback(v) {
            return `${v}s`;
          },
        },
        grid: { color: gridColor, drawTicks: false },
        border: { dash: [2, 4] },
      };
    },
    formatTooltip(value, datasetIndex) {
      const prefix = datasetIndex === 0 ? 'White' : 'Black';
      return `${prefix}: ${value}s`;
    },
  },
};

export default GRAPH_TYPES;
