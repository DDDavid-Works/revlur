// Revlur service worker: toggles the tool on the active tab.
// No popup; clicking the icon (or the user-assigned shortcut) fires onClicked.

const CONTENT_JS = ['src/content/geometry.js', 'src/content/content.js'];
const CONTENT_CSS = 'src/content/content.css';

let cssPromise = null;
function loadCss() {
  cssPromise ??= fetch(chrome.runtime.getURL(CONTENT_CSS)).then((r) => r.text());
  return cssPromise;
}

async function flagUnavailable(tabId) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6b7280' });
  await chrome.action.setBadgeText({ tabId, text: '×' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 1500);
}

// Zoom needs a pixel snapshot of the visible tab; only the service worker can take one.
// Allowed by the activeTab grant from the icon click or shortcut.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'revlur:capture' || sender.tab?.windowId == null) return;
  chrome.tabs
    .captureVisibleTab(sender.tab.windowId, { format: 'png' })
    .then((dataUrl) => sendResponse({ dataUrl }))
    .catch((err) => sendResponse({ error: String(err) }));
  return true; // respond asynchronously
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  const toggle = async () => chrome.tabs.sendMessage(tab.id, { type: 'revlur:toggle', css: await loadCss() });
  try {
    try {
      // Fast path: the script is already in the page, so just toggle it.
      await toggle();
    } catch {
      // Not injected yet (or left over from before an extension reload): inject, then toggle.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_JS });
      await toggle();
    }
  } catch {
    // Restricted pages (chrome://, Web Store, PDF viewer, ...): fail quietly.
    flagUnavailable(tab.id);
  }
});
