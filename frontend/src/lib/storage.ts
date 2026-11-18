import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryCache = new Map<string, string>();
let hydrated = false;

export async function hydrateStorage(keys: string[]): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    for (const k of keys) {
      const val = window.localStorage.getItem(k);
      if (val !== null) memoryCache.set(k, val);
    }
    hydrated = true;
    return;
  }

  try {
    const entries = await AsyncStorage.multiGet(keys);
    for (const [k, val] of entries) {
      if (val !== null) memoryCache.set(k, val);
    }
  } catch {
    // ignore storage read error
  }
  hydrated = true;
}

export function isStorageHydrated(): boolean {
  return hydrated || Platform.OS === 'web';
}

export function getSyncItem(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryCache.get(key) ?? null;
    }
  }
  return memoryCache.get(key) ?? null;
}

export function setSyncItem(key: string, value: string | null): void {
  if (value === null) {
    memoryCache.delete(key);
  } else {
    memoryCache.set(key, value);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore quota error
    }
    return;
  }

  if (value === null) {
    void AsyncStorage.removeItem(key).catch(() => {});
  } else {
    void AsyncStorage.setItem(key, value).catch(() => {});
  }
}
