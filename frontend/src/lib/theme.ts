import { colorScheme } from 'nativewind';
import { getSyncItem, setSyncItem } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'egel_theme_preference_v1';

export function getStoredTheme(): ThemePreference {
  const raw = getSyncItem(THEME_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'system';
}

export function applyThemePreference(pref: ThemePreference): void {
  setSyncItem(THEME_STORAGE_KEY, pref);
  colorScheme.set(pref);
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}
