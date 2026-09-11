// Theme customization — accent colour + light/dark mode.
// Neon accents shine on dark backgrounds but hurt on white, so every theme
// carries a deeper, readable variant used automatically in light mode.

const KEY = 'neurix_theme';
const MODE_KEY = 'neurix_mode';

export const THEMES = [
  { id: 'cyan',    name: 'Neural Cyan', primary: '187 92% 52%', accent: '160 84% 46%', primaryLight: '191 88% 34%', accentLight: '162 70% 32%' },
  { id: 'azure',   name: 'Azure',       primary: '205 100% 56%', accent: '185 100% 50%', primaryLight: '210 84% 44%', accentLight: '192 80% 36%' },
  { id: 'violet',  name: 'Violet',      primary: '265 90% 66%',  accent: '190 100% 55%', primaryLight: '262 62% 52%', accentLight: '196 78% 40%' },
  { id: 'magenta', name: 'Magenta',     primary: '320 100% 62%', accent: '265 90% 66%',  primaryLight: '322 68% 48%', accentLight: '264 58% 54%' },
  { id: 'emerald', name: 'Emerald',     primary: '158 95% 46%',  accent: '150 90% 55%',  primaryLight: '160 72% 32%', accentLight: '150 60% 34%' },
  { id: 'amber',   name: 'Amber',       primary: '38 100% 55%',  accent: '22 100% 56%',  primaryLight: '32 88% 42%',  accentLight: '20 82% 46%' },
  { id: 'crimson', name: 'Crimson',     primary: '350 95% 60%',  accent: '20 100% 58%',  primaryLight: '350 70% 48%', accentLight: '20 78% 48%' },
];

export const DEFAULT_THEME = 'cyan';

export function getThemeId() {
  try { return localStorage.getItem(KEY) || DEFAULT_THEME; } catch { return DEFAULT_THEME; }
}
export function getMode() {
  try { return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

// Applies the accent for the current (or given) mode.
export function applyTheme(id, mode = getMode()) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const primary = mode === 'light' ? t.primaryLight : t.primary;
  const accent = mode === 'light' ? t.accentLight : t.accent;
  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-ring', primary);
  try { localStorage.setItem(KEY, t.id); } catch { /* ignore */ }
  return t.id;
}

export function applyMode(mode) {
  const m = mode === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.classList.toggle('light', m === 'light');
  root.classList.toggle('dark', m === 'dark');
  try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  // Re-apply the accent so its shade matches the new mode.
  applyTheme(getThemeId(), m);
  return m;
}

// Call once on startup, before render, to avoid a flash of the wrong colours.
export function initTheme() {
  applyMode(getMode()); // also applies the theme accent for the mode
}
