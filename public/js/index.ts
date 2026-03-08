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
import { chatHeight, updateLayout } from './components/board/resize';

// Get port from URL
const port = +window.location.pathname.replace(/\//g, '');

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
    const g = delta.game;
    if (g.site !== undefined) cachedState.game.site = g.site;
    if (g.white !== undefined) cachedState.game.white = g.white;
    if (g.black !== undefined) cachedState.game.black = g.black;
    if (g.startFen !== undefined) cachedState.game.startFen = g.startFen;
    if (g.fen !== undefined) cachedState.game.fen = g.fen;
    if (g.stm !== undefined) cachedState.game.stm = g.stm;
    if (g.opening !== undefined) cachedState.game.opening = g.opening;
    if (g.tablebase !== undefined) cachedState.game.tablebase = g.tablebase;
    if (g.liveData !== undefined) cachedState.game.liveData = g.liveData;
    if (g.resetMoves) cachedState.game.moves = [];
    if (g.newMoves?.length) cachedState.game.moves = [...cachedState.game.moves, ...g.newMoves];
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
