// Runs on translate.google.com. Finds the translated-text panel, mirrors
// its content into chrome.storage.local so the separate display window can
// show it live, and injects the "Open display" button.
(function () {
  "use strict";

  const STORAGE_KEY = "tdwState";
  const SETTINGS_KEY = "tdwSettings";
  const NOT_FOUND_GRACE_MS = 2500;
  const POLL_INTERVAL_MS = 400;
  const SOURCE_CLEAR_SUPPRESS_MS = 6000;

  let lastWrittenText = null;
  let lastWrittenStatus = null;
  let outputMissingSince = null;
  let lastOkState = null;
  let suppressIdleUntil = 0;

  // --- Auto-clear the source box once it gets long -------------------------
  // Google Translate caps the source box at 5000 characters, and during a
  // long dictation session it only ever grows toward that cap. When enabled,
  // once it crosses the configured threshold we clear it (the same way a
  // real user clicking the "x" would) so new speech/typing keeps landing in
  // a fresh box instead of eventually hitting the hard limit. The display
  // window bridges the brief gap (see suppressIdleUntil below) so this reads
  // as a seamless reset rather than a blank flash.

  let autoClear = { enabled: true, threshold: 4000 };

  function applyAutoClearSettings(settings) {
    const s = settings || {};
    autoClear = {
      enabled: s.sourceAutoClearEnabled !== false,
      threshold:
        typeof s.sourceAutoClearChars === "number" ? s.sourceAutoClearChars : 4000,
    };
  }

  chrome.storage.local.get(SETTINGS_KEY, (res) => applyAutoClearSettings(res[SETTINGS_KEY]));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SETTINGS_KEY]) {
      applyAutoClearSettings(changes[SETTINGS_KEY].newValue);
    }
  });

  function getSourceTextarea() {
    return (
      document.querySelector('textarea[aria-label="Source text"]') ||
      document.querySelector('textarea[jsname="BJE2fc"]')
    );
  }

  function clearSourceTextarea(ta) {
    // A plain `ta.value = ""` doesn't notify Google's own JS framework.
    // Using the native setter + a real "input" event is the standard way
    // to change a framework-controlled field from a content script so the
    // page's own code (character counter, translation call) picks it up.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setter.call(ta, "");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function performClear(sourceEl) {
    if (!sourceEl) return;
    suppressIdleUntil = Date.now() + SOURCE_CLEAR_SUPPRESS_MS;
    clearSourceTextarea(sourceEl);
  }

  function checkAutoClear(sourceEl) {
    if (!autoClear.enabled || !sourceEl) return;
    if (sourceEl.value.length >= autoClear.threshold) {
      performClear(sourceEl);
    }
  }

  // Manual clear, triggered by the "Clear source" button in the display
  // window (it has no DOM access of its own, so it messages us instead).
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "CLEAR_SOURCE") {
      performClear(getSourceTextarea());
    }
  });

  // --- Element lookup -----------------------------------------------------
  // Google Translate's internal class names are rebuilt often, so we try
  // several strategies, from most to least specific, before giving up.

  function getSourceText() {
    const el = getSourceTextarea();
    return el ? el.value : "";
  }

  function getOutputText() {
    // 1) The visible translated-text span Google currently uses.
    let el = document.querySelector('span[jsname="jqKxS"]');
    if (el && el.innerText && el.innerText.trim()) {
      return el.innerText.trim();
    }

    // 2) The hidden textarea mirror used for copy/accessibility.
    el = document.querySelector('textarea[jsname="YPqjbf"]');
    if (el && el.value && el.value.trim()) {
      return el.value.trim();
    }

    // 3) Fall back to searching inside the result region for any element
    //    whose lang differs from the page UI language and has text, while
    //    excluding the known source textarea.
    const region =
      document.querySelector('[jsname="e79Xi"]') ||
      document.querySelector('c-wiz[role="region"]');
    if (region) {
      const candidates = region.querySelectorAll("[lang]");
      for (const cand of candidates) {
        if (cand.tagName === "TEXTAREA") continue;
        const text = cand.innerText && cand.innerText.trim();
        if (text) return text;
      }
    }

    return null; // genuinely not found
  }

  function buildState() {
    const sourceText = getSourceText().trim();
    const outputText = getOutputText();
    const now = Date.now();

    if (outputText !== null) {
      outputMissingSince = null;
      lastOkState = { status: "ok", text: outputText, updatedAt: now };
      return lastOkState;
    }

    if (!sourceText) {
      outputMissingSince = null;
      // Bridge the brief gap right after an auto-clear: keep showing the
      // last real translation instead of flashing to "idle" while the next
      // bit of speech/typing is still arriving.
      if (lastOkState && now < suppressIdleUntil) {
        return lastOkState;
      }
      return {
        status: "idle",
        text: "",
        message: "Type something on the Google Translate page to see it here.",
        updatedAt: now,
      };
    }

    // There is source text but no output element could be located yet. If
    // we're still inside the post-auto-clear grace window, keep showing the
    // last translation rather than flashing a "Translating…" message while
    // the next chunk catches up.
    if (lastOkState && now < suppressIdleUntil) {
      return lastOkState;
    }

    // Otherwise, give it a short grace period (translation may just be
    // loading) before reporting a broken-layout error.
    if (outputMissingSince === null) outputMissingSince = now;
    if (now - outputMissingSince < NOT_FOUND_GRACE_MS) {
      return { status: "loading", text: "", updatedAt: now };
    }

    return {
      status: "error",
      text: "",
      message:
        "Couldn't find the translated text on this page. Google may have changed its layout. Try reloading translate.google.com.",
      updatedAt: now,
    };
  }

  function syncState() {
    checkAutoClear(getSourceTextarea());
    const state = buildState();
    if (state.status === lastWrittenStatus && state.text === lastWrittenText) {
      return; // nothing changed, avoid needless storage writes/flicker
    }
    lastWrittenStatus = state.status;
    lastWrittenText = state.text;
    chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  // --- Watch for changes ---------------------------------------------------

  let debounceTimer = null;
  function scheduleSync() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncState, 150);
  }

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Backstop poll in case Google ever updates text in a way mutations miss.
  setInterval(syncState, POLL_INTERVAL_MS);
  syncState();

  // --- Inject the "Open display" button ------------------------------------

  function injectButton() {
    if (document.getElementById("tdw-open-display-btn")) return;

    const btn = document.createElement("button");
    btn.id = "tdw-open-display-btn";
    btn.type = "button";
    btn.title = "Open a big, live display window of the translation";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="3" y="4" width="18" height="12" rx="1.5" stroke="white" stroke-width="2"/>' +
      '<path d="M8 20h8M12 16v4" stroke="white" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>" +
      '<span class="tdw-label">Open display</span>';

    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_DISPLAY" });
    });

    document.documentElement.appendChild(btn);
  }

  injectButton();
  // Google re-renders parts of the page; make sure our button survives.
  setInterval(injectButton, 2000);
})();
