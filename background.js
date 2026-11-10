// Background service worker: owns the display popup window.
// Content scripts cannot call chrome.windows.create() directly, so the
// button in the page asks us to do it, and we keep track of the single
// display window so a second click just refocuses it instead of opening
// a duplicate.

let displayWindowId = null;

chrome.windows.onRemoved.addListener((closedId) => {
  if (closedId === displayWindowId) {
    displayWindowId = null;
  }
});

async function openOrFocusDisplayWindow() {
  if (displayWindowId !== null) {
    try {
      const win = await chrome.windows.get(displayWindowId);
      if (win) {
        await chrome.windows.update(displayWindowId, { focused: true });
        return;
      }
    } catch (e) {
      // Window no longer exists; fall through and create a new one.
      displayWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("display.html"),
    type: "popup",
    width: 900,
    height: 600,
  });
  displayWindowId = win.id;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "OPEN_DISPLAY") {
    openOrFocusDisplayWindow().then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
  return false;
});
