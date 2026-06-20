importScripts('defaults.js');

const tabBlockCounts = new Map();

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== MESSAGE_UPDATE_BLOCK_COUNT) return false;

  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse({ ok: false });
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
});
