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
import { getPort, isArchive } from './utils/url';

// Archive (previous broadcast) pages are read-only and disk-backed: no live socket,
// no chat. The games component drives the board via replay events instead.
const archive = isArchive();

// Get port from URL (live mode only)
const port = archive ? 0 : getPort();

// Initialize socket
const socket = io({ autoConnect: false });

// Pass socket to chat component (live mode only)
if (!archive) setSocket(socket);

// Cached state for delta merging
let cachedState: GameEventData | null = null;

function applyDelta(delta: BroadcastDelta): GameEventData | null {
  if (!cachedState) return null;

  if (delta.spectators !== undefined) cachedState.spectators = delta.spectators;
  if (delta.menu !== undefined) cachedState.menu = delta.menu;

  if (delta.game) {
    const { resetMoves, newMoves, updatedMoves, ...fields } = delta.game;
    Object.assign(cachedState.game, fields);
    if (resetMoves) cachedState.game.moves = [];
    if (newMoves?.length) cachedState.game.moves = [...cachedState.game.moves, ...newMoves];
    if (updatedMoves?.length) {
      // Retroactive PV fills for moves already sent via newMoves. An update with no match
      // in the cache is dropped silently — there is nothing to patch, and the next full
      // `state` sync reconciles.
      const patches = new Map(updatedMoves.map((u) => [`${u.number}${u.color}`, u]));
      const { moves } = cachedState.game;
      for (let i = 0; i < moves.length; i += 1) {
        const patch = patches.get(`${moves[i].number}${moves[i].color}`);
        if (patch) moves[i] = patch;
      }
    }
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

function applyLayout() {
  updateLayout();
  resizeBoard();
  $('#chat-area').height(chatHeight());
}

// `resize` fires at the native rate while a window is being dragged, and each pass
// redraws three boards and the arrow canvas. Coalesce to one pass per frame, which
// also batches the layout reads and writes together.
let resizeFrame: number | null = null;

function handleWindowResize() {
  if (resizeFrame !== null) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    applyLayout();
  });
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
  if (!archive) initChat();
  initFocus();
  initFlip();
  initSounds();

  // Set initial chat-area height now that boards are created and resize restored
  applyLayout();

  // Setup window resize handler
  $(window).on('resize', handleWindowResize);

  // Live mode only: wire and open the socket. Archive mode is populated from disk
  // by the games component (auto-loads the latest game on init).
  if (!archive) {
    setupSocketEvents();
    socket.connect();
  }
}

// Start when DOM is ready
$(() => {
  init();
});
