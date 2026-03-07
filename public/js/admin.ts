import $ from 'jquery';

function close(connection: string) {
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

function addNew(connection: string) {
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

    const connection = $('#connection').val() as string;
    if (!connection) return;

    addNew(connection);
  });

  $('button.close').click(function handleClose() {
    const connection = $(this).data('connection');
    close(connection);
  });
});
