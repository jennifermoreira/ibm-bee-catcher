/* =============================================
   IBM Bee Catcher — Admin Config & Dashboard
   ============================================= */

// ── Preset Gifts (derived from images in folder) ───────────────────────────
const PRESET_GIFTS = [
  { name: 'Notebook with Post-it Notes', file: 'Notebook with Post it Notes.png' },
  { name: 'Canvas Tote Bag',             file: 'Canvas Tote Bag.png' },
  { name: 'Pen',                         file: 'Pen.png' },
  { name: 'Color Changing Cup',          file: 'Color Changing Cup.png' },
  { name: 'Mobile Phone Stand',          file: 'Mobile Phone Stand.png' },
  { name: 'Notebook',                    file: 'Notebook.png' },
  { name: 'Bamboo Charging Cable Set',   file: 'Bamboo Charging Cable Set.png' },
];

// ── Default Config ─────────────────────────────────────────────────────────
const ADMIN_PASSWORD  = 'admin123';
const STORAGE_KEY     = 'ibm_bee_catcher_config_v2';
const INVENTORY_KEY   = 'ibm_bee_catcher_inventory_v2';

const DEFAULT_CONFIG = {
  duration:    10,
  difficulty:  'medium',
  gameTitle:   'IBM Bee Catcher',
  accentColor: '#f1c21b',
  bgColor:     '#161616',
  tiers: [
    {
      name: 'Bronze Bee',  minBees: 1,
      gift1: 'Notebook with Post-it Notes', giftImage1: 'Notebook with Post it Notes.png', qty1: 65,
      gift2: 'Canvas Tote Bag',             giftImage2: 'Canvas Tote Bag.png',             qty2: 70,
    },
    {
      name: 'Silver Bee',  minBees: 12,
      gift1: 'Pen',                         giftImage1: 'Pen.png',                          qty1: 100,
      gift2: '',                            giftImage2: '',                                  qty2: 0,
    },
    {
      name: 'Golden Bee',  minBees: 18,
      gift1: 'Color Changing Cup',          giftImage1: 'Color Changing Cup.png',           qty1: 100,
      gift2: '',                            giftImage2: '',                                  qty2: 0,
    },
    {
      name: 'Diamond Bee', minBees: 25,
      gift1: 'Bamboo Charging Cable Set',   giftImage1: 'Bamboo Charging Cable Set.png',   qty1: 10,
      gift2: 'Mobile Phone Stand',          giftImage2: 'Mobile Phone Stand.png',           qty2: 15,
    },
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

// ── Inventory Store ────────────────────────────────────────────────────────
// Inventory is stored separately so reloading config doesn't wipe balances.
// Shape: { [tierName]: { qty1: number, qty2: number } }
const Inventory = {
  get() {
    try {
      const stored = localStorage.getItem(INVENTORY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },
  save(inv) {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
  },
  // Initialise missing tiers from config (called after config save)
  syncFromConfig(cfg) {
    const inv = this.get();
    cfg.tiers.forEach(t => {
      if (!inv[t.name]) {
        inv[t.name] = { qty1: t.qty1, qty2: t.qty2 };
      }
    });
    this.save(inv);
    return inv;
  },
  // Fully reset a tier's balance to the config quantities (called on Save)
  resetTier(tierName, qty1, qty2) {
    const inv = this.get();
    inv[tierName] = { qty1, qty2 };
    this.save(inv);
  },
  // Deduct one gift from a tier. slot = 1 or 2. Returns true if successful.
  deduct(tierName, slot) {
    const inv = this.get();
    if (!inv[tierName]) return false;
    const key = `qty${slot}`;
    if (inv[tierName][key] > 0) {
      inv[tierName][key]--;
      this.save(inv);
      return true;
    }
    return false;
  },
  // Return remaining qty for a slot in a tier
  balance(tierName, slot) {
    const inv = this.get();
    if (!inv[tierName]) return 0;
    return inv[tierName][`qty${slot}`] || 0;
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
const inventoryBody    = document.getElementById('inventory-body');

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

  // Populate inventory balance table
  renderInventory(cfg.tiers);

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

  // Reset inventory balances to the newly saved quantities
  tiers.forEach(t => Inventory.resetTier(t.name, t.qty1, t.qty2));

  applyAppearance(cfg);
  closeAdminPanel();

  // Flash confirmation
  showAdminToast('Settings saved!');
});

// ── Inventory Balance Table ────────────────────────────────────────────────
function renderInventory(tiers) {
  const inv = Inventory.get();
  inventoryBody.innerHTML = '';

  tiers.forEach(t => {
    const b1 = inv[t.name] !== undefined ? inv[t.name].qty1 : t.qty1;
    const b2 = inv[t.name] !== undefined ? inv[t.name].qty2 : t.qty2;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="inv-tier">${escHtml(t.name)}</td>
      <td class="inv-gift">${escHtml(t.gift1 || '—')}</td>
      <td class="inv-qty ${b1 === 0 ? 'inv-empty' : ''}">${b1}</td>
      <td class="inv-gift">${escHtml(t.gift2 || '—')}</td>
      <td class="inv-qty ${b2 === 0 ? 'inv-empty' : ''}">${t.gift2 ? b2 : '—'}</td>
      <td><button class="inv-reset-btn" data-tier="${escHtml(t.name)}" data-qty1="${t.qty1}" data-qty2="${t.qty2}" title="Reset to configured quantities">↺ Reset</button></td>
    `;
    inventoryBody.appendChild(row);
  });

  // Attach reset listeners
  inventoryBody.querySelectorAll('.inv-reset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.tier;
      const q1   = parseInt(btn.dataset.qty1, 10);
      const q2   = parseInt(btn.dataset.qty2, 10);
      Inventory.resetTier(name, q1, q2);
      renderInventory(AdminConfig.get().tiers);
      showAdminToast(`Balance reset for "${name}"`);
    });
  });
}

// ── Tier Rendering ─────────────────────────────────────────────────────────
function renderTiers(tiers) {
  tiersList.innerHTML = '';
  tiers.forEach((t) => addTierRow(
    t.name, t.minBees,
    t.gift1, t.giftImage1 || '', t.qty1 || 0,
    t.gift2, t.giftImage2 || '', t.qty2 || 0,
  ));
}

function buildPresetOptions(currentGiftImage) {
  const none = `<option value="">— None —</option>`;
  const opts = PRESET_GIFTS.map(p => {
    const sel = (currentGiftImage === p.file) ? ' selected' : '';
    return `<option value="${p.file}"${sel}>${p.name}</option>`;
  }).join('');
  return none + opts;
}

function addTierRow(
  name = '', minBees = '',
  gift1 = '', giftImage1 = '', qty1 = 0,
  gift2 = '', giftImage2 = '', qty2 = 0,
) {
  const row = document.createElement('div');
  row.className = 'tier-row';

  row.innerHTML = `
    <input type="text"   class="tier-name"     placeholder="Tier name"  value="${escHtml(name)}">
    <input type="number" class="tier-min-bees" placeholder="Min bees"   value="${minBees}" min="0">
    <div class="tier-gift-pair">
      ${buildGiftSlot(1, gift1, giftImage1, qty1)}
      ${buildGiftSlot(2, gift2, giftImage2, qty2)}
    </div>
    <button class="btn-icon" title="Remove tier">✕</button>
  `;

  // Init slot state tracking
  row._giftImage1 = giftImage1;
  row._giftImage2 = giftImage2;

  // Wire up both slots
  [1, 2].forEach(slot => initSlot(row, slot));

  row.querySelector('.btn-icon').addEventListener('click', () => row.remove());
  tiersList.appendChild(row);
}

function buildGiftSlot(slot, gift, giftImage, qty) {
  const isPreset  = giftImage && !giftImage.startsWith('data:');
  const isCustom  = giftImage && giftImage.startsWith('data:');
  const previewSrc = isPreset || isCustom ? giftImage : '';
  const label = slot === 1 ? 'Gift A' : 'Gift B';

  return `
    <div class="gift-slot" data-slot="${slot}">
      <span class="gift-slot-label">${label}</span>
      <input type="text" class="tier-gift tier-gift-${slot}" placeholder="Gift name" value="${escHtml(gift)}">
      <div class="tier-img-picker">
        <select class="tier-preset-select tier-preset-select-${slot}">${buildPresetOptions(isPreset ? giftImage : '')}</select>
        <span class="tier-img-or">or</span>
        <label class="btn-upload tier-upload-${slot}" title="Upload custom image">
          ${previewSrc ? `<img class="tier-img-preview" src="${previewSrc}" alt="preview">` : '<span>+ Upload</span>'}
          <input type="file" class="tier-img-input tier-img-input-${slot}" accept="image/*" style="display:none">
        </label>
        ${previewSrc
          ? `<img class="tier-img-thumb tier-img-thumb-${slot}" src="${previewSrc}" alt="gift preview">`
          : `<img class="tier-img-thumb tier-img-thumb-${slot} hidden" src="" alt="gift preview">`
        }
      </div>
      <div class="tier-qty-row">
        <label class="tier-qty-label">Qty</label>
        <input type="number" class="tier-qty tier-qty-${slot}" placeholder="0" value="${qty}" min="0">
      </div>
    </div>
  `;
}

function initSlot(row, slot) {
  const presetSelect = row.querySelector(`.tier-preset-select-${slot}`);
  const uploadLabel  = row.querySelector(`.tier-upload-${slot}`);
  const thumb        = row.querySelector(`.tier-img-thumb-${slot}`);
  const giftInput    = row.querySelector(`.tier-gift-${slot}`);
  const imgKey       = `_giftImage${slot}`;

  // When a preset is chosen
  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (val) {
      const preset = PRESET_GIFTS.find(p => p.file === val);
      row[imgKey] = val;
      thumb.src = val;
      thumb.classList.remove('hidden');
      uploadLabel.innerHTML = `<span>+ Upload</span><input type="file" class="tier-img-input tier-img-input-${slot}" accept="image/*" style="display:none">`;
      reAttachFileListener(row, slot);
      if (!giftInput.value.trim() && preset) giftInput.value = preset.name;
    } else {
      row[imgKey] = '';
      thumb.src = '';
      thumb.classList.add('hidden');
    }
  });

  reAttachFileListener(row, slot);
}

function reAttachFileListener(row, slot) {
  const fi     = row.querySelector(`.tier-img-input-${slot}`);
  const ul     = row.querySelector(`.tier-upload-${slot}`);
  const thumb  = row.querySelector(`.tier-img-thumb-${slot}`);
  const imgKey = `_giftImage${slot}`;
  if (!fi) return;

  fi.addEventListener('change', () => {
    const file = fi.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      row[imgKey] = ev.target.result;
      row.querySelector(`.tier-preset-select-${slot}`).value = '';
      ul.innerHTML = `<img class="tier-img-preview" src="${ev.target.result}" alt="preview"><input type="file" class="tier-img-input tier-img-input-${slot}" accept="image/*" style="display:none">`;
      thumb.src = ev.target.result;
      thumb.classList.remove('hidden');
      reAttachFileListener(row, slot);
    };
    reader.readAsDataURL(file);
  });
}

btnAddTier.addEventListener('click', () => addTierRow());

function collectTiers() {
  const rows = tiersList.querySelectorAll('.tier-row');
  const tiers = [];

  for (const row of rows) {
    const name    = row.querySelector('.tier-name').value.trim();
    const minBees = parseInt(row.querySelector('.tier-min-bees').value, 10);
    const gift1   = row.querySelector('.tier-gift-1').value.trim();
    const gift2   = row.querySelector('.tier-gift-2').value.trim();
    const qty1    = parseInt(row.querySelector('.tier-qty-1').value, 10) || 0;
    const qty2    = parseInt(row.querySelector('.tier-qty-2').value, 10) || 0;
    const giftImage1 = row._giftImage1 || '';
    const giftImage2 = row._giftImage2 || '';

    if (!name || isNaN(minBees) || minBees < 0 || !gift1) {
      alert('Please fill in all tier fields correctly (name, min bees ≥ 0, and at least Gift A name).');
      return null;
    }
    tiers.push({ name, minBees, gift1, giftImage1, qty1, gift2, giftImage2, qty2 });
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
// Seed inventory for any tiers that don't yet have a balance entry
Inventory.syncFromConfig(AdminConfig.get());
