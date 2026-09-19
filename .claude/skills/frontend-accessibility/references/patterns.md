# WAI-ARIA APG patterns mapped to Readora components

Source: w3.org/WAI/ARIA/apg/patterns. Prefer `@angular/aria` directives where a pattern exists there (Menu, Menubar,
Tabs, Toolbar, Listbox, Combobox, Select, Accordion, Tree, Grid); they implement roles, keyboard and focus. Paths are
under `frontend/src/app/`.

## Modal dialog: `shared/ui/dialog/` (report page, report comment, kanban submit)
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → the dialog title.
- Opening: focus the first field or the dialog; Tab/Shift+Tab wrap inside; the page behind is inert.
- Escape closes; focus returns to the trigger (`appFocusTrap` does this).
- Phones: full-screen sheet layout (see the `frontend-responsive` skill).

## Disclosure (show/hide): notification bell (`features/layout/shell/notification-bell/`), reader chapter list and settings panel, "show replies"
- `<button aria-expanded aria-controls>`; the panel is a region, **not** `role="menu"`.
- Escape closes a popover disclosure and returns focus to its button; content is dismissible and hoverable (1.4.13).

## Menu button: account menu in `features/layout/shell/shell.html` (`ngMenu` from `@angular/aria`)
- For app-style actions only. Site navigation stays a `<nav>` of links.
- Keys: Enter/Space/ArrowDown open and focus the first item; Up/Down move; Escape closes and returns focus; typeahead.

## Combobox with listbox: omnisearch (`features/layout/shell/omnisearch/`)
- Input `role="combobox"`, `aria-expanded`, `aria-controls` → `role="listbox"`, `aria-activedescendant` → the active
  option, `aria-autocomplete="list"`.
- Keys: Down/Up move the active option; Enter opens it (or the full results when none is active); Escape closes the
  list.
- Result count in a polite live region, debounced.

## Tabs: profile page (`features/profile/profile-page/`, `ngTabs`)
- `tablist` > `tab[aria-selected][aria-controls]` > `tabpanel[aria-labelledby]`; one tab stop; Left/Right move;
  Home/End; Tab goes into the panel.
- Route-driven tabs (links that change the URL, e.g. updates feed / rankings period) are plain links with
  `aria-current="page"`, not ARIA tabs.

## Toolbar: reader toolbar (`features/reader/reader-page/reader-toolbar/`, `ngToolbar`)
- One tab stop; Left/Right move between controls; toggles use `aria-pressed` (mode, direction, zen, auto-scroll).

## Image viewer (carousel-like): paged reader (`features/reader/reader-page/paged-flow/`)
- Labelled prev/next buttons (their order follows the reading direction; the labels say "Next"/"Previous"), no
  auto-advance except the user-started auto-scroll with a pause control.
- Position ("Page 3 of 24") in the toolbar's polite live region; swipe and invisible tap zones are shortcuts, never the
  only way.

## Comment thread: `features/social/chapter-comments/comment-tree/`
- Nested `ul/li` with `aria-level`, one visible heading for the section; each comment's actions are real buttons; when
  several "Reply" buttons sit on one page, their names should include the author ("Reply to aoi").
- `role="feed"` only for infinite-scroll article lists; `role="tree"` is not for comments.

## Board: scanlation kanban (`features/scanlation/scanlation-board-page/`)
- Columns are `section`s labelled with the stage name; cards are `article`s with buttons (Claim, Submit, Publish)
  instead of drag.
- If drag is ever added: keep the buttons or a "Move to…" menu (2.5.7), and announce moves in a live region.

## File drop zone: upload (`features/upload/upload-studio-page/pages-step/page-grid-uploader/`)
- The drop zone is a visual target; a real `<button>` / labelled file input sits outside it (no nested interactive
  elements).
- Page reordering offers "Move left"/"Move right" buttons besides drag. Announcing the new position in a live region
  is still missing: add it when touching this component.

## Live regions (everywhere)
- `role="status"` for progress and success, `role="alert"` for errors; render the container up front and change only
  its text; no focusable content inside; don't announce on every keystroke.
