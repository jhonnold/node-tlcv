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

function updateTitle(val) {
  const curr = document.title;

  if (curr != val) document.title = val;
}

function updateInfo(game, color) {
  let score = game[color].score;
  if (color === 'black') score *= -1;
  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), score.toFixed(2));
  updateElText($(`#${color}-depth`), game[color].depth);
  updateElText($(`#${color}-nodes`), (game[color].nodes / 1000000).toFixed(2) + 'M');
  updateElText($(`#${color}-nps`), (game[color].nodes / game[color].usedTime / 1000).toFixed(2) + 'M');
  $(`#${color}-pv`).html(pv(game, color));
}

function addChat(msg) {
  let name = msg;
  let rest = '';

  if (msg.startsWith('[tlcv.net')) {
    const res = /\[(.*)\]\s+-\s+\((.*?)\)\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[2]}] `;
      rest = res[3];
    }
  } else {
    const res = /\[(.*)\]\s+-\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[1]}] `;
      rest = res[2];
    }
  }

  $('#chat-box').append($('<p>').text(rest).prepend($('<strong>').text(name)));
}

function setChat(msgs) {
  $('#chat-box').children().remove();

  msgs.forEach((msg) => {
    addChat(msg);
  });
}

function update(data, board) {
  const { game, spectators, menu } = data;

  updateTitle(`${game.white.name} vs ${game.black.name} (${game.site})`);

  updateInfo(game, 'white');
  updateInfo(game, 'black');

  updateTimers(data);
  updateLastMoves(data);

  $('#opening').text(`Opening: ${game.opening}`);
  $('#fen').text(game.fen);
  board.position(game.fen);

  $('#spectator-box').children().remove();

  spectators.sort().forEach((name) => {
    $('#spectator-box').append($('<li>').append($('<p>').text(name)));
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

const storedTheme = localStorage.getItem('theme');

const getPreferredTheme = () => {
  if (storedTheme) return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const setTheme = (theme) => {
  if (theme === 'dark') {
    $('#theme-light').show();
    $('#theme-dark').hide();
    const link = document.createElement('link');
    link['rel'] = 'stylesheet';
    link['href'] = '/css/dark-theme.css';
    $('head').append(link);
  } else {
    $('#theme-light').hide();
    $('#theme-dark').show();
    const darkTheme = $('head [href="/css/dark-theme.css"]');
    if (darkTheme) darkTheme.remove();
  }
  localStorage.setItem('theme', theme);
};

setTheme(getPreferredTheme());

$(function () {
  const board = Chessboard('board', { pieceTheme: '/img/{piece}.svg', showNotation: false });
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

  // first time connection
  socket.on('state', (data) => {
    update(data, board);

    setChat(data.chat);
    const scrollTop = $('#chat-box')[0].scrollHeight;
    $('#chat-box').stop().animate({ scrollTop });
  });

  // game updates
  socket.on('update', (data) => {
    update(data, board);
  });

  // chat messages
  socket.on('new-chat', (data) => {
    const notScrolled = $('#chat-box')[0].scrollTop + chatHeight() > $('#chat-box')[0].scrollHeight;

    data.forEach((msg) => addChat(msg));

    if (notScrolled) {
      const scrollTop = $('#chat-box')[0].scrollHeight;
      $('#chat-box').stop().animate({ scrollTop });
    }
  });

  // Enable the connection!
  socket.connect();

  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
});
