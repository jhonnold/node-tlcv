// public/js/index.js - Main entry point
import { io } from 'socket.io-client';
import $ from './$/index.js';
import { on, emit } from './events/index.js';

// Import components
import theme from './components/theme/index.js';
import game from './components/game/index.js';
import board from './components/board/index.js';
import chat, { username } from './components/chat/index.js';

// Import utilities needed for init
import { chatHeight } from './components/board/resize.js';
import { clearArrows } from './components/board/arrows.js';

// Get port from URL
const port = +window.location.pathname.replace(/\//g, '');

// Initialize socket
const socket = io({ autoConnect: false });

// Pass socket to chat component
chat.setSocket(socket);

// Initialize all components
function init() {
  theme.init();
  game.init();
  board.init();
  chat.init();

  // Fix chat-area height to match board
  $('#chat-area').height(chatHeight());

  // Setup window resize handler
  $(window).on('resize', handleWindowResize);

  // Socket event handlers
  setupSocketEvents();

  // Connect!
  socket.connect();
}

function setupSocketEvents() {
  socket.on('connect', () => {
    socket.emit('join', { port, user: username() });
  });

  socket.on('state', (data) => {
    const { game: gameData, chat: chatData, ...rest } = data;
    emit('game:state', { game: gameData, ...rest });
    emit('chat:history', chatData);
  });

  socket.on('update', (data) => {
    emit('game:update', data);
  });

  socket.on('new-chat', (data) => {
    emit('chat:message', data);
  });
}

function handleWindowResize() {
  const { board: mainBoard, pvBoardWhite, pvBoardBlack } = board.getBoards();
  if (mainBoard) mainBoard.resize();
  if (pvBoardWhite) pvBoardWhite.resize();
  if (pvBoardBlack) pvBoardBlack.resize();

  $('#chat-area').height(chatHeight());

  clearArrows();

  const b = $('#board');
  $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());
}

// Start when DOM is ready
$(() => {
  init();
});
