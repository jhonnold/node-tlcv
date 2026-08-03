import $ from 'jquery';

export function getJson<T>(url: string) {
  return $.ajax({ url, method: 'GET', dataType: 'json' }) as JQuery.jqXHR<T>;
}

export function postJson(url: string, body: unknown) {
  return $.ajax({ type: 'POST', url, data: JSON.stringify(body), contentType: 'application/json' });
}

export function del(url: string) {
  return $.ajax({ type: 'DELETE', url });
}

/**
 * Fetch JSON into a tab panel, showing the shared loading/error states.
 * `noun` drives both the status text and the `.<noun>-loading` / `.<noun>-error` classes.
 */
export function loadPanel<T>(
  $container: JQuery,
  url: string,
  noun: string,
  render: (data: T) => JQuery,
  onData?: (data: T) => void,
): void {
  $container.html(`<p class="${noun}-loading">Loading ${noun}...</p>`);

  getJson<T>(url)
    .done((data) => {
      $container.empty().append(render(data));
      onData?.(data);
    })
    .fail(() => {
      $container.html(`<p class="${noun}-error">No ${noun} available.</p>`);
    });
}
