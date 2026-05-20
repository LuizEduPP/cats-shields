/**
 * Cats Shields 🐱
 * Replaces keyword-matched images with cute cats.
 * Keywords are configurable via the popup and persisted in chrome.storage.sync.
 */

// Active keywords at runtime — updated from storage
// DEFAULT_KEYWORDS is defined in defaults.js (loaded before this script)
let ACTIVE_KEYWORDS = [...DEFAULT_KEYWORDS];

/**
 * Checks whether a string contains any active keyword.
 * @param {string} str
 * @returns {boolean}
 */
function matchesKeyword(str) {
  if (!str) return false;
  const lower = str.toLowerCase();
  return ACTIVE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Loads keywords from storage and unions them with DEFAULT_KEYWORDS.
 * This ensures new defaults from future versions take effect
 * without requiring a manual storage reset.
 */
function loadKeywords(callback) {
  chrome.storage.sync.get({ keywords: [] }, ({ keywords }) => {
    ACTIVE_KEYWORDS = [...new Set([...DEFAULT_KEYWORDS, ...keywords])];
    console.log('[🐱 Cats] keywords loaded:', ACTIVE_KEYWORDS);
    callback?.();
  });
}

// Number of bundled cat images inside the cats/ folder
// Update this if you add more or fewer than 60
const CAT_COUNT = 60;

/**
 * Returns a random local cat image URL.
 * Uses chrome.runtime.getURL to access extension assets.
 * @returns {string}
 */
function getCatUrl() {
  const num = Math.floor(Math.random() * CAT_COUNT) + 1;
  const padded = String(num).padStart(2, '0');
  return chrome.runtime.getURL(`cats/cat_${padded}.jpg`);
}

function isProfileHref(href) {
  return typeof href === 'string' && href.startsWith('/@');
}

function isAvatarMedia(element) {
  if (!element) return false;

  const candidates = [
    element.src,
    element.srcset,
    element.getAttribute?.('src'),
    element.getAttribute?.('srcset'),
    element.getAttribute?.('data-src'),
    element.getAttribute?.('data-srcset'),
    element.getAttribute?.('data-original'),
  ].filter(Boolean);

  if (candidates.some(value => value.includes('/media/auth/avatars/'))) {
    return true;
  }

  return Boolean(
    element.closest('.avatar') ||
    element.closest('a.avatar') ||
    element.closest('a[href^="/@"]')
  );
}

/**
 * Checks the DOM context around an image to detect keyword-matched cards.
 * Walks up the DOM looking for ancestor links with matching keywords in the href.
 * Stops at card boundaries (article / li / section) and only inspects
 * headings and links inside that same container.
 * @param {HTMLElement} img
 * @returns {boolean}
 */
function hasMatchingContext(img) {
  let el = img.parentElement;
  for (let depth = 0; el && el !== document.body && depth < 10; depth++, el = el.parentElement) {
    // Direct ancestor link with a matching keyword in the href
    if (el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (!isProfileHref(href) && matchesKeyword(href)) {
        console.log('[🐱 Cats] context via href:', href, img);
        return true;
      }
    }

    if (el.matches?.('a[href^="/@"], .avatar, a.avatar')) {
      break;
    }

    // Card boundary — never leak beyond this container
    if (el.tagName === 'ARTICLE' || el.tagName === 'LI' || el.tagName === 'SECTION') {
      // 1) Check headings inside the card
      for (const h of el.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        if (matchesKeyword(h.textContent)) {
          console.log('[🐱 Cats] context via heading:', h.textContent.trim(), img);
          return true;
        }
      }

      // 2) Fallback: any card-internal link with matching keywords, except profiles
      for (const a of el.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        if (!isProfileHref(href) && matchesKeyword(href)) {
          console.log('[🐱 Cats] context via internal link:', href, img);
          return true;
        }
      }

      break;
    }
  }
  return false;
}

/**
 * Replaces an <img> element with a cat image when it matches active keyword rules.
 * @param {HTMLImageElement} img
 */
function replaceImg(img) {
  if (img.dataset.catified) return;
  if (isAvatarMedia(img)) return;

  const checks = {
    src:          matchesKeyword(img.src),
    alt:          matchesKeyword(img.alt),
    title:        matchesKeyword(img.title),
    'data-src':   matchesKeyword(img.getAttribute('data-src')),
    'data-orig':  matchesKeyword(img.getAttribute('data-original')),
    context:      hasMatchingContext(img),
  };

  const shouldReplace = Object.values(checks).some(Boolean);

  if (shouldReplace) {
    const reason = Object.entries(checks).find(([, v]) => v)?.[0];
    console.log('[🐱 Cats] replacing via', reason, img.src.slice(0, 80));
    img.dataset.catified = 'true';
    img.src = getCatUrl();
    img.removeAttribute('srcset');
    img.alt = 'A cute kitty 🐱';
    img.title = 'It matched a keyword, now it is a cat!';
    img.style.objectFit = 'cover';
  }
}

/**
 * Replaces <source> elements inside <picture> when they match active keyword rules.
 * @param {HTMLSourceElement} source
 */
function replaceSource(source) {
  if (source.dataset.catified) return;
  if (isAvatarMedia(source)) return;

  const checks = {
    srcset:      matchesKeyword(source.srcset),
    'data-srcset': matchesKeyword(source.getAttribute('data-srcset')),
    context:     hasMatchingContext(source),
  };

  const shouldReplace = Object.values(checks).some(Boolean);

  if (shouldReplace) {
    const reason = Object.entries(checks).find(([, value]) => value)?.[0];
    console.log('[🐱 Cats] replacing <source> via', reason, source.srcset.slice(0, 80));
    source.dataset.catified = 'true';
    source.srcset = getCatUrl();
    source.removeAttribute('data-srcset');
  }
}

/**
 * Scans all image-related elements on the page and replaces keyword matches.
 */
function replaceAll() {
  document.querySelectorAll('img').forEach(replaceImg);
  document.querySelectorAll('source').forEach(replaceSource);
}

// Load keywords and perform the initial scan
loadKeywords(() => replaceAll());

// ── MutationObserver with requestAnimationFrame debounce ─────────────
// Mutations are batched and processed once per frame (~60x/s)
// to avoid freezing pages with very dynamic DOM updates.

let rafId = null;
const pendingMutations = [];

function processMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'IMG')         replaceImg(node);
        else if (node.tagName === 'SOURCE') replaceSource(node);
        node.querySelectorAll?.('img').forEach(replaceImg);
        node.querySelectorAll?.('source').forEach(replaceSource);
      }
    } else if (mutation.type === 'attributes') {
      const target = mutation.target;
      // Skip already replaced media to avoid loops and unnecessary reprocessing
      if (target.dataset.catified) continue;
      if (target.tagName === 'IMG')         replaceImg(target);
      else if (target.tagName === 'SOURCE') replaceSource(target);
    }
  }
}

const observer = new MutationObserver((mutations) => {
  pendingMutations.push(...mutations);
  if (rafId !== null) return; // already scheduled, just accumulate
  rafId = requestAnimationFrame(() => {
    rafId = null;
    processMutations(pendingMutations.splice(0));
  });
});

// React to popup changes in real time
chrome.storage.onChanged.addListener((changes) => {
  if (changes.keywords) {
    ACTIVE_KEYWORDS = [...new Set([...DEFAULT_KEYWORDS, ...changes.keywords.newValue])];
    replaceAll();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'data-original']
});
