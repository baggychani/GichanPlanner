import clsx from 'clsx';

export function ClearMark({ className, size = 'default' }: { className?: string; size?: 'default' | 'calendar' }) {
  return (
    <span className={clsx('clear-mark', size === 'calendar' && 'clear-mark-calendar', className)} aria-label="모두 완료">
      <span className="clear-mark-text">CLEAR</span>
    </span>
  );
}
