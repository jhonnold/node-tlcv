// chessboardjs reads a global `$` whenever a board is built; jQuery's CJS build sets none under a bundler.
// Import this before chessboardjs (lib/chessboard.ts does).
import jQuery from 'jquery';

Object.assign(window, { $: jQuery, jQuery });
