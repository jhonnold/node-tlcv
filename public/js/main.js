import $ from 'jquery';
import Chessboard from 'chessboardjs';
import { io } from 'socket.io-client';
import updateTimers from './time.js';
import updateLastMoves from './move.js';
import pv from './pv.js';
import { username, sendMsg } from './chat.js';
import copyFen from './fen.js';
import { clearArrows, drawMove } from './arrows.js';

const port = +window.location.pathname.replace(/\//g, '');

const storedTheme = localStorage.getItem('theme');

const getPreferredTheme = () => {
  if (storedTheme) return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

let globalTheme = getPreferredTheme();

const setTheme = (theme) => {
  if (theme === 'dark') {
    $('#theme-light').show();
    $('#theme-dark').hide();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dark-theme.css';
    $('head').append(link);
  } else {
    $('#theme-light').hide();
    $('#theme-dark').show();
    const darkTheme = $('head [href="/dark-theme.css"]');
    if (darkTheme) darkTheme.remove();
  }
  localStorage.setItem('theme', theme);

  globalTheme = theme;
  clearArrows();
};

setTheme(globalTheme);

function updateElText(el, val) {
  const curr = el.text();

  if (curr !== val) el.text(val);
}

function updateTitle(val) {
  const curr = document.title;

  if (curr !== val) document.title = val;
}

// Get the url for the logo of an engine.
// We make our best attempt to split the name from the version by:
//   * Splitting the string into words based upon non-alphanumeric characters
//   * Taking all words before the first word that contains a digit
//   * Joining the words with underscores
function getLogoUrl(engine) {
  const words = engine.toLowerCase().split(/[^a-z0-9]+/);
  const versionIdx = words.findIndex((v, i) => i > 0 && /\d/.test(v));
  return `url('img/logos/${words.slice(0, versionIdx).join('_')}.webp')`;
}

function updateLogos(white, black) {
  const whiteUrl = getLogoUrl(white);
  const blackUrl = getLogoUrl(black);

  const whiteCurr = $('#white-name').css('background-image');
  const blackCurr = $('#black-name').css('background-image');

  if (whiteCurr !== whiteUrl) $('#white-name').css('background-image', whiteUrl);
  if (blackCurr !== blackUrl) $('#black-name').css('background-image', blackUrl);
}

function updateInfo(game, color) {
  let { score } = game[color];
  if (color === 'black') score *= -1;

  if (score > 100000) {
    score = "M";
  } else if (score < -100000) {
    score = "-M";
  } else {
    score = score.toFixed(2);
  }

  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), score);
  updateElText($(`#${color}-depth`), game[color].depth);
  updateElText($(`#${color}-nodes`), `${(game[color].nodes / 1000000).toFixed(2)}M`);
  updateElText($(`#${color}-nps`), `${(game[color].nodes / game[color].usedTime / 1000).toFixed(2)}M`);
  $(`#${color}-pv`).html(pv(game, color));
}

function addChat(msg) {
  let name = msg;
  let rest = '';

  if (msg.startsWith('[tlcv.net')) {
    const res = /\[(.*)\]\s+-\s+\((.*?)\)\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[2]}] `;
      [, , , rest] = res;
    }
  } else {
    const res = /\[(.*)\]\s+-\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[1]}] `;
      [, , rest] = res;
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

function update(data, board, pvBoardWhite, pvBoardBlack) {
  const { game, spectators, menu } = data;

  updateTitle(`${game.white.name} vs ${game.black.name} (${game.site})`);
  updateLogos(game.white.name, game.black.name);

  updateInfo(game, 'white');
  updateInfo(game, 'black');

  updateTimers(data);
  updateLastMoves(data);

  if (game.tablebase) {
    $('#caption').text(`Tablebase: ${game.tablebase}`);
  } else {
    $('#caption').text(`Opening: ${game.opening}`);
  }

  $('#fen').text(game.fen);
  board.position(game.fen);
  pvBoardWhite.position(game.white.pvFen);
  pvBoardBlack.position(game.black.pvFen);

  clearArrows();

  const { pvAlg: stmPvAlg = [] } = game[game.stm === 'w' ? 'white' : 'black'];
  const { pvAlg: xstmPvAlg = [] } = game[game.stm === 'w' ? 'black' : 'white'];

  const mainArrowColor = globalTheme === 'dark' ? '#68C07BEE' : '#114F8AEE';
  const secondaryArrowColor = globalTheme === 'dark' ? '#F3AE4888' : '#F3AE4888';

  const sameMove = stmPvAlg[0] === xstmPvAlg[1] ? 1 : 0;
  if (xstmPvAlg[1]) drawMove(xstmPvAlg[1], secondaryArrowColor, 1 * sameMove);
  if (stmPvAlg[0]) drawMove(stmPvAlg[0], mainArrowColor, -1 * sameMove);

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
    else if ($scheduleButton.attr('href') !== menu.schedule) $scheduleButton.attr('href', menu.schedule);
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
    else if ($eventThreadButton.attr('href') !== menu.even) $eventThreadButton.attr('href', menu.even);
  } else {
    $eventThreadButton.remove();
  }
}

function chatHeight() {
  const height = $('#board').height() - (155 + 155 + 32);

  return height > 116 ? height : 116;
}

$(() => {
  const board = Chessboard('board', { pieceTheme: '/img/{piece}.svg', showNotation: false });
  clearArrows();
  const b = $('#board');
  $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());

  const pvBoardSettings = {
    pieceTheme: '/img/{piece}.svg',
    showNotation: false,
    appearSpeed: 0,
    moveSpeed: 0,
    trashSpeed: 0,
  };
  const pvBoardWhite = Chessboard('white-pv-board', pvBoardSettings);
  const pvBoardBlack = Chessboard('black-pv-board', pvBoardSettings);

  const socket = io({ autoConnect: false });

  // pull username from storage
  $('#username').val(localStorage.getItem('tlcv.net-username'));

  // We fix the chat-area height to match the board height
  $('#chat-area').height(chatHeight());
  $(window).on('resize', () => {
    board.resize();
    pvBoardWhite.resize();
    pvBoardBlack.resize();

    $('#chat-area').height(chatHeight());

    clearArrows();
    $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());
  });

  // Setup FEN copy
  $('#fen-tooltip').on('click', copyFen);

  // Setup chat listeners
  $('#chat-btn').on('click', () => $('#chat-msg').trigger('send'));
  $('#chat-msg').on('keyup', function (e) {
    if (e.key === 'Enter') $(this).trigger('send');
  });
  $('#chat-msg').on('send', function () {
    sendMsg(socket, $(this));
  });

  // Nickname change
  $('#username').on('blur', () => {
    localStorage.setItem('tlcv.net-username', username());
    socket.emit('nick', username());
  });

  // connect
  socket.on('connect', () => socket.emit('join', { port, user: username() }));

  // first time connection
  socket.on('state', (data) => {
    update(data, board, pvBoardWhite, pvBoardBlack);

    setChat(data.chat);
    const scrollTop = $('#chat-box')[0].scrollHeight;
    $('#chat-box').stop().animate({ scrollTop });
  });

  // game updates
  socket.on('update', (data) => {
    update(data, board, pvBoardWhite, pvBoardBlack);
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
