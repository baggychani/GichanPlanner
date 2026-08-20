import { Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useThemePreference } from '../hooks/useThemePreference';
import type { ThemePreference } from '../lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '라이트 모드', icon: Sun },
  { value: 'dark', label: '다크 모드', icon: Moon },
  { value: 'system', label: '시스템 설정 따르기', icon: Monitor },
];

export function AppearanceSettings() {
  const [preference, setPreference] = useThemePreference();

  return (
    <div className="min-h-0 flex-1">
      <section>
        <h4 className="px-1 text-xs font-medium text-fg-subtle">테마</h4>
        <div role="radiogroup" aria-label="테마" className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
          {OPTIONS.map(option => {
            const selected = preference === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPreference(option.value)}
                className={clsx(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-sm transition-colors',
                  selected ? 'bg-surface font-medium text-fg shadow-sm' : 'font-medium text-fg-muted hover:text-fg',
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
