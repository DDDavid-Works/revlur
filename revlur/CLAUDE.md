# Revlur

Official product name: **Revlur** (short for "reverse blur"). Use "Revlur" in the manifest name, UI text, toolbar, README and store listing.

Chrome Extension (Manifest V3) for focus/presentation: **Select â†’ Blur â†’ Zoom â†’ Lock-on**.
The user drags a rectangle; everything outside stays blurred, the selection stays clear.
Positioning (store name, page title): "Focus on what matters." Hero headline: "Show one thing. Blur the rest." Spec lives in `../revlur.txt`.

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
- **Lock-on is the default state:** the clear window is fixed to the viewport and the page is held still. Wheel scrolling is blocked (except inside a scrollable element within the window), and any other scroll (scrollbar, keys, find) is reset to the held position, with a short "Scrolling is locked" note on the first blocked wheel. The toolbar **Scroll** button allows scrolling: the page then moves through the fixed window, like a reading window for long pages. Clicking it again locks at the new position. Every activation starts locked; Re-select releases the lock while choosing; the chosen state persists across Re-select within one activation.
- **Zoom** (replaces the earlier scroll-centering "Center", dropped by decision): the toolbar Zoom button opens a modal showing the selected area enlarged over the still-blurred page. Implementation is a **snapshot**: the service worker calls `chrome.tabs.captureVisibleTab` (covered by `activeTab`, no extra permission), the content script hides its own overlay for two frames to capture, crops the selection (screenshot px = CSS px x image/innerWidth), and draws it on a canvas scaled to fit ~90% of the viewport (max 4x). Not live or interactive. First Esc / click outside / x closes the modal; a second Esc exits Revlur. No browser-level zoom.
- **Superseded:** the earlier element-tracking Lock-on (hole follows the DOM element or page position) was removed as of this redesign; it lives in git history (commit 4d233b2 era) if ever needed.
- Blur default 8px, range 0â€“20px. Prioritize performance over effects. `backdrop-filter` can get expensive on huge pages, animated pages, video, dashboards and high-res monitors: in Phase 3, test blur performance on a long real-world webpage (scrolling, video, dashboard) before adding any additional visual effects or transitions.
- **The blurred area is inert** (decision: it is a safe barrier for presentations). Clicks, double-clicks and context menus on the blur panels stop there and never reach the page, so links/controls under the blur cannot be triggered by accident, and a click there does not exit Revlur. Wheel and scrollbar scrolling still work. Exit only via Esc, the toolbar x, or the icon. The clear hole has no panel over it, so the page inside it works normally.
- **One selection only (V1).** A new drag or Re-select replaces the previous area; multiple simultaneous selections are explicitly out of scope. Revisit for V2 only if needed: it would need a multi-hole blur mask (not the four-panel layout), one Lock-on tracker per area, and rules for Zoom and for adding/removing areas.
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
- Fades are CSS-only, 120ms, opacity only, off under prefers-reduced-motion. Never animate blur radius or the hole position. One exception: opening Zoom grows the image from the selection to the enlarged view (Web Animations API, transform + opacity only, 200ms, skipped under reduce-motion, closing is instant); the website demo mirrors it.
- Icon click first tries a plain toggle message and only injects on failure; a newly injected script disposes any stale copy (`window.__revlur.dispose()`), so extension reloads don't need tab refreshes.
- Esc is ignored during IME composition (`isComposing`).
- Deliberately not added: a gear/settings menu (the only setting is the persisted blur), single-letter shortcuts (they would collide with typing in page fields).

## Packaging
`npm run package` (scripts/package.js, zero dependencies) writes dist/revlur-<manifest version>.zip containing only manifest.json + src/. It validates the manifest first and is reproducible (fixed timestamps). The version comes from manifest.json, not package.json.

- Zoom modal: the close button floats outside the image (above its top-right corner) so it never covers content. The image is sized to leave a 48px margin on every side so the button always fits on screen.

## Icon
Source: assets/icon.svg (not packaged). A coral-red broken-square viewfinder (four equal corner brackets, symmetric on both axes) around an off-white R with a coral dot like a period, on an ash-blue tile. The PNGs in src/icons (16/32/48/128) are rendered from it; re-render them if the SVG changes.

## Phase 7: Copy and Save image (Zoom only)
Added after the six planned phases, as a small additive step (decision: copy/save of the existing snapshot are local utilities, not the "sharing" the spec excludes). Icon buttons (copy, download, close; outline icons built as SVG DOM nodes, no text labels) sit above the Zoom image; Ctrl/Cmd+C also copies while Zoom is open (unless text is selected). Copy writes a PNG with navigator.clipboard.write on a user gesture (Revlur never reads the clipboard); Save downloads revlur-YYYY-MM-DD-HHMMSS.png through a blob anchor into the normal downloads folder. No new permissions. On success the icon briefly becomes a check; on failure a red alert mark. Still not added: text copy, annotation, sharing.

## Theme
Ash-blue UI theme with a coral-red accent (content.css custom properties on :host; change colors there, never in individual rules). Surface #d5e0ec (96% opaque), solid surface #e3ebf3, text #243447, muted #587089, hover/line are translucent ash blue, shadows and the Zoom veil use #2b3a4a. Accent #e5565b (slider, window outline, laser dot, Lock-on pill with deep red text #b4232c). The icon uses the same palette: ash-blue tile #3d5166, coral brackets and dot #e5565b, off-white R #f4f7fa.

## Scroll lock redesign
Decision: Lock-on now means "hold the page still" (default), with a Scroll button to allow scrolling, replacing the element-tracking follow mode (judged low value: scrolling a locked-to-content hole through blurred text is unreadable). Implementation is in content.js: a capture-phase wheel handler (preventDefault, with an exception for inner scrollers inside the window) plus a document scroll listener that resets the window scroll position. This is a deliberate, opt-out exception to "never block page scrolling"; the toolbar Scroll button and the note keep it discoverable.
