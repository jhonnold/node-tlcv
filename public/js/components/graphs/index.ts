// public/js/components/graphs/index.js
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';
import type { MoveMetaData, SerializedGame } from '../../../../shared/types';
import { on } from '../../events/index';
import { getActiveTab } from '../tabs/index';
import { goTo, getNavIndex } from '../navigation/index';
import GRAPH_TYPES from './graph-types';
import { init as initSelector, setActive } from './selector';
import { isReplayMode } from '../replay/index';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

// Module state
let chart: Chart | null = null;
let chartInitialized = false;
let activeGraph = 'eval';
let gameMoves: MoveMetaData[] = [];
let whiteName = '';
let blackName = '';
let kibitzerName = '';

function getCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildPointRadii(dataArray: (number | null)[]) {
  const activeIdx = getNavIndex() - 1;
  return dataArray.map((val: number | null, i: number) => {
    if (i === activeIdx && val !== null) return 6;
    return 3;
  });
}

function buildChartData(type: string) {
  const config = GRAPH_TYPES[type];
  if (!gameMoves.length) {
    return { labels: [], whiteData: [], blackData: [], kibitzerData: [] };
  }

  const count = gameMoves.length;
  const whiteData = new Array(count).fill(null);
  const blackData = new Array(count).fill(null);
  const kibitzerData = new Array(count).fill(null);
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

    // Kibitzer data — only on eval graph, one point per move
    if (type === 'eval' && m.kibitzer?.score != null) {
      const normalizedScore = Math.max(-10, Math.min(10, m.kibitzer.score));
      kibitzerData[i] = normalizedScore;
    }
  }

  return { labels, whiteData, blackData, kibitzerData };
}

function prepareChartPayload() {
  const { labels, whiteData, blackData, kibitzerData } = buildChartData(activeGraph);
  const textColor = getCssVar('--textColor');
  const gridColor = getCssVar('--surfaceColorHover');
  // For eval graph, include kibitzer data in Y-axis bound
  const boundData = activeGraph === 'eval' ? [...whiteData, ...kibitzerData] : whiteData;
  const yAxis = GRAPH_TYPES[activeGraph].buildYAxis(boundData, blackData, textColor, gridColor);
  return { labels, whiteData, blackData, kibitzerData, yAxis };
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
  const graphWhiteColor = getCssVar('--graphWhiteColor');
  const graphBlackColor = getCssVar('--graphBlackColor');
  const textColor = getCssVar('--textColor');
  const { labels, whiteData, blackData, kibitzerData, yAxis } = prepareChartPayload();

  const datasets = [
    {
      label: whiteName || 'White',
      data: whiteData,
      borderColor: graphWhiteColor,
      backgroundColor: graphWhiteColor,
      borderWidth: 1.5,
      pointRadius: buildPointRadii(whiteData),
      pointHoverRadius: 5,
      pointBackgroundColor: graphWhiteColor,
      tension: 0.3,
      spanGaps: true,
    },
    {
      label: blackName || 'Black',
      data: blackData,
      borderColor: graphBlackColor,
      backgroundColor: graphBlackColor,
      borderWidth: 1.5,
      pointRadius: buildPointRadii(blackData),
      pointHoverRadius: 5,
      pointBackgroundColor: graphBlackColor,
      tension: 0.3,
      spanGaps: true,
    },
  ];

  if (activeGraph === 'eval') {
    datasets.push({
      label: kibitzerName || 'Kibitzer',
      data: kibitzerData,
      borderColor: primaryColor,
      backgroundColor: primaryColor,
      borderWidth: 1,
      pointRadius: buildPointRadii(kibitzerData),
      pointHoverRadius: 4,
      pointBackgroundColor: primaryColor,
      tension: 0.3,
      spanGaps: true,
      // @ts-expect-error -- borderDash exists on line dataset but not on the generic union
      borderDash: [4, 4],
    });
  }

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets,
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
          display: true,
          title: { display: true, text: 'Move number', color: textColor, font: { size: 11 } },
          ticks: {
            color: textColor,
            font: { size: 10 },
            autoSkip: true,
            maxRotation: 0,
            // `this` is the scale (regular method, not arrow); label is "12. Nf3" / "12... c5"
            callback(value: string | number) {
              const label = this.getLabelForValue(value as number);
              const match = /^(\d+)\.\s/.exec(label); // white's "N. " only; black returns ''
              return match ? match[1] : '';
            },
          },
          grid: { display: false },
        },
        y: yAxis,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, boxWidth: 16, boxHeight: 10, padding: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
            label(item) {
              if (item.raw === null) return '';
              return GRAPH_TYPES[activeGraph].formatTooltip(item.raw as number, item.datasetIndex);
            },
          },
        },
      },
    },
  });

  chartInitialized = true;
}

function refreshChart() {
  if (!chartInitialized || !chart) return;
  const { labels, whiteData, blackData, kibitzerData, yAxis } = prepareChartPayload();
  chart.data.labels = labels;
  chart.data.datasets[0].label = whiteName || 'White';
  chart.data.datasets[0].data = whiteData;
  // @ts-expect-error -- pointRadius exists on line dataset but not on the generic union
  chart.data.datasets[0].pointRadius = buildPointRadii(whiteData);
  chart.data.datasets[1].label = blackName || 'Black';
  chart.data.datasets[1].data = blackData;
  // @ts-expect-error -- pointRadius exists on line dataset but not on the generic union
  chart.data.datasets[1].pointRadius = buildPointRadii(blackData);
  if (chart.data.datasets[2]) {
    chart.data.datasets[2].label = kibitzerName || 'Kibitzer';
    chart.data.datasets[2].data = kibitzerData;
    // @ts-expect-error -- pointRadius exists on line dataset but not on the generic union
    chart.data.datasets[2].pointRadius = buildPointRadii(kibitzerData);
  }
  Object.assign(chart.options!.scales!.y!, yAxis);
  chart.update('none');
}

function storeGameData(game: SerializedGame) {
  gameMoves = game.moves || [];
  whiteName = game.white?.name || '';
  blackName = game.black?.name || '';
  kibitzerName = game.kibitzerLiveData?.name || '';
}

function switchGraphType(type: string) {
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
    if (isReplayMode()) return;
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
