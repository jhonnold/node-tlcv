// public/js/components/chat/messaging.js
import $ from '../../$/index.js';

export function username() {
  return $('#username').val() || 'Anonymous';
}
