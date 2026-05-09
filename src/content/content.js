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
  const SEMANTIC_CONTAINER_SELECTOR = [
    "[data-video-id]",
    "[data-video-vkey]",
    "li.pcVideoListItem",
    "li.videoblock",
    "div.videoblock",
    ".pcVideoListItem",
    ".videoBox"
  ].join(",");
  const SEMANTIC_SKIP_CONTAINER_SELECTOR = [
    "header",
    "nav",
    "footer",
    "[role='navigation']",
    "[class*='menu']",
    "[class*='nav']",
    "[class*='dropdown']",
    "[class*='category']"
  ].join(",");
  const SEMANTIC_TITLE_SELECTOR = [
    "h1",
    "h2",
    "h3",
    "a[title]",
    "a[aria-label]",
    "[class*='title']"
  ].join(",");
  const SEMANTIC_TAG_SELECTOR = [
    "a[href*='/tags/']",
    "a[href*='tag=']",
    "[class*='tag'] a",
    "[class*='tags'] a"
  ].join(",");
  const SEMANTIC_CATEGORY_SELECTOR = [
    "a[href*='/categories/']",
    "a[href*='/category/']",
    "a[href*='?c=']",
    "a[href*='&c=']",
    "[class*='category'] a",
    "[class*='categories'] a"
  ].join(",");
  const SEMANTIC_CHANNEL_SELECTOR = [
    "a[href*='/channels/']",
    "a[href*='/channel/']",
    "a[href*='/model/']",
    "a[href*='/pornstar/']",
    "[class*='channel'] a",
    "[class*='model'] a",
    "[class*='pornstar'] a"
  ].join(",");
  const SEMANTIC_PLAYLIST_SELECTOR = [
    "a[href*='/playlist/']",
    "a[href*='/playlists/']",
    "[class*='playlist'] a"
  ].join(",");
  const MARKER_HOVER_CLASS = "kwh-marker-target-hover";

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

    const matched = helper.collectKeywordMatches(node.nodeValue, matcher).length > 0;
    return matched ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  }

  function highlightTextNode(node) {
    const originalText = node.nodeValue;
    const matches = helper.collectKeywordMatches(originalText, matcher);
    if (matches.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.start)));
      }

      const keyword = match.keyword;
      if (keyword) {
        const span = document.createElement("span");
        span.className = helper.HIGHLIGHT_CLASS;
        span.dataset.kwhKeywordId = keyword.id;
        span.dataset.kwhKeyword = keyword.word;
        span.dataset.kwhKeywordPriority = String(keyword.priority || 0);
        span.dataset.kwhMatchLength = String(match.length);
        if (match.extraKeywords.length > 0) {
          span.dataset.kwhExtraKeywordIds = match.extraKeywords.map((item) => item.id).join(",");
        }
        span.style.backgroundColor = keyword.color;
        span.textContent = match.text;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(match.text));
      }

      lastIndex = match.end;
    });

    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  }

  function highlightSemanticTextNode(node, semanticMatcher) {
    const originalText = node.nodeValue;
    const matches = helper.collectKeywordMatches(originalText, semanticMatcher);
    if (matches.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      if (match.start > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.start)));
      }

      const semanticPhrase = match.keyword;
      const span = document.createElement("span");
      span.className = helper.HIGHLIGHT_CLASS;
      span.dataset.kwhSemanticPhrase = "true";
      span.dataset.kwhSemanticRuleId = semanticPhrase.semanticRuleId || "";
      span.dataset.kwhSemanticRuleName = semanticPhrase.semanticRuleName || "";
      span.dataset.kwhSemanticPhraseText = semanticPhrase.word || "";
      span.style.backgroundColor = semanticPhrase.color;
      span.textContent = match.text;
      fragment.appendChild(span);

      lastIndex = match.end;
    });

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

  function clearSemanticPhraseHighlights(rootNode) {
    const root = rootNode && rootNode.querySelectorAll ? rootNode : document;
    const spans = Array.from(root.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}[data-kwh-semantic-phrase="true"]`));
    spans.forEach((span) => {
      const parent = span.parentNode;
      span.replaceWith(document.createTextNode(span.textContent || ""));
      if (parent && typeof parent.normalize === "function") parent.normalize();
    });
  }

  function hasEnabledSemanticRules() {
    return Array.isArray(settings.semanticRules)
      && settings.semanticRules.some((rule) => rule.enabled !== false);
  }

  function closestSemanticContainer(node) {
    const element = isElement(node) ? node : node && node.parentElement;
    if (!element) return null;
    const container = element.closest(SEMANTIC_CONTAINER_SELECTOR);
    return isSemanticContainerAllowed(container) ? container : null;
  }

  function isSemanticContainerAllowed(container) {
    if (!container || isOwnNode(container) || closestSkippableElement(container)) return false;
    if (container.closest(SEMANTIC_SKIP_CONTAINER_SELECTOR)) return false;

    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      if (rect.width > viewportWidth * 0.7) return false;
      if (rect.height > 700) return false;
    }

    return true;
  }

  function textFromElement(element) {
    if (!element) return "";
    return [
      element.getAttribute("title") || "",
      element.getAttribute("aria-label") || "",
      element.textContent || ""
    ].join(" ");
  }

  function urlToSignal(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return decodeURIComponent([
        url.pathname,
        url.search
      ].join(" "))
        .replace(/[/?=&_+-]+/g, " ");
    } catch (error) {
      return String(value).replace(/[/?=&_+-]+/g, " ");
    }
  }

  function addUniqueText(target, value) {
    const text = String(value || "").trim();
    if (!text || target.includes(text)) return;
    target.push(text);
  }

  function collectTexts(container, selector) {
    const values = [];
    container.querySelectorAll(selector).forEach((element) => {
      addUniqueText(values, textFromElement(element));
    });
    return values;
  }

  function collectUrls(container) {
    const values = [];
    if (container.href) addUniqueText(values, urlToSignal(container.href));
    container.querySelectorAll("a[href]").forEach((anchor) => {
      addUniqueText(values, urlToSignal(anchor.href));
    });
    return values.join(" ");
  }

  function extractSemanticContext(container) {
    const titleParts = [];
    if (container.matches("h1,h2,h3,[class*='title']")) {
      addUniqueText(titleParts, textFromElement(container));
    }
    collectTexts(container, SEMANTIC_TITLE_SELECTOR).forEach((text) => addUniqueText(titleParts, text));
    if (titleParts.length === 0) addUniqueText(titleParts, textFromElement(container));

    return {
      title: titleParts.join(" "),
      tags: collectTexts(container, SEMANTIC_TAG_SELECTOR),
      categories: collectTexts(container, SEMANTIC_CATEGORY_SELECTOR),
      channel: collectTexts(container, SEMANTIC_CHANNEL_SELECTOR).join(" "),
      playlist: collectTexts(container, SEMANTIC_PLAYLIST_SELECTOR).join(" "),
      url: collectUrls(container)
    };
  }

  function semanticContainersFromRoot(rootNode) {
    const root = normalizeScanRoot(rootNode);
    const containers = new Set();
    if (!root || !root.isConnected) return containers;

    const direct = closestSemanticContainer(root);
    if (direct) containers.add(direct);

    if (isElement(root)) {
      if (root.matches(SEMANTIC_CONTAINER_SELECTOR) && isSemanticContainerAllowed(root)) containers.add(root);
      root.querySelectorAll(SEMANTIC_CONTAINER_SELECTOR).forEach((element) => {
        if (isSemanticContainerAllowed(element)) containers.add(element);
      });
    }

    return containers;
  }

  function clearSemanticResult(container) {
    if (!container || !container.classList) return;
    container.classList.remove(helper.SEMANTIC_CLASS);
    container.style.removeProperty("--kwh-semantic-color");
    delete container.dataset.kwhSemanticRuleId;
    delete container.dataset.kwhSemanticRuleIds;
    delete container.dataset.kwhSemanticRuleName;
    delete container.dataset.kwhSemanticScore;
    delete container.dataset.kwhSemanticPriority;
  }

  function clearSemanticResults(rootNode = document) {
    const root = rootNode.querySelectorAll ? rootNode : document;
    root.querySelectorAll(`.${helper.SEMANTIC_CLASS}`).forEach(clearSemanticResult);
  }

  function applySemanticResult(container, results) {
    clearSemanticResult(container);
    if (!results || results.length === 0) return;

    const top = results[0];
    container.classList.add(helper.SEMANTIC_CLASS);
    container.style.setProperty("--kwh-semantic-color", top.color);
    container.dataset.kwhSemanticRuleId = top.ruleId;
    container.dataset.kwhSemanticRuleIds = results.map((result) => result.ruleId).join(",");
    container.dataset.kwhSemanticRuleName = top.name;
    container.dataset.kwhSemanticScore = String(top.score);
    container.dataset.kwhSemanticPriority = String(top.priority || 0);
  }

  function semanticMatcherFromResults(results) {
    const phrases = [];
    const seen = new Set();

    results.forEach((result) => {
      (result.hits || [])
        .filter((hit) => hit.source === "title")
        .forEach((hit) => {
          const word = helper.normalizeKeywordText(hit.phrase);
          const key = `${result.ruleId}:${word.toLowerCase()}`;
          if (!word || seen.has(key)) return;
          seen.add(key);
          phrases.push({
            id: key,
            word,
            color: result.color,
            enabled: true,
            priority: Number(result.priority || 0) + Number(hit.weight || 0),
            semanticRuleId: result.ruleId,
            semanticRuleName: result.name
          });
        });
    });

    return phrases.length > 0 ? helper.compileKeywordMatcher(phrases) : null;
  }

  function semanticTitleRoots(container) {
    const roots = new Set();
    if (container.matches("h1,h2,h3,[class*='title']")) roots.add(container);
    container.querySelectorAll(SEMANTIC_TITLE_SELECTOR).forEach((element) => roots.add(element));
    return roots;
  }

  function highlightSemanticTitlePhrases(container, results) {
    const semanticMatcher = semanticMatcherFromResults(results);
    if (!semanticMatcher) return;

    semanticTitleRoots(container).forEach((titleRoot) => {
      if (!titleRoot.isConnected || isOwnNode(titleRoot) || closestSkippableElement(titleRoot)) return;

      const walker = document.createTreeWalker(titleRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
          if (!node.parentElement || closestSkippableElement(node)) return NodeFilter.FILTER_REJECT;
          return helper.collectKeywordMatches(node.nodeValue, semanticMatcher).length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      });
      const nodesToReplace = [];

      while (walker.nextNode()) {
        nodesToReplace.push(walker.currentNode);
      }

      nodesToReplace.forEach((node) => {
        if (node.isConnected && !closestSkippableElement(node)) {
          highlightSemanticTextNode(node, semanticMatcher);
        }
      });
    });
  }

  function applySemanticScan(rootNode) {
    if (!settings.enabled || !hasEnabledSemanticRules()) return;

    semanticContainersFromRoot(rootNode).forEach((container) => {
      if (!container.isConnected || isOwnNode(container) || closestSkippableElement(container)) return;

      clearSemanticPhraseHighlights(container);
      const context = extractSemanticContext(container);
      const results = helper.evaluatePornhubSemanticRules(context, settings.semanticRules);
      applySemanticResult(container, results);
      if (results.length > 0) highlightSemanticTitlePhrases(container, results);
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

  function matchQuality(match) {
    return {
      priority: Number(match.priority || 0),
      score: Number(match.score || 0),
      length: Number(match.length || 0)
    };
  }

  function pickTopMatch(matches) {
    return matches
      .slice()
      .sort((a, b) => {
        const left = matchQuality(a);
        const right = matchQuality(b);
        if (right.priority !== left.priority) return right.priority - left.priority;
        if (right.score !== left.score) return right.score - left.score;
        return right.length - left.length;
      })[0];
  }

  function mergeNearbyMarkerItems(items, gapPercent = 0.15) {
    const sorted = items.slice().sort((a, b) => a.topPercent - b.topPercent);
    const merged = [];

    sorted.forEach((item) => {
      const last = merged[merged.length - 1];
      if (last && Math.abs(last.topPercent - item.topPercent) <= gapPercent) {
        last.matches.push(...item.matches);
        if (!last.targetId && item.targetId) last.targetId = item.targetId;
        last.topPercent = Math.min(last.topPercent, item.topPercent);
        last.color = pickTopMatch(last.matches).color;
        return;
      }

      merged.push({
        topPercent: item.topPercent,
        color: item.color,
        matches: [...item.matches],
        targetId: item.targetId || ""
      });
    });

    return merged;
  }

  function topPercentForElement(element, totalHeight) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const top = Math.max(0, window.scrollY + rect.top);
    return Math.min(99.8, (top / totalHeight) * 100);
  }

  function ensureMarkerTarget(element) {
    if (!element.dataset.kwhMarkerTarget) {
      element.dataset.kwhMarkerTarget = `kwh-target-${Math.random().toString(36).slice(2, 10)}`;
    }
    return element.dataset.kwhMarkerTarget;
  }

  function scrollToMarkerTarget(targetId) {
    if (!targetId) return;
    const target = document.querySelector(`[data-kwh-marker-target="${targetId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  function setMarkerTargetHover(targetId, isHovered) {
    if (!targetId) return;
    const target = document.querySelector(`[data-kwh-marker-target="${targetId}"]`);
    if (!target) return;
    target.classList.toggle(MARKER_HOVER_CLASS, isHovered);
  }

  function clearMarkerTargetHover() {
    document.querySelectorAll(`.${MARKER_HOVER_CLASS}`).forEach((element) => {
      element.classList.remove(MARKER_HOVER_CLASS);
    });
  }

  function markerItemsFromHighlights(totalHeight) {
    const keywordsById = new Map(settings.keywords.map((keyword) => [keyword.id, keyword]));
    return Array.from(document.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}`))
      .map((element) => {
        const topPercent = topPercentForElement(element, totalHeight);
        if (topPercent === null) return null;

        const keyword = keywordsById.get(element.dataset.kwhKeywordId || "");
        if (!keyword) return null;
        const primary = {
          type: "keyword",
          id: element.dataset.kwhKeywordId || "",
          word: (keyword && keyword.word) || element.dataset.kwhKeyword || "",
          color: element.style.backgroundColor || (keyword && keyword.color) || "rgba(255, 255, 0, 0.7)",
          priority: Number(element.dataset.kwhKeywordPriority || (keyword && keyword.priority) || 0),
          length: Number(element.dataset.kwhMatchLength || (element.textContent || "").length)
        };
        const extraMatches = (element.dataset.kwhExtraKeywordIds || "")
          .split(",")
          .map((id) => keywordsById.get(id.trim()))
          .filter(Boolean)
          .map((extraKeyword) => ({
            type: "keyword",
            id: extraKeyword.id,
            word: extraKeyword.word,
            color: extraKeyword.color,
            priority: Number(extraKeyword.priority || 0),
            length: (element.textContent || "").length
          }));
        const matches = [primary, ...extraMatches];
        const markerTarget = closestSemanticContainer(element) || element;
        const targetId = ensureMarkerTarget(markerTarget);

      return {
        topPercent,
        color: pickTopMatch(matches).color,
        matches,
        targetId
      };
      })
      .filter(Boolean);
  }

  function markerItemsFromSemanticMatches(totalHeight) {
    return Array.from(document.querySelectorAll(`.${helper.SEMANTIC_CLASS}`))
      .map((element) => {
        const topPercent = topPercentForElement(element, totalHeight);
        if (topPercent === null) return null;

        const match = {
          type: "semantic",
          id: element.dataset.kwhSemanticRuleId || "",
          name: element.dataset.kwhSemanticRuleName || "",
          color: element.style.getPropertyValue("--kwh-semantic-color") || "rgba(255, 255, 0, 0.7)",
          priority: Number(element.dataset.kwhSemanticPriority || 0),
          score: Number(element.dataset.kwhSemanticScore || 0),
          length: (element.textContent || "").length
        };
        const targetId = ensureMarkerTarget(element);

        return {
          topPercent,
          color: match.color,
          matches: [match],
          targetId
        };
      })
      .filter(Boolean);
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

    const container = getMarkerContainer();
    const fragment = document.createDocumentFragment();
    clearMarkerTargetHover();
    const markerItems = mergeNearbyMarkerItems([
      ...markerItemsFromHighlights(totalHeight),
      ...markerItemsFromSemanticMatches(totalHeight)
    ]);

    markerItems.forEach((item) => {
      const marker = document.createElement("div");
      marker.className = "kwh-scroll-marker";
      marker.style.top = `${item.topPercent}%`;
      marker.style.height = `${Math.min(6, 2 + item.matches.length)}px`;
      marker.style.backgroundColor = item.color;
      marker.dataset.kwhTargetId = item.targetId || "";

      marker.addEventListener("click", () => {
        scrollToMarkerTarget(marker.dataset.kwhTargetId);
      });
      marker.addEventListener("mouseenter", () => {
        setMarkerTargetHover(marker.dataset.kwhTargetId, true);
      });
      marker.addEventListener("mouseleave", () => {
        setMarkerTargetHover(marker.dataset.kwhTargetId, false);
      });

      fragment.appendChild(marker);
    });

    container.replaceChildren(fragment);
  }

  function collectStats() {
    const countsById = new Map();
    document.querySelectorAll(`span.${helper.HIGHLIGHT_CLASS}`).forEach((span) => {
      const keywordId = span.dataset.kwhKeywordId || "";
      if (keywordId) countsById.set(keywordId, (countsById.get(keywordId) || 0) + 1);

      (span.dataset.kwhExtraKeywordIds || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => {
          countsById.set(id, (countsById.get(id) || 0) + 1);
        });
    });
    const semanticCountsById = new Map();
    document.querySelectorAll(`.${helper.SEMANTIC_CLASS}`).forEach((element) => {
      (element.dataset.kwhSemanticRuleIds || element.dataset.kwhSemanticRuleId || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => {
          semanticCountsById.set(id, (semanticCountsById.get(id) || 0) + 1);
        });
    });

    const keywords = settings.keywords.map((keyword) => ({
      id: keyword.id,
      word: keyword.word,
      color: keyword.color,
      enabled: keyword.enabled !== false,
      count: countsById.get(keyword.id) || 0
    }));
    const semanticRules = (settings.semanticRules || []).map((rule) => ({
      id: rule.id,
      name: rule.name,
      color: rule.color,
      enabled: rule.enabled !== false,
      priority: Number(rule.priority || 0),
      count: semanticCountsById.get(rule.id) || 0
    }));

    return {
      enabled: settings.enabled,
      total: keywords.reduce((sum, keyword) => sum + keyword.count, 0),
      keywords,
      semanticTotal: semanticRules.reduce((sum, rule) => sum + rule.count, 0),
      semanticRules
    };
  }

  function runQueuedScan() {
    const roots = Array.from(queuedRoots);
    queuedRoots = new Set();
    clearTimeout(scanTimer);
    scanTimer = null;

    if (!settings.enabled) {
      regenerateMarkers();
      return;
    }

    runWithoutObserver(() => {
      const effectiveRoots = roots.length > 0 ? roots : [document.body];
      const shouldScanBody = effectiveRoots.some((root) => root === document.body || root === document.documentElement);
      if (shouldScanBody) {
        if (matcher) highlightTextNodes(document.body);
        applySemanticScan(document.body);
      } else {
        effectiveRoots.forEach((root) => {
          if (matcher) highlightTextNodes(root);
          applySemanticScan(root);
        });
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
      runWithoutObserver(() => {
        regenerateMarkers();
      });
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
      clearSemanticResults();
      clearMarkers();
      if (settings.enabled) {
        if (matcher) highlightTextNodes(document.body);
        applySemanticScan(document.body);
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
    window.addEventListener("scroll", scheduleMarkerRefresh, { passive: true });
    window.addEventListener("load", scheduleMarkerRefresh, { once: true });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
