import $ from 'jquery';
import Chessboard from 'chessboardjs';
import { updateTimers } from './time';
import { updateLastMoves } from './move';
import { pv } from './pv';
import { username, sendMsg } from './chat';
import { copyFen } from './fen';

function updateElText(el, val) {
  const curr = el.text();

  if (curr != val) el.text(val);
}

function updateInfo(game, color) {
  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), game[color].score.toFixed(2));
  updateElText($(`#${color}-depth`), game[color].depth);
  updateElText($(`#${color}-nodes`), (game[color].nodes / 1000000).toFixed(2) + 'M');
  updateElText($(`#${color}-nps`), (game[color].nodes / game[color].usedTime / 1000).toFixed(2) + 'M');
  $(`#${color}-pv`).html(pv(game, color));
}

function update(data, board) {
  const { game, spectators, chat, menu } = data;

  updateInfo(game, 'white');
  updateInfo(game, 'black');

  updateTimers(data);
  updateLastMoves(data);

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

  const $eventThreadButton = $('#event-thread');
  const $scheduleButton = $('#schedule');

  if (menu.schedule) {
    if (!$scheduleButton[0])
      $('#button-container').append(
        $('<a>')
          .attr('href', menu.schedule)
          .attr('class', 'primary button')
          .attr('id', 'schedule')
          .attr('target', '_blank')
          .text('Schedule'),
      );
    else if ($scheduleButton.attr('href') != menu.schedule) $scheduleButton.attr('href', menu.schedule);
  } else {
    $scheduleButton.remove();
  }

  if (menu.even) {
    if (!$eventThreadButton[0])
      $('#button-container').append(
        $('<a>')
          .attr('href', menu.even)
          .attr('class', 'primary button')
          .attr('id', 'event-thread')
          .attr('target', '_blank')
          .text('Event'),
      );
    else if ($eventThreadButton.attr('href') != menu.even) $eventThreadButton.attr('href', menu.even);
  } else {
    $eventThreadButton.remove();
  }
}

function chatHeight() {
  return $('#board').height() - 318;
}

$(function () {
  const board = Chessboard('board', { pieceTheme: '/img/{piece}.svg' });
  const socket = io({ autoConnect: false });

  // pull username from storage
  $('#username').val(localStorage.getItem('tlcv.net-username'));

  // We fix the chat-area height to match the board height
  $('#chat-area').height(chatHeight());

  $(window).on('resize', () => {
    board.resize();
    $('#chat-area').height(chatHeight());
  });

  // Setup FEN copy
  $('#fen-tooltip').on('click', copyFen);

  // Setup chat listeners
  $('#chat-btn').on('click', () => $('#chat-msg').trigger('send'));
  $('#chat-msg').on('keyup', function (e) {
    if (e.key == 'Enter') $(this).trigger('send');
  });
  $('#chat-msg').on('send', function () {
    sendMsg(socket, $(this));
  });

  // Nickname change
  $('#username').on('blur', function () {
    localStorage.setItem('tlcv.net-username', username());
    socket.emit('nick', username());
  });

  // connect
  socket.on('connect', () => socket.emit('join', { port, user: username() }));
  socket.on('update', (data) => {
    const notScrolled = $('#chat-box')[0].scrollTop + chatHeight() > $('#chat-box')[0].scrollHeight;

    update(data, board);

    if (notScrolled) {
      const scrollTop = $('#chat-box')[0].scrollHeight;
      $('#chat-box').stop().animate({ scrollTop });
    }
  });
  socket.connect();
});
