// Regression tests: loads the game headlessly and checks the rules that are easy to break and hard to notice in play
// (number formatting, prices against their formulas, purchases, prestige rewards, saving and time away).
// Every test runs in a fresh, throwaway browser profile, so no real save is ever touched.
// Usage: node test.js [page=index.html]   (needs Playwright with Chromium, like sim.js)
const path = require('path');
const { chromium } = require('playwright');
const PAGE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, 'index.html'));

// Each test runs inside the page: `t` has eq/near/ok, and `G` is the page's global scope. Expected values are worked
// out here from the rules as written in the constant tables, not read back from the code under test.
const TESTS = {
  'fmt and plain': (t) => {
    t.eq(fmt(0), '0.00');
    t.eq(fmt(999.4), '999');
    t.eq(fmt(999.6), '1.00K'); // never "1000"
    t.eq(fmt(999999.99), '1.00M'); // never "1000.00K"
    t.eq(fmt(1.5e9), '1.50B');
    t.eq(fmt(-2500), '-2.50K');
    t.eq(fmt(Infinity), '∞');
    t.eq(fmt(NaN), '0');
    t.eq(plain(1000), '1,000');
    t.eq(plain(10000), '10,000');
    t.eq(plain(1e5), '100K');
    t.eq(plain(1e6), '1M');
    t.eq(plain(1e7), '10M');
    t.eq(plain(1e9), '1B');
    t.eq(plain(1e20), '100Qi');
    t.eq(plain(1e40), '10DDc');
    t.eq(plain(131072), '131.07K');
    t.eq(plain(999999), '1M');
  },
  'Dark Matter bonus curve': (t) => {
    t.near(dmBonusFor(0.02, 500), 10); // linear up to 1,000
    t.near(dmBonusFor(0.02, 1000), 20);
    t.near(dmBonusFor(0.02, 8000), 40); // then the cube root: 8× the Dark Matter doubles the bonus
    t.ok(dmBonusFor(0.02, 1001) > dmBonusFor(0.02, 1000), 'keeps growing past 1,000');
  },
  'mergeSave repairs bad fields': (t) => {
    const fresh = () => ({ a: 1, list: [0, 0, 0], nest: [[0, 0], [0]], obj: {}, name: 'x', flag: false });
    const s = mergeSave(fresh(), { a: -5, list: [1, 'x', null, 9], nest: [[2, NaN]], obj: [], name: 3, flag: true, junk: 1 });
    t.eq(s.a, 1); // negative → default
    t.eq(JSON.stringify(s.list), '[1,0,0]'); // fitted to length, bad entries → default
    t.eq(JSON.stringify(s.nest), '[[2,0],[0]]');
    t.eq(JSON.stringify(s.obj), '{}'); // an array is not an object
    t.eq(s.name, 'x');
    t.eq(s.flag, true);
    t.ok(!('junk' in s), 'unknown keys dropped');
    t.eq(mergeSave(fresh(), 'garbage').a, 1);
  },
  'plurals of names ending in "works"': (t) => {
    t.eq(plural('Forgeworks'), 'Forgeworks');
    t.eq(plural('Orichalcum Works'), 'Orichalcum Works');
    t.eq(plural('Panner'), 'Panners');
    t.eq(plural('Assay Guild'), 'Assay Guilds');
    t.eq(plural('Foundry'), 'Foundries');
  },

  // ----- Capitalist -----
  'Capitalist: level prices are the sum of each level, charged once': (t) => {
    const C = MODES.capitalist;
    C.load({ cash: 1e6 });
    C.refresh();
    // Clay Pit: ₲4, ×1.07 per level owned
    const each = (L) => 4 * 1.07 ** L;
    let sum10 = 0;
    for (let L = 0; L < 10; L++) sum10 += each(L);
    C.actions.mode(10);
    C.actions.buy(0);
    t.eq(C.state.level[0], 10, 'levels bought');
    t.near(C.state.cash, 1e6 - sum10, 'cash after ×10', 1e-12);
    // Max: as many as the gold covers, and not one more
    C.actions.mode('max');
    let L = 10, cash = C.state.cash;
    while (cash >= each(L)) cash -= each(L++);
    C.actions.buy(0);
    t.eq(C.state.level[0], L, 'levels from Max');
    t.ok(C.state.cash >= 0 && C.state.cash < each(L) * (1 + 1e-9), 'Max leaves less than one more level');
    // failed purchase changes nothing
    const before = JSON.stringify(C.state);
    C.actions.mode(1);
    C.state.cash = 0;
    const snap = JSON.stringify(C.state);
    C.actions.buy(0);
    t.eq(JSON.stringify(C.state), snap, 'an unaffordable buy changed state');
    t.ok(before !== snap);
  },
  'Capitalist: a mine not open to you yet cannot be bought or look buyable': (t) => {
    const C = MODES.capitalist;
    C.load({ cash: 1e6 }); // Head Start money on a fresh run: the Iron Mine needs a Copper Seam first
    C.refresh();
    C.actions.mode(1);
    C.actions.buy(2);
    t.eq(C.state.level[2], 0, 'Iron Mine bought without a Copper Seam');
    t.eq(C.state.cash, 1e6);
    C.actions.buy(1); // Copper needs a Clay Pit
    t.eq(C.state.level[1], 0, 'Copper Seam bought without a Clay Pit');
    C.renderTab('mines');
    const copper = [...document.querySelectorAll('#capMines [data-a="buy"]')].find((b) => b.dataset.i === '1');
    t.ok(copper && copper.classList.contains('dis'), 'Copper Seam button looks buyable');
  },
  'Capitalist: Dark Matter and runes pay only what is new': (t) => {
    const C = MODES.capitalist;
    // ₲2B this ascension = 1 Dark Matter (cube root); 1,000× that = 10
    C.load({ lifetimeEarned: 2e12 });
    C.refresh();
    t.ok(/\+10\b/.test(C.panes.transmute()[0]), 'transmute button offers +10');
    C.load({ lifetimeEarned: 2e12, darkMatter: 10 });
    C.refresh();
    t.ok(/Nothing to transmute yet/.test(C.panes.transmute()[0]), 'transmuting again pays the same Dark Matter twice');
    // after an ascension worth 21 runes, the next rune needs 400 × (22/10)^(1/0.3) ≈ 5,540 Dark Matter, not 400
    C.load({ runes: 21, ascensions: 1, darkMatter: 5000, dmEarnedAll: 5000 });
    C.refresh();
    const h = C.panes.transmute()[0];
    t.ok(/beats your best/.test(h) && h.includes(count(400 * 2.2 ** (1 / 0.3))), 'ascension hint names the real threshold');
    t.ok(!/Ascension unlocks at 400/.test(h), 'still says it unlocks at 400');
  },
  'Capitalist: damaged enchantment counts are repaired on load': (t) => {
    const C = MODES.capitalist;
    C.load({ level: [5], upgrades: [12.5], golems: [1], running: [1], allMs: 99 });
    C.refresh();
    t.eq(C.state.upgrades[0], 10);
    t.eq(C.state.allMs, 11);
    C.tick(1);
    t.ok(Number.isFinite(C.state.cash), 'gold became NaN');
  },
  'Capitalist: Stone designs stay unlocked in a new Great Work': (t) => {
    const C = MODES.capitalist;
    C.load({ stones: 1 }); // a new Work: transmutes, ascensions and the crucible are reset
    C.refresh();
    t.eq(C.stone().style, 10);
  },
  'Capitalist: buying a rune upgrade only hands out its own golems': (t) => {
    const C = MODES.capitalist;
    const lvl = Array(31).fill(1);
    C.load({ level: lvl, runes: 100, trials: { 'lone-golem': 1 } }); // the trial's reward: every golem at the start of a run
    C.refresh();
    C.actions.runeUpgrade('rune-of-plenty');
    t.eq(C.state.golems.filter(Boolean).length, 0, 'golems from an unrelated rune upgrade');
    C.actions.runeUpgrade('bound-golems');
    t.eq(C.state.golems.filter(Boolean).length, 5, 'Bound Golems gives the first five');
  },

  'Capitalist: an upgrade whose Dark Matter costs more than it gives never shows a negative gain': (t) => {
    const C = MODES.capitalist, level = Array(31).fill(0);
    level[0] = 10;
    level[30] = 10; // the Research Lab
    C.load({ level, darkMatter: 17500, dmEarnedAll: 17500, transmutes: 3 });
    C.refresh();
    const all = Object.values(C.panes).map((f) => [].concat(f()).join('')).join('');
    t.ok(!all.includes('+-'), 'a "+-" gain is shown');
    t.ok(all.includes('costs more bonus than it gives'), 'Deep Vault Labs should say it costs more than it gives');
  },

  // ----- Industrialist -----
  'Industrialist: a managed mine earns what its income line says': (t) => {
    const G = IndLogic;
    G.fresh();
    const S = G.state(), m = S.mines[0];
    for (const a of G.ACH) S.ach[a.id] = 1;
    // warehouse-bound and fast: short trips are where dropped time showed most
    m.shafts[0].lvl = 400;
    m.E.lvl = 300;
    m.W.lvl = 50; // 0.8 s trips
    m.lab.conv = 10;
    for (const s of [m.shafts[0], m.E, m.W]) s.mgr = 1;
    for (let k = 0; k < 600; k++) G.step(0.1); // settle
    const r = G.rates(m, false, false), c0 = m.cash;
    for (let k = 0; k < 3000; k++) G.step(0.1);
    const ratio = (m.cash - c0) / (r.income * 300);
    t.ok(r.bn === 'Warehouse', 'test setup should be warehouse-bound, is ' + r.bn);
    t.ok(ratio > 0.97 && ratio < 1.03, `earned ×${ratio.toFixed(3)} of the shown income`);
  },
  'Industrialist: the elevator rate shown (and paid offline) is what the elevator really moves': (t) => {
    const G = IndLogic;
    // two shafts and a car about one batch big: the regime where the car alternates short and long trips
    for (const E of [10, 12, 14, 16, 18, 22]) { // the old model read up to 43% low here, the drop at 18 is real
      G.fresh();
      const raw = JSON.parse(G.serialize());
      raw.mines[0].shafts = [25, 10].map((lvl) => ({ lvl, mgr: 1 }));
      Object.assign(raw.mines[0].E, { lvl: E, mgr: 1 });
      Object.assign(raw.mines[0].W, { lvl: 40, mgr: 1 });
      raw.feat.events = 1;
      raw.ev.next = 1e12; // no events mid-measure
      G.load(raw);
      const S = G.state(), m = S.mines[0];
      for (const a of G.ACH) S.ach[a.id] = 1;
      for (let k = 0; k < 3000; k++) G.step(0.1);
      const shown = G.rates(m, true, true).ore, sold = m.rs.sold;
      for (let k = 0; k < 6000; k++) G.step(0.1);
      const real = (m.rs.sold - sold) / 600;
      t.ok(Math.abs(shown / real - 1) < 0.03, `elevator Lv ${E}: shown ${shown.toFixed(1)} ore/s, really ${real.toFixed(1)}`);
    }
  },
  'Industrialist: taking off the Pressure hull takes its extra stops away': (t) => {
    const G = IndLogic;
    G.fresh();
    const S = G.state(), mi = G.REGIONS.findIndex((r) => r.mech === 'route');
    t.ok(mi >= 0, 'a route mine exists');
    const raw = JSON.parse(G.serialize());
    raw.mines[mi].open = true;
    raw.mines[mi].shafts = [{ route: 1 }, { route: 1 }, { route: 1 }, {}];
    raw.equip = { hull: 3 };
    raw.slots = ['hull', null];
    G.load(raw);
    const m = G.state().mines[mi], on = () => m.shafts.filter((s) => s.route).length;
    t.eq(on(), 3, 'stops with the hull on');
    G.act.unslot(0);
    t.eq(on(), 2, 'stops after the hull came off');
  },

  // ----- Communist -----
  'Communist: an offering that fills a part leaves it exactly full': (t) => {
    const K = MODES.communist;
    // Nigredo step 2: the gold part's goal sits 60% of the way (in orders of magnitude) from ₲1M to ₲10B
    const goal = 1e6 ** (1 - 0.6) * 1e10 ** 0.6;
    K.load({ stage: 0, step: 1, offered: [107626646.33097531, 0, 0, 0, 0, 0], res: [1e12, 0, 0, 0, 0, 0] });
    K.refresh();
    K.actions.offer(0);
    t.eq(K.state.offered[0], goal, 'gold part not exactly full');
    t.near(K.state.res[0], 1e12 - (goal - 107626646.33097531), 'gold taken', 1e-12);
  },
  'Communist: Dark Matter is total earned minus held': (t) => {
    const K = MODES.communist;
    // fourth root: ₲5B = 1, ₲5B × 10^4 = 10
    K.load({ totalEarned: 5e13 });
    K.refresh();
    t.ok(/\+10\b/.test(K.panes.transmute()[0]), 'transmute offers +10');
    K.load({ v: 2, totalEarned: 5e13, darkMatter: 10 }); // v2: a v1 save's Dark Matter is rescaled on load
    K.refresh();
    t.ok(/Nothing to transmute yet/.test(K.panes.transmute()[0]), 'pays the same Dark Matter twice');
  },
  'Communist: producer prices and Max buy': (t) => {
    const K = MODES.communist;
    // Panner: ₲10, ×1.07 per Panner bought this run
    K.load({ res: [1000, 0, 0, 0, 0, 0] });
    K.refresh();
    K.actions.mode('max');
    let n = 0, cash = 1000;
    while (cash >= 10 * 1.07 ** n * (1 - 1e-9)) cash -= 10 * 1.07 ** n++;
    K.actions.buy('0.0');
    t.eq(K.state.bought[0][0], n, 'Panners from Max');
    t.near(K.state.res[0], cash, 'gold left', 1e-9);
    t.ok(K.state.res[0] >= 0, 'gold went negative');
  },
  'Communist: Stone designs, including the Rubedo, are reachable and kept': (t) => {
    const K = MODES.communist;
    K.load({ stage: 3, step: 2 }); // Rubedo's last step: its design shows before the Stone is forged
    K.refresh();
    t.eq(K.stone().style, 4);
    K.load({ stones: 1 }); // a new Great Work
    K.refresh();
    t.eq(K.stone().style, 5);
  },
  'Communist: the producer card shows the rate actually produced': (t) => {
    const K = MODES.communist;
    K.load({ units: [[1.5, 0, 0, 0, 0, 0]] });
    K.refresh();
    const html = K.panes.works ? [].concat(K.panes.works()).join('') : '';
    t.ok(html.includes('Pans <span data-live>7.50</span> Gold/s'), 'card rate ignores the half-built Panner');
  },
};

// Tests that need their own page (start-up, saves, reloads): (browser context) => Promise<string[]> of failures.
// `seed` runs before the game's scripts on the first load only (sessionStorage remembers), like a save already there
async function open(ctx, seed, arg) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('page error: ' + e.message));
  await page.addInitScript(() => (window.setInterval = () => 0));
  if (seed) await page.addInitScript(([src, arg]) => sessionStorage.getItem('seeded') || (sessionStorage.setItem('seeded', 1), eval('(' + src + ')')(arg)), [seed.toString(), arg]);
  await page.goto(PAGE);
  return page;
}
const HOUR = 3600e3;
const PAGE_TESTS = {
  'an unreadable save is kept, not overwritten': async (ctx) => {
    const page = await open(ctx, () => {
      localStorage.setItem('df_capitalist', '{"cash": 12, broken');
      localStorage.setItem('df_industrialist', JSON.stringify({ v: 99, mines: [] })); // a version this build can't read
    });
    await page.evaluate(() => saveNow());
    const r = await page.evaluate(() => [localStorage.getItem('df_capitalist_unread'), localStorage.getItem('df_industrialist_unread'), localStorage.getItem('df_communist_unread')]);
    const f = [];
    if (r[0] !== '{"cash": 12, broken') f.push('Capitalist copy missing: ' + r[0]);
    if (!r[1] || JSON.parse(r[1]).v !== 99) f.push('Industrialist copy missing: ' + r[1]);
    if (r[2] !== null) f.push('a readable (absent) save was copied');
    return f.concat(page.errors);
  },
  'time away is paid once, at the offline rate': async (ctx) => {
    // Clay Pit ×10 with a golem: ₲1 × 10 levels per 0.6 s cycle, nothing else boosting it yet. Offline pays 50%:
    // an hour away is 1,800 s of work = 3,000 cycles = ₲30,000
    const page = await open(
      ctx,
      ([H]) => {
        const s = { cash: 0, level: [10], golems: [1], running: [1], savedAt: Date.now() - H };
        localStorage.setItem('df_capitalist', JSON.stringify(s));
        localStorage.setItem('df_settings', JSON.stringify({ mode: 'capitalist' }));
      },
      [HOUR],
    );
    const f = [];
    const cash = await page.evaluate(() => MODES.capitalist.state.cash);
    if (!(cash >= 30000 && cash <= 30100)) f.push(`an hour away paid ₲${cash}, expected about ₲30,000`);
    await page.evaluate(() => saveNow());
    await page.reload();
    const again = await page.evaluate(() => MODES.capitalist.state.cash);
    if (again - cash > 100) f.push(`reloading paid the same time again: +₲${again - cash}`);
    return f.concat(page.errors);
  },
  'a clock turned back pays nothing and never rewinds the save time': async (ctx) => {
    const page = await open(
      ctx,
      ([H]) => {
        const s = { cash: 0, level: [10], golems: [1], running: [1], savedAt: Date.now() + H };
        localStorage.setItem('df_capitalist', JSON.stringify(s));
        localStorage.setItem('df_settings', JSON.stringify({ mode: 'capitalist' }));
      },
      [HOUR],
    );
    const r = await page.evaluate(() => {
      saveNow();
      return [MODES.capitalist.state.cash, JSON.parse(localStorage.getItem('df_capitalist')).savedAt - Date.now()];
    });
    const f = [];
    if (r[0] !== 0) f.push(`paid ₲${r[0]} for negative time away`);
    if (r[1] < HOUR - 60e3) f.push('savedAt moved backwards: the same hours could be paid twice');
    return f.concat(page.errors);
  },
  'save codes round-trip; junk is turned away': async (ctx) => {
    const page = await open(ctx);
    const f = [];
    const r = await page.evaluate(() => {
      MODES.communist.state.taps = 77;
      APP_ACTIONS.exportSave();
      const code = $('sv').value, data = JSON.parse(decodeURIComponent(escape(atob(code))));
      const before = localStorage.getItem('df_communist');
      $('sv').dataset.mode = 'import';
      $('sv').value = 'definitely not a save';
      APP_ACTIONS.importSave();
      return { keys: Object.keys(data.modes).sort().join(), taps: data.modes.communist.taps, kept: localStorage.getItem('df_communist') === before, msg: $('sv').placeholder };
    });
    if (r.keys !== 'capitalist,communist,industrialist') f.push('save code is missing a mode: ' + r.keys);
    if (r.taps !== 77) f.push('save code does not hold current state');
    if (!r.kept) f.push('a junk code changed a save');
    if (!/isn't a Deepforge save/.test(r.msg)) f.push('no message for a junk code');
    return f.concat(page.errors);
  },
};

async function runInPage(browser, name, fn, setup) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => (window.setInterval = () => 0)); // the game's own loop stays off: tests drive time
  if (setup) await page.addInitScript(setup);
  await page.goto(PAGE);
  const fails = await page.evaluate((src) => {
    const fails = [];
    const t = {
      eq: (a, b, what = '') => a === b || fails.push(`${what} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`),
      near: (a, b, what = '', tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)) || fails.push(`${what} expected ≈${b}, got ${a}`),
      ok: (c, what) => c || fails.push(what || 'condition failed'),
    };
    try {
      eval('(' + src + ')')(t);
    } catch (e) {
      fails.push('threw: ' + e.message);
    }
    return fails;
  }, fn.toString());
  await ctx.close();
  return fails.concat(errors.map((e) => 'page error: ' + e));
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}); // PW_CHANNEL=msedge uses an installed browser
  let failed = 0;
  const report = (name, fails) => {
    console.log(`${fails.length ? 'FAIL' : 'ok  '} ${name}`);
    for (const f of fails) console.log('       ' + f);
    failed += fails.length > 0;
  };
  for (const [name, fn] of Object.entries(TESTS)) report(name, await runInPage(browser, name, fn));
  for (const [name, fn] of Object.entries(PAGE_TESTS)) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 } });
    report(name, await fn(ctx).catch((e) => ['threw: ' + e.message.split('\n')[0]]));
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `\n${failed} failing` : '\nall passed');
  process.exitCode = failed ? 1 : 0;
})();
