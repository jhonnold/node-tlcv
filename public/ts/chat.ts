import $ from 'jquery';

export function username() {
  return ($('#username').val() as string) || 'Anonymous';
}

export function sendMsg(socket, $chatMsg) {
  const msg = $chatMsg.val();
  if (!msg) return;

  socket.emit('chat', `(${username()}) ${msg}`);
  $chatMsg.val('');
}
