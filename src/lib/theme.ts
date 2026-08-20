export const THEME_KEY = 'gichanplan-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_CHANGE_EVENT = 'gichanplan-theme-change';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage가 막혀 있으면 시스템 설정을 따른다.
  }
  return 'system';
}

export function resolvedDark(preference: ThemePreference = readThemePreference()): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return prefersDark();
}

export function applyTheme(preference: ThemePreference = readThemePreference()): void {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.toggle('dark', resolvedDark(preference));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  });
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeThemePreference(onChange: (preference: ThemePreference) => void): () => void {
  const sync = () => onChange(readThemePreference());
  window.addEventListener(THEME_CHANGE_EVENT, sync);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
}

export function installTheme(): void {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readThemePreference() === 'system') applyTheme('system');
  });
}
