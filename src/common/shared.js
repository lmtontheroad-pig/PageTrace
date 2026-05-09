(function (global) {
  "use strict";

  const STORAGE_KEY = "keywordHighlighterSettings";
  const STORAGE_AREA = "sync";

  const HIGHLIGHT_CLASS = "kwh-highlight";
  const SEMANTIC_CLASS = "kwh-semantic-match";
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
    { id: "kw-compilation", word: "compilation", color: "rgba(255, 20, 20, 0.6)", semanticColor: "rgba(255, 20, 20, 0.6)", enabled: true, priority: 30 },
    { id: "kw-anal", word: "anal", color: "rgba(255, 255, 0, 0.6)", semanticColor: "rgba(255, 255, 0, 0.6)", enabled: true, priority: 40 },
    { id: "kw-double-penetration", word: "Double Penetration", color: "rgba(0, 255, 255, 0.6)", semanticColor: "rgba(0, 255, 255, 0.6)", enabled: true, priority: 70 },
    { id: "kw-cuckold", word: "cuckold", color: "rgba(0, 200, 0, 0.5)", semanticColor: "rgba(0, 200, 0, 0.5)", enabled: true, priority: 60 }
  ];

  const DEFAULT_SEMANTIC_RULES = [
    {
      id: "sem_compilation",
      keywordId: "kw-compilation",
      name: "合集类",
      color: "rgba(255, 20, 20, 0.6)",
      priority: 30,
      threshold: 3,
      enabled: true,
      strongTitlePhrases: [
        "compilation",
        "best of",
        "collection",
        "scene collection",
        "full compilation",
        "ultimate compilation"
      ],
      weakTitlePhrases: [
        "mix",
        "montage",
        "highlights",
        "all scenes",
        "scene pack"
      ],
      tagPhrases: [
        "compilation",
        "best of",
        "collection"
      ],
      categoryPhrases: [
        "compilation"
      ],
      excludePhrases: []
    },
    {
      id: "sem_anal",
      keywordId: "kw-anal",
      name: "肛交类",
      color: "rgba(255, 255, 0, 0.6)",
      priority: 40,
      threshold: 3,
      enabled: true,
      strongTitlePhrases: [
        "anal",
        "anal sex",
        "anal scene",
        "backdoor",
        "first anal"
      ],
      weakTitlePhrases: [
        "ass",
        "booty",
        "behind"
      ],
      tagPhrases: [
        "anal",
        "anal sex",
        "backdoor"
      ],
      categoryPhrases: [
        "anal"
      ],
      excludePhrases: [
        "analysis",
        "analytics",
        "analog",
        "canal",
        "banal"
      ]
    },
    {
      id: "sem_double_penetration",
      keywordId: "kw-double-penetration",
      name: "双重插入类",
      color: "rgba(0, 255, 255, 0.6)",
      priority: 70,
      threshold: 3,
      enabled: true,
      strongTitlePhrases: [
        "double penetration",
        "doublepenetration",
        "double p",
        "dp scene",
        "dp action"
      ],
      weakTitlePhrases: [
        "dp"
      ],
      tagPhrases: [
        "double penetration",
        "dp"
      ],
      categoryPhrases: [
        "double penetration"
      ],
      excludePhrases: []
    },
    {
      id: "sem_cuckold",
      keywordId: "kw-cuckold",
      name: "绿帽类",
      color: "rgba(0, 200, 0, 0.5)",
      priority: 60,
      threshold: 3,
      enabled: true,
      strongTitlePhrases: [
        "cuckold",
        "cuck",
        "hotwife",
        "wife sharing",
        "watching wife"
      ],
      weakTitlePhrases: [
        "cheating wife",
        "shared wife",
        "watching her",
        "husband watches"
      ],
      tagPhrases: [
        "cuckold",
        "cuck",
        "hotwife",
        "wife sharing"
      ],
      categoryPhrases: [
        "cuckold"
      ],
      excludePhrases: [
        "cuckoo"
      ]
    }
  ];
  const SEMANTIC_RULE_KEYWORD_IDS = {
    sem_compilation: "kw-compilation",
    sem_anal: "kw-anal",
    sem_double_penetration: "kw-double-penetration",
    sem_cuckold: "kw-cuckold"
  };

  function cloneDefaultKeywords() {
    return DEFAULT_KEYWORDS.map((item) => ({ ...item }));
  }

  function cloneDefaultSemanticRules() {
    return DEFAULT_SEMANTIC_RULES.map((rule) => ({
      ...rule,
      strongTitlePhrases: [...rule.strongTitlePhrases],
      weakTitlePhrases: [...rule.weakTitlePhrases],
      tagPhrases: [...rule.tagPhrases],
      categoryPhrases: [...rule.categoryPhrases],
      excludePhrases: [...rule.excludePhrases]
    }));
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

  function numberOrFallback(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizePhraseList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(normalizeKeywordText)
      .filter(Boolean);
  }

  function createKeyword(word, color, semanticColor) {
    const primaryColor = String(color || "rgba(255, 255, 0, 0.6)").trim();
    return {
      id: generateId(),
      word: normalizeKeywordText(word),
      color: primaryColor,
      semanticColor: String(semanticColor || primaryColor).trim(),
      enabled: true,
      priority: 0
    };
  }

  function normalizeKeywordItem(item, index) {
    const source = item && typeof item === "object" ? item : {};
    const word = normalizeKeywordText(source.word);
    if (!word) return null;

    const color = String(source.color || "rgba(255, 255, 0, 0.6)").trim();
    return {
      id: String(source.id || `kw-${index}-${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
      word,
      color,
      semanticColor: String(source.semanticColor || color).trim(),
      enabled: source.enabled !== false,
      priority: numberOrFallback(source.priority, 0)
    };
  }

  function normalizeSemanticRuleItem(item, index) {
    const source = item && typeof item === "object" ? item : {};
    const id = String(source.id || `sem-${index}`);
    const name = normalizeKeywordText(source.name || id);
    if (!name) return null;

    return {
      id,
      keywordId: source.keywordId ? String(source.keywordId) : (SEMANTIC_RULE_KEYWORD_IDS[id] || ""),
      name,
      color: String(source.color || "rgba(255, 255, 0, 0.6)").trim(),
      priority: numberOrFallback(source.priority, 0),
      threshold: numberOrFallback(source.threshold, 1),
      enabled: source.enabled !== false,
      strongTitlePhrases: normalizePhraseList(source.strongTitlePhrases),
      weakTitlePhrases: normalizePhraseList(source.weakTitlePhrases),
      tagPhrases: normalizePhraseList(source.tagPhrases),
      categoryPhrases: normalizePhraseList(source.categoryPhrases),
      excludePhrases: normalizePhraseList(source.excludePhrases)
    };
  }

  function normalizeSettings(rawSettings) {
    const source = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const rawKeywords = Array.isArray(source.keywords) ? source.keywords : cloneDefaultKeywords();
    const keywords = rawKeywords
      .map(normalizeKeywordItem)
      .filter(Boolean);
    const rawSemanticRules = Array.isArray(source.semanticRules)
      ? source.semanticRules
      : cloneDefaultSemanticRules();
    const keywordsById = new Map(keywords.map((keyword) => [keyword.id, keyword]));
    const semanticRules = rawSemanticRules
      .map(normalizeSemanticRuleItem)
      .filter(Boolean)
      .map((rule) => {
        const keyword = keywordsById.get(rule.keywordId);
        if (!keyword) return rule;
        return {
          ...rule,
          color: keyword.semanticColor || keyword.color
        };
      });

    return {
      enabled: source.enabled !== false,
      keywords: keywords.length > 0 ? keywords : cloneDefaultKeywords(),
      semanticRules
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
      .map((keyword, index) => ({
        ...keyword,
        order: index,
        priority: numberOrFallback(keyword.priority, 0),
        normalizedLength: normalizeKeywordText(keyword.word).replace(/\s+/g, "").length,
        regex: new RegExp(buildKeywordPattern(keyword), "gi")
      }))
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (b.normalizedLength !== a.normalizedLength) return b.normalizedLength - a.normalizedLength;
        return a.order - b.order;
      });

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

  function compareKeywordCandidates(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.length !== b.length) return a.length - b.length;
    return b.order - a.order;
  }

  function pushUniqueKeyword(target, keyword) {
    if (!keyword || target.some((item) => item.id === keyword.id)) return;
    target.push(keyword);
  }

  function collectKeywordMatches(text, matcher) {
    if (!matcher || !text) return [];

    const candidates = [];
    matcher.keywords.forEach((keyword) => {
      let match;
      keyword.regex.lastIndex = 0;
      while ((match = keyword.regex.exec(text)) !== null) {
        const start = match.index;
        const end = keyword.regex.lastIndex;
        if (end > start) {
          candidates.push({
            start,
            end,
            text: match[0],
            keyword,
            priority: keyword.priority,
            length: end - start,
            order: keyword.order,
            extraKeywords: []
          });
        }
        if (match.index === keyword.regex.lastIndex) keyword.regex.lastIndex += 1;
      }
    });

    candidates.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const quality = compareKeywordCandidates(b, a);
      if (quality !== 0) return quality;
      return b.end - a.end;
    });

    return candidates.reduce((accepted, candidate) => {
      const last = accepted[accepted.length - 1];
      if (!last || candidate.start >= last.end) {
        accepted.push({ ...candidate, extraKeywords: [] });
        return accepted;
      }

      const sameRange = candidate.start === last.start && candidate.end === last.end;
      const candidateWins = compareKeywordCandidates(candidate, last) > 0;
      if (sameRange) {
        if (candidateWins) {
          const next = { ...candidate, extraKeywords: [] };
          pushUniqueKeyword(next.extraKeywords, last.keyword);
          last.extraKeywords.forEach((keyword) => pushUniqueKeyword(next.extraKeywords, keyword));
          accepted[accepted.length - 1] = next;
        } else {
          pushUniqueKeyword(last.extraKeywords, candidate.keyword);
        }
        return accepted;
      }

      if (candidateWins) {
        accepted[accepted.length - 1] = { ...candidate, extraKeywords: [] };
      }
      return accepted;
    }, []);
  }

  function normalizeSemanticText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasPhrase(text, phrase) {
    const normalizedPhrase = normalizeSemanticText(phrase);
    if (!normalizedPhrase) return false;

    const escaped = normalizedPhrase
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(escapeRegExp)
      .join("[\\s-]+");
    if (!escaped) return false;

    const pattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "iu");
    return pattern.test(text);
  }

  function hasAnyPhrase(text, phrases = []) {
    return phrases.some((phrase) => hasPhrase(text, phrase));
  }

  function addPhraseHits(text, phrases, source, weight, hits) {
    let score = 0;
    normalizePhraseList(phrases)
      .map((phrase) => ({
        phrase,
        normalizedPhrase: normalizeSemanticText(phrase)
      }))
      .sort((a, b) => b.normalizedPhrase.length - a.normalizedPhrase.length)
      .forEach(({ phrase, normalizedPhrase }) => {
        if (!hasPhrase(text, phrase)) return;
        const alreadyCovered = hits.some((hit) => {
          return hit.source === source
            && hit.normalizedPhrase
            && hit.normalizedPhrase.includes(normalizedPhrase);
        });
        if (alreadyCovered) return;

        score += weight;
        hits.push({ phrase, source, weight, normalizedPhrase });
      });
    return score;
  }

  function evaluatePornhubSemanticRule(context, rule) {
    if (!rule || rule.enabled === false) return null;

    const title = normalizeSemanticText(context && context.title);
    const tags = normalizeSemanticText(((context && context.tags) || []).join(" "));
    const categories = normalizeSemanticText(((context && context.categories) || []).join(" "));
    const channel = normalizeSemanticText((context && context.channel) || "");
    const playlist = normalizeSemanticText((context && context.playlist) || "");
    const url = normalizeSemanticText((context && context.url) || "");
    const allText = [title, tags, categories, channel, playlist, url].join(" ");

    if (hasAnyPhrase(allText, rule.excludePhrases)) return null;

    let score = 0;
    const hits = [];

    score += addPhraseHits(title, rule.strongTitlePhrases, "title", 2, hits);
    score += addPhraseHits(title, rule.weakTitlePhrases, "title", 1, hits);
    score += addPhraseHits(tags, rule.tagPhrases, "tag", 3, hits);
    score += addPhraseHits(categories, rule.categoryPhrases, "category", 3, hits);

    if (score < numberOrFallback(rule.threshold, 1)) return null;

    return {
      ruleId: rule.id,
      name: rule.name,
      color: rule.color,
      priority: numberOrFallback(rule.priority, 0),
      score,
      hits: hits.map((hit) => ({
        phrase: hit.phrase,
        source: hit.source,
        weight: hit.weight
      }))
    };
  }

  function evaluatePornhubSemanticRules(context, rules) {
    return (rules || [])
      .map((rule) => evaluatePornhubSemanticRule(context, rule))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.score - a.score;
      });
  }

  global.KeywordHighlighter = {
    STORAGE_KEY,
    STORAGE_AREA,
    HIGHLIGHT_CLASS,
    SEMANTIC_CLASS,
    MARKER_CONTAINER_ID,
    ROOT_ATTR,
    SKIP_SELECTOR,
    DEFAULT_KEYWORDS,
    DEFAULT_SEMANTIC_RULES,
    cloneDefaultKeywords,
    cloneDefaultSemanticRules,
    createKeyword,
    normalizeKeywordText,
    normalizeSettings,
    getSettings,
    saveSettings,
    compileKeywordMatcher,
    keywordFromMatch,
    collectKeywordMatches,
    normalizeSemanticText,
    hasPhrase,
    hasAnyPhrase,
    evaluatePornhubSemanticRule,
    evaluatePornhubSemanticRules
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
