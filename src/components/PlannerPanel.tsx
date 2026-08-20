import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowRight, CalendarDays, CircleX, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Deadline, Project } from '../lib/db';
import { formatScheduledTime, parseDay } from '../lib/datetime';
import { EmojiIcon } from './EmojiIcon';

type DeadlineNotice = { deadline: Deadline; remainingDays: number };

type PlannerPanelProps = {
  viewMode: 'DAILY' | 'WEEKLY';
  selectedDate: Date;
  weeklyGoalWeekStart: Date | null;
  isDailyMenuOpen: boolean;
  deadlineNotices: DeadlineNotice[];
  projects: Project[];
  children: ReactNode;
  onToggleDailyMenu: () => void;
  onMoveIncompleteTomorrow: () => void;
  onMoveIncompletePickDate: () => void;
  onDeleteIncomplete: () => void;
  onCopyAll: () => void;
  onDeleteAll: () => void;
  onOpenDeadline: (deadline: Deadline) => void;
  onOpenProject: (project: Project) => void;
};

export function PlannerPanel({
  viewMode,
  selectedDate,
  weeklyGoalWeekStart,
  isDailyMenuOpen,
  deadlineNotices,
  projects,
  children,
  onToggleDailyMenu,
  onMoveIncompleteTomorrow,
  onMoveIncompletePickDate,
  onDeleteIncomplete,
  onCopyAll,
  onDeleteAll,
  onOpenDeadline,
  onOpenProject,
}: PlannerPanelProps) {
  return (
    <div className="flex h-full min-h-0 w-[650px] max-w-[min(650px,46%)] min-w-0 shrink flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm max-[900px]:h-[min(720px,calc(100vh-2.5rem))] max-[900px]:w-full max-[900px]:max-w-[760px] max-[900px]:shrink-0">
      <div className="mb-6 flex shrink-0 items-center justify-between px-8 pt-8 max-[1200px]:px-6 max-[1200px]:pt-6">
        <h2 className="flex h-10 min-w-0 items-center gap-3.5 text-2xl font-bold leading-none">
          <span className="truncate">
            {viewMode === 'DAILY'
              ? format(selectedDate, 'M월 d일 (E)', { locale: ko })
              : weeklyGoalWeekStart
                ? `${format(weeklyGoalWeekStart, 'M월 d일')} 주간 목표`
                : '주간 목표'}
          </span>
          {viewMode === 'DAILY' && isToday(selectedDate) && (
            <span className="rounded-full bg-primary px-3 py-1 text-[13px] font-semibold leading-none text-on-primary">오늘</span>
          )}
        </h2>
        <div className="relative grid h-10 w-10 shrink-0 place-items-center">
          {viewMode === 'DAILY' && (
            <>
              {/* 바깥 클릭으로 닫히지 않음. 메뉴를 연 채 날짜를 확인하는 흐름을 유지하기 위한 의도. */}
              <button onClick={onToggleDailyMenu} aria-label="일별 할 일 메뉴" aria-expanded={isDailyMenuOpen} className="grid h-10 w-10 place-items-center rounded-full text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors">
                <MoreHorizontal size={22} />
              </button>
              <div className={clsx(
                'absolute right-0 top-11 z-40 w-56 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-xl transition-all duration-200',
                isDailyMenuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
              )}>
                <button onClick={onMoveIncompleteTomorrow} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-surface-muted"><ArrowRight size={16} className="text-indigo-400" />미완료 할 일을 내일 하기</button>
                <button onClick={onMoveIncompletePickDate} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-surface-muted"><CalendarDays size={16} className="text-indigo-400" />미완료 할 일을 다른 날 하기</button>
                <button onClick={onDeleteIncomplete} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"><CircleX size={16} />미완료 할 일 삭제</button>
                <div className="mx-2 my-1 border-t border-line" />
                <button onClick={onCopyAll} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-surface-muted"><Copy size={16} className="text-indigo-400" />모든 할 일 복사</button>
                <button onClick={onDeleteAll} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={16} />모든 할 일 삭제</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="panel-scroll flex-1 min-h-0">
        <div className={clsx('px-8 max-[1200px]:px-6', viewMode === 'DAILY' && deadlineNotices.length > 0 ? 'pb-2' : 'pb-8 max-[1200px]:pb-6')}>
          {children}
        </div>
      </div>
      {viewMode === 'DAILY' && deadlineNotices.length > 0 && (
        <section className="panel-scroll shrink-0 max-h-[40%] border-t border-red-100 dark:border-red-900" aria-label="데드라인 알림">
          <div className="space-y-2 px-8 pt-4 pb-8 max-[1200px]:px-6 max-[1200px]:pb-6">
          <p className="px-1 text-xs font-medium text-red-500">데드라인 알림</p>
          {deadlineNotices.map(({ deadline, remainingDays }) => {
            const isDueToday = remainingDays === 0;
            const dueTimeLabel = formatScheduledTime(deadline.due_time ?? null);
            const project = deadline.project_id
              ? projects.find(item => item.id === deadline.project_id) ?? null
              : null;
            return (
              <div
                key={deadline.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDeadline(deadline)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenDeadline(deadline); }}
                className={clsx(
                  'group flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-colors',
                  isDueToday
                    ? 'border-red-500 bg-red-100 hover:bg-red-200/80 dark:bg-red-900/70 dark:hover:bg-red-900/90'
                    : 'border-red-200 bg-red-50/60 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40 dark:hover:bg-red-950/60',
                  deadline.memo ? 'items-start' : 'items-center',
                )}
              >
                <span className={clsx('shrink-0 rounded-full px-2 py-1 text-xs text-white', isDueToday ? 'bg-red-600 font-bold' : 'bg-red-500 font-medium', deadline.memo ? 'mt-0.5' : '')}>{isDueToday ? 'D-DAY' : `D-${remainingDays}`}</span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {project && (
                      <button
                        type="button"
                        title={project.title}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProject(project);
                        }}
                        className="inline-flex max-w-[7.5rem] shrink-0 items-center gap-0.5 rounded-md bg-white/70 px-1.5 py-0.5 hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
                      >
                        <EmojiIcon emoji={project.icon} className="h-3.5 w-3.5" />
                        <span className="truncate text-[11px] font-medium leading-none text-fg-muted">{project.title}</span>
                      </button>
                    )}
                    <p className={clsx('min-w-0 truncate text-sm', isDueToday ? 'font-bold text-red-700 dark:text-red-200' : 'font-medium text-fg')}>{deadline.title}</p>
                  </div>
                  {deadline.memo && <p className={clsx('mt-1 line-clamp-2 text-xs', isDueToday ? 'font-medium text-red-500' : 'text-fg-muted')}>{deadline.memo}</p>}
                </div>
                <span className={clsx('ml-auto shrink-0 text-right text-xs', isDueToday ? 'font-bold text-red-600' : 'text-red-500', deadline.memo ? 'mt-0.5' : '')}>
                  <span className="block">{format(parseDay(deadline.due_date), 'M/d')}</span>
                  {dueTimeLabel && (
                    <span className="mt-0.5 block font-medium">{dueTimeLabel}</span>
                  )}
                </span>
              </div>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
