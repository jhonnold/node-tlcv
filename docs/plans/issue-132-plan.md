# Update Admin Dashboard UI Implementation Plan

**Issue:** #132
**Goal:** Modernize the Admin dashboard to match the rest of the UI by adding the shared header/footer, theme support, and consistent styling.
**Architecture:** The admin page is currently a standalone HTML page with inline styles and no shared components. We will integrate it with the existing EJS partial system (header, footer), initialize the theme toggle via `initTheme()` in `admin.ts`, create a new `_admin.scss` partial for admin-specific styles using CSS custom properties, and restructure the template to follow the same patterns as `broadcasts.ejs`.

## Tasks

### Task 1: Add theme initialization to admin.ts
**Files:**
- Modify: `public/js/admin.ts`

**Steps:**
1. Write failing test: Manually verify that the theme toggle button does nothing on the admin page (current state). Since this is a frontend jQuery app with no unit test framework, verification is manual via the browser.
2. Implement: Add the theme import and `initTheme()` call to `admin.ts`, matching the pattern in `broadcasts.ts`:
   ```typescript
   import $ from 'jquery';
   import { init as initTheme } from './components/theme/index';

   // ... existing code unchanged ...

   $(document).ready(() => {
     initTheme();

     // ... rest of existing handlers unchanged ...
   });
   ```
3. Verify: `npm run build` succeeds without errors.

### Task 2: Update admin.ejs template structure with header and footer
**Files:**
- Modify: `views/pages/admin.ejs`

**Steps:**
1. Write failing test: Load `/admin` in a browser and confirm no header/footer is present (current state).
2. Implement: Restructure `admin.ejs` to match the `broadcasts.ejs` pattern:
   - Add `<%- include('../partials/analytics') %>` in `<head>`
   - Add `<%- include('../partials/header', { showFocus: false }) %>` after `<body>`
   - Wrap content in `<div class="container">` (without inline styles)
   - Add `<%- include('../partials/footer') %>` before `</body>`
   - Update `<title>` to follow convention: `Admin Panel - CCRL Live`
   - Add a `.page-header` div with `<h1>Admin Panel</h1>` at the top of the container

   The full template structure should be:
   ```ejs
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <meta http-equiv="X-UA-Compatible" content="ie=edge" />
       <title>Admin Panel - CCRL Live</title>
       <%- include('../partials/analytics') %>
     </head>
     <body>
       <%- include('../partials/header', { showFocus: false }) %>
       <div class="container">
         <div class="page-header">
           <h1>Admin Panel</h1>
         </div>

         <div class="admin-section">
           <h2>Broadcasts</h2>
           <!-- existing broadcasts table, unchanged -->
           <!-- existing add-new form, unchanged -->
         </div>

         <hr class="admin-divider" />

         <div class="admin-section">
           <h2>Kibitzers</h2>
           <!-- existing kibitzers table, unchanged -->
           <!-- existing kibitzer-form, unchanged -->
         </div>
       </div>
       <%- include('../partials/footer') %>
     </body>
   </html>
   ```
   - Remove the inline `style="max-width: 1200px; padding: 1rem"` from the container div
   - Remove `style="display: none"` from `#ssh-fields` and `#kibitzer-cancel` (move to CSS)
   - Wrap each section (Broadcasts, Kibitzers) in `<div class="admin-section">`
   - Add class `admin-table` to both `<table>` elements for targeted styling
   - Add class `admin-form` to both `<form>` elements
3. Verify: `npm run build` succeeds. Load `/admin` in browser — header with theme toggle and footer should appear.

### Task 3: Create admin-specific SCSS partial
**Files:**
- Create: `public/css/_admin.scss`
- Modify: `public/css/main.scss`

**Steps:**
1. Write failing test: Load `/admin` and confirm tables/forms use default unstyled mini.css appearance (current state).
2. Implement: Create `public/css/_admin.scss` with styles that use CSS custom properties for full theme compatibility:
   ```scss
   .admin-section {
     max-width: 900px;
     margin: 0 auto;
     padding: 0 16px 24px;

     h2 {
       font-size: 1.25rem;
       margin-bottom: 12px;
       color: var(--textColor);
     }
   }

   .admin-divider {
     max-width: 900px;
     margin: 8px auto 24px;
     border: none;
     border-top: 1px solid var(--surfaceColorHover);
   }

   .admin-table {
     width: 100%;
     border-collapse: collapse;
     background: var(--surfaceColor);
     border: 1px solid var(--surfaceColorHover);
     border-radius: 8px;
     overflow: hidden;
     margin-bottom: 16px;

     thead {
       background: var(--surfaceColorHover);
     }

     th {
       font-weight: 600;
       font-size: 0.85em;
       text-align: left;
       padding: 10px 12px;
       color: var(--textColor);
     }

     td {
       padding: 10px 12px;
       font-size: 0.9em;
       color: var(--textColor);
       border-top: 1px solid var(--surfaceColorHover);
     }

     tr:hover td {
       background: var(--surfaceColorHover);
     }

     button.secondary {
       font-family: var(--fontFamily);
       font-size: 0.8em;
       padding: 4px 10px;
       border-radius: var(--universal-border-radius);
       cursor: pointer;
     }
   }

   .admin-form {
     max-width: 500px;

     label {
       display: block;
       font-size: 0.85em;
       font-weight: 600;
       margin-bottom: 4px;
       margin-top: 12px;
       color: var(--textColor);
     }

     input,
     select {
       width: 100%;
       padding: 8px 10px;
       font-family: var(--fontFamily);
       font-size: 0.9em;
       border: 1px solid var(--surfaceColorHover);
       border-radius: var(--universal-border-radius);
       background: var(--surfaceColor);
       color: var(--textColor);
       box-sizing: border-box;

       &:focus {
         outline: 2px solid var(--primaryColor);
         outline-offset: -1px;
       }
     }

     fieldset {
       border: 1px solid var(--surfaceColorHover);
       border-radius: 8px;
       padding: 16px;
       background: var(--surfaceColor);
     }

     legend {
       font-weight: 600;
       font-size: 1rem;
       color: var(--textColor);
       padding: 0 8px;
     }

     button[type='submit'] {
       margin-top: 16px;
     }

     #ssh-fields {
       display: none;
     }

     #kibitzer-cancel {
       display: none;
       margin-left: 0.5rem;
     }
   }
   ```

   Then add `@use 'admin';` to `public/css/main.scss` (before `responsive`):
   ```scss
   @use 'admin';
   @use 'responsive';
   ```
3. Verify: `npm run build` succeeds. Load `/admin` — tables should have themed backgrounds, rounded corners, and hover effects. Toggle dark theme — all elements should respect dark colors.

### Task 4: Verify dark theme compatibility
**Files:**
- No new files; verification only.

**Steps:**
1. Write failing test: Load `/admin`, click the theme toggle in the header, and verify all elements update correctly.
2. Implement: Check that all admin styles use only CSS custom properties (`var(--*)`) and not hardcoded colors. Review `_admin.scss` for any hardcoded color values and replace with variables. Key variables to use:
   - Backgrounds: `var(--surfaceColor)`, `var(--surfaceColorHover)`, `var(--backgroundColor)`
   - Text: `var(--textColor)`
   - Accents: `var(--primaryColor)`, `var(--primaryColorHover)`
   - Borders: `var(--surfaceColorHover)`
3. Verify: Toggle between light and dark theme on the admin page. All text, backgrounds, borders, buttons, and form elements should change appropriately.

## Testing Strategy

Since this is a frontend-only change with no unit test framework:

1. **Build verification**: `npm run build` must succeed without errors after all changes.
2. **Visual verification** (manual):
   - Load `/admin` — header with "CCRL Live" branding and theme toggle button should appear at top
   - Footer with credits should appear at bottom
   - Click theme toggle — entire page including tables, forms, and all elements should switch between light and dark themes
   - Tables should have themed surface backgrounds with hover effects on rows
   - Forms should have consistent input styling with focus states
   - The page layout should feel consistent with `/broadcasts`
3. **Responsive verification**: Resize browser to mobile width (~375px) — admin page should remain usable
4. **Functional verification**: All existing admin functionality must still work:
   - Close broadcast button
   - Add new broadcast form
   - Edit/Remove kibitzer buttons
   - Add/Edit kibitzer form with SSH field toggle
   - Cancel edit button

## Risks and Considerations

- **No breaking changes to functionality**: All form IDs, button classes, and data attributes used by `admin.ts` must remain identical. Only wrapper classes and structural elements are being added.
- **Inline styles removal**: The `style="display: none"` on `#ssh-fields` and `#kibitzer-cancel` must be moved to CSS (`_admin.scss`) to maintain the same initial hidden state, since `admin.ts` uses jQuery `.toggle()` / `.show()` / `.hide()` on these elements.
- **mini.css conflicts**: The existing `mini.css` framework is loaded via webpack for all pages. Some of its default table/form styles may conflict with the new `_admin.scss` styles. Use specific class selectors (`.admin-table`, `.admin-form`) to ensure our styles take precedence.
- **No analytics partial**: The admin page currently doesn't include the analytics partial. Adding it is optional and follows the pattern of other pages, but should be confirmed with the project owner if analytics should track admin page views.
