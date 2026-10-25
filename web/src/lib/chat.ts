import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

// Inline-only markdown for chat: bold, italic, inline code, strikethrough, and
// auto-linked bare http/https URLs. Output is rendered as HTML, so it must be
// sanitized before insertion into the DOM.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Only auto-link explicit http/https URLs — leave plain words and emails alone.
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });

// Links should only ever come from linkify (bare http/https URLs). Disable the
// markdown link/image/autolink syntax so unsupported constructs stay as literal
// text instead of producing <img> tags (stripped by DOMPurify, so they vanish)
// or <a> tags with non-http hrefs (stripped to dead, hrefless links).
md.disable(['image', 'link', 'autolink']);

// Force links to open safely in a new tab. Registered once at module load.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function renderMarkdown(text: string): string {
  if (!text) return '';

  const html = md.renderInline(text);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'code', 'del', 's', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}

export type ChatLine = { name: string; html: string };
const TLCV_LINE = /\[(.*)\]\s+-\s+\((.*?)\)\s+(.*)/i; // our own users: "[tlcv.net] - (nick) text"
const PLAIN_LINE = /\[(.*?)\]\s+-\s+(.*)/i; // "[Name] - text", "[Server] - Game 3: …"
const cache = new Map<string, ChatLine>(); // history is re-sent on every reconnect; parse each line once
const CACHE_MAX = 4000;

export function parseChatLine(msg: string): ChatLine {
  const hit = cache.get(msg);
  if (hit) return hit;
  let name = '';
  let text = msg;
  if (msg.startsWith('[tlcv.net')) {
    const m = TLCV_LINE.exec(msg);
    if (m) [name, text] = [m[2], m[3]];
  } else {
    const m = PLAIN_LINE.exec(msg);
    if (m) [name, text] = [m[1], m[2]];
  }
  const line = { name, html: renderMarkdown(text) };
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(msg, line);
  return line;
}

const INKS = ['var(--engW)', 'var(--engB)', 'var(--engK)'];
/** A stable per-name colour: Anonymous muted, Server/no name text, everyone else hashed onto the engine colours. */
export function nameColor(name: string): string {
  if (!name || name === 'Server') return 'var(--text)';
  if (name === 'Anonymous') return 'var(--muted)';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return INKS[h % INKS.length];
}

export const chatPayload = (nick: string, msg: string): string => `(${nick || 'Anonymous'}) ${msg}`;
