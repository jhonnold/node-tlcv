# Add Tournament Titles to Dashboard Cards — Implementation Plan

**Issue:** #130
**Goal:** Display the tournament title (site) within each broadcast card on the dashboard page.
**Architecture:** The `site` field is already passed from the backend route to the EJS template but is not rendered. We need to add a tournament title element to the card template and style it appropriately. This is a purely presentational change requiring edits to two files: the EJS template and the SCSS stylesheet.

## Tasks

### Task 1: Add tournament title markup to the broadcast card template

**Files:**
- Modify: `views/pages/broadcasts.ejs`

**Steps:**
Add a `tournament-title` div inside the `.card-info` div, placed **above** the first `.player-row` (the black player row) so the tournament name appears as the card heading. Insert the following between lines 88 and 89 of `views/pages/broadcasts.ejs`:

```ejs
              <% if (broadcast.site) { %>
              <div class="tournament-title"><%= broadcast.site %></div>
              <% } %>
```

The full `.card-info` section will then read:
```ejs
            <div class="card-info">
              <% if (broadcast.site) { %>
              <div class="tournament-title"><%= broadcast.site %></div>
              <% } %>
              <div class="player-row">
                <span class="player-color pc-black"></span>
                ...
```

### Task 2: Style the tournament title element

**Files:**
- Modify: `public/css/_broadcasts.scss`

**Steps:**
Add a `.tournament-title` rule in `_broadcasts.scss`. Place it after the `.card-info` block (after line 93) and before `.player-row` (line 95). The style should match the card's existing design language — small, muted text with truncation:

```scss
.tournament-title {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--primaryColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

This uses `--primaryColor` to visually distinguish the tournament name from other card text (player names, opening, etc.), and applies the same ellipsis-truncation pattern used by `.player-name` and `.opening`.

## Risks and Considerations

- **Empty `site` values:** The `<% if (broadcast.site) { %>` guard ensures no empty heading is rendered when the site field is blank or undefined.
- **Long tournament names:** Handled with `text-overflow: ellipsis` to prevent layout breakage.
- **Card height increase:** Adding a new line of text will slightly increase card height. Since `.card-info` uses `justify-content: space-between`, the existing elements will redistribute naturally. The mini-board uses a fixed 120×120px size so it won't be affected.
- **No breaking changes:** The `site` field is already in the data payload (line 24 of `src/routes/index.ts`); no backend changes are needed.
