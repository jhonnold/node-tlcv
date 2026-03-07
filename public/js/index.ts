// public/js/index.js - Main entry point
import { io } from 'socket.io-client';
import $ from 'jquery';
import { emit } from './events/index';

// Import components
import { init as initTheme } from './components/theme/index';
import { init as initGame } from './components/game/index';
import { init as initBoard, resize as resizeBoard } from './components/board/index';
import { init as initChat, setSocket, username } from './components/chat/index';
import { init as initTabs } from './components/tabs/index';
import { init as initNavigation } from './components/navigation/index';
import { init as initResults } from './components/results/index';
import { init as initGraphs } from './components/graphs/index';
import { init as initFocus } from './components/focus/index';
import { chatHeight, updateLayout } from './components/board/resize';

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
  updateLayout();
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
