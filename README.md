# Revlur

Select an area of any web page and everything else gets blurred. Zoom, present and read with focus. No accounts, no tracking.

- **Install:** [Revlur on the Chrome Web Store](https://chromewebstore.google.com/detail/revlur/oclgenhjbbilkndhgnfbgcdlkkgcmjbm)
- **Website:** https://revlur.app
- **Privacy policy:** https://revlur.app/privacy.html
- **Contact:** dddavid.works@gmail.com

## Repository

| Folder | What it is |
|---|---|
| `revlur/` | The Chrome extension (Manifest V3, no dependencies, no build step). Notes and decisions are in `revlur/CLAUDE.md`. |
| `website/` | The landing site served at revlur.app (static files). |
| `website-waitlist/` | The earlier pre-launch version of the site, kept as history. |
| `promo/` | Tooling for the promo GIF. |

## Development

```
cd revlur
npm test          # geometry unit tests
npm run package   # builds dist/revlur-<version>.zip for the Web Store
```

To try the extension locally: `chrome://extensions` > Developer mode > Load unpacked > choose the `revlur` folder.
