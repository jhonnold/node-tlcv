// public/js/index.js - Main entry point
import { io } from 'socket.io-client';
import $ from 'jquery';
import { emit } from './events/index';
import type { GameEventData } from './events/index';
import type { SerializedBroadcast, BroadcastDelta } from '../../shared/types';

// Import components
import { init as initTheme } from './components/theme/index';
import { init as initGame } from './components/game/index';
import { init as initBoard, resize as resizeBoard } from './components/board/index';
import { init as initChat, setSocket, username } from './components/chat/index';
import { init as initTabs } from './components/tabs/index';
import { init as initNavigation } from './components/navigation/index';
import { init as initResults } from './components/results/index';
import { init as initGames } from './components/games/index';
import { init as initReplay } from './components/replay/index';
import { init as initGraphs } from './components/graphs/index';
import { init as initFocus } from './components/focus/index';
import { init as initFlip } from './components/flip/index';
import { init as initSounds } from './components/sounds/index';
import { chatHeight, updateLayout } from './components/board/resize';
import { getPort } from './utils/url';

// Get port from URL
const port = getPort();

// Initialize socket
const socket = io({ autoConnect: false });

// Pass socket to chat component
setSocket(socket);

// Cached state for delta merging
let cachedState: GameEventData | null = null;

function applyDelta(delta: BroadcastDelta): GameEventData | null {
  if (!cachedState) return null;

  if (delta.spectators !== undefined) cachedState.spectators = delta.spectators;
  if (delta.menu !== undefined) cachedState.menu = delta.menu;

  if (delta.game) {
    const { resetMoves, newMoves, ...fields } = delta.game;
    Object.assign(cachedState.game, fields);
    if (resetMoves) cachedState.game.moves = [];
    if (newMoves?.length) cachedState.game.moves = [...cachedState.game.moves, ...newMoves];
  }

  return cachedState;
}

function setupSocketEvents() {
  socket.on('connect', () => {
    socket.emit('join', { port, user: username() });
  });

  socket.on('state', (data: SerializedBroadcast) => {
    const { chat: chatData, ...rest } = data;
    cachedState = rest;
    emit('game:state', rest);
    emit('chat:history', chatData);
  });

  socket.on('update', (delta: BroadcastDelta) => {
    const merged = applyDelta(delta);
    if (merged) emit('game:update', merged);
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
  initGames();
  initReplay();
  initGraphs();
  initChat();
  initFocus();
  initFlip();
  initSounds();

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
