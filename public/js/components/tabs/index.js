// public/js/components/tabs/index.js
import $ from '../../$/index.js';
import { emit } from '../../events/index.js';

let activeTab = 'chat';

export function getActiveTab() {
  return activeTab;
}

function switchTab(tab) {
  activeTab = tab;

  $('#chat-area').attr('data-active-tab', tab);

  $('.tab-btn').each(function updateActiveClass() {
    const isActive = $(this).attr('data-tab') === tab;
    $(this).toggleClass('active', isActive);
  });

  emit('tab:change', { tab });
}

export function init() {
  $('#tab-bar').on('click', '.tab-btn', function handleTabClick() {
    const tab = $(this).attr('data-tab');
    if (tab && tab !== activeTab) {
      switchTab(tab);
    }
  });
}

export default { init, getActiveTab };
