// ===== Ending =====
function showEnding() {
  const e = mode.ending();
  setText($('endh'), e.title);
  setText($('endp'), e.text);
  $('ends').innerHTML = e.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('end').hidden = false;
}

// ===== Theme: each mode has its own fixed accent color (brass for Industrialist, dusty rose for Communist), and the
// surfaces take a faint tint of it =====
function applyTheme(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = Math.round(60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4));
  if (h < 0) h += 360;
  const root = document.documentElement.style;
  root.setProperty('--h', h);
  root.setProperty('--acc', hex);
}

// ===== Switching modes =====
// Makes `to` the open mode. The mode you leave is saved first; the new one catches up on its time away (each mode
// only ever touches its own data), takes over the frame, and is remembered as the mode to open next launch.
// Returns what it made while you were away
function enterMode(to) {
  const from = mode;
  if (from !== to) saveMode(from);
  mode = to;
  TABS = mode.tabs;
  tab = firstTab(mode);
  settings.mode = mode.key;
  const away = awayGains(mode);
  mode.refresh();
  knownHints(mode);
  closeCardQuiet();
  for (const tile of $('hd').children) delete tile.lastElementChild._shown; // the new mode's numbers show as they are, not counting over from the old mode's
  $('tut').hidden = true;
  $('end').hidden = true;
  if (from !== to) from.onTab('');
  applyTheme(mode.accent);
  buildNav();
  shownTab = '';
  view.scrollTop = 0;
  render(true);
  saveGame();
  return away;
}

// One tap: the current mode is saved and a curtain in the next mode's colors rises with its name. Behind it the next
// mode catches up on the time you were away and takes over the screen; what it made counts up on the curtain. Then
// the curtain lifts and the new mode slides into place, its numbers easing from the old values to the new ones.
function switchMode() {
  if (switching || nextMode(mode) === mode) return;
  switching = true;
  armed = '';
  clearTabTimers();
  const to = nextMode(mode), fast = reducedMotion || !settings.effects;
  const sw = $('swap');
  sw.style.setProperty('--c', to.accent);
  $('swn').innerHTML = `${icon(to.emblem, 22)}<small>Now playing · a separate game</small><span>${to.name}</span>`;
  setText($('swa'), '');
  $('swg').innerHTML = '';
  $('swx').getAnimations().forEach((a) => a.cancel());
  sw.hidden = false;
  sw.className = 'in';
  document.body.classList.add('switching');
  setTimeout(() => {
    // behind the curtain: the other mode takes over
    const { away, gains } = enterMode(to);
    // what the mode made while you were away counts up on the curtain
    const listGains = gains.length && away >= 60; // a quick hop back and forth just switches
    if (listGains)
      morph($('swx'), () => {
        setText($('swa'), `While you were away (${duration(away)})`);
        showGains($('swg'), gains, fast ? 1 : 900);
      }); // the summary opens up under the name rather than pushing it up in one jump
    const hold = fast ? 500 : listGains ? 1500 + 80 * gains.length : 550;
    setTimeout(() => {
      sw.className = 'out';
      document.body.classList.remove('switching');
      document.body.classList.add('arriving');
      Motes.rush(1, mode.accent);
      setTimeout(() => {
        sw.hidden = true;
        sw.className = '';
        switching = false;
        maybeTutorial();
      }, fast ? 50 : 520);
      setTimeout(() => document.body.classList.remove('arriving'), fast ? 50 : 760); // after the settle has finished, so it never snaps
    }, hold);
  }, fast ? 60 : 380);
}

// ===== Title screen: pick a mode, then tap anywhere to play it =====
// The selector shows the modes; picking one makes it the open mode right away (its name, earnings, line and
// colors take over the title), and tapping anywhere else starts playing whichever mode is picked
const titleAway = {}; // what each mode made while you were away, from its first catch-up since the app opened
function showTitle() {
  const on = MODE_LIST.filter(modeOn);
  const sig = on.map((m) => m.key).join();
  if ($('msel').dataset.sig !== sig) {
    $('msel').dataset.sig = sig;
    $('msel').style.setProperty('--n', on.length);
    $('msel').innerHTML = on
      .map((m) => `<button role="radio" data-a="selectMode" data-i="${m.key}" style="--k:${m.accent}">${icon(m.emblem, 15)}<span>${m.name}</span></button>`)
      .join('');
  }
  for (const b of $('msel').children) {
    const sel = b.dataset.i === mode.key;
    b.classList.toggle('on', sel);
    b.setAttribute('aria-checked', sel);
  }
  setHTML($('tmenu'), `<small>Games</small>` + MODE_LIST.map((m) => `<button role="switch" aria-checked="${!!modeOn(m)}" data-a="modeToggle" data-i="${m.key}" style="--k:${m.accent}">${icon(m.emblem, 16)}<span>${m.name}</span><i></i></button>`).join(''));
  setText($('tsub'), mode.name);
  document.title = fullTitle(mode);
  $('go').textContent = mode.state.playTime > 1 ? 'Tap anywhere to continue' : 'Tap anywhere to start';
  $('ts').textContent = mode.titleLine();
  const a = titleAway[mode.key];
  $('away').hidden = !(a && a.gains.length);
  if (!$('away').hidden) {
    $('away').innerHTML = `<small>${mode.name} · while you were away (${duration(a.away)})</small><div class="gains"></div>`;
    $('away').classList.toggle('still', !!a.seen);
    showGains($('away').lastElementChild, a.gains, reducedMotion ? 1 : 1100, a.seen); // counts up the first time only
    a.seen = true;
  }
}
APP_ACTIONS.selectMode = (key) => {
  const to = MODES[key];
  modePickedAt = Date.now();
  if (!to || to === mode || switching || started) return;
  const r = enterMode(to);
  if (!(key in titleAway)) titleAway[key] = r;
  // The selector's highlight slides over and the colors ease across at once; the details below cross-fade in place
  for (const b of $('msel').children) {
    b.classList.toggle('on', b.dataset.i === key);
    b.setAttribute('aria-checked', b.dataset.i === key);
  }
  morph($('tsub'), () => setText($('tsub'), mode.name));
  morph($('tmode'), showTitle);
};

// ===== Start-up and main loop (10 ticks per second, autosave every 5 seconds) =====
for (const m of MODE_LIST) loadMode(m);
updateResonance();
for (const m of MODE_LIST) m.refresh();
const startAway = awayGains(mode);
for (const m of MODE_LIST) m.buildUI();
document.body.classList.toggle('low', !settings.effects);
applyTheme(mode.accent);
buildNav();
mode.refresh();
render(true);
$('tico').innerHTML = icon('gem', 96);
$('tset').innerHTML = icon('cog', 16) + '<span>Settings</span>';
$('endi').innerHTML = icon('gem', 84);
titleAway[mode.key] = startAway;
showTitle();
setTimeout(() => $('title') && $('title').classList.add('ready'), 1400); // the intro has played: from now on the title holds still
saveGame();
let lastTick = Date.now(),
  ticks = 0;
setInterval(() => {
  const now = Date.now(), dt = (now - lastTick) / 1000;
  lastTick = now;
  if (dt <= 0) return; // the clock went backwards: carry on from the new time rather than freezing until it catches up
  // The phone paused the game (app in the background, or asleep): the open mode catches up like any time away
  if (dt > 5) {
    mode.state.savedAt = Math.max(mode.state.savedAt, lastTick - dt * 1000); // from the last tick (or later, if the clock was turned back since)
    const { away, gains } = awayGains(mode);
    if (gains.length) toast(`Welcome back! While you were away (${duration(away)}): ${gainsText(gains)}`);
    render(true);
    return;
  }
  mode.tick(dt);
  if (++ticks % 10 === 0) mode.checkAchievements(), checkHints(), updateResonance();
  if (!document.hidden) render(ticks % 3 === 0); // nobody is looking while the page is hidden: production still runs, drawing waits
}, 100);
// Saving: every 5 seconds, and whenever the page is hidden or closed (pagehide is the one iOS reliably sends)
let importing = false;
const saveNow = () => importing || saveGame();
setInterval(saveNow, 5000);
addEventListener('pagehide', saveNow);
addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => (document.hidden ? saveNow() : render(true)));

// ===== Background: a deep cavern =====
// Motes of glowing dust rise slowly through soft crystal light, and now and then a crystal glints. When you change
// tabs the motes sweep sideways as sparks. The cavern is laid out from a fixed seed and only rebuilt when the width
// changes, so toolbars showing or hiding never reshuffle it
const Motes = (() => {
  const air = document.createElement('canvas'), deep = document.createElement('canvas');
  air.id = 'air';
  deep.id = 'deep';
  document.body.prepend(air);
  document.body.prepend(deep);
  const ctx = air.getContext('2d'), dctx = deep.getContext('2d');
  let W = 0, H = 0, motes = [], glint = null, last = -1e3;
  let drift = 0, driftTarget = 0; // motes follow a sideways drag a little (nearer ones more)
  let rushSpeed = 0, sparks = []; // after a tab change: sideways mote speed, and bright sparks flying across
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  function layout() {
    const w = innerWidth, h = Math.max(innerHeight, screen.height);
    if (w === W && h <= H) return;
    W = w;
    H = Math.max(h, H);
    const dpr = Math.min(devicePixelRatio || 1, 2), rand = seeded(W * 7919 + 17);
    const R = (a, b) => a + rand() * (b - a);
    for (const [c, x] of [[air, ctx], [deep, dctx]]) {
      c.width = W * dpr;
      c.height = H * dpr;
      c.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // crystal light glowing through the rock (amethyst, aquamarine, amber, rose, emerald), drawn once
    const hues = [275, 185, 35, 330, 150, 255];
    dctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const cx = R(0, W), cy = R(0, H), r = R(0.3, 0.55) * Math.max(W, H), hue = hues[i % hues.length];
      for (let k = 0; k < 3; k++) {
        const rr = r * R(0.4, 0.9), q = dctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        q.addColorStop(0, `hsla(${hue + R(-15, 15)},28%,58%,${R(0.025, 0.045)})`);
        q.addColorStop(0.5, `hsla(${hue + R(-20, 20)},24%,48%,${R(0.01, 0.02)})`);
        q.addColorStop(1, `hsla(${hue},24%,48%,0)`);
        dctx.save();
        dctx.translate(cx + R(-0.3, 0.3) * r, cy + R(-0.3, 0.3) * r);
        dctx.rotate(R(0, 3.14));
        dctx.scale(1, R(0.4, 0.9));
        dctx.fillStyle = q;
        dctx.beginPath();
        dctx.arc(0, 0, rr, 0, 6.283);
        dctx.fill();
        dctx.restore();
      }
    }
    motes = Array.from({ length: Math.round((W * H) / 6500) }, () => ({
      x: R(0, W), y: R(0, H), r: R(0.4, 1.8), rise: R(0.04, 0.18), sway: R(0.3, 1.2), phase: R(0, 6.28), kind: rand() < 0.2 ? 1 : rand() < 0.35 ? 2 : 0,
    }));
    if (reducedMotion) draw(0, 0);
  }

  function draw(t, steps) {
    const acc = document.documentElement.style.getPropertyValue('--acc') || '#b4a7e0'; // the inline value: reading a computed style every frame forces a style recalculation
    ctx.clearRect(0, 0, W, H);
    drift += (driftTarget - drift) * Math.min(1, 0.35 * steps || 1);
    rushSpeed *= 0.9 ** steps;
    if (Math.abs(rushSpeed) < 0.05) rushSpeed = 0;
    ctx.lineCap = 'round';
    for (const m of motes) {
      const depth = m.r / 1.8; // bigger motes feel nearer, so they move more
      if (!reducedMotion) {
        m.y -= m.rise * steps;
        if (m.y < -4) m.y = H + 4;
        m.x = (((m.x + rushSpeed * depth * steps) % W) + W) % W;
      }
      const sway = Math.sin(t / 2400 + m.phase) * 6 * m.sway;
      const x = (((m.x + sway + drift * depth * 0.35) % W) + W) % W, len = Math.abs(rushSpeed) * depth * 2.4;
      ctx.globalAlpha = 0.08 + 0.28 * Math.abs(Math.sin(t / 1700 + m.phase));
      ctx.fillStyle = ctx.strokeStyle = m.kind === 1 ? acc : m.kind === 2 ? '#dcc795' : '#d9d6e2';
      ctx.beginPath();
      if (len > 1.5) {
        ctx.lineWidth = m.r * 1.6;
        ctx.moveTo(x, m.y);
        ctx.lineTo(x - Math.sign(rushSpeed) * len, m.y);
        ctx.stroke();
      } else {
        ctx.arc(x, m.y, m.r, 0, 6.283);
        ctx.fill();
      }
    }
    // sparks from a tab change: a bright head with a fading tail
    sparks = sparks.filter((k) => (k.life -= 0.022 * steps) > 0 && k.x > -k.len - 40 && k.x < W + k.len + 40);
    for (const k of sparks) {
      k.x += k.v * steps;
      const tail = k.x - Math.sign(k.v) * k.len, g = ctx.createLinearGradient(k.x, 0, tail, 0);
      g.addColorStop(0, k.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = Math.min(1, k.life * 1.6);
      ctx.strokeStyle = g;
      ctx.lineWidth = k.w;
      ctx.beginPath();
      ctx.moveTo(k.x, k.y);
      ctx.lineTo(tail, k.y);
      ctx.stroke();
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.w * 0.9, 0, 6.283);
      ctx.fill();
    }
    // now and then a crystal somewhere in the rock catches the light: a four-pointed glint that swells and fades
    if (!reducedMotion) {
      if (!glint && Math.random() < 0.006) glint = { x: Math.random() * W, y: Math.random() * H, life: 0, size: 6 + Math.random() * 8 };
      if (glint) {
        glint.life += 0.04 * steps;
        const s = Math.sin(Math.min(1, glint.life) * Math.PI) * glint.size;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#f3eefa';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(glint.x - s, glint.y);
        ctx.lineTo(glint.x + s, glint.y);
        ctx.moveTo(glint.x, glint.y - s * 1.4);
        ctx.lineTo(glint.x, glint.y + s * 1.4);
        ctx.stroke();
        if (glint.life >= 1) glint = null;
      }
    }
  }

  // Runs every frame, for the smoothest drift
  const titleEl = document.getElementById('title');
  function frame(t) {
    requestAnimationFrame(frame);
    if (titleEl.isConnected || document.body.classList.contains('low')) return;
    const steps = Math.min(4, Math.max(0.25, (t - last) / 16.7));
    last = t;
    draw(t, steps);
  }

  layout();
  addEventListener('resize', layout);
  if (!reducedMotion) requestAnimationFrame(frame);
  return {
    drag(dx) {
      driftTarget = dx;
    },
    // dir: which way the page moves (-1 left, +1 right); color: the new tab's color for some of the sparks
    rush(dir, color) {
      if (reducedMotion || !settings.effects) return;
      for (const m of motes) m.x = (((m.x + drift * (m.r / 1.8) * 0.35) % W) + W) % W; // keep motes where the drag left them
      drift = driftTarget = 0;
      rushSpeed = dir * 26;
      const h = innerHeight;
      for (let n = 0; n < 18; n++)
        sparks.push({
          x: dir < 0 ? W + Math.random() * W * 0.6 : -Math.random() * W * 0.6,
          y: 40 + Math.random() * (h - 80),
          v: dir * (22 + Math.random() * 26),
          len: 50 + Math.random() * 130,
          w: 0.8 + Math.random() * 1.6,
          life: 1,
          color: Math.random() < 0.55 ? color : '#ffffff',
        });
    },
  };
})();

// Room at the end of every tab: measured, not guessed. iPhones sometimes make the page taller than the
// screen, so a fixed amount isn't enough. This only sets a size; it never scrolls or touches the viewport.

(() => {
  const nav = $('nav');
  let last = -1;
  function fitEnd() {
    const vv = window.visualViewport;
    const seen = Math.min(nav.getBoundingClientRect().top, innerHeight, vv ? vv.height + vv.offsetTop : innerHeight);
    const room = Math.ceil(Math.max(0, view.getBoundingClientRect().bottom - seen, nav.offsetHeight) + 24);
    if (room !== last) view.style.setProperty('--end', (last = room) + 'px');
  }
  // The page itself must never be scrolled: on iPhone a scrolled page draws the fixed screen in one place but takes
  // taps somewhere else, so any scroll (iOS can nudge it when the app opens short) is put straight back
  const unscroll = () => (scrollX || scrollY) && scrollTo(0, 0);
  addEventListener('scroll', unscroll);
  fitEnd();
  requestAnimationFrame(fitEnd);
  addEventListener('resize', fitEnd);
  addEventListener('pageshow', fitEnd);
  document.addEventListener('visibilitychange', () => document.hidden || fitEnd());
  if (window.visualViewport) visualViewport.addEventListener('resize', fitEnd);
  setInterval(() => document.hidden || (unscroll(), fitEnd()), 1000);
})();
