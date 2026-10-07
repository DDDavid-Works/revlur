# Revlur: Chrome Web Store screenshots plan

The store accepts 1 to 5 screenshots at **1280x800** (or 640x400), as JPEG or 24-bit PNG with no transparency. Five is the target. The promo tile is already done: `promo-tile-440x280.png` (source: `promo-tile.svg`).

## Staged pages (so no real site, brand or personal data appears)
Both are in `store/scenes/` and need no server; open them straight from disk.
- `dashboard.html`: a plain analytics dashboard (stat cards, chart, accounts table). Good for presenting and zoom.
- `article.html`: a long article with a nav bar, sidebars, ads and comments. Good for the reading story, because the clutter is what Revlur removes.

## One-time setup
1. In `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `revlur/` folder. Pin the Revlur icon.
2. Set a shortcut at `chrome://extensions/shortcuts` (for example Alt+Shift+R). It lets you activate Revlur while DevTools is open.
3. Keep the blur at the default **8px** for every shot so they look consistent. Use 14px for shot 5 only.

## How to capture at exactly 1280x800
- **Best:** open the page, press F12, toggle the device toolbar (Ctrl+Shift+M), choose **Responsive**, and type **1280 x 800**. Activate Revlur with the shortcut, make your selection with the mouse, then press Ctrl+Shift+P and run **Capture screenshot** (the viewport one, not full size). The file is exactly 1280x800.
- **Fallback:** resize the window to about 1280x800 of page area, and capture with a snipping tool, then crop or resize to exactly 1280x800.
- Hide bookmarks and other toolbars. Use light mode so the pages look as designed.
- If a screenshot saves as RGBA, convert it (any editor's "export as JPEG" works) because the store rejects transparency.

## The five screenshots
| # | Caption (add in an image editor, optional) | Page | Steps | Must be visible |
|---|---|---|---|---|
| 1 | Drag a box. Blur the rest. | dashboard | Select the whole row of four stat cards. | Red selection outline with the red resize handles (corner brackets and edge bars) around it, blurred surroundings, the toolbar below the selection. Don't hover a handle, so none looks highlighted |
| 2 | Zoom in for the back row | dashboard | Select the revenue chart, click **Zoom**. Move the mouse over the image. | The enlarged chart, the red laser dot, and the copy, save and close icons above it |
| 3 | Focus on what you're reading | article | Select about six lines of the body text. Press **Scroll** so it shows as on. | Sharp text, blurred sidebars, ads and comments, the Scroll button highlighted |
| 4 | Hold the page still while you present | dashboard | Select the accounts table. Leave **Scroll** off. | The locked state, with the toolbar showing the default controls |
| 5 | You decide how much to blur | article | Select a headline and first paragraph, set the slider to 14px. | A strong blur and the slider at 14px |

## Rules for every shot
- Same toolbar position and selection style across the set, and the same 8px blur apart from shot 5.
- Shots 1, 3, 4 and 5 show the resize handles around the clear area. That's expected and helps explain the product.
- Nothing personal in the frame: no real names, tabs, bookmarks or extensions.
- Text in the clear area should be readable at store-listing size (about 640px wide).
- Do not show other extensions' icons.

## Captions (optional)
The store shows its own caption field, so overlay text isn't needed. If you add it, use Segoe UI or similar in `#f4f7fa` on a `#1b2735` strip at the top, 36 to 44 px, one short line.

## Before uploading
- [ ] 5 files, each exactly 1280x800, no alpha
- [ ] File names in order: `01-select.png` ... `05-blur-slider.png`
- [ ] Reviewed at small size: is the clear area obvious in two seconds?
- [ ] The promo tile `promo-tile-440x280.png` is ready to upload as the "small promo tile"
