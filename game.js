/* =============================================
   IBM Bee Catcher — Game Engine
   ============================================= */

// ── IBM Bee image src (replaced with base64 in bundled version) ────────────
const BEE_SRC = 'IBM Bee.png';
const BEE_HTML = '<img src="' + BEE_SRC + '" alt="IBM Bee" style="width:100%;height:100%;object-fit:contain;pointer-events:none;">';

// ── Audio (Web Audio API — lazy init to avoid file:// autoplay block) ──────
let AudioCtx = null;
function getAudioCtx() {
  if (!AudioCtx) {
    try {
      AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { AudioCtx = null; }
  }
  return AudioCtx;
}

function playTone(freq, type = 'sine', duration = 0.12, gain = 0.3, delay = 0) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(0, ctx.currentTime + delay);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch(e) {}
}

function playCatchSound() {
  // Bright upbeat double-pop
  playTone(520, 'triangle', 0.08, 0.35, 0);
  playTone(780, 'triangle', 0.08, 0.25, 0.07);
}

function playComboSound(combo) {
  const base = 440 + (combo - 2) * 80;
  playTone(base,        'triangle', 0.1,  0.3,  0);
  playTone(base * 1.25, 'triangle', 0.1,  0.25, 0.08);
  playTone(base * 1.5,  'triangle', 0.12, 0.2,  0.16);
}

function playBeepSound() {
  // Ticking beep for last 3 seconds
  playTone(880, 'square', 0.07, 0.2, 0);
}

function playFanfare() {
  // Victory arpeggio
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => playTone(f, 'triangle', 0.18, 0.28, i * 0.13));
}

function playCelebration() {
  // Big chord swell — layered major chord
  const chord = [523, 659, 784, 1047];
  chord.forEach((f, i) => playTone(f, 'triangle', 0.55, 0.22, i * 0.04));
  // Sparkle layer — rapid high-pitched pings
  const sparkle = [1568, 1760, 2093, 1568, 2349];
  sparkle.forEach((f, i) => playTone(f, 'sine', 0.12, 0.15, 0.3 + i * 0.1));
  // Bass thump
  playTone(130, 'sine', 0.3, 0.4, 0);
  playTone(165, 'sine', 0.2, 0.3, 0.18);
}

// ── Resume AudioContext on first interaction ───────────────────────────────
document.addEventListener('pointerdown', () => {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: true });

// ── Game State ─────────────────────────────────────────────────────────────
const GameState = {
  score: 0,
  timeLeft: 0,
  bees: [],
  timerInterval: null,
  animFrame: null,
  running: false,
  lastCatchTime: 0,
  combo: 0,
  comboTimer: null,
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const screens = {
  start:  document.getElementById('start-screen'),
  game:   document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
};
const hudScore      = document.getElementById('hud-score');
const hudTimer      = document.getElementById('hud-timer');
const canvasArea    = document.getElementById('game-canvas-area');
const resultBees      = document.getElementById('result-bees');
const resultPrize     = document.getElementById('result-prize-box');
const resultGiftPanel = document.getElementById('result-gift-panel');
const resultNoPrize   = document.getElementById('result-no-prize');
const btnStart      = document.getElementById('btn-start');
const btnPlayAgain  = document.getElementById('btn-play-again');
const bgCanvas      = document.getElementById('bg-canvas');

// ── Hexagon Background ─────────────────────────────────────────────────────
let bgCtx, hexParticles = [];

function initBackground() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  bgCtx = bgCanvas.getContext('2d');
  hexParticles = [];
  const count = Math.floor((bgCanvas.width * bgCanvas.height) / 28000);
  for (let i = 0; i < count; i++) {
    hexParticles.push({
      x:     Math.random() * bgCanvas.width,
      y:     Math.random() * bgCanvas.height,
      size:  14 + Math.random() * 22,
      alpha: 0.04 + Math.random() * 0.1,
      speed: 0.12 + Math.random() * 0.22,
      drift: (Math.random() - 0.5) * 0.15,
    });
  }
}

function drawHex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
            : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

function animateBackground() {
  if (!bgCtx) return;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  for (const p of hexParticles) {
    p.y -= p.speed;
    p.x += p.drift;
    if (p.y + p.size < 0) { p.y = bgCanvas.height + p.size; p.x = Math.random() * bgCanvas.width; }
    if (p.x < -p.size)    p.x = bgCanvas.width  + p.size;
    if (p.x > bgCanvas.width  + p.size) p.x = -p.size;
    bgCtx.strokeStyle = `rgba(241,194,27,${p.alpha})`;
    bgCtx.lineWidth = 1;
    drawHex(bgCtx, p.x, p.y, p.size);
    bgCtx.stroke();
  }
  requestAnimationFrame(animateBackground);
}

window.addEventListener('resize', initBackground);

// ── Particle Burst ─────────────────────────────────────────────────────────
function spawnParticles(x, y) {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const dist  = 40 + Math.random() * 50;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.left = x + 'px';
    p.style.top  = y + 'px';
    p.style.setProperty('--tx', tx + 'px');
    p.style.setProperty('--ty', ty + 'px');
    p.style.background = Math.random() > 0.4 ? '#f1c21b' : '#ffffff';
    p.style.width  = (4 + Math.random() * 5) + 'px';
    p.style.height = p.style.width;
    canvasArea.appendChild(p);
    setTimeout(() => p.remove(), 600);
  }
}

// ── Screen Shake ───────────────────────────────────────────────────────────
function shakeScreen() {
  canvasArea.classList.remove('shake');
  void canvasArea.offsetWidth; // reflow to restart animation
  canvasArea.classList.add('shake');
}

// ── Combo Flash ────────────────────────────────────────────────────────────
function showCombo(combo) {
  const old = document.getElementById('combo-banner');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'combo-banner';
  el.className = 'combo-banner';
  el.textContent = `COMBO ×${combo}!`;
  canvasArea.appendChild(el);
  clearTimeout(GameState.comboTimer);
  GameState.comboTimer = setTimeout(() => el.remove(), 900);
}

// ── Bee Management ─────────────────────────────────────────────────────────
// ── Difficulty speed multipliers ───────────────────────────────────────────
const DIFFICULTY_SPEED = { easy: 0.6, medium: 1.0, hard: 1.7, insane: 2.8 };

function getSpeedMultiplier() {
  const cfg = AdminConfig.get();
  return DIFFICULTY_SPEED[cfg.difficulty] || 1.0;
}

function spawnBee() {
  const area  = canvasArea.getBoundingClientRect();
  const size  = 56 + Math.random() * 20;
  const speed = getSpeedMultiplier();

  const bee = {
    el: document.createElement('div'),
    x: Math.random() * (area.width  - size),
    y: Math.random() * (area.height - size),
    vx: (Math.random() * 2 + 1.2) * speed * (Math.random() < 0.5 ? 1 : -1),
    vy: (Math.random() * 2 + 1.2) * speed * (Math.random() < 0.5 ? 1 : -1),
    size,
    wobble: Math.random() * Math.PI * 2,
  };

  bee.el.className = 'bee';
  bee.el.style.width  = size + 'px';
  bee.el.style.height = size + 'px';
  bee.el.innerHTML = BEE_HTML;

  bee.el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!GameState.running) return;
    catchBee(bee);
  });

  canvasArea.appendChild(bee.el);
  GameState.bees.push(bee);
}

function catchBee(bee) {
  GameState.score++;
  updateHUD();

  // Combo tracking
  const now = Date.now();
  if (now - GameState.lastCatchTime < 800) {
    GameState.combo++;
    if (GameState.combo >= 2) {
      showCombo(GameState.combo);
      playComboSound(GameState.combo);
    }
  } else {
    GameState.combo = 1;
    playCatchSound();
  }
  GameState.lastCatchTime = now;

  // Effects
  const cx = bee.x + bee.size / 2;
  const cy = bee.y + bee.size / 2;
  spawnParticles(cx, cy);
  showBurst(cx, cy, GameState.combo);
  shakeScreen();

  bee.el.remove();
  GameState.bees = GameState.bees.filter(b => b !== bee);
  spawnBee();
}

function showBurst(x, y, combo) {
  const burst = document.createElement('div');
  burst.className = 'catch-burst';
  const label = combo >= 2 ? `+${combo}` : '+1';
  burst.innerHTML = `${label} <img src="${BEE_SRC}" alt="bee" style="width:20px;height:20px;vertical-align:middle;object-fit:contain;">`;
  burst.style.left = x + 'px';
  burst.style.top  = y + 'px';
  canvasArea.appendChild(burst);
  setTimeout(() => burst.remove(), 650);
}

// ── Animation Loop ─────────────────────────────────────────────────────────
function tick() {
  if (!GameState.running) return;

  const area = canvasArea.getBoundingClientRect();

  for (const bee of GameState.bees) {
    bee.wobble += 0.04;
    bee.x += bee.vx + Math.sin(bee.wobble) * 0.4;
    bee.y += bee.vy + Math.cos(bee.wobble * 0.7) * 0.4;

    if (bee.x < 0) { bee.x = 0; bee.vx = Math.abs(bee.vx); }
    if (bee.y < 0) { bee.y = 0; bee.vy = Math.abs(bee.vy); }
    if (bee.x + bee.size > area.width)  { bee.x = area.width  - bee.size; bee.vx = -Math.abs(bee.vx); }
    if (bee.y + bee.size > area.height) { bee.y = area.height - bee.size; bee.vy = -Math.abs(bee.vy); }

    bee.el.style.left      = bee.x + 'px';
    bee.el.style.top       = bee.y + 'px';
    bee.el.style.transform = `rotate(${Math.sin(bee.wobble) * 12}deg)`;
  }

  GameState.animFrame = requestAnimationFrame(tick);
}

// ── HUD ────────────────────────────────────────────────────────────────────
function updateHUD() {
  hudScore.innerHTML = `<img src="${BEE_SRC}" alt="bee" style="width:24px;height:24px;vertical-align:middle;object-fit:contain;margin-right:6px;">${GameState.score}`;
}

// ── Start Game ─────────────────────────────────────────────────────────────
function startGame() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();

  const cfg = AdminConfig.get();

  // Stop any previous game still running
  clearInterval(GameState.timerInterval);
  cancelAnimationFrame(GameState.animFrame);

  GameState.score = 0;
  GameState.timeLeft = cfg.duration;
  GameState.running = true;
  GameState.bees = [];
  GameState.combo = 0;
  GameState.lastCatchTime = 0;

  // Clear bees/particles but keep bgCanvas by removing everything except it
  Array.from(canvasArea.children).forEach(child => {
    if (child !== bgCanvas) child.remove();
  });

  updateHUD();
  hudTimer.textContent = GameState.timeLeft;
  hudTimer.classList.remove('urgent');

  showScreen('game');

  for (let i = 0; i < 3; i++) spawnBee();

  GameState.animFrame = requestAnimationFrame(tick);

  GameState.timerInterval = setInterval(() => {
    GameState.timeLeft--;
    hudTimer.textContent = GameState.timeLeft;

    if (GameState.timeLeft <= 3 && GameState.timeLeft > 0) {
      hudTimer.classList.add('urgent');
      playBeepSound();
    }

    if (GameState.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// ── End Game ───────────────────────────────────────────────────────────────
function endGame() {
  GameState.running = false;
  clearInterval(GameState.timerInterval);
  cancelAnimationFrame(GameState.animFrame);
  playFanfare();
  showResult(GameState.score);
}

// ── Confetti ───────────────────────────────────────────────────────────────
function launchConfetti() {
  const colours = ['#f1c21b', '#0f62fe', '#ffffff', '#24a148', '#ee5396', '#ff832b', '#a56eff'];
  const resultScreen = document.getElementById('result-screen');
  // Clear any old confetti
  resultScreen.querySelectorAll('.confetti').forEach(c => c.remove());

  for (let i = 0; i < 120; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    const size = 6 + Math.random() * 8;
    c.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size * (Math.random() > 0.5 ? 1 : 2.5)}px;
      background: ${colours[Math.floor(Math.random() * colours.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 1.2}s;
      animation-duration: ${1.8 + Math.random() * 1.4}s;
      transform: rotate(${Math.random() * 360}deg);
    `;
    resultScreen.appendChild(c);
    // Remove after animation
    setTimeout(() => c.remove(), 4000);
  }
}

// ── Light flash ────────────────────────────────────────────────────────────
function flashLight() {
  const resultScreen = document.getElementById('result-screen');
  const flash = document.createElement('div');
  flash.className = 'light-flash';
  resultScreen.appendChild(flash);
  setTimeout(() => flash.remove(), 1000);
}

// ── Result Screen ──────────────────────────────────────────────────────────
function showResult(score) {
  const cfg = AdminConfig.get();

  resultBees.innerHTML = `${score}<span>bee${score === 1 ? '' : 's'} caught!</span>`;

  // Always reset gift image before deciding what to show
  const giftImg = document.getElementById('prize-gift-img');
  giftImg.src = '';
  giftImg.classList.add('hidden');

  const tiers = [...cfg.tiers].sort((a, b) => b.minBees - a.minBees);
  const won   = tiers.find(t => score >= t.minBees);

  if (score === 0) {
    // No bees caught at all — hide both boxes, show generic message
    resultPrize.classList.add('hidden');
    resultGiftPanel.classList.add('hidden');
    resultNoPrize.classList.remove('hidden');
    resultNoPrize.textContent = "No bees caught this time — give it another try!";
  } else if (won) {
    resultPrize.classList.remove('hidden');
    resultGiftPanel.classList.remove('hidden');
    resultNoPrize.classList.add('hidden');
    resultPrize.querySelector('.prize-name').textContent = won.name;
    resultPrize.querySelector('.prize-gift').textContent = won.gift;
    if (won.giftImage) {
      giftImg.src = won.giftImage;
      giftImg.classList.remove('hidden');
    } else {
      giftImg.src = '';
      giftImg.classList.add('hidden');
    }
    // Celebration effects when prize is won
    setTimeout(() => {
      playCelebration();
      launchConfetti();
      flashLight();
    }, 150);
  } else {
    // Caught some bees but not enough for a tier — hide both boxes
    resultPrize.classList.add('hidden');
    resultGiftPanel.classList.add('hidden');
    resultNoPrize.classList.remove('hidden');
    resultNoPrize.textContent = "So close! Keep practising — you'll catch more next time!";
  }

  showScreen('result');
}

// ── Screen Helper ──────────────────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.style.display = (key === name) ? 'flex' : 'none';
  });
}

// ── Button Listeners ───────────────────────────────────────────────────────
btnStart.addEventListener('click', startGame);
btnPlayAgain.addEventListener('click', () => {
  // Clean up any leftover confetti/flash from result screen
  document.querySelectorAll('.confetti, .light-flash').forEach(el => el.remove());
  showScreen('start');
});

// ── Init: always start on start screen, reset everything ──────────────────
showScreen('start');
initBackground();
animateBackground();
