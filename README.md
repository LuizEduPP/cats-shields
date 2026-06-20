# Cats Shields

Filter the web. Keep the cats.

![Cats Shields hero](repo-image.png)

![Cats Shields popup](image.png)

Chrome extension (Manifest V3) that replaces keyword-matched images with bundled local cat photos.

## Stack

- Vanilla JavaScript
- Chrome Extension APIs (`storage`, content scripts)
- Local JPG assets in `cats/`

## Quick setup

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this folder.

## Required assets

The extension ships with:

- `icons/icon-*.png` generated from `icons/icon.svg`
- `cats/cat_01.jpg` … `cats/cat_60.jpg` bundled replacement images

## Usage

1. Open the popup and choose a starter pack.
2. Click **Apply pack** to save keywords instantly, or **Paste pack** to edit before adding.
3. Add custom keywords manually with comma-separated input.
4. Browse pages — matched images are replaced with cats automatically.

Starter packs: Arachnophobia, Snakes, Insects, Clowns, Sharks, Needles.

## Environment variables

None. Keywords are stored in `chrome.storage.sync`.

## Commands

No build step. Load the folder directly in Chrome.

To regenerate icon PNGs from the SVG:

```bash
magick -background none icons/icon.svg -resize 128x128 icons/icon-128.png
```

## Architecture

```text
manifest.json
├── defaults.js      shared constants, preset packs, keyword helpers
├── content.js       page scanning, DOM context matching, image replacement
├── popup.html/css/js settings UI and storage persistence
├── cats/            local replacement images
└── icons/           extension branding assets
```

- **Keyword merge:** user keywords in storage are merged with `DEFAULT_KEYWORDS` from `defaults.js`.
- **Matching:** image `src`, `alt`, lazy-load attributes, and card context (headings/links inside article/section/li).
- **Safety:** skips profile avatars and `/@` profile links.
- **Performance:** mutation observer debounced with `requestAnimationFrame`.

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist custom keywords |
| `<all_urls>` | Run content script on visited pages |

## Privacy

Runs locally. No backend, analytics, or external image APIs at runtime.

## License

MIT — see [LICENSE](LICENSE).
