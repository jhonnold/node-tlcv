import $ from 'jquery';
import { init as initTheme, getPieceSet } from './components/theme/index';
import { pieceSrc, DEFAULT_PIECE_SET } from './components/theme/piece-sets';

$(document).ready(() => {
  initTheme();

  // The mini-boards are server-rendered with the default (classic) set; if the
  // user chose another set, rewrite their <img> src. The page auto-refreshes
  // every 30s, so this re-runs and stays in sync.
  const set = getPieceSet();
  if (set !== DEFAULT_PIECE_SET) {
    $('.mini-board img[data-piece]').each(function () {
      const piece = $(this).attr('data-piece');
      if (piece) $(this).attr('src', pieceSrc(set, piece));
    });
  }
});
