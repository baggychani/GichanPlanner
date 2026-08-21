import { format, getISODay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Repeat2, X } from 'lucide-react';
import clsx from 'clsx';
import type { Domain } from '../lib/db';
import { formatScheduledTime, parseDay } from '../lib/datetime';
import { FREQ_OPTIONS, WEEKDAY_OPTIONS, type RecurrenceFreq } from '../lib/recurrence';
import { Overlay } from './Overlay';

type RoutineCreateModalProps = {
  title: string;
  domainId: string | null;
  startDate: string;
  endDate: string | null;
  freq: RecurrenceFreq;
  weekdays: number[];
  scheduledTime: string | null;
  categories: Domain[];
  onTitleChange: (value: string) => void;
  onDomainChange: (domainId: string | null) => void;
  onFreqChange: (freq: RecurrenceFreq) => void;
  onWeekdaysChange: (weekdays: number[]) => void;
  onPickStartDate: () => void;
  onPickEndDate: () => void;
  onClearEndDate: () => void;
  onOpenTimePicker: () => void;
  onClose: () => void;
  onSave: () => void;
};

export function RoutineCreateModal({
  title,
  domainId,
  startDate,
  endDate,
  freq,
  weekdays,
  scheduledTime,
  categories,
  onTitleChange,
  onDomainChange,
  onFreqChange,
  onWeekdaysChange,
  onPickStartDate,
  onPickEndDate,
  onClearEndDate,
  onOpenTimePicker,
  onClose,
  onSave,
}: RoutineCreateModalProps) {
  const showWeekdays = freq === 'weekly' || freq === 'biweekly';
  const selectedWeekdays = weekdays.length > 0 ? weekdays : [getISODay(parseDay(startDate))];

  const toggleWeekday = (iso: number) => {
    const current = weekdays.length > 0 ? weekdays : [getISODay(parseDay(startDate))];
    const next = current.includes(iso)
      ? current.filter(day => day !== iso)
      : [...current, iso].sort((a, b) => a - b);
    if (next.length === 0) return;
    onWeekdaysChange(next);
  };

  return (
    <Overlay onEscape={onClose}>
      <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2 text-fg">
            <Repeat2 size={20} />
            <h3 className="text-lg font-medium">루틴 만들기</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="루틴 만들기 닫기" className="rounded-full p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">제목</label>
            <input
              autoFocus
              value={title}
              onChange={event => onTitleChange(event.target.value)}
              placeholder="반복할 일을 적어주세요"
              className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">카테고리</label>
            <select
              value={domainId ?? ''}
              onChange={event => onDomainChange(event.target.value || null)}
              className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-sm outline-none focus:border-line-strong"
            >
              <option value="">미분류</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">시작 날짜</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg">{format(parseDay(startDate), 'yyyy년 MM월 dd일 (E)', { locale: ko })}</span>
              <button type="button" onClick={onPickStartDate} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover">
                <CalendarIcon size={14} /> 날짜 선택
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">종료 날짜</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg-muted">
                {endDate ? format(parseDay(endDate), 'yyyy년 MM월 dd일 (E)', { locale: ko }) : '없음'}
              </span>
              <div className="flex items-center gap-1.5">
                {endDate && (
                  <button type="button" onClick={onClearEndDate} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-hover">
                    없음
                  </button>
                )}
                <button type="button" onClick={onPickEndDate} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover">
                  <CalendarIcon size={14} /> 날짜 선택
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-subtle">반복</label>
            <div className="grid grid-cols-5 gap-1.5">
              {FREQ_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onFreqChange(option.value)}
                  className={clsx(
                    'rounded-xl px-1 py-2 text-sm font-medium transition-colors',
                    freq === option.value ? 'bg-ink text-on-ink' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {showWeekdays && (
            <div>
              <label className="mb-2 block text-xs font-medium text-fg-subtle">요일</label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_OPTIONS.map(option => {
                  const selected = selectedWeekdays.includes(option.iso);
                  return (
                    <button
                      key={option.iso}
                      type="button"
                      onClick={() => toggleWeekday(option.iso)}
                      className={clsx(
                        'rounded-xl px-1 py-2 text-sm font-medium transition-colors',
                        selected ? 'bg-ink text-on-ink' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">시간</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg-muted">{formatScheduledTime(scheduledTime) ?? '시간 없음'}</span>
              <button type="button" onClick={onOpenTimePicker} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover">
                <CalendarIcon size={14} /> 시간 설정
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 pb-6 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-hover">취소</button>
          <button
            type="button"
            onClick={onSave}
            disabled={!title.trim()}
            className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-on-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            루틴 만들기
          </button>
        </div>
      </div>
    </Overlay>
  );
}
