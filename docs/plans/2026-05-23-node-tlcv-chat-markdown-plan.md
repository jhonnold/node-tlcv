---
source_url: https://github.com/jhonnold/node-tlcv/pull/152
ingested: 2026-05-23
source_type: plan
author: Claude Agent (drafted) + Jay Honnold (direction + approval)
synthesis: done
---

# node-tlcv: Basic Markdown Formatting in Chat

Plan + as-built outcome for adding **basic inline markdown** to the
[[node-tlcv]] chat area (PR
[#152](https://github.com/jhonnold/node-tlcv/pull/152)). Shipped on
branch `feat/chat-markdown` (commits `2f4c1c7` + `fb42e2e`).

Contrast with [[2026-04-06-campfire-feature-12-markdown|campfire's
markdown feature]] — same surface (chat), opposite trust model. See
[[markdown-in-chat-uis]] for the cross-cutting pattern.

## Context

The chat area rendered every message as plain text. Each message is a
single string parsed by regex into a `name` prefix (e.g. `[user] `) and
a `rest` body, then injected with jQuery `.text()` — XSS-safe but
unformatted. Goal: familiar inline markdown (bold, italic, code,
strikethrough) and clickable URLs.

This is a **frontend/presentation-only** change. Stored and broadcast
chat strings stay raw markdown source; each client renders locally. No
backend, protocol, or Socket.IO changes.

**Decisions confirmed with the user:**
- **Features:** inline only — bold (`**`/`__`), italic (`*`/`_`), inline
  code (`` ` ``), strikethrough (`~~`), plus auto-linking of bare
  http/https URLs. No block elements (headings, lists, blockquotes,
  code blocks).
- **Approach:** `markdown-it` (inline render) + `DOMPurify` (sanitize).
  Not hand-rolled. Chosen over `marked` because markdown-it is the
  recommended route for user-generated content and has built-in
  `linkify` (native bare-URL autolinking — no custom extension) and
  `renderInline()`.
- **Scope:** applies to all message bodies (user and system/server
  messages).

**Library versions (verified May 2026):** `markdown-it` v14.1.1 (~21M
weekly downloads, actively maintained, CommonMark + GFM strikethrough by
default), `dompurify` v3.4.5 (cure53; current gold-standard client-side
sanitizer). `marked` was rejected after web research because its
`parseInline` does not reliably linkify *bare* URLs and would have
needed a custom inline tokenizer extension.

## Changes (as built)

1. **Dependencies** — `markdown-it` + `dompurify` under `dependencies`
   (they're webpack-bundled into the frontend, like jquery/chart.js),
   `@types/markdown-it` under `devDependencies`. markdown-it ships no
   bundled types (DefinitelyTyped); dompurify v3 ships its own (do not
   add the deprecated `@types/dompurify`).
2. **New util `public/js/utils/markdown.ts`** — `renderMarkdown(text)`.
   Pipeline: **markdown-it inline render → DOMPurify sanitize** (never
   the reverse).
   - One module-level instance:
     `new MarkdownIt({ html: false, linkify: true, breaks: true })`.
     `html: false` escapes raw HTML (first defense); DOMPurify is the
     second.
   - `md.linkify.set({ fuzzyLink: false, fuzzyEmail: false })` — only
     explicit http/https schemes link; plain words/emails stay text.
   - `md.disable(['image', 'link', 'autolink'])` — **only `linkify`
     creates links.** (Added after Copilot review; see Outcome.)
   - `md.renderInline(text)` (not `render()`) → no block wrappers.
   - DOMPurify: `ALLOWED_TAGS: [strong, em, b, i, code, del, s, a, br]`,
     `ALLOWED_ATTR: [href, target, rel]`,
     `ALLOWED_URI_REGEXP: /^https?:\\/\\//i`, plus a module-level
     `afterSanitizeAttributes` hook forcing `target="_blank"
     rel="noopener noreferrer"` on `<a>`.
   - Guard: `if (!text) return ''`.
3. **Wire-up `public/js/components/chat/index.ts`** — `addChat()` renders
   the body via `.html(renderMarkdown(rest))`; the `[username]` prefix
   stays plain `.text()` inside `<strong>` (never markdown-parsed,
   never trusted as HTML). Both live (`handleChatMessage`) and history
   (`setChat`) paths funnel through `addChat()`.
4. **Styling `public/css/_chat.scss`** — inline `<code>` (padding,
   radius, `--surfaceColorHover` background, monospace) and links
   (`--primaryColor`, underline) scoped under `#chat-box`; both tokens
   are themed so dark mode adapts with no `dark-theme.scss` change.
   Plus the italic fix below.

## Implementation outcome / learnings

- **CSS gotcha — Meyer reset strips `<em>` italic.** Italic was wrapped
  correctly in `<em>` but rendered upright. Cause: `reset-css` (Meyer
  v5.0.1) applies `font: inherit` to `em`/`i`/`strong`/…, and the
  `font` shorthand resets `font-style` to `normal`. Bold survived only
  because `_base.scss` had an explicit `strong { font-weight: 700 }`;
  there was no italic equivalent. Strikethrough/code were unaffected
  (`text-decoration` isn't in the `font` shorthand; `code` was styled
  explicitly). Fix: `#chat-box em, #chat-box i { font-style: italic; }`
  in `_chat.scss`. The site font (Red Hat Text) is loaded without an
  italic face (`wght` axis only), so the slant is synthesized faux-
  italic via the default `font-synthesis: auto` — fine for chat.
- **Copilot review fix (commit `fb42e2e`).** markdown-it's default
  `image`/`link`/`autolink` inline rules produced output inconsistent
  with the DOMPurify allowlist: `![alt](url)` became an `<img>` that was
  stripped entirely (content vanished), and `[text](/relative)` became
  an `<a>` whose non-http href was stripped (dead, hrefless link).
  Disabling those three rules makes unsupported markdown stay literal
  text while bare URLs still linkify — matching the intended scope.
- **Verification.** `npm run build` (webpack + tsc) and `npm run lint`
  clean. Rendering pipeline verified in a real browser (markdown-it
  14.1.1 + DOMPurify 3.4.5 via esm.sh) and **live end-to-end** against
  broadcast `16061` (browser → dev-server → TLCS → echo → render).
  Confirmed: bold/italic/strikethrough/code render; bare URLs link with
  `target="_blank" rel="noopener noreferrer"`; underscored URLs stay
  intact; plain domains/emails don't link. XSS probes are inert:
  `<script>…`, `<img onerror>`, raw `<a href="javascript:">`, and
  `[x](javascript:…)` all render as literal text (markdown-it's own
  `validateLink` already drops `javascript:`, with DOMPurify as backstop).
- **Live-broadcast side effect.** `broadcast.sendChat()` forwards to the
  real TLCS server, so test chats propagate to that game's spectators
  (they see raw markdown, since rendering is client-side per their own
  build). Acceptable for the owner's own dev loop; worth remembering.

## Related

- [[node-tlcv]] — project entity
- [[markdown-in-chat-uis]] — the cross-cutting pattern (trust model
  drives the stack)
- [[2026-04-06-campfire-feature-12-markdown]] — campfire's richer,
  trusted-content markdown feature
