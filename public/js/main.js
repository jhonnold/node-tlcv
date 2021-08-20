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
  const { game, spectators, chat } = data;

  updateInfo(game);
  updateInfo(game, 'black');

  if (game.stm == 'w') {
    if (!timerIntervals['white']) startTimer(game);

    if (game.white.lastMove) {
      highlightSq(game.white.lastMove.from, false);
      highlightSq(game.white.lastMove.to, false);
    }

    if (game.black.lastMove) {
      highlightSq(game.black.lastMove.from);
      highlightSq(game.black.lastMove.to);
    }
  } else {
    if (!timerIntervals['black']) startTimer(game, 'black');

    if (game.black.lastMove) {
      highlightSq(game.black.lastMove.from, false);
      highlightSq(game.black.lastMove.to, false);
    }

    if (game.white.lastMove) {
      highlightSq(game.white.lastMove.from);
      highlightSq(game.white.lastMove.to);
    }
  }

  $('#fen').text(game.fen);
  board.position(game.fen);

  $('#spectator-box').children().remove();

  spectators.sort().forEach((name) => {
    $('#spectator-box').append($('<li>').append($('<p>').text(name)));
  });

  $('#chat-box').children().remove();
  chat.forEach((msg) => {
    $('#chat-box').append($('<p>').text(msg));
  });
}

function username() {
  return $('#username').val() || 'Anonymous';
}

$(document).ready(function () {
  $('#username').val(localStorage.getItem('tlcv.net-username'));

  const board = Chessboard('board', { pieceTheme: '/img/chesspieces/svg/{piece}.svg'});
  const socket = io({ autoConnect: false });

  $('#chat-area').height($('#board').height() - 318);

  $(window).resize(() => {
    board.resize();
    $('#chat-area').height($('#board').height() - 318);
  });

  $('#fen-tooltip').click(copyFen);

  $('#chat-btn').click(() => {
    const msg = $('#chat-msg').val();
    if (!msg) return;

    socket.emit('chat', `(${username()}) ${msg}`);
    $('#chat-msg').val('');
  });

  $('#chat-msg').bind('enterKey', () => {
    const msg = $('#chat-msg').val();
    if (!msg) return;

    socket.emit('chat', `(${username()}) ${msg}`);
    $('#chat-msg').val('');
  });

  $('#username').blur(function () {
    localStorage.setItem('tlcv.net-username', username());
    socket.emit('nick', username());
  });

  $('input').keyup(function (e) {
    if (e.keyCode == 13) {
      $(this).trigger('enterKey');
    }
  });

  socket.on('connect', () => socket.emit('join', { port, user: username() }));
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
