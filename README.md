# Translate Display Window

A small Chrome extension for [translate.google.com](https://translate.google.com) that opens a clean, big-text "display window" of just the translated text — handy for a second monitor, a projector, or showing someone across the table what you typed.

© John Colet · [john.colet.ca](https://john.colet.ca)

## What it does

- Adds an **"Open display"** button to the bottom-right corner of the Google Translate page.
- Clicking it opens a separate popup window showing **only** the translated text — no source text, no Google interface.
- The display window updates **live** as you type or change languages.
- Big, centered, readable text on a plain background, with a **dark/light toggle** and a **font-size slider**.
- **Display auto-clear (rolling window)**: for long dictation/typing sessions, Google Translate's text only ever grows. Instead of filling the screen with an ever-longer wall of text, the display window keeps just the most recent words on screen and lets older ones drop off, on a rolling basis. Toggle on/off, adjust how many recent words to keep (10–150).
- **Source auto-clear**: Google Translate's own source box has a hard 5000-character limit, which a long dictation session will eventually hit. When this is on, once the source box reaches a set length it's cleared automatically — the same as clicking the "×" yourself — so new speech/typing keeps landing in a fresh box instead of ever hitting the wall. The display window bridges the brief gap so it still reads as one continuous feed rather than a blank flash. Toggle on/off, adjust the character threshold (500–4800, default 4000).
- **Clear source now**: a button to clear Google's source box on demand, any time you want — independent of the auto-clear threshold.
- **Chroma-key mode**: a third background option (alongside light/dark) that fills the display with a single flat, configurable color (default pure green) so you can key it out to transparent in OBS, PowerPoint, Zoom, or any tool that supports color-keying. See the note under Troubleshooting — this is not a real transparent window, just a background color meant to be keyed out by other software.
- Controls fade away after a couple of seconds so the screen stays clean, and reappear on mouse move / key press.
- A **fullscreen** button, so you can drag the window to a second monitor and fill the screen.
- If Google ever changes its page layout and the translated text can't be found, the display window shows a clear message instead of staying blank.

## Install (no developer experience needed)

1. Download this repository (Code → Download ZIP, or `git clone` it) and unzip it somewhere permanent — don't delete the folder afterward, Chrome loads the extension from it every time.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle, top-right corner).
4. Click **Load unpacked**.
5. Select the folder that directly contains `manifest.json`.
6. It will appear in the list as **"Translate Display Window"**.

## How to use it

1. Go to `https://translate.google.com` and type or paste some text. Pick your languages at the top as usual.
2. Click the blue **"Open display"** button in the bottom-right corner of the page.
3. A new window opens showing just the translation, big and centered. Keep both windows open — the display updates automatically as you keep typing or change languages.
4. Move your mouse over the display window to reveal its controls:
   - ☀️ / 🌙 / 🎨 — cycle light / dark / chroma-key background (click again to cycle back to light)
   - color swatch — pick the chroma-key color (only shown while chroma mode is active)
   - slider — change text size
   - 🔄 — display auto-clear on/off (blue = on); when on, only the newest words stay on screen
   - slider — how many recent words display auto-clear keeps on screen (10–150)
   - 🔲 (box with an X) — source auto-clear on/off (blue = on); when on, Google's own text box clears itself before it fills up
   - slider — how many characters Google's text box is allowed to reach before it auto-clears (500–4800)
   - 🗑️ — clear Google's source box right now, regardless of the threshold
   - ⛶ — fullscreen (useful after dragging the window to a second monitor)

By default, both auto-clear features are **on**: the display shows the last ~40 words, and Google's source box clears itself at 4000 characters (its hard limit is 5000). Turn either off any time if you'd rather manage it yourself.

### Using chroma-key mode in a presentation

A Chrome extension can't make a browser window frameless or genuinely see-through — that's a platform limit, not something this extension works around. What it *can* do is paint the display with one flat, solid color so your presentation or streaming software can key that color out:

1. Click the theme button until it shows the paint-swatch icon (🎨), and optionally pick a different key color with the swatch next to it.
2. In OBS: add this window as a **Window Capture** source, then add a **Chroma Key** filter set to the same color.
3. In PowerPoint: Insert → Screen Recording (or a screenshot), then **Picture Format → Color → Set Transparent Color**, and click the display's background.
4. In Zoom/other virtual-background tools: most have a "green screen" or color-key option that works the same way — point it at this window.

The title bar stays visible since the browser won't let an extension remove it; crop it out in your capture tool if needed.

## Troubleshooting

**The "Open display" button doesn't appear** — reload translate.google.com, and make sure the extension is still enabled on `chrome://extensions`.

**The display window shows an error message** — Google occasionally changes the internal layout of the Translate page. The display window is built to show a clear message in that case instead of staying blank. Try reloading translate.google.com. If it keeps happening, the extension's selectors in `content.js` need updating to match Google's new layout.

**"Clear source now" doesn't do anything** — after updating/reloading the extension, Chrome keeps running the *old* copy of `content.js` in any translate.google.com tab that was already open, so the new button has nothing on that tab to talk to yet. Reload the translate.google.com tab once after updating the extension and it'll pick up the new version.

**Source auto-clear seems to misbehave during live microphone dictation** — this feature clears Google's source box the same way clicking the "×" would, which is outside what Google officially supports doing programmatically while the mic is actively listening. In normal use it just gives speech recognition a fresh, empty box to keep filling. If you ever see odd behavior during a mic session (dropped words right at a clear, for example), turn source auto-clear off from the display window and just keep typing/dictating as before — the display's own rolling window still keeps the screen from filling up either way.

## Uninstalling

Go to `chrome://extensions`, find "Translate Display Window", and click **Remove**.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration (Manifest V3) |
| `background.js` | Opens/focuses the display popup window |
| `content.js` | Finds the translation on the page, injects the button |
| `content.css` | Styling for the injected button |
| `display.html` | The popup display window |
| `display.css` | Styling for the display window |
| `display.js` | Live updates, theme toggle, font slider, fullscreen |
| `icons/` | Extension icons (16/32/48/128 px) |
