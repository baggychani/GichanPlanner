import { useMemo, useState } from 'react';
import { format, getISODay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Repeat2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Domain, Routine } from '../lib/db';
import { parseDay } from '../lib/datetime';
import { FREQ_OPTIONS, parseRecurrenceRule } from '../lib/recurrence';
import { removeRoutine, type RoutineRemovalScope } from '../lib/routineOps';

function routineFreqLabel(routine: Routine) {
  const rule = parseRecurrenceRule(routine.recurrence_rule);
  const base = FREQ_OPTIONS.find(option => option.value === rule.freq)?.label ?? '매일';
  if (rule.freq !== 'weekly' && rule.freq !== 'biweekly') return base;
  const labels = ['', '월', '화', '수', '목', '금', '토', '일'];
  const days = (rule.weekdays.length > 0 ? rule.weekdays : [getISODay(parseDay(routine.start_date))]).map(day => labels[day]).join('');
  return `${base} · ${days}`;
}

export function RoutineSettingsPanel({
  routines,
  categories,
}: {
  routines: Routine[];
  categories: Domain[];
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmScope, setConfirmScope] = useState<RoutineRemovalScope>('future');

  const sorted = useMemo(
    () => [...routines].sort((a, b) => a.title.localeCompare(b.title) || a.start_date.localeCompare(b.start_date)),
    [routines],
  );

  const categoryName = (domainId: string | null) => {
    if (!domainId) return '미분류';
    return categories.find(category => category.id === domainId)?.name ?? '미분류';
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="settings-scroll space-y-2">
        {sorted.map(routine => (
          <section key={routine.id} className="rounded-2xl border border-line bg-surface-muted px-3 py-3">
            <div className="flex items-start gap-2">
              <Repeat2 size={16} className="mt-0.5 shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{routine.title}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">{categoryName(routine.domain_id)} · {routineFreqLabel(routine)}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  {format(parseDay(routine.start_date), 'yyyy.MM.dd', { locale: ko })}
                  {' – '}
                  {routine.end_date ? format(parseDay(routine.end_date), 'yyyy.MM.dd', { locale: ko }) : '종료 없음'}
                </p>
              </div>
            </div>
            {confirmId === routine.id ? (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmScope('future')}
                    className={clsx(
                      'rounded-xl px-2 py-2 text-xs font-medium',
                      confirmScope === 'future' ? 'bg-ink text-on-ink' : 'bg-surface-hover text-fg-muted',
                    )}
                  >
                    앞으로 만들지 않기
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmScope('all')}
                    className={clsx(
                      'rounded-xl px-2 py-2 text-xs font-medium',
                      confirmScope === 'all' ? 'bg-red-500 text-white' : 'bg-surface-hover text-fg-muted',
                    )}
                  >
                    전부 삭제
                  </button>
                </div>
                <p className="text-xs leading-5 text-fg-subtle">
                  {confirmScope === 'future'
                    ? '오늘 이후에 만들어질 할 일만 지웁니다. 지난 날짜는 그대로 둡니다.'
                    : '이 루틴과 연결된 할 일을 모두 지웁니다.'}
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface">취소</button>
                  <button
                    type="button"
                    onClick={() => {
                      void removeRoutine(routine.id, confirmScope).then(() => setConfirmId(null));
                    }}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setConfirmId(routine.id); setConfirmScope('future'); }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Trash2 size={14} /> 루틴 삭제
              </button>
            )}
          </section>
        ))}
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-subtle">
            <Repeat2 size={20} />
            등록된 루틴이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
