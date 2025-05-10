import $ from 'jquery';

function close(connection) {
  $.ajax({
    type: 'POST',
    url: '/admin/close',
    data: JSON.stringify({ connection }),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

function addNew(connection) {
  $.ajax({
    type: 'POST',
    url: '/admin/new',
    data: JSON.stringify({ connection }),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

$(document).ready(() => {
  $('#add-new').on('submit', (e) => {
    e.preventDefault();

    const connection = $('#connection').val();
    if (!connection) return;

    addNew(connection);
  });

  $('button.close').click(function onClick() {
    const connection = $(this).data('connection');
    close(connection);
  });
});
