// ===== MODE INTERFACE =====
// The app only talks to a mode through these. Each mode module returns an object with:
//   key, name, emblem (icon), accent (its theme color), saveKey (its own save slot), tabs, tutorial
//   state            the mode's save data (read only; the mode owns it)
//   load(raw)        start from saved data (or a fresh game if raw is empty; returns false if raw couldn't be used)
//                    fresh() starts over
//   refresh(now)     rebuild its modifiers; tick(dt) plays dt seconds; catchUp(seconds) plays time away at the
//                    offline rate and returns what was made: [{ name, icon, color, amount, format }]
//   checkAchievements(), won()
//   actions          buttons that belong to the mode: { action(arg) }
//   panes / badges   per tab: html builders, and whether the tab gets a red dot
//   feedback         { measure, label, unlocked } for the animations after an action
//   header()         the four boxes at the top: [label, icon, value, format, note]
//   buildUI(), onTab(key), renderTab(key)   for tabs the mode draws itself (true when handled)
//   stone()          how the Stone looks: { tint, fill, orbs }
//   titleLine(), ending(), deleteNote
//   locked(tab)      why a tab isn't open yet (a short reason), or nothing once it is
//   hints            one-time cards that explain a system the moment it becomes relevant: [{ id, when(), title, text, tab }]
//   introPages       how many tutorial pages to show on the first visit (the rest are in the full guide in Settings)
//   strip()          optional: a live line under the top boxes for things that need attention on every tab (events)
// The modes in their fixed order. The switch button always goes to the next one: Industrialist → Capitalist →
// Communist → Industrialist
const MODES = { industrialist: Industrialist, capitalist: Capitalist, communist: Communist };
const MODE_LIST = Object.values(MODES);
// Which modes are switched on lives in settings.modes, the one place the title menu and the in-game Settings both use.
// There is always at least one on; a mode that is off is skipped everywhere (switch button, title picker)
if (!settings.modes || typeof settings.modes !== 'object') settings.modes = {};
for (const m of MODE_LIST) if (typeof settings.modes[m.key] !== 'boolean') settings.modes[m.key] = true;
if (!MODE_LIST.some((m) => settings.modes[m.key])) for (const m of MODE_LIST) settings.modes[m.key] = true;
const modeOn = (m) => settings.modes[m.key];
const nextMode = (m) => {
  for (let k = 1; k <= MODE_LIST.length; k++) {
    const c = MODE_LIST[(MODE_LIST.indexOf(m) + k) % MODE_LIST.length];
    if (modeOn(c)) return c;
  }
  return m;
};
const fullTitle = (m) => 'Deepforge: ' + m.name;
let mode = MODES[settings.mode] && modeOn(MODES[settings.mode]) ? MODES[settings.mode] : nextMode(MODE_LIST[MODE_LIST.length - 1]);
let TABS = mode.tabs;
const tabIndex = (key) => TABS.findIndex((t) => t.key === key);
const firstTab = (m) => (m.tabs.some((t) => t.key === settings.tabs[m.key]) && !m.locked(settings.tabs[m.key]) ? settings.tabs[m.key] : m.tabs[0].key);
let tab = firstTab(mode);
let switching = false; // a mode switch is playing
const view = $('view');

// ===== Saving: each mode in its own slot, settings in a third =====
function saveMode(m) {
  try {
    m.state.savedAt = Math.max(m.state.savedAt || 0, Date.now()); // never backwards: turning the clock back and forward again must not pay the same hours twice
    localStorage.setItem(m.saveKey, JSON.stringify(m.state));
  } catch (e) {}
}
function saveGame() {
  saveMode(mode);
  saveSettings();
}
// Gem designs unlocked in the other modes, as this mode's output bonus. Cheap enough to run every second
function updateResonance() {
  const designs = Object.fromEntries(MODE_LIST.map((m) => [m.key, m.stone().style | 0]));
  for (const m of MODE_LIST) {
    let n = 0;
    for (const o of MODE_LIST) if (o !== m && modeOn(o)) n += designs[o.key];
    RESONANCE[m.key] = 1 + RESONANCE_STEP * n;
  }
}
// A save that is there but can't be used would be overwritten by a fresh game within seconds, so it is put aside
// first (under its key + '_unread'), where it can still be rescued
function loadMode(m) {
  const text = readStored(m.saveKey);
  let raw = null;
  try {
    raw = JSON.parse(text);
  } catch (e) {}
  const usable = !!raw && typeof raw === 'object' && !Array.isArray(raw);
  if (m.load(usable ? raw : null) === false || (text && !usable)) {
    try {
      localStorage.setItem(m.saveKey + '_unread', text);
    } catch (e) {}
    setTimeout(() => toast(`Your ${m.name} save couldn't be read, so this game started fresh. A copy of it was kept.`), 1500);
  }
}
// Time away from a mode: it catches up at its offline rate. Returns what it made
function awayGains(m) {
  const away = Math.max(0, (Date.now() - m.state.savedAt) / 1000);
  const gains = away > 2 ? m.catchUp(away) : [];
  m.state.savedAt = Math.max(m.state.savedAt, Date.now());
  return { away, gains };
}
// each amount wears its resource's icon and color, so it's plain at a glance which number belongs to what
const gainsText = (gains) => gains.map((g) => `<span class="gi" style="--c:${g.color}">${icon(g.icon, 13)}+${g.format(g.amount)}${g.format === money || g.name === 'Cash' ? '' : ' ' + g.name}</span>`).join(' ');
// What a mode made while you were away, one row per resource, counting up from zero
// Swaps a block's contents smoothly: the old contents fade out, the block's height eases to fit the new ones, and the
// new ones fade in. Nothing around it jumps, and a quick second change simply takes over from wherever this one is.
function morph(box, update) {
  if (reducedMotion || !settings.effects || !box.animate) return update();
  const opacity = +getComputedStyle(box).opacity, h0 = box.getBoundingClientRect().height;
  box.getAnimations().forEach((a) => a.cancel());
  box.style.height = '';
  const swapIn = () => {
    update();
    box.style.height = '';
    const h1 = box.getBoundingClientRect().height; // the new contents' natural height (measured, never drawn)
    box.style.height = h0 + 'px'; // held at the old height until the easing takes over, so no frame shows the new size early
    const ease = 'cubic-bezier(.2,.8,.2,1)';
    if (Math.abs(h1 - h0) > 1) {
      const grow = box.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 340, easing: ease, fill: 'forwards' });
      grow.onfinish = () => {
        box.style.height = '';
        grow.cancel();
      };
    } else box.style.height = '';
    box.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 70, easing: ease, fill: 'backwards' });
  };
  if (!box.textContent.trim() || opacity < 0.05) return swapIn(); // nothing showing yet: just bring the new contents in
  const out = box.animate([{ opacity, height: h0 + 'px' }, { opacity: 0, height: h0 + 'px' }], { duration: 150 * opacity, easing: 'ease-in', fill: 'forwards' });
  out.onfinish = () => {
    out.cancel(); // (no frame is drawn between this and the new contents going in)
    swapIn();
  };
}
function showGains(box, gains, length, still = false) {
  box.innerHTML = gains.map((g, k) => `<div style="--c:${g.color};animation-delay:${0.08 * k}s">${icon(g.icon, 16)}<span>${g.name}</span><b>+${still ? g.format(g.amount) : 0}</b></div>`).join('');
  if (still) return;
  const els = [...box.querySelectorAll('b')], t0 = performance.now();
  const countUp = (t) => {
    const p = Math.min(1, (t - t0) / length), e = 1 - (1 - p) ** 3;
    els.forEach((el, k) => (el.textContent = '+' + gains[k].format(gains[k].amount * e)));
    if (p < 1) requestAnimationFrame(countUp);
  };
  requestAnimationFrame(countUp);
}

// ===== Actions shared by both modes. A mode's own actions are in mode.actions =====
const APP_ACTIONS = {
  tab: (v) => goToTab(v),
  switchMode: () => switchMode(),
  fold(key) {
    openFolds.has(key) ? openFolds.delete(key) : openFolds.add(key);
    document.querySelectorAll(`details[data-fold="${key}"]`).forEach((d) => {
      d.open = openFolds.has(key);
      if (d.open) Polish.restart(d, 'opening');
    });
  },
  format: () => (settings.format = (settings.format + 1) % 3),
  effects() {
    settings.effects = !settings.effects;
    document.body.classList.toggle('low', !settings.effects);
    StoneView.show(tab === 'opus');
  },
  tutorial: () => showTutorial(),
  tutNext: () => turnTutorial(1),
  tutBack: () => turnTutorial(-1),
  tutClose() {
    $('tut').hidden = true;
    settings.tutorialSeen[mode.key] = true;
    saveSettings();
  },
  closeEnding: () => ($('end').hidden = true),
  // One code holds every mode and the settings
  exportSave() {
    settings.lastExport = Date.now();
    saveGame();
    const t = $('sv');
    t.hidden = false;
    t.dataset.mode = 'export';
    t.value = btoa(unescape(encodeURIComponent(JSON.stringify({ app: 'deepforge', v: 1, settings, modes: Object.fromEntries(MODE_LIST.map((m) => [m.key, m.state])) }))));
    t.select();
    try {
      navigator.clipboard.writeText(t.value).catch(() => {});
    } catch (e) {}
    toast('Save code copied. It holds every mode. Keep it somewhere safe.');
  },
  importSave() {
    const t = $('sv');
    if (t.hidden || t.dataset.mode !== 'import' || !t.value.trim()) {
      t.dataset.mode = 'import';
      t.hidden = false;
      t.value = '';
      t.placeholder = 'Paste your save code here, then tap Import again';
      t.focus();
      return;
    }
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(t.value.trim()))));
      const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
      // Only a Deepforge save code replaces anything; anything else is turned away and every save stays as it was
      const saves = isObj(data) && data.app === 'deepforge' && isObj(data.modes) ? data.modes : null;
      if (!saves || !Object.values(MODES).some((m) => isObj(saves[m.key]))) throw new Error('not a save code');
      if (isObj(data.settings)) Object.assign(settings, data.settings, { hints: Object.assign({}, settings.hints, data.settings.hints) });
      for (const m of MODE_LIST) if (isObj(saves[m.key])) localStorage.setItem(m.saveKey, JSON.stringify(saves[m.key]));
      saveSettings();
      importing = true; // the page reloads straight away: nothing may save the old game over the one just imported
      location.reload();
    } catch (e) {
      t.value = '';
      t.placeholder = "That isn't a Deepforge save code. Nothing was changed.";
    }
  },
  // Only the mode you're in is erased
  deleteSave() {
    if (!confirmTap('delete')) return;
    mode.fresh();
    saveMode(mode);
    settings.tutorialSeen[mode.key] = false;
    saveSettings();
    location.reload(); // start this mode fresh: title screen and its tutorial
  },
};
function act(action, arg) {
  const f = APP_ACTIONS[action] || mode.actions[action];
  if (!f) return;
  const tapped = Polish.before(action, arg);
  f(arg);
  if (action === 'tab' || action === 'switchMode') return; // they render themselves
  mode.refresh();
  render(true);
  Polish.after(tapped);
}

// ===== Input: taps register on release; double-tap zoom is blocked =====
let tapStart = null,
  lastAction = 0;
function fire(el) {
  if (!el) return;
  if (el.classList.contains('dis')) return void Polish.nope(el); // can't afford it yet: a little shake
  lastAction = Date.now();
  act(el.dataset.a, el.dataset.i);
}
document.addEventListener('pointerdown', (e) => {
  tapStart = { x: e.clientX, y: e.clientY, t: Date.now(), el: e.target.closest('[data-a]') };
  swipeStart(e);
});
document.addEventListener('pointerup', (e) => {
  if (tapStart && Math.abs(e.clientX - tapStart.x) < 12 && Math.abs(e.clientY - tapStart.y) < 12 && Date.now() - tapStart.t < 700) fire(tapStart.el);
  tapStart = null;
  swipeEnd(e, false);
});
document.addEventListener('pointercancel', (e) => swipeEnd(e, true));
document.addEventListener('pointermove', swipeMove);
document.addEventListener('click', (e) => {
  if (e.target.closest('summary')) e.preventDefault(); // folds open through the fold action instead
  if (Date.now() - lastAction > 600) fire(e.target.closest('[data-a]')); // keyboard and other non-pointer clicks
});
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350 && !e.target.closest('input,textarea')) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);
document.addEventListener('touchmove', (e) => swipe && swipe.dragging && e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ===== Swipe between tabs =====
// A sideways drag anywhere below the top banner moves the page with your finger. Let go past a quarter of the
// screen (or flick) and the next tab slides in; otherwise the page springs back.
let swipe = null,
  tabTimers = [];
function swipeStart(e) {
  swipe = null;
  if (!started || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
  if (switching || !$('tut').hidden || !$('end').hidden || e.target.closest('#top, #indSheet, input, textarea')) return;
  swipe = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dragging: false, trail: [[e.clientX, e.timeStamp]] };
}
function swipeMove(e) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
  if (!swipe.dragging) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return void (swipe = null); // a vertical scroll
    swipe.dragging = true;
    tapStart = null; // a swipe is never a tap
    clearTabTimers();
    view.style.transition = 'none';
  }
  const i = tabIndex(tab), atEdge = (dx > 0 && i === 0) || (dx < 0 && i === TABS.length - 1);
  swipe.dx = atEdge ? dx * 0.25 : dx; // resist past the first and last tab
  swipe.trail.push([e.clientX, e.timeStamp]);
  if (swipe.trail.length > 6) swipe.trail.shift();
  view.style.transform = `translateX(${swipe.dx}px)`;
  view.style.opacity = 1 - Math.min(0.6, (Math.abs(swipe.dx) / innerWidth) * 0.9);
  Motes.drag(swipe.dx);
}
function swipeEnd(e, cancelled) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const s = swipe;
  swipe = null;
  if (!s.dragging) return;
  lastAction = Date.now(); // swallow the click that some browsers send after a drag
  const [x1, t1] = s.trail[0], [x2, t2] = s.trail[s.trail.length - 1];
  const v = (x2 - x1) / Math.max(1, t2 - t1); // px per ms over the last few moves
  // a swipe skips tabs that aren't open yet
  let to = tabIndex(tab) + (s.dx < 0 ? 1 : -1);
  while (to >= 0 && to < TABS.length && lockedReason(TABS[to].key)) to += s.dx < 0 ? 1 : -1;
  const far = Math.abs(s.dx) > innerWidth * 0.25, flick = Math.abs(v) > 0.35 && Math.abs(s.dx) > 24 && Math.sign(v) === Math.sign(s.dx);
  if (!cancelled && (far || flick) && to >= 0 && to < TABS.length) goToTab(TABS[to].key, s.dx);
  else {
    view.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1), opacity .3s';
    view.style.transform = view.style.opacity = '';
    Motes.drag(0);
  }
}
function clearTabTimers() {
  tabTimers.forEach(clearTimeout);
  tabTimers = [];
}
// Switch tabs. From a swipe, the page keeps moving the way the finger went; from the tab bar it slides in from that side
function goToTab(key, swipedBy) {
  const from = tabIndex(tab), to = tabIndex(key);
  if (to < 0) return;
  const lock = lockedReason(key);
  if (lock) return void toast(`${icon('lock', 14)} ${TABS[to].name}: ${lock}`);
  clearTabTimers();
  if (to === from) {
    view.scrollTop = 0;
    return;
  }
  const dir = to > from ? 1 : -1,
    w = innerWidth;
  showTabName(key);
  Motes.rush(-dir, TABS[to].color);
  const enter = (offset) => {
    setTab(key);
    if (reducedMotion) return void (view.style.transform = view.style.opacity = view.style.transition = '');
    view.style.transition = 'none';
    view.style.transform = `translateX(${offset}px)`;
    view.style.opacity = '0';
    void view.offsetWidth;
    view.style.transition = 'transform .34s cubic-bezier(.16,1,.3,1), opacity .26s ease-out';
    view.style.transform = view.style.opacity = '';
  };
  if (swipedBy === undefined || reducedMotion) return enter(dir * 60);
  // finish the swipe: carry the page off screen, then bring the new tab in from the other side
  const left = 1 - Math.min(1, Math.abs(swipedBy) / (w * 0.6));
  view.style.transition = `transform ${0.08 + 0.1 * left}s ease-in, opacity ${0.08 + 0.1 * left}s ease-in`;
  view.style.transform = `translateX(${-dir * w * 0.6}px)`;
  view.style.opacity = '0';
  tabTimers.push(setTimeout(() => enter(dir * w * 0.35), (80 + 100 * left) | 0));
}
function setTab(key) {
  tab = settings.tabs[mode.key] = key;
  view.scrollTop = 0;
  render(true);
}
let tabNameTimer;
function showTabName(key) {
  const t = TABS[tabIndex(key)], e = $('tn');
  e.innerHTML = icon(t.icon, 18) + '<span>' + t.name + '</span>';
  e.style.color = t.color;
  e.classList.add('show');
  clearTimeout(tabNameTimer);
  tabNameTimer = setTimeout(() => e.classList.remove('show'), 1000);
}


// ===== Tutorial: each mode has its own, shown the first time you play it =====
// The first visit shows only the first pages (the core loop); every other system is explained by a short card when it
// first matters. Settings → Tutorial shows the whole guide
let tutorialPage = 0,
  tutPages = [];
function renderTutorial() {
  const pages = tutPages, [heading, body] = pages[tutorialPage], last = tutorialPage === pages.length - 1;
  $('tutc').innerHTML =
    `<small class="tmode">${icon(mode.emblem, 14)} ${mode.name}</small><h2>${heading}</h2>${body}<div class="tdots">${pages.map((_, i) => `<i class="${i === tutorialPage ? 'on' : ''}"></i>`).join('')}</div>` +
    `<div class="tnav">${tutorialPage ? '<button class="tb2" data-a="tutBack" data-i="0">Back</button>' : '<button class="tb2" data-a="tutClose" data-i="0">Skip</button>'}` +
    `<button id="tg" data-a="${last ? 'tutClose' : 'tutNext'}" data-i="0">${last ? 'Start playing' : 'Next'}</button></div>`;
}
function turnTutorial(d) {
  tutorialPage = Math.max(0, Math.min(tutPages.length - 1, tutorialPage + d));
  renderTutorial();
}
function showTutorial(intro = false) {
  tutPages = intro ? mode.tutorial.slice(0, mode.introPages) : mode.tutorial;
  tutorialPage = 0;
  renderTutorial();
  $('tut').hidden = false;
}
function maybeTutorial() {
  if (!settings.tutorialSeen[mode.key]) showTutorial(true);
}

// ===== Guidance: locked tabs and one-time cards =====
let badgeAt = 0;
function renderSwitchBadge(now) {
  if (now - badgeAt < 500) return; // twice a second is plenty
  badgeAt = now;
  // The switch button gets a dot when the other mode has something waiting: a quest, research, a good transmutation,
  // a daily bonus, or an hour or more of production to collect. A hint, never a chore: nothing is lost by staying
  const other = nextMode(mode),
    waiting = other !== mode && now - other.state.savedAt > 3600e3 || other.tabs.some((t) => !other.locked(t.key) && other.badges[t.key](now));
  const sw = $('nav-switch');
  if (sw) sw.classList.toggle('badge', waiting);
}
// Turning a mode on or off, from the title menu or the in-game Settings: one state, saved at once
APP_ACTIONS.modeToggle = (key) => {
  const m = MODES[key];
  if (!m) return;
  if (modeOn(m) && !MODE_LIST.some((o) => o !== m && modeOn(o))) return toast('At least one game must stay on.');
  settings.modes[key] = !modeOn(m);
  saveSettings();
  const wasOpen = m === mode && !modeOn(m);
  if (!started) {
    if (wasOpen) APP_ACTIONS.selectMode(nextMode(m).key);
    else showTitle();
  } else {
    buildNav();
    if (wasOpen) switchMode();
  }
};
APP_ACTIONS.titleMenu = () => {
  const open = $('tmenu').hidden;
  $('tmenu').hidden = !open;
  $('tset').setAttribute('aria-expanded', open);
  modePickedAt = Date.now();
};
const lockedReason = (key) => mode.locked(key);
// One card at a time, the first one whose moment has come; dismissing it marks it seen for good (per mode)
let cardNow = null;
const hintsSeen = (m) => (settings.hints[m.key] = settings.hints[m.key] || {});
function checkHints() {
  if (cardNow || !started || switching || !$('tut').hidden || !$('end').hidden) return;
  knownHints(mode);
  const seen = hintsSeen(mode), h = mode.hints.find((x) => !seen[x.id] && x.when());
  if (!h) return;
  cardNow = h;
  const c = $('card');
  c.innerHTML =
    `<b>${icon('sparkles', 15)} ${h.title}</b><p>${h.text}</p><div class="cb">` +
    (h.tab && h.tab !== tab ? `<button class="tb2" data-a="cardGo" data-i="0">Show me</button>` : '') +
    `<button data-a="cardOk" data-i="0">Got it</button></div>`;
  c.hidden = false;
  document.body.classList.add('carded');
  Polish.restart(c, 'reveal');
}
function closeCard() {
  if (!cardNow) return;
  hintsSeen(mode)[cardNow.id] = 1;
  saveSettings();
  cardNow = null;
  $('card').hidden = true;
  document.body.classList.remove('carded');
}
APP_ACTIONS.cardOk = () => closeCard();
// leaving the mode with a card open: it comes back next time instead of counting as seen
function closeCardQuiet() {
  cardNow = null;
  $('card').hidden = true;
  document.body.classList.remove('carded');
}
APP_ACTIONS.cardGo = () => {
  const to = cardNow && cardNow.tab;
  closeCard();
  if (to) goToTab(to);
};
// A save from before the cards existed: whatever is already part of the player's game is marked as known
function knownHints(m) {
  if (settings.hints[m.key] || m.state.playTime < 600) return;
  const seen = hintsSeen(m);
  m.hints.forEach((h) => h.when() && (seen[h.id] = 1));
}

// ===== The frame: tab bar, top boxes, panes =====
// The tab bar: the mode's five tabs, then the switch to the next mode in the far right corner
function buildNav() {
  const next = nextMode(mode);
  $('nav').classList.toggle('solo', next === mode); // only one game is on: no switch button
  $('nav').innerHTML =
    TABS.map((t) => `<button data-a="tab" data-i="${t.key}" id="nav-${t.key}" aria-label="${t.name}" style="--k:${t.color}">${icon(t.icon, 20)}<span>${t.name.split(' ').pop()}</span></button>`).join('') +
    (next === mode ? '' : `<button data-a="switchMode" data-i="0" id="nav-switch" aria-label="Switch to ${next.name}" style="--k:${next.accent}">${icon('swap', 20)}<span>${next.name}</span></button>`);
  // the mode bar: the full title, then one dot per game (the open one long), so it's plain which of the three this is
  setHTML($('modebar'), `${icon(mode.emblem, 14)}<span>Deepforge: <b>${mode.name}</b></span><i class="mrule"></i><i class="mdots" title="Game ${MODE_LIST.indexOf(mode) + 1} of ${MODE_LIST.length}">${MODE_LIST.map((m) => `<b class="${m === mode ? 'on' : ''}" style="--k:${m.accent}"></b>`).join('')}</i>`);
  document.title = fullTitle(mode);
}
function renderHeader() {
  const now = Date.now();
  mode.header().forEach(([label, ic, value, format, note], k) => {
    const tile = $('hd').children[k];
    setHTML(tile.firstElementChild, `${icon(ic, 12)} ${label}<i>${note}</i>`);
    if (value) tile.dataset['had' + mode.key] = 1;
    tile.classList.toggle('gone', k >= 2 && !tile.dataset['had' + mode.key]); // shown from the first time you have any
    tile.classList.toggle('zero', !value);
    Polish.count(tile.lastElementChild, value, format);
  });
  for (const t of TABS) {
    const b = $('nav-' + t.key), lock = lockedReason(t.key);
    b.classList.toggle('on', t.key === tab);
    b.classList.toggle('locked', !!lock);
    // a badge function returns true (something to afford), 'claim' (something to collect) or 'alert' (needs you now)
    const kind = !lock && t.key !== tab && mode.badges[t.key](now);
    b.classList.toggle('badge', !!kind);
    const type = typeof kind === 'string' ? kind : '';
    if (b.dataset.badge !== type) b.dataset.badge = type;
  }
  renderSwitchBadge(now);
  const st = $('strip'), sh = mode.strip ? mode.strip(now) : '';
  st.hidden = !sh;
  if (sh) setPane(st, sh);
  setText($('wipeb'), armed === 'delete' ? 'Tap again' : 'Delete');
}
function settingsRows() {
  const days = settings.lastExport ? Math.floor((Date.now() - settings.lastExport) / 864e5) : -1;
  return (
    row('Number format', FORMAT_NAMES[settings.format], btn('format', 0, 'Change', true)) +
    row('Visual effects', settings.effects ? 'Full: drifting motes, a living Stone, floating numbers' : 'Low: still backgrounds, easier on battery', btn('effects', 0, 'Toggle', true)) +
    MODE_LIST.map((m) => row(m.name, settings.modes[m.key] ? 'On: you can play and switch to it' : 'Off: hidden from the title screen and the switch button (your progress is kept)', btn('modeToggle', m.key, settings.modes[m.key] ? 'Turn off' : 'Turn on', true))).join('') +
    row('Backup', days < 0 ? 'Never exported. Use Export below.' : `${days} day${days === 1 ? '' : 's'} since your last export`, '') +
    row('Tutorial', `Show the ${mode.name} guide again`, btn('tutorial', 0, 'Show', true))
  );
}
function renderPane() {
  const [main, extra = ''] = mode.panes[tab]();
  setPane($('pane'), main);
  setPane($('pane2'), extra);
  if (tab === 'opus') {
    setHTML($('setrows'), settingsRows());
    setText($('delnote'), mode.deleteNote);
  }
}
// Full render: after actions and tab changes. The main loop renders the open tab about three times a second
// (tabs a mode draws itself, like Capitalist Mode's mines, every tick)
let shownTab = '';
function render(full) {
  renderHeader();
  if (shownTab !== tab) {
    shownTab = tab;
    mode.onTab(tab);
    $('stv').hidden = tab !== 'opus';
    StoneView.show(tab === 'opus');
    $('setb').hidden = tab !== 'opus';
    view.style.setProperty('--tabc', TABS[tabIndex(tab)].color);
    const t = TABS[tabIndex(tab)];
    setHTML($('tabhead'), `<h2>${icon(t.icon, 20)}${t.name}</h2>${t.desc ? `<p>${t.desc}</p>` : ''}`);
    if (mode.renderTab(tab)) return setPane($('pane'), ''), setPane($('pane2'), '');
  }
  if (!mode.renderTab(tab) && full) renderPane();
}

// ===== Big moments: a short full-screen cinematic for transmuting, ascending and forging the Stone =====
// kind: 'transmute' (a transmutation circle draws itself and swallows your gold), 'ascend' (a golden rune burst)
// or 'finish' (light in the mode's colors pours into the Philosopher's Stone; `colors` picks them)
// Draws an alchemist's sigil: circle, triangle, square and inner circle, each traced as far as `p` (0 to 1)
function sigil(x, cx, cy, r, p, spin) {
  const tri = [0, 1, 2].map((k) => [cx + r * Math.cos(spin - Math.PI / 2 + (k * 2 * Math.PI) / 3), cy + r * Math.sin(spin - Math.PI / 2 + (k * 2 * Math.PI) / 3)]);
  const sq = r * 0.5 / Math.SQRT2 * 2; // the square fits inside the triangle's inner circle
  const step = (from, to) => clamp01((p - from) / (to - from));
  x.beginPath();
  x.arc(cx, cy, r, spin, spin + 6.283 * step(0, 0.3));
  x.stroke();
  const t = step(0.25, 0.55) * 3;
  x.beginPath();
  for (let k = 0; k < 3 && k < t; k++) {
    const [ax, ay] = tri[k], [bx, by] = tri[(k + 1) % 3], f = Math.min(1, t - k);
    x.moveTo(ax, ay);
    x.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
  }
  x.stroke();
  const q = step(0.5, 0.75);
  if (q > 0) {
    x.save();
    x.translate(cx, cy);
    x.rotate(-spin * 1.5);
    x.strokeRect((-sq / 2) * q, (-sq / 2) * q, sq * q, sq * q);
    x.restore();
  }
  x.beginPath();
  x.arc(cx, cy, r * 0.35, -spin, -spin + 6.283 * step(0.7, 0.95));
  x.stroke();
}
function spectacle(kind, title, sub, then, colors) {
  const box = $('fx'), cv = $('fxc'), words = $('fxt');
  words.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
  words.className = kind;
  box.hidden = false;
  if (reducedMotion) {
    words.classList.add('show');
    return setTimeout(() => ((box.hidden = true), words.classList.remove('show'), then && then()), 1800);
  }
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2), x = cv.getContext('2d');
  cv.width = W * dpr;
  cv.height = H * dpr;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W / 2, cy = H * 0.45, R = Math.hypot(W, H) / 2, rand = (a, b) => a + Math.random() * (b - a);
  const palette = { transmute: ['#dcc795', '#a597d8', '#ecebf1', '#b4a7e0'], ascend: ['#f6e7bd', '#e9d08e', '#f0b996', '#f3eefa'], finish: colors || ['#dcc795', '#d9a6b1', '#b4a7e0', '#93c4bd'] }[kind];
  const parts = Array.from({ length: 220 }, () => ({
    a: rand(0, 6.283), z: rand(0.15, 1), r: rand(0.2, 1), s: rand(0.6, 1.4), c: palette[(Math.random() * palette.length) | 0],
  }));
  const LEN = 3000;
  let t0 = 0;
  function frame(now) {
    if (!t0) t0 = now;
    const p = Math.min(1, (now - t0) / LEN); // a late frame never overshoots the end
    x.clearRect(0, 0, W, H);
    // backdrop: darkens in, holds, fades out (the Stone's light turns it gold and hands over to the ending screen)
    const dark = kind === 'finish' ? Math.min(0.9, p * 2) : Math.min(0.78, p * 4) * (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1);
    x.globalAlpha = 1;
    x.fillStyle = `rgba(6,2,12,${dark})`;
    x.fillRect(0, 0, W, H);
    x.lineCap = x.lineJoin = 'round';
    const fade = p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;
    if (kind === 'transmute') {
      // the circle traces itself, then your gold spirals into it and melts away into Dark Matter
      const spin = p * 2.2, r = Math.min(W, H) * 0.36;
      x.globalAlpha = fade;
      x.shadowColor = 'rgba(196,178,239,.5)';
      x.shadowBlur = 4;
      x.strokeStyle = '#e9d08e';
      x.lineWidth = 2;
      sigil(x, cx, cy, r, p * 1.6, spin);
      x.strokeStyle = 'rgba(196,178,239,.6)';
      x.lineWidth = 1;
      sigil(x, cx, cy, r * 1.12, p * 1.6 - 0.15, -spin * 0.6);
      x.shadowBlur = 0;
      for (const s of parts) {
        const pull = clamp01((p - 0.2) * 1.5 * s.s), d = (1 - pull) * R * (0.35 + s.r * 0.8), a = s.a + pull * 5;
        if (pull >= 1) continue;
        x.globalAlpha = (pull > 0 ? 1 - pull : Math.min(1, p * 5)) * 0.9;
        x.fillStyle = s.c;
        x.beginPath();
        x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + s.r * 2, 0, 6.283);
        x.fill();
      }
      // the dark core it leaves behind
      const core = clamp01((p - 0.45) / 0.25) * fade, g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 0.45);
      g.addColorStop(0, `rgba(10,0,24,${core})`);
      g.addColorStop(0.6, `rgba(183,155,244,${0.4 * core})`);
      g.addColorStop(1, 'rgba(183,155,244,0)');
      x.globalAlpha = 1;
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r * 0.45, 0, 6.283);
      x.fill();
    } else if (kind === 'ascend') {
      // a glowing core swells, then golden shockwaves and sparks burst outward
      const burst = Math.max(0, (p - 0.28) / 0.72);
      const core = p < 0.28 ? p / 0.28 : Math.max(0, 1 - burst * 2);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, 30 + 90 * core);
      g.addColorStop(0, `rgba(246,231,189,${0.85 * core})`);
      g.addColorStop(0.4, `rgba(233,208,142,${0.5 * core})`);
      g.addColorStop(1, 'rgba(240,185,150,0)');
      x.globalAlpha = 1;
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, 30 + 90 * core, 0, 6.283);
      x.fill();
      for (let k = 0; k < 3; k++) {
        const q = burst - k * 0.12;
        if (q <= 0 || q >= 1) continue;
        x.globalAlpha = (1 - q) * 0.9;
        x.strokeStyle = palette[k];
        x.lineWidth = 6 * (1 - q) + 1;
        x.beginPath();
        x.arc(cx, cy, q * R * 1.1, 0, 6.283);
        x.stroke();
      }
      if (burst > 0)
        for (const s of parts) {
          const d = burst * R * (0.4 + s.r * 0.9), a = s.a + burst * 0.6 * (s.s - 1);
          x.globalAlpha = Math.max(0, 1 - burst) * 0.95;
          x.fillStyle = s.c;
          x.beginPath();
          x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + s.r * 2.2 * (1 - burst * 0.5), 0, 6.283);
          x.fill();
        }
    } else {
      // light in every mine's color pours inward, and the red Stone forms and blazes
      for (const s of parts) {
        const pull = clamp01(p * 1.4 * s.s), d = (1 - pull) * R * (0.3 + s.r), a = s.a + pull * 6;
        x.globalAlpha = (1 - pull) * 0.9;
        x.fillStyle = s.c;
        x.beginPath();
        x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + s.r * 1.8, 0, 6.283);
        x.fill();
      }
      const grow = clamp01((p - 0.3) / 0.5), size = 10 + grow * Math.min(W, H) * 0.16;
      const glow = x.createRadialGradient(cx, cy, 0, cx, cy, size * 4);
      glow.addColorStop(0, `rgba(246,226,190,${0.6 * grow})`);
      glow.addColorStop(0.3, `rgba(237,165,179,${0.35 * grow})`);
      glow.addColorStop(1, 'rgba(237,165,179,0)');
      x.globalAlpha = 1;
      x.fillStyle = glow;
      x.fillRect(0, 0, W, H);
      x.fillStyle = `rgba(${200 + 40 * grow},${130 + 60 * grow},${145 + 50 * grow},${grow})`;
      x.beginPath();
      x.moveTo(cx, cy - size * 1.2);
      x.lineTo(cx + size, cy - size * 0.2);
      x.lineTo(cx, cy + size * 1.5);
      x.lineTo(cx - size, cy - size * 0.2);
      x.closePath();
      x.fill();
      // at the end the light washes the whole screen gold before the ending
      x.globalAlpha = clamp01((p - 0.85) / 0.15);
      x.fillStyle = '#fff4dc';
      x.fillRect(0, 0, W, H);
    }
    // a bright flash at the peak of each moment
    const peak = { transmute: 0.62, ascend: 0.3, finish: 0.8 }[kind], f = Math.max(0, 1 - Math.abs(p - peak) / 0.07);
    if (f > 0) {
      x.globalAlpha = f * (kind === 'finish' ? 0.4 : 0.45);
      x.fillStyle = kind === 'transmute' ? '#e9d8ff' : '#fff3c4';
      x.fillRect(0, 0, W, H);
    }
    if (p > peak && !words.classList.contains('show') && kind !== 'finish') words.classList.add('show');
    if (p < 1) return requestAnimationFrame(frame);
    words.classList.remove('show');
    box.hidden = true;
    x.clearRect(0, 0, W, H);
    if (then) then();
  }
  requestAnimationFrame(frame);
}
