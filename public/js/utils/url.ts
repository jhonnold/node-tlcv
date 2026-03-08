export function getPort(): number {
  return +window.location.pathname.replace(/\//g, '');
}
