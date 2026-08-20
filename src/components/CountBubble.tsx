import clsx from 'clsx';

type CountBubbleProps = {
  count: number;
  tone: 'important' | 'plain';
  size?: 'sm' | 'md' | 'calendar';
};

export function CountBubble({ count, tone, size = 'sm' }: CountBubbleProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-bold tabular-nums leading-none',
        size === 'sm' && 'h-[22px] min-w-[22px] px-1.5 text-[11px]',
        size === 'md' && 'h-7 min-w-7 px-2 text-sm',
        size === 'calendar' && 'h-[var(--cal-bubble)] min-w-[var(--cal-bubble)] px-[var(--cal-bubble-px)] text-[length:var(--cal-bubble-font)]',
        tone === 'important' ? 'bg-primary text-on-primary' : 'border border-line-strong bg-surface-hover text-fg',
      )}
    >
      <span className="translate-y-px">{count}</span>
    </span>
  );
}
