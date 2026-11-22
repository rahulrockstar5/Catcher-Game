// ---------- Setup ----------
const $ = (id) => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const W = 480, H = 640;
const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sharp rendering on high-DPI screens
const dpr = Math.min(window.devicePixelRatio || 1, 2);
cv.width = W * dpr; cv.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const GOOD = ['🍎', '🍕', '🍩', '🍔', '🎈'];
const TYPES = {
  good: { pts: 10 }, gold: { e: '⭐', pts: 50 }, bomb: { e: '💣' },
  heart: { e: '❤️' }, magnet: { e: '🧲' }, slow: { e: '🐢' }, shield: { e: '🛡️' },
};
const MAX_LIVES = 5;

// ---------- State ----------
let state = 'menu'; // menu | play | pause | over
let score, lives, level, streak, spawnT, shake, shield;
let best = Number(store('get', 'emojiCatcherBest')) || 0;
let items = [], parts = [], floats = [];
const pw = { magnet: 0, slow: 0 };
const p = { x: W / 2, y: H - 56 };
let tx = p.x;
const keys = {};

function store(op, k, v) {
  try { return op === 'get' ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; }
}
const mult = () => Math.min(5, 1 + Math.floor(streak / 5));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- Sound ----------
let ac, muted = false;
function beep(freq, dur = 0.1, type = 'sine', vol = 0.06) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch {}
}

// ---------- HUD / overlay ----------
function hud() {
  $('score').textContent = score;
  $('best').textContent = best;
  $('level').textContent = level;
  $('lives').textContent = '❤️'.repeat(lives) || '💔';
  $('combo').textContent = '×' + mult();
}

function show(title, bodyHtml, btn) {
  $('ov-title').textContent = title;
  $('ov-body').innerHTML = bodyHtml;
  $('start-btn').textContent = btn;
  $('overlay').classList.remove('hidden');
  $('start-btn').focus();
}

function startGame() {
  score = 0; lives = 3; level = 1; streak = 0; shake = 0; shield = false;
  pw.magnet = pw.slow = 0; spawnT = 0.5;
  items = []; parts = []; floats = [];
  state = 'play';
  $('overlay').classList.add('hidden');
  hud();
}

function togglePause() {
  if (state === 'play') { state = 'pause'; show('Paused', '<p>Take a breather.</p>', 'Resume'); }
  else if (state === 'pause') { state = 'play'; $('overlay').classList.add('hidden'); }
}

function endGame() {
  state = 'over';
  const record = score > best;
  if (record) { best = score; store('set', 'emojiCatcherBest', best); }
  hud();
  show(record ? 'New best!' : 'Game over',
    `<p>Score <b>${score}</b> · Level <b>${level}</b></p><p>Best: <b>${best}</b></p>`, 'Play again');
  beep(160, 0.5, 'sawtooth', 0.08);
}

// ---------- Spawning & effects ----------
function spawn() {
  const r = Math.random(), bomb = Math.min(0.32, 0.16 + level * 0.015);
  let t = 'good';
  if (r < bomb) t = 'bomb';
  else if (r < bomb + 0.05) t = 'gold';
  else if (r < bomb + 0.08) t = lives < MAX_LIVES ? 'heart' : 'good';
  else if (r < bomb + 0.11) t = ['magnet', 'slow', 'shield'][Math.floor(Math.random() * 3)];
  items.push({
    t, e: TYPES[t].e || GOOD[Math.floor(Math.random() * GOOD.length)],
    x: rand(30, W - 30), y: -30, vy: 140 + level * 20 + rand(0, 60), rot: 0, spin: rand(-1.5, 1.5),
  });
}

function burst(x, y, color, n) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(60, 220);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.4, 0.8), color });
  }
}
const float = (x, y, text, color, life = 0.9) => floats.push({ x, y, text, color, life });

// ---------- Game logic ----------
function collect(it) {
  const { x, y } = it;
  if (it.t === 'good' || it.t === 'gold') {
    streak++;
    const pts = TYPES[it.t].pts * mult();
    score += pts;
    float(x, y - 20, '+' + pts, it.t === 'gold' ? '#ffd166' : '#ffffff');
    burst(x, y, '#ffd166', it.t === 'gold' ? 18 : 8);
    beep(520 + Math.min(streak, 20) * 25, 0.08, 'triangle');
    const nl = 1 + Math.floor(score / 150);
    if (nl > level) { level = nl; float(W / 2, H / 2, 'Level ' + level, '#4de0c0', 1.5); beep(880, 0.25, 'square'); }
  } else if (it.t === 'bomb') {
    streak = 0;
    if (shield) {
      shield = false; float(x, y - 20, 'Blocked!', '#4de0c0'); burst(x, y, '#4de0c0', 14); beep(300, 0.15, 'square');
    } else {
      lives--; shake = reduceMotion ? 0 : 0.4;
      burst(x, y, '#ff6b6b', 22); float(x, y - 20, '-1 life', '#ff6b6b'); beep(110, 0.3, 'sawtooth', 0.1);
      if (lives <= 0) { hud(); endGame(); return; }
    }
  } else if (it.t === 'heart') {
    lives = Math.min(MAX_LIVES, lives + 1); float(x, y - 20, '+1 life', '#ff8fa3'); beep(700, 0.2, 'sine');
  } else if (it.t === 'magnet') { pw.magnet = 8; float(x, y - 20, 'Magnet', '#4de0c0'); beep(600, 0.15); }
  else if (it.t === 'slow') { pw.slow = 6; float(x, y - 20, 'Slow-mo', '#4de0c0'); beep(400, 0.15); }
  else if (it.t === 'shield') { shield = true; float(x, y - 20, 'Shield', '#4de0c0'); beep(650, 0.15); }
  hud();
}

function update(dt) {
  // Player: keys are smooth and held, pointer eases toward target
  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir) { p.x += dir * 560 * dt; tx = p.x; } else p.x += (tx - p.x) * Math.min(1, dt * 16);
  p.x = clamp(p.x, 40, W - 40); tx = clamp(tx, 40, W - 40);

  pw.magnet = Math.max(0, pw.magnet - dt);
  pw.slow = Math.max(0, pw.slow - dt);
  shake = Math.max(0, shake - dt);

  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(0.3, 0.85 - level * 0.05); }

  const ts = pw.slow > 0 ? 0.55 : 1;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], pickup = it.t === 'good' || it.t === 'gold';
    if (pw.magnet > 0 && pickup && it.y > 80 && Math.abs(it.x - p.x) < 170) it.x += (p.x - it.x) * Math.min(1, dt * 4);
    it.y += it.vy * ts * dt; it.rot += it.spin * dt;
    if (it.y > p.y - 26 && it.y < p.y + 22 && Math.abs(it.x - p.x) < 46) {
      items.splice(i, 1); collect(it);
      if (state !== 'play') return;
      continue;
    }
    if (it.y > H + 30) {
      if (pickup && streak > 0) { streak = 0; hud(); } // a miss breaks the combo
      items.splice(i, 1);
    }
  }
}

function tickFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt;
    if (q.life <= 0) parts.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life -= dt; f.y -= 40 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

// ---------- Drawing ----------
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 30, rand(-1, 1) * shake * 30);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  items.forEach((it) => {
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot * 0.3);
    ctx.font = `38px ${FONT}`; ctx.fillText(it.e, 0, 0); ctx.restore();
  });

  // Basket with glow, shield bubble and magnet ring
  ctx.save();
  ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 22;
  ctx.font = `64px ${FONT}`; ctx.fillText('🧺', p.x, p.y);
  ctx.restore();
  if (shield) { ctx.strokeStyle = '#4de0c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 52, 0, 7); ctx.stroke(); }
  if (pw.magnet > 0) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(p.x, p.y, 170, Math.PI, 0); ctx.stroke(); ctx.setLineDash([]); }

  parts.forEach((q) => { ctx.globalAlpha = clamp(q.life * 2, 0, 1); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;
  floats.forEach((f) => { ctx.globalAlpha = clamp(f.life * 2, 0, 1); ctx.fillStyle = f.color; ctx.font = '800 24px "Baloo 2", sans-serif'; ctx.fillText(f.text, f.x, f.y); });
  ctx.globalAlpha = 1;

  // Active power-up timers
  ctx.textAlign = 'left'; ctx.font = `800 18px "Baloo 2", ${FONT}`; ctx.fillStyle = '#fff';
  let ty = 22;
  if (pw.magnet > 0) { ctx.fillText(`🧲 ${Math.ceil(pw.magnet)}s`, 12, ty); ty += 26; }
  if (pw.slow > 0) ctx.fillText(`🐢 ${Math.ceil(pw.slow)}s`, 12, ty);
  ctx.restore();
}

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') update(dt);
  if (state !== 'pause') tickFx(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- Input ----------
$('start-btn').addEventListener('click', () => (state === 'pause' ? togglePause() : startGame()));
$('mute-btn').addEventListener('click', toggleMute);
function toggleMute() { muted = !muted; $('mute-btn').textContent = muted ? '🔇' : '🔊'; }

cv.addEventListener('pointermove', (e) => {
  const r = cv.getBoundingClientRect();
  tx = ((e.clientX - r.left) / r.width) * W;
});
cv.addEventListener('pointerdown', (e) => {
  const r = cv.getBoundingClientRect();
  tx = ((e.clientX - r.left) / r.width) * W;
});

document.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = true;
  if (k === 'p' || k === 'Escape') togglePause();
  if (k === 'm') toggleMute();
  if (k.startsWith('Arrow')) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

score = 0; lives = 3; level = 1; streak = 0; shake = 0; shield = false;
hud();
requestAnimationFrame(loop);
