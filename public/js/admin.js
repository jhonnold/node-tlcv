import $ from 'jquery';

function reconnect(port) {
  $.ajax({
    type: 'POST',
    url: '/admin/reconnect',
    data: JSON.stringify({ port }),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

function close(port) {
  $.ajax({
    type: 'POST',
    url: '/admin/close',
    data: JSON.stringify({ port }),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

function addNew(port) {
  $.ajax({
    type: 'POST',
    url: '/admin/new',
    data: JSON.stringify({ port }),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

$(document).ready(() => {
  $('#add-new').on('submit', (e) => {
    e.preventDefault();

    const port = $('#port').val();
    if (!port) return;

    addNew(port);
  });

  $('button.close').click(function () {
    const port = $(this).data('port');
    close(port);
  });

  $('button.reconnect').click(function () {
    const port = $(this).data('port');
    reconnect(port);
  });
});
