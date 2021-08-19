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
  $('#' + color + '-time').html('<mark>' + msToTimeString(Math.max(0, time - usedTime)) + '</mark>');
  $('#' + color + '-think').text(msToTimeString(usedTime));
}

function startTimer(data, color = 'white') {
  const opp = color == 'white' ? 'black' : 'white';
  const time = data[color].clockTime;
  const start = data[color].startTime;

  clearInterval(timerIntervals[opp]);
  timerIntervals[opp] = null;
  $('#' + opp + '-time').text($('#' + opp + '-time > mark').text());

  setTimes(time, start, color);
  timerIntervals[color] = setInterval(() => setTimes(time, start, color), 1000);
}

function highlightSq(sq, enable = true) {
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
  updateElText($('#' + color + '-score'), data[color].score.toFixed(2));
  updateElText($('#' + color + '-depth'), data[color].depth);
  updateElText($('#' + color + '-nodes'), (data[color].nodes / 1000000).toFixed(2) + 'm');
  updateElText($('#' + color + '-nps'), (data[color].nodes / data[color].usedTime / 1000).toFixed(2) + 'm');

  if (color.startsWith(data.stm)) {
    let moveNumber = data.moveNumber;
    let printNumber = color == 'white';
    let text = '';

    for (const move of data[color].pv) {
      if (printNumber) text += `<strong>${++moveNumber}.</strong> `;

      text += `${move} `;
      printNumber = !printNumber;
    }

    if (color == 'black') text = `<strong>${data.moveNumber}...</strong> ` + text;
    $('#' + color + '-pv').html(text);
  }
}

function update(data, board) {
  updateInfo(data);
  updateInfo(data, 'black');

  if (data.stm == 'w') {
    if (!timerIntervals['white']) startTimer(data);

    if (data.white.lastMove) {
      highlightSq(data.white.lastMove.from, false);
      highlightSq(data.white.lastMove.to, false);
    }

    if (data.black.lastMove) {
      highlightSq(data.black.lastMove.from);
      highlightSq(data.black.lastMove.to);
    }
  } else {
    if (!timerIntervals['black']) startTimer(data, 'black');

    if (data.black.lastMove) {
      highlightSq(data.black.lastMove.from, false);
      highlightSq(data.black.lastMove.to, false);
    }

    if (data.white.lastMove) {
      highlightSq(data.white.lastMove.from);
      highlightSq(data.white.lastMove.to);
    }
  }

  $('#fen').text(data.fen);
  board.position(data.fen);

  $('#spectator-box').children().remove();

  data.spectators.sort().forEach((name) => {
    $('#spectator-box').append($('<li>').append($('<p>').text(name)));
  });

  $('#chat-box').children().remove();
  data.chat.forEach((msg) => {
    $('#chat-box').append($('<p>').text(msg));
  });
}

$(document).ready(function () {
  const board = Chessboard('board');
  $('#chat-area').height($('#board').height() - 318);

  $(window).resize(() => {
    board.resize();
    $('#chat-area').height($('#board').height() - 318);
  });

  $('#fen-tooltip').click(copyFen);

  $('#chat-btn').click(() => {
    const msg = $('#chat-msg').val();
    if (!msg) return;

    socket.emit('chat', msg);
    $('#chat-msg').val('');
  });

  $('#chat-msg').bind('enterKey', () => {
    const msg = $('#chat-msg').val();
    if (!msg) return;

    socket.emit('chat', msg);
    $('#chat-msg').val('');
  });

  $('input').keyup(function (e) {
    if (e.keyCode == 13) {
      $(this).trigger('enterKey');
    }
  });

  const socket = io({ autoConnect: false });
  socket.on('connect', () => socket.emit('join', port));
  socket.on('update', (data) => {
    update(data, board);

    $('#chat-box')
      .stop()
      .animate({
        scrollTop: $('#chat-box')[0].scrollHeight,
      });
  });
  socket.connect();
});
