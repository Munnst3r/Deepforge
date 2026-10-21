// Pacing simulation: plays each mode headlessly with a simple greedy bot and prints when the big moments happen.
// The bot is a steady active player: it buys what it can afford every few seconds, taps unmanaged mines, takes every
// research and upgrade, and prestiges when the game's own badge says it's worth it. Real play will differ, but the
// timeline shows whether a mode's pacing is in the right range and where it stalls.
// Usage: node sim.js [hours=100] [mode=all] [page=index.html]   (needs Playwright with Chromium)
const path = require('path');
const { chromium } = require('playwright');

const HOURS = +(process.argv[2] || 100);
const ONLY = process.argv[3] || 'all';
const PAGE = path.resolve(process.argv[4] || path.join(__dirname, 'index.html'));

// Runs inside the page. Returns [{ h, what }] events and hourly snapshots.
function bots() {
  const ids = (html, a) => [...html.matchAll(new RegExp(`data-a="${a}" data-i="([^"]+)"`, 'g'))].map((x) => x[1]);
  const paneHtml = (m) => Object.values(m.panes).map((f) => [].concat(f()).join('')).join('');
  const twice = (f) => (f(), f());

  const capitalist = {
    mode: () => MODES.capitalist,
    decide(m) {
      const A = m.actions, S = m.state;
      for (let i = 0; i < S.level.length; i++) if (S.level[i] && !S.golems[i]) A.run(i);
      A.summonAll();
      A.upgradeAll();
      const html = paneHtml(m);
      for (const a of ['research', 'dmUpgrade', 'runeUpgrade', 'quest', 'catalyst']) for (const id of ids(html, a)) A[a](id);
      for (let pass = 0; pass < 40; pass++) {
        let any = false;
        for (let i = 0; i < S.level.length; i++) {
          const c = S.cash;
          A.mode(10);
          A.buy(i);
          if (S.cash === c) A.mode(1), A.buy(i);
          any = any || S.cash < c;
        }
        if (!any) break;
      }
      twice(A.finish);
      if (m.badges.transmute(Date.now())) {
        const a = S.ascensions;
        twice(A.ascend);
        if (S.ascensions === a) twice(A.transmute);
      }
    },
    watch: (S) => ({ transmutes: S.transmutes, ascensions: S.ascensions, everyMine: S.allMs || 0, crucible: +!!S.crucibleBuilt, stone: +!!S.wonAt || S.stones }),
    snap: (S) => `gold earned ${fmt(S.totalEarned)} · DM ${fmt(S.darkMatter)} · mines ${S.level.slice(0, 30).filter(Boolean).length}`,
  };

  const communist = {
    mode: () => MODES.communist,
    decide(m) {
      const A = m.actions, S = m.state;
      for (let k = 0; k < 4; k++) A.pan();
      for (let i = 1; i < 6; i++) A.discover(i);
      for (let pass = 0; pass < 40; pass++) {
        let any = false;
        for (let i = 0; i < 6; i++)
          for (let t = S.units[i].length - 1; t >= 0; t--) {
            const b = S.bought[i][t];
            A.mode(10);
            A.buy(i + '.' + t);
            if (S.bought[i][t] === b) A.mode(1), A.buy(i + '.' + t);
            any = any || S.bought[i][t] > b;
          }
        if (!any) break;
      }
      A.enchantAll();
      for (let k = 0; k < 20; k++) A.lab();
      const html = paneHtml(m);
      for (const a of ['research', 'dmUpgrade', 'quest']) for (const id of ids(html, a)) A[a](id);
      A.offerAll();
      twice(A.finish);
      if (m.badges.transmute(Date.now())) twice(A.transmute);
    },
    watch: (S) => ({ transmutes: S.transmutes, industries: S.open.filter(Boolean).length, stage: S.stage, step: S.stage * 3 + S.step, everyTier: (S.tierMs || []).reduce((a, b) => a + b, 0), stone: +!!S.wonAt || S.stones }),
    snap: (S) => `gold earned ${fmt(S.totalEarned)} · DM ${fmt(S.darkMatter)} · enchants ${S.enchants.join('/')}`,
  };

  const industrialist = {
    mode: () => MODES.industrialist,
    decide() {
      const G = IndLogic, A = G.act, S = G.state();
      A.setBuy('1');
      A.overtime();
      for (const m of S.mines) {
        if (!m.open) continue;
        const mi = m.i;
        A.abilAll(mi);
        m.shafts.forEach((s, i) => s.mgr || A.dig(i, mi));
        if (!m.E.mgr) A.send('e', mi);
        if (!m.W.mgr) A.send('w', mi);
        for (const k of G.keysOf(m)) if (!G.stageOf(m, k).mgr) A.hire(k, 'p', mi);
        for (const k of G.keysOf(m)) A.promote(k, mi);
        if (!m.doct && S.feat.lab) A.doctrine('steady', mi);
        while (A.unlock(mi));
        A.buildRef(mi);
        for (const d of G.LAB) if (G.labCost(m, d.id) <= m.cash * 0.2) A.research(d.id, mi);
        if (m.ref && !m.split) A.setSplit(0.1, mi);
        // greedy levels: the stage with the most income per dollar
        for (let n = 0; n < 300; n++) {
          let best = null;
          for (const k of G.keysOf(m)) {
            const c = G.upInfo(m, k, '1').cost, g = G.upgradeGain(m, k);
            if (g > 0 && (!best || g / c > best.r)) best = { k, r: g / c, c };
          }
          if (!best) {
            // nothing raises income on its own (e.g. an elevator bottleneck where a bigger car only travels further):
            // level the weakest shaft, which is what a person would do
            let lo = null;
            m.shafts.forEach((s, i) => { if (!lo || s.lvl < lo.s.lvl) lo = { s, k: 's' + i }; });
            best = { k: lo.k, c: G.upInfo(m, lo.k, '1').cost };
          }
          if (m.cash < best.c || !A.up(best.k, mi)) break;
        }
        const g = G.claimGain(m);
        if (g >= 1 && (1 + 0.1 * (m.ingots + g)) / (1 + 0.1 * m.ingots) >= 1.5) A.claim(mi);
      }
      for (const p of G.PROJ) A.project(p.id);
      G.PERKS.forEach((p, t) => A.pickPerk(t, 'a'));
      for (const e of G.EQUIP) {
        A.craft(e.id);
        const free = S.slots.indexOf(null);
        if (free >= 0 && !S.slots.includes(e.id) && S.equip[e.id]) A.slot(e.id, free);
      }
    },
    watch: () => {
      const S = IndLogic.state();
      return { ingots: IndLogic.totalIngots() >= 1 ? Math.floor(Math.log10(IndLogic.totalIngots())) : -1, mines: S.mines.filter((m) => m.open).length, core: S.proj.core || 0 };
    },
    snap: () => {
      const S = IndLogic.state();
      const open = S.mines.filter((m) => m.open);
      return `ingots ${fmt(IndLogic.totalIngots())} · claims ${open.map((m) => m.claims).join('/')} · shafts ${open.map((m) => m.shafts.length).join('/')} · income ${open.map((m) => fmt(IndLogic.rates(m, false, true).income)).join('/')} · bn ${open.map((m) => IndLogic.rates(m, false, true).bn[0]).join('')}`;
    },
  };
  return { capitalist, communist, industrialist };
}

async function simulate(page, key, hours) {
  return page.evaluate(
    async ([key, hours, src]) => {
      const bot = eval('(' + src + ')')()[key];
      const m = bot.mode();
      m.load(null);
      m.refresh();
      const events = [], snaps = [];
      const best = bot.watch(m.state);
      const step = key === 'industrialist' ? 0.5 : 1;
      for (let t = 0; t < hours * 3600; t += step) {
        if (t % (t < 3600 ? 2 : 10) < step) bot.decide(m);
        m.tick(step);
        if (t % 60 < step) {
          m.checkAchievements();
          const now = bot.watch(m.state);
          for (const k in now) if (now[k] > best[k]) events.push({ h: t / 3600, what: `${k} ${(best[k] = now[k])}` }); // firsts only
        }
        if (t % 3600 < step && t) snaps.push({ h: t / 3600, s: bot.snap(m.state) });
        if (t % 1800 < step) await new Promise((r) => setTimeout(r)); // let the page breathe
      }
      return { events, snaps };
    },
    [key, hours, bots.toString()],
  );
}

(async () => {
  const browser = await chromium.launch();
  for (const key of ['industrialist', 'capitalist', 'communist']) {
    if (ONLY !== 'all' && ONLY !== key) continue;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.setInterval = () => 0; // the game's own loop and autosave stay off: the sim drives time
      localStorage.clear();
    });
    await page.goto('file://' + PAGE);
    const t0 = Date.now();
    const { events, snaps } = await simulate(page, key, HOURS);
    console.log(`\n=== ${key} (${HOURS} h, ${((Date.now() - t0) / 1000).toFixed(0)} s to simulate)`);
    for (const e of events) console.log(`  ${e.h.toFixed(2).padStart(7)} h  ${e.what}`);
    for (const s of snaps.filter((s, i) => (process.env.ALLSNAPS || [1, 2, 5, 10, 20, 50, 100, 200].includes(Math.round(s.h))))) console.log(`  @${String(Math.round(s.h)).padStart(4)} h  ${s.s}`);
    if (errors.length) console.log('  errors:', [...new Set(errors)].slice(0, 5));
    await page.close();
  }
  await browser.close();
})();
