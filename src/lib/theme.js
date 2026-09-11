// Theme customization — lets the user pick the app's accent color.
// Applies CSS variables globally and persists the choice in localStorage.

const KEY = 'neurix_theme';

export const THEMES = [
  { id: 'cyan',    name: 'Neural Cyan',  primary: '187 92% 52%',  accent: '160 84% 46%' },
  { id: 'azure',   name: 'Azure',        primary: '205 100% 56%', accent: '185 100% 50%' },
  { id: 'violet',  name: 'Violet',       primary: '265 90% 66%',  accent: '190 100% 55%' },
  { id: 'magenta', name: 'Magenta',      primary: '320 100% 62%', accent: '265 90% 66%' },
  { id: 'emerald', name: 'Emerald',      primary: '158 95% 46%',  accent: '150 90% 55%' },
  { id: 'amber',   name: 'Amber',        primary: '38 100% 55%',  accent: '22 100% 56%' },
  { id: 'crimson', name: 'Crimson',      primary: '350 95% 60%',  accent: '20 100% 58%' },
];

export const DEFAULT_THEME = 'cyan';

export function getThemeId() {
  try { return localStorage.getItem(KEY) || DEFAULT_THEME; } catch { return DEFAULT_THEME; }
}

export function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--ring', t.primary);
  root.style.setProperty('--sidebar-primary', t.primary);
  root.style.setProperty('--sidebar-ring', t.primary);
  try { localStorage.setItem(KEY, t.id); } catch { /* ignore */ }
  return t.id;
}

// Call once on startup, before render, to avoid a flash of the default color.
export function initTheme() {
  applyTheme(getThemeId());
  applyMode(getMode());
}

// ---- Light / dark mode -----------------------------------------------------
const MODE_KEY = 'neurix_mode';

export function getMode() {
  try { return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function applyMode(mode) {
  const m = mode === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.classList.toggle('light', m === 'light');
  root.classList.toggle('dark', m === 'dark');
  try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  return m;
}
