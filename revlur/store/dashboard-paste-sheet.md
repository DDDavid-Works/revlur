# Chrome Web Store dashboard: paste sheet

Go through the dashboard tab by tab. Each field below has the exact value to paste (the grey boxes). Anything marked **YOUR CALL** is a decision only you can make. The same text lives in `listing.md`; this sheet is just the dashboard order.

Dashboard: https://chrome.google.com/webstore/devconsole

## Before you start
- [ ] `revlur/dist/revlur-0.4.0.zip` exists on your computer (20.8 KB, 9 files). If you rebuild it, run `npm run package` in `revlur/`.
- [ ] The version in the zip is 0.4.0. The store rejects an upload with the same or a lower number than a previous one, so bump it for any later upload.
- [ ] https://revlur.app/privacy.html opens (it does as of Oct 8).
- [ ] Screenshots are ready (see `screenshots.md`). Not required to save a draft, but required to submit.
- [ ] In the developer account settings, the contact email is set and verified. The store won't let you publish until it is.

## 1. Create the item and upload (Package tab)
1. Click **Add new item** and upload `revlur-0.4.0.zip`.
2. Let it finish reading the manifest. Expect: name **Revlur**, version **0.4.0**, and the summary line filled in from the manifest.

Expected permissions listed: `activeTab`, `scripting`, `storage`. No host permissions. If the dashboard shows anything else, stop and tell me.

## 2. Store listing tab

**Description** (paste all of it)
```
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
- Resize: drag the red corner brackets or edge bars around the clear area to fine-tune it, any time.
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
```

| Field | Value |
|---|---|
| Category | Productivity |
| Language | English |
| Store icon (128x128) | taken from the zip (`src/icons/icon128.png`); upload that file if asked |
| Screenshots (1 to 5) | your five 1280x800 files from the `store-ready` folder (run `node revlur/store/prepare-screenshots.js <folder>` first; steps in `screenshots.md`) |
| Small promo tile (440x280) | `revlur/store/promo-tile-440x280.png` |
| Marquee promo tile, video | leave empty (optional) |
| Homepage URL (if shown) | `https://revlur.app` |
| Support URL (if shown) | `https://revlur.app` (or leave empty and rely on the contact email) |
| Mature content | No |

Note: the **name** and the **summary** come from the manifest ("Revlur" and "Drag a box on any page and blur everything else. Zoom, present and read with focus. No accounts, no tracking."), so you can't type them here.

## 3. Privacy tab

**Single purpose description**
```
Revlur lets the user choose an area of the current web page and blurs the rest of the page to help them focus on, present or read that area.
```

**activeTab justification**
```
Used so that when the user clicks the Revlur icon or its keyboard shortcut, the extension can work on that one page. It also lets the extension take a snapshot of the visible tab when the user presses Zoom, so the selected area can be shown enlarged. Revlur has no access to any tab the user has not just activated it on.
```

**scripting justification**
```
Used to place Revlur's overlay (the blur, the selection outline and the small toolbar) onto the page the user activated it on. The code that is injected ships inside the extension; nothing is downloaded.
```

**storage justification**
```
Used to remember one number, the user's preferred blur level, on their own device. No other data is stored.
```

| Field | Value |
|---|---|
| Host permission justification | not shown (no host permissions are requested) |
| Are you using remote code? | **No**. All code is bundled in the package. |
| Data usage: what user data do you collect? | **Tick nothing.** Leave every data-type box empty. |
| Certification 1 (don't sell or transfer data outside approved uses) | tick |
| Certification 2 (don't use or transfer data unrelated to the single purpose) | tick |
| Certification 3 (don't use or transfer data for creditworthiness or lending) | tick |
| Privacy policy URL | `https://revlur.app/privacy.html` |

## 4. Distribution tab
| Field | Value |
|---|---|
| Visibility | **Unlisted** (decided Oct 8). Only people with the link can install it and it stays out of store search; it can be switched to Public later without a new item. It is still reviewed. |
| Regions | All regions (default) |
| Pricing | Free |

## 5. Test instructions (reviewer notes)
Sign-in required: **No**. Paste this into the additional instructions box:
```
Open any normal web page, click the Revlur icon in the toolbar (pin it from the puzzle-piece menu), and drag a rectangle. Everything outside it should blur. Drag the red corner brackets or edge bars to resize the area, and use the toolbar to try Zoom, Scroll and Re-select. Press Esc to exit. No account or sign-in is needed.
```

## 6. Account settings
- Contact email: set and verified (the listing shows `dddavid.works@gmail.com` in its text).
- Trader status: **Trader** (decided Oct 8). The store will ask for trader contact details (expect a postal address, a phone number and an email) and may verify them; for users in the EU they are shown on the listing. Have those ready, and use details you are happy to make public. Check the dashboard's own wording for exactly what it asks and where it shows it.

## 7. Submit
- [ ] Every tab shows a green check or no red warnings.
- [ ] Choose when to publish: right after approval, or "defer publishing" to release it yourself once approved.
- [ ] Click **Submit for review**. Reviews usually take a few days; a new item or a new permission can take longer.

## After approval
- [ ] Copy the store URL (https://chromewebstore.google.com/detail/...).
- [ ] Update the website: point "Add to Chrome" buttons at the store URL (while the item is Unlisted that link works for anyone who has it, so it is fine to use on the site), and change the waitlist wording ("Chrome extension · coming soon", "Join the waitlist"). Tell me and I'll do it, with the `?v=` bump.
- [ ] Email the waitlist (the privacy page promises one launch email, and deletion afterwards).
- [ ] Add the store URL to `README.md` and the launch checklist in `CLAUDE.md`.
