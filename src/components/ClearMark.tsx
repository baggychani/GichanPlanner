import clsx from 'clsx';

export function ClearMark({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-[22px] items-center justify-center rounded-full bg-primary px-2.5',
        className,
      )}
      aria-label="모두 완료"
    >
      <span className="translate-y-px text-[10px] font-extrabold italic tracking-[0.16em] text-on-primary">
        CLEAR
      </span>
    </span>
  );
}
