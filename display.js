(function () {
  "use strict";

  const STATE_KEY = "tdwState";
  const SETTINGS_KEY = "tdwSettings";
  const HIDE_DELAY_MS = 2500;

  const textEl = document.getElementById("text");
  const controlsEl = document.getElementById("controls");
  const creditEl = document.getElementById("credit");
  const themeBtn = document.getElementById("theme-toggle");
  const iconSun = document.getElementById("icon-sun");
  const iconMoon = document.getElementById("icon-moon");
  const iconChroma = document.getElementById("icon-chroma");
  const chromaColorGroup = document.getElementById("chroma-color-group");
  const chromaColorPicker = document.getElementById("chroma-color-picker");
  const fontSlider = document.getElementById("font-slider");
  const rollingToggle = document.getElementById("rolling-toggle");
  const wordsSlider = document.getElementById("words-slider");
  const sourceClearToggle = document.getElementById("source-clear-toggle");
  const charsSlider = document.getElementById("chars-slider");
  const clearSourceBtn = document.getElementById("clear-source-btn");
  const fullscreenBtn = document.getElementById("fullscreen-toggle");

  const THEME_CYCLE = ["light", "dark", "chroma"];

  const DEFAULT_SETTINGS = {
    theme: "light",
    fontSize: 64,
    rollingEnabled: true,
    rollingWords: 40,
    // Read by content.js on the Google Translate tab, not used here directly,
    // but kept in the same settings object so there's one place to edit both.
    sourceAutoClearEnabled: true,
    sourceAutoClearChars: 4000,
    chromaColor: "#00ff00",
  };

  let currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  let lastState = null;

  // --- Rolling window ---------------------------------------------------
  // Google re-translates the whole, ever-growing source text, so the
  // translation itself never stops getting longer during a long dictation
  // session. Rather than touching Google's own text box (which could
  // interrupt an active mic session), we just keep the LATEST N words on
  // screen here and let older ones drop off as new ones arrive.

  function rollingSlice(fullText, maxWords) {
    const trimmed = fullText.trim();
    if (!trimmed) return trimmed;
    const words = trimmed.split(/\s+/);
    if (words.length <= maxWords) return trimmed;

    const tail = words.slice(-maxWords).join(" ");
    // Prefer starting right after a sentence end, if there is one early
    // enough in the window, so the trim looks natural rather than abrupt.
    const boundary = /[.!?][)"'”’]?\s+/.exec(tail);
    if (boundary && boundary.index < tail.length * 0.4) {
      return tail.slice(boundary.index + boundary[0].length).trim();
    }
    return tail;
  }

  // --- Render translation state --------------------------------------------

  function renderText() {
    const state = lastState;
    if (!state) {
      textEl.textContent = "Waiting for a translation…";
      textEl.className = "state-idle";
      return;
    }
    switch (state.status) {
      case "ok": {
        const text = currentSettings.rollingEnabled
          ? rollingSlice(state.text, currentSettings.rollingWords)
          : state.text;
        textEl.textContent = text;
        textEl.className = "state-ok";
        break;
      }
      case "idle":
        textEl.textContent = state.message || "Type something to translate.";
        textEl.className = "state-idle";
        break;
      case "loading":
        textEl.textContent = "Translating…";
        textEl.className = "state-loading";
        break;
      case "error":
        textEl.textContent =
          state.message || "Couldn't find the translated text on this page.";
        textEl.className = "state-error";
        break;
      default:
        textEl.textContent = "Waiting for a translation…";
        textEl.className = "state-idle";
    }
    if (textEl.classList.contains("state-ok")) {
      textEl.style.fontSize = currentSettings.fontSize + "px";
    } else {
      textEl.style.fontSize = "";
    }
  }

  function render(state) {
    lastState = state;
    renderText();
  }

  chrome.storage.local.get(STATE_KEY, (res) => render(res[STATE_KEY]));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STATE_KEY]) render(changes[STATE_KEY].newValue);
    if (changes[SETTINGS_KEY]) applySettings(changes[SETTINGS_KEY].newValue);
  });

  // --- Settings (theme / font size / rolling window), persisted ------------

  // Rough perceived brightness, used only to decide whether the chroma
  // background needs black or white text/controls on top of it.
  function isLightColor(hex) {
    const n = hex.replace("#", "");
    const r = parseInt(n.substr(0, 2), 16);
    const g = parseInt(n.substr(2, 2), 16);
    const b = parseInt(n.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  }

  function applySettings(settings) {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS, settings || {});

    const theme = THEME_CYCLE.includes(currentSettings.theme)
      ? currentSettings.theme
      : "light";
    document.documentElement.setAttribute("data-theme", theme);
    iconSun.style.display = theme === "light" ? "block" : "none";
    iconMoon.style.display = theme === "dark" ? "block" : "none";
    iconChroma.style.display = theme === "chroma" ? "block" : "none";

    chromaColorGroup.style.display = theme === "chroma" ? "flex" : "none";
    chromaColorPicker.value = currentSettings.chromaColor;
    if (theme === "chroma") {
      const fg = isLightColor(currentSettings.chromaColor) ? "#111111" : "#ffffff";
      document.documentElement.style.setProperty("--bg", currentSettings.chromaColor);
      document.documentElement.style.setProperty("--fg", fg);
      document.documentElement.style.setProperty("--muted", fg);
    } else {
      document.documentElement.style.removeProperty("--bg");
      document.documentElement.style.removeProperty("--fg");
      document.documentElement.style.removeProperty("--muted");
    }

    fontSlider.value = String(currentSettings.fontSize);
    wordsSlider.value = String(currentSettings.rollingWords);
    rollingToggle.classList.toggle("active", currentSettings.rollingEnabled);
    rollingToggle.title = currentSettings.rollingEnabled
      ? "Display auto-clear is ON — only the latest words stay on screen. Click to turn off."
      : "Display auto-clear is OFF — the full translation stays on screen. Click to turn on.";

    charsSlider.value = String(currentSettings.sourceAutoClearChars);
    sourceClearToggle.classList.toggle("active", currentSettings.sourceAutoClearEnabled);
    sourceClearToggle.title = currentSettings.sourceAutoClearEnabled
      ? "Source auto-clear is ON — Google's text box clears itself at " +
        currentSettings.sourceAutoClearChars +
        " characters so it never hits the 5000 limit. Click to turn off."
      : "Source auto-clear is OFF — Google's text box will keep growing toward its 5000-character limit. Click to turn on.";

    renderText();
  }

  function saveSettings(partial) {
    chrome.storage.local.get(SETTINGS_KEY, (res) => {
      const next = Object.assign(
        {},
        DEFAULT_SETTINGS,
        res[SETTINGS_KEY] || {},
        partial
      );
      chrome.storage.local.set({ [SETTINGS_KEY]: next });
      applySettings(next);
    });
  }

  chrome.storage.local.get(SETTINGS_KEY, (res) => applySettings(res[SETTINGS_KEY]));

  themeBtn.addEventListener("click", () => {
    const idx = THEME_CYCLE.indexOf(currentSettings.theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    saveSettings({ theme: next });
  });

  chromaColorPicker.addEventListener("input", () => {
    saveSettings({ chromaColor: chromaColorPicker.value });
  });

  fontSlider.addEventListener("input", () => {
    saveSettings({ fontSize: Number(fontSlider.value) });
  });

  rollingToggle.addEventListener("click", () => {
    saveSettings({ rollingEnabled: !currentSettings.rollingEnabled });
  });

  wordsSlider.addEventListener("input", () => {
    saveSettings({ rollingWords: Number(wordsSlider.value) });
  });

  sourceClearToggle.addEventListener("click", () => {
    saveSettings({ sourceAutoClearEnabled: !currentSettings.sourceAutoClearEnabled });
  });

  charsSlider.addEventListener("input", () => {
    saveSettings({ sourceAutoClearChars: Number(charsSlider.value) });
  });

  // Manual clear, independent of the auto-clear threshold. content.js (on
  // the Google Translate tab) listens for this message and does the actual
  // clearing — this window has no access to that page's DOM itself. There's
  // no way to confirm the text actually got cleared from here, but we CAN
  // show whether the message reached a listening tab at all, which is the
  // single most useful thing to know when troubleshooting this button.
  function flashClearButton(ok) {
    clearSourceBtn.classList.remove("flash-ok", "flash-fail");
    // Force reflow so the animation restarts on repeated clicks.
    void clearSourceBtn.offsetWidth;
    clearSourceBtn.classList.add(ok ? "flash-ok" : "flash-fail");
  }

  clearSourceBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_SOURCE" }, () => {
      // No Translate tab open/listening: lastError is set but harmless —
      // this just tells us whether anyone was there to receive it.
      flashClearButton(!chrome.runtime.lastError);
    });
  });

  // --- Fullscreen -----------------------------------------------------------

  fullscreenBtn.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  // --- Auto-hide controls ----------------------------------------------------

  let hideTimer = null;

  function showControls() {
    controlsEl.classList.remove("hidden");
    creditEl.classList.remove("hidden");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      controlsEl.classList.add("hidden");
      creditEl.classList.add("hidden");
    }, HIDE_DELAY_MS);
  }

  ["mousemove", "mousedown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, showControls, { passive: true });
  });

  showControls();
})();
