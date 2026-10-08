# Revlur: Chrome Web Store screenshots, step by step

The store takes 1 to 5 screenshots, each **exactly 1280x800** (or 640x400), as JPEG or **24-bit PNG with no transparency**. Five is the target. The promo tile is done: `promo-tile-440x280.png` (source: `promo-tile.svg`).

Capture with the real extension, load the latest build (0.4.0, with the "Revlur." toolbar and the resize handles), and use the staged pages so no real site, brand or personal data appears.

## 0. One-time setup (about 5 minutes)

1. **Load the extension.** `chrome://extensions` -> turn on **Developer mode** -> **Load unpacked** -> choose the `revlur` folder (the one containing `manifest.json`: `D:\Work\001-Work\Revlur\revlur`). Pin the Revlur icon from the puzzle-piece menu. If you rebuild or change code later, press the reload arrow on its card.
2. **Set a shortcut** (optional but handy): `chrome://extensions/shortcuts` -> Revlur -> "Activate Revlur on the current page" -> for example `Alt+Shift+R`.
3. **Serve the staged pages.** The extension can't run on `file://` pages unless you also switch on "Allow access to file URLs", so serve them over localhost instead:
   - In Claude: the `store-scenes` preview server (already configured in `.claude/launch.json`), or
   - In a terminal, from the repo root: `npx --yes http-server revlur/store/scenes -p 5180 -c-1`

   Then use these addresses in Chrome:
   - `http://localhost:5180/dashboard.html`
   - `http://localhost:5180/article.html`
4. **Use a clean browser window:** light mode, no other extension icons visible, bookmarks bar hidden (Ctrl+Shift+B), page zoom 100% (Ctrl+0).

## 1. Make the capture area exactly 1280x800

For every shot:
1. Open the page, press **F12**, then **Ctrl+Shift+M** (device toolbar).
2. In the device toolbar, choose **Responsive** and type **1280** x **800**.
3. Click the three-dot menu in that toolbar, tick **Show device pixel ratio**, and set it to **1.0**. If it is 2.0 the file will come out 2560x1600 and be rejected.
4. Keep the zoom box at **100%** (if it says "Fit to window", set it to 100%).

## 2. Take the picture

1. Click the page once, then activate Revlur (the toolbar icon or your shortcut) and make the selection described below.
2. **Don't move the mouse after you finish**, and don't hover a handle.
3. Press **Ctrl+Shift+P** (DevTools command menu; click inside DevTools first if nothing opens), type `screenshot`, and choose **Capture screenshot** (the plain one, not "full size" or "node"). Use the keyboard only.
4. Save into one folder with the names below.
5. Press **Esc** twice to leave Revlur before the next shot.

## 3. The five shots

| # | Save as | Page | What to do | Must be visible |
|---|---|---|---|---|
| 1 | `01-select.png` | dashboard | Drag a box around the row of four stat cards. Blur 8px. | Sharp cards, red corner brackets and edge bars around them, blurred rest, "Revlur." toolbar below |
| 2 | `02-zoom.png` | dashboard | Select the revenue chart, click **Zoom**. Rest the mouse over the middle of the enlarged image and stop moving. | Enlarged chart, the red laser dot on it, the copy, save and close icons above it |
| 3 | `03-read.png` | article | Select about six lines of body text (from "The yeast does the work..." down). Click **Scroll** so it shows as on (red tint). | Sharp text, blurred sidebars, ads and comments, the highlighted Scroll button |
| 4 | `04-present.png` | dashboard | Select the "Top accounts" table. Leave **Scroll** off. | The locked state, with the default toolbar |
| 5 | `05-blur.png` | article | Select the headline and first paragraph, drag the slider to **14px**. | A strong blur and the slider at 14px |

Same look across the set: same toolbar position, 8px blur everywhere except shot 5, and the red handles shown in shots 1, 3, 4 and 5.

## 4. Check and convert for the store

DevTools saves 32-bit PNGs (with an alpha channel), and the store asks for 24-bit with none. The checker converts them and checks the size:

```
node revlur/store/prepare-screenshots.js <folder-with-your-5-files>
```

It prints each file's size and format and writes store-ready copies to `<folder>/store-ready`. A file of the wrong size is flagged (and the command exits with an error). Upload the files from `store-ready`.

## 5. Before uploading

- [ ] 5 files, each 1280x800, and the checker says all are fine
- [ ] Look at each at about 640px wide: is the clear area obvious within two seconds?
- [ ] Nothing personal in the frame: no real names, tabs, bookmarks or other extensions
- [ ] Shots are in the order above (the first is the one people see first)
- [ ] The promo tile `promo-tile-440x280.png` is ready for the "small promo tile" slot

## Captions (optional)
The store has its own caption field, so overlay text isn't needed. If you add it, use Segoe UI or similar in `#f4f7fa` on a `#1b2735` strip at the top, 36 to 44 px, one short line.

## If something looks wrong
- **Revlur doesn't start on the page:** you're probably on a `file://` address. Use the `http://localhost:5180/...` ones.
- **The file is 2560x1600:** the device pixel ratio wasn't 1.0 (step 1.3).
- **No laser dot in shot 2:** the mouse moved off the image. Put it back, then use only the keyboard to capture.
- **Toolbar covers something:** drag it by the "Revlur." label before capturing.
