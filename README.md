# PageTrace

PageTrace is a Manifest V3 Chrome extension that highlights configured keywords on matched pages and adds right-side scroll position markers for each hit.

## Features

- Scans page text from a content script with `TreeWalker`.
- Replaces only text nodes; it does not rewrite page content with `innerHTML`.
- Skips unsafe or interactive areas such as `script`, `style`, form controls, `iframe`, `svg`, and `canvas`.
- Watches dynamically loaded content with `MutationObserver`.
- Avoids mutation loops from extension-created highlights and marker elements.
- Stores keyword and color configuration with `chrome.storage`.
- Provides an options page for keyword management.
- Provides a popup for hit counts, enable/pause, and rescan actions.
- Supports case-insensitive matching, whitespace variants, and word-boundary protection for word-like keywords.

## Project Structure

```text
.
├── manifest.json
├── README.md
├── docs/
│   └── local-loading.md
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── options/
│   │   ├── options.html
│   │   └── options.js
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   ├── shared/
│   │   └── shared.js
│   └── styles/
│       └── styles.css
└── .github/
    └── workflows/
        └── validate.yml
```

## Local Testing

See [docs/local-loading.md](docs/local-loading.md).

## Permissions

The extension currently requests only `storage`. The content script is limited to:

```json
["*://www.pornhub.com/*"]
```

Update `manifest.json` if you need to support additional sites.
