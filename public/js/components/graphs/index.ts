// public/js/components/graphs/index.js
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js';
import { on } from '../../events/index';
import { getActiveTab } from '../tabs/index';
import { goTo, getNavIndex } from '../navigation/index';
import GRAPH_TYPES from './graph-types';
import { init as initSelector, setActive } from './selector';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

// Module state
let chart = null;
let chartInitialized = false;
let activeGraph = 'eval';
let gameMoves = [];

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
  if (!gameMoves.length) {
    return { labels: [], whiteData: [], blackData: [] };
  }

  const count = gameMoves.length;
  const whiteData = new Array(count).fill(null);
  const blackData = new Array(count).fill(null);
  const labels = new Array(count).fill('');

  for (let i = 0; i < count; i += 1) {
    const m = gameMoves[i];
    const isWhite = m.color === 'w';

    labels[i] = isWhite ? `${m.number}. ${m.move}` : `${m.number}... ${m.move}`;

    if (m.depth !== null) {
      const color = isWhite ? 'white' : 'black';
      if (isWhite) {
        whiteData[i] = config.getValue(m, color);
      } else {
        blackData[i] = config.getValue(m, color);
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
  const canvas = document.getElementById('graphs-chart') as HTMLCanvasElement | null;
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
  gameMoves = game.moves || [];
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
