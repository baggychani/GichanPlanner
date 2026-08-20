import clsx from 'clsx';
import { useThemePreference } from '../hooks/useThemePreference';
import type { ThemePreference } from '../lib/theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: '라이트 모드' },
  { value: 'dark', label: '다크 모드' },
  { value: 'system', label: '시스템 설정 따르기' },
];

export function AppearanceSettings() {
  const [preference, setPreference] = useThemePreference();

  return (
    <div className="min-h-0 flex-1">
      <div role="radiogroup" aria-label="화면 밝기" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
        {OPTIONS.map(option => {
          const selected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(option.value)}
              className={clsx(
                'rounded-xl px-2 py-2.5 text-center text-sm transition-colors',
                selected ? 'bg-surface font-medium text-fg shadow-sm' : 'font-medium text-fg-muted hover:text-fg',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
