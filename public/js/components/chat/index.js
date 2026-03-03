// public/js/components/chat/index.js
import $ from '../../$/index.js';
import { on, emit } from '../../events/index.js';
import { username, sendMsg as sendChatMsg } from './messaging.js';

export { username };
export let socket = null;

export function setSocket(s) {
  socket = s;
}

function addChat(msg) {
  let name = msg;
  let rest = '';

  if (msg.startsWith('[tlcv.net')) {
    const res = /\[(.*)\]\s+-\s+\((.*?)\)\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[2]}] `;
      [, , , rest] = res;
    }
  } else {
    const res = /\[(.*?)\]\s+-\s+(.*)/i.exec(msg);
    if (res) {
      name = `[${res[1]}] `;
      [, , rest] = res;
    }
  }

  $('#chat-box').append($('<p>').text(rest).prepend($('<strong>').text(name)));
}

function setChat(msgs) {
  $('#chat-box').children().remove();
  msgs.forEach((msg) => {
    addChat(msg);
  });
}

function scrollToBottom() {
  const scrollTop = $('#chat-box')[0].scrollHeight;
  $('#chat-box').stop().animate({ scrollTop });
}

function isAtBottom() {
  const chatBox = $('#chat-box')[0];
  return chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 50;
}

export function init() {
  // Load username from storage
  $('#username').val(localStorage.getItem('tlcv.net-username'));

  // Setup chat input
  $('#chat-btn').on('click', () => $('#chat-msg').trigger('send'));
  $('#chat-msg').on('keyup', function (e) {
    if (e.key === 'Enter') $(this).trigger('send');
  });
  $('#chat-msg').on('send', function () {
    sendMsg($(this));
  });

  // Nickname change
  $('#username').on('blur', () => {
    localStorage.setItem('tlcv.net-username', username());
    if (socket) {
      socket.emit('nick', username());
    }
  });

  // Listen for chat messages
  on('chat:message', handleChatMessage);
  on('chat:history', handleChatHistory);
}

function sendMsg($chatMsg) {
  const msg = $chatMsg.val();
  if (!msg || !socket) return;

  socket.emit('chat', `(${username()}) ${msg}`);
  $chatMsg.val('');
}

function handleChatMessage(data) {
  const wasAtBottom = isAtBottom();

  data.forEach((msg) => addChat(msg));

  if (wasAtBottom) {
    scrollToBottom();
  }
}

function handleChatHistory(msgs) {
  setChat(msgs);
  scrollToBottom();
}

export function destroy() {
  $('#chat-btn').off('click');
  $('#chat-msg').off('keyup send');
  $('#username').off('blur');
}

export default { init, destroy, setSocket };
