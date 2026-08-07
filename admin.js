/* =============================================
   IBM Bee Catcher — Admin Config & Dashboard
   ============================================= */

// ── Preset Gifts (derived from images in folder) ───────────────────────────
const PRESET_GIFTS = [
  { name: 'Backpack',                  file: 'backpack.png' },
  { name: 'Drawstring Bag with Towel', file: 'drawstring bag with towel.png' },
  { name: 'Notepad',                   file: 'Notepad.png' },
  { name: 'Pouch',                     file: 'pouch.png' },
  { name: 'Umbrella',                  file: 'umbrella.png' },
];

// ── Default Config ─────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin123';
const STORAGE_KEY    = 'ibm_bee_catcher_config';

const DEFAULT_CONFIG = {
  duration:    10,
  difficulty:  'medium',
  gameTitle:   'IBM Bee Catcher',
  accentColor: '#f1c21b',
  bgColor:     '#161616',
  tiers: [
    { name: 'Bronze Bee',   minBees: 1,  gift: 'Pouch',                    giftImage: 'pouch.png' },
    { name: 'Silver Bee',   minBees: 5,  gift: 'Notepad',                  giftImage: 'Notepad.png' },
    { name: 'Golden Bee',   minBees: 10, gift: 'Drawstring Bag with Towel', giftImage: 'drawstring bag with towel.png' },
    { name: 'Diamond Bee',  minBees: 15, gift: 'Backpack',                  giftImage: 'backpack.png' },
  ],
};

// ── Config Store ───────────────────────────────────────────────────────────
const AdminConfig = {
  get() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },
  save(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  },
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const passwordModal    = document.getElementById('password-modal');
const passwordInput    = document.getElementById('password-input');
const passwordError    = document.getElementById('password-error');
const btnPwConfirm     = document.getElementById('btn-pw-confirm');
const btnPwCancel      = document.getElementById('btn-pw-cancel');

const adminOverlay     = document.getElementById('admin-overlay');
const inputDuration    = document.getElementById('input-duration');
const inputDifficulty  = document.getElementById('input-difficulty');
const inputGameTitle   = document.getElementById('input-game-title');
const inputAccentColor = document.getElementById('input-accent-color');
const inputBgColor     = document.getElementById('input-bg-color');
const tiersList        = document.getElementById('tiers-list');
const btnAddTier       = document.getElementById('btn-add-tier');
const btnSaveAdmin     = document.getElementById('btn-save-admin');
const btnCloseAdmin    = document.getElementById('btn-close-admin');

// ── Keyboard Shortcut: Ctrl + Shift + Z ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
    e.preventDefault();
    openPasswordPrompt();
  }
});

// ── Password Flow ──────────────────────────────────────────────────────────
function openPasswordPrompt() {
  passwordInput.value = '';
  passwordError.textContent = '';
  passwordModal.classList.remove('hidden');
  setTimeout(() => passwordInput.focus(), 50);
}

function closePasswordPrompt() {
  passwordModal.classList.add('hidden');
}

btnPwConfirm.addEventListener('click', checkPassword);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkPassword();
  if (e.key === 'Escape') closePasswordPrompt();
});
btnPwCancel.addEventListener('click', closePasswordPrompt);

function checkPassword() {
  if (passwordInput.value === ADMIN_PASSWORD) {
    closePasswordPrompt();
    openAdminPanel();
  } else {
    passwordError.textContent = 'Incorrect password. Please try again.';
    passwordInput.value = '';
    passwordInput.focus();
  }
}

// ── Apply appearance to the page ───────────────────────────────────────────
function applyAppearance(cfg) {
  document.documentElement.style.setProperty('--accent', cfg.accentColor || '#f1c21b');
  document.documentElement.style.setProperty('--bg',     cfg.bgColor     || '#161616');
  const titleEl = document.getElementById('game-title');
  if (titleEl) titleEl.textContent = cfg.gameTitle || 'IBM Bee Catcher';
}

// ── Admin Panel ────────────────────────────────────────────────────────────
function openAdminPanel() {
  const cfg = AdminConfig.get();

  // Populate appearance fields
  inputGameTitle.value   = cfg.gameTitle   || 'IBM Bee Catcher';
  inputAccentColor.value = cfg.accentColor || '#f1c21b';
  inputBgColor.value     = cfg.bgColor     || '#161616';

  // Populate duration & difficulty
  inputDuration.value   = cfg.duration;
  inputDifficulty.value = cfg.difficulty || 'medium';

  // Populate tiers
  renderTiers(cfg.tiers);

  adminOverlay.classList.remove('hidden');
}

function closeAdminPanel() {
  adminOverlay.classList.add('hidden');
}

btnCloseAdmin.addEventListener('click', closeAdminPanel);

btnSaveAdmin.addEventListener('click', () => {
  const duration = parseInt(inputDuration.value, 10);
  if (isNaN(duration) || duration < 5 || duration > 120) {
    alert('Duration must be between 5 and 120 seconds.');
    return;
  }

  const tiers = collectTiers();
  if (tiers === null) return; // validation failed

  const gameTitle   = inputGameTitle.value.trim() || 'IBM Bee Catcher';
  const accentColor = inputAccentColor.value;
  const bgColor     = inputBgColor.value;
  const difficulty  = inputDifficulty.value || 'medium';

  const cfg = { duration, difficulty, gameTitle, accentColor, bgColor, tiers };
  AdminConfig.save(cfg);
  applyAppearance(cfg);
  closeAdminPanel();

  // Flash confirmation
  showAdminToast('Settings saved!');
});

// ── Tier Rendering ─────────────────────────────────────────────────────────
function renderTiers(tiers) {
  tiersList.innerHTML = '';
  tiers.forEach((t) => addTierRow(t.name, t.minBees, t.gift, t.giftImage || ''));
}

function buildPresetOptions(currentGiftImage) {
  const none = `<option value="">— None —</option>`;
  const opts = PRESET_GIFTS.map(p => {
    const sel = (currentGiftImage === p.file) ? ' selected' : '';
    return `<option value="${p.file}"${sel}>${p.name}</option>`;
  }).join('');
  return none + opts;
}

function addTierRow(name = '', minBees = '', gift = '', giftImage = '') {
  const row = document.createElement('div');
  row.className = 'tier-row';

  // Determine if the stored giftImage is a preset filename or a custom base64
  const isPreset  = giftImage && !giftImage.startsWith('data:');
  const isCustom  = giftImage && giftImage.startsWith('data:');
  const previewSrc = isPreset ? giftImage : (isCustom ? giftImage : '');

  row.innerHTML = `
    <input type="text"   class="tier-name"     placeholder="Tier name"   value="${escHtml(name)}">
    <input type="number" class="tier-min-bees" placeholder="Min bees"    value="${minBees}" min="0">
    <input type="text"   class="tier-gift"     placeholder="Gift / prize" value="${escHtml(gift)}">
    <div class="tier-img-cell">
      <div class="tier-img-picker">
        <select class="tier-preset-select">${buildPresetOptions(isPreset ? giftImage : '')}</select>
        <span class="tier-img-or">or</span>
        <label class="btn-upload" title="Upload custom image">
          ${previewSrc ? `<img class="tier-img-preview" src="${previewSrc}" alt="preview">` : '<span>+ Upload</span>'}
          <input type="file" class="tier-img-input" accept="image/*" style="display:none">
        </label>
        ${previewSrc ? `<img class="tier-img-thumb" src="${previewSrc}" alt="gift preview">` : `<img class="tier-img-thumb hidden" src="" alt="gift preview">`}
      </div>
    </div>
    <button class="btn-icon" title="Remove tier">✕</button>
  `;

  // Track the resolved image (preset path or base64)
  row._giftImage = giftImage;

  const presetSelect = row.querySelector('.tier-preset-select');
  const fileInput    = row.querySelector('.tier-img-input');
  const uploadLabel  = row.querySelector('.btn-upload');
  const thumb        = row.querySelector('.tier-img-thumb');
  const giftInput    = row.querySelector('.tier-gift');

  // When a preset is chosen, update preview + auto-fill gift name
  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (val) {
      const preset = PRESET_GIFTS.find(p => p.file === val);
      row._giftImage = val;
      thumb.src = val;
      thumb.classList.remove('hidden');
      uploadLabel.innerHTML = '<span>+ Upload</span><input type="file" class="tier-img-input" accept="image/*" style="display:none">';
      reAttachFileListener(row);
      // Auto-fill gift name only if empty
      if (!giftInput.value.trim() && preset) giftInput.value = preset.name;
    } else {
      row._giftImage = '';
      thumb.src = '';
      thumb.classList.add('hidden');
    }
  });

  function reAttachFileListener(r) {
    const fi = r.querySelector('.tier-img-input');
    const ul = r.querySelector('.btn-upload');
    fi.addEventListener('change', () => {
      const file = fi.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        r._giftImage = ev.target.result;
        // Clear preset selection
        r.querySelector('.tier-preset-select').value = '';
        ul.innerHTML = `<img class="tier-img-preview" src="${ev.target.result}" alt="preview"><input type="file" class="tier-img-input" accept="image/*" style="display:none">`;
        const t = r.querySelector('.tier-img-thumb');
        t.src = ev.target.result;
        t.classList.remove('hidden');
        reAttachFileListener(r);
      };
      reader.readAsDataURL(file);
    });
  }

  reAttachFileListener(row);
  row.querySelector('.btn-icon').addEventListener('click', () => row.remove());
  tiersList.appendChild(row);
}

btnAddTier.addEventListener('click', () => addTierRow());

function collectTiers() {
  const rows = tiersList.querySelectorAll('.tier-row');
  const tiers = [];

  for (const row of rows) {
    const name    = row.querySelector('.tier-name').value.trim();
    const minBees = parseInt(row.querySelector('.tier-min-bees').value, 10);
    const gift    = row.querySelector('.tier-gift').value.trim();
    const giftImage = row._giftImage || '';

    if (!name || isNaN(minBees) || minBees < 0 || !gift) {
      alert('Please fill in all tier fields correctly (name, min bees ≥ 0, gift).');
      return null;
    }
    tiers.push({ name, minBees, gift, giftImage });
  }

  return tiers;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showAdminToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:#24a148; color:#fff; padding:12px 28px; border-radius:4px;
    font-size:1rem; font-weight:600; z-index:9999; pointer-events:none;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ── Apply saved appearance on page load ────────────────────────────────────
applyAppearance(AdminConfig.get());
