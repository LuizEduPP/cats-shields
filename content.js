/**
 * Cats Shields — keyword detection and image replacement.
 */

let activeKeywords = mergeActiveKeywords([]);
let observerStarted = false;
let pageBlockCount = 0;

const catUrlByMediaKey = new Map();
const countedMediaKeys = new Set();
let countedPictureElements = new WeakSet();
let countedStandaloneImages = new WeakSet();

let keywordsReady = false;
let tabGeneration = null;
let isResettingPage = false;

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
function isCatAssetUrl(url) {
  return typeof url === 'string' && url.includes('/cats/cat_');
}

/**
 * @param {Element} element
 * @param {string[]} attributeNames
 * @returns {string[]}
 */
function readMediaValues(element, attributeNames) {
  return attributeNames
    .map((name) => {
      if (name === 'src' && 'src' in element) return element.src;
      if (name === 'srcset' && 'srcset' in element) return element.srcset;
      if (name === 'alt' && 'alt' in element) return element.alt;
      if (name === 'title' && 'title' in element) return element.title;
      return element.getAttribute?.(name);
    })
    .filter((value) => value && !isCatAssetUrl(value));
}

/**
 * @param {Element} element
 * @returns {string | null}
 */
function getMediaStableKey(element) {
  const parts = readMediaValues(element, [
    'data-original',
    'data-src',
    'data-srcset',
    'srcset',
    'src',
    'alt',
    'title',
  ]);

  return parts.length ? parts.join('\u0001') : null;
}

/**
 * @param {string} mediaKey
 * @returns {string}
 */
function resolveCatUrl(mediaKey) {
  const cachedCatUrl = catUrlByMediaKey.get(mediaKey);
  if (cachedCatUrl) return cachedCatUrl;

  const catUrl = getCatUrl();
  catUrlByMediaKey.set(mediaKey, catUrl);
  return catUrl;
}

function adoptTabGeneration(generation) {
  if (!Number.isInteger(generation) || generation < 0) return;
  tabGeneration = generation;
}

function syncBlockCount(count) {
  if (tabGeneration === null) return;

  pageBlockCount = Math.max(0, Number(count) || 0);

  const payload = {
    type: MESSAGE_UPDATE_BLOCK_COUNT,
    count: pageBlockCount,
    generation: tabGeneration,
  };

  chrome.runtime.sendMessage(payload, () => {
    if (!chrome.runtime.lastError) return;
    window.setTimeout(() => {
      chrome.runtime.sendMessage(payload);
    }, BADGE_RETRY_MS);
  });
}

function clearBlockTrackingState() {
  pageBlockCount = 0;
  catUrlByMediaKey.clear();
  countedMediaKeys.clear();
  countedPictureElements = new WeakSet();
  countedStandaloneImages = new WeakSet();
}

function stripCatMarkers() {
  document.querySelectorAll('[data-cat-url]').forEach((element) => {
    delete element.dataset.catUrl;
    delete element.dataset.catified;
  });
}

function resetPageBlockState(generation) {
  if (!Number.isInteger(generation)) return;
  if (tabGeneration !== null && generation < tabGeneration) return;

  isResettingPage = true;
  adoptTabGeneration(generation);
  clearBlockTrackingState();
  stripCatMarkers();
  syncBlockCount(0);

  if (keywordsReady && activeKeywords.length) {
    replaceAll();
  }

  isResettingPage = false;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== MESSAGE_RESET_PAGE_STATE) return;
  resetPageBlockState(message.generation);
});

function incrementBlockCount() {
  syncBlockCount(pageBlockCount + 1);
}

/**
 * @param {HTMLImageElement | HTMLSourceElement} element
 * @param {string | null} mediaKey
 */
function trackBlockCount(element, mediaKey) {
  if (isResettingPage) return;

  const picture = element.closest('picture');
  if (picture) {
    if (countedPictureElements.has(picture)) return;
    countedPictureElements.add(picture);
    incrementBlockCount();
    return;
  }

  if (mediaKey) {
    if (countedMediaKeys.has(mediaKey)) return;
    countedMediaKeys.add(mediaKey);
    incrementBlockCount();
    return;
  }

  if (element.tagName !== 'IMG' || countedStandaloneImages.has(element)) return;

  countedStandaloneImages.add(element);
  incrementBlockCount();
}

/**
 * @param {(() => void) | undefined} callback
 */
function loadActiveKeywords(callback) {
  readStoredUserKeywords((userKeywords) => {
    activeKeywords = mergeActiveKeywords(userKeywords);
    callback?.();
  });
}

/**
 * @returns {string}
 */
function getCatUrl() {
  const num = Math.floor(Math.random() * CAT_COUNT) + 1;
  return chrome.runtime.getURL(`cats/cat_${String(num).padStart(2, '0')}.jpg`);
}

/**
 * @param {HTMLImageElement | HTMLSourceElement} element
 * @param {string} catUrl
 */
function reapplyCatMedia(element, catUrl) {
  if (element.tagName === 'IMG') {
    if (element.src !== catUrl) element.src = catUrl;
    element.removeAttribute('srcset');
    return;
  }

  if (element.tagName === 'SOURCE' && element.srcset !== catUrl) {
    element.srcset = catUrl;
    element.removeAttribute('data-srcset');
  }
}

/**
 * @param {HTMLImageElement | HTMLSourceElement} element
 * @param {string} catUrl
 * @param {string | null} mediaKey
 */
function applyCatReplacement(element, catUrl, mediaKey) {
  element.dataset.catified = 'true';
  element.dataset.catUrl = catUrl;
  reapplyCatMedia(element, catUrl);

  if (element.tagName === 'IMG') {
    element.alt = 'A cute kitty';
    element.title = 'It matched a keyword, now it is a cat!';
    element.style.objectFit = 'cover';
  }

  trackBlockCount(element, mediaKey);
}

/**
 * @param {string | null} href
 * @returns {boolean}
 */
function isProfileHref(href) {
  return typeof href === 'string' && href.startsWith('/@');
}

/**
 * @param {Element | null} element
 * @returns {boolean}
 */
function isAvatarMedia(element) {
  if (!element) return false;

  if (
    readMediaValues(element, [
      'src',
      'srcset',
      'data-src',
      'data-srcset',
      'data-original',
    ]).some((value) => value.includes('/media/auth/avatars/'))
  ) {
    return true;
  }

  return Boolean(
    element.closest('.avatar') ||
    element.closest('a.avatar') ||
    element.closest('a[href^="/@"]'),
  );
}

/**
 * @param {HTMLImageElement | HTMLSourceElement} element
 * @returns {boolean}
 */
function hasDirectMediaMatch(element) {
  const attributes =
    element.tagName === 'SOURCE' ? SOURCE_MATCH_ATTRIBUTES : IMG_MATCH_ATTRIBUTES;

  return readMediaValues(element, attributes).some((value) =>
    matchesKeyword(value, activeKeywords),
  );
}

/**
 * @param {HTMLImageElement} element
 * @returns {{ width: number, height: number }}
 */
function getEffectiveImageSize(element) {
  const widthAttr = Number.parseInt(element.getAttribute('width') || '', 10);
  const heightAttr = Number.parseInt(element.getAttribute('height') || '', 10);

  if (
    Number.isFinite(widthAttr) &&
    Number.isFinite(heightAttr) &&
    widthAttr > 0 &&
    heightAttr > 0
  ) {
    return { width: widthAttr, height: heightAttr };
  }

  const renderedWidth =
    element.width || element.clientWidth || element.naturalWidth || 0;
  const renderedHeight =
    element.height || element.clientHeight || element.naturalHeight || 0;

  if (renderedWidth > 0 && renderedHeight > 0) {
    return { width: renderedWidth, height: renderedHeight };
  }

  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
function isFaviconUrl(url) {
  if (!url) return false;

  const lower = url.toLowerCase();
  return (
    lower.includes('favicon') ||
    lower.includes('/s2/favicons') ||
    lower.includes('icon?') ||
    lower.includes('/icons/')
  );
}

/**
 * @param {HTMLImageElement} element
 * @returns {boolean}
 */
function isDecorativeThumbnail(element) {
  if (element.tagName !== 'IMG') return false;

  const { width, height } = getEffectiveImageSize(element);

  if (
    width > 0 &&
    height > 0 &&
    width < MIN_REPLACEMENT_SIZE_PX &&
    height < MIN_REPLACEMENT_SIZE_PX
  ) {
    return true;
  }

  const src = element.currentSrc || element.src || element.getAttribute('src') || '';
  return isFaviconUrl(src);
}

/**
 * @param {Element} element
 * @returns {boolean}
 */
function elementProvidesKeywordContext(element) {
  if (!element?.getAttribute) return false;

  if (element.tagName === 'A') {
    const href = element.getAttribute('href');
    if (!isProfileHref(href) && matchesKeyword(href, activeKeywords)) return true;
  }

  return CONTEXT_LINK_ATTRIBUTES.some((attributeName) =>
    matchesKeyword(element.getAttribute(attributeName), activeKeywords),
  );
}

/**
 * @param {Element} element
 * @returns {boolean}
 */
function isSearchResultCardBoundary(element) {
  if (CARD_BOUNDARY_TAGS.includes(element.tagName)) return true;
  if (element.tagName !== 'DIV') return false;

  return CARD_BOUNDARY_DATA_ATTRIBUTES.some((attributeName) =>
    element.hasAttribute(attributeName),
  );
}

/**
 * @param {Element} card
 * @returns {boolean}
 */
function cardProvidesKeywordContext(card) {
  for (const heading of card.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (matchesKeyword(heading.textContent, activeKeywords)) return true;
  }

  for (const node of card.querySelectorAll('a[href]')) {
    if (elementProvidesKeywordContext(node)) return true;
  }

  return CONTEXT_LINK_ATTRIBUTES.some((attributeName) =>
    matchesKeyword(card.getAttribute(attributeName), activeKeywords),
  );
}

/**
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function hasMatchingContext(element) {
  if (isDecorativeThumbnail(element)) return false;

  let el = element.parentElement;

  for (
    let depth = 0;
    el && el !== document.body && depth < DOM_CONTEXT_MAX_DEPTH;
    depth++, el = el.parentElement
  ) {
    if (elementProvidesKeywordContext(el)) return true;

    if (el.matches?.('a[href^="/@"], .avatar, a.avatar')) break;

    if (isSearchResultCardBoundary(el)) {
      return cardProvidesKeywordContext(el);
    }
  }

  return false;
}

/**
 * @param {HTMLImageElement | HTMLSourceElement} element
 */
function replaceMedia(element) {
  const assignedCatUrl = element.dataset.catUrl;
  if (assignedCatUrl) {
    reapplyCatMedia(element, assignedCatUrl);
    return;
  }

  if (!activeKeywords.length || isAvatarMedia(element)) return;

  const directMatch = hasDirectMediaMatch(element);
  if (!directMatch && isDecorativeThumbnail(element)) return;
  if (!directMatch && !hasMatchingContext(element)) return;

  const mediaKey = getMediaStableKey(element);
  applyCatReplacement(
    element,
    mediaKey ? resolveCatUrl(mediaKey) : getCatUrl(),
    mediaKey,
  );
}

function replaceAll() {
  if (!activeKeywords.length) return;
  document.querySelectorAll('img').forEach(replaceMedia);
  document.querySelectorAll('source').forEach(replaceMedia);
}

function scanNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  if (node.tagName === 'IMG' || node.tagName === 'SOURCE') {
    replaceMedia(node);
  }

  node.querySelectorAll('img, source').forEach(replaceMedia);
}

let rafId = null;
const pendingMutations = [];

function processMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) scanNode(node);
      continue;
    }

    if (mutation.type !== 'attributes') continue;

    const target = mutation.target;
    if (target.dataset.catUrl) {
      reapplyCatMedia(target, target.dataset.catUrl);
      continue;
    }

    if (target.tagName === 'IMG' || target.tagName === 'SOURCE') {
      replaceMedia(target);
    }
  }
}

const observer = new MutationObserver((mutations) => {
  pendingMutations.push(...mutations);
  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    processMutations(pendingMutations.splice(0));
  });
});

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: OBSERVED_MEDIA_ATTRIBUTES,
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.keywords) return;
  activeKeywords = mergeActiveKeywords(changes.keywords.newValue ?? []);
  replaceAll();
});

function startContentScript() {
  loadActiveKeywords(() => {
    keywordsReady = true;
    replaceAll();
    startObserver();
  });
}

/**
 * @param {number} retriesLeft
 * @param {() => void} onReady
 */
function syncTabGeneration(retriesLeft, onReady) {
  chrome.runtime.sendMessage({ type: MESSAGE_SYNC_TAB_GENERATION }, (response) => {
    if (!chrome.runtime.lastError && typeof response?.generation === 'number') {
      adoptTabGeneration(response.generation);
      onReady();
      return;
    }

    if (retriesLeft <= 0) {
      onReady();
      return;
    }

    window.setTimeout(() => {
      syncTabGeneration(retriesLeft - 1, onReady);
    }, BADGE_RETRY_MS);
  });
}

syncTabGeneration(5, startContentScript);
