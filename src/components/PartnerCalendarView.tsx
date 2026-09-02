import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Star, UserRound, X } from 'lucide-react';
import clsx from 'clsx';
import { formatScheduledTime } from '../lib/datetime';
import { fetchPartnerPlanner, type PartnerPlanner } from '../lib/partnerData';
import type { Partner } from '../lib/partnerLink';
import { EmojiIcon } from './EmojiIcon';
import { Overlay } from './Overlay';

export function PartnerCalendarView({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [planner, setPlanner] = useState<PartnerPlanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchPartnerPlanner(partner.id)
      .then(result => { if (!cancelled) setPlanner(result); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [partner.id]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = useMemo(() => (planner?.tasks ?? []).filter(task => task.target_date === dateStr), [planner, dateStr]);
  const dayDeadlines = useMemo(() => (planner?.deadlines ?? []).filter(deadline => deadline.due_date === dateStr), [planner, dateStr]);
  const categories = useMemo(() => [...(planner?.domains ?? [])].sort((a, b) => a.order - b.order), [planner]);

  const sections = useMemo(() => {
    const named = categories
      .map(category => ({ id: category.id as string | null, name: category.name, icon: category.icon, tasks: dayTasks.filter(task => task.domain_id === category.id) }))
      .filter(section => section.tasks.length > 0);
    const unassigned = dayTasks.filter(task => !categories.some(category => category.id === task.domain_id));
    return unassigned.length > 0 ? [...named, { id: null, name: '미분류', icon: '📥', tasks: unassigned }] : named;
  }, [categories, dayTasks]);

  return (
    <Overlay zClassName="z-[70]" onEscape={onClose} onBackdropClick={onClose}>
      <section aria-label={`${partner.nickname}님의 캘린더`} className="flex max-h-[85vh] w-full max-w-[420px] flex-col rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <UserRound size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{partner.nickname}님의 캘린더</p>
            <p className="text-[12px] text-fg-muted">읽기 전용</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><X size={20} /></button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setSelectedDate(previous => addDays(previous, -1))} aria-label="이전 날" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><ChevronLeft size={18} /></button>
          <div className="flex flex-col items-center">
            <span className="text-[15px] font-semibold">{format(selectedDate, 'M월 d일')}</span>
            <button onClick={() => setSelectedDate(new Date())} className="text-[12px] text-fg-muted hover:text-fg">오늘로</button>
          </div>
          <button onClick={() => setSelectedDate(previous => addDays(previous, 1))} aria-label="다음 날" className="rounded-full p-2 text-fg-muted hover:bg-surface-hover"><ChevronRight size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {isLoading && <p className="py-8 text-center text-sm text-fg-muted">불러오는 중…</p>}
          {!isLoading && error && <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!isLoading && !error && sections.length === 0 && dayDeadlines.length === 0 && (
            <p className="py-8 text-center text-sm text-fg-faint">등록된 일정이 없습니다</p>
          )}
          {!isLoading && !error && sections.map(section => (
            <div key={section.id ?? 'unassigned'}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <span className="text-sm inline-flex items-center"><EmojiIcon emoji={section.icon} /></span>
                <span className="text-sm font-medium text-fg-muted">{section.name}</span>
              </div>
              <div className="space-y-0.5">
                {section.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 rounded-xl px-3 py-1.5">
                    <div
                      aria-hidden="true"
                      className={clsx('mt-0.5 h-5 w-5 shrink-0 rounded-full border-2', task.is_completed ? 'border-primary bg-primary' : 'border-line-strong')}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {task.is_important && (
                          <Star size={14} strokeWidth={2} fill="currentColor" className={clsx('shrink-0', task.is_completed ? 'text-fg-faint' : 'text-amber-500')} />
                        )}
                        <span className={clsx('truncate text-[15px]', task.is_completed ? 'text-fg-subtle line-through decoration-fg-muted decoration-1' : 'text-textPrimary')}>
                          {task.title}
                        </span>
                      </div>
                      {formatScheduledTime(task.scheduled_time) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[13px] text-fg-muted">
                          <Clock size={13} strokeWidth={2} className="shrink-0" />
                          <span>{formatScheduledTime(task.scheduled_time)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!isLoading && !error && dayDeadlines.length > 0 && (
            <div>
              <div className="mb-1.5 px-1 text-sm font-medium text-fg-muted">데드라인</div>
              <div className="space-y-0.5">
                {dayDeadlines.map(deadline => (
                  <div key={deadline.id} className="truncate rounded-xl px-3 py-1.5 text-[15px] text-textPrimary">{deadline.title}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Overlay>
  );
}
