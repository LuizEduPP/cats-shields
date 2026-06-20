/**
 * Cats Shields popup — keyword management UI.
 */

let selectedPresetId = DEFAULT_PRESET_ID;
let resetPending = false;
let resetTimer = null;
let feedbackTimer = null;

const elements = {
  count: document.getElementById('count'),
  feedback: document.getElementById('feedback'),
  presetList: document.getElementById('preset-list'),
  keywordsList: document.getElementById('keywords-list'),
  keywordsEmpty: document.getElementById('keywords-empty'),
  keywordInput: document.getElementById('new-keyword'),
  resetButton: document.getElementById('reset-btn'),
};

/**
 * @param {(userKeywords: string[], activeKeywords: string[]) => void} handler
 */
function withStoredKeywords(handler) {
  readStoredUserKeywords((userKeywords, error) => {
    if (error) {
      showFeedback(error, 'error');
      return;
    }

    handler(userKeywords, mergeActiveKeywords(userKeywords));
  });
}

/**
 * @param {string[]} additions
 * @param {(addedCount: number) => void} onSuccess
 */
function appendKeywords(additions, onSuccess) {
  withStoredKeywords((userKeywords, activeKeywords) => {
    const activeSet = new Set(activeKeywords);
    const uniqueAdditions = dedupeKeywords(additions).filter(
      (keyword) => !activeSet.has(keyword),
    );

    if (!uniqueAdditions.length) {
      showFeedback(UI_COPY.applyNone, 'info');
      return;
    }

    writeStoredUserKeywords([...userKeywords, ...uniqueAdditions], (error) => {
      if (error) {
        showFeedback(error, 'error');
        return;
      }

      renderKeywordList(mergeActiveKeywords([...userKeywords, ...uniqueAdditions]));
      onSuccess(uniqueAdditions.length);
    });
  });
}

function showFeedback(message, tone = 'info') {
  const { feedback } = elements;
  if (!feedback) return;

  feedback.hidden = false;
  feedback.textContent = message;
  feedback.dataset.tone = tone;

  clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedback.hidden = true;
    feedback.textContent = '';
    delete feedback.dataset.tone;
  }, FEEDBACK_HIDE_MS);
}

/**
 * @param {string[] | null} activeKeywords
 */
function renderKeywordCount(activeKeywords) {
  const { count } = elements;
  if (!count) return;

  if (!activeKeywords) {
    count.textContent = '—';
    count.dataset.state = 'error';
    return;
  }

  count.textContent = String(activeKeywords.length);
  count.dataset.state = activeKeywords.length === 0 ? 'idle' : 'active';
}

function renderPresetList() {
  const { presetList } = elements;
  if (!presetList) return;

  presetList.innerHTML = '';

  PRESET_PACKS.forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset-card${preset.id === selectedPresetId ? ' is-active' : ''}`;
    button.setAttribute('aria-pressed', preset.id === selectedPresetId ? 'true' : 'false');

    button.addEventListener('click', () => {
      selectedPresetId = preset.id;
      renderPresetList();
    });

    button.addEventListener('dblclick', () => {
      selectedPresetId = preset.id;
      renderPresetList();
      applySelectedPreset();
    });

    const title = document.createElement('span');
    title.className = 'preset-label';
    title.textContent = preset.label;

    const meta = document.createElement('span');
    meta.className = 'preset-meta';
    meta.textContent = `${preset.keywords.length} keywords`;

    const description = document.createElement('span');
    description.className = 'preset-description';
    description.textContent = preset.description;

    button.append(title, meta, description);
    presetList.appendChild(button);
  });
}

/**
 * @param {string[]} activeKeywords
 */
function renderKeywordList(activeKeywords) {
  const { keywordsList, keywordsEmpty } = elements;

  renderKeywordCount(activeKeywords);
  keywordsList.innerHTML = '';

  if (!activeKeywords.length) {
    keywordsList.hidden = true;
    keywordsEmpty.hidden = false;
    keywordsEmpty.textContent = UI_COPY.keywordsEmpty;
    return;
  }

  keywordsList.hidden = false;
  keywordsEmpty.hidden = true;

  activeKeywords.forEach((keyword) => {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const label = document.createElement('span');
    label.className = 'chip-label';
    label.textContent = keyword;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'chip-del';
    deleteButton.textContent = '×';

    if (isDefaultKeyword(keyword)) {
      deleteButton.disabled = true;
      deleteButton.title = 'Built-in default keyword';
    } else {
      deleteButton.title = `Remove "${keyword}"`;
      deleteButton.addEventListener('click', () => {
        withStoredKeywords((userKeywords) => {
          const nextUserKeywords = userKeywords.filter((item) => item !== keyword);

          writeStoredUserKeywords(nextUserKeywords, (error) => {
            if (error) {
              showFeedback(error, 'error');
              return;
            }

            renderKeywordList(mergeActiveKeywords(nextUserKeywords));
          });
        });
      });
    }

    chip.append(label, deleteButton);
    keywordsList.appendChild(chip);
  });
}

function fillInputWithPreset() {
  const preset = getPresetById(selectedPresetId);
  elements.keywordInput.value = preset.keywords.join(', ');
  elements.keywordInput.focus();
  elements.keywordInput.select();
}

function applySelectedPreset() {
  appendKeywords(getPresetById(selectedPresetId).keywords, (addedCount) => {
    showFeedback(UI_COPY.applySuccess(addedCount), 'success');
  });
}

function addKeyword() {
  const additions = dedupeKeywords(elements.keywordInput.value.split(','));
  if (!additions.length) return;

  appendKeywords(additions, (addedCount) => {
    elements.keywordInput.value = '';
    elements.keywordInput.focus();
    showFeedback(UI_COPY.applySuccess(addedCount), 'success');
  });
}

function resetDefaults() {
  const { resetButton } = elements;

  if (!resetPending) {
    resetPending = true;
    resetButton.textContent = UI_COPY.resetConfirm;
    resetButton.classList.add('confirming');
    resetTimer = window.setTimeout(() => {
      resetPending = false;
      resetButton.textContent = UI_COPY.resetLabel;
      resetButton.classList.remove('confirming');
    }, RESET_CONFIRMATION_MS);
    return;
  }

  clearTimeout(resetTimer);
  resetPending = false;
  resetButton.textContent = UI_COPY.resetLabel;
  resetButton.classList.remove('confirming');

  writeStoredUserKeywords([], (error) => {
    if (error) {
      showFeedback(error, 'error');
      return;
    }

    renderKeywordList(mergeActiveKeywords([]));
  });
}

document.getElementById('add-btn').addEventListener('click', addKeyword);
document.getElementById('paste-pack-btn').addEventListener('click', fillInputWithPreset);
document.getElementById('apply-pack-btn').addEventListener('click', applySelectedPreset);
document.getElementById('reset-btn').addEventListener('click', resetDefaults);
elements.keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addKeyword();
});

elements.resetButton.textContent = UI_COPY.resetLabel;

renderPresetList();
readStoredUserKeywords((userKeywords, error) => {
  if (error) {
    renderKeywordCount(null);
    showFeedback(error, 'error');
    renderKeywordList([]);
    return;
  }

  renderKeywordList(mergeActiveKeywords(userKeywords));
});
