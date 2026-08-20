import {
  format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, isToday, differenceInCalendarDays,
} from 'date-fns';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Plus, Repeat2, Settings, Target, ListTodo, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Deadline, Goal } from '../lib/db';
import { db } from '../lib/db';
import { EMPTY_DAY_COUNTS, isDayCleared, type DayTaskCounts } from '../lib/taskCounts';
import { CountBubble } from './CountBubble';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useCalendarCellMetrics } from '../hooks/useCalendarCellMetrics';
import { useObjectUrl } from '../hooks/useObjectUrl';

export type CalendarSelectionKind = 'deadline' | 'copy' | 'move' | null;

type CalendarBoardProps = {
  currentDate: Date;
  selectedDate: Date;
  viewMode: 'DAILY' | 'WEEKLY';
  weeklyGoalWeekStart: Date | null;
  countsByDate: Record<string, DayTaskCounts>;
  deadlines: Deadline[];
  goals: Goal[];
  selectionKind: CalendarSelectionKind;
  isQuickCreateOpen: boolean;
  onGoToToday: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleQuickCreate: () => void;
  onCreateTask: () => void;
  onCreateDeadline: () => void;
  onOpenCategories: () => void;
  onOpenProfile: () => void;
  onCancelSelection: () => void;
  onCellClick: (day: Date) => void;
  onSelectWeek: (weekStart: Date) => void;
};

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function CalendarAccountBar({ onOpen }: { onOpen: () => void }) {
  const { session } = useAuth();
  const isLoggedIn = Boolean(session);
  const profile = useLiveQuery(
    () => (isLoggedIn ? db.profiles.get('#profile') : undefined),
    [isLoggedIn],
  );
  const avatarUrl = useObjectUrl(isLoggedIn ? profile?.avatar ?? null : null);
  const email = session?.user?.email || '';
  const nickname = profile?.nickname || email.split('@')[0] || '사용자';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={isLoggedIn ? '프로필 및 계정' : '로그인'}
      className="mb-4 flex w-full items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3 text-left shadow-sm hover:bg-surface-muted"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={22} />}
      </span>
      {isLoggedIn ? (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-fg">{nickname}</span>
          <span className="block truncate text-sm text-fg-muted">{email}</span>
        </span>
      ) : (
        <span className="text-[15px] font-medium text-fg-muted">계정에 로그인하세요</span>
      )}
    </button>
  );
}

export function CalendarBoard({
  currentDate,
  selectedDate,
  viewMode,
  weeklyGoalWeekStart,
  countsByDate,
  deadlines,
  goals,
  selectionKind,
  isQuickCreateOpen,
  onGoToToday,
  onPrevMonth,
  onNextMonth,
  onToggleQuickCreate,
  onCreateTask,
  onCreateDeadline,
  onOpenCategories,
  onOpenProfile,
  onCancelSelection,
  onCellClick,
  onSelectWeek,
}: CalendarBoardProps) {
  const isSelecting = selectionKind !== null;
  const bannerText = selectionKind === 'deadline'
    ? '데드라인 날짜를 달력에서 선택하세요'
    : selectionKind === 'copy'
      ? '복사할 날짜를 달력에서 선택하세요'
      : selectionKind === 'move'
        ? '이동할 날짜를 달력에서 선택하세요'
        : null;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const weekCount = Math.ceil((differenceInCalendarDays(endDate, startDate) + 1) / 7);
  const { rootRef, bodyRef } = useCalendarCellMetrics(weekCount);
  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    const weekStart = day;
    const isLastRow = addDays(weekStart, 7) > endDate;

    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayCounts = countsByDate[dateStr] ?? EMPTY_DAY_COUNTS;
      const dayCleared = isDayCleared(dayCounts);
      const dayDeadlines = deadlines.filter(deadline => deadline.due_date === dateStr);
      const hasDeadline = dayDeadlines.length > 0;
      const isWeekend = i === 5 || i === 6;

      days.push(
        <div
          key={day.toString()}
          onClick={() => onCellClick(cloneDay)}
          className={clsx(
            'relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-line transition-[filter] duration-150 cursor-pointer group p-[var(--cal-pad)]',
            isSelecting ? 'hover:bg-primary/20' : 'hover:brightness-95',
            isWeekend && !isSelecting ? (i === 6 ? 'bg-red-50/30 dark:bg-red-950/25' : 'bg-blue-50/30 dark:bg-blue-950/25') : 'bg-surface',
            !isSameMonth(day, monthStart) ? 'opacity-40' : '',
            isSameDay(day, selectedDate) && !isSelecting && viewMode === 'DAILY' ? 'ring-2 ring-primary ring-inset z-10' : '',
            hasDeadline ? 'shadow-[inset_-5px_0_12px_-7px_rgba(239,68,68,0.95)]' : '',
            !isLastRow ? 'border-b' : '',
            i !== 6 ? 'border-r' : '',
            isLastRow && i === 0 ? 'rounded-bl-3xl' : '',
            isLastRow && i === 6 ? 'rounded-br-3xl' : '',
          )}
        >
          <div className="flex shrink-0 justify-between items-start">
            <span className={clsx(
              'flex items-center justify-center rounded-full font-semibold h-[var(--cal-date)] w-[var(--cal-date)] text-[length:var(--cal-date-font)]',
              isToday(day) ? 'bg-primary text-on-primary' :
              i === 5 ? 'text-blue-500' :
              i === 6 ? 'text-red-500' : '',
            )}>
              {format(day, 'd')}
            </span>
            {hasDeadline && <AlertCircle className="calendar-deadline-icon shrink-0 text-red-500 drop-shadow-sm" strokeWidth={2.5} aria-label={`${dayDeadlines.length}개의 데드라인`} />}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden gap-[var(--cal-gap)] mt-[var(--cal-gap)]">
            {dayCleared ? (
              <>
                {dayCounts.completedImportant > 0 && <CountBubble count={0} tone="important" size="calendar" />}
                {dayCounts.completedActive > 0 && <CountBubble count={0} tone="plain" size="calendar" />}
              </>
            ) : (
              <>
                {dayCounts.important > 0 && <CountBubble count={dayCounts.important} tone="important" size="calendar" />}
                {dayCounts.active > 0 && <CountBubble count={dayCounts.active} tone="plain" size="calendar" />}
              </>
            )}
          </div>
        </div>,
      );
      day = addDays(day, 1);
    }

    const cloneWeekStart = weekStart;
    const isSelectedWeek = viewMode === 'WEEKLY' && weeklyGoalWeekStart && isSameDay(cloneWeekStart, weeklyGoalWeekStart);
    const weeklyGoalCount = goals.filter(goal =>
      goal.time_frame === 'WEEK'
      && goal.start_date === format(cloneWeekStart, 'yyyy-MM-dd')
      && !goal.is_completed
    ).length;

    rows.push(
      <div className="relative grid min-h-0 min-w-0 flex-1 grid-cols-7" key={cloneWeekStart.toString()}>
        <div
          className={clsx(
            'absolute -left-16 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-transform duration-200 max-[900px]:hidden',
            isSelectedWeek ? 'bg-primary border-primary text-on-primary scale-110' : 'bg-surface border-line-strong text-fg-subtle hover:text-primary hover:bg-surface-muted hover:scale-110',
          )}
          onClick={() => onSelectWeek(cloneWeekStart)}
          title="주간 목표"
        >
          <Target size={18} />
            {weeklyGoalCount > 0 && (
              <span className="absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full border border-surface bg-surface-hover text-[10px] font-medium leading-none text-fg-muted">
                <span className="translate-y-px">{weeklyGoalCount}</span>
              </span>
            )}
        </div>
        {days}
      </div>,
    );
    days = [];
  }

  return (
    <div ref={rootRef} className="calendar-metrics relative flex h-full min-h-0 min-w-0 w-full max-w-[calc(760px+4rem)] flex-1 flex-col pl-16 max-[900px]:h-auto max-[900px]:max-w-[760px] max-[900px]:flex-none max-[900px]:pl-0">
      <div className="relative mb-4 flex min-w-0 shrink-0 items-center justify-between pl-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold leading-tight">
            <span className="max-[600px]:hidden">{format(currentDate, 'yyyy.')}</span>
            <span className="hidden max-[600px]:inline">{format(currentDate, 'yy.')}</span>
            <span className="ml-2 max-[600px]:ml-0 max-[600px]:block">{format(currentDate, 'MM')}</span>
          </h1>
          <button onClick={onGoToToday} aria-label="오늘" title="오늘" className="shrink-0 px-4 py-1.5 bg-surface border border-line-strong rounded-full text-sm font-medium hover:bg-surface-muted shadow-sm transition-colors max-[900px]:grid max-[900px]:h-10 max-[900px]:w-10 max-[900px]:place-items-center max-[900px]:p-0">
            <span className="max-[900px]:hidden">오늘</span><CalendarDays size={18} className="hidden max-[900px]:block" />
          </button>
        </div>

        {bannerText && (
          <div className="absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold shadow-2xl flex items-center gap-4 z-50 transition-transform">
            <span>{bannerText}</span>
            <button onClick={onCancelSelection} className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 text-sm transition-colors">취소</button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={() => onSelectWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }))} aria-label="주간 목표" title="주간 목표" className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted">
            <Target size={22} />
          </button>
          {/* 바깥 클릭으로 닫히지 않음. 메뉴를 연 채 달력을 보는 흐름을 유지하기 위한 의도. */}
          <div className="relative">
            <button
              onClick={onToggleQuickCreate}
              aria-label="빠른 만들기 메뉴"
              aria-expanded={isQuickCreateOpen}
              className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted"
              title="빠른 만들기"
            >
              <Plus size={24} />
            </button>
            <div className={clsx(
              'absolute top-12 right-0 w-48 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-xl origin-top-right transition-all duration-200 z-40',
              isQuickCreateOpen ? 'scale-100 opacity-100 translate-y-0' : 'pointer-events-none scale-95 opacity-0 -translate-y-1',
            )}>
              <button onClick={onCreateTask} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors">
                <ListTodo size={16} /> 할 일 만들기
              </button>
              <button onClick={onCreateDeadline} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fg-muted hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 transition-colors">
                <AlertCircle size={16} /> 데드라인 만들기
              </button>
              <button disabled className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-fg-subtle cursor-not-allowed">
                <Repeat2 size={16} /> 루틴 만들기
              </button>
            </div>
          </div>
          <button onClick={onOpenCategories} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted" title="설정" aria-label="설정">
            <Settings size={22} />
          </button>
          <ThemeToggle className="max-[560px]:hidden" />
          <button onClick={onOpenProfile} aria-label="프로필 및 계정" className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted" title="프로필 및 계정">
            <UserRound size={21} />
          </button>
          <div className="w-px h-6 bg-line-strong mx-1" />
          <button onClick={onPrevMonth} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted">
            <ChevronLeft size={24} />
          </button>
          <button onClick={onNextMonth} className="p-2 hover:bg-surface-hover rounded-full transition-colors text-fg-muted">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <CalendarAccountBar onOpen={onOpenProfile} />
      </div>

      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-line bg-surface shadow-sm max-[900px]:min-h-[min(520px,70vh)]">
        <div className="grid shrink-0 grid-cols-7 rounded-t-3xl border-b border-line bg-surface pt-1.5 pb-1.5">
          {WEEKDAYS.map((label, i) => (
            <div key={label} className={clsx(
              'py-1.5 text-center text-sm font-medium',
              i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-fg-muted',
            )}>
              {label}
            </div>
          ))}
        </div>
        <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface rounded-b-3xl">{rows}</div>
      </div>
    </div>
  );
}
