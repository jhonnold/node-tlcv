import $ from 'jquery';
import type { StoredGameMeta } from '../../../../shared/types';
import { on, emit } from '../../events/index';
import type { GameEventData } from '../../events/index';

let replaying = false;
let lastLiveData: GameEventData | null = null;

const EMPTY_FEN = '8/8/8/8/8/8/8/8';

export function isReplayMode(): boolean {
  return replaying;
}

function buildGameEventData(meta: StoredGameMeta): GameEventData {
  return {
    game: {
      site: meta.site,
      white: { name: meta.white.name, clockTime: 0, startTime: 0 },
      black: { name: meta.black.name, clockTime: 0, startTime: 0 },
      liveData: {
        color: 'w',
        depth: 0,
        score: 0,
        nodes: 0,
        usedTime: 0,
        pv: [],
        pvAlg: '',
        pvFen: EMPTY_FEN,
        pvMoveNumber: 1,
      },
      fen: meta.fen,
      opening: meta.opening,
      tablebase: '',
      stm: meta.stm,
      moves: meta.moves,
      startFen: meta.startFen,
      kibitzerLiveData: null,
    },
    spectators: [],
    menu: {},
  };
}

function showBanner(meta: StoredGameMeta) {
  const $banner = $('#replay-banner');
  $banner.find('.replay-title').text(`${meta.white.name} vs ${meta.black.name} — ${meta.result}`);
  $banner.prop('hidden', false);
}

function hideBanner() {
  $('#replay-banner').prop('hidden', true);
}

function enterReplay(meta: StoredGameMeta) {
  replaying = true;
  showBanner(meta);
  emit('game:state', buildGameEventData(meta));
}

function exitReplay() {
  replaying = false;
  hideBanner();
  if (lastLiveData) {
    emit('game:state', lastLiveData);
  }
}

function injectBanner() {
  const banner = $('<div id="replay-banner" hidden>')
    .append($('<span class="replay-title">'))
    .append(
      $('<button id="replay-exit-btn">')
        .text('Back to Live')
        .on('click', () => emit('replay:exit', undefined)),
    );
  $('#chat-area').append(banner);
}

export function init() {
  injectBanner();

  on('game:state', (data) => {
    if (!replaying) lastLiveData = data;
  });

  on('game:update', (data) => {
    if (!replaying) lastLiveData = data;
  });

  on('game:replay', (meta) => enterReplay(meta));
  on('replay:exit', () => exitReplay());
}
