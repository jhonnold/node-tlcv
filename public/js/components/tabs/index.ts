// public/js/components/tabs/index.js
import $ from 'jquery';
import { emit } from '../../events/index';

let activeTab = 'chat';

export function getActiveTab() {
  return activeTab;
}

function switchTab(tab: string) {
  activeTab = tab;

  $('#chat-area').attr('data-active-tab', tab);

  $('.tab-btn').each(function updateActiveClass() {
    const isActive = $(this).attr('data-tab') === tab;
    $(this).toggleClass('active', isActive);
  });

  emit('tab:change', { tab });
}

export function init() {
  // Seed from the server-rendered default so archive mode (no Chat tab) can start
  // on a different tab; falls back to 'chat' for the live page.
  activeTab = $('#chat-area').attr('data-active-tab') || 'chat';

  $('#tab-bar').on('click', '.tab-btn', function handleTabClick() {
    const tab = $(this).attr('data-tab');
    if (tab && tab !== activeTab) {
      switchTab(tab);
    }
  });
}
