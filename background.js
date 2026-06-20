importScripts('defaults.js');

const tabBlockCounts = new Map();
const tabGenerations = new Map();
const lastNavigationBumpMs = new Map();

const NAVIGATION_DEBOUNCE_MS = 150;

/**
 * @param {number} tabId
 * @returns {number}
 */
function getTabGeneration(tabId) {
  return tabGenerations.get(tabId) ?? 0;
}

/**
 * @param {number} tabId
 * @returns {number}
 */
function bumpTabGeneration(tabId) {
  const nextGeneration = getTabGeneration(tabId) + 1;
  tabGenerations.set(tabId, nextGeneration);
  return nextGeneration;
}

/**
 * @param {number} count
 * @returns {string}
 */
function formatBadgeText(count) {
  if (!count || count <= 0) return '';
  if (count > BADGE_MAX_DISPLAY) return `${BADGE_MAX_DISPLAY}+`;
  return String(count);
}

/**
 * @param {number} tabId
 * @param {string} text
 */
function applyBadgeText(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }, () => {
    void chrome.runtime.lastError;
  });

  if (!text) return;

  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_BACKGROUND_COLOR }, () => {
    void chrome.runtime.lastError;
  });

  if (typeof chrome.action.setBadgeTextColor === 'function') {
    chrome.action.setBadgeTextColor({ tabId, color: BADGE_TEXT_COLOR }, () => {
      void chrome.runtime.lastError;
    });
  }
}

/**
 * @param {number} tabId
 * @param {number} count
 */
function setTabBlockCount(tabId, count) {
  const normalizedCount = Math.max(0, Number(count) || 0);
  tabBlockCounts.set(tabId, normalizedCount);
  applyBadgeText(tabId, formatBadgeText(normalizedCount));
}

/**
 * @param {number} tabId
 * @param {number} generation
 */
function notifyContentReset(tabId, generation) {
  chrome.tabs.sendMessage(
    tabId,
    { type: MESSAGE_RESET_PAGE_STATE, generation },
    () => {
      void chrome.runtime.lastError;
    },
  );
}

/**
 * @param {number} tabId
 * @param {boolean} notifyContent
 * @returns {number}
 */
function beginTabNavigation(tabId, notifyContent) {
  const generation = bumpTabGeneration(tabId);
  lastNavigationBumpMs.set(tabId, Date.now());
  setTabBlockCount(tabId, 0);

  if (notifyContent) {
    notifyContentReset(tabId, generation);
  }

  return generation;
}

/**
 * @param {number} tabId
 */
function notifyContentNavigationReset(tabId) {
  setTabBlockCount(tabId, 0);
  notifyContentReset(tabId, getTabGeneration(tabId));
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  beginTabNavigation(details.tabId, false);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (details.transitionType !== 'back_forward') return;
  notifyContentNavigationReset(details.tabId);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;

  const lastBumpMs = lastNavigationBumpMs.get(details.tabId) ?? 0;
  if (Date.now() - lastBumpMs < NAVIGATION_DEBOUNCE_MS) {
    notifyContentNavigationReset(details.tabId);
    return;
  }

  beginTabNavigation(details.tabId, true);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.type === MESSAGE_SYNC_TAB_GENERATION) {
    if (tabId == null) {
      sendResponse({ generation: 0 });
      return true;
    }

    if (!tabGenerations.has(tabId)) {
      tabGenerations.set(tabId, 0);
    }

    sendResponse({ generation: getTabGeneration(tabId) });
    return true;
  }

  if (message.type !== MESSAGE_UPDATE_BLOCK_COUNT) return false;

  if (tabId == null) {
    sendResponse({ ok: false });
    return true;
  }

  if (message.generation !== getTabGeneration(tabId)) {
    sendResponse({ ok: false, stale: true });
    return true;
  }

  setTabBlockCount(tabId, message.count);
  sendResponse({ ok: true });
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  applyBadgeText(tabId, formatBadgeText(tabBlockCounts.get(tabId) ?? 0));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlockCounts.delete(tabId);
  tabGenerations.delete(tabId);
  lastNavigationBumpMs.delete(tabId);
});
