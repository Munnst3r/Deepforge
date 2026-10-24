// ===== Communist: six industries of production chains feeding one another =====
// Everything about this mode's economy lives inside this module. It talks to the shared app only through the object it
// returns at the bottom (see MODE INTERFACE in the app section), so changing it can't affect the other modes.
const Communist = (() => {
  // ===== Industries and their production chains =====
  // Six industries, each with its own material. Inside an industry every producer builds more of the one below it:
  // a Royal Mint builds Assay Guilds, which build Gold Mines, which build Prospector Camps, which build Panners, and
  // Panners pan gold. Buying a producer costs gold, some of the producer below it (they join the new one), and the
  // material of the industry before it, so every material keeps mattering as you climb.
  const INDUSTRIES = [
    { name: 'Gold', color: '#dcc795', icon: 'coins', tiers: ['Panner', 'Prospector Camp', 'Gold Mine', 'Assay Guild', 'Royal Mint', 'Sun Treasury'] },
    { name: 'Copper', color: '#c79c84', icon: 'pickaxe', tiers: ['Copper Miner', 'Smelter', 'Foundry', 'Copper Guild', 'Bronze Colossus'] },
    { name: 'Iron', color: '#a9afba', icon: 'anvil', tiers: ['Iron Miner', 'Bloomery', 'Forgeworks', 'Iron Citadel', 'Titan Forge'] },
    { name: 'Crystal', color: '#b4a7e0', icon: 'gem', tiers: ['Crystal Cutter', 'Geode Grotto', 'Lapidary', 'Crystal Spire', 'Prism Cathedral'] },
    { name: 'Mithril', color: '#a8b8c8', icon: 'shield', tiers: ['Mithril Delver', 'Deep Shaft', 'Dwarven Hall', 'Mithril Throne', 'Undermountain'] },
    { name: 'Aether', color: '#9cc5c0', icon: 'sparkles', tiers: ['Aether Tapper', 'Aether Well', 'Leyline Nexus', 'Aether Font', 'Celestial Loom'] },
  ];
  const IND = INDUSTRIES.length;
  const GOLD = 0, CRYSTAL = 3; // gold is the coin everything is bought with; crystal builds Research Labs
  const TIER_ICONS = [null, 'tent', 'factory', 'castle', 'crown', 'landmark']; // tier 0 uses its industry's icon
  // Each industry's top producer is a work of the Great Work: it can only be built once the Nigredo is complete
  const tierCount = (i) => INDUSTRIES[i].tiers.length - (S.stage >= 1 ? 0 : 1);

  // Prices. Gold prices rise a little with every producer you buy; the producers and materials they use up don't
  const GOLD_TIER_PRICE = [10, 1500, 2.5e5, 4e7, 6e9, 1e12]; // the gold industry's own producers
  const INDUSTRY_PRICE = [0, 400, 3e4, 3e6, 3e8, 3e10]; // other industries: their first producer, ×150 per tier above it
  const TIER_PRICE_STEP = 150;
  const PRICE_GROWTH = [1.07, 1.09, 1.11, 1.13, 1.15, 1.17]; // by tier
  const LOWER_NEEDED = 10; // producers of the tier below used up by each purchase
  // Every-tier milestones: once you've bought this many of every producer in an industry's chain (this run), that
  // industry's output ×1.25 (more with upgrades; sim.js showed ×3 cutting the Great Work to a third of its time). Kept for the run once reached, so a newly opened greatest producer never
  // takes one away. This is what keeps buying the cheap lower producers worthwhile after the chain builds them for you
  const TIER_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];
  // Gold producers above the Panner also need another industry's material: Prospector Camps need Copper, Gold Mines
  // Iron, Assay Guilds Crystal, Royal Mints Mithril
  const GOLD_TIER_MATERIAL = (t) => 15 * 40 ** (t - 1);
  // Every other industry's producers need the previous industry's material: Iron needs Copper, Crystal needs Iron...
  const PREVIOUS_MATERIAL = (t) => 10 * 60 ** t;
  // Output per producer per second: Panners pan 5 gold, other first producers dig 1 of their material, and every
  // higher producer builds 0.2 of the one below it
  const BASE_OUTPUT = (i) => (i === GOLD ? 5 : 1);
  const BUILD_RATE = 0.1;
  // Discovering an industry: [gold, previous industry's material]
  const DISCOVER = [null, [300, 0], [2e4, 400], [2e6, 4e4], [2e8, 4e6], [2e10, 4e8]];

  // What one purchase of producer t in industry i uses up: [[resource, amount]...]. A resource is a material index
  // (0 = gold) or 'u' for the producer below
  function recipe(i, t) {
    const r = [[GOLD, (i === GOLD ? GOLD_TIER_PRICE[t] : INDUSTRY_PRICE[i] * TIER_PRICE_STEP ** t) * M.price]];
    if (t > 0) r.push(['u', LOWER_NEEDED]);
    if (i === GOLD && t > 0) r.push([t, GOLD_TIER_MATERIAL(t)]);
    if (i > 1) r.push([i - 1, PREVIOUS_MATERIAL(t)]);
    return r;
  }

  // ===== Enchantments: ten per industry (fifteen once the Albedo is complete), each ×3 to that industry's output =====
  // They combine materials: gold, the industry's own material and a second one. The gold industry's enchantments
  // each need a rarer material than the last, so they pull every industry along
  const ENCHANT_NAMES = [
    ['Gilded Pans', 'Copper Sluices', 'Iron Rockers', 'Crystal Sieves', 'Mithril Dredges', 'Aether Lodestones', 'Midas Wells', 'Sunken Hoards', 'Dragon Tithes', 'Golden Age', 'White Gold', 'Sunlit Vaults', 'Crown of Ingots', 'Endless Tithe', 'Gold of the Sun'],
    ['Tempered Picks', 'Bronze Bellows', 'Ore Carts', 'Hot Crucibles', 'Copper Lattices', 'Verdigris Wards', 'Singing Wire', 'Bronze Colossi', 'Flamewalker Kilns', 'Heart of Copper', 'Pale Bronze', 'Venus Mirrors', 'Bell of Ages', 'Copper Sky', 'Soul of Copper'],
    ['Steel Wedges', 'Blast Furnaces', 'Rolling Mills', 'Quench Pools', 'Damascus Folds', 'Lodestone Rails', 'Star-iron Anvils', 'Titan Bellows', 'Thunder Forges', 'Heart of Iron', 'White Steel', 'Mars Anvils', 'Meteor Iron', 'Iron Tide', 'Soul of Iron'],
    ['Diamond Saws', 'Prism Lenses', 'Resonant Chimes', 'Geode Maps', 'Faceting Wheels', 'Starlit Facets', 'Echoing Caves', 'Rainbow Seams', 'Living Crystal', 'Heart of Crystal', 'Clear Light', 'Moon Lenses', 'Singing Geodes', 'Crystal Choir', 'Soul of Crystal'],
    ['Dwarven Lanterns', 'Deep Lifts', 'Rune Hammers', 'Moonlit Forges', 'True-silver Veins', 'Mountain Hearts', 'Elder Delves', 'Ancestor Halls', 'Rootstone Gates', 'Heart of Mithril', 'Silver Dawn', 'Star Halls', 'Mountain King', 'Deep Song', 'Soul of Mithril'],
    ['Ley Lines', 'Mist Condensers', 'Spirit Wells', 'Storm Jars', 'Sky Anchors', 'Quintessence', 'Comet Glass', 'Dawn Chalices', 'World Breath', 'Heart of Aether', 'White Wind', 'Star Wells', 'Sky Loom', 'Breath of Ages', 'Soul of Aether'],
  ];
  const ENCHANTS_PER = 10;
  const enchantMax = () => ENCHANTS_PER + (S.stage >= 2 ? 5 : 0); // the Albedo opens five more
  const ENCHANT_MULT = 3;
  const ENCHANT_STEP = 1e3; // each enchantment costs ×1,000 the one before
  function enchantRecipe(i, k) {
    const r = [[GOLD, 50 * Math.max(10, INDUSTRY_PRICE[i]) * ENCHANT_STEP ** k]];
    if (i !== GOLD) r.push([i, 100 * ENCHANT_STEP ** k]);
    const other = i === GOLD ? Math.min(IND - 1, (k % 5) + 1) : i - 1;
    if (other !== GOLD) r.push([other, 50 * ENCHANT_STEP ** k]);
    return r;
  }

  // ===== Research (paid in Arcana), Dark Matter upgrades =====
  // Effects (fx): out (every industry's output), ind (one industry's output: [index, ×]; ind3 for several), build (how fast producers
  // build the tier below), price (gold prices), arcana, dmBonus, questBonus, offline
  const RESEARCH = [
    ['gilded-assays', 'Gilded Assays', 'Gold ×3', 40, { ind: [0, 3] }],
    ['copper-assays', 'Copper Assays', 'Copper ×3', 150, { ind: [1, 3] }],
    ['swift-haulers', 'Swift Haulers', 'Every producer builds 25% faster', 600, { build: 1.25 }],
    ['bulk-contracts', 'Bulk Contracts', 'Gold prices 15% lower', 2e3, { price: 0.85 }],
    ['iron-discipline', 'Iron Discipline', 'Iron ×3', 7e3, { ind: [2, 3] }],
    ['tireless-runes', 'Tireless Runes', 'Offline production 50% → 100%', 2.5e4, { offline: 1 }],
    ['lens-grinding', 'Lens Grinding', 'Crystal ×3', 8e4, { ind: [3, 3] }],
    ['athanor-furnace', 'Athanor Furnace', 'Research Labs ×2 Arcana', 2.5e5, { arcana: 2 }],
    ['questing-guild', 'Questing Guild', 'Quests give +8% output each', 8e5, { questBonus: 0.08 }],
    ['deep-rails', 'Deep Rails', 'Every producer builds 50% faster', 2.5e6, { build: 1.5 }],
    ['mithril-smithing', 'Mithril Smithing', 'Mithril ×3', 8e6, { ind: [4, 3] }],
    ['theory-of-transmutation', 'Theory of Transmutation', 'Dark Matter bonus +50%', 2.5e7, { dmBonus: 0.5 }],
    ['aether-siphons', 'Aether Siphons', 'Aether ×3', 8e7, { ind: [5, 3] }],
    ['philosophers-salt', "Philosopher's Salt", 'Every industry ×3', 2.5e8, { out: 3 }],
    ['central-planning', 'Central Planning', "Plans' boosts are twice as strong", 8e8, { planPower: 2 }],
    ['clockwork-crews', 'Clockwork Crews', 'Every producer builds 50% faster', 2.5e9, { build: 1.5 }],
    ['assayers-ledger', "Assayer's Ledger", 'Gold prices 20% lower', 8e9, { price: 0.8 }],
    ['shock-brigades', 'Shock Brigades', 'Every-tier milestones give ×1.5 instead of ×1.25', 1.5e10, { tierPower: 1.5 }],
    ['emerald-tablet', 'Emerald Tablet', 'Every industry ×4', 2.5e10, { out: 4 }],
    ['grand-grimoire', 'Grand Grimoire', 'Research Labs ×3 Arcana', 8e10, { arcana: 3 }],
    ['votive-vessels', 'Votive Vessels', 'Offerings to the crucible count ×2', 2.5e11, { offer: 2 }],
    ['dragonfire-smelting', 'Dragonfire Smelting', 'Copper, Iron and Mithril ×5', 8e11, { ind3: [[1, 5], [2, 5], [4, 5]] }],
    ['elemental-winds', 'Elemental Winds', 'Every producer builds 50% faster', 2.5e12, { build: 1.5 }],
    ['starlit-geodes', 'Starlit Geodes', 'Crystal and Aether ×5', 8e12, { ind3: [[3, 5], [5, 5]] }],
    ['prima-materia', 'Prima Materia', 'Every industry ×5', 2.5e13, { out: 5 }],
    ['dark-distillery', 'Dark Distillery', 'Dark Matter bonus +67%', 8e13, { dmBonus: 0.67 }],
    ['clockwork-of-ages', 'Clockwork of Ages', 'Every industry ×8', 2.5e14, { out: 8 }],
    ['hero-of-labor', 'Heroes of Labor', 'Every-tier milestones give ×2 instead of ×1.25', 5e14, { tierPower: 2 }],
    ['hermetic-seals', 'Hermetic Seals', 'Offerings to the crucible count ×2 again', 8e14, { offer: 2 }],
    ['world-engine', 'The World Engine', 'Every producer builds 2× faster', 2.5e15, { build: 2 }],
    ['quintessence', 'The Quintessence', 'Every industry ×10', 8e15, { out: 10 }],
    ['alkahest', 'The Alkahest', 'Every industry ×12', 2.5e16, { out: 12 }],
  ].map(upgradeDef);
  // Paid in Dark Matter. Spending Dark Matter lowers its bonus
  const DM_UPGRADES = [
    ['dark-surge', 'Dark Surge', 'Every industry ×2', 5, { out: 2 }],
    ['shadow-crews', 'Shadow Crews', 'Every producer builds 50% faster', 100, { build: 1.5 }],
    ['void-bargains', 'Void Bargains', 'Gold prices 20% lower', 2e3, { price: 0.8 }],
    ['umbral-seal', 'Umbral Seal', 'Every industry ×3', 4e4, { out: 3 }],
    ['deep-vault-labs', 'Deep Vault Labs', 'Research Labs ×2 Arcana', 8e5, { arcana: 2 }],
    ['midas-touch', 'Midas Touch', 'Gold ×10', 1.6e7, { ind: [0, 10] }],
    ['black-salt', 'Black Salt', 'Every industry ×5', 3e8, { out: 5 }],
    ['red-banners', 'Red Banners', 'Every-tier milestones give ×1.75 instead of ×1.25', 1.5e9, { tierPower: 1.75 }],
    ['void-pulse', 'Void Pulse', 'Every producer builds 50% faster', 6e9, { build: 1.5 }],
    ['dark-bloom', 'Dark Bloom', 'Every industry ×8', 1.2e11, { out: 8 }],
    ['abyssal-labs', 'Abyssal Labs', 'Research Labs ×3 Arcana', 2.5e12, { arcana: 3 }],
  ].map(upgradeDef);

  // ===== Research Lab: built with gold and Crystal, brews Arcana =====
  const LAB_PRICE = [5e4, 200]; // [gold, Crystal] for the first lab
  const LAB_GROWTH = 1.15;
  const LAB_OUTPUT = 0.5; // Arcana per lab per second

  // ===== End goal: the Great Work, four stages of three steps =====
  // Offer every material to the Prime Crucible. Each step needs more than the last; completing one makes every industry
  // ×1.5 for good, and completing a whole stage unlocks something new (see STAGE_UNLOCKS). Completing Rubedo forges the
  // Philosopher's Stone. The Stone on the Magnum Opus tab takes each stage's color as you go: black, white, yellow, red
  const STAGES = [
    { name: 'Nigredo', what: 'the blackening', color: '#8f8599', goal: [1e10, 1e14, 1e13, 3e11, 0, 0] },
    { name: 'Albedo', what: 'the whitening', color: '#e2e4ea', goal: [1e21, 1e26, 1e26, 1e25, 1e25, 1e25] },
    { name: 'Citrinitas', what: 'the yellowing', color: '#dcc795', goal: [1e34, 3e34, 3e34, 1e34, 1e34, 1e34] },
    { name: 'Rubedo', what: 'the reddening', color: '#d98f98', goal: [5e47, 5e45, 5e45, 1.5e45, 1.5e45, 1.5e45] },
  ];
  const STEPS = 3; // per stage
  const STEP_BONUS = 1.5;
  const STAGE_UNLOCKS = [
    "Each industry's greatest producer can be built, and two new plans",
    'Five more enchantments for every industry',
    'Two final plans: Shock Work and Great Devotion',
  ];

  // ===== Plans: each run follows one plan, chosen when you transmute =====
  // A plan pushes some industries hard at the cost of others, so each run can aim at what you need most: gold for Dark
  // Matter, or the materials the crucible is short of. ind: [×, ×, ×, ×, ×, ×] per industry; unlock: when it can be chosen
  const PLAN_BOOST = 5, PLAN_CUT = 0.5;
  const PLANS = [
    { id: 'balanced', name: 'Balanced Plan', boost: [], cut: [], unlock: () => true },
    { id: 'gold-rush', name: 'Gold Rush', boost: [0], cut: [1, 2, 3, 4, 5], unlock: () => S.transmutes >= 1 },
    { id: 'heavy-industry', name: 'Heavy Industry', boost: [1, 2], cut: [0], unlock: () => S.transmutes >= 1 },
    { id: 'crystal-doctrine', name: 'Crystal Doctrine', boost: [3], cut: [0], arcana: 3, unlock: () => S.stage >= 1 },
    { id: 'deep-delving', name: 'Deep Delving', boost: [4, 5], cut: [1, 2], unlock: () => S.stage >= 1 },
    { id: 'shock-work', name: 'Shock Work', boost: [], cut: [0, 1, 2, 3, 4, 5], build: 1.5, unlock: () => S.stage >= 3 },
    { id: 'devotion', name: 'Great Devotion', boost: [], cut: [0, 1, 2, 3, 4, 5], offer: 4, unlock: () => S.stage >= 3 },
  ];
  // "Copper and Iron ×5 · Gold ×0.5"
  function planDesc(x) {
    const names = (list) => (list.length === IND ? 'every industry' : list.length === IND - 1 ? 'every other industry' : list.map(resName).join(' and '));
    const parts = [];
    if (x.boost.length) parts.push(`${names(x.boost)} ×${PLAN_BOOST * (M.planPower || 1)}`);
    if (x.arcana) parts.push(`Research Labs ×${x.arcana} Arcana`);
    if (x.build) parts.push(`every producer builds ${x.build}× faster`);
    if (x.offer) parts.push(`offerings count ×${x.offer}`);
    const up = parts.join(' and ');
    const down = x.cut.length ? `${names(x.cut)} ×${PLAN_CUT}` : '';
    const text = [up, down].filter(Boolean).join(' · ') || 'every industry at its normal output';
    return text[0].toUpperCase() + text.slice(1);
  }
  const planOf = (id) => PLANS.find((x) => x.id === id) || PLANS[0];

  // ===== Bonuses =====
  const HOUR = 3600e3;
  const DAILY_HOURS = 6; // the daily tribute pays this many hours of gold
  const DAILY_COOLDOWN = 20 * HOUR;
  const BOOST_LENGTH = 0.5 * HOUR;
  const BOOST_COOLDOWN = 6 * HOUR;
  const BOOST_POWER = 3;

  // ===== Quests (reward Arcana; each claimed quest adds +5% output) =====
  // [id, name, Arcana reward, current value, target]. A quest is done when the value reaches the target
  const QUESTS = [
    ['panners-10', 'Own 10 Panners', 5, () => owned(0, 0), 10],
    ['discover-copper', 'Discover Copper', 10, () => S.open[1], 1],
    ['camp-1', 'Build a Prospector Camp', 20, () => owned(0, 1), 1],
    ['copper-miners-25', 'Own 25 Copper Miners', 30, () => owned(1, 0), 25],
    ['smelter-1', 'Build a Smelter', 50, () => owned(1, 1), 1],
    ['discover-iron', 'Discover Iron', 100, () => S.open[2], 1],
    ['copper-10k', 'Hold 10K Copper', 150, () => S.res[1], 1e4],
    ['gold-mine-1', 'Build a Gold Mine', 300, () => owned(0, 2), 1],
    ['enchant-3', 'Cast 3 enchantments', 500, () => enchantsCast(), 3],
    ['discover-crystal', 'Discover Crystal', 800, () => S.open[3], 1],
    ['lab-1', 'Build a Research Lab', 1e3, () => S.labs, 1],
    ['iron-miners-100', 'Own 100 Iron Miners', 3e3, () => owned(2, 0), 100],
    ['transmute-1', 'Transmute once', 5e3, () => S.transmutes, 1],
    ['assay-guild-1', 'Build an Assay Guild', 1e4, () => owned(0, 3), 1],
    ['lapidary-1', 'Build a Lapidary', 3e4, () => owned(3, 2), 1],
    ['discover-mithril', 'Discover Mithril', 6e4, () => S.open[4], 1],
    ['enchant-12', 'Cast 12 enchantments', 1e5, () => enchantsCast(), 12],
    ['earn-1e15', 'Earn ₲1Qa in total', 3e5, () => S.totalEarned, 1e15],
    ['discover-aether', 'Discover Aether', 1e6, () => S.open[5], 1],
    ['royal-mint-1', 'Build a Royal Mint', 3e6, () => owned(0, 4), 1],
    ['nigredo', 'Complete the Nigredo', 1e7, () => S.stage, 1],
    ['enchant-24', 'Cast 24 enchantments', 3e7, () => enchantsCast(), 24],
    ['aether-font-1', 'Build an Aether Font', 1e8, () => owned(5, 3), 1],
    ['transmute-10', 'Transmute 10 times', 3e8, () => S.transmutes, 10],
    ['dm-1000', 'Earn 1,000 Dark Matter', 1e9, () => S.darkMatter, 1e3],
    ['enchant-all', 'Cast 60 enchantments in one run', 3e9, () => enchantsCast(), IND * ENCHANTS_PER],
    ['citrinitas', 'Complete the Citrinitas', 1e13, () => S.stage, 3],
    ['plan-1', 'Transmute into a plan other than Balanced', 2e4, () => +(S.plan !== 'balanced'), 1],
    ['sun-treasury-1', 'Raise a Sun Treasury', 5e6, () => owned(0, 5), 1],
    ['greatest-all', "Raise every industry's greatest producer", 3e7, () => INDUSTRIES.filter((d, i) => owned(i, d.tiers.length - 1) >= 1).length, IND],
    ['albedo', 'Complete the Albedo', 3e9, () => S.stage, 2],
    ['labs-250', 'Run 250 Research Labs', 1e11, () => S.labs, 250],
    ['dm-1e9', 'Earn 1B Dark Matter', 5e11, () => S.darkMatter, 1e9],
    ['research-25', 'Complete 25 research', 2e13, () => researchDone(), 25],
    ['steps-10', 'Complete 10 steps of the Great Work', 5e13, () => stepsDone(), 10],
    ['enchant-75', 'Cast 75 enchantments in one run', 1e14, () => enchantsCast(), 75],
    ['labs-600', 'Run 600 Research Labs', 2e14, () => S.labs, 600],
    ['dm-1e12', 'Earn 1T Dark Matter', 3e14, () => S.darkMatter, 1e12],
    ['enchant-90', 'Cast all 90 enchantments in one run', 5e14, () => enchantsCast(), 90],
    ['research-30', 'Complete every research', 1e15, () => researchDone(), RESEARCH.length],
  ].map(questDef);

  // ===== Achievements (+1% output each) =====
  const ACHIEVEMENTS = [];
  INDUSTRIES.forEach((d, i) => {
    const top = d.tiers.length - 1;
    ACHIEVEMENTS.push({ id: 'crew-' + i, name: d.name + ' Crew', desc: 'Own 100 ' + plural(d.tiers[0]), done: () => owned(i, 0) >= 100 });
    ACHIEVEMENTS.push({ id: 'baron-' + i, name: d.name + ' Baron', desc: 'Build a ' + d.tiers[top - 1], done: () => owned(i, top - 1) >= 1 });
    ACHIEVEMENTS.push({ id: 'magnate-' + i, name: d.name + ' Magnate', desc: 'Raise a ' + d.tiers[top], done: () => owned(i, top) >= 1 });
  });
  achievementTiers(ACHIEVEMENTS, [1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e30, 1e40], 'hoarder', (v) => 'Hoarder ₲' + plain(v), (v) => 'Earn ₲' + plain(v) + ' in total', (v) => S.totalEarned >= v);
  achievementTiers(ACHIEVEMENTS, [10, 30, 60, 90], 'enchanter', (v) => 'Enchanter ' + v, (v) => 'Cast ' + v + ' enchantments in one run', (v) => enchantsCast() >= v);
  achievementTiers(ACHIEVEMENTS, [1, 5, 10, 25], 'transmuter', (v) => 'Transmuter ' + v, (v) => 'Transmute ' + times(v), (v) => S.transmutes >= v);
  achievementTiers(ACHIEVEMENTS, [10, 100, 1000, 10000, 1e6, 1e9, 1e12], 'dark-hoard', (v) => 'Dark Hoard ' + plain(v), (v) => 'Earn ' + plain(v) + ' Dark Matter', (v) => S.darkMatter >= v);
  achievementTiers(ACHIEVEMENTS, [100, 1000, 10000], 'prospector', (v) => 'Prospector ' + plain(v), (v) => 'Pan by hand ' + plain(v) + ' times', (v) => S.taps >= v);
  achievementTiers(ACHIEVEMENTS, [1, 10, 100], 'devoted', (v) => 'Devoted ' + v + 'h', (v) => 'Play for ' + v + (v > 1 ? ' hours' : ' hour'), (v) => S.playTime >= v * 3600);
  achievementTiers(ACHIEVEMENTS, [5, 10, RESEARCH.length], 'scholar', (v) => 'Scholar ' + v, (v) => 'Complete ' + v + ' research', (v) => researchDone() >= v);
  achievementTiers(ACHIEVEMENTS, [5, 25, 100, 250, 600], 'lab-keeper', (v) => 'Lab Keeper ' + v, (v) => 'Run ' + v + ' Research Labs', (v) => S.labs >= v);
  achievementTiers(ACHIEVEMENTS, [3, 5, PLANS.length], 'planner', (v) => 'Planner ' + v, (v) => 'Follow ' + v + ' different plans', (v) => Object.keys(S.plansUsed).length >= v);
  STAGES.slice(0, -1).forEach((st, k) => ACHIEVEMENTS.push({ id: 'stage-' + k, name: st.name, desc: 'Complete ' + st.what, done: () => S.stage > k }));
  ACHIEVEMENTS.push({ id: 'great-work', name: 'The Great Work', desc: "Forge the Philosopher's Stone", done: () => S.wonAt > 0 });
  ACHIEVEMENTS.push({ id: 'second-stone', name: 'The Work Again', desc: "Forge a second Philosopher's Stone", done: () => S.stones + (S.wonAt ? 1 : 0) >= 2 });

  // ===== Tabs (in tab-bar order; swiping moves through them in this order) =====
  const TABS = [
    { key: 'works', name: 'Works', icon: 'mountain', color: '#d6c4a0', desc: 'Build each industry’s chain. Every producer builds the one below it.' },
    { key: 'forge', name: 'Forge', icon: 'hammer', color: '#c9a088', desc: 'Enchantments triple one industry’s output each.' },
    { key: 'research', name: 'Research', icon: 'flask', color: '#93c4bd', desc: 'Quests and Research Labs make Arcana; research lasts for good.' },
    { key: 'transmute', name: 'Transmute', icon: 'spiral', color: '#a99ad8', desc: 'Melt your run into Dark Matter and choose the next plan.' },
    { key: 'opus', name: 'Magnum Opus', icon: 'opus', color: '#d9a6b1', desc: 'The Great Work, your daily bonuses, stats and achievements.' },
  ];
  const BUY_MODES = [1, 10, 100, 'max'];

  // ===== Save data =====
  const grid = () => INDUSTRIES.map((d) => Array(d.tiers.length).fill(0));
  function newState() {
    return {
      v: 1,
      res: [10, 0, 0, 0, 0, 0], // gold and the five materials on hand (enough gold for a first Panner)
      units: grid(), // producers owned (fractions build up between whole ones)
      bought: grid(), // producers bought this run (raises their gold price)
      tierMs: Array(IND).fill(0), // every-tier milestones reached this run, per industry
      open: [1, 0, 0, 0, 0, 0], // discovered industries
      enchants: Array(IND).fill(0), // enchantments cast per industry, in order
      labs: 0,
      arcana: 0,
      runEarned: 0, // gold earned this run
      totalEarned: 0, // gold earned ever (Dark Matter is based on this)
      research: {},
      quests: {},
      achievements: {},
      darkMatter: 0, // earned ever, including spent
      dmSpent: 0,
      dmUpgrades: {},
      transmutes: 0,
      offered: Array(IND).fill(0), // given to the Prime Crucible for the current step, kept forever
      stage: 0, // stages of the Great Work completed
      step: 0, // steps of the current stage completed
      plan: 'balanced', // this run's plan
      plansUsed: {}, // every plan ever followed
      nextPlan: 'balanced', // the plan the next transmutation starts
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
  // What survives transmuting; everything else returns to its starting value
  const KEEP_ON_RESET = [
    'arcana', 'research', 'quests', 'achievements', 'darkMatter', 'dmSpent', 'dmUpgrades', 'transmutes', 'offered', 'stage', 'step', 'wonAt', 'stones', 'bestWork', 'workStart', 'nextPlan', 'plansUsed',
    'taps', 'playTime', 'bestIncome', 'totalEarned', 'dailyReadyAt', 'boostReadyAt', 'boostEndsAt',
  ];
  // Loads a save (or an imported save code), filling in anything missing so a damaged save still plays
  function migrate(raw) {
    const s = mergeSave(newState(), raw);
    s.open[GOLD] = 1;
    s.step = Math.min(STEPS - 1, Math.floor(s.step));
    s.stage = Math.min(STAGES.length, Math.floor(s.stage));
    if (s.stage >= STAGES.length && !s.wonAt) s.wonAt = Math.max(1, s.playTime);
    s.enchants = s.enchants.map((n) => Math.max(0, Math.min(15, Math.floor(n))));
    for (const k of ['plan', 'nextPlan']) if (!PLANS.some((x) => x.id === s[k])) s[k] = 'balanced';
    return s;
  }

  // ===== Game state and modifiers =====
  let S = newState();
  let M = {}; // modifiers and totals, rebuilt by refresh() once per tick and after every action
  let industry = GOLD; // which industry the Works tab shows
  let buyMode = 1;
  let lastPan = 0;

  const owned = (i, t) => Math.floor(S.units[i][t] + 1e-9);
  const enchantsCast = () => S.enchants.reduce((a, b) => a + b, 0);
  const researchDone = () => Object.keys(S.research).length;
  const dmAvailable = () => Math.max(0, S.darkMatter - S.dmSpent);
  // Spends an amount of a resource (a material, or 'u' for producers of tier t-1). Prices are checked with a hair of
  // tolerance for rounding, so the result is clamped: nothing is ever left at a tiny negative amount
  function take(r, a, i, t) {
    if (r === 'u') S.units[i][t - 1] = Math.max(0, S.units[i][t - 1] - a);
    else S.res[r] = Math.max(0, S.res[r] - a);
  }
  const resName = (r) => INDUSTRIES[r].name;
  // How much of material i the current stage needs, and how full the stage is overall (0 to 1)
  // A step's goal sits between the previous stage's goal and this stage's, measured in orders of magnitude: the first
  // step comes a quarter of the way there, the second 60%, the third is the stage's own goal
  const STEP_SHARE = [0.25, 0.6, 1];
  function stageGoal(i) {
    const k = Math.min(S.stage, STAGES.length - 1), end = STAGES[k].goal[i];
    if (!end) return 0;
    const start = (k && STAGES[k - 1].goal[i]) || end / 1e4, f = STEP_SHARE[Math.min(S.step, STEPS - 1)];
    return start ** (1 - f) * end ** f;
  }
  const stepsDone = () => S.stage * STEPS + S.step;
  const needed = () => INDUSTRIES.map((d, i) => i).filter((i) => stageGoal(i) > 0); // a stage may not need every material
  const crucibleFraction = () => (S.wonAt ? 1 : needed().reduce((a, i) => a + Math.min(1, S.offered[i] / stageGoal(i)), 0) / needed().length);

  function refresh(now = Date.now()) {
    const m = { out: 1, ind: Array(IND).fill(1), build: 1, price: 1, arcana: 1, offer: 1, planPower: 1, dmBonus: 0, questBonus: 0.05, offline: 0.5, tierPower: 1.25 };
    for (const [list, have] of [[RESEARCH, S.research], [DM_UPGRADES, S.dmUpgrades]])
      for (const u of list)
        if (have[u.id])
          for (const [k, v] of Object.entries(u.fx)) {
            if (k === 'ind') m.ind[v[0]] *= v[1];
            else if (k === 'ind3') v.forEach(([i, x]) => (m.ind[i] *= x));
            else if (k === 'dmBonus') m.dmBonus += v;
            else if (k === 'questBonus' || k === 'offline' || k === 'tierPower') m[k] = Math.max(m[k], v);
            else m[k] *= v;
          }
    // this run's plan: its boosts are stronger with Central Planning; its cuts stay the same
    const plan = planOf(S.plan);
    plan.boost.forEach((i) => (m.ind[i] *= PLAN_BOOST * m.planPower));
    plan.cut.forEach((i) => (m.ind[i] *= PLAN_CUT));
    m.build *= plan.build || 1;
    m.arcana *= plan.arcana || 1;
    m.offer *= plan.offer || 1;
    m.dmPer = 0.02 * (1 + m.dmBonus); // output per Dark Matter, up to 1,000
    M = m;
    for (let i = 0; i < IND; i++) tierMilestoneCheck(i);
    m.boosted = now < S.boostEndsAt;
    m.all =
      m.out *
      (1 + dmBonusAt(dmAvailable())) *
      (1 + m.questBonus * Object.keys(S.quests).length) *
      (1 + 0.01 * Object.keys(S.achievements).length) *
      STEP_BONUS ** stepsDone() *
      (m.boosted ? BOOST_POWER : 1) *
      STONE_POWER ** S.stones *
      resonance('communist');
    // output per second of each industry's material, and of each producer below the top
    m.rate = INDUSTRIES.map((d, i) => (S.open[i] ? S.units[i][0] * BASE_OUTPUT(i) * industryMult(i) : 0));
    m.labRate = S.labs * LAB_OUTPUT * m.arcana * (1 + m.rate[CRYSTAL]) ** 0.2; // labs study the crystal you cut: more crystal, more Arcana
  }

  // ===== Economy =====
  const dmBonusAt = (n) => dmBonusFor(M.dmPer, n);
  const industryMult = (i) => ENCHANT_MULT ** S.enchants[i] * M.tierPower ** S.tierMs[i] * M.ind[i] * M.all;
  // The producer of industry i bought the fewest times this run (the one holding its next every-tier milestone back)
  function tierWeakest(i) {
    let lo = 0;
    for (let t = 1; t < tierCount(i); t++) if (S.bought[i][t] < S.bought[i][lo]) lo = t;
    return lo;
  }
  // Returns how many milestones this call reached (they stay for the run)
  function tierMilestoneCheck(i) {
    if (!S.open[i]) return 0;
    const lo = S.bought[i][tierWeakest(i)];
    let got = 0;
    while (S.tierMs[i] < TIER_MILESTONES.length && lo >= TIER_MILESTONES[S.tierMs[i]]) S.tierMs[i]++, got++;
    return got;
  }
  // Producers per second that tier t of industry i is building of tier t-1
  const buildRate = (i, t) => S.units[i][t] * BUILD_RATE * M.build;
  // Price of k more of producer t: the gold part rises with each one bought; the rest is the same every time
  function priceOf(i, t, k) {
    const g = PRICE_GROWTH[t], b = S.bought[i][t];
    return recipe(i, t).map(([r, a], n) => [r, n === 0 ? (a * g ** b * (g ** k - 1)) / (g - 1) : a * k]);
  }
  // What the player has of a recipe's resource: a material, or ('u') producers of the tier below
  function have(i, t, r) {
    return r === 'u' ? S.units[i][t - 1] : S.res[r];
  }
  // How many of producer t the player can afford right now
  function maxAffordable(i, t) {
    const g = PRICE_GROWTH[t], b = S.bought[i][t];
    let n = Infinity;
    for (const [r, a] of recipe(i, t)) {
      if (r === GOLD) n = Math.min(n, Math.floor(Math.log((S.res[GOLD] * (g - 1)) / (a * g ** b) + 1) / Math.log(g)));
      else n = Math.min(n, Math.floor(have(i, t, r) / a + 1e-9));
    }
    return Math.max(0, n);
  }
  const canAfford = (list, i, t) => list.every(([r, a]) => have(i, t, r) >= a * (1 - 1e-9));
  function buyAmount(i, t) {
    return buyMode === 'max' ? Math.max(1, maxAffordable(i, t)) : buyMode;
  }
  const canDiscover = (i) => i < IND && !S.open[i] && S.open[i - 1] && S.res[GOLD] >= DISCOVER[i][0] && S.res[i - 1] >= DISCOVER[i][1];
  const nextDiscovery = () => S.open.indexOf(0);
  const labPrice = () => [LAB_PRICE[0] * M.price, LAB_PRICE[1]].map((p) => p * LAB_GROWTH ** S.labs);
  const canBuyLab = () => S.open[CRYSTAL] && S.res[GOLD] >= labPrice()[0] && S.res[CRYSTAL] >= labPrice()[1];
  const nextEnchant = (i) => (S.enchants[i] < enchantMax() ? enchantRecipe(i, S.enchants[i]) : null);
  const canEnchant = (i) => S.open[i] && nextEnchant(i) && nextEnchant(i).every(([r, a]) => S.res[r] >= a);

  // Transmuting: total Dark Matter grows with the cube root of all the gold you've ever earned (₲5B for the first)
  const DM_SCALE = 5e9;
  const dmFor = (gold) => Math.floor(Math.cbrt(gold / DM_SCALE));
  const goldForDm = (n) => DM_SCALE * n ** 3;
  const transmuteReward = () => Math.max(0, dmFor(S.totalEarned) - S.darkMatter);
  const goodTransmute = () => {
    const p = transmuteReward();
    return p >= 3 && (!S.darkMatter || p >= S.darkMatter);
  };

  const xmult = (n) => (n < 1e5 ? plain(n) : fmt(n)); // ×3, ×81, ×6,561, then ×1.2M
  // The next every-tier milestone of an industry, under its output line on the Works tab
  function tierMilestoneLine(i) {
    const n = S.tierMs[i], goal = TIER_MILESTONES[n], lo = tierWeakest(i), so = n ? ` · ×${xmult(M.tierPower ** n)} so far` : '';
    if (!goal) return `<small class="allms">Every every-tier milestone reached: <b>×${xmult(M.tierPower ** n)} ${INDUSTRIES[i].name}</b></small>`;
    return `<small class="allms">Buy ${plain(goal)} of every producer: <b>${INDUSTRIES[i].name} ×${M.tierPower}</b> <i>(fewest: ${plural(INDUSTRIES[i].tiers[lo])} ${plain(S.bought[i][lo])}${so})</i></small>`;
  }

  // ===== Simulation: advance everything by dt seconds (also used for offline time) =====
  function step(dt) {
    for (let i = 0; i < IND; i++) {
      if (!S.open[i]) continue;
      const u = S.units[i];
      // top tier first, so each tier's new producers start working on the next step
      for (let t = 1; t < u.length; t++) u[t - 1] += buildRate(i, t) * dt;
      const made = M.rate[i] * dt;
      S.res[i] += made;
      if (i === GOLD) {
        S.runEarned += made;
        S.totalEarned += made;
      }
    }
    S.arcana += M.labRate * dt;
  }
  // Offline: everything keeps producing at the offline rate, in small steps so the chains build up as they would live.
  // The elixir only counts for the time it had left. Returns what was made, for the welcome-back summary
  function catchUp(seconds) {
    const before = S.res.slice(), arcana = S.arcana;
    const boosted = clamp01((S.boostEndsAt - S.savedAt) / 1000 / seconds) * seconds;
    const run = (secs, at) => {
      const n = Math.min(400, Math.max(1, Math.ceil(secs / 30)));
      for (let k = 0; k < n; k++) {
        refresh(at);
        step((secs / n) * M.offline);
      }
    };
    if (boosted > 0) run(boosted, S.savedAt);
    run(seconds - boosted, Date.now());
    return [
      ...INDUSTRIES.map((d, i) => ({ name: d.name, icon: d.icon, color: d.color, amount: S.res[i] - before[i], format: i === GOLD ? money : fmt })),
      { name: 'Arcana', icon: 'flask', color: ARCANA_COLOR, amount: S.arcana - arcana, format: count },
    ].filter((g) => g.amount > 0);
  }
  function checkAchievements() {
    if (claimAchievements(ACHIEVEMENTS, S.achievements, 'output')) refresh();
  }

  // Pour what's on hand into the crucible (never more than it still needs)
  function offer(i) {
    const give = Math.min(S.res[i], Math.max(0, stageGoal(i) - S.offered[i]) / M.offer);
    if (give <= 0) return 0;
    S.res[i] -= give;
    S.offered[i] = Math.min(stageGoal(i), S.offered[i] + give * M.offer);
    return give;
  }

  // ===== Player actions. Every button carries data-a (action) and data-i (index or id); shared ones live in the app =====
  const ACTIONS = {
    mode: (v) => (buyMode = isNaN(+v) ? v : +v),
    industry(v) {
      industry = +v;
      view.scrollTop = 0;
    },
    // panning by hand: a quarter second of your gold, never less than ₲5. Taps faster than ten a second don't count,
    // so an auto-clicker can't outrun the chains
    pan() {
      const now = Date.now();
      if (now - lastPan < 100) return;
      lastPan = now;
      S.taps++;
      const g = Math.max(5, M.rate[GOLD] / (M.boosted ? BOOST_POWER : 1) / 4);
      S.res[GOLD] += g;
      S.runEarned += g;
      S.totalEarned += g;
    },
    buy(v) {
      const [i, t] = v.split('.').map(Number), k = buyMode === 'max' ? maxAffordable(i, t) : buyMode;
      if (!S.open[i] || !(t < tierCount(i)) || k < 1) return;
      const price = priceOf(i, t, k);
      if (!canAfford(price, i, t)) return;
      for (const [r, a] of price) take(r, a, i, t);
      S.units[i][t] += k;
      S.bought[i][t] += k;
      const got = tierMilestoneCheck(i);
      if (got) toast(`Every ${INDUSTRIES[i].name} producer bought ${plain(TIER_MILESTONES[S.tierMs[i] - 1])}×: ${INDUSTRIES[i].name} ×${xmult(M.tierPower ** got)}`);
    },
    discover(v) {
      const i = +v;
      if (!canDiscover(i)) return;
      take(GOLD, DISCOVER[i][0]);
      take(i - 1, DISCOVER[i][1]);
      S.open[i] = 1;
      industry = i;
      toast(`Discovered ${INDUSTRIES[i].name}! Its producers are on the Works tab.`);
    },
    enchant(v) {
      const i = +v;
      if (!canEnchant(i)) return;
      for (const [r, a] of nextEnchant(i)) take(r, a);
      toast(`${ENCHANT_NAMES[i][S.enchants[i]]}: ${INDUSTRIES[i].name} ×${ENCHANT_MULT}`);
      S.enchants[i]++;
    },
    enchantAll() {
      let n = 0;
      for (let pass = 0; pass < enchantMax(); pass++)
        for (let i = 0; i < IND; i++)
          if (canEnchant(i)) {
            for (const [r, a] of nextEnchant(i)) take(r, a);
            S.enchants[i]++;
            n++;
          }
      if (n) toast(`Cast ${n} enchantment${n > 1 ? 's' : ''}`);
    },
    // builds one Research Lab, or with 'max' as many as you can afford
    lab(v) {
      for (let n = v === 'max' ? 1e4 : 1; n > 0 && canBuyLab(); n--) {
        const [g, c] = labPrice();
        take(GOLD, g);
        take(CRYSTAL, c);
        S.labs++;
      }
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
      toast(`Quest complete: +${count(m.reward)} Arcana and +${Math.round(M.questBonus * 100)}% output`);
    },
    dmUpgrade(id) {
      const u = DM_UPGRADES.find((x) => x.id === id);
      if (!u || S.dmUpgrades[id] || dmAvailable() < u.cost) return;
      S.dmSpent += u.cost;
      S.dmUpgrades[id] = 1;
      toast(`${u.name}: ${u.desc}`);
    },
    offer(v) {
      const i = +v, g = offer(i);
      if (g) toast(`Offered ${i === GOLD ? money(g) : fmt(g) + ' ' + resName(i)} to the Prime Crucible`);
    },
    offerAll() {
      const n = S.res.map((_, i) => offer(i)).filter((g) => g > 0).length;
      if (n) toast(`Offered ${n} material${n > 1 ? 's' : ''} to the Prime Crucible`);
    },
    transmute() {
      const p = transmuteReward();
      if (!p || !confirmTap('transmute')) return;
      // nothing is wasted: whatever's left on hand pours into the crucible
      S.res.forEach((_, i) => offer(i));
      const keep = {};
      KEEP_ON_RESET.forEach((k) => (keep[k] = S[k]));
      S = Object.assign(newState(), keep, { darkMatter: S.darkMatter + p, transmutes: S.transmutes + 1 });
      S.plan = planOf(S.nextPlan).unlock() ? S.nextPlan : 'balanced';
      S.plansUsed[S.plan] = 1;
      industry = GOLD;
      refresh();
      saveGame();
      spectacle('transmute', 'Transmuted', `+${count(p)} Dark Matter · output ×${fmt(1 + dmBonusAt(dmAvailable()))} · ${planOf(S.plan).name}`);
    },
    // the plan the next run will follow
    plan(id) {
      const x = PLANS.find((y) => y.id === id);
      if (x && x.unlock()) S.nextPlan = id;
    },
    // completes the current step of the Great Work; the very last one forges the Stone
    finish() {
      if (S.wonAt || crucibleFraction() < 1) return;
      const st = STAGES[S.stage];
      if (S.step < STEPS - 1) {
        S.step++;
        S.offered = Array(IND).fill(0);
        toast(`${st.name}, step ${S.step} of ${STEPS} complete! Every industry ×${STEP_BONUS}`);
        Polish.confetti(40);
        return;
      }
      if (S.stage < STAGES.length - 1) {
        const unlock = STAGE_UNLOCKS[S.stage];
        S.stage++;
        S.step = 0;
        S.offered = Array(IND).fill(0);
        spectacle('ascend', `The ${st.name} is complete`, `Every industry ×${STEP_BONUS} · Unlocked: ${unlock}`);
        return;
      }
      if (!confirmTap('finish')) return;
      S.stage = STAGES.length;
      S.step = 0;
      S.wonAt = S.playTime;
      checkAchievements();
      saveGame();
      spectacle('finish', '', '', showEnding, INDUSTRIES.map((d) => d.color));
    },
    // after the Stone: start this mode over as a new Great Work (see newWorkCarry)
    newWork() {
      if (!S.wonAt || !confirmTap('newWork')) return;
      S = Object.assign(newState(), newWorkCarry(S));
      industry = GOLD;
      refresh();
      saveGame();
      spectacle('ascend', 'A new Great Work', `All output ×${fmt(STONE_POWER ** S.stones)} for the ${S.stones} Stone${S.stones > 1 ? 's' : ''} you've forged`);
    },
    daily() {
      if (Date.now() < S.dailyReadyAt) return;
      const g = Math.max(1000, (M.rate[GOLD] / (M.boosted ? BOOST_POWER : 1)) * DAILY_HOURS * 3600); // the elixir doesn't count
      S.res[GOLD] += g;
      S.runEarned += g;
      S.totalEarned += g;
      S.dailyReadyAt = Date.now() + DAILY_COOLDOWN;
      toast('Daily tribute: +' + money(g));
    },
    boost() {
      if (Date.now() < S.boostReadyAt) return;
      S.boostEndsAt = Date.now() + BOOST_LENGTH;
      S.boostReadyAt = Date.now() + BOOST_COOLDOWN;
      toast(`Elixir of Plenty: ×${BOOST_POWER} output for 30 minutes`);
    },

  };
  // ===== Tutorial (shown the first time you open this mode) =====
  const TUTORIAL = [
    ['Welcome to Communist', "<p>Build a mining empire where every material feeds the next, and offer them all to the <b>Prime Crucible</b> to forge the Philosopher's Stone.</p><p>Move between tabs with the bar at the bottom, or swipe left and right anywhere below the top boxes.</p><p>New systems explain themselves as they open, and the whole guide is in <b>Settings</b> at the bottom of the Magnum Opus tab.</p><p>Communist is one of the three modes of <b>Deepforge</b>. The button at the far right of the tab bar switches to the next one, <b>Industrialist</b>. Each mode is a separate game with its own progress, and each keeps producing while you play another.</p>"],
    ['Production chains', "<p>On the <b>Works</b> tab, buy a <b>Panner</b>: Panners pan gold on their own. Tap <b>Pan by hand</b> to speed up the start.</p><p>Every producer builds more of the one below it. A <b>Prospector Camp</b> keeps making Panners, a <b>Gold Mine</b> keeps making Prospector Camps, and so on up the chain. Buying a bigger producer uses up 10 of the one below it, so your early producers never stop mattering.</p>"],
    ['Materials feed each other', '<p>Discover <b>Copper</b>, then <b>Iron</b>, <b>Crystal</b>, <b>Mithril</b> and <b>Aether</b>. Each has its own chain on the Works tab.</p><p>Each industry needs the one before it: Iron producers are built with Copper, Crystal ones with Iron, and so on. Gold needs them too: Prospector Camps need Copper and Gold Mines need Iron. If a price chip is red, that material is what you’re short of.</p>'],
    ['The Forge', "<p><b>Enchantments</b> triple an industry's output. They combine materials, so you'll need gold plus one or two others. Each industry has ten, cast in order on the <b>Forge</b> tab, and the Albedo adds five more.</p>"],
    ['Research and quests', '<p><b>Quests</b> reward <b>Arcana</b> and each one adds +5% to every industry for good. Once you have Crystal, build <b>Research Labs</b> to brew Arcana steadily.</p><p>Spend Arcana on <b>research</b>: bigger outputs, faster building and cheaper prices. Research survives transmuting. A red dot on any tab means there is something there you can claim or afford.</p>'],
    ['Transmuting and Dark Matter', "<p>Once you've earned about ₲5B, <b>Transmute</b> melts your empire down for <b>Dark Matter</b>. Each one adds <b>+2%</b> to every industry (the bonus grows more slowly past 1,000), so you rebuild faster each time.</p><p>Your leftover materials are offered to the crucible automatically, so nothing is wasted. Most players transmute once it would double their Dark Matter; the tab gets a red dot when it's a good time.</p><p>After your first transmutation you choose a <b>plan</b> for each run on the Transmute tab. A plan pushes some industries hard and slows others: a Gold Rush for Dark Matter, or a plan for whatever the crucible is short of.</p>"],
    ['The Magnum Opus', "<p>The goal of the game is on the <b>Magnum Opus</b> tab: the Great Work: four stages of three steps. Each step asks the <b>Prime Crucible</b> for your materials, and completing one makes every industry ×1.5 for good. Completing a stage unlocks something new: greater producers, more enchantments, new plans. Offerings are never lost, through every transmutation.</p><p>Complete the last step of the <b>Rubedo</b> to forge the Philosopher's Stone and finish the game. It's a long journey of 100 hours or more.</p>"],
    ['Tips', "<p>On the <b>Magnum Opus</b> tab, below the crucible: the <b>daily tribute</b> pays six hours of gold, and the <b>Elixir of Plenty</b> triples every industry for 30 minutes. A red dot on that tab shows when one is ready.</p><p>Your game saves automatically. Use <b>Export</b> in Settings now and then to keep a backup code.</p>"],
  ];
  const FEEDBACK = {
    measure(action, arg) {
      if (action === 'buy') {
        const [i, t] = arg.split('.').map(Number);
        return S.units[i][t];
      }
      if (action === 'pan') return S.res[GOLD];
      if (action === 'offer') return S.offered[+arg];
      return 0;
    },
    label(action, arg, was) {
      if (action === 'buy') {
        const [i, t] = arg.split('.').map(Number);
        return '+' + fmtWhole(S.units[i][t] - was);
      }
      if (action === 'pan') return '+' + money(S.res[GOLD] - was);
      if (action === 'offer') return '+' + (+arg === GOLD ? money(S.offered[GOLD] - was) : fmt(S.offered[+arg] - was));
      return '';
    },
    // discovering an industry, or buying the first of a producer
    unlocked: (action, arg, was) => action === 'discover' || (action === 'buy' && was < 1),
  };
  // A price as small chips: "₲1.5K", "10 Panners", "15 Copper". Chips the player can't cover yet are marked short
  function priceChips(list, have) {
    return list
      .map(([r, a, label]) => `<span class="pc${have(r) >= a * (1 - 1e-9) ? '' : ' short'}">${r === GOLD ? money(a) : fmtWhole(a) + ' ' + label}</span>`)
      .join('');
  }
  const fmtWhole = (n) => (n < 1e3 ? String(Math.ceil(n - 1e-9)) : fmt(n));
  const tierIcon = (i, t) => TIER_ICONS[t] || INDUSTRIES[i].icon;

  // Which producers of an industry are shown: everything up to one tier past the highest you own
  const shownTiers = (i) => Math.min(tierCount(i), S.units[i].reduce((h, u, t) => (u > 0 ? t + 1 : h), 0) + 1);
  // Red dots on the tab bar: something on that tab is ready or affordable right now
  const TAB_BADGES = {
    // a new industry to discover, or the next producer up a chain can be bought for the first time
    works: () => canDiscover(nextDiscovery()) || INDUSTRIES.some((d, i) => S.open[i] && Array.from({ length: shownTiers(i) }, (_, t) => t).some((t) => !S.units[i][t] && maxAffordable(i, t) > 0)),
    forge: () => INDUSTRIES.some((d, i) => canEnchant(i)),
    research: () =>
      (QUESTS.some((m) => !S.quests[m.id] && m.done()) ? 'claim' : false) || RESEARCH.some((r) => !S.research[r.id] && S.arcana >= r.cost) || canBuyLab(),
    transmute: () => (goodTransmute() ? 'claim' : false) || DM_UPGRADES.some((u) => !S.dmUpgrades[u.id] && dmAvailable() >= u.cost),
    opus: (now) => (now >= S.dailyReadyAt || now >= S.boostReadyAt || (!S.wonAt && crucibleFraction() >= 1) ? 'claim' : false),
  };
  // The four boxes at the top: [label, icon, value, format, note]
  function header() {
    const now = Date.now();
    return [
      ['Gold', 'coins', S.res[GOLD], money, ' · Output ×' + fmt(M.all)],
      ['Gold/s', 'trend', M.rate[GOLD], money, M.boosted ? ` · Elixir · ${duration((S.boostEndsAt - now) / 1000)}` : ''],
      ['Arcana', 'flask', S.arcana, count, ''],
      ['Dark Matter', 'spiral', dmAvailable(), count, ''],
    ];
  }

  // Pane builders, one per tab. Each returns [main pane HTML, second pane HTML]
  const PANES = {
    // Works tab: pick an industry, see its material, and buy up its chain of producers
    works() {
      const d = INDUSTRIES[industry];
      const plan = planOf(S.plan), bn = bottleneck();
      let h = S.transmutes ? `<p class="allms">${plan.name}: ${planDesc(plan)}</p>` : '';
      h += `<div class="inds">${INDUSTRIES.map((x, i) => {
        const next = i === nextDiscovery(), locked = !S.open[i];
        if (locked && !next) return `<button class="ind far" disabled>${icon('lock', 18)}<span>?</span></button>`;
        return (
          `<button class="ind${i === industry ? ' on' : ''}${locked ? ' new' : ''}${bn && bn.res === i ? ' short' : ''}${justArrived('ind' + i + locked)}" data-a="industry" data-i="${i}" style="--c:${x.color}">${icon(x.icon, 18)}` +
          `<span>${x.name}</span><small>${locked ? 'Discover' : live(i === GOLD ? money(S.res[i]) : fmt(S.res[i]))}</small>${bn && bn.res === i ? '<i class="bn">Short</i>' : ''}</button>`
        );
      }).join('')}</div>`;
      if (!S.open[industry]) {
        const [g, m] = DISCOVER[industry], prev = industry - 1;
        return [
          h +
            `<div class="row panel" style="--c:${d.color}"><b>${icon(d.icon, 16, d.color)} Discover ${d.name}</b>` +
            `<small>${DISCOVER_TEXT[industry]}</small><div class="price">${priceChips([[GOLD, g], [prev, m, resName(prev)]], (r) => S.res[r])}</div></div>` +
            `<button class="big buy${canDiscover(industry) ? '' : ' dis'}" data-a="discover" data-i="${industry}">Discover ${d.name}</button>`,
        ];
      }
      // the material on hand, and for gold a button to pan by hand
      h +=
        `<div class="row panel mat" style="--c:${d.color}"><div><b>${icon(d.icon, 18, d.color)} ${d.name} ${live(industry === GOLD ? money(S.res[industry]) : fmt(S.res[industry]))}</b>` +
        `<small>+${live(fmt(M.rate[industry]))} per second · ×${live(fmt(industryMult(industry)))} output</small>` +
        tierMilestoneLine(industry) +
        (bn && bn.res === industry ? `<small class="bnl">${icon('target', 12)} Short: holding back ${bnList(bn)}</small>` : '') +
        `</div>` +
        (industry === GOLD ? `<button id="panb" data-a="pan" data-i="0">Pan<br>by hand</button>` : '') +
        `</div>`;
      h += `<div class="modes">${BUY_MODES.map((m) => `<button class="${m === buyMode ? 'on' : ''}" data-a="mode" data-i="${m}">${m === 'max' ? 'Max' : '×' + m}</button>`).join('')}</div>`;
      for (let t = 0; t < shownTiers(industry); t++) h += producerCard(industry, t);
      const left = tierCount(industry) - shownTiers(industry);
      if (left > 0) h += `<p class="more">${left} bigger producer${left > 1 ? 's' : ''} further up the chain</p>`;
      else if (S.stage < 1) h += `<p class="more">Complete the Nigredo to raise this industry's greatest producer, the ${d.tiers[d.tiers.length - 1]}</p>`;
      return [h];
    },
    // Forge tab: each industry's next enchantment, with the ones already cast folded away
    forge() {
      const open = INDUSTRIES.map((d, i) => i).filter((i) => S.open[i]);
      let h = `<div class="bulk2 one">${bigButton('enchantAll', 'Cast every enchantment you can afford', open.some(canEnchant))}</div>`;
      h += tip(`Each enchantment multiplies one industry's output by ×${ENCHANT_MULT}. They combine materials, so you'll need more than gold.`);
      for (const i of open) {
        const d = INDUSTRIES[i], k = S.enchants[i];
        h += section(`${icon(d.icon, 16, d.color)} ${d.name} · ${k}/${enchantMax()} · ×${fmt(ENCHANT_MULT ** k)}`);
        if (k >= enchantMax()) {
          h += tip(`Every ${d.name} enchantment is cast.`);
          continue;
        }
        const r = nextEnchant(i).map(([res, a]) => [res, a, resName(res)]);
        h += `<div class="row"><div><b>${ENCHANT_NAMES[i][k]}</b><small>${d.name} output ×${ENCHANT_MULT}</small><div class="price">${priceChips(r, (x) => S.res[x])}</div></div>${btn('enchant', i, 'Cast', canEnchant(i))}</div>`;
      }
      const locked = IND - open.length;
      if (locked) h += tip(`${locked} more industr${locked > 1 ? 'ies' : 'y'} to discover, each with its own enchantments.`);
      return [h];
    },
    // Research tab: quests (which pay Arcana), the Research Labs, then research (which spends Arcana)
    research() {
      let h = questSection(QUESTS, S.quests, `Each claimed quest adds +${Math.round(M.questBonus * 100)}% to every industry, for good.`);
      h += section('Research Labs');
      if (!S.open[CRYSTAL]) h += tip('Research Labs are built with Crystal. Discover Crystal to build them; until then, quests are your only Arcana.');
      else {
        const [g, c] = labPrice();
        h +=
          `<div class="row" data-pop="labs"><div><b>${icon('flask', 16, ARCANA_COLOR)} Research Labs: ${S.labs}</b><small>Brewing ${live(fmt(M.labRate))} Arcana per second</small>` +
          `<div class="price">${priceChips([[GOLD, g], [CRYSTAL, c, 'Crystal']], (r) => S.res[r])}</div></div><span class="bp">${btn('lab', 0, 'Build', canBuyLab())}${btn('lab', 'max', 'Max', canBuyLab())}</span></div>`;
      }
      h +=
        section('Research') +
        tip('Spend Arcana on alchemy that lasts: every discovery survives transmuting.') +
        upgradeList(RESEARCH, S.research, { action: 'research', price: arcanaPrice, funds: S.arcana, key: 'research', why: whyNow, later: 'Later research', allDone: 'Every discovery is made.', ownedLabel: 'Known', doneKey: '-done', doneLabel: 'Discoveries made' });
      return [h];
    },
    transmute() {
      const p = transmuteReward(), avail = dmAvailable(), total = S.darkMatter + p;
      const from = goldForDm(total), to = goldForDm(total + 1), pct = clamp01((S.totalEarned - from) / (to - from));
      let h =
        `<div class="row panel"><b>${icon('spiral', 16)} Dark Matter: ${count(avail)}</b>` +
        `<small>Output bonus <b>×${live(fmt(1 + dmBonusAt(avail)))}</b> · +${Math.round(M.dmPer * 100)}% per Dark Matter</small>` +
        `<div class="bar">${liveBar(pct * 100)}<span>${live(Math.floor(pct * 100))}% to the next Dark Matter</span></div>` +
        `<small>Gold earned in total ${live(money(S.totalEarned))} · next Dark Matter at ${live(money(to))}</small></div>` +
        `<p class="hint">${transmuteHint(p, S.darkMatter, goldForDm(1))}</p>` +
        bigButton('transmute', armed === 'transmute' ? 'Tap again to transmute' : p ? `Transmute for +${count(p)} ${icon('spiral', 16)}` : 'Nothing to transmute yet', p > 0);
      const table = [1, 10, 100, 1000, 1e4]
        .map((n) => {
          const at = goldForDm(n), got = S.totalEarned >= at;
          return `<div class="${got ? '' : 'no'}"><span>${n.toLocaleString('en-US')} total Dark Matter</span><span>${money(at)}${got ? ' (reached)' : ''}</span></div>`;
        })
        .join('');
      h += fold(
        'transmute-help',
        'How transmuting works',
        `<p><b>Transmuting</b> melts down every producer, enchantment, Research Lab and industry you've discovered. Whatever materials you still hold pour into the Prime Crucible first, so nothing is wasted. You keep Arcana, research, quests, achievements, Dark Matter and everything in the crucible.</p>` +
          `<p>Your total Dark Matter grows with the cube root of all the gold you've ever earned, so 1,000× the gold gives 10× the Dark Matter.</p>` +
          `<p>Each Dark Matter adds +${Math.round(M.dmPer * 100)}% to every industry, up to 1,000 Dark Matter. Past that, the bonus grows with the cube root. Spending Dark Matter on upgrades lowers the bonus.</p><div class="mtable">${table}</div>`,
      );
      if (!S.darkMatter) return [h]; // Dark Matter upgrades and plans appear after the first transmutation
      h += section('Dark Matter upgrades') + upgradeList(DM_UPGRADES, S.dmUpgrades, { action: 'dmUpgrade', price: dmPrice, funds: avail, key: 'dm', why: (u) => whyNow(u, u.cost), later: 'More Dark Matter upgrades', allDone: 'Every Dark Matter upgrade is owned.' });
      return [h + planSection()];
    },
    // The Magnum Opus tab: the crucible first, then bonuses, stats, achievements and (below the panes) Settings
    opus() {
      const [stats, achievements] = statsSection();
      return [crucibleSection() + stats, achievements];
    },
  };
  // Plans (Transmute tab): the next run's plan is picked here and starts when you transmute
  function planSection() {
    if (!S.transmutes) return section('Plans') + tip('Plans unlock after your first transmutation: each run can then follow a plan that pushes some industries at the cost of others.');
    const now = planOf(S.plan), next = planOf(S.nextPlan);
    const planRow = (x) =>
      row(
        `${x.name}${x.id === now.id ? ' <i class="tag">This run</i>' : ''}`,
        planDesc(x),
        x.id === next.id ? owned_('Next run') : btn('plan', x.id, 'Choose', true),
      );
    const open = PLANS.filter((x) => x.unlock()), locked = PLANS.length - open.length;
    return (
      section('Plans') +
      tip(`Each run follows one plan. Choose the next one here; it starts when you transmute. Gold Rush grows Dark Matter fastest; the others fill the crucible's parts that lag behind.`) +
      open.map(planRow).join('') +
      (locked ? tip(`${locked} more plan${locked > 1 ? 's' : ''} unlock as the Great Work goes on.`) : '')
    );
  }
  const DISCOVER_TEXT = [
    '',
    'Copper Miners dig copper. Prospector Camps need it, and so does Iron later on.',
    'Iron Miners dig iron. Gold Mines need it, and Crystal producers are built with it.',
    'Crystal Cutters cut crystal. It builds Research Labs and Assay Guilds, and Mithril producers need it.',
    'Mithril Delvers dig the true-silver of the deep. Royal Mints need it, and Aether producers are built with it.',
    'Aether Tappers draw the fifth element out of the air: the last material the Philosopher’s Stone needs.',
  ];
  // One producer: what it makes, how many you own, and its price
  // Producers and industries that just came into view slide in, once
  const arrived = {};
  function justArrived(key) {
    const now = Date.now();
    if (!arrived[key]) arrived[key] = now;
    return now - arrived[key] < 500 ? ' reveal' : '';
  }
  function producerCard(i, t) {
    const d = INDUSTRIES[i], name = d.tiers[t], k = buyAmount(i, t), n = owned(i, t);
    const verb = i === GOLD ? 'Pans' : 'Digs';
    const makes = t === 0 ? `${verb} ${live(fmt(n * BASE_OUTPUT(i) * industryMult(i)))} ${d.name}/s` : `Builds ${live(fmt(buildRate(i, t)))} ${plural(d.tiers[t - 1])}/s`;
    const price = priceOf(i, t, k).map(([r, a]) => [r, a, r === 'u' ? (a === 1 ? d.tiers[t - 1] : plural(d.tiers[t - 1])) : resName(r)]);
    const ok = buyMode === 'max' ? maxAffordable(i, t) > 0 : canAfford(price, i, t);
    const goal = TIER_MILESTONES[S.tierMs[i]], slim = n > 0 && k < n * 1e-3 && !(goal && S.bought[i][t] < goal);
    return (
      `<div class="card prod${n ? ' on' : ''}${slim ? ' slim' : ''}${justArrived(i + '.' + t)}" style="--c:${d.color}"><div class="ic">${icon(tierIcon(i, t), 24)}<b>${live(count(n))}</b></div>` +
      `<div class="mid"><div class="nm">${name}</div><small class="ms">${n ? makes : t ? `Builds ${plural(d.tiers[t - 1])}` : `${verb} ${d.name}`}</small>` +
      `<div class="price">${priceChips(price, (r) => have(i, t, r))}</div></div>` +
      `<button class="buy${ok ? '' : ' dis'}" data-a="buy" data-i="${i}.${t}">Buy<br>×${k}</button></div>`
    );
  }

  // The end goal (Magnum Opus tab): the current stage of the Great Work, with one part per material
  function crucibleSection() {
    if (S.wonAt) return forgedPanel(S, 'output');
    const f = crucibleFraction(), st = STAGES[S.stage], lastStep = S.step === STEPS - 1, last = S.stage === STAGES.length - 1 && lastStep;
    const stages = STAGES.map((x, k) => `<span class="stg${k < S.stage ? ' done' : k === S.stage ? ' now' : ''}" style="--c:${x.color}">${x.name}</span>`).join('');
    const reward = last
      ? "Completing it forges the Philosopher's Stone and finishes the game."
      : `Completing it makes every industry ×${STEP_BONUS}, for good${lastStep ? ` and completes the ${st.name}: <b>${STAGE_UNLOCKS[S.stage]}</b>` : ''}.`;
    let h =
      `<div class="stages">${stages}</div>` +
      `<div class="row panel"><b>${st.name} · step ${S.step + 1} of ${STEPS} · ${live((f * 100).toFixed(1))}%</b><small>Offer the Prime Crucible every material below. ${reward} What you offer stays in the crucible forever.</small>` +
      `<div class="bar opus">${liveBar(f * 100)}<span>${live((f * 100).toFixed(2))}%</span></div></div>` +
      bigButton('finish', armed === 'finish' ? 'Tap again to forge' : f < 1 ? 'Fill every part to complete this step' : last ? "Forge the Philosopher's Stone" : `Complete step ${S.step + 1} of the ${st.name}`, f >= 1);
    h += bigButton('offerAll', 'Offer everything you can', S.res.some((v, i) => v >= 1 && S.offered[i] < stageGoal(i)));
    h += needed().map((i) => {
      const d = INDUSTRIES[i], goal = stageGoal(i), part = Math.min(1, S.offered[i] / goal), show = i === GOLD ? money : fmt;
      return (
        `<div class="row cru" style="--c:${d.color}"><div><b>${icon(d.icon, 16, d.color)} ${d.name}</b>` +
        `<small>${live(show(Math.min(S.offered[i], goal)))} of ${show(goal)}</small>` +
        `<div class="bar px">${liveBar(part * 100, true)}<span>${live((part * 100).toFixed(1))}%</span></div></div>` +
        (part >= 1 ? owned_('Full') : btn('offer', i, 'Offer', S.res[i] >= 1)) +
        `</div>`
      );
    }).join('');
    h += fold(
      'crucible-help',
      'How the Great Work works',
      `<p>The Great Work has four stages: ${STAGES.map((x) => `<b>${x.name}</b>`).join(', ')}, of ${STEPS} steps each. Every step needs every material, in larger amounts than the last. Each completed step makes every industry ×${STEP_BONUS} for good, and each completed stage unlocks something new. Completing the last step of the Rubedo forges the Philosopher's Stone.</p>` +
        `<p>What you offer leaves your stores but stays in the crucible through every transmutation. Offering early brings the next bonus sooner; holding on lets you buy more producers. Anything still on hand when you transmute is offered for you. The Great Devotion plan and some research make offerings count for more.</p>`,
    );
    return h;
  }
  // Bonuses, stats and achievements (Magnum Opus tab, below the crucible). Returns [bonuses and stats, achievements]
  function statsSection() {
    const bonuses = bonusRows(S, 'Six hours of your gold, free', 'Elixir of Plenty', `×${BOOST_POWER} to every industry for 30 minutes`, M.boosted);
    const producers = S.units.reduce((a, u) => a + u.reduce((b, x) => b + Math.floor(x), 0), 0);
    const stats = [
      ['Gold earned in total', money(S.totalEarned)],
      ['Gold this run', money(S.runEarned)],
      ['Time played', duration(S.playTime)],
      ['Pans by hand', count(S.taps)],
      ['Best gold / sec', money(S.bestIncome)],
      ['Industries discovered', S.open.filter(Boolean).length + ' / ' + IND],
      ['Producers working', count(producers)],
      ['Enchantments cast', enchantsCast() + ' / ' + IND * enchantMax()],
      ['Transmutations', count(S.transmutes)],
      ['Dark Matter earned', count(S.darkMatter)],
      ['Output multiplier', '×' + fmt(M.all)],
      ['Great Work', S.wonAt ? 'Complete' : `${STAGES[S.stage].name} step ${S.step + 1} · ${(crucibleFraction() * 100).toFixed(1)}%`],
      ['Plans followed', Object.keys(S.plansUsed).length + ' / ' + PLANS.length],
    ];
    return [bonuses + statRows(stats), achievementSection(ACHIEVEMENTS, S.achievements, 'output')];
  }
  // The Prime Crucible on the Magnum Opus tab: dull metal until the first stage, then each stage's color, with the
  // offerings of the current step rising inside it; one orb per material
  const RAW_STONE = '#857a70';
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  // which design of the goal is unlocked: one per milestone reached, and the next milestone to aim for
  const goalDesign = (steps) => {
    const next = steps.find(([, done]) => !done());
    return { style: steps.filter(([, done]) => done()).length, next: next ? next[0] : null };
  };
  const GOAL_STEPS = [
    ...STAGES.map((st, i) => ['Complete ' + st.name, () => S.stage > i || S.wonAt > 0]),
    ["Forge the Philosopher's Stone", () => S.wonAt > 0],
  ];
  function stone() {
    return {
      family: 'com',
      ...goalDesign(GOAL_STEPS),
      tint: rgb(S.stage ? STAGES[Math.min(S.stage, STAGES.length) - 1].color : RAW_STONE),
      fill: 0.25 + 0.75 * crucibleFraction(),
      orbs: INDUSTRIES.map((d, i) => {
        if (!S.open[i] && !S.offered[i]) return null;
        const part = S.wonAt || !stageGoal(i) ? 1 : Math.min(1, S.offered[i] / stageGoal(i));
        return { color: d.color, size: 2 + 5 * Math.sqrt(part), alpha: 0.35 + 0.65 * part, r: 2.2 + (i % 2) * 0.35, v: 0.3, a: (i * 6.283) / IND, tilt: ((i % 3) - 1) * 0.08 };
      }).filter(Boolean),
    };
  }
  function titleLine() {
    if (!S.totalEarned) return 'Gather, refine, combine: build production chains and forge the Stone.';
    return (S.wonAt ? "Philosopher's Stone forged · " : S.stage || crucibleFraction() > 0 ? STAGES[S.stage].name + ' ' + (crucibleFraction() * 100).toFixed(1) + '% · ' : '') + 'Gold earned ' + money(S.totalEarned);
  }
  function ending() {
    return {
      title: 'The Great Work is complete',
      text: "The Philosopher's Stone is forged. Every chain, every enchantment and every grain of gold led here.",
      stats: [
        ['This Great Work', duration(workTime(S))],
        ['Time played', duration(S.playTime)],
        ['Gold earned', money(S.totalEarned)],
        ['Transmutations', count(S.transmutes)],
        ['Enchantments cast', enchantsCast() + ' / ' + IND * enchantMax()],
        ['Achievements', Object.keys(S.achievements).length + ' / ' + ACHIEVEMENTS.length],
      ],
    };
  }
  // ===== Production feedback: floating numbers where things are being made =====
  // Production here is a steady flow, so every working producer on screen fires its own number once a second, showing
  // what it made in that second (the same floating number Capitalist uses). Each keeps its own clock, started at a
  // random point, so they pop independently instead of taking turns. Nothing is added to the simulation: the numbers
  // come from the rates it already uses, and only while a rate is above zero
  const POP_EVERY = 1000;
  let popClock = 0;
  const popLast = {};
  function producePops(dt) {
    popClock += dt;
    if (popClock < 0.1) return;
    popClock = 0;
    if (!settings.effects || document.hidden || (tab !== 'works' && tab !== 'research')) return;
    const pane = $('pane'), src = [];
    if (tab === 'works' && S.open[industry]) {
      const d = INDUSTRIES[industry], cards = pane.querySelectorAll('.card.prod');
      cards.forEach((c, t) => {
        if (!owned(industry, t)) return;
        const r = t === 0 ? M.rate[industry] : buildRate(industry, t);
        if (r > 0) src.push([industry + '.' + t, c, r, (v) => '+' + (t === 0 && industry === GOLD ? money(v) : fmt(v)), d.color, '']);
      });
      pane.querySelectorAll('.ind[data-i]').forEach((b) => {
        const i = +b.dataset.i;
        if (i !== industry && S.open[i] && M.rate[i] > 0) src.push(['b' + i, b, M.rate[i], (v) => '+' + (i === GOLD ? money(v) : fmt(v)), INDUSTRIES[i].color, 'pc']);
      });
    } else if (tab === 'research' && S.labs > 0 && M.labRate > 0) {
      const h = pane.querySelector('[data-pop="labs"]');
      if (h) src.push(['labs', h, M.labRate, (v) => icon('flask', 11) + ' +' + fmt(v), ARCANA_COLOR, 'pl']);
    }
    const now = Date.now();
    for (const [key, host, rate, text, color, cls] of src) {
      const last = popLast[key];
      if (last === undefined || now - last > 3 * POP_EVERY) {
        popLast[key] = now - Math.random() * POP_EVERY; // newly on screen: its first number comes within a second
        continue;
      }
      if (now - last < POP_EVERY) continue;
      popLast[key] = now - ((now - last) % POP_EVERY); // keeps its own steady beat
      Polish.pop(host, () => text((rate * POP_EVERY) / 1000), color, 'k' + key, false, cls);
    }
  }
  // One tick of play: produce, then remember the best gold rate
  function tick(dt) {
    // timers are stored as clock times: one set while the clock was ahead can't outlast its real length once it's put back
    const n = Date.now();
    if (S.boostEndsAt > n + BOOST_LENGTH) S.boostEndsAt = n + BOOST_LENGTH;
    if (S.boostReadyAt > n + BOOST_COOLDOWN) S.boostReadyAt = n + BOOST_COOLDOWN;
    if (S.dailyReadyAt > n + DAILY_COOLDOWN) S.dailyReadyAt = n + DAILY_COOLDOWN;
    refresh();
    step(dt);
    producePops(dt);
    S.playTime += dt;
    if (M.rate[GOLD] > S.bestIncome) S.bestIncome = M.rate[GOLD];
  }

  // ===== Guidance: the bottleneck, locked tabs and one-time cards =====
  // The material holding the chains back: for every producer you could buy next (one of each shown tier), the next
  // enchantment of each industry and the next discovery, the materials you're short of and won't have within half a
  // minute at the current rate. The one that blocks the most is the bottleneck. Gold is left out: it's what everything
  // costs, and it's never the chain's fault. Returns { res, blocks: [what it holds back] } or nothing
  function bottleneck() {
    const blocks = Array.from({ length: IND }, () => []);
    const check = (list, label) =>
      list.forEach(([r, a]) => {
        if (r === 'u' || r === GOLD || !S.open[r] || S.res[r] >= a) return;
        if ((a - S.res[r]) / Math.max(1e-9, M.rate[r]) < 30) return; // it'll be there soon enough
        blocks[r].push(label);
      });
    for (let i = 0; i < IND; i++) {
      if (!S.open[i]) continue;
      for (let t = 0; t < shownTiers(i); t++) check(recipe(i, t), plural(INDUSTRIES[i].tiers[t]));
      if (nextEnchant(i)) check(nextEnchant(i), `${INDUSTRIES[i].name} enchantments`);
    }
    const nd = nextDiscovery();
    if (nd > 0) check([[nd - 1, DISCOVER[nd][1]]], `discovering ${INDUSTRIES[nd].name}`);
    let best = -1;
    for (let r = 0; r < IND; r++) if (blocks[r].length && (best < 0 || blocks[r].length > blocks[best].length)) best = r;
    return best < 0 ? null : { res: best, blocks: blocks[best] };
  }
  const bnList = (b) => b.blocks[0] + (b.blocks.length > 1 ? ` and ${b.blocks.length - 1} more` : '');
  // What a research or upgrade would do right now. dmCost: the Dark Matter it spends, which lowers the bonus
  function whyNow(u, dmCost = 0) {
    const fx = u.fx, bn = bottleneck();
    const loss = dmCost ? (1 + dmBonusAt(Math.max(0, dmAvailable() - dmCost))) / (1 + dmBonusAt(dmAvailable())) : 1;
    const perSec = (r, x) => {
      const net = x * loss;
      if (net <= 1.001) return 'Now: costs more bonus than it gives';
      const gain = M.rate[r] * (net - 1);
      if (!gain) return '';
      return (bn && bn.res === r ? `Eases your ${resName(r)} shortage: ` : 'Now: ') + `+${r === GOLD ? money(gain) : fmt(gain) + ' ' + resName(r)}/s`;
    };
    if (fx.ind) return S.open[fx.ind[0]] ? perSec(fx.ind[0], fx.ind[1]) : `Pays off once you discover ${resName(fx.ind[0])}`;
    if (fx.ind3) {
      const hit = fx.ind3.find(([i]) => bn && bn.res === i);
      return hit ? perSec(hit[0], hit[1]) : '';
    }
    if (fx.out) return perSec(bn ? bn.res : GOLD, fx.out);
    if (fx.build) return 'Now: every chain grows its lower producers faster';
    if (fx.arcana) return S.labs ? `Now: +${fmt(M.labRate * (fx.arcana * loss - 1))} Arcana/s` : 'Build a Research Lab to benefit';
    if (fx.offline) return M.rate[GOLD] ? `Now: +${money(M.rate[GOLD] * 0.5 * 3600)} gold per hour away, and more of every material` : '';
    if (fx.dmBonus) {
      const a = dmAvailable();
      return a ? `Now: Dark Matter bonus ×${fmt(1 + dmBonusAt(a))} → ×${fmt(1 + dmBonusFor(0.02 * (1 + M.dmBonus + fx.dmBonus), a))}` : 'Pays off once you have Dark Matter';
    }
    if (fx.planPower) return planOf(S.plan).boost.length ? `Now: ${planOf(S.plan).name} boosts ×${PLAN_BOOST * M.planPower} → ×${PLAN_BOOST * M.planPower * fx.planPower}` : 'Pays off on a plan with boosts';
    if (fx.offer) return 'Now: the Great Work fills twice as fast from the same materials';
    if (fx.questBonus) return `Now: ${Object.keys(S.quests).length} claimed quests, +${Math.round((fx.questBonus - M.questBonus) * 100 * Object.keys(S.quests).length)}% output`;
    return '';
  }
  // Tabs open as they become useful, and stay open (anything earned later in the game keeps them open)
  const veteran = () => S.transmutes || S.stones || S.stage || S.darkMatter;
  function locked(key) {
    if (key === 'forge' && !S.open[1] && !veteran() && !enchantsCast()) return 'opens when you discover Copper';
    if (key === 'research' && !veteran() && !S.arcana && !researchDone() && !Object.keys(S.quests).length && !QUESTS.some((m) => m.done()) && !S.open[CRYSTAL])
      return 'opens with your first quest';
    if (key === 'transmute' && !veteran() && S.totalEarned < 5e8) return `opens at ${money(5e8)} earned (${money(S.totalEarned)} so far)`;
    return '';
  }
  // One short card the first time each system matters
  const HINTS = [
    { id: 'materials', when: () => S.open[1], tab: 'works', title: 'Materials feed each other', text: 'Each industry is built with the one before it, and bigger gold producers need other materials too. A <b>red price chip</b> is what you’re short of, and the industry holding you back is marked <b>Short</b>.' },
    { id: 'forge', when: () => !locked('forge'), tab: 'forge', title: 'Enchantments', text: 'Each enchantment triples one industry’s output. They mix materials, so they pull every chain along. They’re on the <b>Forge</b> tab.' },
    { id: 'research', when: () => !locked('research'), tab: 'research', title: 'Quests and research', text: '<b>Quests</b> pay Arcana and add +5% to every industry for good. Spend Arcana on <b>research</b>, which is never lost.' },
    { id: 'labs', when: () => S.open[CRYSTAL], tab: 'research', title: 'Research Labs', text: 'Crystal builds <b>Research Labs</b>, which brew Arcana steadily. The more Crystal you cut, the more they brew.' },
    { id: 'transmute', when: () => !locked('transmute'), tab: 'transmute', title: 'Transmuting', text: `At ${money(goldForDm(1))} of gold earned you can <b>transmute</b>: your industries melt into <b>Dark Matter</b>, +2% to every industry per Dark Matter, for good. Your leftover materials go to the Great Work, so nothing is wasted.` },
    { id: 'plans', when: () => S.transmutes > 0, tab: 'transmute', title: 'Plans', text: 'Each run now follows a <b>plan</b>, chosen on the Transmute tab before you transmute: Gold Rush for Dark Matter, or one that pushes the materials the Great Work lacks.' },
    { id: 'great-work', when: () => S.transmutes > 0 || S.open[4], tab: 'opus', title: 'The Great Work', text: 'Offer materials to the Prime Crucible on the <b>Magnum Opus</b> tab. Each step makes every industry ×1.5 for good, and each stage unlocks something new. Offerings are never lost.' },
    { id: 'bonuses', when: () => S.playTime > 1800, tab: 'opus', title: 'Daily bonuses', text: 'The <b>daily tribute</b> and the <b>Elixir of Plenty</b> are on the Magnum Opus tab. A red dot there means one is ready.' },
  ];

  return {
    key: 'communist',
    name: 'Communist',
    emblem: 'factory',
    accent: '#d8a19b',
    saveKey: 'df_communist',
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
      industry = GOLD;
      refresh();
    },
    fresh() {
      S = newState();
      industry = GOLD;
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
    buildUI() {},
    onTab() {},
    renderTab: () => false,
    stone,
    titleLine,
    ending,
    deleteNote: 'Erases all Communist progress. Industrialist and Capitalist are not affected.',
  };
})();
