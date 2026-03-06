// public/js/components/graphs/index.js
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js';
import { on } from '../../events/index.js';
import { getActiveTab } from '../tabs/index.js';
import { goTo, getNavIndex } from '../navigation/index.js';
import GRAPH_TYPES from './graph-types.js';
import { init as initSelector, setActive } from './selector.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

// Module state
let chart = null;
let chartInitialized = false;
let activeGraph = 'eval';
let whiteMoves = [];
let blackMoves = [];
let sanMoves = [];
let startFen = null;

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

function buildChartData(type) {
  const config = GRAPH_TYPES[type];
  if (!sanMoves.length) {
    return { labels: [], whiteData: [], blackData: [] };
  }

  const count = sanMoves.length;
  const whiteData = new Array(count).fill(null);
  const blackData = new Array(count).fill(null);
  const labels = new Array(count).fill('');

  // Build lookup maps: moveNumber -> MoveMetaData
  const whiteByNum = new Map();
  whiteMoves.forEach((meta) => whiteByNum.set(meta.number, meta));
  const blackByNum = new Map();
  blackMoves.forEach((meta) => blackByNum.set(meta.number, meta));

  const blackStarts = startFen ? startFen.split(' ')[1] === 'b' : false;
  const startMoveNum = startFen ? parseInt(startFen.split(' ')[5], 10) || 1 : 1;
  const halfMoveOffset = blackStarts ? 1 : 0;

  for (let i = 0; i < sanMoves.length; i += 1) {
    const globalHalfMove = i + halfMoveOffset;
    const moveNum = startMoveNum + Math.floor(globalHalfMove / 2);
    const isWhiteMove = globalHalfMove % 2 === 0;

    if (isWhiteMove) {
      labels[i] = `${moveNum}. ${sanMoves[i]}`;
      if (whiteByNum.has(moveNum)) {
        whiteData[i] = config.getValue(whiteByNum.get(moveNum), 'white');
      }
    } else {
      labels[i] = `${moveNum}... ${sanMoves[i]}`;
      if (blackByNum.has(moveNum)) {
        blackData[i] = config.getValue(blackByNum.get(moveNum), 'black');
      }
    }
  }

  return { labels, whiteData, blackData };
}

function prepareChartPayload() {
  const { labels, whiteData, blackData } = buildChartData(activeGraph);
  const textColor = getCssVar('--textColor');
  const gridColor = getCssVar('--surfaceColorHover');
  const yAxis = GRAPH_TYPES[activeGraph].buildYAxis(whiteData, blackData, textColor, gridColor);
  return { labels, whiteData, blackData, yAxis };
}

function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  chartInitialized = false;
}

function createChart() {
  const canvas = document.getElementById('graphs-chart');
  if (!canvas) return;

  const primaryColor = getCssVar('--primaryColor');
  const { labels, whiteData, blackData, yAxis } = prepareChartPayload();

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
        x: { display: false },
        y: yAxis,
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
              return GRAPH_TYPES[activeGraph].formatTooltip(item.raw, item.datasetIndex);
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
  const { labels, whiteData, blackData, yAxis } = prepareChartPayload();
  chart.data.labels = labels;
  chart.data.datasets[0].data = whiteData;
  chart.data.datasets[0].pointRadius = buildPointRadii(whiteData);
  chart.data.datasets[1].data = blackData;
  chart.data.datasets[1].pointRadius = buildPointRadii(blackData);
  Object.assign(chart.options.scales.y, yAxis);
  chart.update('none');
}

function storeGameData(game) {
  whiteMoves = game.white.moves || [];
  blackMoves = game.black.moves || [];
  sanMoves = game.moves || [];
  startFen = game.startFen || null;
}

function switchGraphType(type) {
  if (type === activeGraph) return;
  activeGraph = type;
  setActive(type);
  if (chartInitialized) {
    destroyChart();
    createChart();
  }
}

export function init() {
  initSelector(switchGraphType);

  on('game:state', (data) => {
    storeGameData(data.game);
    destroyChart();
    if (getActiveTab() === 'graphs') createChart();
  });

  on('game:update', (data) => {
    storeGameData(data.game);
    refreshChart();
  });

  on('nav:position', () => {
    refreshChart();
  });

  on('tab:change', ({ tab }) => {
    if (tab === 'graphs' && !chartInitialized) {
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
