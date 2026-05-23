import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

// Inline-only markdown for chat: bold, italic, inline code, strikethrough, and
// auto-linked bare http/https URLs. Output is rendered as HTML, so it must be
// sanitized before insertion into the DOM.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Only auto-link explicit http/https URLs — leave plain words and emails alone.
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });

// Force links to open safely in a new tab. Registered once at module load.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function renderMarkdown(text: string): string {
  if (!text) return '';

  const html = md.renderInline(text);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'code', 'del', 's', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
