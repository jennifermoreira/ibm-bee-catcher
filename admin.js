/* =============================================
   IBM Bee Catcher — Admin Config & Dashboard
   ============================================= */

// ── Firebase Realtime Database — Live Inventory Sync ──────────────────────
// Replace the firebaseConfig values with your own project's config from:
//   Firebase Console → Project Settings → Your apps → SDK setup and configuration
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAZEAE11dqH-JjBc0HQDp_6fczhTlD6Uyc",
  authDomain:        "ibm-bee-catcher.firebaseapp.com",
  databaseURL:       "https://ibm-bee-catcher-default-rtdb.firebaseio.com",
  projectId:         "ibm-bee-catcher",
  storageBucket:     "ibm-bee-catcher.firebasestorage.app",
  messagingSenderId: "838675101899",
  appId:             "1:838675101899:web:5e7de44175daef600a834e",
};

// Firebase app + database reference (null until initFirebase() succeeds)
let _fbDb = null;
const FB_INV_PATH   = 'ibm_bee_catcher/inventory';
const FB_DAILY_PATH = 'ibm_bee_catcher/daily';

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _fbDb = firebase.database();
  } catch (e) {
    console.warn('[BeeCatcher] Firebase init failed — falling back to localStorage only.', e);
    _fbDb = null;
  }
}

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
// Primary store: Firebase Realtime Database (live, shared across all devices)
// Fallback store: localStorage (used when Firebase is unavailable)
//
// Shape in both stores: { [tierName]: { qty1: number, qty2: number } }
const Inventory = {
  // ── localStorage helpers (fast local cache + offline fallback) ────────────
  _localGet() {
    try {
      const stored = localStorage.getItem(INVENTORY_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  },
  _localSave(inv) {
    try { localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv)); } catch {}
  },

  // ── Synchronous read — returns local cache instantly ────────────────────
  // Firebase writes update the local cache via the live listener, so this
  // is always up-to-date after the first remote sync.
  get() {
    return this._localGet();
  },

  // ── Write to Firebase (primary) and localStorage (cache) ─────────────────
  save(inv) {
    this._localSave(inv);
    if (_fbDb) {
      _fbDb.ref(FB_INV_PATH).set(inv).catch(e =>
        console.warn('[BeeCatcher] Firebase write failed:', e)
      );
    }
  },

  // ── Initialise missing tiers from config ──────────────────────────────────
  syncFromConfig(cfg) {
    const inv = this.get();
    cfg.tiers.forEach(t => {
      if (!inv[t.name]) inv[t.name] = { qty1: t.qty1, qty2: t.qty2 };
    });
    this.save(inv);
    return inv;
  },

  // ── Reset a tier's balance to configured quantities ───────────────────────
  resetTier(tierName, qty1, qty2) {
    const inv = this.get();
    inv[tierName] = { qty1, qty2 };
    this.save(inv);
  },

  // ── Atomic deduct via Firebase transaction (safe under concurrent play) ───
  deduct(tierName, slot) {
    const key = `qty${slot}`;

    if (_fbDb) {
      // Firebase transaction ensures no two simultaneous games over-deduct
      _fbDb.ref(`${FB_INV_PATH}/${tierName}/${key}`).transaction(current => {
        if (current === null || current <= 0) return; // abort — nothing to deduct
        return current - 1;
      }).then(result => {
        if (result.committed) {
          // Mirror the committed value into the local cache
          const inv = this._localGet();
          if (!inv[tierName]) inv[tierName] = {};
          inv[tierName][key] = result.snapshot.val();
          this._localSave(inv);
        }
      }).catch(e => console.warn('[BeeCatcher] Firebase deduct transaction failed:', e));

      // Optimistically deduct from local cache so the result screen is instant
      const inv = this._localGet();
      if (!inv[tierName]) return false;
      if ((inv[tierName][key] || 0) > 0) {
        inv[tierName][key]--;
        this._localSave(inv);
        DailyStats.record(tierName, slot);
        return true;
      }
      return false;
    }

    // No Firebase — pure localStorage path
    const inv = this._localGet();
    if (!inv[tierName]) return false;
    if ((inv[tierName][key] || 0) > 0) {
      inv[tierName][key]--;
      this._localSave(inv);
      DailyStats.record(tierName, slot);
      return true;
    }
    return false;
  },

  // ── Return remaining qty for a slot (from local cache) ────────────────────
  balance(tierName, slot) {
    const inv = this._localGet();
    if (!inv[tierName]) return 0;
    return inv[tierName][`qty${slot}`] || 0;
  },
};

// ── Daily Stats Store ──────────────────────────────────────────────────────
// Records every gift distributed, keyed by today's local date (YYYY-MM-DD).
// Firebase path: ibm_bee_catcher/daily/YYYY-MM-DD/{tierName}/{slotKey} = count
// localStorage fallback key: ibm_bee_catcher_daily_YYYY-MM-DD
const DailyStats = {
  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  _lsKey(dateKey) {
    return `ibm_bee_catcher_daily_${dateKey}`;
  },
  _localGet(dateKey) {
    try {
      const raw = localStorage.getItem(this._lsKey(dateKey));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },
  _localSave(dateKey, data) {
    try { localStorage.setItem(this._lsKey(dateKey), JSON.stringify(data)); } catch {}
  },

  // Record one gift being distributed (called from Inventory.deduct)
  record(tierName, slot) {
    const dateKey = this._todayKey();
    const slotKey = `slot${slot}`;

    // Local cache update
    const local = this._localGet(dateKey);
    if (!local[tierName]) local[tierName] = { slot1: 0, slot2: 0 };
    local[tierName][slotKey] = (local[tierName][slotKey] || 0) + 1;
    this._localSave(dateKey, local);

    // Firebase atomic increment
    if (_fbDb) {
      _fbDb.ref(`${FB_DAILY_PATH}/${dateKey}/${tierName}/${slotKey}`)
        .transaction(cur => (cur || 0) + 1)
        .catch(e => console.warn('[BeeCatcher] DailyStats Firebase write failed:', e));
    }
  },

  // Get today's stats (from local cache, kept current by listener)
  getToday() {
    return this._localGet(this._todayKey());
  },

  // Reset today's distribution counts to zero in both Firebase and localStorage
  resetToday() {
    const dateKey = this._todayKey();
    this._localSave(dateKey, {});
    if (_fbDb) {
      _fbDb.ref(`${FB_DAILY_PATH}/${dateKey}`).set({})
        .catch(e => console.warn('[BeeCatcher] DailyStats reset failed:', e));
    }
  },
};

// ── Live Firebase Listener — keeps local cache and admin panel in sync ──────
// Called once Firebase is ready. Any change written by any device anywhere
// instantly propagates here via WebSocket push.
function attachFirebaseInventoryListener() {
  if (!_fbDb) return;

  // Inventory balance listener
  _fbDb.ref(FB_INV_PATH).on('value', snapshot => {
    const remote = snapshot.val();
    if (!remote) return;
    Inventory._localSave(remote);
    if (!adminOverlay.classList.contains('hidden')) {
      renderInventory(AdminConfig.get().tiers);
    }
  }, e => console.warn('[BeeCatcher] Firebase inventory listener error:', e));

  // Daily stats listener — today's date only
  const today = DailyStats._todayKey();
  _fbDb.ref(`${FB_DAILY_PATH}/${today}`).on('value', snapshot => {
    const remote = snapshot.val();
    DailyStats._localSave(today, remote || {});
    if (!adminOverlay.classList.contains('hidden')) {
      renderDailyStats(AdminConfig.get().tiers);
    }
  }, e => console.warn('[BeeCatcher] Firebase daily listener error:', e));
}

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

// ── Long-Press on Bee Logo (mobile admin trigger — hold 3 seconds) ──────────
(function attachLongPress() {
  const target   = document.getElementById('start-screen');
  const logoArea = target ? target.querySelector('.logo-area') : null;
  if (!logoArea) return;

  // Prevent browser text-selection / context-menu / scroll hijack on the logo
  logoArea.style.touchAction  = 'none';
  logoArea.style.userSelect   = 'none';
  logoArea.style.webkitUserSelect = 'none';

  const HOLD_MS  = 3000;
  const RADIUS   = 22;           // SVG ring radius
  const CIRC     = 2 * Math.PI * RADIUS;

  let _holdTimer  = null;
  let _rafId      = null;
  let _startTime  = 0;
  let _startX     = 0;
  let _startY     = 0;
  let _svgEl      = null;
  let _arcEl      = null;       // the animated stroke arc

  // ── Build an SVG progress ring ──────────────────────────────────────────
  function _createRing() {
    if (_svgEl) return;
    const size = RADIUS * 2 + 10;
    _svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    _svgEl.setAttribute('width',  size);
    _svgEl.setAttribute('height', size);
    _svgEl.setAttribute('viewBox', `0 0 ${size} ${size}`);
    _svgEl.id = 'admin-long-press-ring';

    // Background circle
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', size / 2);
    bg.setAttribute('cy', size / 2);
    bg.setAttribute('r',  RADIUS);
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke', 'rgba(241,194,27,0.2)');
    bg.setAttribute('stroke-width', '3');
    _svgEl.appendChild(bg);

    // Animated arc
    _arcEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    _arcEl.setAttribute('cx', size / 2);
    _arcEl.setAttribute('cy', size / 2);
    _arcEl.setAttribute('r',  RADIUS);
    _arcEl.setAttribute('fill', 'none');
    _arcEl.setAttribute('stroke', '#f1c21b');
    _arcEl.setAttribute('stroke-width', '3');
    _arcEl.setAttribute('stroke-linecap', 'round');
    _arcEl.setAttribute('stroke-dasharray',  CIRC);
    _arcEl.setAttribute('stroke-dashoffset', CIRC);   // starts empty
    // Rotate so arc starts at the top
    _arcEl.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    _svgEl.appendChild(_arcEl);

    document.body.appendChild(_svgEl);
  }

  function _removeRing() {
    cancelAnimationFrame(_rafId);
    _rafId = null;
    if (_svgEl) { _svgEl.remove(); _svgEl = null; _arcEl = null; }
  }

  // ── rAF loop: drive the arc with elapsed time (no CSS transition needed) ──
  function _animateRing() {
    if (!_arcEl) return;
    const elapsed  = Date.now() - _startTime;
    const progress = Math.min(elapsed / HOLD_MS, 1);
    _arcEl.setAttribute('stroke-dashoffset', CIRC * (1 - progress));
    if (progress < 1) _rafId = requestAnimationFrame(_animateRing);
  }

  // ── Touch handlers ──────────────────────────────────────────────────────
  function _onStart(e) {
    if (e.touches && e.touches.length > 1) return; // ignore multi-touch
    const touch = e.touches ? e.touches[0] : e;
    _startX = touch.clientX;
    _startY = touch.clientY;
    _startTime = Date.now();

    e.preventDefault();
    _createRing();
    _rafId = requestAnimationFrame(_animateRing);

    _holdTimer = setTimeout(() => {
      _removeRing();
      openPasswordPrompt();
    }, HOLD_MS);
  }

  function _onEnd() {
    clearTimeout(_holdTimer);
    _holdTimer = null;
    _removeRing();
  }

  function _onMove(e) {
    if (_holdTimer === null) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - _startX;
    const dy = touch.clientY - _startY;
    if (Math.sqrt(dx * dx + dy * dy) > 12) _onEnd();
  }

  logoArea.addEventListener('touchstart',  _onStart, { passive: false });
  logoArea.addEventListener('touchend',    _onEnd);
  logoArea.addEventListener('touchcancel', _onEnd);
  logoArea.addEventListener('touchmove',   _onMove,  { passive: false });
})();

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

  // Populate today's distribution summary (top of panel)
  renderDailyStats(cfg.tiers);

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

// ── Daily Stats Render ─────────────────────────────────────────────────────
function renderDailyStats(tiers) {
  const statsBody  = document.getElementById('daily-stats-body');
  const statsBadge = document.getElementById('daily-stats-total');
  if (!statsBody || !statsBadge) return;

  const today = DailyStats._todayKey();
  const data  = DailyStats.getToday();

  // Stamp the date label
  const dateEl = document.getElementById('daily-stats-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  let grandTotal = 0;
  statsBody.innerHTML = '';

  tiers.forEach(t => {
    const entry  = data[t.name] || {};
    const c1 = entry.slot1 || 0;
    const c2 = entry.slot2 || 0;
    const rowTotal = c1 + c2;
    grandTotal += rowTotal;

    if (rowTotal === 0 && !entry.slot1 && !entry.slot2) {
      // Still render the row so the admin sees all tiers, even at zero
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="inv-tier">${escHtml(t.name)}</td>
      <td class="inv-gift">${escHtml(t.gift1 || '—')}</td>
      <td class="daily-count ${c1 > 0 ? 'daily-count-active' : ''}">${c1}</td>
      <td class="inv-gift">${t.gift2 ? escHtml(t.gift2) : '—'}</td>
      <td class="daily-count ${c2 > 0 ? 'daily-count-active' : ''}">${t.gift2 ? c2 : '—'}</td>
      <td class="daily-row-total">${rowTotal}</td>
    `;
    statsBody.appendChild(row);
  });

  statsBadge.textContent = grandTotal;
  statsBadge.className   = grandTotal > 0 ? 'daily-total-badge daily-total-active' : 'daily-total-badge';
}

// ── Reset Distribution Button ──────────────────────────────────────────────
document.getElementById('btn-reset-daily').addEventListener('click', () => {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const confirmed = window.confirm(`Reset today's distribution counts to zero?\n\n${today}\n\nThis cannot be undone.`);
  if (!confirmed) return;
  DailyStats.resetToday();
  renderDailyStats(AdminConfig.get().tiers);
  showAdminToast("Today's distribution has been reset to zero.");
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

// ── Boot Firebase and attach live listener ─────────────────────────────────
initFirebase();
attachFirebaseInventoryListener();
