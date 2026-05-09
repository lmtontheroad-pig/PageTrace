(function () {
  "use strict";

  const helper = window.KeywordHighlighter;
  const TEXT_NODE = Node.TEXT_NODE;
  const ELEMENT_NODE = Node.ELEMENT_NODE;
  const OBSERVER_OPTIONS = {
    childList: true,
    subtree: true,
    characterData: true
  };

  let settings = helper.normalizeSettings();
  let matcher = null;
  let observer = null;
  let observerActive = false;
  let scanTimer = null;
  let markerTimer = null;
  let queuedRoots = new Set();

  function isElement(node) {
    return node && node.nodeType === ELEMENT_NODE;
  }

  function isText(node) {
    return node && node.nodeType === TEXT_NODE;
  }

  function closestSkippableElement(node) {
    const element = isElement(node) ? node : node && node.parentElement;
    return element ? element.closest(helper.SKIP_SELECTOR) : null;
  }

  function isOwnNode(node) {
    if (!node) return false;
    if (isElement(node)) {
      return Boolean(node.closest(`[${helper.ROOT_ATTR}], .${helper.HIGHLIGHT_CLASS}`));
    }
    return Boolean(node.parentElement && node.parentElement.closest(`[${helper.ROOT_ATTR}], .${helper.HIGHLIGHT_CLASS}`));
  }

  function normalizeScanRoot(root) {
    if (!root) return document.body || document.documentElement;
    if (isText(root)) return root.parentNode;
    return root;
  }

  function connectObserver() {
    if (!settings.enabled || observerActive || !document.body) return;
    if (!observer) observer = new MutationObserver(handleMutations);
    observer.observe(document.body, OBSERVER_OPTIONS);
    observerActive = true;
  }

  function disconnectObserver() {
    if (!observer || !observerActive) return;
    observer.disconnect();
    observerActive = false;
  }

  function runWithoutObserver(callback) {
    const shouldReconnect = observerActive;
    disconnectObserver();
    try {
      callback();
    } finally {
      if (shouldReconnect && settings.enabled) connectObserver();
    }
  }

  function acceptTextNode(node) {
    if (!matcher || !node.nodeValue || !node.nodeValue.trim()) {
      return NodeFilter.FILTER_SKIP;
    }
    if (!node.parentElement || closestSkippableElement(node)) {
      return NodeFilter.FILTER_REJECT;
    }

    matcher.regex.lastIndex = 0;
    const matched = matcher.regex.test(node.nodeValue);
    matcher.regex.lastIndex = 0;
    return matched ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  }

  function highlightTextNode(node) {
    const originalText = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let didMatch = false;
    let match;

    matcher.regex.lastIndex = 0;
    while ((match = matcher.regex.exec(originalText)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.index)));
      }

      const keyword = helper.keywordFromMatch(match, matcher.keywords);
      if (keyword) {
        const span = document.createElement("span");
        span.className = helper.HIGHLIGHT_CLASS;
        span.dataset.kwhKeywordId = keyword.id;
        span.dataset.kwhKeyword = keyword.word;
        span.style.backgroundColor = keyword.color;
        span.textContent = match[0];
        fragment.appendChild(span);
        didMatch = true;
      } else {
        fragment.appendChild(document.createTextNode(match[0]));
      }

      lastIndex = matcher.regex.lastIndex;
      if (match.index === matcher.regex.lastIndex) matcher.regex.lastIndex += 1;
    }

    if (!didMatch) return;
    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  }

  function highlightTextNodes(rootNode) {
    const root = normalizeScanRoot(rootNode);
    if (!root || !root.isConnected || closestSkippableElement(root)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: acceptTextNode
    });
    const nodesToReplace = [];

    while (walker.nextNode()) {
      nodesToReplace.push(walker.currentNode);
    }

    nodesToReplace.forEach((node) => {
      if (node.isConnected && !closestSkippableElement(node)) {
        highlightTextNode(node);
      }
    });
  }

  function clearHighlights() {
    const spans = Array.from(document.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}`));
    spans.forEach((span) => {
      const parent = span.parentNode;
      span.replaceWith(document.createTextNode(span.textContent || ""));
      if (parent && typeof parent.normalize === "function") parent.normalize();
    });
  }

  function getMarkerContainer() {
    let container = document.getElementById(helper.MARKER_CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = helper.MARKER_CONTAINER_ID;
      container.setAttribute(helper.ROOT_ATTR, "true");
      document.documentElement.appendChild(container);
    }
    return container;
  }

  function clearMarkers() {
    const container = document.getElementById(helper.MARKER_CONTAINER_ID);
    if (container) container.remove();
  }

  function documentHeight() {
    return Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
  }

  function regenerateMarkers() {
    if (!settings.enabled) {
      clearMarkers();
      return;
    }

    const totalHeight = documentHeight();
    if (totalHeight <= window.innerHeight) {
      clearMarkers();
      return;
    }

    const highlights = Array.from(document.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}`));
    const container = getMarkerContainer();
    const fragment = document.createDocumentFragment();

    highlights.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const top = Math.max(0, window.scrollY + rect.top);
      const topPercent = Math.min(99.8, (top / totalHeight) * 100);
      const marker = document.createElement("div");
      marker.className = "kwh-scroll-marker";
      marker.style.top = `${topPercent}%`;
      marker.style.backgroundColor = element.style.backgroundColor || "rgba(255, 255, 0, 0.7)";
      fragment.appendChild(marker);
    });

    container.replaceChildren(fragment);
  }

  function collectStats() {
    const countsById = new Map();
    document.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}`).forEach((span) => {
      const keywordId = span.dataset.kwhKeywordId || "";
      countsById.set(keywordId, (countsById.get(keywordId) || 0) + 1);
    });

    const keywords = settings.keywords.map((keyword) => ({
      id: keyword.id,
      word: keyword.word,
      color: keyword.color,
      enabled: keyword.enabled !== false,
      count: countsById.get(keyword.id) || 0
    }));

    return {
      enabled: settings.enabled,
      total: keywords.reduce((sum, keyword) => sum + keyword.count, 0),
      keywords
    };
  }

  function runQueuedScan() {
    const roots = Array.from(queuedRoots);
    queuedRoots = new Set();
    clearTimeout(scanTimer);
    scanTimer = null;

    if (!settings.enabled || !matcher) {
      regenerateMarkers();
      return;
    }

    runWithoutObserver(() => {
      const effectiveRoots = roots.length > 0 ? roots : [document.body];
      const shouldScanBody = effectiveRoots.some((root) => root === document.body || root === document.documentElement);
      if (shouldScanBody) {
        highlightTextNodes(document.body);
      } else {
        effectiveRoots.forEach((root) => highlightTextNodes(root));
      }
      regenerateMarkers();
    });
  }

  function scheduleScan(root) {
    const normalizedRoot = normalizeScanRoot(root);
    if (normalizedRoot) queuedRoots.add(normalizedRoot);
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runQueuedScan, 250);
  }

  function scheduleMarkerRefresh() {
    clearTimeout(markerTimer);
    markerTimer = setTimeout(() => {
      markerTimer = null;
      runWithoutObserver(regenerateMarkers);
    }, 150);
  }

  function mutationHasRelevantAddedNode(mutation) {
    for (const node of mutation.addedNodes) {
      if (!isOwnNode(node)) return true;
    }
    return false;
  }

  function handleMutations(mutations) {
    if (!settings.enabled) return;

    let shouldRefreshMarkers = false;
    for (const mutation of mutations) {
      if (isOwnNode(mutation.target)) continue;

      if (mutation.type === "characterData") {
        scheduleScan(mutation.target.parentNode);
        shouldRefreshMarkers = true;
        continue;
      }

      if (mutation.type !== "childList") continue;
      if (mutation.removedNodes.length > 0) shouldRefreshMarkers = true;
      if (!mutationHasRelevantAddedNode(mutation)) continue;

      mutation.addedNodes.forEach((node) => {
        if (isOwnNode(node)) return;
        if (isText(node)) {
          scheduleScan(node.parentNode);
        } else if (isElement(node) && !closestSkippableElement(node)) {
          scheduleScan(node);
        }
      });
    }

    if (shouldRefreshMarkers) scheduleMarkerRefresh();
  }

  function applySettings(nextSettings, options = {}) {
    settings = helper.normalizeSettings(nextSettings);
    matcher = helper.compileKeywordMatcher(settings.keywords);

    clearTimeout(scanTimer);
    clearTimeout(markerTimer);
    scanTimer = null;
    markerTimer = null;
    queuedRoots = new Set();

    runWithoutObserver(() => {
      clearHighlights();
      clearMarkers();
      if (settings.enabled) {
        highlightTextNodes(document.body);
        regenerateMarkers();
      }
    });

    if (settings.enabled) {
      connectObserver();
      if (options.delayed) scheduleScan(document.body);
    } else {
      disconnectObserver();
    }
  }

  function updateStoredEnabled(enabled) {
    return helper.getSettings()
      .then((storedSettings) => helper.saveSettings({ ...storedSettings, enabled }))
      .then((savedSettings) => {
        applySettings(savedSettings);
        return collectStats();
      });
  }

  function forceRescan() {
    return helper.getSettings().then((storedSettings) => {
      applySettings(storedSettings);
      return collectStats();
    });
  }

  function bindMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const type = message && message.type;
      if (!type || !type.startsWith("KWH_")) return false;

      Promise.resolve()
        .then(() => {
          if (type === "KWH_GET_STATS") return collectStats();
          if (type === "KWH_ENABLE") return updateStoredEnabled(true);
          if (type === "KWH_DISABLE") return updateStoredEnabled(false);
          if (type === "KWH_RESCAN") return forceRescan();
          return collectStats();
        })
        .then((payload) => sendResponse({ ok: true, payload }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));

      return true;
    });
  }

  function bindStorageChanges() {
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes[helper.STORAGE_KEY]) return;
      applySettings(changes[helper.STORAGE_KEY].newValue);
    });
  }

  function init() {
    bindMessages();
    bindStorageChanges();
    helper.getSettings()
      .then((storedSettings) => {
        applySettings(storedSettings, { delayed: true });
      })
      .catch((error) => {
        console.warn("Keyword Highlighter failed to start:", error);
      });

    window.addEventListener("resize", scheduleMarkerRefresh, { passive: true });
    window.addEventListener("load", scheduleMarkerRefresh, { once: true });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
