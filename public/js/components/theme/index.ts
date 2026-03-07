// public/js/components/theme/index.js
import $ from 'jquery';
import { emit } from '../../events/index';

let globalTheme = 'light';

const getPreferredTheme = () => {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function setTheme(theme: string) {
  if (theme === 'dark') {
    $('#theme-icon-sun').show();
    $('#theme-icon-moon').hide();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dark-theme.css';
    const fireThemeChange = () => emit('theme:change', { theme });
    link.onload = fireThemeChange;
    link.onerror = fireThemeChange;
    $('head').append(link);
  } else {
    $('#theme-icon-sun').hide();
    $('#theme-icon-moon').show();
    const darkTheme = $('head [href="/dark-theme.css"]');
    if (darkTheme) darkTheme.remove();
    emit('theme:change', { theme });
  }
  localStorage.setItem('theme', theme);
  globalTheme = theme;
}

export function getTheme() {
  return globalTheme;
}

export function init() {
  globalTheme = getPreferredTheme();
  setTheme(globalTheme);

  $('#theme-toggle').on('click', () => setTheme(globalTheme === 'dark' ? 'light' : 'dark'));
}

export function destroy() {
  $('#theme-toggle').off('click');
}

export default { init, destroy, setTheme, getTheme };
