import { Check, Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useThemePreference } from '../hooks/useThemePreference';
import type { ThemePreference } from '../lib/theme';

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'light', label: '라이트 모드', hint: '항상 밝은 화면', icon: Sun },
  { value: 'dark', label: '다크 모드', hint: '항상 어두운 화면', icon: Moon },
  { value: 'system', label: '시스템 설정 따르기', hint: '이 기기의 밝기 설정을 따릅니다', icon: Monitor },
];

export function AppearanceSettings() {
  const [preference, setPreference] = useThemePreference();

  return (
    <fieldset className="min-h-0 flex-1">
      <legend className="sr-only">화면 보기</legend>
      <p className="text-sm leading-6 text-fg-muted">달력과 할 일 화면의 밝기를 고릅니다.</p>
      <div className="mt-4 space-y-2">
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
                'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                selected ? 'border-line-strong bg-surface shadow-sm' : 'border-line bg-surface-muted hover:bg-surface-hover',
              )}
            >
              <span className={clsx(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                selected ? 'bg-primary text-on-primary' : 'bg-surface text-fg-muted',
              )}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{option.label}</span>
                <span className="mt-0.5 block text-xs text-fg-subtle">{option.hint}</span>
              </span>
              {selected && <Check size={18} className="shrink-0 text-fg" aria-hidden />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
