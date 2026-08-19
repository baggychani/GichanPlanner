import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'gichanplan-theme';

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const root = document.documentElement;
    const next = !isDark;
    root.classList.add('theme-switching');
    root.classList.toggle('dark', next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    setIsDark(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
      className={`p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted ${className}`}
    >
      {isDark ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
