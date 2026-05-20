/**
 * popup.js — settings panel logic
 * Manages keywords saved in chrome.storage.sync
 */

// DEFAULT_KEYWORDS is defined in defaults.js (loaded before this script)

const PRESET_PACKS = [
  {
    id: 'arachnophobia',
    label: 'Arachnophobia',
    description: 'Spider-heavy pack for the true arachnophobes',
    keywords: [
      'spider', 'spiders', 'spiderweb', 'spider_web', 'spider-web',
      'spiderman', 'spider_man', 'spidey', 'spidy', 'cobweb', 'cobwebs', 'eight-legs',
      'arachnid', 'arachnids', 'arachnophobia', 'arachne', 'arachnology',
      'tarantula', 'tarantulas', 'black-widow', 'blackwidow',
      'brown-recluse', 'recluse', 'wolf-spider', 'wolfspider',
      'jumping-spider', 'orbweaver', 'orb-weaver', 'funnel-web',
      'funnelweb', 'sac-spider', 'crab-spider', 'trapdoor',
      'widow', 'hobo-spider', 'cellar-spider',
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
      'clamp'
    ]
  },
  {
    id: 'snakes',
    label: 'Snakes',
    description: 'Serpents, vipers, and all things slithery',
    keywords: [
      'snake', 'snakes', 'serpent', 'serpents', 'cobra', 'cobras',
      'viper', 'vipers', 'python', 'pythons', 'boa', 'boas',
      'rattlesnake', 'rattlesnakes', 'anaconda', 'anacondas', 'snakebite', 'snake-bite', 'snake_bite',
      'ophidian', 'ophidiophobia', 'ophioid', 'serpentine', 'colubrid',
      'cobra-de-capelo', 'cobra_de_capelo', 'cobra-capelo',
      'jararaca', 'surucucu', 'cascavel', 'naja', 'coral-verdadeira',
      'coral_verdadeira', 'coral-verdadeiro', 'coral_verdadeiro',
      'coral-true', 'coral_true', 'coraltrue'
    ],
  },
  {
    id: 'insects',
    label: 'Insects',
    description: 'Creepy crawlies of all kinds — for the entomophobes out there',
    keywords: [
      'insect', 'insects', 'bug', 'bugs', 'beetle', 'beetles',
      'roach', 'roaches', 'cockroach', 'cockroaches', 'mosquito',
      'mosquitoes', 'moth', 'moths', 'wasp', 'wasps', 'hornet',
      'hornets', 'centipede', 'centipedes', 'millipede', 'millipedes', 'aphid', 'aphids',
      'entomophobia', 'entomophagy', 'entomologist', 'entomology',
      'inseto', 'insetos', 'besouro', 'besouros', 'barata',
      'baratas', 'carrapato', 'carrapatos', 'mosquito', 'mosquitoes',
      'mariposa', 'mariposas', 'polilla', 'polillas', 'avispa',
      'avispas', 'hormiga', 'hormigas', 'ciempiés', 'ciempiés',
      'milpiés', 'milpiés'
    ],
  },
  {
    id: 'clowns',
    label: 'Clowns',
    description: 'For those who find clowns more terrifying than spiders or snakes',
    keywords: [
      'clown', 'clowns', 'creepy clown', 'circus clown', 'pennywise', 'jester', 'jesters',
      'clownfish', 'clown-fish', 'clown_fish',
      'palhaço', 'palhaços', 'palhaco', 'palhacos', 'clownfish', 'clown-fish', 'clown_fish'
    ],
  },
  {
    id: 'sharks',
    label: 'Sharks',
    description: 'For the true selachophobes — great whites, hammerheads, and all their finned friends',
    keywords: [
      'shark', 'sharks', 'great white', 'hammerhead', 'tiger shark', 'jaws', 'megalodon',
      'tiburón', 'tiburones', 'tubarão', 'tubarões', 'tiburon', 'tiburon',
      'tubarão', 'tubarões', 'tiburon', 'tiburones'
    ],
  },
  {
    id: 'needles',
    label: 'Needles',
    description: 'For those who get queasy at the sight of needles, syringes, and injections',
    keywords: [
      'needle', 'needles', 'syringe', 'syringes', 'injection', 'injections', 'vaccine needle', 'blood draw', 'phlebotomy',
      'agulha', 'agulhas', 'seringa', 'seringas', 'injeção', 'injeções', 'agulha de vacina', 'coleta de sangue', 'flebotomia'
    ],
  },
];

let selectedPresetId = PRESET_PACKS[0].id;

// ── Helpers ──────────────────────────────────────────────────────────

function load(callback) {
  chrome.storage.sync.get({ keywords: [] }, ({ keywords }) => {
    // Union with DEFAULT_KEYWORDS so new defaults appear automatically
    callback([...new Set([...DEFAULT_KEYWORDS, ...keywords])]);
  });
}

function save(keywords) {
  chrome.storage.sync.set({ keywords });
  render(keywords);
}

function getSelectedPreset() {
  return PRESET_PACKS.find((preset) => preset.id === selectedPresetId) || PRESET_PACKS[0];
}

function fillInputWithPreset() {
  const input = document.getElementById('new-keyword');
  const preset = getSelectedPreset();
  input.value = preset.keywords.join(', ');
  input.focus();
  input.select();
}

function renderPresets() {
  const list = document.getElementById('preset-list');
  if (!list) return;

  list.innerHTML = '';

  PRESET_PACKS.forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset-card${preset.id === selectedPresetId ? ' is-active' : ''}`;
    button.setAttribute('aria-pressed', preset.id === selectedPresetId ? 'true' : 'false');
    button.addEventListener('click', () => {
      selectedPresetId = preset.id;
      renderPresets();
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

    button.appendChild(title);
    button.appendChild(meta);
    button.appendChild(description);
    list.appendChild(button);
  });
}

// ── Render ───────────────────────────────────────────────────────────

function render(keywords) {
  const list  = document.getElementById('keywords-list');
  const count = document.getElementById('count');

  count.textContent = `${keywords.length} active keyword${keywords.length !== 1 ? 's' : ''}`;

  list.innerHTML = '';

  keywords.forEach((kw, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const label = document.createElement('span');
    label.textContent = kw;

    const btn = document.createElement('button');
    btn.className = 'chip-del';
    btn.title = `Remove "${kw}"`;
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      save(keywords.filter((_, idx) => idx !== i));
    });

    chip.appendChild(label);
    chip.appendChild(btn);
    list.appendChild(chip);
  });
}

// ── Add keyword ──────────────────────────────────────────────────────

function parseKeywordInput(value) {
  return [...new Set(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function addKeyword() {
  const input = document.getElementById('new-keyword');
  const values = parseKeywordInput(input.value);
  if (!values.length) return;

  load((keywords) => {
    const existing = new Set(keywords);
    const additions = values.filter((value) => !existing.has(value));

    if (!additions.length) {
      input.select();
      return;
    }

    save([...keywords, ...additions]);
    input.value = '';
    input.focus();
  });
}

document.getElementById('add-btn')
  .addEventListener('click', addKeyword);

document.getElementById('paste-pack-btn')
  .addEventListener('click', fillInputWithPreset);

document.getElementById('new-keyword')
  .addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeyword();
  });

// ── Restore defaults (two-click confirmation) ───────────────────────

let resetPending = false;
let resetTimer   = null;

document.getElementById('reset-btn').addEventListener('click', () => {
  const btn = document.getElementById('reset-btn');

  if (!resetPending) {
    resetPending = true;
    btn.textContent = '⚠ Are you sure? Click again to confirm';
    btn.classList.add('confirming');
    resetTimer = setTimeout(() => {
      resetPending = false;
      btn.textContent = '↺ Restore defaults';
      btn.classList.remove('confirming');
    }, 3000);
  } else {
    clearTimeout(resetTimer);
    resetPending = false;
    btn.textContent = '↺ Restore defaults';
    btn.classList.remove('confirming');
    save([...DEFAULT_KEYWORDS]);
  }
});

// ── Init ─────────────────────────────────────────────────────────────

renderPresets();
load(render);
