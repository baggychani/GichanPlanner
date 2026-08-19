import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

type EscapeEntry = { run: () => void };

const escapeStack: EscapeEntry[] = [];

export function hasEscapeOverlay() {
  return escapeStack.length > 0;
}

export function Overlay({
  children,
  className,
  zClassName = 'z-50',
  onEscape,
}: {
  children: ReactNode;
  className?: string;
  zClassName?: string;
  onEscape?: () => void;
}) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!onEscape) return;
    const entry: EscapeEntry = { run: () => { onEscapeRef.current?.(); } };
    escapeStack.push(entry);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeStack[escapeStack.length - 1] !== entry) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      entry.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const index = escapeStack.lastIndexOf(entry);
      if (index >= 0) escapeStack.splice(index, 1);
    };
  }, [onEscape != null]);

  return (
    <div className={clsx('fixed inset-0 flex items-center justify-center bg-black/20 p-4 dark:bg-black/55', zClassName, className)}>
      {children}
    </div>
  );
}
