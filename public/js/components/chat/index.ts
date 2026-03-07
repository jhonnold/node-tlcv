// public/js/components/chat/index.js
import $ from 'jquery';
import type { Socket } from 'socket.io-client';
import { on } from '../../events/index';
import username from './messaging';

export { username };
let socket: Socket | null = null;

export function setSocket(s: Socket) {
  socket = s;
}

function addChat(msg: string) {
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

function setChat(msgs: string[]) {
  $('#chat-box').children().remove();
  msgs.forEach((msg: string) => {
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

function sendMsg($chatMsg: JQuery) {
  const msg = $chatMsg.val();
  if (!msg || !socket) return;

  socket.emit('chat', `(${username()}) ${msg}`);
  $chatMsg.val('');
}

function handleChatMessage(data: string[]) {
  const wasAtBottom = isAtBottom();

  data.forEach((msg: string) => addChat(msg));

  if (wasAtBottom) {
    scrollToBottom();
  }
}

function handleChatHistory(msgs: string[]) {
  setChat(msgs);
  scrollToBottom();
}

export function init() {
  // Load username from storage
  $('#username').val(localStorage.getItem('tlcv.net-username') ?? '');

  // Setup chat input
  $('#chat-btn').on('click', () => $('#chat-msg').trigger('send'));
  $('#chat-msg').on('keyup', function handleKeyup(e) {
    if (e.key === 'Enter') $(this).trigger('send');
  });
  $('#chat-msg').on('send', function handleSend() {
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

  // Scroll to bottom when switching back to Chat tab
  on('tab:change', ({ tab }) => {
    if (tab === 'chat') scrollToBottom();
  });
}

export function destroy() {
  $('#chat-btn').off('click');
  $('#chat-msg').off('keyup send');
  $('#username').off('blur');
}

export default { init, destroy, setSocket };
