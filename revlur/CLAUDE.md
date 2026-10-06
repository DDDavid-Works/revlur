# Revlur

Official product name: **Revlur** (short for "reverse blur"). Use "Revlur" in the manifest name, UI text, toolbar, README and store listing.

Chrome Extension (Manifest V3) for focus/presentation: **Select â†’ Blur â†’ Zoom â†’ Lock-on**.
The user drags a rectangle; everything outside stays blurred, the selection stays clear.
Tagline: "Focus on what matters." Spec lives in `../revlur.txt`.

## Stack and constraints
- Plain JavaScript, HTML, CSS. No framework, no build step, minimal/no dependencies.
- No backend, accounts, cloud, AI, OCR, analytics, sync, payments. Local settings only (`chrome.storage.local`, blur value).
- Permissions: `activeTab` + `scripting` only. No broad host permissions, no always-on `content_scripts`.
- No popup in the activation flow: omit `default_popup`, use `chrome.action.onClicked`. Click activates immediately.
- Keyboard shortcut is a `commands` entry (`_execute_action`) with **no `suggested_key`**; the user assigns it at `chrome://extensions/shortcuts`.

## Architecture
Service worker injects content script on click (or sends a toggle message if already injected) -> content script builds a **closed shadow-root** host on `documentElement` containing the selection layer, blur layer (four `backdrop-filter` rects around the hole), toolbar, Zoom modal, Lock-on.
- Never modify page DOM/CSS. Overlay only; teardown must leave no trace.
- Guard against double injection; exactly one host element.
- Escape: capture-phase listener with `stopPropagation`; `Ã—` does the same full cleanup.
- Fail quietly on restricted pages (`chrome://`, Web Store, PDF viewer), e.g. a badge.

## V1 decisions (do not revisit without asking)
- **Window scroll only.** No nested scroll containers, independent panels, or iframes.
- Default state (Lock-on OFF): the overlay remains fixed to the viewport and the selected hole stays at the same viewport coordinates while the underlying page scrolls. Page scrolling is never intercepted.
- **Zoom** (replaces the earlier scroll-centering "Center", dropped by decision): the toolbar Zoom button opens a modal showing the selected area enlarged over the still-blurred page. Implementation is a **snapshot**: the service worker calls `chrome.tabs.captureVisibleTab` (covered by `activeTab`, no extra permission), the content script hides its own overlay for two frames to capture, crops the selection (screenshot px = CSS px x image/innerWidth), and draws it on a canvas scaled to fit ~90% of the viewport (max 4x). Not live or interactive. First Esc / click outside / x closes the modal; a second Esc exits Revlur. No browser-level zoom.
- **Lock-on** (OFF by default, resets on every activation) is **best-effort and must never break the core blur experience or alter page scrolling**. On enabling, it looks for a reliable target: the common ancestor of a 3x3 grid of sample points, climbed to the first element covering >=70% of the selection and no larger than 3x its area (`isReliableTarget`). If found, the hole tracks that element via `getBoundingClientRect()` (scroll, ResizeObserver and a 300ms check for layout shifts). If no element is reliable (several cards, free-form area, iframe), it falls back to document coordinates, i.e. the hole sticks to the same spot on the page. If the element disappears or becomes hidden, Lock-on turns itself off with a brief note and the hole stays where it was. The hole may leave the viewport; the toolbar then docks to the visible edge and Zoom uses the visible part.
- Blur default 8px, range 0â€“20px. Prioritize performance over effects. `backdrop-filter` can get expensive on huge pages, animated pages, video, dashboards and high-res monitors: in Phase 3, test blur performance on a long real-world webpage (scrolling, video, dashboard) before adding any additional visual effects or transitions.
- **The blurred area is inert** (decision: it is a safe barrier for presentations). Clicks, double-clicks and context menus on the blur panels stop there and never reach the page, so links/controls under the blur cannot be triggered by accident, and a click there does not exit Revlur. Wheel and scrollbar scrolling still work. Exit only via Esc, the toolbar x, or the icon. The clear hole has no panel over it, so the page inside it works normally.
- **Cursor states:** during selection mode, use a crosshair cursor. Once a selection exists, restore the normal webpage cursor and use pointer cursors only for Revlur controls. Re-selecting enters crosshair mode again. Over the inert blurred area the normal arrow is used. Do not unnecessarily override cursor behavior inside the selected webpage area: the hole is only a hole, so links and controls inside it keep working and keep their own cursors. The one exception is Zoom mode, which doubles as a presentation view: the dimmed/blurred backdrop keeps the normal arrow (no pointer), and over the enlarged image the native cursor is hidden and replaced by a red laser-pointer dot drawn in the page (so it also shows in screen shares that don't capture the real cursor). Over the modal's close button the normal pointer cursor and no dot are used. Touch input gets no dot.

## Layout
```
revlur/
â”œâ”€â”€ manifest.json
â”œâ”€â”€ README.md
â”œâ”€â”€ CLAUDE.md
â”œâ”€â”€ src/background/service-worker.js
â”œâ”€â”€ src/content/content.js, content.css
â”œâ”€â”€ src/icons/icon{16,32,48,128}.png
â”œâ”€â”€ test-pages/      local pages: long page, sticky header, modal, etc.
â””â”€â”€ screenshots/
```

## Process
- Build incrementally by phase (1 foundation, 2 selection, 3 blur+toolbar+Escape, 4 Zoom, 5 Lock-on, 6 Re-select/polish). Don't jump ahead.
- After each phase: explain what was implemented, files changed, exact Chrome test steps, known limitations; fix obvious issues before moving on.
- Compiling/loading is not proof it works; verify behavior on `test-pages/` and real pages.
- Don't over-engineer. Keep pure helpers (rect normalize/clamp, target selection) separate so they're easy to test.

## Testing
Load unpacked at `chrome://extensions` (Developer mode). Edge cases to cover: long pages, fixed/sticky headers, modals, small/huge selections, viewport edges, reverse drag direction, horizontal+vertical scroll, resize, dynamic DOM, vanished elements, very high z-index.

## Phase 6 decisions
- Toolbar can be dragged by its "Revlur" label; position resets on Re-select. Auto placement otherwise (below, above, or docked).
- Fades are CSS-only, 120ms, opacity only, off under prefers-reduced-motion. Never animate blur radius or positions.
- Icon click first tries a plain toggle message and only injects on failure; a newly injected script disposes any stale copy (`window.__revlur.dispose()`), so extension reloads don't need tab refreshes.
- Esc is ignored during IME composition (`isComposing`).
- Deliberately not added: a gear/settings menu (the only setting is the persisted blur), single-letter shortcuts (they would collide with typing in page fields).

## Packaging
`npm run package` (scripts/package.js, zero dependencies) writes dist/revlur-<manifest version>.zip containing only manifest.json + src/. It validates the manifest first and is reproducible (fixed timestamps). The version comes from manifest.json, not package.json.

- Zoom modal: the close button floats outside the image (above its top-right corner) so it never covers content. The image is sized to leave a 48px margin on every side so the button always fits on screen.

## Icon
Source: assets/icon.svg (not packaged). A red broken-square viewfinder (four equal corner brackets, symmetric on both axes) around a white R with a red dot like a period. The PNGs in src/icons (16/32/48/128) are rendered from it; re-render them if the SVG changes.

## Phase 7: Copy and Save image (Zoom only)
Added after the six planned phases, as a small additive step (decision: copy/save of the existing snapshot are local utilities, not the "sharing" the spec excludes). Icon buttons (copy, download, close; outline icons built as SVG DOM nodes, no text labels) sit above the Zoom image; Ctrl/Cmd+C also copies while Zoom is open (unless text is selected). Copy writes a PNG with navigator.clipboard.write on a user gesture (Revlur never reads the clipboard); Save downloads revlur-YYYY-MM-DD-HHMMSS.png through a blob anchor into the normal downloads folder. No new permissions. On success the icon briefly becomes a check; on failure a red alert mark. Still not added: text copy, annotation, sharing.

## Theme
Ash-blue UI theme with a coral-red accent (content.css custom properties on :host; change colors there, never in individual rules). Surface #d5e0ec (96% opaque), solid surface #e3ebf3, text #243447, muted #587089, hover/line are translucent ash blue, shadows and the Zoom veil use #2b3a4a. Accent #e5565b (slider, window outline, laser dot, Lock-on pill with deep red text #b4232c). The icon itself is still the dark slate version.
