import $ from 'jquery';
import { init as initTheme } from './components/theme/index';
import { postJson, del } from './utils/http';

const reload = () => window.location.reload();

// The admin page has no client-side state to reconcile — every mutation is followed
// by a full reload, so the server rendering stays the single source of truth.
function submitAndReload(request: JQuery.jqXHR) {
  request.always(reload);
}

// --- Broadcast handlers ---

function closeBroadcast(connection: string) {
  submitAndReload(postJson('/admin/close', { connection }));
}

function addNewBroadcast(connection: string, ephemeral: boolean) {
  submitAndReload(postJson('/admin/new', { connection, ephemeral }));
}

function toggleSshFields() {
  const isSsh = $('#kibitzer-type').val() === 'ssh';
  $('#ssh-fields').toggle(isSsh);
  $('#kibitzer-host, #kibitzer-username, #kibitzer-private-key-path, #kibitzer-engine-path').prop('required', isSsh);
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

// --- Webhook handlers ---

function resetWebhookForm() {
  $('#webhook-editing-id').val('');
  $('#webhook-type').val('discord');
  $('#webhook-name').val('');
  $('#webhook-url').val('');
  $('#webhook-ports').val('');
  $('#webhook-event-started').prop('checked', true);
  $('#webhook-event-finished').prop('checked', true);
  $('#webhook-form-legend').text('Add Webhook');
  $('#webhook-submit').text('Add');
  $('#webhook-cancel').hide();
}

function collectWebhookFormData(): Record<string, unknown> {
  const events: string[] = [];
  if ($('#webhook-event-started').prop('checked')) events.push('game-started');
  if ($('#webhook-event-finished').prop('checked')) events.push('game-finished');

  return {
    type: $('#webhook-type').val() as string,
    name: ($('#webhook-name').val() as string).trim(),
    url: ($('#webhook-url').val() as string).trim(),
    ports: ($('#webhook-ports').val() as string).trim(),
    events,
  };
}

/**
 * Wire the remove/submit handlers for one collection. Kibitzers and webhooks are
 * the same CRUD shape — only the id prefix and the form's field collection differ.
 * Editing is delete-then-add because the admin API exposes no PUT.
 */
function initEntityForm(prefix: 'kibitzer' | 'webhook', collect: () => Record<string, unknown>) {
  const collection = `/admin/${prefix}s`;
  const create = (data: Record<string, unknown>) => submitAndReload(postJson(collection, data));

  $(document).on('click', `.${prefix}-remove`, function handleRemove() {
    submitAndReload(del(`${collection}/${$(this).data('id')}`));
  });

  $(`#${prefix}-form`).on('submit', (e) => {
    e.preventDefault();
    const editingId = ($(`#${prefix}-editing-id`).val() as string).trim();
    const data = collect();

    if (editingId) {
      del(`${collection}/${editingId}`)
        .done(() => create(data))
        .fail(reload);
    } else {
      create(data);
    }
  });
}

$(document).ready(() => {
  initTheme();

  // Broadcast handlers
  $('#add-new').on('submit', (e) => {
    e.preventDefault();
    const connection = $('#connection').val() as string;
    if (!connection) return;
    const ephemeral = $('#ephemeral').prop('checked') as boolean;
    addNewBroadcast(connection, ephemeral);
  });

  $('button.close').click(function handleClose() {
    const connection = $(this).data('connection');
    closeBroadcast(connection);
  });

  // Kibitzer type toggle
  $('#kibitzer-type').on('change', toggleSshFields);

  initEntityForm('kibitzer', collectKibitzerFormData);
  initEntityForm('webhook', collectWebhookFormData);

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

  // Webhook edit — populate form with row data
  $(document).on('click', '.webhook-edit', function handleWebhookEdit() {
    const $btn = $(this);
    $('#webhook-editing-id').val($btn.data('id'));
    $('#webhook-type').val($btn.data('type'));
    $('#webhook-name').val(String($btn.data('name') ?? ''));
    $('#webhook-url').val(String($btn.data('url') ?? ''));
    $('#webhook-ports').val(String($btn.data('ports') ?? ''));
    const events = String($btn.data('events') ?? '').split(',');
    $('#webhook-event-started').prop('checked', events.includes('game-started'));
    $('#webhook-event-finished').prop('checked', events.includes('game-finished'));
    $('#webhook-form-legend').text('Edit Webhook');
    $('#webhook-submit').text('Save');
    $('#webhook-cancel').show();
  });

  // Webhook cancel edit
  $('#webhook-cancel').on('click', (e) => {
    e.preventDefault();
    resetWebhookForm();
  });
});
