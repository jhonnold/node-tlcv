import $ from 'jquery';

// Finn Eggers table logic

$(() => {
  let lines = data.split('\n');
  lines = lines.slice(2, lines.length - 1); // Remove headers and last empty line

  let tbody = document.getElementById('table-body');
  let theadrow = document.getElementById('table-head-row');

  let maxEngineIndex = 0;
  for (let line of lines) {
    // Stop processing lines if you reach "Total games"
    if (line.includes('Total games')) {
      break;
    }
    // Skip the header lines
    if (line.startsWith('RANK') || line.startsWith('-')) {
      continue;
    }
    let lineData = line.split(' ');
    if (lineData.length > 1) {
      maxEngineIndex = Math.max(maxEngineIndex, Math.round(parseFloat(lineData[0])));
    }
  }

  lines.forEach((line) => {
    let row = document.createElement('tr');

    let lineData = line.split(' ').filter((item) => item !== '');

    if (lineData.length < maxEngineIndex) {
      return;
    }

    let rank = lineData[0];
    let engine = lineData.slice(1, -maxEngineIndex - 2).join(' ');
    let engine_short = lineData[1];
    let games = lineData[lineData.length - maxEngineIndex - 2];
    let points = lineData[lineData.length - maxEngineIndex - 1];
    let results = lineData.slice(-maxEngineIndex);

    let th = document.createElement('th');
    th.textContent = engine_short;
    th.textAlign = 'center';
    theadrow.appendChild(th);

    [rank].forEach((cellValue) => {
      let cell = document.createElement('td');
      cell.textContent = cellValue;
      cell.classList.add('thin');
      row.appendChild(cell);
    });

    [engine_short, points + '/' + games].forEach((cellValue, index) => {
      let cell = document.createElement('td');
      cell.textContent = cellValue;
      cell.classList.add('cell-bold');
      row.appendChild(cell);
    });

    for (let k = 0; k < results.length; k++) {
      let cell = document.createElement('td');
      let container = document.createElement('div');
      container.classList.add('cell-container');
      cell.classList.add('cell-border-left');

      let res = results[k];
      if (res.length % 2 === 1) {
        res += '.';
      }

      let w = 0;
      let d = 0;
      let l = 0;

      for (let i = 0; i < res.length; i += 2) {
        let group_div = document.createElement('div');
        group_div.classList.add('group-div');

        let d1 = res_to_div(res[i]);
        let d2 = res_to_div(res[i + 1]);

        w += res[i] === '1';
        d += res[i] === '=';
        l += res[i] === '0';

        w += res[i + 1] === '1';
        d += res[i + 1] === '=';
        l += res[i + 1] === '0';

        let group_score = score(res[i]) + score(res[i + 1]);

        // group_div.style.border = "2px solid transparent";
        if (!isNaN(group_score)) {
          if (group_score > 1) {
            group_div.classList.add('group-score-green');
          } else if (group_score < 1) {
            group_div.classList.add('group-score-red');
          }
        }

        group_div.appendChild(d1);
        group_div.appendChild(d2);

        container.appendChild(group_div);
      }

      if (w + d + l > 0) {
        let tooltip = document.createElement('div');
        tooltip.textContent = `W:${w} D:${d} L:${l}`;
        tooltip.className = 'custom-tooltip';
        cell.appendChild(tooltip);
      }

      cell.appendChild(container);
      // cell.style.padding="0";
      row.appendChild(cell);
    }

    function score(char) {
      if (char === '=') {
        return 0.5;
      } else if (char === '0') {
        return 0;
      } else if (char === '1') {
        return 1;
      }
      return 0.0 / 0.0;
    }

    function res_to_div(char) {
      let div = document.createElement('div');
      div.classList.add('result-div');
      if (char === '=') {
        div.textContent = '\u00BD'; // Unicode for 1/2
        div.classList.add('result-half');
        div.style.color = 'gray';
      } else if (char === '0') {
        div.textContent = '0';
        div.classList.add('result-zero');
      } else if (char === '1') {
        div.textContent = '1';
        div.classList.add('result-one');
      }
      return div;
    }

    tbody.appendChild(row);
  });
});
