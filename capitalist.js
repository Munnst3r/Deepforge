// ===== Capitalist: thirty mines, golems and enchantments, transmuting and ascending =====
// Everything about this mode's economy lives inside this module. It talks to the shared app only through the object it
// returns at the bottom (see MODE INTERFACE in the app section), so changing it can't affect the other modes.
const Capitalist = (() => {
  // ===== Mines =====
  // Each mine digs up a rarer material than the one before: common earth and metals, then gems, then enchanted
  // ores, then the primal stones of the elements. The 30th is the Prime Crucible, where the Great Work happens.
  // [name, icon, base cost, cost growth per level, profit per cycle, cycle seconds]
  const FIRST_MINES = [
    ['Clay Pit', 'shovel', 4, 1.07, 1, 0.6],
    ['Copper Seam', 'pickaxe', 60, 1.15, 60, 3],
    ['Iron Mine', 'mountain', 720, 1.14, 540, 6],
    ['Silver Lode', 'moon', 8640, 1.13, 4320, 12],
    ['Gold Vein', 'sun', 103680, 1.12, 51840, 24],
    ['Quartz Grotto', 'prism', 1244160, 1.11, 622080, 96],
    ['Amethyst Geode', 'gem', 14929920, 1.1, 7464960, 384],
    ['Ruby Deep', 'ruby', 179159040, 1.09, 89579520, 1536],
    ['Sapphire Mine', 'sapphire', 2149908480, 1.08, 1074954240, 6144],
    ['Emerald Cavern', 'hexagon', 25798901760, 1.07, 29668737024, 36864],
  ];
  // Mines 11–30 follow a formula: each tier costs ×30 more (×500 past tier 20), pays ×4 and cycles 1.3× slower
  const LATER_MINES = [
    ['Moonstone Shaft', 'moonstar'], ['Sunstone Kiln', 'sunhigh'], ['Quicksilver Spring', 'droplet'], ['Mithril Delve', 'shield'],
    ['Adamant Forge', 'anvil'], ['Orichalcum Works', 'cog'], ['Skyiron Crater', 'sparkle'], ['Dragonglass Rift', 'volcano'],
    ['Phoenix Ember Well', 'flame'], ['Frostcrystal Glacier', 'snowflake'], ['Stormglass Spire', 'lightning'], ['Tidestone Grotto', 'waves'],
    ['Earthheart Seam', 'layers'], ['Lifestone Grove', 'leaf'], ['Soulstone Crypt', 'ghost'], ['Mindstone Sanctum', 'brain'],
    ['Timestone Vault', 'hourglass'], ['Voidcrystal Chasm', 'eye'], ['Aether Font', 'sparkles'], ['Prime Crucible', 'opus'],
  ].map(([name, iconName], j) => [
    name,
    iconName,
    25798901760 * 30 ** Math.min(j + 1, 10) * 500 ** Math.max(0, j - 9),
    1.07,
    29668737024 * 4 ** (j + 1),
    Math.round(36864 * 1.3 ** (j + 1)),
  ]);
  // Each mine wears a muted tone of what it digs up
  const MINE_COLORS = [
    '#bba494', '#cc9582', '#a9aebf', '#c4c7d5', '#d9be89', '#cfd1dd', '#ad8fdd', '#d9748c', '#7599dd', '#6ec49a',
    '#b8c0dd', '#d9a673', '#bec2cc', '#a4cadd', '#99a0b4', '#d99a82', '#92b9dd', '#d97f73', '#d98e5f', '#9bcfdd',
    '#d9c689', '#6fb8dd', '#b0977a', '#7bc69d', '#b998dd', '#d99ac4', '#cbb694', '#997ed8', '#a4cfdd', '#d97d8e',
  ];
  // Every unit the player can build. Golems cost 2,500× the mine's base price, ×1.5 more per tier
  const UNITS = [...FIRST_MINES, ...LATER_MINES].map(([name, iconName, cost, growth, profit, time], i) => ({
    name, icon: iconName, cost, growth, profit, time, color: MINE_COLORS[i], golemCost: cost * 2500 * 1.5 ** i,
  }));
  const MINE_COUNT = UNITS.length; // 30 gold-making mines
  const CRUCIBLE = MINE_COUNT - 1; // the Prime Crucible
  const LAB = MINE_COUNT; // the Research Lab is always the last unit; it makes Arcana instead of gold
  UNITS.push({ name: 'Research Lab', icon: 'flask', cost: 1.5e5, growth: 1.17, profit: 2, time: 4, color: '#93c4bd', golemCost: 2e9 });
  // Display order: the Research Lab sits between the Gold Vein and the Quartz Grotto
  const DISPLAY_ORDER = [...Array(MINE_COUNT).keys()];
  DISPLAY_ORDER.splice(5, 0, LAB);

  // Speed milestones (×2 speed for that mine) and level milestones (×2 profit when every mine's levels in this run add
  // up to the number). Level milestones count every mine you own, so each new mine helps instead of holding you back
  const SPEED_MILESTONES = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const LEVEL_MILESTONES = [1000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 35000];
  // Every-mine milestones (×2 profit each): every mine up to your newest (at least the first five; the Prime Crucible
  // doesn't count) has this many levels. Kept for the rest of the run once reached, so opening a new mine never takes one
  // away; it only sets the bar for the next. This is what keeps the cheap early mines worth levelling
  const ALL_MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000];

  // Mine upgrades: 10 per mine, bought in order. [label, profit ×, speed ×, price as a multiple of the mine's base cost]
  const UPGRADE_STEPS = [
    ['Profit ×3', 3, 1, 1e4],
    ['Speed ×2', 1, 2, 1e6],
    ['Profit ×3', 3, 1, 1e9],
    ['Profit ×5', 5, 1, 1e12],
    ['Speed ×2', 1, 2, 1e16],
    ['Profit ×5', 5, 1, 1e20],
    ['Speed ×3', 1, 3, 1e25],
    ['Profit ×10', 10, 1, 1e30],
    ['Profit ×10', 10, 1, 1e36],
    ['Profit ×25', 25, 1, 1e42],
  ];
  const UPGRADE_PROFIT = [1]; // total profit × after n upgrades
  const UPGRADE_SPEED = [1]; // total speed × after n upgrades
  UPGRADE_STEPS.forEach(([, profit, speed], n) => {
    UPGRADE_PROFIT.push(UPGRADE_PROFIT[n] * profit);
    UPGRADE_SPEED.push(UPGRADE_SPEED[n] * speed);
  });

  // ===== Research, Dark Matter upgrades and rune upgrades =====
  // Each has a stable id (saves use it) and an effect (fx). How effects combine:
  //   profit, speed, price, golemPrice, arcana, dmGain multiply · dmBonus adds · everything else takes the highest value
  // Alchemy, paid in Arcana. The late discoveries follow the four stages of the Great Work: Nigredo, Albedo, Citrinitas, Rubedo
  const RESEARCH = [
    ['tempered-picks', 'Tempered Picks', 'All cycles 25% faster', 100, { speed: 1.25 }],
    ['assay-scales', 'Assay Scales', 'Profit ×2', 600, { profit: 2 }],
    ['bulk-smelting', 'Bulk Smelting', 'Mine levels 10% cheaper', 2500, { price: 0.9 }],
    ['clay-molds', 'Clay Golem Molds', 'Golems 50% cheaper', 10000, { golemPrice: 0.5 }],
    ['sulfur-refining', 'Sulfur Refining', 'Profit ×2', 40000, { profit: 2 }],
    ['tireless-runes', 'Tireless Runes', 'Offline earnings 50% → 100%', 150000, { offline: 1 }],
    ['theory-of-transmutation', 'Theory of Transmutation', 'Dark Matter bonus 2% → 3% each', 600000, { dmBonus: 0.5 }],
    ['mercury-distillation', 'Mercury Distillation', 'Profit ×3', 2.5e06, { profit: 3 }],
    ['deep-bellows', 'Bellows of the Deep', 'All cycles 50% faster', 6e06, { speed: 1.5 }],
    ['guild-charters', 'Guild Charters', 'Mine levels 10% cheaper again', 1.5e07, { price: 0.9 }],
    ['athanor-furnace', 'Athanor Furnace', 'Research Labs ×2 Arcana', 4e07, { arcana: 2 }],
    ['questing-guild', 'Questing Guild', 'Quests give +8% profit each', 1e08, { questBonus: 0.08 }],
    ['aqua-regia', 'Aqua Regia', 'Profit ×3', 3e08, { profit: 3 }],
    ['minecart-rails', 'Minecart Rails', 'All cycles 50% faster', 1.2e09, { speed: 1.5 }],
    ['alloy-mastery', 'Alloy Mastery', 'Mine levels 10% cheaper again', 5e09, { price: 0.9 }],
    ['reopened-seams', 'Reopened Seams', 'The first 10 mines: profit ×10', 1e10, { early: [10, 10] }],
    ['alembic-arrays', 'Alembic Arrays', 'Research Labs ×3 Arcana', 2e10, { arcana: 3 }],
    ['nigredo', 'Nigredo', 'Profit ×4', 8e10, { profit: 4 }],
    ['quicksilver-gears', 'Quicksilver Gears', 'All cycles 2× faster', 3e11, { speed: 2 }],
    ['dark-matter-distillery', 'Dark Matter Distillery', 'Dark Matter bonus up to 4.3% each', 1.2e12, { dmBonus: 0.67 }],
    ['albedo', 'Albedo', 'Profit ×5', 5e12, { profit: 5 }],
    ['elemental-winds', 'Elemental Winds', 'All cycles 2× faster', 2e13, { speed: 2 }],
    ['earthshaper-contracts', 'Earthshaper Contracts', 'Mine levels 20% cheaper', 8e13, { price: 0.8 }],
    ['grand-grimoire', 'Grand Grimoire', 'Research Labs ×5 Arcana', 3e14, { arcana: 5 }],
    ['citrinitas', 'Citrinitas', 'Profit ×5', 1.2e15, { profit: 5 }],
    ['ancestral-veins', 'Ancestral Veins', 'The first 20 mines: profit ×25', 2.5e15, { early: [20, 25] }],
    ['void-resonance', 'Void Resonance', 'Dark Matter bonus +50%', 5e15, { dmBonus: 0.5 }],
    ['golem-academy', 'Golem Academy', 'Golems 75% cheaper', 2e16, { golemPrice: 0.25 }],
    ['rubedo', 'Rubedo', 'Profit ×8', 8e16, { profit: 8 }],
    ['emerald-tablet', 'Emerald Tablet', 'Profit ×10', 3e17, { profit: 10 }],
    ['deep-memory', 'Deep Memory', 'The first 10 mines: profit ×100', 6e17, { early: [10, 100] }],
    ['clockwork-of-ages', 'Clockwork of Ages', 'All cycles 2.5× faster', 1.2e18, { speed: 2.5 }],
    ['prima-materia', 'Prima Materia', 'Profit ×12', 5e18, { profit: 12 }],
  ].map(upgradeDef);
  // Paid in Dark Matter. Spending Dark Matter lowers its profit bonus
  const DM_UPGRADES = [
    ['dark-surge', 'Dark Surge', 'Profit ×3', 25, { profit: 3 }],
    ['shadow-bellows', 'Shadow Bellows', 'All cycles 50% faster', 500, { speed: 1.5 }],
    ['void-foundries', 'Void Foundries', 'Mine levels 10% cheaper', 1e4, { price: 0.9 }],
    ['umbral-seal', 'Umbral Seal', 'Profit ×4', 2e5, { profit: 4 }],
    ['deep-vault-labs', 'Deep Vault Labs', 'Research Labs ×2 Arcana', 4e6, { arcana: 2 }],
    ['black-salt', 'Black Salt', 'Profit ×5', 1e8, { profit: 5 }],
    ['echoing-depths', 'Echoing Depths', 'The first 10 mines: profit ×25', 1e9, { early: [10, 25] }],
    ['void-pulse', 'Void Pulse', 'All cycles 2× faster', 3e9, { speed: 2 }],
    ['abyssal-labs', 'Abyssal Labs', 'Research Labs ×3 Arcana', 1e11, { arcana: 3 }],
    ['midas-touch', 'Midas Touch', 'Profit ×7', 3e12, { profit: 7 }],
    ['dark-bloom', 'Dark Bloom', 'Profit ×10', 1e14, { profit: 10 }],
    ['old-gods', 'The Old Gods', 'The first 20 mines: profit ×50', 1e15, { early: [20, 50] }],
  ].map(upgradeDef);
  // Paid in Elder Runes (second prestige). Spending runes never lowers their bonus
  const RUNE_UPGRADES = [
    ['head-start', 'Head Start', 'Start every run with ₲1M', 1, { startCash: 1e6 }],
    ['bound-golems', 'Bound Golems', 'Golems for the first 5 mines are summoned for free at the start of a run', 3, { autoGolems: 5 }],
    ['elder-elixir', 'Elder Elixir', 'The Elixir of Fortune lasts an hour instead of 30 minutes', 10, { boostHours: 1 }],
    ['rune-of-plenty', 'Rune of Plenty', 'Profit ×3', 25, { profit: 3 }],
    ['rune-of-haste', 'Rune of Haste', 'All cycles 2× faster', 60, { speed: 2 }],
    ['dark-harvest', 'Dark Harvest', '50% more Dark Matter from transmuting', 150, { dmGain: 1.5 }],
    ['rune-of-thrift', 'Rune of Thrift', 'Mine levels 20% cheaper', 400, { price: 0.8 }],
    ['void-archive', 'Void Archive', 'Keep your Dark Matter upgrades when you ascend', 1000, { keepDmUpgrades: 1 }],
    ['rune-of-kings', 'Rune of Kings', 'Profit ×10', 2500, { profit: 10 }],
    ['twin-runes', 'Twin Runes', 'Each rune gives +15% profit instead of +10%', 6000, { runeBonus: 0.15 }],
    ['rune-of-storms', 'Rune of Storms', 'All cycles 2× faster', 15000, { speed: 2 }],
    ['primordial-rune', 'Primordial Rune', 'Profit ×25', 40000, { profit: 25 }],
    ['rune-of-embers', 'Rune of Embers', 'Crucible essence ×2', 1e5, { essence: 2 }],
    ['catalytic-runes', 'Catalytic Runes', 'Each catalyst level gives +15% essence speed instead of +10%', 1.5e6, { catalystPower: 0.15 }],
    ['rune-of-the-stone', 'Rune of the Stone', 'Crucible essence ×2', 6e6, { essence: 2 }],
  ].map(upgradeDef);
  // Trials: optional runs with a handicap. Earn the goal in one run despite it and its reward is yours for good.
  // A new trial opens with each ascension. [id, name, handicap, gold to earn in the run, reward, reward fx]
  const TRIALS = [
    ['shallows', 'Trial of the Shallows', 'Only the first ten mines can be opened', 1e16, 'Profit ×5', { profit: 5 }],
    ['thrift', 'Trial of Thrift', 'Mine prices climb twice as steeply', 1e20, 'Mine levels 25% cheaper', { price: 0.75 }],
    ['silence', 'Trial of Silence', 'Research has no effect', 1e24, 'Research Labs ×5 Arcana', { arcana: 5 }],
    ['dark-fast', 'Trial of the Dark Fast', 'Dark Matter gives no profit bonus', 1e28, 'Dark Matter bonus +50%', { dmBonus: 0.5 }],
    ['bare-stone', 'Trial of Bare Stone', 'Enchantments can’t be cast', 1e33, 'All cycles 2× faster', { speed: 2 }],
    ['lone-golem', 'Trial of the Lone Golem', 'Only one mine can have a golem', 1e38, 'Every golem is summoned for free at the start of a run', { autoGolems: 31 }],
    ['slow-earth', 'Trial of Slow Earth', 'All cycles 10× slower', 1e52, 'Profit ×10', { profit: 10 }],
    ['great-trial', 'The Great Trial', 'Profit ÷1,000', 1e55, 'Crucible essence ×2', { essence: 2 }],
  ].map(([id, name, handicap, goal, reward, fx]) => ({ id, name, handicap, goal, reward, fx }));
  const FX_MULTIPLY = ['profit', 'speed', 'price', 'golemPrice', 'arcana', 'dmGain', 'essence'];

  // ===== End goal: fill the Prime Crucible with essence, then complete the Great Work =====
  const CHARGE_GOAL = 1.8e8;
  // Catalysts: +10% essence speed per level (15% with Catalytic Runes), paid in different currencies
  const CATALYSTS = [
    { name: 'Gold Leaf Catalyst', currency: 'gold', base: 1e46, growth: 4 },
    { name: 'Arcane Reagent', currency: 'Arcana', base: 1e18, growth: 4 },
    { name: 'Dark Matter Tincture', currency: 'Dark Matter', base: 1e13, growth: 4 },
  ];

  // ===== Bonuses =====
  const HOUR = 3600e3;
  const DAILY_HOURS = 6; // the daily tribute pays this many hours of income
  const DAILY_COOLDOWN = 20 * HOUR;
  const BOOST_COOLDOWN = 6 * HOUR;
  const boostPower = () => Math.min(10, 3 + 0.25 * S.ascensions); // ×3, +0.25 per Ascension, up to ×10

  // ===== Quests (reward Arcana; each claimed quest adds profit) =====
  // [id, name, Arcana reward, current value, target, how to show progress]. A quest is done when the value reaches the target.
  // Saves store quests by id, so new ones can go anywhere
  const QUESTS = [
    ['clay-25', 'Own 25 Clay Pits', 5, () => level(0), 25],
    ['golems-3', 'Summon 3 golems', 15, () => golemCount(), 3],
    ['copper-50', 'Own 50 Copper Seams', 50, () => level(1), 50],
    ['earn-1e6', 'Earn ₲1M this ascension', 100, () => S.lifetimeEarned, 1e6, 'money'],
    ['iron-100', 'Own 100 Iron Mines', 300, () => level(2), 100],
    ['gold-50', 'Own 50 Gold Veins', 1e3, () => level(4), 50],
    ['earn-1e9', 'Earn ₲1B this ascension', 3e3, () => S.lifetimeEarned, 1e9, 'money'],
    ['golems-10', 'Summon 10 golems', 1e4, () => golemCount(), 10],
    ['first-ten-100', 'Own 100 of each of the first 10 mines', 1e5, () => Math.min(...S.level.slice(0, 10)), 100],
    ['dark-matter', 'Claim Dark Matter', 1e5, () => S.darkMatter, 1],
    ['earn-1e12', 'Earn ₲1T this ascension', 5e5, () => S.lifetimeEarned, 1e12, 'money'],
    ['moonstone-100', 'Own 100 Moonstone Shafts', 1e6, () => level(10), 100],
    ['build-stormglass', 'Open a Stormglass Spire', 3e6, () => level(20), 1],
    ['ascend-1', 'Ascend once', 1e7, () => S.ascensions, 1],
    ['earn-1e33', 'Earn ₲1Dc this ascension', 3e7, () => S.lifetimeEarned, 1e33, 'money'],
    ['build-lifestone', 'Open a Lifestone Grove', 1e8, () => level(23), 1],
    ['all-25', 'Own 25 of every mine', 3e8, () => M.minLevel, 25],
    ['build-aether', 'Open an Aether Font', 1e9, () => level(28), 1],
    ['build-crucible', 'Build the Prime Crucible', 3e9, () => level(CRUCIBLE), 1],
    ['clay-100', 'Own 100 Clay Pits', 20, () => level(0), 100],
    ['upgrades-10', 'Buy 10 enchantments', 200, () => upgradesBought(), 10],
    ['build-ruby', 'Open a Ruby Deep', 2e3, () => level(7), 1],
    ['build-emerald', 'Open an Emerald Cavern', 2e4, () => level(9), 1],
    ['transmute-3', 'Transmute 3 times', 5e4, () => S.transmutes, 3],
    ['research-10', 'Complete 10 research', 2e5, () => researchDone(), 10],
    ['golems-20', 'Summon 20 golems', 5e5, () => golemCount(), 20],
    ['upgrades-50', 'Buy 50 enchantments', 1e6, () => upgradesBought(), 50],
    ['dm-total-1000', 'Earn 1,000 Dark Matter in total', 2e6, () => S.dmEarnedAll, 1e3],
    ['build-tidestone', 'Open a Tidestone Grotto', 5e6, () => level(21), 1],
    ['upgrades-150', 'Buy 150 enchantments', 3e7, () => upgradesBought(), 150],
    ['research-25', 'Complete 25 research', 1e8, () => researchDone(), 25],
    ['catalyst-1', 'Buy a catalyst', 5e9, () => S.catalysts.reduce((a, b) => a + b, 0), 1],
    ['all-100', 'Own 100 of every mine', 1e10, () => M.minLevel, 100],
    ['charge-50', 'Fill the Prime Crucible to 50%', 2e10, () => chargeFraction() * 100, 50, 'percent'],
    ['earn-1e63', 'Earn ₲1Vg this ascension', 3e10, () => S.lifetimeEarned, 1e63, 'money'],
    ['upgrades-250', 'Buy 250 enchantments', 5e10, () => upgradesBought(), 250],
    ['trial-1', 'Complete a trial', 3e7, () => trialsDone(), 1],
    ['ascend-5', 'Ascend 5 times', 1e8, () => S.ascensions, 5],
    ['trial-3', 'Complete 3 trials', 2e9, () => trialsDone(), 3],
    ['levels-5000', 'Reach 5,000 mine levels in one run', 4e11, () => M.totalLevels, 5000],
    ['runes-1000', 'Earn 1,000 Elder Runes', 1e12, () => S.runes, 1000],
    ['levels-20000', 'Reach 20,000 mine levels in one run', 1e17, () => M.totalLevels, 20000],
    ['trial-6', 'Complete 6 trials', 3e17, () => trialsDone(), 6],
    ['catalysts-20', 'Reach 20 catalyst levels in total', 1e20, () => S.catalysts.reduce((a, b) => a + b, 0), 20],
    ['trial-8', 'Complete every trial', 5e20, () => trialsDone(), TRIALS.length],
    ['charge-90', 'Fill the Prime Crucible to 90%', 1e21, () => chargeFraction() * 100, 90, 'percent'],
  ].map(questDef);

  // ===== Achievements (+1% profit each) =====
  const ACHIEVEMENTS = [];
  // "Clay Pit Master: Own 50 Clay Pits" for every mine
  for (let i = 0; i < MINE_COUNT; i++)
    ACHIEVEMENTS.push({ id: 'master-' + i, name: UNITS[i].name + ' Master', desc: 'Own 50 ' + plural(UNITS[i].name), done: () => level(i) >= 50 });
  achievementTiers(ACHIEVEMENTS, [1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e30, 1e40, 1e50, 1e60], 'hoarder', (v) => 'Hoarder ₲' + plain(v), (v) => 'Earn ₲' + plain(v) + ' in total', (v) => S.totalEarned >= v);
  achievementTiers(ACHIEVEMENTS, [1, 5, 10, 20], 'golem-maker', (v) => 'Golem Maker ' + v, (v) => (v === 1 ? 'Summon a golem' : 'Summon ' + v + ' golems'), (v) => golemCount() >= v);
  achievementTiers(ACHIEVEMENTS, [1, 5, 10, 25], 'transmuter', (v) => 'Transmuter ' + v, (v) => 'Transmute ' + times(v), (v) => S.transmutes >= v);
  achievementTiers(ACHIEVEMENTS, [10, 100, 1000, 1e6, 1e12], 'dark-hoard', (v) => 'Dark Hoard ' + plain(v), (v) => 'Earn ' + plain(v) + ' Dark Matter', (v) => S.dmEarnedAll >= v);
  achievementTiers(ACHIEVEMENTS, [100, 1000, 10000], 'prospector', (v) => 'Prospector ' + plain(v), (v) => 'Tap ' + plain(v) + ' times', (v) => S.taps >= v);
  achievementTiers(ACHIEVEMENTS, [1, 10, 100], 'devoted', (v) => 'Devoted ' + v + 'h', (v) => 'Play for ' + v + (v > 1 ? ' hours' : ' hour'), (v) => S.playTime >= v * 3600);
  achievementTiers(ACHIEVEMENTS, [5, 10, 20, 30], 'scholar', (v) => 'Scholar ' + v, (v) => 'Complete ' + v + ' research', (v) => researchDone() >= v);
  achievementTiers(ACHIEVEMENTS, [1e3, 1e6, 1e9, 1e12, 1e18], 'bookworm', (v) => 'Bookworm ' + plain(v), (v) => 'Hold ' + plain(v) + ' Arcana', (v) => S.arcana >= v);
  achievementTiers(ACHIEVEMENTS, [1e3, 1e6, 1e9, 1e12, 1e20, 1e30, 1e45], 'golden-flow', (v) => 'Golden Flow ₲' + plain(v), (v) => 'Reach ₲' + plain(v) + ' income per second', (v) => S.bestIncome >= v);
  achievementTiers(ACHIEVEMENTS, [3, 7], 'void-merchant', (v) => 'Void Merchant ' + v, (v) => 'Buy ' + v + ' Dark Matter upgrades', (v) => Object.keys(S.dmUpgrades).length >= v);
  achievementTiers(ACHIEVEMENTS, [1, 3, 10], 'ascendant', (v) => 'Ascendant ' + v, (v) => 'Ascend ' + times(v), (v) => S.ascensions >= v);
  achievementTiers(ACHIEVEMENTS, [100, 500, 2000, 1e5, 1e6], 'runekeeper', (v) => 'Runekeeper ' + plain(v), (v) => 'Earn ' + plain(v) + ' Elder Runes', (v) => S.runes >= v);
  achievementTiers(ACHIEVEMENTS, [1, 4, 8], 'trialist', (v) => 'Trialist ' + v, (v) => (v === 1 ? 'Complete a trial' : 'Complete ' + v + ' trials'), (v) => trialsDone() >= v);
  achievementTiers(ACHIEVEMENTS, [5000, 15000, 30000], 'deep-works', (v) => 'Deep Works ' + plain(v), (v) => 'Reach ' + plain(v) + ' mine levels in one run', (v) => M.totalLevels >= v);
  achievementTiers(ACHIEVEMENTS, [25, 50, 75], 'crucible', (v) => 'Crucible ' + v + '%', (v) => 'Fill the Prime Crucible to ' + v + '%', (v) => chargeFraction() >= v / 100);
  ACHIEVEMENTS.push({ id: 'great-work', name: 'The Great Work', desc: "Forge the Philosopher's Stone", done: () => S.wonAt > 0 });
  ACHIEVEMENTS.push({ id: 'second-stone', name: 'The Work Again', desc: "Forge a second Philosopher's Stone", done: () => S.stones + (S.wonAt ? 1 : 0) >= 2 });

  // ===== Tabs (in tab-bar order; swiping moves through them in this order) =====
  const TABS = [
    { key: 'mines', name: 'Mines', icon: 'pickaxe', color: '#d6c4a0', desc: 'Open mines and buy levels. Tap a mine to work it by hand.' },
    { key: 'forge', name: 'Forge', icon: 'hammer', color: '#c9a088', desc: 'Golems run your mines for you; enchantments multiply them.' },
    { key: 'research', name: 'Research', icon: 'flask', color: '#93c4bd', desc: 'Claim quests for Arcana, then spend it on research that lasts.' },
    { key: 'transmute', name: 'Transmute', icon: 'spiral', color: '#a99ad8', desc: 'Reset your run for Dark Matter; ascend for Elder Runes.' },
    { key: 'opus', name: 'Magnum Opus', icon: 'opus', color: '#d9a6b1', desc: 'The end goal, your daily bonuses, stats and achievements.' },
  ];
  const BUY_MODES = [1, 10, 100, 'max', 'next'];

  // ===== Save data =====
  const zeros = () => Array(UNITS.length).fill(0);
  function newState() {
    return {
      v: 1,
      cash: 4, // gold
      arcana: 0,
      runEarned: 0, // gold earned this run (trial goals use this)
      lifetimeEarned: 0, // gold earned since the last ascension (Dark Matter is based on this)
      totalEarned: 0, // gold earned ever
      level: zeros(), // per unit (mines, then the Research Lab)
      allMs: 0, // every-mine milestones reached this run
      golems: zeros(),
      upgrades: zeros(), // enchantments bought per mine
      running: zeros(),
      progress: zeros(),
      research: {}, // owned ids
      quests: {},
      achievements: {},
      darkMatter: 0, // earned this ascension, including spent
      dmSpent: 0,
      dmUpgrades: {},
      dmEarnedAll: 0,
      runes: 0, // earned ever, including spent
      runesSpent: 0,
      runeUpgrades: {},
      transmutes: 0,
      ascensions: 0,
      trial: '', // the trial this run is, if any
      trials: {}, // completed trials (their rewards are permanent)
      crucibleBuilt: false, // ever built the Prime Crucible (unlocks catalysts)
      charge: 0, // essence in the Prime Crucible
      catalysts: [0, 0, 0],
      wonAt: 0, // play time when the Philosopher's Stone was forged
      stones: 0, // Philosopher's Stones forged in earlier Great Works
      bestWork: 0, // the fastest Great Work so far (play time)
      workStart: 0, // play time when this Great Work began
      taps: 0,
      playTime: 0,
      bestIncome: 0,
      dailyReadyAt: 0,
      boostReadyAt: 0,
      boostEndsAt: 0,
      savedAt: Date.now(),
    };
  }
  // What survives transmuting and ascending; everything else returns to its starting value (transmuting also keeps
  // Dark Matter, its upgrades and this ascension's earnings)
  const KEEP_ON_RESET = [
    'arcana', 'research', 'quests', 'achievements', 'trials', 'runes', 'runesSpent', 'runeUpgrades', 'ascensions', 'transmutes',
    'wonAt', 'stones', 'bestWork', 'workStart', 'charge', 'crucibleBuilt', 'catalysts', 'taps', 'playTime', 'bestIncome', 'totalEarned', 'dmEarnedAll',
    'dailyReadyAt', 'boostReadyAt', 'boostEndsAt',
  ];
  // Loads a save (or an imported save code), filling in anything missing so a damaged save still plays
  function migrate(raw) {
    const s = mergeSave(newState(), raw);
    if (s.level[CRUCIBLE] > 0) s.crucibleBuilt = true;
    if (!TRIALS.some((t) => t.id === s.trial)) s.trial = '';
    // rune upgrades from older versions that no longer exist (research is now always kept): their runes come back
    for (const [old, cost] of [['archive', 10], ['eternal-library', 150]])
      if (s.runeUpgrades[old]) {
        delete s.runeUpgrades[old];
        s.runesSpent = Math.max(0, s.runesSpent - cost);
      }
    return s;
  }

  // ===== Game state and modifiers =====
  let S = newState();
  let M = {}; // modifiers and totals, rebuilt by refresh() once per tick and after every action
  let buyMode = 1;
  let manualEarned = 0; // gold from hand-worked mines since the last tick
  let manualRate = 0; // smoothed gold per second from hand-worked mines

  const level = (i) => S.level[i];
  const golemCount = () => S.golems.filter((x, i) => x && level(i)).length; // every golem, the Research Lab's included
  const upgradesBought = () => S.upgrades.reduce((a, b) => a + b, 0);
  const researchDone = () => Object.keys(S.research).length;
  const dmAvailable = () => Math.max(0, S.darkMatter - S.dmSpent);
  const runesAvailable = () => Math.max(0, S.runes - S.runesSpent);
  const runePower = () => (S.runes <= 1e3 ? S.runes : 1e3 * Math.sqrt(S.runes / 1e3)); // runes count fully up to 1,000, then with the square root
  const trialsDone = () => Object.keys(S.trials).length;
  const trialsOpen = () => Math.min(TRIALS.length, S.ascensions); // one more with each ascension
  const inTrial = (id) => S.trial === id;
  const golemsOnMines = () => S.golems.slice(0, MINE_COUNT).filter((x) => x).length;
  const isVisible = (i) => (i === 0 || level(i) > 0 || level(i === LAB ? 4 : i - 1) > 0) && !(inTrial('shallows') && i >= 10 && i !== LAB);

  function refresh(now = Date.now()) {
    const m = { profit: 1, speed: 1, price: 1, golemPrice: 1, arcana: 1, dmGain: 1, essence: 1, dmBonus: 0, offline: 0.5, questBonus: 0.05, runeBonus: 0.1, startCash: 0, autoGolems: 0, boostHours: 0.5, keepDmUpgrades: 0, catalystPower: 0.1 };
    m.early = Array(MINE_COUNT).fill(1); // catch-up multipliers for the earliest mines
    const sources = [[DM_UPGRADES, S.dmUpgrades], [RUNE_UPGRADES, S.runeUpgrades], [TRIALS, S.trials]];
    if (!inTrial('silence')) sources.push([RESEARCH, S.research]);
    for (const [list, owned] of sources)
      for (const u of list)
        if (owned[u.id])
          for (const [k, v] of Object.entries(u.fx)) {
            if (k === 'early') for (let i = 0; i < v[0]; i++) m.early[i] *= v[1];
            else m[k] = FX_MULTIPLY.includes(k) ? m[k] * v : k === 'dmBonus' ? m[k] + v : Math.max(m[k], v);
          }
    if (inTrial('slow-earth')) m.speed /= 10;
    if (inTrial('great-trial')) m.profit /= 1000;
    m.dmPer = 0.02 * (1 + m.dmBonus); // profit per Dark Matter, up to 1,000
    M = m;
    m.minLevel = Math.min(...S.level.slice(0, MINE_COUNT));
    m.totalLevels = S.level.slice(0, MINE_COUNT).reduce((a, b) => a + b, 0);
    m.levelMilestones = LEVEL_MILESTONES.filter((t) => m.totalLevels >= t).length;
    allMilestoneCheck();
    m.boosted = now < S.boostEndsAt;
    m.mult =
      (1 + (inTrial('dark-fast') ? 0 : dmBonusAt(dmAvailable()))) *
      (1 + m.questBonus * Object.keys(S.quests).length) *
      m.profit *
      2 ** m.levelMilestones *
      2 ** S.allMs *
      (1 + m.runeBonus * runePower()) *
      (1 + 0.01 * Object.keys(S.achievements).length) *
      (m.boosted ? boostPower() : 1) *
      STONE_POWER ** S.stones *
      resonance('capitalist');
    m.golemIncome = 0; // gold per second from mines with golems
    for (let i = 0; i < MINE_COUNT; i++) if (S.golems[i] && level(i)) m.golemIncome += payout(i) / cycleTime(i);
  }

  // ===== Economy =====
  // The mines the every-mine milestones look at, and the lowest of them (the one holding the next milestone back)
  function allMineWeakest() {
    let top = 4;
    for (let i = 0; i < CRUCIBLE; i++) if (level(i)) top = Math.max(top, i);
    let lo = 0;
    for (let i = 1; i <= top; i++) if (level(i) < level(lo)) lo = i;
    return lo;
  }
  // Returns how many milestones this call reached (they stay for the run)
  function allMilestoneCheck() {
    const lo = level(allMineWeakest());
    let got = 0;
    while (S.allMs < ALL_MILESTONES.length && lo >= ALL_MILESTONES[S.allMs]) S.allMs++, got++;
    return got;
  }
  const dmBonusAt = (n) => dmBonusFor(M.dmPer, n);
  const speedMilestones = (i) => SPEED_MILESTONES.filter((t) => level(i) >= t).length;
  const speed = (i) => 2 ** speedMilestones(i) * M.speed * UPGRADE_SPEED[S.upgrades[i]];
  const cycleTime = (i) => UNITS[i].time / speed(i);
  // Gold per cycle for mines; Arcana per cycle for the Research Lab (which grows with the 5th root of profit)
  const payout = (i) =>
    i === LAB
      ? UNITS[i].profit * level(i) * M.arcana * M.mult ** 0.2
      : UNITS[i].profit * level(i) * UPGRADE_PROFIT[S.upgrades[i]] * M.early[i] * M.mult;
  // Cost of k more levels, and how many levels a budget buys (geometric series)
  const growth = (i) => UNITS[i].growth ** (inTrial('thrift') ? 2 : 1);
  function buyCost(i, k) {
    const g = growth(i);
    return ((UNITS[i].cost * g ** level(i) * (g ** k - 1)) / (g - 1)) * M.price;
  }
  function maxAffordable(i, budget) {
    const g = growth(i);
    return Math.max(0, Math.floor(Math.log((budget * (g - 1)) / (UNITS[i].cost * g ** level(i) * M.price) + 1) / Math.log(g)));
  }
  const golemCost = (i) => UNITS[i].golemCost * M.golemPrice;
  const canSummon = (i) => level(i) > 0 && !S.golems[i] && !(inTrial('lone-golem') && i !== LAB && golemsOnMines() >= 1);
  const canEnchant = (i) => i < MINE_COUNT && level(i) > 0 && S.upgrades[i] < 10 && !inTrial('bare-stone');
  const upgradeCost = (i) => UNITS[i].cost * UPGRADE_STEPS[S.upgrades[i]][3]; // only while fewer than 10 are bought
  const nextSpeedMilestone = (i) => SPEED_MILESTONES.find((t) => t > level(i));
  function buyAmount(i) {
    if (buyMode === 'max') return Math.max(1, maxAffordable(i, S.cash));
    if (buyMode === 'next') {
      const t = nextSpeedMilestone(i);
      return Math.max(1, Math.min(t ? t - level(i) : 1, maxAffordable(i, S.cash)));
    }
    return buyMode;
  }

  // Transmute: total Dark Matter grows with the cube root of lifetime earnings (₲2B for the first). Runes raise it, a
  // little less with each one so ascending stays a steady step rather than a runaway
  const runeDmMult = () => (1 + 0.1 * S.runes) ** 0.7;
  const dmGainMult = () => M.dmGain * runeDmMult();
  const earningsForDm = (n) => 2e9 * (n / dmGainMult()) ** 3;
  const transmuteReward = () => Math.max(0, Math.floor(dmGainMult() * Math.cbrt(S.lifetimeEarned / 2e9)) - S.darkMatter);
  // Ascension: the Dark Matter of one ascension is worth 10 runes at 400, doubling for every 10× more. Like Dark Matter,
  // it pays only the runes beyond those you already have, so ascending again right away gives nothing. (Paying the
  // full amount every time let runes snowball until ascending every minute was best, and the run never mattered)
  const ASCEND_AT = 400;
  const RUNE_POWER = 0.3;
  const runesFor = (dm) => (dm >= ASCEND_AT ? Math.floor(10 * (dm / ASCEND_AT) ** RUNE_POWER) : 0);
  const ascendReward = () => Math.max(0, runesFor(S.darkMatter) - S.runes);
  const nextRuneAt = () => ASCEND_AT * (Math.max(10, S.runes + ascendReward() + 1) / 10) ** (1 / RUNE_POWER);
  const goodTransmute = () => {
    const p = transmuteReward();
    return p >= 3 && (!S.darkMatter || p >= S.darkMatter);
  };
  const goodAscend = () => {
    const q = ascendReward();
    return q > 0 && (!S.runes || q >= S.runes * 0.5);
  };

  // Crucible essence: +1 per second for every digit of golem income past 20, times the catalysts
  const catalystCost = (k) => CATALYSTS[k].base * CATALYSTS[k].growth ** S.catalysts[k];
  const catalystMult = () => S.catalysts.reduce((m, n) => m * (1 + M.catalystPower * n), 1);
  const catalystFunds = (k) => [S.cash, S.arcana, dmAvailable()][k];
  const chargeRate = () => (level(CRUCIBLE) > 0 ? Math.max(0, Math.log10(M.golemIncome + 1) - 20) * catalystMult() * M.essence : 0);
  const chargeFraction = () => Math.min(1, S.charge / CHARGE_GOAL);

  // ===== Simulation: advance every unit by dt seconds (also used for offline earnings) =====
  function earn(i, v) {
    if (i === LAB) return void (S.arcana += v);
    S.cash += v;
    S.runEarned += v;
    S.lifetimeEarned += v;
    S.totalEarned += v;
    if (!S.golems[i]) manualEarned += v;
  }
  function step(dt) {
    for (let i = 0; i < UNITS.length; i++) {
      if (!level(i) || !(S.running[i] || S.golems[i])) continue;
      S.running[i] = 1;
      let p = S.progress[i] + dt / cycleTime(i),
        n = Math.floor(p);
      if (n > 0) {
        if (S.golems[i]) p -= n;
        else ((n = 1), (p = 0), (S.running[i] = 0)); // mines without golems stop after one cycle
        const v = n * payout(i);
        earn(i, v);
        floatNumber(i, () => (i === LAB ? icon('flask', 11) + ' +' : '+₲') + fmt(v));
      }
      S.progress[i] = p;
    }
    S.charge += dt * chargeRate();
  }
  // Offline: mines with golems keep working at the offline rate. An elixir only counts for the time it had left.
  // Returns what was earned, for the welcome-back summary
  function catchUp(seconds) {
    const cash = S.cash, arcana = S.arcana;
    const boosted = clamp01((S.boostEndsAt - S.savedAt) / 1000 / seconds) * seconds;
    if (boosted > 0) {
      refresh(S.savedAt);
      step(boosted * M.offline);
    }
    refresh();
    step((seconds - boosted) * M.offline);
    manualEarned = 0;
    checkTrial();
    return [
      { name: 'Gold', icon: 'coins', color: GOLD_COLOR, amount: S.cash - cash, format: money },
      { name: 'Arcana', icon: 'flask', color: ARCANA_COLOR, amount: S.arcana - arcana, format: count },
    ].filter((g) => g.amount > 0);
  }
  function checkAchievements() {
    if (claimAchievements(ACHIEVEMENTS, S.achievements, 'profit')) refresh();
  }

  // A trial is won the moment its run's earnings reach the goal; its handicap lifts and the reward is permanent
  function checkTrial() {
    const t = TRIALS.find((x) => x.id === S.trial);
    if (!t || S.runEarned < t.goal) return;
    S.trials[t.id] = 1;
    S.trial = '';
    refresh();
    spectacle('ascend', `${t.name} complete`, `${t.reward}, for good`);
  }
  function resetRun(carry) {
    const keep = {};
    KEEP_ON_RESET.forEach((k) => (keep[k] = S[k]));
    S = Object.assign(newState(), keep, carry);
    refresh();
    if (M.startCash) S.cash = M.startCash;
    for (let i = 0; i < (inTrial('lone-golem') ? 0 : M.autoGolems); i++) S.golems[i] = 1;
    saveGame();
  }
  // Transmuting (and starting a trial, which transmutes into it): the run melts down into Dark Matter
  function transmuteInto(trial = '') {
    const p = transmuteReward();
    resetRun({
      darkMatter: S.darkMatter + p, dmEarnedAll: S.dmEarnedAll + p, dmSpent: S.dmSpent, dmUpgrades: S.dmUpgrades,
      lifetimeEarned: S.lifetimeEarned, transmutes: S.transmutes + (p > 0 ? 1 : 0), trial,
    });
    return p;
  }

  // ===== Player actions. Every button carries data-a (action) and data-i (index or id); shared ones live in the app =====
  const ACTIONS = {
    mode: (v) => (buyMode = isNaN(+v) ? v : +v),
    run(v) {
      S.taps++;
      if (level(+v) && !S.running[+v]) S.running[+v] = 1;
    },
    buy(v) {
      const i = +v, k = buyAmount(i), c = buyCost(i, k);
      if (!isVisible(i) || !Number.isFinite(c) || !Number.isFinite(k) || S.cash < c || (buyMode === 'max' && maxAffordable(i, S.cash) < 1)) return;
      const before = speedMilestones(i);
      S.cash -= c;
      S.level[i] += k;
      if (i === CRUCIBLE) S.crucibleBuilt = true;
      if (speedMilestones(i) > before) milestoneFlash(i);
      const got = allMilestoneCheck();
      if (got) {
        refresh();
        toast(`Every mine at ${plain(ALL_MILESTONES[S.allMs - 1])} levels: all profit ×${2 ** got}`);
      }
    },
    summon(v) {
      const i = +v;
      if (!canSummon(i) || S.cash < golemCost(i)) return;
      S.cash -= golemCost(i);
      S.golems[i] = S.running[i] = 1;
    },
    summonAll() {
      let n = 0;
      for (const i of DISPLAY_ORDER.filter(canSummon).sort((a, b) => golemCost(a) - golemCost(b)))
        if (S.cash >= golemCost(i) && canSummon(i)) {
          S.cash -= golemCost(i);
          S.golems[i] = S.running[i] = 1;
          n++;
        }
      if (n) toast(`Summoned ${n} golem${n > 1 ? 's' : ''}`);
    },
    upgrade(v) {
      const i = +v;
      if (!canEnchant(i) || S.cash < upgradeCost(i)) return;
      S.cash -= upgradeCost(i);
      S.upgrades[i]++;
    },
    upgradeAll() {
      let n = 0;
      for (; n < 600; n++) {
        let best = -1;
        for (let j = 0; j < MINE_COUNT; j++)
          if (canEnchant(j) && (best < 0 || upgradeCost(j) < upgradeCost(best))) best = j;
        if (best < 0 || S.cash < upgradeCost(best)) break;
        S.cash -= upgradeCost(best);
        S.upgrades[best]++;
      }
      if (n) toast(`Cast ${n} enchantment${n > 1 ? 's' : ''}`);
    },
    research(id) {
      const r = RESEARCH.find((x) => x.id === id);
      if (!r || S.research[id] || S.arcana < r.cost) return;
      S.arcana -= r.cost;
      S.research[id] = 1;
      toast(`Discovered ${r.name}: ${r.desc}`);
    },
    quest(id) {
      const m = QUESTS.find((x) => x.id === id);
      if (!m || S.quests[id] || !m.done()) return;
      S.quests[id] = 1;
      S.arcana += m.reward;
      toast(`Quest complete: +${count(m.reward)} Arcana and +${Math.round(M.questBonus * 100)}% profit`);
    },
    dmUpgrade(id) {
      const u = DM_UPGRADES.find((x) => x.id === id);
      if (!u || S.dmUpgrades[id] || dmAvailable() < u.cost) return;
      S.dmSpent += u.cost;
      S.dmUpgrades[id] = 1;
      toast(`${u.name}: ${u.desc}`);
    },
    runeUpgrade(id) {
      const u = RUNE_UPGRADES.find((x) => x.id === id);
      if (!u || S.runeUpgrades[id] || runesAvailable() < u.cost) return;
      S.runesSpent += u.cost;
      S.runeUpgrades[id] = 1;
      refresh();
      if (!inTrial('lone-golem')) for (let i = 0; i < M.autoGolems; i++) if (level(i)) S.golems[i] = 1; // Bound Golems start work now, not next run
      toast(`${u.name}: ${u.desc}`);
    },
    transmute() {
      if (!transmuteReward() || !confirmTap('transmute')) return;
      const p = transmuteInto();
      spectacle('transmute', 'Transmuted', `+${count(p)} Dark Matter · profit bonus now ×${fmt(1 + dmBonusAt(dmAvailable()))}`);
    },
    // Starting a trial transmutes into it (any Dark Matter the run has earned is kept); leaving one lifts the handicap
    trial(id) {
      const t = TRIALS.find((x) => x.id === id);
      if (!t || S.trials[id] || S.trial || TRIALS.indexOf(t) >= trialsOpen() || !confirmTap('trial-' + id)) return;
      const p = transmuteInto(id);
      spectacle('transmute', t.name, `${t.handicap}. Earn ${money(t.goal)} in this run${p ? ` · +${count(p)} Dark Matter` : ''}`);
    },
    leaveTrial() {
      if (!S.trial || !confirmTap('leaveTrial')) return;
      S.trial = '';
      toast('Trial abandoned. The handicap is lifted for the rest of this run.');
    },
    ascend() {
      const q = ascendReward();
      if (!q || !confirmTap('ascend')) return;
      resetRun({ runes: S.runes + q, ascensions: S.ascensions + 1, dmUpgrades: M.keepDmUpgrades ? S.dmUpgrades : {} }); // kept upgrades cost nothing in the new ascension
      spectacle('ascend', 'Ascended', `+${count(q)} Elder Runes · ${count(S.runes)} in total`);
    },
    catalyst(v) {
      const k = +v, c = catalystCost(k);
      if (!S.crucibleBuilt || catalystFunds(k) < c) return;
      if (k === 0) S.cash -= c;
      else if (k === 1) S.arcana -= c;
      else S.dmSpent += c; // spending Dark Matter lowers its bonus
      S.catalysts[k]++;
      toast(`${CATALYSTS[k].name} level ${S.catalysts[k]}: essence ×${fmt(catalystMult())}`);
    },
    finish() {
      if (S.wonAt || S.charge < CHARGE_GOAL || !confirmTap('finish')) return;
      S.wonAt = S.playTime;
      checkAchievements();
      saveGame();
      spectacle('finish', '', '', showEnding, UNITS.slice(0, MINE_COUNT).map((u) => u.color));
    },
    // after the Stone: start this mode over as a new Great Work (see newWorkCarry)
    newWork() {
      if (!S.wonAt || !confirmTap('newWork')) return;
      S = Object.assign(newState(), newWorkCarry(S));
      refresh();
      saveGame();
      spectacle('ascend', 'A new Great Work', `All profit ×${fmt(STONE_POWER ** S.stones)} for the ${S.stones} Stone${S.stones > 1 ? 's' : ''} you've forged`);
    },
    daily() {
      if (Date.now() < S.dailyReadyAt) return;
      const g = Math.max(1000, (M.golemIncome / (M.boosted ? boostPower() : 1)) * DAILY_HOURS * 3600); // the elixir doesn't count
      S.cash += g;
      S.dailyReadyAt = Date.now() + DAILY_COOLDOWN;
      toast('Daily tribute: +' + money(g));
    },
    boost() {
      if (Date.now() < S.boostReadyAt) return;
      S.boostEndsAt = Date.now() + M.boostHours * HOUR;
      S.boostReadyAt = Date.now() + BOOST_COOLDOWN;
      toast(`Elixir of Fortune: ×${+boostPower().toFixed(2)} profit for ${M.boostHours === 1 ? 'an hour' : '30 minutes'}`);
    },

  };
  // ===== Feedback: floating numbers and the milestone ring =====
  function floatNumber(i, html, always) {
    if (tab !== 'mines' || !cards.length) return;
    Polish.pop(cards[i].card, html, UNITS[i].color, i, always);
  }
  // A speed milestone: a ring of the mine's color spreads from its card, with a burst from its icon
  function milestoneFlash(i) {
    const c = cards[i] && cards[i].card;
    if (!c) return;
    Polish.restart(c, 'ring');
    const r = c.querySelector('.ic').getBoundingClientRect();
    Polish.burst(r.left + r.width / 2, r.top + r.height / 2, UNITS[i].color, 12, 56);
    floatNumber(i, 'Speed ×2!', true);
  }
  // ===== Tutorial (shown the first time you open this mode) =====
  const TUTORIAL = [
    ['Welcome to Capitalist', "<p>Dig your way from common clay to the rarest stones in the world, and use them to forge the <b>Philosopher's Stone</b>. Your mines keep earning gold even while you're away.</p><p>Move between tabs with the bar at the bottom, or swipe left and right anywhere below the top boxes.</p><p>New systems explain themselves as they open, and the whole guide is in <b>Settings</b> at the bottom of the Magnum Opus tab.</p><p>Capitalist is one of the three modes of <b>Deepforge</b>. The button at the far right of the tab bar switches to the next one, <b>Communist</b>. Each mode is a separate game with its own progress, and each keeps producing while you play another.</p>"],
    ['Mines', "<p>Tap <b>Open</b> to dig your first Clay Pit, then tap the mine's card to work it. When the bar fills you earn gold.</p><p>Each level adds profit. Every 25, 50, 100, 200 and so on levels <b>doubles that mine's speed</b>; the line under its name shows the next one. The buy modes at the top (×1, ×10, ×100, Max, Next ×2) set how many you buy per tap. Next ×2 buys exactly enough to reach the next speed boost.</p><p>Opening a mine reveals a rarer one: metals, then gems, then enchanted ores and the primal stones. There are 30. Your mines' levels in a run add up, too: at 1,000, 2,500, 5,000 and so on, all profit doubles. The line above the mines shows the next one.</p>"],
    ['Golems and enchantments', "<p><b>Golems</b> work a mine for you, forever. Mines with golems keep earning while you're away (at half speed until you research Tireless Runes).</p><p><b>Enchantments</b> give each mine 10 boosts to profit and speed, cast in order. Both are on the <b>Forge</b> tab, and the two buttons at its top buy everything you can afford at once.</p>"],
    ['Research and quests', '<p>The <b>Research Lab</b> brews <b>Arcana</b> instead of gold. Spend Arcana on the Research tab for permanent alchemy: bigger profits, faster cycles and cheaper purchases. Research is never lost, not even when you ascend.</p><p><b>Quests</b> reward Arcana and each one you claim adds profit permanently. Quests are at the top of the Research tab. A red dot on any tab means there is something there you can claim or afford. <b>Achievements</b>, near the bottom of the Magnum Opus tab, add +1% profit each.</p>'],
    ['Transmuting and Dark Matter', "<p>Once you've earned enough gold (about ₲2B for the first time), <b>Transmute</b> melts down your mines, golems, enchantments and gold, and leaves behind <b>Dark Matter</b>. You keep Arcana, research, quests and achievements.</p><p>Every Dark Matter gives <b>+2% profit</b> (the bonus grows more slowly past 1,000), so you rebuild much faster each time. You can spend Dark Matter on powerful upgrades, but spending it lowers the bonus.</p><p>The Transmute tab tells you how much transmuting would multiply your Dark Matter. Most players transmute once it's ×2 or more; the tab gets a red dot when it's a good time.</p>"],
    ['Ascension and Elder Runes', "<p><b>Ascension</b> is a bigger reset, unlocked after earning 400 Dark Matter since your last ascension. It pays the runes your Dark Matter this ascension is worth beyond the runes you already have, so each one has to beat your best. It resets your Dark Matter and its upgrades as well as the run, in exchange for <b>Elder Runes</b>. Research, Arcana, quests and achievements stay.</p><p>Each rune gives <b>+10% profit</b> (more slowly past 1,000 runes) and raises the Dark Matter you get from transmuting, and that bonus is never spent away. Rune upgrades like Head Start and Bound Golems make each new run start fast. Ascending is worth it when the hint says your runes would grow by about ×1.5 or more.</p><p>Each ascension also opens a <b>trial</b>: a run with a handicap that gives a permanent reward if you reach its goal anyway.</p>"],
    ['The Magnum Opus', "<p>The goal of the game is on the <b>Magnum Opus</b> tab. Build the <b>Prime Crucible</b>, your 30th mine, and it starts gathering essence while it stands in your run. The more digits your income has, the faster it fills.</p><p>Essence is never lost: it survives transmuting and ascending and builds offline. <b>Catalysts</b>, some rune upgrades and the last trial speed it up. At 100%, forge the Philosopher's Stone to finish the game. It's a long journey of 100 hours or more.</p>"],
    ['Tips', "<p>On the <b>Magnum Opus</b> tab, below the crucible: the <b>daily tribute</b> pays six hours of income, and the <b>Elixir of Fortune</b> triples your profit for 30 minutes, getting stronger with each ascension. A red dot on that tab shows when one is ready.</p><p>Your game saves automatically. Use <b>Export</b> in Settings now and then to keep a backup code.</p>"],
  ];
  // What floats up when an action works: the levels bought
  const FEEDBACK = {
    measure: (action, arg) => (action === 'buy' ? level(+arg) : 0),
    label: (action, arg, was) => (action === 'buy' ? '+' + (level(+arg) - was) : ''),
    unlocked: (action, arg, was) => action === 'buy' && was === 0, // opening a mine
  };
  const runePrice = (n) => icon('runes', 14) + ' ' + count(n);

  const cards = []; // mine card elements by unit index
  // The Mines tab keeps its cards on the page and updates them in place; they're built once
  function buildUI() {
    $('modes').innerHTML = BUY_MODES.map(
      (m) => `<button data-a="mode" data-i="${m}" id="mode-${m}">${m === 'max' ? 'Max' : m === 'next' ? 'Next ×2' : '×' + m}</button>`,
    ).join('');
    $('mines').innerHTML = UNITS.map(
      (u, i) =>
        `<div class="card" data-a="run" data-i="${i}" style="--c:${u.color};order:${DISPLAY_ORDER.indexOf(i)}"><div class="ic" data-a="run" data-i="${i}">${icon(u.icon, 26)}<b></b></div>` +
        `<div class="mid"><div class="nm">${u.name}</div><small class="ms"></small><div class="bar px" data-a="run" data-i="${i}"><i></i><span></span></div></div>` +
        `<button class="buy" data-a="buy" data-i="${i}"></button></div>`,
    ).join('');
    $('mines').querySelectorAll('.card').forEach((card, i) =>
      cards.push({ card, level: card.querySelector('.ic b'), ms: card.querySelector('.ms'), fill: card.querySelector('.bar i'), text: card.querySelector('.bar span'), buy: card.querySelector('.buy') }),
    );
  }

  // Red dots on the tab bar: something on that tab is ready or affordable right now
  const TAB_BADGES = {
    // the next mine in the line can be opened
    mines: () => UNITS.some((u, i) => !level(i) && isVisible(i) && S.cash >= buyCost(i, 1)),
    // a golem to summon or an enchantment to cast
    forge: () =>
      DISPLAY_ORDER.some((i) => (canSummon(i) && S.cash >= golemCost(i)) || (canEnchant(i) && S.cash >= upgradeCost(i))),
    // a quest to claim or research to buy
    research: () => (QUESTS.some((m) => !S.quests[m.id] && m.done()) ? 'claim' : RESEARCH.some((r) => !S.research[r.id] && S.arcana >= r.cost)),
    // a good time to transmute or ascend, or a Dark Matter or rune upgrade to buy
    transmute: () =>
      (goodTransmute() || goodAscend() ? 'claim' : false) ||
      DM_UPGRADES.some((u) => !S.dmUpgrades[u.id] && dmAvailable() >= u.cost) ||
      RUNE_UPGRADES.some((u) => !S.runeUpgrades[u.id] && runesAvailable() >= u.cost),
    // a bonus to claim, the Stone ready to forge, or a catalyst to buy
    opus: (now) =>
      (now >= S.dailyReadyAt || now >= S.boostReadyAt || (!S.wonAt && S.charge >= CHARGE_GOAL) ? 'claim' : false) ||
      (S.crucibleBuilt && CATALYSTS.some((a, k) => catalystFunds(k) >= catalystCost(k))),
  };
  // The four boxes at the top: [label, icon, value, format, note]
  function header() {
    const now = Date.now();
    BUY_MODES.forEach((m) => $('mode-' + m).classList.toggle('on', m === buyMode));
    return [
      ['Gold', 'coins', S.cash, money, ' · Profit ×' + fmt(M.mult)],
      ['Income/s', 'trend', M.golemIncome + manualRate, money, M.boosted ? ` · Elixir · ${duration((S.boostEndsAt - now) / 1000)}` : ''],
      ['Arcana', 'flask', S.arcana, count, ''],
      ['Dark Matter', 'spiral', dmAvailable(), count, ''],
    ];
  }

  // The line above the mines: the next level milestone, or the trial this run is
  function milestoneLine() {
    const t = TRIALS.find((x) => x.id === S.trial);
    if (t) return `${t.name}: ${t.handicap.toLowerCase()} · <b>${money(S.runEarned)} / ${money(t.goal)}</b>`;
    // both milestone kinds on one line: total levels, then every mine (with the mine holding it back)
    const next = LEVEL_MILESTONES.find((n) => M.totalLevels < n), goal = ALL_MILESTONES[S.allMs], lo = allMineWeakest();
    const parts = [];
    if (next) parts.push(`<b>${plain(M.totalLevels)} / ${plain(next)}</b> levels`);
    if (goal) parts.push(`every mine at <b>${plain(goal)}</b> <i>(${UNITS[lo].name} ${plain(level(lo))})</i>`);
    const so = `<i>×${plain(2 ** (M.levelMilestones + S.allMs))} so far</i>`;
    return parts.length ? `Next ×2 profit: ${parts.join(' · ')} · ${so}` : `Every milestone reached: ${so}`;
  }
  function renderMines() {
    setHTML($('allms'), milestoneLine());
    // only opened mines and the next two are shown; the rarer ones stay a surprise
    const upcoming = DISPLAY_ORDER.filter((i) => !level(i)), shown = new Set(upcoming.slice(0, 2));
    setText($('more'), upcoming.length > 2 ? `${upcoming.length - 2} rarer mines still buried` : '');
    for (let i = 0; i < UNITS.length; i++) {
      const c = cards[i], L = level(i);
      const hide = !L && !shown.has(i);
      if (c.card.hidden && !hide) Polish.restart(c.card, 'reveal'); // a mine just came into view
      c.card.hidden = hide;
      if (hide) continue;
      const t = cycleTime(i), k = buyAmount(i);
      const ok = buyMode === 'max' ? maxAffordable(i, S.cash) > 0 : S.cash >= buyCost(i, k);
      c.card.classList.toggle('on', L > 0);
      c.card.classList.toggle('far', !isVisible(i) && !ok); // not unlocked yet: dimmed
      if (c.level._text && +c.level._text < L) Polish.restart(c.level, 'tick');
      setText(c.level, String(L));
      fillTo(c.fill, t < 0.12 && (S.running[i] || S.golems[i]) ? 100 : S.progress[i] * 100, L > 0 && !!(S.running[i] || S.golems[i]));
      const amount = i === LAB ? icon('flask', 12) + ' ' + fmt(payout(i)) : money(payout(i));
      setHTML(c.text, L ? `<b>${amount}</b> · ${duration(t)}` : `<span class="nb">${i === LAB ? 'Not built' : 'Still buried'}</span>`);
      const next = nextSpeedMilestone(i);
      c.ms.hidden = !L;
      if (L) setHTML(c.ms, next ? `Next ×2 at level ${next} <i>(${next - L} to go)</i>` : 'Every speed boost reached');
      setHTML(c.buy, `${L ? 'Buy' : i === LAB ? 'Build' : 'Open'} ×${k}<br>${money(buyCost(i, k))}`);
      c.buy.classList.toggle('dis', !ok);
    }
  }


  // Pane builders, one per tab. Each returns [main pane HTML, second pane HTML]
  const PANES = {
    // Forge tab: golems and enchantments together. Done items fold away so the list stays short
    forge() {
      const built = DISPLAY_ORDER.filter((i) => level(i));
      if (!built.length) return [tip('Open a mine to summon its golem and cast its enchantments.')];
      const mines = built.filter((i) => i !== LAB);
      const cheapest = Math.min(...mines.filter(canEnchant).map(upgradeCost));
      let h =
        `<div class="bulk2">${bigButton('summonAll', 'Summon all golems', built.some((i) => canSummon(i) && S.cash >= golemCost(i)))}` +
        `${bigButton('upgradeAll', 'Cast all enchantments', S.cash >= cheapest)}</div>`;
      if (inTrial('lone-golem')) h += tip('Trial of the Lone Golem: only one mine can have a golem in this run. Choose it well.');
      const golemRow = (i) => {
        const u = UNITS[i], rate = i === LAB ? `${fmt(payout(i) / cycleTime(i))} Arcana/s` : `${money(payout(i) / cycleTime(i))}/s`;
        return S.golems[i]
          ? row(`${icon(u.icon, 16, u.color)} ${u.name} golem`, 'Working it for you · ' + rate, owned_('Working'))
          : row(`${icon(u.icon, 16, u.color)} ${u.name} golem`, 'Works it for you: +' + rate, btn('summon', i, 'Summon<br>' + money(golemCost(i)), canSummon(i) && S.cash >= golemCost(i)));
      };
      const toSummon = built.filter((i) => !S.golems[i]), summoned = built.filter((i) => S.golems[i]);
      h += section('Golems') + (toSummon.length ? toSummon.map(golemRow).join('') : tip("Every mine you've opened has a golem."));
      if (summoned.length) h += fold('golems-summoned', `Working golems (${summoned.length})`, summoned.map(golemRow).join(''));
      const upgradeRow = (i) => {
        const u = UNITS[i], n = S.upgrades[i];
        return row(
          `${icon(u.icon, 16, u.color)} ${u.name}`,
          (n < 10 ? UPGRADE_STEPS[n][0] : 'Every enchantment cast') + ` · ${n}/10`,
          n >= 10 ? owned_('Maxed') : btn('upgrade', i, 'Cast<br>' + money(upgradeCost(i)), canEnchant(i) && S.cash >= upgradeCost(i)),
        );
      };
      const open = mines.filter((i) => S.upgrades[i] < 10), maxed = mines.filter((i) => S.upgrades[i] >= 10);
      h += section('Enchantments') + tip(inTrial('bare-stone') ? 'Trial of Bare Stone: no enchantments can be cast in this run.' : 'Each mine takes 10 enchantments: bigger profit multipliers and faster cycles.') + open.map(upgradeRow).join('');
      if (maxed.length) h += fold('upgrades-maxed', `Fully enchanted (${maxed.length})`, maxed.map(upgradeRow).join(''));
      return [h];
    },
    // Research tab: quests (which pay Arcana) first, then research (which spends it)
    research() {
      return [
        questSection(QUESTS, S.quests, `Each claimed quest adds +${Math.round(M.questBonus * 100)}% profit permanently.`) +
          section('Research') +
          tip('Research Labs brew Arcana. Spend it on alchemy that lasts: discoveries are never lost, not even when you ascend.') +
          upgradeList(RESEARCH, S.research, { action: 'research', price: arcanaPrice, funds: S.arcana, key: 'research', why: whyNow, later: 'Later research', allDone: 'Every discovery is made.', ownedLabel: 'Known', doneKey: '-done', doneLabel: 'Discoveries made' }),
      ];
    },
    transmute() {
      const p = transmuteReward(), avail = dmAvailable(), total = S.darkMatter + p;
      const from = earningsForDm(total), to = earningsForDm(total + 1), pct = clamp01((S.lifetimeEarned - from) / (to - from));
      let h =
        `<div class="row panel"><b>${icon('spiral', 16)} Dark Matter: ${count(avail)}</b>` +
        `<small>Profit bonus <b>×${live(fmt(1 + dmBonusAt(avail)))}</b> · +${(M.dmPer * 100).toFixed(1)}% per Dark Matter</small>` +
        `<div class="bar">${liveBar(pct * 100)}<span>${live(Math.floor(pct * 100))}% to the next Dark Matter</span></div>` +
        `<small>Earnings this ascension ${live(money(S.lifetimeEarned))} · next Dark Matter at ${live(money(to))}</small></div>` +
        `<p class="hint">${transmuteHint(p, S.darkMatter, earningsForDm(1))}</p>` +
        bigButton('transmute', armed === 'transmute' ? 'Tap again to transmute' : p ? `Transmute for +${count(p)} ${icon('spiral', 16)}` : 'Nothing to transmute yet', p > 0);
      const table = [1, 10, 50, 100, 500, 1000]
        .map((n) => {
          const at = earningsForDm(n), got = S.lifetimeEarned >= at;
          return `<div class="${got ? '' : 'no'}"><span>${n.toLocaleString('en-US')} total Dark Matter</span><span>${money(at)}${got ? ' (reached)' : ''}</span></div>`;
        })
        .join('');
      h += fold(
        'transmute-help',
        'How transmuting works',
        `<p><b>Transmuting</b> melts down your mines, golems, enchantments and gold. What's left is Dark Matter. You keep Arcana, research, quests, achievements, trials and Dark Matter.</p>` +
          `<p>Your total Dark Matter grows with the cube root of your earnings this ascension, so 1,000× the earnings gives 10× the Dark Matter. Those earnings count every coin since your last ascension, even across transmutations.</p>` +
          `<p>Each Dark Matter adds +${(M.dmPer * 100).toFixed(1)}% profit, up to 1,000 Dark Matter. Past that, the bonus grows with the cube root. Spending Dark Matter on upgrades lowers the bonus.</p><div class="mtable">${table}</div>`,
      );
      if (!S.darkMatter && !S.dmEarnedAll && !S.ascensions) return [h]; // Dark Matter upgrades, ascension and trials appear after the first transmutation
      h += section('Dark Matter upgrades') + upgradeList(DM_UPGRADES, S.dmUpgrades, { action: 'dmUpgrade', price: dmPrice, funds: avail, key: 'dm', why: (u) => whyNow(u, u.cost), later: 'More Dark Matter upgrades', allDone: 'Every Dark Matter upgrade is owned.' });
      return [h + ascensionSection() + trialSection()];
    },
    // The Magnum Opus tab: the end goal first, then bonuses, stats, achievements and (below the panes) Settings
    opus() {
      const [stats, achievements] = statsSection();
      return [crucibleSection() + stats, achievements];
    },
  };
  // Ascension (Transmute tab). Until it's close to unlocking, it's one short panel
  function ascensionSection() {
    const q = ascendReward(), runes = runesAvailable();
    if (!S.runes && S.darkMatter < ASCEND_AT / 2)
      return (
        section('Ascension') +
        `<div class="row panel"><b>${icon('runes', 16)} Ascension</b><small>A bigger reset for Elder Runes, which boost profit and Dark Matter for good. It unlocks at ${plain(ASCEND_AT)} Dark Matter earned this ascension.</small>` +
        `<div class="bar">${liveBar(Math.min(100, (S.darkMatter / ASCEND_AT) * 100))}<span>${live(count(S.darkMatter))} / ${plain(ASCEND_AT)} Dark Matter</span></div></div>`
      );
    return (
      section('Ascension') +
      `<div class="row panel"><b>${icon('runes', 16)} Elder Runes: ${count(runes)}</b>` +
      `<small>Profit <b>×${fmt(1 + M.runeBonus * runePower())}</b> · Dark Matter from transmuting <b>×${fmt(runeDmMult())}</b></small>` +
      `<small>Dark Matter earned this ascension: ${live(count(S.darkMatter))}${q ? ` · next rune at ${live(count(nextRuneAt()))}` : ''}</small></div>` +
      `<p class="hint">${ascendHint(q)}</p>` +
      bigButton('ascend', armed === 'ascend' ? 'Tap again to ascend' : q ? `Ascend for +${count(q)} ${icon('runes', 16)}` : 'Not unlocked yet', q > 0) +
      fold(
        'ascend-help',
        'How ascending works',
        `<p><b>Ascending</b> resets your run and your Dark Matter with its upgrades. You keep runes and rune upgrades, research, Arcana, quests, achievements, trials, crucible essence and catalysts.</p>` +
          `<p>Every rune you've ever earned gives +${Math.round(M.runeBonus * 100)}% profit (past 1,000 runes the bonus grows with the square root) and raises the Dark Matter you get from transmuting. Spending runes on upgrades never lowers that.</p>` +
          `<p>Ascending unlocks at ${plain(ASCEND_AT)} Dark Matter earned since your last ascension, for 10 runes. More Dark Matter gives more runes: 10× the Dark Matter doubles them.</p>`,
      ) +
      section('Rune upgrades') +
      upgradeList(RUNE_UPGRADES, S.runeUpgrades, { action: 'runeUpgrade', price: runePrice, funds: runes, key: 'rune', why: whyNow, later: 'More rune upgrades', allDone: 'Every rune upgrade is owned.' })
    );
  }
  // Trials (Transmute tab, below Ascension): one more opens with each ascension
  function trialSection() {
    if (!S.ascensions) return '';
    const active = TRIALS.find((x) => x.id === S.trial);
    let h =
      section(`Trials · ${trialsDone()} / ${TRIALS.length} complete`) +
      tip('A trial is a run with a handicap. Starting one transmutes into it. Earn its goal in that run and its reward is yours for good. One more trial opens with each ascension.');
    if (active)
      h +=
        `<div class="row panel"><b>${icon('target', 16)} In ${active.name}</b><small>${active.handicap} · Reward: ${active.reward}</small>` +
        `<div class="bar">${liveBar(clamp01(Math.log10(S.runEarned + 1) / Math.log10(active.goal)) * 100)}<span>${live(money(S.runEarned))} / ${money(active.goal)} this run</span></div></div>` +
        bigButton('leaveTrial', armed === 'leaveTrial' ? 'Tap again to abandon it' : 'Abandon this trial', true);
    const trialRow = (t, k) =>
      S.trials[t.id]
        ? row(t.name, `${t.handicap} · ${t.reward}`, owned_('Complete'))
        : k >= trialsOpen()
          ? row(t.name, `Opens with ascension ${k + 1}`, '', ' done')
          : row(t.name, `${t.handicap} · Goal: earn ${money(t.goal)} in the run · Reward: <b>${t.reward}</b>`, active ? '' : btn('trial', t.id, armed === 'trial-' + t.id ? 'Tap again' : 'Start', true));
    const todo = TRIALS.map((t, k) => [t, k]).filter(([t, k]) => !S.trials[t.id] && t !== active && k <= trialsOpen());
    h += todo.map(([t, k]) => trialRow(t, k)).join('');
    const done = TRIALS.filter((t) => S.trials[t.id]);
    if (done.length) h += fold('trials-done', `Completed trials (${done.length})`, done.map((t) => trialRow(t, 0)).join(''));
    return h;
  }
  // The end goal (Magnum Opus tab). Until the Prime Crucible is built, it's one short panel
  function crucibleSection() {
    if (S.wonAt) return forgedPanel(S, 'profit');
    if (!S.crucibleBuilt && !S.charge) {
      const built = S.level.slice(0, MINE_COUNT).filter((l) => l > 0).length;
      return (
        `<div class="row panel"><b>The end goal</b><small>Build the <b>Prime Crucible</b>, your 30th mine. Fill it with essence to 100%, then forge the Philosopher's Stone to finish the game.</small>` +
        `<div class="bar opus">${liveBar((built / MINE_COUNT) * 100)}<span>${live(built)} of ${MINE_COUNT} mines opened</span></div></div>`
      );
    }
    const pct = chargeFraction(), rate = chargeRate(), built = level(CRUCIBLE) > 0;
    const status = !built
      ? 'The Prime Crucible isn’t built in this run. Build it again to keep filling it.'
      : rate > 0
        ? `Filling at ${rate.toFixed(1)} essence per second · about ${duration((CHARGE_GOAL - S.charge) / rate)} to go`
        : 'The crucible is built, but it only gathers essence once your income passes ₲100Qi per second.';
    let h =
      `<div class="row panel"><b>Prime Crucible essence</b><div class="bar opus">${liveBar(pct * 100)}<span>${live((pct * 100).toFixed(2))}% full</span></div><small>${live(status)}</small></div>` +
      bigButton('finish', armed === 'finish' ? 'Tap again to forge' : S.charge >= CHARGE_GOAL ? "Forge the Philosopher's Stone" : 'Fill the crucible to 100% to forge the Stone', S.charge >= CHARGE_GOAL) +
      fold(
        'crucible-help',
        'How the crucible works',
        `<p>Build the <b>Prime Crucible</b> (your 30th mine) and it starts gathering essence from everything your empire makes. At 100%, forge the Philosopher's Stone. This finishes the game.</p>` +
          `<p>Essence speed depends on how many digits your golems' income per second has: every 10× more income adds +1 essence per second, before catalysts and other boosts. The crucible only gathers essence while it stands in your current run. Essence is never lost: it's kept through transmuting and ascending and keeps building offline at your offline rate.</p>`,
      );
    h += section(`Catalysts · essence ×${fmt(catalystMult())}`) + tip('Speed up the crucible. Catalyst levels are permanent and survive transmuting and ascending.');
    const price = (k) => [money, arcanaPrice, dmPrice][k](catalystCost(k));
    h += CATALYSTS.map((a, k) =>
      row(`${a.name} · level ${S.catalysts[k]}`, `+${Math.round(M.catalystPower * 100)}% essence speed per level · paid in ${a.currency}${k === 2 ? ' (spending it lowers your Dark Matter bonus)' : ''}`, btn('catalyst', k, price(k), catalystFunds(k) >= catalystCost(k))),
    ).join('');
    return h;
  }
  // Bonuses, stats and achievements (Magnum Opus tab, below the crucible). Returns [bonuses and stats, achievements]
  function statsSection() {
    const bonuses = bonusRows(S, 'Six hours of your income, free', 'Elixir of Fortune', `×${+boostPower().toFixed(2)} profit for ${M.boostHours === 1 ? 'an hour' : '30 minutes'} (+0.25× per ascension, up to ×10)`, M.boosted);
    const stats = statRows([
      ['Total earnings', money(S.totalEarned)],
      ['Time played', duration(S.playTime)],
      ['Taps', count(S.taps)],
      ['Best income / sec', money(S.bestIncome)],
      ['Mine levels', count(M.totalLevels)],
      ['Golems working', golemCount() + ' / ' + UNITS.length],
      ['Transmutations', count(S.transmutes)],
      ['Dark Matter earned', count(S.dmEarnedAll)],
      ['Ascensions', count(S.ascensions)],
      ['Trials completed', trialsDone() + ' / ' + TRIALS.length],
      ['Elder Runes earned', count(S.runes)],
      ['Profit multiplier', '×' + fmt(M.mult)],
      ['Crucible essence', (chargeFraction() * 100).toFixed(2) + '%'],
    ]);
    return [bonuses + stats, achievementSection(ACHIEVEMENTS, S.achievements, 'profit')];
  }
  function ascendHint(q) {
    if (!q) return `Ascension unlocks at ${plain(ASCEND_AT)} Dark Matter earned since your last ascension (${count(S.darkMatter)} so far).`;
    if (!S.runes) return `Your first ascension gives ${count(q)} Elder Runes.`;
    const r = (S.runes + q) / S.runes;
    return `Ascending now multiplies your Elder Runes by ×${r < 1e3 ? r.toFixed(2) : fmt(r)}. ` + (r >= 1.5 ? 'Good time to ascend.' : 'Most players wait for ×1.5 or more.');
  }
  // The Mines tab is drawn by the mode itself (its cards stay on the page); every other tab is a pane
  function onTab(key) {
    $('capMines').hidden = key !== 'mines';
  }
  function renderTab(key) {
    if (key !== 'mines') return false;
    renderMines();
    return true;
  }
  // The Philosopher's Stone on the Magnum Opus tab: rose, brightening as the crucible fills, with one light per open mine
  // which design of the goal is unlocked: one per milestone reached, and the next milestone to aim for
  const goalDesign = (steps) => {
    const next = steps.find(([, done]) => !done());
    return { style: steps.filter(([, done]) => done()).length, next: next ? next[0] : null };
  };
  const GOAL_STEPS = [
    ['Transmute once', () => S.transmutes >= 1],
    ['Transmute 5 times', () => S.transmutes >= 5],
    ['Ascend once', () => S.ascensions >= 1],
    ['Ascend 3 times', () => S.ascensions >= 3],
    ['Build the Prime Crucible', () => S.crucibleBuilt],
    ...[25, 50, 75, 90].map((v) => ['Fill the Prime Crucible to ' + v + '%', () => chargeFraction() >= v / 100 || S.wonAt > 0 || S.stones > 0]),
    ["Forge the Philosopher's Stone", () => S.wonAt > 0 || S.stones > 0],
    ["Forge a second Philosopher's Stone", () => S.stones + (S.wonAt ? 1 : 0) >= 2],
  ];
  function stone() {
    return {
      family: 'gem',
      ...goalDesign(GOAL_STEPS),
      tint: [217, 166, 177],
      fill: S.crucibleBuilt || S.charge ? 0.35 + 0.65 * chargeFraction() : 0.2,
      orbs: UNITS.slice(0, MINE_COUNT).map((u, i) => (level(i) ? { color: u.color, size: 2.2, alpha: 1, r: 1.9 + ((i * 0.37) % 1.3), v: 0.25 + ((i * 0.13) % 0.35), a: (i * 2.399) % 6.283, tilt: ((i % 5) - 2) * 0.08 } : null)).filter(Boolean),
    };
  }
  function titleLine() {
    if (!S.totalEarned) return 'Dig deep. Open mines, summon golems, forge the Stone.';
    return (S.wonAt ? "Philosopher's Stone forged · " : S.crucibleBuilt || S.charge ? 'Crucible ' + (chargeFraction() * 100).toFixed(1) + '% full · ' : '') + 'Total earnings ' + money(S.totalEarned);
  }
  function ending() {
    return {
      title: 'The Great Work is complete',
      text: "The Philosopher's Stone is forged. Every mine, every golem and every grain of gold led here.",
      stats: [
        ['This Great Work', duration(workTime(S))],
        ['Time played', duration(S.playTime)],
        ['Total earnings', money(S.totalEarned)],
        ['Transmutations', count(S.transmutes)],
        ['Ascensions', count(S.ascensions)],
        ['Achievements', Object.keys(S.achievements).length + ' / ' + ACHIEVEMENTS.length],
      ],
    };
  }
  // One tick of play: earn, then remember the best income
  function tick(dt) {
    // timers are stored as clock times: one set while the clock was ahead can't outlast its real length once it's put back
    const n = Date.now();
    if (S.boostEndsAt > n + HOUR) S.boostEndsAt = n + HOUR;
    if (S.boostReadyAt > n + BOOST_COOLDOWN) S.boostReadyAt = n + BOOST_COOLDOWN;
    if (S.dailyReadyAt > n + DAILY_COOLDOWN) S.dailyReadyAt = n + DAILY_COOLDOWN;
    refresh();
    step(dt);
    checkTrial();
    S.playTime += dt;
    manualRate += (manualEarned / dt - manualRate) * (1 - Math.exp(-dt / 5)); // ~5 second average
    manualEarned = 0;
    if (M.golemIncome > S.bestIncome) S.bestIncome = M.golemIncome;
  }

  // ===== Guidance: locked tabs and one-time cards =====
  // What a research or upgrade would do right now, in gold (or Arcana) per second. dmCost: Dark Matter it would spend,
  // which lowers the Dark Matter bonus, so the line shows the net effect
  const income = () => M.golemIncome + manualRate;
  const labRate = () => (level(LAB) ? payout(LAB) / cycleTime(LAB) : 0);
  function whyNow(u, dmCost = 0) {
    const fx = u.fx, inc = income();
    const dmLoss = dmCost ? (1 + dmBonusAt(Math.max(0, dmAvailable() - dmCost))) / (1 + dmBonusAt(dmAvailable())) : 1;
    const gain = (x) => {
      const net = x * dmLoss;
      if (inc <= 0) return '';
      return net > 1.001 ? `Now: about +${money(inc * (net - 1))}/s` : 'Now: costs more bonus than it gives';
    };
    if (fx.profit) return gain(fx.profit);
    if (fx.speed) return gain(fx.speed);
    if (fx.early) {
      let g = 0;
      for (let i = 0; i < fx.early[0]; i++) if (level(i)) g += payout(i) / cycleTime(i);
      return g > 0 ? `Now: about +${money(g * (fx.early[1] * dmLoss - 1))}/s` : '';
    }
    if (fx.price) {
      const i = DISPLAY_ORDER.find((j) => isVisible(j) && !level(j));
      return i !== undefined ? `Now: the ${UNITS[i].name} would cost ${money(buyCost(i, 1) * fx.price)}` : '';
    }
    if (fx.golemPrice) {
      const i = DISPLAY_ORDER.find((j) => level(j) && !S.golems[j]);
      return i !== undefined ? `Now: the ${UNITS[i].name} golem would cost ${money(golemCost(i) * fx.golemPrice)}` : 'Helps after your next reset';
    }
    if (fx.arcana) return labRate() ? `Now: about +${fmt(labRate() * (fx.arcana * dmLoss ** 0.2 - 1))} Arcana/s` : 'Build a Research Lab to benefit';
    if (fx.offline) return M.golemIncome ? `Now: +${money(M.golemIncome * 0.5 * 3600)} per hour away` : '';
    if (fx.dmBonus) {
      const a = dmAvailable(), next = dmBonusFor(0.02 * (1 + M.dmBonus + fx.dmBonus), a);
      return a ? `Now: Dark Matter bonus ×${fmt(1 + dmBonusAt(a))} → ×${fmt(1 + next)}` : 'Pays off once you have Dark Matter';
    }
    if (fx.questBonus) return `Now: ${Object.keys(S.quests).length} claimed quests, +${Math.round((fx.questBonus - M.questBonus) * 100 * Object.keys(S.quests).length)}% profit`;
    return '';
  }
  // Tabs open as they become useful, and stay open (anything earned later in the game keeps them open)
  const veteran = () => S.ascensions || S.stones || S.transmutes || S.dmEarnedAll;
  function locked(key) {
    if (key === 'forge' && !level(0) && !golemCount() && !veteran()) return 'open your first mine';
    if (key === 'research' && !veteran() && !researchDone() && !S.arcana && !Object.keys(S.quests).length && !QUESTS.some((m) => m.done()) && !isVisible(LAB))
      return 'opens with your first quest';
    if (key === 'transmute' && !veteran() && S.lifetimeEarned < 1e8) return `opens at ${money(1e8)} earned (${money(S.lifetimeEarned)} so far)`;
    return '';
  }
  // One short card the first time each system matters
  const HINTS = [
    { id: 'golems', when: () => S.cash >= golemCost(0) || golemCount() > 0, tab: 'forge', title: 'Golems', text: 'A golem works a mine for you, forever, and keeps it earning while you’re away. Summon them on the <b>Forge</b> tab.' },
    { id: 'enchant', when: () => upgradesBought() > 0 || (canEnchant(0) && S.cash >= upgradeCost(0)), tab: 'forge', title: 'Enchantments', text: 'Each mine takes 10 enchantments, cast in order: bigger profit and faster cycles. They’re on the <b>Forge</b> tab, below the golems.' },
    { id: 'research', when: () => !locked('research'), tab: 'research', title: 'Quests and research', text: '<b>Quests</b> pay Arcana and add profit for good. The <b>Research Lab</b> brews more Arcana. Spend it on research, which is never lost.' },
    { id: 'milestones', when: () => M.totalLevels >= 600, tab: 'mines', title: 'Level milestones', text: 'Every mine’s levels add up. At 1,000, 2,500, 5,000 and more, <b>all</b> profit doubles. Profit also doubles each time <b>every</b> mine reaches 25, 50, 100 levels and more, so keep your early mines up. The lines above your mines show the next of each.' },
    { id: 'transmute', when: () => !locked('transmute'), tab: 'transmute', title: 'Transmuting', text: `At ${money(earningsForDm(1))} earned you can <b>transmute</b>: your mines and gold melt down into <b>Dark Matter</b>, and each one adds +2% profit to every run after. You rebuild much faster, and you keep research, Arcana and quests.` },
    { id: 'dark-matter', when: () => dmAvailable() > 0, tab: 'transmute', title: 'Dark Matter', text: 'Unspent Dark Matter raises your profit. Upgrades on the Transmute tab are stronger, but spending lowers the bonus, so buy the ones that pay off.' },
    { id: 'ascend', when: () => S.darkMatter >= ASCEND_AT / 2 || S.runes > 0, tab: 'transmute', title: 'Ascension', text: `At ${plain(ASCEND_AT)} Dark Matter you can <b>ascend</b>: a bigger reset that clears Dark Matter too, for <b>Elder Runes</b> that boost profit and Dark Matter for good.` },
    { id: 'trials', when: () => S.ascensions > 0, tab: 'transmute', title: 'Trials', text: 'Each ascension opens a <b>trial</b>: a run with a handicap. Reach its goal anyway and its reward is permanent. They’re optional.' },
    { id: 'crucible', when: () => S.crucibleBuilt || level(CRUCIBLE - 2) > 0, tab: 'opus', title: 'The Prime Crucible', text: 'The 30th mine gathers essence while it stands in your run. Fill it to 100% to forge the Philosopher’s Stone. Essence is never lost.' },
    { id: 'bonuses', when: () => S.playTime > 1800, tab: 'opus', title: 'Daily bonuses', text: 'The <b>daily tribute</b> and the <b>Elixir of Fortune</b> are on the Magnum Opus tab. A red dot there means one is ready.' },
  ];

  return {
    key: 'capitalist',
    name: 'Capitalist',
    emblem: 'coins',
    accent: '#b4a7e0',
    saveKey: 'df_capitalist',
    tabs: TABS,
    tutorial: TUTORIAL,
    introPages: 2,
    locked,
    hints: HINTS,
    get state() {
      return S;
    },
    load(raw) {
      S = migrate(raw);
      refresh();
    },
    fresh() {
      S = newState();
      refresh();
    },
    refresh,
    tick,
    catchUp,
    checkAchievements,
    won: () => S.wonAt > 0,
    actions: ACTIONS,
    panes: PANES,
    badges: TAB_BADGES,
    feedback: FEEDBACK,
    header,
    buildUI,
    onTab,
    renderTab,
    stone,
    titleLine,
    ending,
    deleteNote: 'Erases all Capitalist progress. Industrialist and Communist are not affected.',
  };
})();
