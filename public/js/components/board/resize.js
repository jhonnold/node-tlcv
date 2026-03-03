// public/js/components/board/resize.js
import $ from '../../$/index.js';
import { emit } from '../../events/index.js';

export function chatHeight() {
  const containerWidth = $('.container').width();
  const gap = 8;
  const verticalOffset = 342;
  const maxBoardWidth = (containerWidth - gap) * 0.6;
  const maxBoardHeight = Math.min(maxBoardWidth, window.innerHeight) - verticalOffset;
  return maxBoardHeight > 116 ? maxBoardHeight : 116;
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

    const minWidth = totalWidth * 0.4;
    newLeftWidth = Math.max(minWidth, newLeftWidth);
    newRightWidth = Math.max(minWidth, newRightWidth);

    if (newLeftWidth === minWidth) {
      newRightWidth = totalWidth - minWidth;
    } else if (newRightWidth === minWidth) {
      newLeftWidth = totalWidth - minWidth;
    }

    mainLayout.css('grid-template-columns', `${newLeftWidth}px 8px ${newRightWidth}px`);
    setTimeout(() => $('#chat-area').height(chatHeight()), 5);
    throttledResize();
  });

  $(document).on('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizeBoards();
    }
  });
}

export default { initResize, chatHeight };
