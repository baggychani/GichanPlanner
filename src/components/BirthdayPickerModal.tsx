import clsx from 'clsx';
import { Overlay } from './Overlay';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInBirthdayMonth(month: number) {
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

type BirthdayPickerModalProps = {
  month: number;
  day: number;
  onMonthChange: (month: number) => void;
  onDayChange: (day: number) => void;
  onClose: () => void;
  onClear: () => void;
  onConfirm: () => void;
};

export function BirthdayPickerModal({
  month,
  day,
  onMonthChange,
  onDayChange,
  onClose,
  onClear,
  onConfirm,
}: BirthdayPickerModalProps) {
  const maxDay = daysInBirthdayMonth(month);

  return (
    <Overlay zClassName="z-[80]" align="bottom" onEscape={onClose}>
      <div className="w-full max-w-[420px] rounded-3xl bg-surface p-5 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        <h3 className="mb-4 text-center text-base font-medium text-fg">생일 설정</h3>
        <p className="mb-2 text-sm font-medium text-fg-muted">월</p>
        <div className="mb-4 grid grid-cols-6 gap-2.5">
          {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
            <button
              key={value}
              onClick={() => {
                onMonthChange(value);
                if (day > daysInBirthdayMonth(value)) onDayChange(daysInBirthdayMonth(value));
              }}
              className={clsx('aspect-square w-full max-w-[48px] justify-self-center rounded-full text-sm font-medium transition-colors', month === value ? 'bg-primary text-on-primary' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover')}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-fg-muted">일</p>
        <div className="mb-5 grid grid-cols-7 gap-2">
          {Array.from({ length: 31 }, (_, index) => index + 1).map(value => {
            const disabled = value > maxDay;
            return (
              <button
                key={value}
                disabled={disabled}
                onClick={() => onDayChange(value)}
                className={clsx(
                  'aspect-square w-full max-w-[40px] justify-self-center rounded-full text-sm font-medium transition-colors',
                  disabled ? 'cursor-not-allowed text-fg-faint opacity-30' : day === value ? 'bg-primary text-on-primary' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClear} className="rounded-xl bg-surface-hover py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">생일 해제</button>
          <button onClick={onConfirm} className="rounded-xl bg-ink py-2.5 text-sm font-medium text-on-ink hover:opacity-90">완료</button>
        </div>
      </div>
    </Overlay>
  );
}
