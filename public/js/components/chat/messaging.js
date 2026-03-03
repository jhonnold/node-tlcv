// public/js/components/chat/messaging.js
import $ from '../../$/index.js';

export default function username() {
  return $('#username').val() || 'Anonymous';
}
