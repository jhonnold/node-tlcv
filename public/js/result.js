function parseAndDisplay(data) {
  let lines = data.split("\n");
  lines = lines.slice(2, lines.length - 1);

  let tbody = document.getElementById('table-body');
  let theadrow = document.getElementById('table-head-row');

  let maxEngineIndex = 0;
  for (let line of lines) {
    if (line.includes("Total games")) {
      break;
    }
    if (line.startsWith("RANK") || line.startsWith("-")) {
      continue;
    }
    lineData = line.split(" ")
    if (lineData.length > 1) {
      maxEngineIndex = Math.max(maxEngineIndex, Math.round(parseFloat(lineData[0])));
    }
  }

  lines.forEach(line => {
    let row = document.createElement("tr");

    let lineData = line.split(" ").filter(item => item !== "");

    if (lineData.length < maxEngineIndex) {
      return;
    }

    let rank = lineData[0];
    let engine = lineData.slice(1, -maxEngineIndex - 2).join(" ");
    let engine_short = lineData[1];
    let games = lineData[lineData.length - maxEngineIndex - 2];
    let points = lineData[lineData.length - maxEngineIndex - 1];
    let results = lineData.slice(-maxEngineIndex);

    let th = document.createElement("th");
    th.textContent = engine_short;
    th.classList.add('table-header-cell');
    theadrow.appendChild(th);

    [engine_short, games + "/" + points].forEach((cellValue, index) => {
      let cell = document.createElement("td");
      cell.textContent = cellValue;
      cell.classList.add('bold-cell');
      row.appendChild(cell);
    });

    for (let k = 0; k < results.length; k++) {
      let cell = document.createElement("td");
      let container = document.createElement("div");
      container.classList.add('cell-container');

      cell.classList.add('border-left-cell');

      let res = results[k];
      if (res.length % 2 === 1) {
        res += ".";
      }

      for (let i = 0; i < res.length; i += 2) {
        let group_div = document.createElement("div");
        group_div.classList.add('group-div');

        d1 = res_to_div(res[i]);
        d2 = res_to_div(res[i + 1]);

        group_score = score(res[i]) + score(res[i + 1]);

        if (!isNaN(group_score)) {
          if (group_score > 1) {
            group_div.classList.add('green-bg');
          } else if (group_score < 1) {
            group_div.classList.add('red-bg');
          }
        }

        group_div.appendChild(d1);
        group_div.appendChild(d2);

        container.appendChild(group_div);
      }

      cell.appendChild(container);
      row.appendChild(cell);
    }

    function score(char) {
      if (char === "=") {
        return 0.5;
      } else if (char === "0") {
        return 0;
      } else if (char === "1") {
        return 1;
      }
      return NaN;
    }

    function res_to_div(char) {
      let div = document.createElement("div");
      div.classList.add('result-div');

      if (char === "=") {
        div.textContent = "\u00BD";
        div.classList.add('gray-text');
      } else if (char === "0") {
        div.textContent = "0";
        div.classList.add('red-text');
      } else if (char === "1") {
        div.textContent = "1";
        div.classList.add('green-text');
      }
      return div;
    }

    tbody.appendChild(row);
  });
}

window.onload = function () {
  const data = `<%- data %>`;
  parseAndDisplay(data);
}
