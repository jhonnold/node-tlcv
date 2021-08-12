$(document).ready(function () {
  const board = Chessboard('board');

  let whiteCountdownInterval = null;
  let blackCountdownInterval = null;

  function setTime(id, time, startThink) {
    const msLeft = time * 10;
    const usedTime = new Date().getTime() - startThink;
    const timeRemainingInSeconds = Math.max(0, (msLeft - usedTime) / 1000);
    const seconds = Math.floor(timeRemainingInSeconds % 60);
    const minutes = Math.floor(timeRemainingInSeconds / 60);

    const text = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    $('#' + id).html('<mark>' + text + '</mark>');
  }

  function startBlackTimer(data) {
    const time = data.black.time;
    const startThink = data.black.startThink;

    clearInterval(whiteCountdownInterval);
    whiteCountdownInterval = null;
    $('#white-time').text($('#white-time > mark').text());

    setTime('black-time', time, startThink);

    blackCountdownInterval = setInterval(() => {
      setTime('black-time', time, startThink);
    }, 1000);
  }

  function startWhiteTimer(data) {
    const time = data.white.time;
    const startThink = data.white.startThink;

    clearInterval(blackCountdownInterval);
    blackCountdownInterval = null;
    $('#black-time').text($('#black-time > mark').text());

    setTime('white-time', time, startThink);

    whiteCountdownInterval = setInterval(() => {
      setTime('white-time', time, startThink);
    }, 1000);
  }

  function highlight(sq, enable = true) {
    if (!sq) return;

    const el = $('#board').find('.square-' + sq);

    if (enable) el.addClass('highlight-last');
    else el.removeClass('highlight-last');
  }

  function update() {
    $.get('/data?_=' + new Date().getTime(), function (data) {
      $('#black-name').text(data.black.name);
      $('#black-info').text('d' + data.black.depth + ' ' + (data.black.score / 100).toFixed(2));
      $('#black-pv').text(data.black.pv.join(' '));

      $('#white-name').text(data.white.name);
      $('#white-info').text('d' + data.white.depth + ' ' + (data.white.score / 100).toFixed(2));
      $('#white-pv').text(data.white.pv.join(' '));

      if (data.stm === 'w') {
        if (!whiteCountdownInterval) startWhiteTimer(data);

        highlight(data.white.lastStart, false);
        highlight(data.white.lastEnd, false);
        highlight(data.black.lastStart);
        highlight(data.black.lastEnd);
      } else {
        if (!blackCountdownInterval) startBlackTimer(data);

        highlight(data.black.lastStart, false);
        highlight(data.black.lastEnd, false);
        highlight(data.white.lastStart);
        highlight(data.white.lastEnd);
      }

      $('#fen').text(data.fen);
      board.position(data.fen);
    });
  }

  update();
  setInterval(update, 2500);
});
