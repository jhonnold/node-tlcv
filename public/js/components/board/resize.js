// public/js/components/board/resize.js
import $ from '../../$/index.js';
import { emit } from '../../events/index.js';

const INFO_CARD_HEIGHT = 155;
const GAP = 32;
const VERTICAL_OFFSET = INFO_CARD_HEIGHT * 2 + GAP;
const STORAGE_KEY = 'board-width';
const MIN_COL_WIDTH = 475;
const HANDLE_WIDTH = 16;

export function chatHeight() {
  const boardHeight = $('#board').height();
  return Math.min(600, Math.max(400, boardHeight - VERTICAL_OFFSET));
}

export function initResize(board, pvBoardWhite, pvBoardBlack) {
  if (window.innerWidth <= 767) {
    return;
  }

  const resizeHandle = $('#resize-handle');
  const mainLayout = $('.main-layout');
  let isResizing = false;
  let startX = 0;
  let startWidths = [0, 0];
  let lastResizeTime = 0;
  const THROTTLE_MS = 10;

  function resizeBoards() {
    board.resize();
    pvBoardWhite.resize();
    pvBoardBlack.resize();

    const b = $('#board');
    $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());
    emit('board:resize');
  }

  // Restore saved board width
  const savedWidth = parseFloat(localStorage.getItem(STORAGE_KEY));
  if (!Number.isNaN(savedWidth) && savedWidth >= MIN_COL_WIDTH) {
    const availableWidth = Math.min(window.innerWidth, 2160) - HANDLE_WIDTH;
    const leftWidth = Math.min(savedWidth, availableWidth - MIN_COL_WIDTH);
    if (leftWidth >= MIN_COL_WIDTH) {
      const rightWidth = availableWidth - leftWidth;
      mainLayout.css('grid-template-columns', `${leftWidth}px ${HANDLE_WIDTH}px ${rightWidth}px`);
      resizeBoards();
    }
  }

  function throttledResize() {
    const now = Date.now();
    if (now - lastResizeTime >= THROTTLE_MS) {
      lastResizeTime = now;
      resizeBoards();
    }
  }

  resizeHandle.on('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    const styles = window.getComputedStyle(mainLayout[0]);
    const columns = styles.gridTemplateColumns.split(' ');
    startWidths = [parseFloat(columns[0]), parseFloat(columns[2])];
    lastResizeTime = 0;
    e.preventDefault();
  });

  $(document).on('mousemove', (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const totalWidth = startWidths[0] + startWidths[1];
    let newLeftWidth = startWidths[0] + dx;
    let newRightWidth = startWidths[1] - dx;

    newLeftWidth = Math.max(MIN_COL_WIDTH, newLeftWidth);
    newRightWidth = Math.max(MIN_COL_WIDTH, newRightWidth);

    if (newLeftWidth === MIN_COL_WIDTH) {
      newRightWidth = totalWidth - MIN_COL_WIDTH;
    } else if (newRightWidth === MIN_COL_WIDTH) {
      newLeftWidth = totalWidth - MIN_COL_WIDTH;
    }

    mainLayout.css('grid-template-columns', `${newLeftWidth}px ${HANDLE_WIDTH}px ${newRightWidth}px`);
    setTimeout(() => $('#chat-area').height(chatHeight()), 5);
    throttledResize();
  });

  $(document).on('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizeBoards();

      const styles = window.getComputedStyle(mainLayout[0]);
      const leftWidth = parseFloat(styles.gridTemplateColumns.split(' ')[0]);
      localStorage.setItem(STORAGE_KEY, leftWidth);
    }
  });
}

export default { initResize, chatHeight };
