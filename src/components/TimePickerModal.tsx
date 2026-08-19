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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="mb-5 text-center text-base font-medium text-gray-800">시간 설정</h3>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          {(['AM', 'PM'] as const).map(value => (
            <button key={value} onClick={() => onMeridiemChange(value)} className={clsx('rounded-xl py-2.5 text-sm font-medium transition-colors', meridiem === value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400')}>
              {value === 'AM' ? '오전' : '오후'}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-gray-500">시</p>
        <div className="mb-5 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
            <button key={value} onClick={() => onHourChange(value)} className={clsx('aspect-square rounded-full text-sm font-medium transition-colors', hour === value ? 'bg-primary text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>{value}</button>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-gray-500">분</p>
        <div className="mb-6 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, index) => index * 5).map(value => (
            <button key={value} onClick={() => onMinuteChange(value)} className={clsx('aspect-square rounded-full text-sm font-medium transition-colors', minute === value ? 'bg-primary text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>{String(value).padStart(2, '0')}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClear} className="rounded-xl bg-gray-100 py-3 text-sm font-medium text-red-500 hover:bg-red-50">시간 해제</button>
          <button onClick={onConfirm} className="rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800">완료</button>
        </div>
      </div>
    </div>
  );
}
