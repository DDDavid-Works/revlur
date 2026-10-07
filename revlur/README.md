# Revlur

Focus on what matters. Show one thing, blur the rest: select an area of a page and everything else is blurred.

## Load in Chrome
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Pin the Revlur icon, open any normal web page, and click the icon.

## Keyboard shortcut
No shortcut is assigned by default. Set one at `chrome://extensions/shortcuts` (Revlur -> "Activate Revlur on the current page").

## Status
Feature-complete V1 (Phase 6 polish). Blur. Click the icon, drag a rectangle in any direction; everything outside it is blurred (default 8px, adjustable 0-20px with the toolbar slider, remembered locally). The toolbar offers Blur, Zoom, Re-select and exit. **Zoom** opens a modal with the selected area enlarged (a snapshot of the visible tab) over the blurred page; `Esc`, a click outside, or the modal's Ã— closes it. `Esc` again, the toolbar Ã—, or clicking the icon exits. **Lock-on** (the default) holds the page still while you present; press **Scroll** to let the page move through the fixed clear window, for example to read a long article, and press it again to lock at the new spot.

## Unit tests
```
node --test tests/geometry.test.js
```

## Using it
- Click the icon (or your shortcut), drag a rectangle in any direction. Everything outside it is blurred.
- In Zoom, the copy icon (or Ctrl/Cmd+C) puts the image on the clipboard and the download icon saves it as a PNG. Neither needs extra permissions.
- Toolbar: **Blur** slider (0-20px, remembered), **Zoom**, **Scroll**, **Re-select**, **x**. Drag the "Revlur" label to move the toolbar out of the way; it returns to automatic placement on Re-select.
- `Esc` closes Zoom first, then exits Revlur. Clicking the icon again also exits.
- Motion is a 120ms fade only, and is disabled with the system "reduce motion" setting.

## Known limits (V1)
- Window scrolling only: scroll containers and iframes are not tracked.
- Zoom is a snapshot (Chrome allows about 2 captures per second).
- A page's native modal `<dialog>` (opened with showModal) makes everything outside it inert, including Revlur's controls.
- Not available on chrome:// pages, the Chrome Web Store or the built-in PDF viewer.
- After reloading the extension during development, a tab no longer needs a refresh: the next click re-injects the script.

## Development scripts
```
npm test           # geometry unit tests
npm run package    # builds dist/revlur-<version>.zip for the Chrome Web Store
```
The package contains only `manifest.json` and `src/`. The script refuses to build if the manifest references a missing file, the version is invalid, a popup or default shortcut sneaks in, or a test file would be shipped. Bump `version` in `manifest.json` before each store upload.
