import { useState } from 'react';
import { Cake, X } from 'lucide-react';
import clsx from 'clsx';
import { Overlay } from './Overlay';
import { EmojiIcon } from './EmojiIcon';
import { EmojiPickerOverlay } from './EmojiPickerOverlay';
import { BirthdayPickerModal } from './BirthdayPickerModal';
import { YearOtpInput } from './YearOtpInput';

type AnniversaryCreateModalProps = {
  title: string;
  emoji: string;
  month: number;
  day: number;
  useStartYear: boolean;
  startYear: number | null;
  onTitleChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onMonthChange: (month: number) => void;
  onDayChange: (day: number) => void;
  onUseStartYearChange: (value: boolean) => void;
  onStartYearChange: (value: number | null) => void;
  onClose: () => void;
  onSave: () => void;
};

export function AnniversaryCreateModal({
  title,
  emoji,
  month,
  day,
  useStartYear,
  startYear,
  onTitleChange,
  onEmojiChange,
  onMonthChange,
  onDayChange,
  onUseStartYearChange,
  onStartYearChange,
  onClose,
  onSave,
}: AnniversaryCreateModalProps) {
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);

  return (
    <>
      <Overlay onEscape={onClose}>
        <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-surface shadow-xl">
          <div className="flex shrink-0 items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-2 text-fg">
              <Cake size={20} />
              <h3 className="text-lg font-medium">기념일 만들기</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="기념일 만들기 닫기" className="rounded-full p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto px-6 pb-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-subtle">이름</label>
              <input
                autoFocus
                value={title}
                onChange={event => onTitleChange(event.target.value)}
                placeholder="기념일 이름을 적어주세요"
                className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-line-strong"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg-subtle">달력 표시</label>
              <button
                type="button"
                onClick={() => setPickingEmoji(true)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-line-strong bg-surface-muted hover:bg-surface-hover"
                aria-label="기념일 이모지 선택"
              >
                <EmojiIcon emoji={emoji} className="h-7 w-7" />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg-subtle">날짜</label>
              <button
                type="button"
                onClick={() => setPickingDate(true)}
                className="w-full rounded-xl bg-surface-muted px-3 py-3 text-left text-sm font-medium text-fg hover:bg-surface-hover"
              >
                {month}월 {day}일
              </button>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-fg-subtle">주년 표시</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUseStartYearChange(false)}
                  className={clsx(
                    'rounded-xl px-1 py-2 text-sm font-medium transition-colors',
                    !useStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
                  )}
                >
                  없음
                </button>
                <button
                  type="button"
                  onClick={() => onUseStartYearChange(true)}
                  className={clsx(
                    'rounded-xl px-1 py-2 text-sm font-medium transition-colors',
                    useStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
                  )}
                >
                  있음
                </button>
              </div>
            </div>
            {useStartYear && (
              <div>
                <label className="mb-2 block text-xs font-medium text-fg-subtle">기준 연도</label>
                <YearOtpInput value={startYear} onChange={onStartYearChange} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 pb-6 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-hover">취소</button>
            <button
              type="button"
              onClick={onSave}
              disabled={!title.trim()}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-on-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              기념일 만들기
            </button>
          </div>
        </div>
      </Overlay>
      {pickingEmoji && (
        <EmojiPickerOverlay
          onClose={() => setPickingEmoji(false)}
          onSelect={(next) => {
            onEmojiChange(next);
            setPickingEmoji(false);
          }}
        />
      )}
      {pickingDate && (
        <BirthdayPickerModal
          title="날짜 선택"
          clearLabel="취소"
          month={month}
          day={day}
          onMonthChange={onMonthChange}
          onDayChange={onDayChange}
          onClose={() => setPickingDate(false)}
          onClear={() => setPickingDate(false)}
          onConfirm={() => setPickingDate(false)}
        />
      )}
    </>
  );
}
