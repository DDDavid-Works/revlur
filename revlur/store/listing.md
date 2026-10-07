# Revlur: Chrome Web Store listing (draft)

Fields are in the order the developer dashboard asks for them. Character limits are the store's.
Placeholders in [square brackets] need your input.

## Store listing tab

**Name** (max 75)
Revlur: Focus on what matters

**Summary** (max 132)
Drag a box on any page and blur everything else. Zoom, present and read with focus. No accounts, no tracking.

**Category**
Productivity

**Language**
English

### Description

Show one thing. Blur the rest. Revlur blurs everything on a web page except the part you choose.

Click the icon, drag a rectangle, and the rest of the page fades into a soft blur. What's inside the rectangle stays sharp, so your audience, your students or your own eyes go straight to it. There is no setup, no menu and no account.

HOW IT WORKS
1. Click the Revlur icon (or press the shortcut you set).
2. Drag a rectangle in any direction around the part you want to show.
3. Everything outside it is blurred. Press Esc to leave.

WHAT YOU GET
- Adjustable blur from 0 to 20 px. Revlur remembers your setting.
- Zoom: show the selected area enlarged over the blurred page. A red laser-pointer dot follows your mouse, and it is drawn on the page, so it also shows up in screen shares that don't capture the real cursor.
- Copy or save the zoomed view as a PNG image.
- Lock-on: the page is held still while you present, so nothing shifts by accident. Press Scroll to let the page glide through your window, which is handy for reading a long article.
- Re-select: pick a different area without reloading the page.
- A small toolbar you can drag out of the way.
- A safe barrier: clicks on the blurred area do nothing, so nothing opens by accident in the middle of a demo.

GOOD FOR
- Presenting a chart, table or dashboard
- Teaching, one section of a page at a time
- Screen sharing without exposing side content
- Reading a long page without distractions

PRIVATE BY DESIGN
Revlur has no account, no analytics and no servers. It never sends anything anywhere. It only runs on the page you click it on, and the only thing it remembers is your blur level, stored on your own computer.

GOOD TO KNOW
- Revlur can't run on Chrome's own pages (chrome://), the Chrome Web Store or Chrome's built-in PDF viewer.
- It follows the main page scroll. Scrollable panels and frames inside a page are not tracked.
- Zoom shows a still snapshot of the page as it looked when you pressed Zoom.

Questions or ideas: dddavid.works@gmail.com

### Graphic assets

- Store icon 128x128: `src/icons/icon128.png`
- Screenshots (1280x800 or 640x400, up to 5). Suggested set:
  1. "Drag a box, blur the rest": a dashboard with a chart kept sharp.
  2. "Zoom in for the back row": the zoomed chart with the red pointer dot and the copy, save and close icons.
  3. "Focus on what you're reading": an article with the part you chose clear and the toolbar showing Scroll on.
  4. "Hold the page still": a presentation-style slide or dashboard with Lock-on.
  5. "Nothing to set up": the toolbar close-up with the blur slider.
- Small promo tile 440x280 (optional but recommended): icon, "Revlur", "Focus on what matters."

## Privacy tab

**Single purpose** (one sentence)
Revlur lets the user choose an area of the current web page and blurs the rest of the page to help them focus on, present or read that area.

### Permission justifications

**activeTab**
Used so that when the user clicks the Revlur icon or its keyboard shortcut, the extension can work on that one page. It also lets the extension take a snapshot of the visible tab when the user presses Zoom, so the selected area can be shown enlarged. Revlur has no access to any tab the user has not just activated it on.

**scripting**
Used to place Revlur's overlay (the blur, the selection outline and the small toolbar) onto the page the user activated it on. The code that is injected ships inside the extension; nothing is downloaded.

**storage**
Used to remember one number, the user's preferred blur level, on their own device. No other data is stored.

**Host permissions**
None requested.

**Remote code**
No. All code is bundled in the extension package.

### Data usage disclosures

Collected user data: none. Leave every data-type checkbox unticked.

Certifications (tick all three):
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy (hosted at website-waitlist/privacy.html, which also covers the waitlist form; paste its public URL into the dashboard)

The quoted text below is the extension-only version; the page on the site is the fuller one and is the source of truth.

> **Revlur privacy policy**
>
> Revlur does not collect, store, transmit or sell any personal data. It has no accounts, no analytics and no servers.
>
> **What Revlur does on your device.** When you click the Revlur icon or use its shortcut, Revlur draws an overlay on the page you are viewing. When you press Zoom, it takes a snapshot of the visible part of that tab and shows part of it enlarged. The snapshot stays in your browser's memory on your computer and is discarded when you close the zoomed view or leave Revlur. If you press Copy, the image is written to your clipboard. If you press Save, it is downloaded to your computer. Revlur never reads your clipboard and never uploads anything.
>
> **What Revlur remembers.** One setting, your blur level, is saved with Chrome's extension storage on your own device.
>
> **Permissions.** Revlur uses the activeTab, scripting and storage permissions only for the purposes described above. It requests no access to websites in advance and does not run on pages you have not activated it on.
>
> **Changes and contact.** If this policy changes, the new version will be posted here. Contact: dddavid.works@gmail.com.

## Test instructions for reviewers (optional field)

Open any normal web page, click the Revlur icon in the toolbar (pin it from the puzzle-piece menu), and drag a rectangle. Everything outside it should blur. Use the toolbar to try Zoom, Scroll and Re-select. Press Esc to exit. No account or sign-in is needed.
