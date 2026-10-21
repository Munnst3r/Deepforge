// ===== Title screen =====
// Set up first so nothing later can block it.
let started = false;
let modePickedAt = 0; // when the title's mode selector was last used, so that tap doesn't also start the game
function startGame() {
  if (started) return;
  started = true;
  const title = document.getElementById('title');
  if (title) {
    title.classList.add('out');
    setTimeout(() => title.remove(), 450);
  }
  try {
    maybeTutorial();
  } catch (e) {}
}
// Tapping anywhere on the title starts playing, except on the mode selector, which picks the mode instead
['pointerup', 'touchend', 'click'].forEach((type) =>
  document.getElementById('title').addEventListener(type, (e) => {
    if (e.target.closest('#msel,#tset,#tmenu')) return;
    const menu = document.getElementById('tmenu');
    if (menu && !menu.hidden) { // an open Settings menu closes first; the tap that closed it doesn't also start the game
      if (type === 'click') document.getElementById('tset').click();
      modePickedAt = Date.now();
    } else if (Date.now() - modePickedAt > 500) startGame();
  }),
);
// Show start-up errors on the title screen instead of failing silently
addEventListener('error', (e) => {
  const t = document.getElementById('ts');
  if (!t) return;
  t.textContent = 'Something went wrong: ' + e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '') + '. A screenshot of this helps fix it.';
  t.style.color = '#e3a08c';
});

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Shared colors for resources both modes have
const GOLD_COLOR = '#dcc795';
const ARCANA_COLOR = '#93c4bd';

// Icons: Lucide and Tabler outline icons (24×24, drawn with the current color)
// Icons: Lucide and Tabler outline icons (24×24, drawn with the current color)
const ICON_PATHS = {"shovel":"<path d=\"M2 22v-5l5-5 5 5-5 5z\"/><path d=\"M9.5 14.5 16 8\"/><path d=\"m17 2 5 5-.5.5a3.53 3.53 0 0 1-5 0s0 0 0 0a3.53 3.53 0 0 1 0-5L17 2\"/>",
"pickaxe":"<path d=\"M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912\"/><path d=\"M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393\"/><path d=\"M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z\"/><path d=\"M19.686 8.314a12.501 12.501 0 0 1 1.356 10.225 1 1 0 0 1-1.751-.119 22 22 0 0 0-3.393-6.319\"/>",
"mountain":"<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/>",
"moon":"<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
"sun":"<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
"prism":"<path d=\"M20.792 6.996l-3.775 2.643a2.005 2.005 0 0 1 -1.147 .361h-7.74c-.41 0 -.81 -.126 -1.146 -.362l-3.774 -2.641\"/><path d=\"M8 10v11\"/><path d=\"M16 10v11\"/><path d=\"M3.853 18.274l3.367 2.363a2 2 0 0 0 1.147 .363h7.265c.41 0 .811 -.126 1.147 -.363l3.367 -2.363c.536 -.375 .854 -.99 .854 -1.643v-9.262c0 -.655 -.318 -1.268 -.853 -1.643l-3.367 -2.363a2 2 0 0 0 -1.147 -.363h-7.266c-.41 0 -.811 .126 -1.147 .363l-3.367 2.363a2.006 2.006 0 0 0 -.853 1.644v9.261c0 .655 .318 1.269 .853 1.644\"/>",
"gem":"<path d=\"M6 3h12l4 6-10 13L2 9Z\"/><path d=\"M11 3 8 9l4 13 4-13-3-6\"/><path d=\"M2 9h20\"/>",
"ruby":"<path d=\"M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z\"/>",
"sapphire":"<path d=\"M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5\"/><path d=\"M10 12l-2 -2.2l.6 -1\"/>",
"hexagon":"<path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/>",
"moonstar":"<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9\"/><path d=\"M20 3v4\"/><path d=\"M22 5h-4\"/>",
"sunhigh":"<path d=\"M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656\"/><path d=\"M6.343 17.657l-1.414 1.414\"/><path d=\"M6.343 6.343l-1.414 -1.414\"/><path d=\"M17.657 6.343l1.414 -1.414\"/><path d=\"M17.657 17.657l1.414 1.414\"/><path d=\"M4 12h-2\"/><path d=\"M12 4v-2\"/><path d=\"M20 12h2\"/><path d=\"M12 20v2\"/>",
"droplet":"<path d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z\"/>",
"shield":"<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"M12 22V2\"/>",
"anvil":"<path d=\"M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4\"/><path d=\"M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z\"/><path d=\"M9 12v5\"/><path d=\"M15 12v5\"/><path d=\"M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1\"/>",
"cog":"<path d=\"M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z\"/><path d=\"M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z\"/><path d=\"M12 2v2\"/><path d=\"M12 22v-2\"/><path d=\"m17 20.66-1-1.73\"/><path d=\"M11 10.27 7 3.34\"/><path d=\"m20.66 17-1.73-1\"/><path d=\"m3.34 7 1.73 1\"/><path d=\"M14 12h8\"/><path d=\"M2 12h2\"/><path d=\"m20.66 7-1.73 1\"/><path d=\"m3.34 17 1.73-1\"/><path d=\"m17 3.34-1 1.73\"/><path d=\"m11 13.73-4 6.93\"/>",
"sparkle":"<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"/>",
"volcano":"<path d=\"M9 8v-1a2 2 0 1 0 -4 0\"/><path d=\"M15 8v-1a2 2 0 1 1 4 0\"/><path d=\"M4 20l3.472 -7.812a2 2 0 0 1 1.828 -1.188h5.4a2 2 0 0 1 1.828 1.188l3.472 7.812\"/><path d=\"M6.192 15.064a2.14 2.14 0 0 1 .475 -.064c.527 -.009 1.026 .178 1.333 .5c.307 .32 .806 .507 1.333 .5c.527 .007 1.026 -.18 1.334 -.5c.307 -.322 .806 -.509 1.333 -.5c.527 -.009 1.026 .178 1.333 .5c.308 .32 .807 .507 1.334 .5c.527 .007 1.026 -.18 1.333 -.5c.307 -.322 .806 -.509 1.333 -.5c.161 .003 .32 .025 .472 .064\"/><path d=\"M12 8v-4\"/>",
"flame":"<path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"/>",
"snowflake":"<line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"22\"/><path d=\"m20 16-4-4 4-4\"/><path d=\"m4 8 4 4-4 4\"/><path d=\"m16 4-4 4-4-4\"/><path d=\"m8 20 4-4 4 4\"/>",
"lightning":"<path d=\"M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973\"/><path d=\"m13 12-3 5h4l-3 5\"/>",
"waves":"<path d=\"M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1\"/><path d=\"M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1\"/><path d=\"M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1\"/>",
"layers":"<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\"/><path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\"/><path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\"/>",
"leaf":"<path d=\"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z\"/><path d=\"M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12\"/>",
"ghost":"<path d=\"M9 10h.01\"/><path d=\"M15 10h.01\"/><path d=\"M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z\"/>",
"brain":"<path d=\"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z\"/><path d=\"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z\"/><path d=\"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4\"/><path d=\"M17.599 6.5a3 3 0 0 0 .399-1.375\"/><path d=\"M6.003 5.125A3 3 0 0 0 6.401 6.5\"/><path d=\"M3.477 10.896a4 4 0 0 1 .585-.396\"/><path d=\"M19.938 10.5a4 4 0 0 1 .585.396\"/><path d=\"M6 18a4 4 0 0 1-1.967-.516\"/><path d=\"M19.967 17.484A4 4 0 0 1 18 18\"/>",
"hourglass":"<path d=\"M5 22h14\"/><path d=\"M5 2h14\"/><path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\"/><path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\"/>",
"eye":"<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
"sparkles":"<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\"/><path d=\"M20 3v4\"/><path d=\"M22 5h-4\"/><path d=\"M4 17v2\"/><path d=\"M5 18H3\"/>",
"opus":"<path d=\"M12 3l-4 7h8l-4 -7\"/><path d=\"M14 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/><path d=\"M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\"/>",
"flask":"<path d=\"M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2\"/><path d=\"M8.5 2h7\"/><path d=\"M7 16h10\"/>",
"hammer":"<path d=\"m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9\"/><path d=\"m18 15 4-4\"/><path d=\"m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5\"/>",
"spiral":"<path d=\"M10 12.057a1.9 1.9 0 0 0 .614 .743c1.06 .713 2.472 .112 3.043 -.919c.839 -1.513 -.022 -3.368 -1.525 -4.08c-2 -.95 -4.371 .154 -5.24 2.086c-1.095 2.432 .29 5.248 2.71 6.246c2.931 1.208 6.283 -.418 7.438 -3.255c1.36 -3.343 -.557 -7.134 -3.896 -8.41c-3.855 -1.474 -8.2 .68 -9.636 4.422c-1.63 4.253 .823 9.024 5.082 10.576c4.778 1.74 10.118 -.941 11.833 -5.59a9.354 9.354 0 0 0 .577 -2.813\"/>",
"runes":"<path d=\"M17 18v-12\"/><path d=\"M13 6l4 4l4 -4\"/><path d=\"M11 18l-7 -8l4 -4l4 4l-7 8\"/>",
"coins":"<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M18.09 10.37A6 6 0 1 1 10.34 18\"/><path d=\"M7 6h1v4\"/><path d=\"m16.71 13.88.7.71-2.82 2.82\"/>",
"tent":"<path d=\"M3.5 21 14 3\"/><path d=\"M20.5 21 10 3\"/><path d=\"M15.5 21 12 15l-3.5 6\"/><path d=\"M2 21h20\"/>",
"factory":"<path d=\"M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\"/><path d=\"M17 18h1\"/><path d=\"M12 18h1\"/><path d=\"M7 18h1\"/>",
"castle":"<path d=\"M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z\"/><path d=\"M18 11V4H6v7\"/><path d=\"M15 22v-4a3 3 0 0 0-3-3a3 3 0 0 0-3 3v4\"/><path d=\"M22 11V9\"/><path d=\"M2 11V9\"/><path d=\"M6 4V2\"/><path d=\"M18 4V2\"/><path d=\"M10 4V2\"/><path d=\"M14 4V2\"/>",
"crown":"<path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z\"/><path d=\"M5 21h14\"/>",
"chevron":"<path d=\"m9 18 6-6-6-6\"/>",
"clipboard":"<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 4V3h6v1M9 13l2 2 4-4\"/>",
"crate":"<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"1\"/><path d=\"M3 11h18M10 7V4h4v3M12 11v3\"/>",
"star":"<path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z\"/>",
"route":"<circle cx=\"6\" cy=\"5\" r=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\"/><path d=\"M8 5h7a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h7\"/>",
"dynamite":"<rect x=\"6\" y=\"9\" width=\"12\" height=\"12\" rx=\"1\"/><path d=\"M6 13h12M12 9V6c0-2 2-3 4-2\"/><path d=\"M18 2.5l.8.8M20 5h1\"/>",
"coffee":"<path d=\"M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z\"/><path d=\"M16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3\"/>",
"lamp":"<path d=\"M8 10h8l1 9H7z\"/><path d=\"M10 10V7a2 2 0 0 1 4 0v3M5 19h14M12 13v3\"/>",
"timecard":"<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 10v2l1.5 1\"/>",
"cart":"<path d=\"M6 10h12l3 8H3z\"/><path d=\"M8.5 10l1-3.5h5l1 3.5\"/>",
"headframe":"<circle cx=\"12\" cy=\"5\" r=\"2.5\"/><path d=\"M6.5 21 10.6 7.2M17.5 21 13.4 7.2M8.4 15h7.2M3.5 21h17M12 7.5V12\"/>",
"lock":"<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
"swap":"<path d=\"M8 3 4 7l4 4\"/><path d=\"M4 7h16\"/><path d=\"m16 21 4-4-4-4\"/><path d=\"M20 17H4\"/>",
"trend":"<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"/><polyline points=\"16 7 22 7 22 13\"/>",
"target":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
"landmark":"<line x1=\"3\" x2=\"21\" y1=\"22\" y2=\"22\"/><line x1=\"6\" x2=\"6\" y1=\"18\" y2=\"11\"/><line x1=\"10\" x2=\"10\" y1=\"18\" y2=\"11\"/><line x1=\"14\" x2=\"14\" y1=\"18\" y2=\"11\"/><line x1=\"18\" x2=\"18\" y1=\"18\" y2=\"11\"/><polygon points=\"12 2 20 7 4 7\"/>"};
function icon(name, size = 20, color) {
  return `<svg class="i" viewBox="0 0 24 24" width="${+(size * 0.855).toFixed(1)}" height="${+(size * 0.855).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${color ? ` style="color:${color}"` : ''}>${ICON_PATHS[name]}</svg>`;
}

// ===== Resonance: the one link between the modes =====
// Every gem design unlocked on one mode's goal tab gives +5% output in the other two (see updateResonance in app.js,
// which keeps this table current; modes only read it, so their economies stay independent otherwise)
const RESONANCE_STEP = 0.05;
const RESONANCE = {};
const resonance = (key) => RESONANCE[key] || 1;

// ===== Storage =====
// Every save lives under its own key
function readStored(key) {
  try {
    const v = localStorage.getItem(key);
    return v;
  } catch (e) {
    return null;
  }
}

// ===== Settings: shared by every mode, saved on their own =====
const SETTINGS_KEY = 'df_settings';
const settings = Object.assign(
  { mode: 'industrialist', format: 0, effects: true, modes: { industrialist: true, capitalist: true, communist: true }, lastExport: 0, tutorialSeen: {}, hints: {}, tabs: {} },
  (() => {
    try {
      return JSON.parse(readStored(SETTINGS_KEY)) || {};
    } catch (e) {
      return {};
    }
  })(),
);
delete settings.sound; // the game has no sound
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

// ===== Number formatting: short names up to Centillion (1e303) =====
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
{
  const units = ['', 'U', 'D', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
  const tens = ['', 'Dc', 'Vg', 'Tg', 'Qag', 'Qig', 'Sxg', 'Spg', 'Ocg', 'Nog'];
  for (let n = 10; n < 100; n++) SUFFIXES.push(units[n % 10] + tens[Math.floor(n / 10)]);
  SUFFIXES.push('Ce');
}
const FORMAT_NAMES = ['Short (1.23M)', 'Scientific (1.23e6)', 'Engineering (12.3e6)'];
function fmt(n) {
  if (Number.isNaN(n)) return '0';
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 999.5) return n < 10 ? n.toFixed(2) : n.toFixed(n < 100 ? 1 : 0);
  if (settings.format === 1) return n.toExponential(2).replace('+', '');
  let e = Math.floor(Math.log10(n) / 3),
    m = n / 10 ** (e * 3);
  if (m >= 999.995 || e === 0) (e++, (m /= 1e3)); // keep 999,999.99 from showing as 1000.00K, and 999.7 as 1000
  if (settings.format === 2) return m.toFixed(2) + 'e' + e * 3;
  return e < SUFFIXES.length ? m.toFixed(2) + SUFFIXES[e] : n.toExponential(2).replace('+', '');
}
const count = (n) => (n < 1e3 ? String(Math.floor(n + 1e-9)) : fmt(n)); // whole things: Arcana, Dark Matter, producers
const money = (n) => '₲' + fmt(n); // ₲: gold
const duration = (s) =>
  s < 60 ? s.toFixed(s < 1 ? 2 : 1) + 's' : s < 3600 ? (s / 60).toFixed(1) + 'm' : s < 172800 ? (s / 3600).toFixed(1) + 'h' : (s / 86400).toFixed(1) + 'd';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const plain = (n) => (n < 1e5 ? n.toLocaleString('en-US') : 1 + SUFFIXES[Math.round(Math.log10(n) / 3)]); // 1,000 · 10,000 · 1M · 1B
const times = (n) => (n === 1 ? 'once' : n + ' times');

// ===== Rendering building blocks =====
// Text and HTML are only written when they change. Tab panes are rebuilt a few times a second
function setText(el, text) {
  if (el._text !== text) el.textContent = el._text = text;
}
function setHTML(el, html) {
  if (el._html !== html) el.innerHTML = el._html = html;
}
// Live values: numbers that change every moment (timers, amounts, progress) are marked, so a pane whose layout hasn't
// changed only gets those numbers updated in place. The page isn't rebuilt under your finger while you tap
const live = (text) => `<span data-live>${text}</span>`;
// Progress fills are drawn at full width and scaled (a transform, so a moving bar never re-lays-out the page)
const scaleOf = (pct) => 'scaleX(' + (Math.min(1, Math.max(0, pct / 100)) || 0).toFixed(3) + ')';
// Pixel bars (.px: see PixBar) take their progress as translateX, which their canvas reads
const moveOf = (pct) => 'translateX(' + (Math.min(100, Math.max(0, pct)) || 0).toFixed(1) + '%)';
// act: the bar's producer is running (pixel bars twinkle then, so a bar that sits full still shows it's working)
const fillTo = (el, pct, act) => {
  if (act !== undefined) el._act = act;
  if (el._mv === undefined) el._mv = el.tagName === 'I' && !!el.parentElement && /\bpx\b/.test(el.parentElement.className);
  const v = el._mv ? moveOf(pct) : scaleOf(pct);
  if (el._f !== v) el.style.transform = el._f = v;
};
const liveBar = (pct, mt) => `<i data-live-bar style="transform:${mt ? moveOf(pct) : scaleOf(pct)}"></i>`;
// ===== Pixel bars: progress that builds up, is dug away, or travels, in bits and pieces =====
// A bar with class "px" is drawn on a small canvas as a grid of cells in its color (--c). Each cell has a fixed random
// offset, so an edge is a scatter of loose bits instead of a straight line. Three kinds:
//   px        fills: pixels collect from the left, a few strays drifting in ahead of the front
//   px dig    a seam: starts full and is chipped back from the left, the chips falling into the dug-out tunnel
//   px move   a load in transit: a block of pixels travels from left to right, emptying behind itself
//   px up     fills from the bottom up (the elevator's car)
// The progress still comes from the bar's <i> (fillTo / liveBar, as translateX), so the game's numbers are untouched.
// Smooth at any update rate: the game may report progress ten times a second (or three, for panes), so each bar keeps
// its own speed estimate and glides between reports, and a jump (a cycle ending, a tab opening) eases over a fifth of
// a second instead of popping. A working bar twinkles a little, in its own color, so a bar that sits full because
// production is too fast still reads as busy.
// Cost: one shared animation loop; bars off screen are skipped; only cells near an edge are checked each frame, and
// only cells that changed (plus the few twinkles and chips) are repainted.
const PixBar = (() => {
  const CELL = 3, BAND = 0.16, LOAD = 0.34, ROCK = ['#463f3a', '#4f4741', '#3c3531', '#564c45'];
  const all = document.getElementsByClassName('px'); // live: bars rebuilt by a pane re-render are picked up on their own
  const rgb = (c) => {
    c = (c || '#999').trim().replace('#', '');
    if (c.length === 3) c = [...c].map((x) => x + x).join('');
    return [0, 2, 4].map((k) => parseInt(c.slice(k, k + 2), 16) || 0);
  };
  const tone = (c, t) => '#' + rgb(c).map((v) => Math.round(v + ((t < 0 ? 0 : 255) - v) * Math.abs(t)).toString(16).padStart(2, '0')).join('');
  const calm = () => reducedMotion || !settings.effects;
  let seen = null, sized = null;
  if (window.IntersectionObserver) seen = new IntersectionObserver((es) => es.forEach((e) => e.target._px && (e.target._px.vis = e.isIntersecting)));
  if (window.ResizeObserver) sized = new ResizeObserver((es) => es.forEach((e) => e.target._px && (e.target._px.dirty = 2)));

  function setup(el) {
    const cv = document.createElement('canvas');
    cv.className = 'pxc';
    el.insertBefore(cv, el.firstChild);
    const kind = el.classList.contains('dig') ? 'dig' : el.classList.contains('move') ? 'move' : 'fill', up = el.classList.contains('up');
    const P = { el, cv, ctx: cv.getContext('2d'), fill: el.querySelector('i'), kind, up, vis: !seen, dirty: 2, raw: null, tgt: 0, tAt: 0, vel: 0, shown: 0, last: 0, ease: false, moved: 0, cells: [], debris: [], tw: [], act: false, };
    el._px = P;
    if (seen) seen.observe(el);
    if (sized) sized.observe(el);
    return P;
  }
  // (re)build the cell grid for the bar's size and color
  function layout(P) {
    const W = P.el.clientWidth, H = P.el.clientHeight, col = getComputedStyle(P.el).getPropertyValue('--c').trim() || '#b4a7e0';
    if (!W || !H) return false;
    const dpr = 1; // cells are whole CSS pixels and the canvas is shown pixelated: a 1:1 canvas looks the same and costs a fraction
    Object.assign(P, { W, H, col, dpr, cols: Math.ceil(W / CELL), rows: Math.ceil(H / CELL) });
    P.cv.width = Math.round(W * dpr);
    P.cv.height = Math.round(H * dpr);
    const shades = P.kind === 'dig' ? ROCK : [tone(col, -0.3), tone(col, -0.2), tone(col, -0.38), tone(col, -0.08)];
    const vein = [tone(col, -0.1), col, tone(col, -0.25)];
    let s = 9 + P.cols;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    P.cells = [];
    for (let y = 0; y < P.rows; y++)
      for (let x = 0; x < P.cols; x++) {
        let c = shades[Math.floor(rnd() * shades.length)];
        if (P.kind === 'dig' && rnd() < 0.18) c = vein[Math.floor(rnd() * vein.length)]; // the ore showing in the rock
        P.cells.push({ x, y, t: (P.up ? 1 - (y + 0.5) / P.rows : (x + 0.5) / P.cols) + BAND * (rnd() - 0.5), c, lt: tone(c, 0.22), on: false });
      }
    P.byT = P.cells.slice().sort((x, y) => x.t - y.t);
    P.lastE = null;
    for (const c of P.cells) c.on = isOn(P, c, edges(P, P.shown));
    P.debris.length = 0;
    return true;
  }
  // where the edges are for a shown progress p: [head, tail] in cell-threshold units
  function edges(P, p) {
    if (P.kind === 'move') {
      const h = p * (1 + LOAD + BAND) - BAND / 2;
      return [h, h - LOAD];
    }
    return [p * (1 + BAND) - BAND / 2, -9];
  }
  const isOn = (P, c, [h, tl]) => (P.kind === 'dig' ? h < c.t : P.kind === 'move' ? c.t <= h && c.t > tl : h >= c.t);
  // the reported progress, read from the <i> the game writes; updates the speed estimate
  function read(P, now) {
    const s = P.fill ? P.fill.style.transform : '';
    if (s === P.raw) return false;
    const first = P.raw === null;
    P.raw = s;
    const m = /translateX\(([-\d.]+)%\)/.exec(s), v = m ? Math.max(0, Math.min(1, m[1] / 100)) : 0;
    const d = v - P.tgt, dt = now - P.tAt;
    if (first) (P.shown = v), (P.vel = 0);
    else if (d < -0.25) {
      // a cycle ended. A load in transit finishes leaving before the next one comes in; other bars ease back
      P.vel = 0;
      if (P.kind === 'move') P.exit = true;
      else P.ease = true;
      (P.wraps || (P.wraps = [])).push(now);
      if (P.wraps.length > 4) P.wraps.shift();
    } else if (d > 0.4) (P.vel = 0), (P.ease = true); // something jumped: ease across
    else if (d > 0 && dt > 0 && dt < 600) P.vel = P.vel ? P.vel * 0.5 + (d / dt) * 0.5 : d / dt;
    else if (d <= 0) P.vel = 0;
    P.tgt = v;
    P.tAt = now;
    P.moved = now;
    return true;
  }
  // moves the shown progress toward the report: gliding at the estimated speed, easing over big gaps
  function advance(P, now) {
    const dt = Math.min(100, now - (P.last || now));
    P.last = now;
    // Cycles too fast to follow (under ~0.7 s each) would make the bar flicker, so it settles into a steady look
    // instead: a filling bar stays full, a seam stays whole (its face still sheds chips), and a load in transit becomes
    // an even stream of loads gliding through. It goes back to following each cycle once they slow down again
    const W = P.wraps, steady = W && W.length >= 3 && now - W[W.length - 1] < 1500 && (W[W.length - 1] - W[0]) / (W.length - 1) < 700;
    if (steady !== !!P.steady) (P.steady = steady), (P.ease = true), (P.exit = false);
    if (steady) {
      if (P.kind === 'move') return (P.shown = (now % 1300) / 1300), true;
      const goal = P.kind === 'dig' ? 0 : 1;
      P.shown += (goal - P.shown) * (1 - Math.exp(-dt / 70));
      return Math.abs(goal - P.shown) > 0.001;
    }
    if (P.exit) {
      P.shown = Math.min(1, P.shown + dt / 160); // the load slides the rest of the way out
      if (P.shown < 1) return true;
      P.exit = false;
      P.shown = P.tgt; // and the next one starts from the left
      return true;
    }
    const pred = Math.min(1, P.tgt + P.vel * Math.min(now - P.tAt, 220));
    const diff = pred - P.shown;
    if (P.ease || Math.abs(diff) > 0.12) {
      P.shown += diff * (1 - Math.exp(-dt / 55));
      if (Math.abs(pred - P.shown) < 0.004) (P.shown = pred), (P.ease = false);
    } else if (diff < 0) P.shown += diff * (1 - Math.exp(-dt / 80)); // a small step back: drift, don't snap
    else P.shown = pred;
    return Math.abs(pred - P.shown) > 0.0005 || P.vel > 0;
  }
  // the cells whose state can change are those near an edge: a slice of the cells sorted by threshold
  function slice(P, e) {
    const A = P.byT, lo = e - BAND - 0.01, hi = e + BAND + 0.01;
    let l = 0, r = A.length;
    while (l < r) {
      const m = (l + r) >> 1;
      if (A[m].t < lo) l = m + 1;
      else r = m;
    }
    let k = l;
    while (k < A.length && A[k].t <= hi) k++;
    return [l, k];
  }
  // brings every cell up to date with the shown progress and lists the ones that changed. Only the cells near an
  // edge are looked at, unless an edge has jumped further than that since the last frame (then: a full repaint)
  function update(P, now, quiet) {
    const E = edges(P, P.shown), far = !P.lastE || Math.abs(E[0] - P.lastE[0]) > BAND / 2 || Math.abs(E[1] - P.lastE[1]) > BAND / 2;
    P.lastE = E;
    const ch = P.changed || (P.changed = []); // kept until the next paint
    const visit = (c) => {
      const on = isOn(P, c, E);
      if (on === c.on) return;
      c.on = on;
      ch.push(c);
      // a chip breaks off the seam and falls into the tunnel
      if (P.kind === 'dig' && !on && !quiet && P.debris.length < 60 && now - P.moved < 300) P.debris.push({ x: c.x * CELL, y: c.y * CELL, vx: -(15 + Math.random() * 40), vy: -(8 + Math.random() * 22), at: now, c: c.c });
    };
    if (far) {
      for (const c of P.cells) visit(c);
      P.full = true;
    } else for (const r of P.kind === 'move' ? [slice(P, E[1]), slice(P, E[0])] : [slice(P, E[0])]) for (let n = r[0]; n < r[1]; n++) visit(P.byT[n]);
    return ch.length > 0 || P.full;
  }
  // one cell as it is: its color, or empty
  function paint(P, c) {
    if (c.on) {
      P.ctx.fillStyle = c.c;
      P.ctx.fillRect(c.x * CELL, c.y * CELL, CELL, CELL);
    } else P.ctx.clearRect(c.x * CELL, c.y * CELL, CELL, CELL);
  }
  // puts back the cells under a rectangle something was drawn over last time
  function restore(P, x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x / CELL)), x1 = Math.min(P.cols - 1, Math.floor((x + w - 0.01) / CELL));
    const y0 = Math.max(0, Math.floor(y / CELL)), y1 = Math.min(P.rows - 1, Math.floor((y + h - 0.01) / CELL));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) paint(P, P.cells[yy * P.cols + xx]);
  }
  // Drawing touches only what changed: cells that flipped, and the few marks laid over the bar (twinkles, falling
  // chips, drifting bits), which are rubbed out from the frame before. A full repaint only after a resize or a jump
  function draw(P, now) {
    const { ctx, cols } = P, quiet = calm();
    const [h] = P.lastE;
    P.drawn = now;
    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    if (P.full) {
      P.full = false;
      ctx.clearRect(0, 0, P.W + CELL, P.H + CELL);
      for (const c of P.cells) if (c.on) paint(P, c);
      P.marks = [];
    } else {
      for (const m of P.marks || []) restore(P, m[0], m[1], m[2], m[3]);
      for (const c of P.changed) paint(P, c);
    }
    P.changed = [];
    const marks = (P.marks = []);
    const mark = (x, y, w, h2, color, alpha) => {
      if (x + w <= 0 || y + h2 <= 0 || x >= P.W || y >= P.H || alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h2);
      marks.push([x, y, w, h2]);
    };
    let busy = false;
    // a few loose bits drifting in just ahead of a moving front
    if (P.kind !== 'dig' && !P.up && !quiet && P.shown > 0 && P.shown < 1 && now - P.moved < 400) {
      busy = true;
      for (let k = 0; k < 4; k++) {
        const ph = (now / 700 + k * 0.37) % 1, x = Math.round(((h + BAND * 0.55 + (1 - ph) * 0.08) * P.W) / CELL) * CELL;
        if (x >= P.W) continue;
        const under = P.cells[((k * 2) % P.rows) * cols + Math.min(cols - 1, x / CELL)];
        if (under && under.on) continue; // only into empty space
        mark(x, ((k * 2) % P.rows) * CELL, CELL, CELL, P.cells[(k * 7) % P.cells.length].c, ph * 0.85);
      }
    }
    // a working bar twinkles: a few of its own pixels brighten a shade and fade back. A seam that isn't moving keeps
    // shedding the odd chip from its face
    // (a bar that is visibly moving needs no twinkle to look busy: only a still one gets it)
    if (P.act && !quiet && (P.vel === 0 || P.shown >= 0.999 || P.shown <= 0.001)) {
      busy = true;
      if (now - (P.twAt || 0) > 120) {
        P.twAt = now;
        for (let n = 0, tries = 0; n < 1 && tries < 12; tries++) {
          const c = P.cells[Math.floor(Math.random() * P.cells.length)];
          if (c.on) P.tw.push({ c, at: now }), n++;
        }
        if (P.kind === 'dig' && now - P.moved > 300 && Math.random() < 0.35 && P.debris.length < 30) {
          const face = P.cells.filter((c) => c.on && c.t < h + BAND);
          const c = face[Math.floor(Math.random() * face.length)];
          if (c) P.debris.push({ x: c.x * CELL, y: c.y * CELL, vx: -(15 + Math.random() * 40), vy: -(8 + Math.random() * 22), at: now, c: c.c });
        }
      }
    }
    for (let i = P.tw.length - 1; i >= 0; i--) {
      const w = P.tw[i], t = (now - w.at) / 450;
      if (t >= 1 || !w.c.on) {
        P.tw.splice(i, 1);
        continue;
      }
      busy = true;
      mark(w.c.x * CELL, w.c.y * CELL, CELL, CELL, w.c.lt, Math.sin(t * Math.PI));
    }
    for (let i = P.debris.length - 1; i >= 0; i--) {
      const d = P.debris[i], t = (now - d.at) / 1000;
      if (t > 0.55) {
        P.debris.splice(i, 1);
        continue;
      }
      busy = true;
      mark(Math.round(d.x + d.vx * t), Math.round(d.y + d.vy * t + 240 * t * t), CELL - 1, CELL - 1, d.c, 1 - t / 0.55);
    }
    ctx.globalAlpha = 1;
    return busy || marks.length > 0; // marks on screen must be rubbed out next time
  }
  function frame(now) {
    if (!document.hidden)
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (!el.classList.contains('bar')) continue;
        const P = el._px || setup(el);
        if (!P.vis) {
          P.last = 0;
          continue;
        }
        read(P, now);
        P.act = !!(P.fill && P.fill._act);
        if (P.dirty === 2) {
          P.shown = P.tgt; // coming into view or resized: show where it is now, without animating from elsewhere
          P.ease = false;
          if (!layout(P)) continue;
          P.dirty = 1;
          P.full = true;
        }
        advance(P, now);
        const cellsChanged = update(P, now, calm());
        // repaint whenever a cell changed or something is in flight: every frame, for the smoothest motion
        if (cellsChanged || P.dirty || P.busy || P.act) {
          if (P.dirty) P.full = true;
          P.busy = draw(P, now);
          P.dirty = 0;
        }
      }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { refresh: () => { for (const el of all) if (el._px) el._px.dirty = 2; } };
})();

const LIVE_PARTS = /(<span data-live>)[^<]*(<\/span>)|(<i data-live-bar style="transform:)[^"]*(">)/g;
const liveScratch = document.createElement('template');
function setPane(el, html) {
  if (el._html === html) return;
  const shape = html.replace(LIVE_PARTS, '$1$2$3$4');
  if (el._shape !== shape) {
    el.innerHTML = html;
  } else {
    liveScratch.innerHTML = html;
    const fresh = liveScratch.content.querySelectorAll('[data-live],[data-live-bar]'), old = el.querySelectorAll('[data-live],[data-live-bar]');
    fresh.forEach((f, k) => {
      if (!old[k]) return;
      if (f.hasAttribute('data-live-bar')) old[k].style.transform = f.style.transform;
      else if (old[k].textContent !== f.textContent) old[k].textContent = f.textContent;
    });
  }
  el._html = html;
  el._shape = shape;
}
const openFolds = new Set(); // which "How it works" and similar sections are open, kept across re-renders
const fold = (key, title, body) =>
  `<details class="fold small" data-fold="${key}"${openFolds.has(key) ? ' open' : ''}><summary data-a="fold" data-i="${key}">${title}</summary>${body}</details>`;
const btn = (action, arg, label, ok) => `<button class="${ok ? '' : 'dis'}" data-a="${action}" data-i="${arg}">${label}</button>`;
const bigButton = (action, label, ok) => `<button class="big buy${ok ? '' : ' dis'}" data-a="${action}" data-i="0">${label}</button>`;
const row = (title, desc, right, cls = '') => `<div class="row${cls}"><div><b>${title}</b><small>${desc}</small></div>${right}</div>`;
const section = (title) => `<h3 class="sec">${title}</h3>`;
const tip = (text) => `<p class="tip">${text}</p>`;
const owned_ = (label) => `<b class="ok">${label}</b>`; // "Owned", "Claimed", "Full" and similar
// Show what's useful now and fold the rest away: everything ready or affordable, then the next few, then a fold for later
function shortList(items, ready, rowFor, key, laterLabel, next = 3) {
  const now = items.filter(ready), rest = items.filter((x) => !ready(x));
  const later = rest.slice(next);
  return [...now, ...rest.slice(0, next)].map(rowFor).join('') + (later.length ? fold(key, `${laterLabel} (${later.length})`, later.map(rowFor).join('')) : '');
}
const byCost = (a, b) => a.cost - b.cost;

// ===== Saves: loading a mode's data safely =====
// Saved data is laid over the mode's fresh state. Anything missing, of the wrong type, negative or not a finite number
// falls back to its starting value, lists are fitted to the length the mode expects, and keys the mode no longer uses are
// dropped, so an older, damaged or hand-edited save still plays
function mergeSave(fresh, raw) {
  if (!raw || typeof raw !== 'object') return fresh;
  const num = (v, d) => (v !== null && v !== '' && Number.isFinite(+v) && +v >= 0 ? +v : d);
  const fit = (d, v) => d.map((x, i) => (Array.isArray(x) ? fit(x, Array.isArray(v) ? v[i] : null) : num(Array.isArray(v) ? v[i] : null, x)));
  for (const [k, d] of Object.entries(fresh)) {
    const v = raw[k];
    if (Array.isArray(d)) fresh[k] = fit(d, v);
    else if (typeof d === 'number') fresh[k] = num(v, d);
    else if (d && typeof d === 'object') fresh[k] = v && typeof v === 'object' && !Array.isArray(v) ? v : d;
    else if (typeof v === typeof d) fresh[k] = v;
  }
  return fresh;
}

// ===== Pieces both modes build their content from =====
const plural = (name) => (/y$/.test(name) ? name.slice(0, -1) + 'ies' : /(sh|ch|s|x)$/.test(name) ? name + 'es' : name + 's');
const upgradeDef = ([id, name, desc, cost, fx]) => ({ id, name, desc, cost, fx }); // research, Dark Matter and rune upgrades
const arcanaPrice = (n) => icon('flask', 14) + ' ' + count(n);
const dmPrice = (n) => icon('spiral', 14) + ' ' + count(n);
// Dark Matter's bonus: `per` for each one up to 1,000, then growing with the cube root
const dmBonusFor = (per, n) => (n <= 1e3 ? per * n : per * 1e3 * Math.cbrt(n / 1e3));
// One achievement per value: "Hoarder ₲1M", "Hoarder ₲1B"...
function achievementTiers(list, values, id, name, desc, done) {
  values.forEach((v) => list.push({ id: id + '-' + v, name: name(v), desc: desc(v), done: () => done(v) }));
}
// Marks newly reached achievements (+1% each to `what`) and says so. Returns how many there were
function claimAchievements(list, got, what) {
  const fresh = list.filter((a) => !got[a.id] && a.done());
  fresh.forEach((a) => (got[a.id] = 1));
  if (fresh.length >= 3) toast(`${fresh.length} achievements unlocked (+${fresh.length}% ${what})`);
  else if (fresh.length) toast(`Achievement${fresh.length > 1 ? 's' : ''}: ${fresh.map((a) => a.name).join(', ')} (+1% ${what}${fresh.length > 1 ? ' each' : ''})`);
  return fresh.length;
}
// Quests: [id, name, Arcana reward, current value, target, unit ('money', 'percent' or a plain count)]
const questDef = ([id, name, reward, value, target, unit]) => ({ id, name, reward, value, target, unit, done: () => value() >= target });
function questSection(quests, claimed, bonusText) {
  const show = (m) => (m.unit === 'money' ? money : m.unit === 'percent' ? (n) => n.toFixed(1) + '%' : count);
  const progress = (m) => `${show(m)(Math.min(m.value(), m.target))} / ${show(m)(m.target)}`;
  const reward = (m) => `Reward: ${icon('flask', 12)} ${count(m.reward)} Arcana`;
  const questRow = (m) =>
    claimed[m.id] ? row(m.name, reward(m), owned_('Claimed')) : row(m.name, `${live(progress(m))} · ${reward(m)}`, btn('quest', m.id, 'Claim', m.done()));
  const open = quests.filter((m) => !claimed[m.id]), done = quests.filter((m) => claimed[m.id]);
  open.sort((a, b) => Math.min(1, b.value() / b.target) - Math.min(1, a.value() / a.target)); // nearest goals first
  return (
    section('Quests') + tip(bonusText) +
    (open.length ? shortList(open, (m) => m.done(), questRow, 'quests-upcoming', 'Upcoming quests') : tip('Every quest is claimed.')) +
    (done.length ? fold('quests-claimed', `Claimed quests (${done.length})`, done.map(questRow).join('')) : '')
  );
}
// A list of upgrades bought with one currency: what you can afford and the next few, the rest and the owned ones folded
function upgradeList(list, owned, o) {
  // o.why(u), if given: one short line on what this would do for the game as it stands right now
  const why = (u) => (o.why && !owned[u.id] ? o.why(u) : '');
  const upRow = (u) => row(u.name, u.desc + (why(u) ? `<i class="why">${why(u)}</i>` : ''), owned[u.id] ? owned_(o.ownedLabel || 'Owned') : btn(o.action, u.id, o.price(u.cost), o.funds >= u.cost));
  const open = list.filter((u) => !owned[u.id]).sort(byCost), have = list.filter((u) => owned[u.id]);
  return (
    (open.length ? shortList(open, (u) => o.funds >= u.cost, upRow, o.key + '-later', o.later) : tip(o.allDone)) +
    (have.length ? fold(o.key + (o.doneKey || '-owned'), `${o.doneLabel || 'Owned'} (${have.length})`, have.map(upRow).join('')) : '')
  );
}
// The hint under the Transmute button
function transmuteHint(p, dm, firstAt) {
  if (!p) return dm ? 'Nothing to gain from transmuting yet. Keep earning.' : `You can first transmute at ${money(firstAt)} earned.`;
  if (!dm) return `Your first transmutation gives +${count(p)} Dark Matter.`;
  const r = (dm + p) / dm;
  return `Transmuting now multiplies your Dark Matter by ×${r < 1e3 ? r.toFixed(2) : fmt(r)}. ` + (r >= 2 ? 'Good time to transmute.' : 'Most players wait for ×2 or more.');
}
// Magnum Opus tab: the daily tribute and the elixir, then stats, then (as the second pane) achievements
function bonusRows(s, dailyText, elixir, elixirText, boosted) {
  const now = Date.now();
  const claim = (readyAt, action, label) => (now >= readyAt ? btn(action, 0, label, true) : `<small>${live(duration((readyAt - now) / 1000))}</small>`);
  return (
    section('Bonuses') +
    row('Daily tribute', dailyText, claim(s.dailyReadyAt, 'daily', 'Claim')) +
    row(elixir, elixirText + (boosted ? ' · active ' + live(duration((s.boostEndsAt - now) / 1000)) : ''), claim(s.boostReadyAt, 'boost', 'Drink'))
  );
}
const statRows = (stats) => section('Stats') + stats.map(([k, v]) => `<div class="row st"><span>${k}</span><b>${live(v)}</b></div>`).join('');
function achievementSection(list, got, what) {
  const earned = list.filter((a) => got[a.id]), locked = list.filter((a) => !got[a.id]);
  const achRow = (a, has) => row(a.name, a.desc, has ? owned_('+1%') : '', has ? '' : ' done');
  return (
    section(`Achievements ${earned.length} / ${list.length} · +${earned.length}% ${what}`) +
    (earned.length ? fold('earned', `Show unlocked (${earned.length})`, earned.map((a) => achRow(a, true)).join('')) : '') +
    (locked.length ? fold('locked', `Show locked (${locked.length})`, locked.map((a) => achRow(a, false)).join('')) : '')
  );
}

// ===== After the Philosopher's Stone (both modes) =====
// A mode can be played again from the start as a new Great Work: achievements, stats and the record stay, and every
// Stone forged so far makes the new Work ×3 stronger
const STONE_POWER = 3;
const workTime = (s) => s.wonAt - s.workStart;
function forgedPanel(s, what) {
  const best = s.bestWork ? Math.min(s.bestWork, workTime(s)) : 0;
  return (
    `<div class="row panel center"><b>The Philosopher's Stone is forged</b><small>This Great Work took ${duration(workTime(s))} of play${best ? ` · your fastest: ${duration(best)}` : ''}.</small>` +
    `<small>Begin a new Great Work to play this mode again from the start, keeping your achievements, with ×${STONE_POWER ** (s.stones + 1)} ${what} from the ${s.stones + 1 > 1 ? s.stones + 1 + ' Stones' : 'Stone'} you've forged. Or keep playing this one to finish what's left.</small></div>` +
    bigButton('newWork', armed === 'newWork' ? 'Tap again to begin anew' : 'Begin a new Great Work', true)
  );
}
// What carries into a new Great Work
const newWorkCarry = (s) => ({
  stones: s.stones + 1, bestWork: s.bestWork ? Math.min(s.bestWork, workTime(s)) : workTime(s), workStart: s.playTime,
  achievements: s.achievements, taps: s.taps, playTime: s.playTime, bestIncome: s.bestIncome,
  dailyReadyAt: s.dailyReadyAt, boostReadyAt: s.boostReadyAt,
});

// ===== Toasts and confirming taps =====
let toastTimer;
function toast(html) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
let armed = ''; // an action waiting for its confirming second tap
function confirmTap(key) {
  if (armed === key) return !(armed = '');
  armed = key;
  setTimeout(() => {
    if (armed === key) {
      armed = '';
      render(true);
    }
  }, 4000);
  return false;
}

// ===== Polish: animations that answer the player =====
// The interface stays calm; the size of the reaction matches the size of the moment:
//   everyday taps (buying, offering) → the card gives a small bump and the amount floats up
//   rewards (research, quests, enchantments) → a small burst of particles as well
//   unlocks (a new mine, industry or producer) → a larger burst; big milestones → confetti; resets → full cinematics
// The numbers in the top boxes count rather than jump. All of it is skipped with Low visual effects or when the
// device asks for reduced motion.
const Polish = (() => {
  const layer = document.createElement('div');
  layer.id = 'fxl';
  document.body.appendChild(layer);
  const on = () => !reducedMotion && settings.effects;
  const accent = () => document.documentElement.style.getPropertyValue('--acc').trim() || '#b4a7e0';
  const PALETTE = ['#dcc795', '#c79c84', '#aab1bd', '#b4a7e0', '#93c4bd', '#d9a6b1']; // champagne, copper, iron, lavender, teal, rose
  const add = (cls, css, life) => {
    if (layer.childElementCount >= 120) return document.createElement('span'); // a flood of effects thins out instead of piling up
    const e = document.createElement('span');
    e.className = cls;
    e.style.cssText = css;
    layer.appendChild(e);
    setTimeout(() => e.remove(), life);
    return e;
  };
  // A burst of small particles from a point
  function burst(x, y, color, n = 8, spread = 48) {
    if (!on()) return;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.283 + Math.random() * 0.6, d = spread * (0.55 + Math.random() * 0.6);
      const c = Math.random() < 0.7 ? color : PALETTE[(Math.random() * PALETTE.length) | 0];
      add('pt', `left:${x}px;top:${y}px;--c:${c};--s:${3 + Math.random() * 4}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 10}px;--r:${Math.random() * 360}deg`, 700);
    }
  }
  // Text that floats up from a point: "+10", "+₲1.2K"
  function floatText(x, y, text, color) {
    if (!on() || !text) return;
    add('ft', `left:${x}px;top:${y}px;--c:${color}`, 950).textContent = text;
  }
  // Confetti falling from the top of the screen, for the biggest milestones
  function confetti(n = 60) {
    if (!on()) return;
    for (let k = 0; k < n; k++)
      add(
        'cf',
        `left:${Math.random() * 100}%;--c:${PALETTE[k % PALETTE.length]};--dx:${(Math.random() - 0.5) * 120}px;--r:${(Math.random() - 0.5) * 900}deg;--t:${1.3 + Math.random() * 1.1}s;animation-delay:${Math.random() * 0.4}s`,
        2900,
      );
  }
  // Sparks, Industrialist's confetti: showers of hot sparks thrown up from a few points along the bottom of the screen,
  // as off a grinder or a forge. Each one flies on its own arc, pointed along its path, and cools from white to red
  function sparks(n = 50) {
    if (!on()) return;
    const W = innerWidth, H = innerHeight, src = [0.25, 0.5, 0.75].map((f) => W * (f + (Math.random() - 0.5) * 0.12));
    for (let k = 0; k < n; k++) {
      const x0 = src[k % 3], y0 = H * (0.82 + Math.random() * 0.06);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3, sp = H * (0.75 + Math.random() * 0.55), g = H * 1.6, T = 0.9 + Math.random() * 0.7;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const e = add('spk', `left:${x0}px;top:${y0}px`, (T + 0.3) * 1000);
      if (!e.animate) continue;
      const frames = [];
      for (let i = 0; i <= 8; i++) {
        const t = (i / 8) * T, x = vx * t, y = vy * t + 0.5 * g * t * t, a = Math.atan2(vy + g * t, vx) + Math.PI / 2;
        frames.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${a.toFixed(2)}rad)`, opacity: i < 6 ? 1 : 1 - (i - 5) / 3.2, filter: `hue-rotate(${-i * 4}deg) brightness(${1.3 - i * 0.07})` });
      }
      e.animate(frames, { duration: T * 1000, delay: Math.random() * 350, easing: 'linear', fill: 'both' });
    }
  }
  // Bits knocked loose from a point (rock chips off rubble, shards off a geode): flung up and out, tumbling as they fall
  function chips(x, y, colors, n = 10, power = 1) {
    if (!on()) return;
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = (140 + Math.random() * 220) * power, g = 900, T = 0.55 + Math.random() * 0.35;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, size = 3 + Math.random() * 4 * power, spin = (Math.random() - 0.5) * 1080;
      const e = add('chip', `left:${x}px;top:${y}px;width:${size.toFixed(1)}px;height:${(size * (0.6 + Math.random() * 0.6)).toFixed(1)}px;background:${colors[k % colors.length]}`, (T + 0.1) * 1000);
      if (!e.animate) continue;
      const frames = [];
      for (let i = 0; i <= 6; i++) {
        const t = (i / 6) * T;
        frames.push({ transform: `translate(${(vx * t).toFixed(1)}px,${(vy * t + 0.5 * g * t * t).toFixed(1)}px) rotate(${(spin * (i / 6)).toFixed(0)}deg)`, opacity: i < 4 ? 1 : 1 - (i - 3) / 3 });
      }
      e.animate(frames, { duration: T * 1000, easing: 'linear', fill: 'both' });
    }
  }
  // Replays a one-shot animation class on an element
  function restart(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el['_' + cls]);
    el['_' + cls] = setTimeout(() => el.classList.remove(cls), 800);
  }
  // A larger moment centered on an element: something new was unlocked
  function unlock(el, color) {
    if (!el) return;
    restart(el, 'reveal');
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, color || accent(), 18, 90);
  }
  // A number on screen eases toward its real value instead of jumping (it counts up as you earn, down as you spend)
  function count(el, value, format) {
    const shown = el._shown;
    let n = value;
    if (on() && shown > 0 && value > 0 && isFinite(shown) && isFinite(value)) {
      const r = value / shown;
      if (Math.abs(Math.log(r)) > 0.0005) n = shown * r ** 0.35;
    }
    el._shown = n;
    setText(el, format(n));
  }
  // Feedback for an action: called before it runs (to remember where the tap was) and after (to react if it worked)
  const REWARD = new Set(['discover', 'research', 'quest', 'dmUpgrade', 'runeUpgrade', 'catalyst', 'daily', 'boost', 'enchant', 'enchantAll', 'summonAll', 'upgradeAll', 'offerAll', 'lab']);
  const EVERYDAY = new Set(['buy', 'summon', 'upgrade', 'offer', 'pan', 'run']);
  const find = (a, i) => document.querySelector(`[data-a="${a}"][data-i="${i}"]`) || document.querySelector(`[data-a="${a}"]`);
  const colorOf = (el) => {
    const host = el.closest('[style*="--c"]');
    return (host && getComputedStyle(host).getPropertyValue('--c').trim()) || accent();
  };
  function before(action, arg) {
    if (!REWARD.has(action) && !EVERYDAY.has(action)) return null;
    const el = find(action, arg);
    return { action, arg, rect: el && el.getBoundingClientRect(), color: el ? colorOf(el) : accent(), sig: JSON.stringify(mode.state), was: mode.feedback.measure(action, arg) };
  }
  function after(b) {
    if (!b || JSON.stringify(mode.state) === b.sig) return;
    const el = find(b.action, b.arg), host = el && el.closest('.card, .row, .ind, .panel');
    const x = b.rect ? b.rect.left + b.rect.width / 2 : innerWidth / 2, y = b.rect ? b.rect.top + b.rect.height / 2 : innerHeight / 2;
    if (mode.feedback.unlocked(b.action, b.arg, b.was)) {
      // something new: it slides in with a larger burst
      if (host) restart(host, 'reveal');
      burst(x, y, b.color, 18, 90);
      return floatText(x, b.rect ? b.rect.top : y, mode.feedback.label(b.action, b.arg, b.was), b.color);
    }
    if (b.action !== 'run') restart(host, 'bump');
    if (!b.rect) return;
    if (REWARD.has(b.action)) burst(x, y, b.color, 12, 56);
    floatText(x, b.rect.top, mode.feedback.label(b.action, b.arg, b.was), b.color);
  }
  const nope = (el) => restart(el.closest('.card, .row') || el, 'nope');
  // A small floating production number on `host` (any element; it gets position: relative once). Every mode uses it,
  // so the look, timing and limits are the same everywhere: one per `key` per 600ms, sixteen on screen at most.
  // `cls` picks where on the host it rises from ('' = the top edge of a Capitalist mine card, 'pl' = anywhere along
  // a bar or panel)
  const lastPop = new Map();
  let popsLive = 0;
  function pop(host, html, color, key, always, cls = '') {
    if (!host || !settings.effects || document.hidden) return;
    const now = Date.now();
    if (!always && (now - (lastPop.get(key) || 0) < 600 || popsLive >= 16)) return;
    lastPop.set(key, now);
    popsLive++;
    const e = document.createElement('span');
    e.className = 'pop ' + cls;
    e.style.cssText = `--px:${Math.random()};--py:${Math.random()};--dx:${Math.random() * 30 - 15}px;color:${color}`;
    e.innerHTML = typeof html === 'function' ? html() : html;
    host.classList.add('pophost');
    host.appendChild(e);
    setTimeout(() => (e.remove(), popsLive--), 900);
  }
  return { burst, floatText, confetti, sparks, chips, restart, unlock, count, before, after, nope, pop };
})();
