import clsx from 'clsx';

export function ClearMark({ className }: { className?: string }) {
  return (
    <span className={clsx('clear-mark', className)} aria-label="모두 완료">
      <span className="clear-mark-text">CLEAR</span>
    </span>
  );
}
