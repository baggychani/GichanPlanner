import { useEffect, useState } from 'react';
import {
  readThemePreference,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from '../lib/theme';

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => subscribeThemePreference(setPreference), []);

  return [preference, setThemePreference] as const;
}
