// public/js/$/index.js
import $ from 'jquery';

// Re-export jQuery as the default export
// This allows: import $ from './$';
// And: import { ajax, each } from './$';
export default $;
export const ajax = $.ajax;
export const each = $.each;
export const extend = $.extend;
export const fn = $.fn;
export const isFunction = $.isFunction;
export const isArray = $.isArray;
export const isPlainObject = $.isPlainObject;
export const parseJSON = $.parseJSON;
export const support = $.support;
export const param = $.param;
export const proxy = $.proxy;
export const noop = $.noop;
