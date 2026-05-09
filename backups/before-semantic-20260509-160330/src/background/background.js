importScripts("../shared/shared.js");

chrome.runtime.onInstalled.addListener(() => {
  globalThis.KeywordHighlighter.getSettings()
    .then((settings) => globalThis.KeywordHighlighter.saveSettings(settings))
    .catch((error) => {
      console.warn("Keyword Highlighter initialization failed:", error);
    });
});
