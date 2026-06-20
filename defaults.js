const DEFAULT_KEYWORDS = [];

const CAT_COUNT = 60;
const DOM_CONTEXT_MAX_DEPTH = 10;
const MIN_REPLACEMENT_SIZE_PX = 48;
const RESET_CONFIRMATION_MS = 2800;
const FEEDBACK_HIDE_MS = 2800;
const BADGE_RETRY_MS = 300;
const BADGE_MAX_DISPLAY = 999;
const BADGE_BACKGROUND_COLOR = '#ff7340';
const BADGE_TEXT_COLOR = '#ffffff';
const NAVIGATION_DEBOUNCE_MS = 150;
const TAB_GENERATION_SYNC_RETRIES = 5;
const MAIN_FRAME_ID = 0;
const BACK_FORWARD_TRANSITION = 'back_forward';

const PROFILE_HREF_PREFIX = '/@';
const AVATAR_MEDIA_PATH = '/media/auth/avatars/';
const AVATAR_BOUNDARY_SELECTOR = 'a[href^="/@"], .avatar, a.avatar';
const FAVICON_URL_MARKERS = ['favicon', '/s2/favicons', 'icon?', '/icons/'];
const STORAGE_KEYWORDS_FIELD = 'keywords';
const KEYWORD_LIST_SEPARATOR = ',';

const CONTEXT_LINK_ATTRIBUTES = ['data-lpage', 'data-url', 'data-href'];
const IMG_MATCH_ATTRIBUTES = [
  'src',
  'alt',
  'title',
  'data-src',
  'data-original',
  'data-jslayout-progressive-load',
];
const SOURCE_MATCH_ATTRIBUTES = ['srcset', 'data-srcset'];
const OBSERVED_MEDIA_ATTRIBUTES = ['src', 'srcset', 'data-src', 'data-srcset', 'data-original'];
const CARD_BOUNDARY_TAGS = ['ARTICLE', 'LI', 'SECTION'];
const CARD_BOUNDARY_DATA_ATTRIBUTES = ['data-docid', 'data-attrid', 'data-lpage'];
const MEDIA_STABLE_KEY_ATTRIBUTES = [
  'data-original',
  'data-src',
  'data-srcset',
  'srcset',
  'src',
  'alt',
  'title',
];
const AVATAR_MEDIA_ATTRIBUTES = [
  'src',
  'srcset',
  'data-src',
  'data-srcset',
  'data-original',
];

const MESSAGE_UPDATE_BLOCK_COUNT = 'UPDATE_BLOCK_COUNT';
const MESSAGE_RESET_PAGE_STATE = 'RESET_PAGE_STATE';
const MESSAGE_SYNC_TAB_GENERATION = 'SYNC_TAB_GENERATION';

const UI_COPY = {
  keywordsEmpty: 'No keywords yet. Apply a starter pack or add your own above.',
  resetLabel: '↺ Restore defaults',
  resetConfirm: '⚠ Are you sure? Click again to confirm',
  applySuccess: (count) => `Added ${count} keyword${count === 1 ? '' : 's'}`,
  applyNone: 'All pack keywords are already active',
  countUnavailable: '—',
  presetKeywordCount: (count) => `${count} keywords`,
  defaultKeywordTitle: 'Built-in default keyword',
  removeKeywordTitle: (keyword) => `Remove "${keyword}"`,
  chipDeleteLabel: '×',
};

const REPLACEMENT_COPY = {
  alt: 'A cute kitty',
  title: 'It matched a keyword, now it is a cat!',
};

function tryDecodeUriComponent(text) {
  try {
    return decodeURIComponent(text);
  } catch (error) {
    if (error instanceof URIError) return text;
    throw error;
  }
}

function normalizeMatchText(value) {
  if (value == null) return '';

  const spacedText = String(value).replace(/\+/g, ' ');
  const decodedText = tryDecodeUriComponent(spacedText);

  return decodedText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dedupeKeywords(keywords) {
  if (!Array.isArray(keywords)) {
    throw new TypeError('keywords must be an array');
  }

  return [
    ...new Set(
      keywords
        .map((keyword) => String(keyword).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function mergeActiveKeywords(userKeywords) {
  return dedupeKeywords([...DEFAULT_KEYWORDS, ...userKeywords]);
}

function isDefaultKeyword(keyword) {
  return DEFAULT_KEYWORDS.includes(keyword);
}

function matchesKeyword(text, keywords) {
  if (!text || !keywords.length) return false;

  const normalizedText = normalizeMatchText(text);
  return keywords.some((keyword) =>
    normalizedText.includes(normalizeMatchText(keyword)),
  );
}

function readStoredUserKeywords(callback) {
  chrome.storage.sync.get({ [STORAGE_KEYWORDS_FIELD]: [] }, (result) => {
    if (chrome.runtime.lastError) {
      callback(null, chrome.runtime.lastError.message);
      return;
    }

    if (!Array.isArray(result[STORAGE_KEYWORDS_FIELD])) {
      throw new TypeError('Stored keywords must be an array');
    }

    callback(dedupeKeywords(result[STORAGE_KEYWORDS_FIELD]), null);
  });
}

function writeStoredUserKeywords(userKeywords, callback) {
  const normalizedKeywords = dedupeKeywords(userKeywords);

  chrome.storage.sync.set({ [STORAGE_KEYWORDS_FIELD]: normalizedKeywords }, () => {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message);
      return;
    }

    callback(null);
  });
}

function parseKeywordInput(rawInput) {
  return dedupeKeywords(String(rawInput).split(KEYWORD_LIST_SEPARATOR));
}

const PRESET_PACKS = [
  {
    id: 'arachnophobia',
    label: 'Arachnophobia',
    description: 'Spider-heavy pack for the true arachnophobes',
    keywords: dedupeKeywords([
      'spider', 'spiders', 'spiderweb', 'spider_web', 'spider-web',
      'spiderman', 'spider_man', 'spidey', 'spidy', 'cobweb', 'cobwebs', 'eight-legs',
      'arachnid', 'arachnids', 'arachnophobia', 'arachne', 'arachnology',
      'tarantula', 'tarantulas', 'black-widow', 'blackwidow',
      'brown-recluse', 'recluse', 'wolf-spider', 'wolfspider',
      'jumping-spider', 'orbweaver', 'orb-weaver', 'funnel-web',
      'funnelweb', 'sac-spider', 'crab-spider', 'trapdoor',
      'black-widow-spider', 'hobo-spider', 'cellar-spider',
      'latrodectus', 'loxosceles', 'phoneutria', 'nephila', 'argiope',
      'lycosa', 'tegenaria', 'mygale', 'araneae', 'araneus',
      'theridiidae', 'araneidae', 'agelenidae', 'salticidae',
      'mygalomorphae', 'eresidae',
      'aranha', 'aranhas', 'aranhão', 'aranhiço',
      'teia-de-aranha', 'teia_de_aranha', 'teiadearanha',
      'aracnideo', 'aracnídeo', 'aracnofobia', 'arácnide',
      'caranguejeira', 'viuva-negra', 'viúva-negra', 'viuvanegra',
      'aranha-marrom', 'aranha_marrom', 'aranha-de-jardim',
      'aranha-lobo', 'aranha_lobo', 'aranha-saltadora',
      'scorpion', 'scorpions', 'escorpiao', 'escorpião',
    ]),
  },
  {
    id: 'snakes',
    label: 'Snakes',
    description: 'Serpents, vipers, and all things slithery',
    keywords: dedupeKeywords([
      'snake', 'snakes', 'serpent', 'serpents', 'cobra', 'cobras',
      'viper', 'vipers', 'python', 'pythons', 'boa', 'boas',
      'rattlesnake', 'rattlesnakes', 'anaconda', 'anacondas',
      'snakebite', 'snake-bite', 'snake_bite',
      'ophidian', 'ophidiophobia', 'ophioid', 'serpentine', 'colubrid',
      'cobra-de-capelo', 'cobra_de_capelo', 'cobra-capelo',
      'jararaca', 'surucucu', 'cascavel', 'naja', 'coral-verdadeira',
      'coral_verdadeira', 'coral-verdadeiro', 'coral_verdadeiro',
      'coral-true', 'coral_true', 'coraltrue',
    ]),
  },
  {
    id: 'insects',
    label: 'Insects',
    description: 'Creepy crawlies of all kinds — for the entomophobes out there',
    keywords: dedupeKeywords([
      'insect', 'insects', 'beetle', 'beetles',
      'roach', 'roaches', 'cockroach', 'cockroaches', 'mosquito', 'mosquitoes',
      'moth', 'moths', 'wasp', 'wasps', 'hornet', 'hornets',
      'centipede', 'centipedes', 'millipede', 'millipedes', 'aphid', 'aphids',
      'entomophobia', 'entomophagy', 'entomologist', 'entomology',
      'inseto', 'insetos', 'besouro', 'besouros', 'barata', 'baratas',
      'carrapato', 'carrapatos', 'mariposa', 'mariposas', 'polilla', 'polillas',
      'avispa', 'avispas', 'hormiga', 'hormigas', 'ciempiés', 'milpiés',
    ]),
  },
  {
    id: 'clowns',
    label: 'Clowns',
    description: 'For those who find clowns more terrifying than spiders or snakes',
    keywords: dedupeKeywords([
      'clown', 'clowns', 'creepy clown', 'circus clown', 'pennywise', 'jester', 'jesters',
      'clownfish', 'clown-fish', 'clown_fish',
      'palhaço', 'palhaços', 'palhaco', 'palhacos',
    ]),
  },
  {
    id: 'sharks',
    label: 'Sharks',
    description: 'For the true selachophobes — great whites, hammerheads, and all their finned friends',
    keywords: dedupeKeywords([
      'shark', 'sharks', 'great white', 'hammerhead', 'tiger shark', 'jaws', 'megalodon',
      'tiburón', 'tiburones', 'tubarão', 'tubarões', 'tiburon',
    ]),
  },
  {
    id: 'needles',
    label: 'Needles',
    description: 'For those who get queasy at the sight of needles, syringes, and injections',
    keywords: dedupeKeywords([
      'needle', 'needles', 'syringe', 'syringes', 'injection', 'injections',
      'vaccine needle', 'blood draw', 'phlebotomy',
      'agulha', 'agulhas', 'seringa', 'seringas', 'injeção', 'injeções',
      'agulha de vacina', 'coleta de sangue', 'flebotomia',
    ]),
  },
];

const DEFAULT_PRESET_ID = PRESET_PACKS[0].id;

function getPresetById(presetId) {
  const preset = PRESET_PACKS.find((pack) => pack.id === presetId);
  if (!preset) {
    throw new Error(`Unknown preset id: ${presetId}`);
  }

  return preset;
}

function consumeRuntimeError() {
  void chrome.runtime.lastError;
}
