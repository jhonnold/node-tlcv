$(document).ready(function () {
  const board = Chessboard('board');

  function update() {
    $.get('/data?_=' + new Date().getTime(), function (data) {
      $('#black-name').text(data.black.name);
      $('#black-info').text('d' + data.black.depth + ', ' + (data.black.score / 100).toFixed(2));
      $('#black-pv').text(data.black.pv.join(' '));

      $('#white-name').text(data.white.name);
      $('#white-info').text('d' + data.white.depth + ', ' + (data.white.score / 100).toFixed(2));
      $('#white-pv').text(data.white.pv.join(' '));

      board.position(data.fen);
    });
  }

  update();
  setInterval(update, 2500);
});
