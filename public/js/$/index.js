// public/js/$/index.js
import $ from 'jquery';

// Re-export jQuery as the default export
// This allows: import $ from './$';
// And: import { ajax, each } from './$';
export default $;
export const { ajax } = $;
export const { each } = $;
export const { extend } = $;
export const { fn } = $;
export const { isFunction } = $;
export const { isArray } = $;
export const { isPlainObject } = $;
export const { parseJSON } = $;
export const { support } = $;
export const { param } = $;
export const { proxy } = $;
export const { noop } = $;
