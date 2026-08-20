import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertCircle, Calendar as CalendarIcon, X } from 'lucide-react';
import clsx from 'clsx';
import { db, type Deadline } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { formatScheduledTime, parseDay } from '../lib/datetime';
import { Overlay } from './Overlay';
import { ConfirmDiscardDialog } from './DailyDialogs';

const REMINDER_DAYS = [null, 1, 3, 7, 14, 30] as const;

function deadlineDraftKey(deadline: Deadline) {
  return JSON.stringify({
    title: deadline.title,
    memo: deadline.memo,
    due_date: deadline.due_date,
    due_time: deadline.due_time,
    reminder_days: deadline.reminder_days,
  });
}

function ReminderPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (days: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {REMINDER_DAYS.map(days => (
        <button
          key={days ?? 'none'}
          type="button"
          onClick={() => onChange(days)}
          className={clsx(
            'rounded-xl px-1 py-2 text-sm font-medium transition-colors',
            value === days ? 'bg-red-500 text-white' : 'bg-surface-hover text-fg-muted hover:bg-surface-hover',
          )}
        >
          {days === null ? '없음' : `${days}일 전`}
        </button>
      ))}
    </div>
  );
}

type DeadlineCreateModalProps = {
  title: string;
  memo: string;
  dueDate: string;
  dueTime: string | null;
  reminderDays: number | null;
  onTitleChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onReminderChange: (days: number | null) => void;
  onPickDate: () => void;
  onOpenTimePicker: () => void;
  onClose: () => void;
  onSave: () => void;
};

export function DeadlineCreateModal({
  title,
  memo,
  dueDate,
  dueTime,
  reminderDays,
  onTitleChange,
  onMemoChange,
  onReminderChange,
  onPickDate,
  onOpenTimePicker,
  onClose,
  onSave,
}: DeadlineCreateModalProps) {
  return (
    <Overlay onEscape={onClose}>
      <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2 text-red-500"><AlertCircle size={20} /><h3 className="text-lg font-medium text-fg">데드라인 만들기</h3></div>
          <button onClick={onClose} aria-label="데드라인 만들기 닫기" className="rounded-full p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"><X size={20} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">제목</label>
            <input autoFocus value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="마감할 일을 적어주세요" className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-red-200" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">메모</label>
            <textarea value={memo} onChange={(event) => onMemoChange(event.target.value)} placeholder="필요한 메모를 적어주세요" className="h-20 w-full resize-none rounded-xl border border-transparent bg-surface-muted p-3 text-sm outline-none focus:border-red-200" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">데드라인 날짜</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg">{format(parseDay(dueDate), 'yyyy년 MM월 dd일 (E)', { locale: ko })}</span>
              <button onClick={onPickDate} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover"><CalendarIcon size={14} /> 날짜 선택</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">시간</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg-muted">{formatScheduledTime(dueTime) ?? '시간 없음'}</span>
              <button onClick={onOpenTimePicker} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover"><CalendarIcon size={14} /> 시간 설정</button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-subtle">알림 시작</label>
            <ReminderPicker value={reminderDays} onChange={onReminderChange} />
            <p className="mt-2 text-xs text-fg-subtle">설정한 기간에만 오른쪽 일정 창에서 디데이를 표시합니다.</p>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 pb-6 pt-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-hover">취소</button>
          <button onClick={onSave} disabled={!title.trim()} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-200">데드라인 만들기</button>
        </div>
      </div>
    </Overlay>
  );
}

export function DeadlineEditModal({
  deadline,
  onChange,
  onPickDate,
  onOpenTimePicker,
  onClose,
}: {
  deadline: Deadline;
  onChange: (deadline: Deadline) => void;
  onPickDate: () => void;
  onOpenTimePicker: () => void;
  onClose: () => void;
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialDraft = useRef(deadlineDraftKey(deadline));
  const requestClose = () => {
    if (deadlineDraftKey(deadline) !== initialDraft.current) setDiscardOpen(true);
    else onClose();
  };
  return (
    <Overlay onEscape={requestClose}>
      <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2 text-red-500"><AlertCircle size={20} /><h3 className="text-lg font-medium text-fg">데드라인 상세</h3></div>
          <button onClick={requestClose} aria-label="데드라인 상세 닫기" className="rounded-full p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"><X size={20} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">제목</label>
            <input value={deadline.title} onChange={(event) => onChange({ ...deadline, title: event.target.value })} className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-red-200" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">메모</label>
            <textarea value={deadline.memo} onChange={(event) => onChange({ ...deadline, memo: event.target.value })} placeholder="필요한 메모를 적어주세요" className="h-20 w-full resize-none rounded-xl border border-transparent bg-surface-muted p-3 text-sm outline-none focus:border-red-200" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">데드라인 날짜</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg">{format(parseDay(deadline.due_date), 'yyyy년 MM월 dd일 (E)', { locale: ko })}</span>
              <button onClick={onPickDate} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover"><CalendarIcon size={14} /> 날짜 변경</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">시간</label>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3">
              <span className="text-sm text-fg-muted">{formatScheduledTime(deadline.due_time ?? null) ?? '시간 없음'}</span>
              <button onClick={onOpenTimePicker} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-hover"><CalendarIcon size={14} /> 시간 설정</button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-fg-subtle">알림 시작</label>
            <ReminderPicker value={deadline.reminder_days} onChange={(days) => onChange({ ...deadline, reminder_days: days })} />
          </div>
        </div>
        <div className="flex shrink-0 justify-between gap-2 border-t border-line px-6 pb-6 pt-4">
          <button
            onClick={async () => {
              const now = new Date().toISOString();
              await runPlannerWrite(() => db.deadlines.update(deadline.id, { deleted_at: now, updated_at: now, version: deadline.version + 1 }));
              onClose();
            }}
            className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70"
          >
            삭제
          </button>
          <button
            onClick={async () => {
              if (!deadline.title.trim()) return;
              const now = new Date().toISOString();
              await runPlannerWrite(() => db.deadlines.put({ ...deadline, title: deadline.title.trim(), memo: deadline.memo.trim(), updated_at: now, version: deadline.version + 1 }));
              onClose();
            }}
            className="rounded-xl bg-ink text-on-ink px-4 py-2.5 text-sm font-medium hover:opacity-90"
          >
            저장
          </button>
        </div>
      </div>
      {discardOpen && <ConfirmDiscardDialog onCancel={() => setDiscardOpen(false)} onDiscard={onClose} />}
    </Overlay>
  );
}
