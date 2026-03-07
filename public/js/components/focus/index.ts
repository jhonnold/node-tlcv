// public/js/components/focus/index.js
import $ from 'jquery';
import { resize as resizeBoard } from '../board/index';
import { chatHeight } from '../board/resize';

let active = false;

function toggle() {
  active = !active;
  document.body.classList.toggle('focus-mode', active);

  // Let the layout settle before reading dimensions
  setTimeout(() => {
    resizeBoard();
    if (!active) {
      $('#chat-area').height(chatHeight());
    }
  }, 50);
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && active) {
    toggle();
  }
}

export function init() {
  $('#focus-toggle').on('click', toggle);
  $(document).on('keydown', handleKeyDown);
}

export function destroy() {
  $('#focus-toggle').off('click');
  $(document).off('keydown', handleKeyDown);
}

export default { init, destroy };
