import $ from 'jquery';
import { emit } from '../../events/index';

let flipped = false;

function toggle() {
  flipped = !flipped;
  $('.main-layout').toggleClass('board-flipped', flipped);
  emit('board:flip', { flipped });
}

export function init() {
  $('#flip-toggle').on('click', toggle);
}

export function destroy() {
  $('#flip-toggle').off('click');
  if (flipped) toggle();
}
