// public/js/components/theme/index.js
import $ from '../../$/index.js';
import { emit } from '../../events/index.js';

let globalTheme = 'light';

const getPreferredTheme = () => {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function setTheme(theme) {
  if (theme === 'dark') {
    $('#theme-light').show();
    $('#theme-dark').hide();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dark-theme.css';
    $('head').append(link);
  } else {
    $('#theme-light').hide();
    $('#theme-dark').show();
    const darkTheme = $('head [href="/dark-theme.css"]');
    if (darkTheme) darkTheme.remove();
  }
  localStorage.setItem('theme', theme);

  globalTheme = theme;
  emit('theme:change', { theme });
}

export function getTheme() {
  return globalTheme;
}

export function init() {
  globalTheme = getPreferredTheme();
  setTheme(globalTheme);

  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
}

export function destroy() {
  $('#theme-light').off('click');
  $('#theme-dark').off('click');
}

export default { init, destroy, setTheme, getTheme };
