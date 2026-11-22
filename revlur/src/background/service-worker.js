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
  if (msg?.type === 'revlur:rate' || msg?.type === 'revlur:feedback') {
    const url = msg.type === 'revlur:rate' ? REVIEWS_URL : FEEDBACK_URL;
    chrome.tabs.create({ url, index: sender.tab ? sender.tab.index + 1 : undefined });
    return;
  }
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

// Feedback without in-page UI: right-click the toolbar icon for "Rate" and
// "Send feedback"; uninstalling opens a short feedback page on the website.
const CHROME_REVIEWS_URL = 'https://chromewebstore.google.com/detail/revlur/oclgenhjbbilkndhgnfbgcdlkkgcmjbm/reviews';
// Edge Add-ons listing. Fill in once Partner Center shows the listing URL
// (https://microsoftedge.microsoft.com/addons/detail/<id>); until then Edge users get the feedback page.
const EDGE_REVIEWS_URL = '';
// Edge's user agent carries "Edg/" (Chrome's never does), also inside the service worker.
const IS_EDGE = /\bEdg\//.test(navigator.userAgent);
const FEEDBACK_URL = 'https://revlur.app/feedback.html';
const REVIEWS_URL = IS_EDGE ? EDGE_REVIEWS_URL || FEEDBACK_URL : CHROME_REVIEWS_URL;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'revlur:rate', title: '★ Rate Revlur', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'revlur:feedback', title: 'Send feedback', contexts: ['action'] });
  });
  chrome.runtime.setUninstallURL(`${FEEDBACK_URL}?uninstalled`);
});

chrome.contextMenus.onClicked.addListener(({ menuItemId }) => {
  if (menuItemId === 'revlur:rate') chrome.tabs.create({ url: REVIEWS_URL });
  else if (menuItemId === 'revlur:feedback') chrome.tabs.create({ url: FEEDBACK_URL });
});
