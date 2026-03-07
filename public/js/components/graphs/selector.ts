// public/js/components/graphs/selector.js
import $ from 'jquery';

export function setActive(typeId: string) {
  $('.graph-btn').each(function updateActiveClass() {
    $(this).toggleClass('active', $(this).attr('data-graph') === typeId);
  });
}

export function init(onSelect: (type: string) => void) {
  $('#graph-selector').on('click', '.graph-btn', function handleGraphClick() {
    const type = $(this).attr('data-graph');
    if (type) onSelect(type);
  });
}
