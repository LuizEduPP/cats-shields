importScripts('defaults.js');

const tabBlockCounts = new Map();
const tabGenerations = new Map();
const lastNavigationBumpMs = new Map();

function getTabGeneration(tabId) {
  const generation = tabGenerations.get(tabId);
  if (generation === undefined) {
    throw new Error(`Tab generation is not initialized for tab ${tabId}`);
  }

  return generation;
}

function ensureTabGeneration(tabId) {
  if (!tabGenerations.has(tabId)) {
    tabGenerations.set(tabId, 0);
  }

  return tabGenerations.get(tabId);
}

function bumpTabGeneration(tabId) {
  const nextGeneration = ensureTabGeneration(tabId) + 1;
  tabGenerations.set(tabId, nextGeneration);
  return nextGeneration;
}

function formatBadgeText(count) {
  if (!count || count <= 0) return '';
  if (count > BADGE_MAX_DISPLAY) return `${BADGE_MAX_DISPLAY}+`;
  return String(count);
}

function applyBadgeText(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }, consumeRuntimeError);

  if (!text) return;

  chrome.action.setBadgeBackgroundColor(
    { tabId, color: BADGE_BACKGROUND_COLOR },
    consumeRuntimeError,
  );

  if (typeof chrome.action.setBadgeTextColor === 'function') {
    chrome.action.setBadgeTextColor({ tabId, color: BADGE_TEXT_COLOR }, consumeRuntimeError);
  }
}

function setTabBlockCount(tabId, count) {
  const normalizedCount = Math.max(0, Number(count) || 0);
  tabBlockCounts.set(tabId, normalizedCount);
  applyBadgeText(tabId, formatBadgeText(normalizedCount));
}

function notifyContentReset(tabId, generation) {
  chrome.tabs.sendMessage(
    tabId,
    { type: MESSAGE_RESET_PAGE_STATE, generation },
    consumeRuntimeError,
  );
}

function beginTabNavigation(tabId, notifyContent) {
  const generation = bumpTabGeneration(tabId);
  lastNavigationBumpMs.set(tabId, Date.now());
  setTabBlockCount(tabId, 0);

  if (notifyContent) {
    notifyContentReset(tabId, generation);
  }

  return generation;
}

function notifyContentNavigationReset(tabId) {
  setTabBlockCount(tabId, 0);
  notifyContentReset(tabId, ensureTabGeneration(tabId));
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== MAIN_FRAME_ID) return;
  beginTabNavigation(details.tabId, false);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== MAIN_FRAME_ID) return;
  if (details.transitionType !== BACK_FORWARD_TRANSITION) return;
  notifyContentNavigationReset(details.tabId);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== MAIN_FRAME_ID) return;

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
      sendResponse({ ok: false });
      return true;
    }

    sendResponse({ generation: ensureTabGeneration(tabId) });
    return true;
  }

  if (message.type !== MESSAGE_UPDATE_BLOCK_COUNT) return false;

  if (tabId == null) {
    sendResponse({ ok: false });
    return true;
  }

  if (message.generation !== ensureTabGeneration(tabId)) {
    sendResponse({ ok: false, stale: true });
    return true;
  }

  setTabBlockCount(tabId, message.count);
  sendResponse({ ok: true });
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const storedCount = tabBlockCounts.get(tabId) ?? 0;
  applyBadgeText(tabId, formatBadgeText(storedCount));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlockCounts.delete(tabId);
  tabGenerations.delete(tabId);
  lastNavigationBumpMs.delete(tabId);
});
