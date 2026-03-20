import $ from 'jquery';

// --- Broadcast handlers ---

function closeBroadcast(connection: string) {
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

function addNewBroadcast(connection: string) {
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

// --- Kibitzer handlers ---

function removeKibitzer(id: string) {
  $.ajax({
    type: 'DELETE',
    url: `/admin/kibitzers/${id}`,
    complete() {
      window.location.reload();
    },
  });
}

function addKibitzer(data: Record<string, string>) {
  $.ajax({
    type: 'POST',
    url: '/admin/kibitzers',
    data: JSON.stringify(data),
    contentType: 'application/json',
    complete() {
      window.location.reload();
    },
  });
}

function toggleSshFields() {
  const isSsh = $('#kibitzer-type').val() === 'ssh';
  $('#ssh-fields').toggle(isSsh);
  $('#kibitzer-host').prop('required', isSsh);
  $('#kibitzer-username').prop('required', isSsh);
  $('#kibitzer-private-key-path').prop('required', isSsh);
  if (isSsh) {
    $('#kibitzer-engine-path').prop('required', true);
  } else {
    $('#kibitzer-engine-path').prop('required', false);
  }
}

function resetKibitzerForm() {
  $('#kibitzer-editing-id').val('');
  $('#kibitzer-type').val('local');
  $('#kibitzer-priority').val('1');
  $('#kibitzer-engine-path').val('');
  $('#kibitzer-threads').val('1');
  $('#kibitzer-hash').val('256');
  $('#kibitzer-host').val('');
  $('#kibitzer-port').val('22');
  $('#kibitzer-username').val('');
  $('#kibitzer-private-key-path').val('');
  $('#kibitzer-form-legend').text('Add Kibitzer');
  $('#kibitzer-submit').text('Add');
  $('#kibitzer-cancel').hide();
  toggleSshFields();
}

function collectKibitzerFormData(): Record<string, string> {
  const data: Record<string, string> = {
    type: $('#kibitzer-type').val() as string,
    priority: $('#kibitzer-priority').val() as string,
    threads: $('#kibitzer-threads').val() as string,
    hash: $('#kibitzer-hash').val() as string,
  };

  const enginePath = ($('#kibitzer-engine-path').val() as string).trim();
  if (enginePath) data.enginePath = enginePath;

  if (data.type === 'ssh') {
    data.host = $('#kibitzer-host').val() as string;
    const port = ($('#kibitzer-port').val() as string).trim();
    if (port && port !== '22') data.port = port;
    data.username = $('#kibitzer-username').val() as string;
    data.privateKeyPath = $('#kibitzer-private-key-path').val() as string;
  }

  return data;
}

$(document).ready(() => {
  // Broadcast handlers
  $('#add-new').on('submit', (e) => {
    e.preventDefault();
    const connection = $('#connection').val() as string;
    if (!connection) return;
    addNewBroadcast(connection);
  });

  $('button.close').click(function handleClose() {
    const connection = $(this).data('connection');
    closeBroadcast(connection);
  });

  // Kibitzer type toggle
  $('#kibitzer-type').on('change', toggleSshFields);

  // Kibitzer remove
  $(document).on('click', '.kibitzer-remove', function handleRemove() {
    const id = $(this).data('id');
    removeKibitzer(id);
  });

  // Kibitzer edit — populate form with row data
  $(document).on('click', '.kibitzer-edit', function handleEdit() {
    const $btn = $(this);
    $('#kibitzer-editing-id').val($btn.data('id'));
    $('#kibitzer-type').val($btn.data('type'));
    $('#kibitzer-priority').val($btn.data('priority'));
    $('#kibitzer-engine-path').val($btn.data('engine-path') ?? '');
    $('#kibitzer-threads').val($btn.data('threads'));
    $('#kibitzer-hash').val($btn.data('hash'));
    $('#kibitzer-host').val($btn.data('host') ?? '');
    $('#kibitzer-port').val($btn.data('port') ?? '22');
    $('#kibitzer-username').val($btn.data('username') ?? '');
    $('#kibitzer-private-key-path').val($btn.data('private-key-path') ?? '');
    $('#kibitzer-form-legend').text('Edit Kibitzer');
    $('#kibitzer-submit').text('Save');
    $('#kibitzer-cancel').show();
    toggleSshFields();
  });

  // Kibitzer cancel edit
  $('#kibitzer-cancel').on('click', (e) => {
    e.preventDefault();
    resetKibitzerForm();
  });

  // Kibitzer form submit (add or edit)
  $('#kibitzer-form').on('submit', (e) => {
    e.preventDefault();
    const editingId = ($('#kibitzer-editing-id').val() as string).trim();
    const data = collectKibitzerFormData();

    if (editingId) {
      // Edit = delete old, then add new
      $.ajax({
        type: 'DELETE',
        url: `/admin/kibitzers/${editingId}`,
        complete() {
          addKibitzer(data);
        },
      });
    } else {
      addKibitzer(data);
    }
  });
});
