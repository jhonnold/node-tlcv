// public/js/components/eval/index.js
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js';
import { on } from '../../events/index.js';
import { getActiveTab } from '../tabs/index.js';
import { goTo, getNavIndex } from '../navigation/index.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

// Module state
let chart = null;
let chartInitialized = false;
let whiteMoves = [];
let blackMoves = [];
let sanMoves = [];
let startFen = null;

function normalizeScore(score, color) {
  const signed = color === 'black' ? -score : score;
  return Math.max(-10, Math.min(10, signed));
}

function computeYBound(whiteData, blackData) {
  let maxAbs = 0;
  whiteData.forEach((val) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  blackData.forEach((val) => {
    if (val !== null) maxAbs = Math.max(maxAbs, Math.abs(val));
  });
  const bound = Math.max(1, Math.min(10, Math.ceil(maxAbs)));
  // Use even bounds so stepSize (bound / 2) is always a whole number
  return bound % 2 === 0 ? bound : Math.min(10, bound + 1);
}

function clampToRange(data, bound) {
  return data.map((val) => (val === null ? null : Math.max(-bound, Math.min(bound, val))));
}

function buildChartData() {
  if (!sanMoves.length) {
    return { labels: [], whiteData: [], blackData: [] };
  }

  const count = sanMoves.length;
  const whiteData = new Array(count).fill(null);
  const blackData = new Array(count).fill(null);
  const labels = new Array(count).fill('');

  // Build lookup maps: moveNumber -> score
  const whiteScores = new Map();
  whiteMoves.forEach(({ number, score }) => whiteScores.set(number, score));
  const blackScores = new Map();
  blackMoves.forEach(({ number, score }) => blackScores.set(number, score));

  // Use same offset logic as navigation component
  const blackStarts = startFen ? startFen.split(' ')[1] === 'b' : false;
  const startMoveNum = startFen ? parseInt(startFen.split(' ')[5], 10) || 1 : 1;
  const halfMoveOffset = blackStarts ? 1 : 0;

  for (let i = 0; i < sanMoves.length; i += 1) {
    const globalHalfMove = i + halfMoveOffset;
    const moveNum = startMoveNum + Math.floor(globalHalfMove / 2);
    const isWhiteMove = globalHalfMove % 2 === 0;

    if (isWhiteMove) {
      labels[i] = `${moveNum}. ${sanMoves[i]}`;
      if (whiteScores.has(moveNum)) {
        whiteData[i] = normalizeScore(whiteScores.get(moveNum), 'white');
      }
    } else {
      labels[i] = `${moveNum}... ${sanMoves[i]}`;
      if (blackScores.has(moveNum)) {
        blackData[i] = normalizeScore(blackScores.get(moveNum), 'black');
      }
    }
  }

  return { labels, whiteData, blackData };
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildPointRadii(dataArray) {
  const activeIdx = getNavIndex() - 1;
  return dataArray.map((val, i) => {
    if (i === activeIdx && val !== null) return 6;
    return 3;
  });
}

function prepareChartPayload() {
  const { labels, whiteData, blackData } = buildChartData();
  const yBound = computeYBound(whiteData, blackData);
  return {
    labels,
    whiteData: clampToRange(whiteData, yBound),
    blackData: clampToRange(blackData, yBound),
    yBound,
  };
}

function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  chartInitialized = false;
}

function createChart() {
  const canvas = document.getElementById('eval-chart');
  if (!canvas) return;

  const textColor = getCssVar('--textColor');
  const gridColor = getCssVar('--surfaceColorHover');
  const primaryColor = getCssVar('--primaryColor');
  const { labels, whiteData, blackData, yBound } = prepareChartPayload();

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'White',
          data: whiteData,
          borderColor: primaryColor,
          borderWidth: 1.5,
          pointRadius: buildPointRadii(whiteData),
          pointHoverRadius: 5,
          pointBackgroundColor: primaryColor,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Black',
          data: blackData,
          borderColor: 'rgba(100, 100, 100, 1)',
          borderWidth: 1.5,
          pointRadius: buildPointRadii(blackData),
          pointHoverRadius: 5,
          pointBackgroundColor: 'rgba(100, 100, 100, 1)',
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      onClick(_event, elements) {
        if (!elements.length) return;
        goTo(elements[0].index + 1);
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          min: -yBound,
          max: yBound,
          ticks: {
            color: textColor,
            font: { size: 10 },
            stepSize: yBound / 2,
            callback(value) {
              if (value === 0) return '0';
              return value > 0 ? `+${value}` : String(value);
            },
          },
          grid: {
            color: gridColor,
            drawTicks: false,
          },
          border: { dash: [2, 4] },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
            label(item) {
              if (item.raw === null) return null;
              const prefix = item.datasetIndex === 0 ? 'White' : 'Black';
              const val = item.raw;
              return `${prefix}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
            },
          },
        },
      },
    },
  });

  chartInitialized = true;
}

function refreshChart() {
  if (!chartInitialized) return;
  const { labels, whiteData, blackData, yBound } = prepareChartPayload();
  chart.data.labels = labels;
  chart.data.datasets[0].data = whiteData;
  chart.data.datasets[0].pointRadius = buildPointRadii(whiteData);
  chart.data.datasets[1].data = blackData;
  chart.data.datasets[1].pointRadius = buildPointRadii(blackData);
  chart.options.scales.y.min = -yBound;
  chart.options.scales.y.max = yBound;
  chart.options.scales.y.ticks.stepSize = yBound / 2;
  chart.update('none');
}

function storeGameData(game) {
  whiteMoves = game.white.moves || [];
  blackMoves = game.black.moves || [];
  sanMoves = game.moves || [];
  startFen = game.startFen || null;
}

export function init() {
  on('game:state', (data) => {
    storeGameData(data.game);
    destroyChart();
    if (getActiveTab() === 'eval') createChart();
  });

  on('game:update', (data) => {
    storeGameData(data.game);
    refreshChart();
  });

  on('nav:position', () => {
    refreshChart();
  });

  on('tab:change', ({ tab }) => {
    if (tab === 'eval' && !chartInitialized) {
      createChart();
    }
  });

  on('theme:change', () => {
    if (chartInitialized) {
      destroyChart();
      createChart();
    }
  });
}

export default { init };
