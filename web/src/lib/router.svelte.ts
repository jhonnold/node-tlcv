import { parsePath, type Route } from './url';

// Unknown paths fall back to the lobby (and the URL is rewritten to `/`).
function resolve(pathname: string): Route {
  const route = parsePath(pathname);
  if (route) return route;
  history.replaceState(null, '', '/');
  return { name: 'lobby' };
}

class RouterState {
  route = $state<Route>(resolve(location.pathname));
}
export const router = new RouterState();

export function navigate(path: string, { replace = false } = {}): void {
  const pathname = path.split(/[?#]/)[0];
  if (path !== location.pathname + location.search + location.hash) {
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
  }
  router.route = resolve(pathname);
  window.scrollTo(0, 0);
}

export function startRouter(): () => void {
  const onPopState = () => {
    router.route = resolve(location.pathname);
  };

  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element)) return;
    const a = e.target.closest('a');
    if (!(a instanceof HTMLAnchorElement)) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (a.origin !== location.origin) return;
    if (a.getAttribute('href')?.startsWith('#')) return;
    // Unknown paths, and admin (always a full load so the server's basic-auth challenge runs).
    const route = parsePath(a.pathname);
    if (!route || route.name === 'admin') return;

    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  };

  window.addEventListener('popstate', onPopState);
  document.addEventListener('click', onClick);
  return () => {
    window.removeEventListener('popstate', onPopState);
    document.removeEventListener('click', onClick);
  };
}
