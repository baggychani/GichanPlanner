import clsx from 'clsx';
import type { Meridiem } from '../lib/datetime';

type TimePickerModalProps = {
  meridiem: Meridiem;
  hour: number;
  minute: number;
  onMeridiemChange: (meridiem: Meridiem) => void;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onClear: () => void;
  onConfirm: () => void;
};

export function TimePickerModal({
  meridiem,
  hour,
  minute,
  onMeridiemChange,
  onHourChange,
  onMinuteChange,
  onClear,
  onConfirm,
}: TimePickerModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 dark:bg-black/55 p-4 sm:items-center">
      <div className="w-full max-w-[460px] rounded-3xl bg-surface p-6 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line-strong" />
        <h3 className="mb-5 text-center text-base font-medium text-fg">시간 설정</h3>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-hover p-1">
          {(['AM', 'PM'] as const).map(value => (
            <button key={value} onClick={() => onMeridiemChange(value)} className={clsx('rounded-xl py-2.5 text-sm font-medium transition-colors', meridiem === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-subtle')}>
              {value === 'AM' ? '오전' : '오후'}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-fg-muted">시</p>
        <div className="mb-5 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
            <button key={value} onClick={() => onHourChange(value)} className={clsx('aspect-square rounded-full text-sm font-medium transition-colors', hour === value ? 'bg-primary text-on-primary' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover')}>{value}</button>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-fg-muted">분</p>
        <div className="mb-6 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, index) => index * 5).map(value => (
            <button key={value} onClick={() => onMinuteChange(value)} className={clsx('aspect-square rounded-full text-sm font-medium transition-colors', minute === value ? 'bg-primary text-on-primary' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover')}>{String(value).padStart(2, '0')}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClear} className="rounded-xl bg-surface-hover py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">시간 해제</button>
          <button onClick={onConfirm} className="rounded-xl bg-ink py-3 text-sm font-medium text-on-ink hover:opacity-90">완료</button>
        </div>
      </div>
    </div>
  );
}
