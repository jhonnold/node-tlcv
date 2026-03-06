// public/js/index.js - Main entry point
import { io } from 'socket.io-client';
import $ from './$/index.js';
import { emit } from './events/index.js';

// Import components
import { init as initTheme } from './components/theme/index.js';
import { init as initGame } from './components/game/index.js';
import { init as initBoard, resize as resizeBoard } from './components/board/index.js';
import { init as initChat, setSocket, username } from './components/chat/index.js';
import { init as initTabs } from './components/tabs/index.js';
import { init as initNavigation } from './components/navigation/index.js';
import { init as initResults } from './components/results/index.js';
import { init as initGraphs } from './components/graphs/index.js';
import { init as initFocus } from './components/focus/index.js';
import { chatHeight } from './components/board/resize.js';

// Get port from URL
const port = +window.location.pathname.replace(/\//g, '');

// Initialize socket
const socket = io({ autoConnect: false });

// Pass socket to chat component
setSocket(socket);

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
  resizeBoard();
  $('#chat-area').height(chatHeight());
}

// Initialize all components
function init() {
  initTheme();
  initGame();
  initBoard();
  initTabs();
  initNavigation();
  initResults();
  initGraphs();
  initChat();
  initFocus();

  // Set initial chat-area height now that boards are created and resize restored
  handleWindowResize();

  // Setup window resize handler
  $(window).on('resize', handleWindowResize);

  // Socket event handlers
  setupSocketEvents();

  // Connect!
  socket.connect();
}

// Start when DOM is ready
$(() => {
  init();
});
