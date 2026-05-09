# PageTrace

PageTrace is a Manifest V3 Chrome extension for local keyword and lightweight semantic tracing on matched pages.

It highlights configured text matches, marks hit positions on the right side of the page, and uses local rule scoring to classify video cards without sending data to remote services.

## Current Features

- Manifest V3 Chrome extension with minimal permission usage.
- Content script scanning with `TreeWalker`; page content is not rewritten with `innerHTML`.
- Text-node-only highlighting to avoid breaking page structure and event handlers.
- Dynamic page support through `MutationObserver`.
- Skips script/style/form/media/plugin-owned nodes.
- Configurable keywords with separate colors for literal matches and weak-semantic matches.
- Case-insensitive matching, whitespace variants, and word-boundary protection.
- Local weak-semantic rules for the default categories.
- Right-side scroll markers with hover-to-highlight and click-to-scroll behavior.
- Popup with enable, pause, rescan, and hit counts.
- Options page for keyword and color management.

## Directory Structure

```text
.
├── manifest.json
├── README.md
├── docs/
│   └── local-loading.md
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── common/
│   │   └── shared.js
│   ├── content/
│   │   └── content.js
│   ├── pages/
│   │   ├── options.html
│   │   ├── options.js
│   │   ├── popup.html
│   │   └── popup.js
│   └── styles/
│       └── extension.css
└── .github/
    └── workflows/
        └── validate.yml
```

## Key Files

- `src/content/content.js`: page scanning, text-node highlighting, semantic card evaluation, scroll markers, and dynamic content handling.
- `src/common/shared.js`: default settings, storage helpers, keyword matching, and semantic scoring rules.
- `src/pages/options.html` and `src/pages/options.js`: keyword management and color configuration.
- `src/pages/popup.html` and `src/pages/popup.js`: current-page controls and hit summaries.
- `src/styles/extension.css`: content-script styles plus popup/options UI styles.

## Local Loading

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this repository root, the directory containing `manifest.json`.
5. Refresh a matched page after changing extension files.

More detail: [docs/local-loading.md](docs/local-loading.md).

## Permissions and Match Scope

The extension currently requests only:

```json
["storage"]
```

The content script is limited to:

```json
["*://www.pornhub.com/*"]
```

Change `manifest.json` if the match scope needs to expand.

## Validation

The GitHub Actions workflow runs syntax checks for all JavaScript entry files and validates `manifest.json`.
