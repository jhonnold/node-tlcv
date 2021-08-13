const timerIntervals = {
  white: null,
  black: null,
};

function msToTimeString(ms) {
  const timeRemainingInSeconds = ms / 1000;
  const seconds = Math.floor(timeRemainingInSeconds % 60);
  const minutes = Math.floor(timeRemainingInSeconds / 60);

  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function setTimes(time, start, color = 'white') {
  const usedTime = new Date().getTime() - start;
  $('#' + color + '-time').html('<mark>' + msToTimeString(Math.max(0, time * 10 - usedTime)) + '</mark>');
  $('#' + color + '-think').text(msToTimeString(new Date().getTime() - start));
}

function startTimer(data, color = 'white') {
  const opp = color == 'white' ? 'black' : 'white';
  const time = data[color].time;
  const start = data[color].startThink;

  clearInterval(timerIntervals[opp]);
  timerIntervals[opp] = null;
  $('#' + opp + '-time').text($('#' + opp + '-time > mark').text());

  setTimes(time, start, color);
  timerIntervals[color] = setInterval(() => setTimes(time, start, color), 1000);
}

function highlightSq(sq, enable = true) {
  if (!sq) return;

  const el = $('#board').find('.square-' + sq);

  if (enable) el.addClass('highlight-last');
  else el.removeClass('highlight-last');
}

function copyFen() {
  const $temp = $('<input>');
  $('body').append($temp);
  $temp.val($('#fen').text()).select();
  document.execCommand('copy');
  $temp.remove();

  $('#fen-tooltip').attr('aria-label', 'Copied!');

  setTimeout(() => {
    $('#fen-tooltip').attr('aria-label', 'Click to copy');
  }, 1000);
}

function updateElText(el, val) {
  const curr = el.text();

  if (curr != val) el.text(val);
}

function updateInfo(data, color = 'white') {
  updateElText($('#' + color + '-name'), data[color].name);
  updateElText($('#' + color + '-score'), (data[color].score / 100).toFixed(2));
  updateElText($('#' + color + '-depth'), data[color].depth);
  updateElText($('#' + color + '-nodes'), (data[color].nodes / 1000000).toFixed(2) + 'm');
  updateElText($('#' + color + '-knps'), Math.round(data[color].nodes / data[color].think / 10) + 'k');
  updateElText($('#' + color + '-pv'), data[color].pv.join(' '));
}

$(document).ready(function () {
  const board = Chessboard('board');

  function update() {
    $.get('/data?_=' + new Date().getTime(), (data) => {
      updateInfo(data);
      updateInfo(data, 'black');

      if (data.stm === 'w') {
        if (!timerIntervals['white']) startTimer(data);

        highlightSq(data.white.lastStart, false);
        highlightSq(data.white.lastEnd, false);
        highlightSq(data.black.lastStart);
        highlightSq(data.black.lastEnd);
      } else {
        if (!timerIntervals['black']) startTimer(data, 'black');

        highlightSq(data.black.lastStart, false);
        highlightSq(data.black.lastEnd, false);
        highlightSq(data.white.lastStart);
        highlightSq(data.white.lastEnd);
      }

      $('#fen').text(data.instanceFen);
      board.position(data.fen);
    });
  }

  update();
  setInterval(update, 1000);
});
