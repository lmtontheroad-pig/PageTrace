(function (global) {
  "use strict";

  const STORAGE_KEY = "keywordHighlighterSettings";
  const STORAGE_AREA = "sync";

  const HIGHLIGHT_CLASS = "kwh-highlight";
  const MARKER_CONTAINER_ID = "kwh-scroll-marker-container";
  const ROOT_ATTR = "data-kwh-root";
  const SKIP_SELECTOR = [
    "script",
    "style",
    "textarea",
    "input",
    "select",
    "option",
    "iframe",
    "svg",
    "canvas",
    `[${ROOT_ATTR}]`,
    `.${HIGHLIGHT_CLASS}`
  ].join(",");

  const DEFAULT_KEYWORDS = [
    { id: "kw-compilation", word: "compilation", color: "rgba(255, 20, 20, 0.6)", enabled: true },
    { id: "kw-anal", word: "anal", color: "rgba(255, 255, 0, 0.6)", enabled: true },
    { id: "kw-double-penetration", word: "Double Penetration", color: "rgba(0, 255, 255, 0.6)", enabled: true },
    { id: "kw-cuckold", word: "cuckold", color: "rgba(0, 200, 0, 0.5)", enabled: true }
  ];

  function cloneDefaultKeywords() {
    return DEFAULT_KEYWORDS.map((item) => ({ ...item }));
  }

  function normalizeKeywordText(word) {
    return String(word || "").trim().replace(/\s+/g, " ");
  }

  function generateId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return `kw-${global.crypto.randomUUID()}`;
    }
    return `kw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createKeyword(word, color) {
    return {
      id: generateId(),
      word: normalizeKeywordText(word),
      color: String(color || "rgba(255, 255, 0, 0.6)").trim(),
      enabled: true
    };
  }

  function normalizeKeywordItem(item, index) {
    const source = item && typeof item === "object" ? item : {};
    const word = normalizeKeywordText(source.word);
    if (!word) return null;

    return {
      id: String(source.id || `kw-${index}-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
      word,
      color: String(source.color || "rgba(255, 255, 0, 0.6)").trim(),
      enabled: source.enabled !== false
    };
  }

  function normalizeSettings(rawSettings) {
    const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const rawKeywords = Array.isArray(source.keywords) ? source.keywords : cloneDefaultKeywords();
    const keywords = rawKeywords
      .map(normalizeKeywordItem)
      .filter(Boolean);

    return {
      enabled: source.enabled !== false,
      keywords: keywords.length > 0 ? keywords : cloneDefaultKeywords()
    };
  }

  function getStorageArea() {
    if (global.chrome && chrome.storage && chrome.storage[STORAGE_AREA]) {
      return chrome.storage[STORAGE_AREA];
    }
    if (global.chrome && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function getSettings() {
    const area = getStorageArea();
    if (!area) return Promise.resolve(normalizeSettings());

    return new Promise((resolve) => {
      area.get([STORAGE_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn("Keyword Highlighter storage read failed:", chrome.runtime.lastError.message);
          resolve(normalizeSettings());
          return;
        }
        resolve(normalizeSettings(result[STORAGE_KEY]));
      });
    });
  }

  function saveSettings(settings) {
    const area = getStorageArea();
    const normalized = normalizeSettings(settings);
    if (!area) return Promise.resolve(normalized);

    return new Promise((resolve, reject) => {
      area.set({ [STORAGE_KEY]: normalized }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(normalized);
      });
    });
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function startsWithWordChar(value) {
    return /^[A-Za-z0-9_]/.test(value);
  }

  function endsWithWordChar(value) {
    return /[A-Za-z0-9_]$/.test(value);
  }

  function buildKeywordPattern(keyword) {
    const word = normalizeKeywordText(keyword.word);
    const tokens = word.split(/\s+/).filter(Boolean);
    const core = tokens.length > 1
      ? tokens.map(escapeRegExp).join("\\s*")
      : escapeRegExp(word);
    const leftBoundary = startsWithWordChar(word) ? "(?<![A-Za-z0-9_])" : "";
    const rightBoundary = endsWithWordChar(word) ? "(?![A-Za-z0-9_])" : "";

    return `${leftBoundary}(?:${core})${rightBoundary}`;
  }

  function compileKeywordMatcher(keywords) {
    const compiled = keywords
      .filter((keyword) => keyword.enabled !== false && normalizeKeywordText(keyword.word))
      .map((keyword) => ({
        ...keyword,
        normalizedLength: normalizeKeywordText(keyword.word).replace(/\s+/g, "").length
      }))
      .sort((a, b) => b.normalizedLength - a.normalizedLength);

    if (compiled.length === 0) return null;

    const source = compiled.map((keyword) => `(${buildKeywordPattern(keyword)})`).join("|");
    return {
      keywords: compiled,
      regex: new RegExp(source, "gi")
    };
  }

  function keywordFromMatch(match, compiledKeywords) {
    for (let index = 1; index < match.length; index += 1) {
      if (typeof match[index] === "string") {
        return compiledKeywords[index - 1] || null;
      }
    }
    return null;
  }

  global.KeywordHighlighter = {
    STORAGE_KEY,
    STORAGE_AREA,
    HIGHLIGHT_CLASS,
    MARKER_CONTAINER_ID,
    ROOT_ATTR,
    SKIP_SELECTOR,
    DEFAULT_KEYWORDS,
    cloneDefaultKeywords,
    createKeyword,
    normalizeKeywordText,
    normalizeSettings,
    getSettings,
    saveSettings,
    compileKeywordMatcher,
    keywordFromMatch
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
