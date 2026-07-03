/* ============================================================================
   app.js — Meeko Command Console (Phase 1 static prototype)
   Implements interactive behavior from JARVIS-Command-Console-UIUX-Spec-v1.md
   No backend: clock is real, chat responses are canned, roster is mock data.
   ========================================================================== */
'use strict';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----------------------------------------------------------------------------
   Utility
---------------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function pad2(n) { return String(n).padStart(2, '0'); }

function formatClock(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function timestampLabel(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/* relative time from a minutes-ago offset (mock) */
function relativeTime(minutesAgo) {
  if (minutesAgo <= 0) return 'just now';
  if (minutesAgo === 1) return '1m ago';
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const h = Math.floor(minutesAgo / 60);
  return h === 1 ? '1h ago' : `${h}h ago`;
}

/* ============================================================================
   §5.5 / footer — LIVE CLOCK
   ========================================================================== */
(function initClock() {
  const topClock = $('#clock');
  const footClock = $('#footer-clock');
  function tick() {
    const now = new Date();
    const t = formatClock(now);
    if (topClock) topClock.textContent = t;
    if (footClock) footClock.textContent = t;
  }
  tick();
  setInterval(tick, 1000);
})();

/* ============================================================================
   §4.5 PARTICLE DRIFT — canvas, upward drift, opacity fade, respawn
   ========================================================================== */
(function initParticles() {
  if (REDUCED_MOTION) return; // §7.8: freeze ambient motion
  const canvas = $('#particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  const COUNT = 26; // spec: 20–30

  function resize() {
    W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  }

  function spawn(seedTop) {
    const dur = 15000 + Math.random() * 10000; // 15–25s
    return {
      x: Math.random() * W,
      y: seedTop ? Math.random() * H : H + Math.random() * 40,
      r: (1 + Math.random()) * (window.devicePixelRatio || 1), // 1–2px
      dur,
      // life is a phase 0..1 across the drift; stagger the start
      life: seedTop ? Math.random() : 0,
      speed: H / dur, // px per ms upward
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, () => spawn(true));
  }

  let last = performance.now();
  function frame(now) {
    const dt = now - last;
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.speed * dt;
      p.life += dt / p.dur;
      if (p.y < -10 || p.life > 1) {
        particles[i] = spawn(false);
        continue;
      }
      // opacity fades 0 → 0.5 → 0 across life
      const o = Math.sin(p.life * Math.PI) * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(63,214,255,${o.toFixed(3)})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  init();
  requestAnimationFrame(frame);
})();

/* ============================================================================
   §8 ROSTER — mock data (stands in for roster.mock.json, spec §11)
   7 specialists, all 4 states exercised. At least one WORKING on load.
   ========================================================================== */
const ROSTER = [
  { id: 'owen',   name: 'Owen Fitzgerald', role: 'Tech Lead / Reviewer', initial: 'O',
    state: 'working', task: 'Reviewing PR #142', minutesAgo: 2 },
  { id: 'marcus', name: 'Marcus Chen',      role: 'Backend',             initial: 'M',
    state: 'working', task: 'Migrating orders table schema', minutesAgo: 0 },
  { id: 'priya',  name: 'Priya Raman',      role: 'Frontend',            initial: 'P',
    state: 'idle',    task: 'Built roster rail scaffold', minutesAgo: 14 },
  { id: 'sofia',  name: 'Sofia Alvarez',    role: 'UI/UX',               initial: 'S',
    state: 'idle',    task: 'Delivered console spec v1.0', minutesAgo: 41 },
  { id: 'derek',  name: 'Derek Osei',       role: 'QA / Test',           initial: 'D',
    state: 'idle',    task: 'Ran regression suite', minutesAgo: 22 },
  { id: 'yuki',   name: 'Yuki Tanaka',      role: 'DevOps',              initial: 'Y',
    state: 'offline', task: 'Provisioned staging cluster', minutesAgo: 63 },
  { id: 'nadia',  name: 'Nadia Petrov',     role: 'Security',            initial: 'N',
    state: 'error',   task: 'Failed: dependency audit on PR #142', minutesAgo: 5 },
];

/* per-person accent tint within the cyan family (§9.2) */
const ACCENTS = {
  owen: '#5AF0E8',   // teal-cyan
  marcus: '#3FD6FF', // primary
  priya: '#7FE9FF',  // light cyan
  sofia: '#8FD4FF',  // sky
  derek: '#4ADFD0',  // teal
  yuki: '#5CC8FF',   // blue-cyan
  nadia: '#8FB8FF',  // violet-cyan
};

const STATE_PRIORITY = { error: 0, working: 1, idle: 2, offline: 3 };
const STATE_WORD = { idle: 'STANDBY', working: 'WORKING', error: 'BLOCKED', offline: 'OFFLINE' };

function sortRoster(list) {
  // §8.6: Error > Working > Idle > Offline, then alphabetical by name.
  return [...list].sort((a, b) => {
    const pa = STATE_PRIORITY[a.state], pb = STATE_PRIORITY[b.state];
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

function taskLineHTML(p) {
  if (p.state === 'idle') {
    return `<span class="task-prefix">LAST:</span> ${escapeHTML(p.task)}`;
  }
  return escapeHTML(p.task);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderRoster() {
  const stack = $('#roster-stack');
  const countEl = $('#roster-count');
  stack.innerHTML = '';

  const sorted = sortRoster(ROSTER);
  const online = ROSTER.filter((p) => p.state !== 'offline').length;
  countEl.textContent = `${online} ONLINE`;

  for (const p of sorted) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.state = p.state;
    card.dataset.id = p.id;

    const timeStr = p.state === 'error' ? relativeTime(p.minutesAgo)
                  : p.state === 'idle' ? relativeTime(p.minutesAgo)
                  : p.state === 'working' ? relativeTime(p.minutesAgo)
                  : relativeTime(p.minutesAgo);

    card.innerHTML = `
      <button class="card__ack" type="button" aria-label="Acknowledge alert for ${escapeHTML(p.name)}">
        <svg aria-hidden="true"><use href="#icon-dismiss" /></svg>
      </button>
      <div class="card__avatar">
        <div class="card__ring"></div>
        <div class="card__hex" style="color:${ACCENTS[p.id] || 'var(--cyan-100)'}">${p.initial}</div>
      </div>
      <div class="card__body">
        <div class="card__name">${escapeHTML(p.name)}</div>
        <div class="card__role">${escapeHTML(p.role)}</div>
        <div class="card__statusline">
          <span class="card__status-dot"></span>
          <span class="card__status-word">${STATE_WORD[p.state]}</span>
        </div>
        <div class="card__task" title="${escapeHTML(p.task)}">${taskLineHTML(p)}</div>
        <div class="card__time">${timeStr}</div>
      </div>
    `;
    stack.appendChild(card);
  }
}

/* §8.4 — ack drops an error card to idle-visual (local state only) */
document.addEventListener('click', (e) => {
  const ack = e.target.closest('.card__ack');
  if (!ack) return;
  const card = ack.closest('.card');
  const person = ROSTER.find((p) => p.id === card.dataset.id);
  if (person) {
    person.state = 'idle';
    person.task = 'Acknowledged: dependency audit on PR #142';
    person.minutesAgo = 0;
    renderRoster(); // re-sort so it drops below working cards
  }
});

renderRoster();

/* ============================================================================
   §6 CHAT — seed conversation, typewriter streaming, canned responses
   ========================================================================== */
const stream = $('#chat-stream');
const form = $('#chat-form');
const input = $('#chat-input');
const chatPanel = $('.chat');
const statusWord = $('#meeko-status');
const liveRegion = $('#chat-live');

/* Meeko header status word (§6.1) */
function setMeekoStatus(word) {
  statusWord.textContent = word;
  chatPanel.dataset.meeko = word;
}
setMeekoStatus('STANDBY');

function scrollToBottom() {
  stream.scrollTop = stream.scrollHeight;
}

/* Build a message element. `who` is 'user' | 'meeko'. */
function makeMessage(who, timeStr) {
  const msg = document.createElement('div');
  msg.className = `msg msg--${who}`;
  const label = document.createElement('div');
  label.className = 'msg__label';
  if (who === 'meeko') {
    label.innerHTML =
      `<svg class="msg__glyph" aria-hidden="true"><use href="#icon-signal" /></svg>` +
      `MEEKO // ${timeStr}`;
  } else {
    label.textContent = `BRADLEY // ${timeStr}`;
  }
  const body = document.createElement('div');
  body.className = 'msg__body';
  msg.appendChild(label);
  msg.appendChild(body);
  return { msg, body };
}

function addUserMessage(text) {
  const { msg, body } = makeMessage('user', timestampLabel(new Date()));
  body.textContent = text;
  stream.appendChild(msg);
  scrollToBottom();
}

/* ------ Canned Meeko responses (no backend, §6/§11) ------------------------ */
const CANNED = [
  "Copy that, Bradley. Routing your request through the roster now — Owen's mid-review on PR #142, so I'll queue anything that touches it behind his pass.",
  "Understood. I've logged it. Heads up: Nadia flagged a dependency audit failure on PR #142 — I'd clear that before we ship. Want me to loop Marcus in on the backend side?",
  "On it. Etsy's connection is showing an auth error up top — shop pulse will stay dark until we re-link it. Everything else is nominal: cron's healthy, four jobs active.",
  "Acknowledged. I'll keep the channel open. Say the word and I'll spin Derek up on a regression pass before the next deploy.",
];
let cannedIx = 0;

function pickResponse(userText) {
  const t = userText.toLowerCase();
  if (t.includes('status') || t.includes('report')) {
    return "Full status: 2 specialists working (Owen, Marcus), 3 on standby, Yuki offline, and Nadia is blocked on a dependency audit for PR #142. Cron: 4 active, all healthy. Platforms: Slack and GitHub linked, Etsy in auth error.";
  }
  if (t.includes('hello') || t.includes('hi') || t.includes('hey')) {
    return "Online and listening, Bradley. What are we working on?";
  }
  if (t.includes('nadia') || t.includes('security') || t.includes('audit')) {
    return "Nadia's blocked: the dependency audit on PR #142 failed. It's the top card on the roster, flagged red. Clear or acknowledge it there and I'll re-run the check.";
  }
  const r = CANNED[cannedIx % CANNED.length];
  cannedIx++;
  return r;
}

/* ------ §6.3 Typewriter streaming --------------------------------------- */
let streamingActive = false;

function streamMeekoResponse(fullText) {
  setMeekoStatus('THINKING');

  // Thinking dots before first token (§6.3)
  const { msg, body } = makeMessage('meeko', timestampLabel(new Date()));
  msg.classList.add('msg--streaming');
  const thinking = document.createElement('span');
  thinking.className = 'thinking';
  thinking.innerHTML = `<span class="thinking__dot">·</span><span class="thinking__dot">·</span><span class="thinking__dot">·</span>`;
  body.appendChild(thinking);
  stream.appendChild(msg);
  scrollToBottom();

  const THINK_DELAY = 650;

  setTimeout(() => {
    body.removeChild(thinking);
    setMeekoStatus('RESPONDING');
    streamingActive = true;

    // committed text node + a flickering tail span + cursor
    const committed = document.createTextNode('');
    const tail = document.createElement('span');
    tail.className = 'stream-tail';
    const cursor = document.createElement('span');
    cursor.className = 'msg__cursor';
    body.classList.add('is-streaming');
    body.appendChild(committed);
    body.appendChild(tail);
    body.appendChild(cursor);

    let i = 0;
    let interval = 21; // base ms/char (18–24 band)
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      streamingActive = false;
      body.classList.remove('is-streaming');
      body.textContent = fullText; // clean final text, no cursor/tail (aria-friendly)
      msg.classList.remove('msg--streaming');
      setMeekoStatus('STANDBY');
      // §10: announce the FINAL text once (never per-character)
      if (liveRegion) liveRegion.textContent = `Meeko: ${fullText}`;
      scrollToBottom();
    }

    // skip-ahead: click the streaming message to snap to full text (§6.3)
    msg.addEventListener('click', finish);

    function step() {
      if (done) return;
      if (i >= fullText.length) { finish(); return; }

      const ch = fullText[i];
      // move previous tail char into committed
      committed.textContent = fullText.slice(0, i);
      tail.textContent = ch;
      i++;

      // §6.3 speed ramp: every 40 chars ×0.97, floor 8ms
      if (i % 40 === 0) interval = Math.max(8, interval * 0.97);
      // ±4ms jitter to avoid a robotic metronome
      const jitter = (Math.random() * 8) - 4;
      const delay = Math.max(6, interval + jitter);

      if ((i & 7) === 0) scrollToBottom();
      setTimeout(step, delay);
    }
    step();
  }, THINK_DELAY);
}

/* ------ Submit handling (§6.4) ------------------------------------------ */
function handleSubmit() {
  const text = input.value.trim();
  if (!text || streamingActive) return;
  addUserMessage(text);
  input.value = '';
  autoGrow();
  const response = pickResponse(text);
  streamMeekoResponse(response);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSubmit();
});

/* Enter submits, Shift+Enter newline (§6.4) */
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
});

/* textarea auto-grow */
function autoGrow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}
input.addEventListener('input', autoGrow);

/* ------ Seed conversation ----------------------------------------------- */
(function seedConversation() {
  const seed = [
    { who: 'meeko', time: '14:31:52', text: "Systems online, Bradley. Roster's up — Owen and Marcus are already heads-down. What's first?" },
    { who: 'user',  time: '14:32:07', text: "Give me a quick read on where PR #142 stands." },
    { who: 'meeko', time: '14:32:11', text: "PR #142: Owen's actively reviewing it, but Nadia's security card just went red — the dependency audit failed. I'd resolve that before merge. It's flagged at the top of the roster." },
  ];
  for (const m of seed) {
    const { msg, body } = makeMessage(m.who, m.time);
    body.textContent = m.text;
    stream.appendChild(msg);
  }
  scrollToBottom();
})();
