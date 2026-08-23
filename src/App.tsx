import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, differenceInCalendarDays, format, getISODay, parseISO, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { DropResult } from '@hello-pangea/dnd';
import { db, type Deadline, type Task } from './lib/db';
import { deadlineOnDate, isoFromTimeParts, parseDay, timePartsFromDate, type Meridiem } from './lib/datetime';
import {
  applyTaskReorder,
  copyAllTasksToDate,
  createBlankTask,
  deleteDayTasks,
  moveIncompleteTasksToDate,
  moveTaskToDate,
  nextOrderFor,
  persistTaskReorder,
} from './lib/taskOps';
import { createRoutine, materializeRoutines, stopRoutine } from './lib/routineOps';
import type { RecurrenceFreq } from './lib/recurrence';
import { usePlannerData } from './hooks/usePlannerData';
import { CalendarBoard, type CalendarSelectionKind } from './components/CalendarBoard';
import { CategoryModal, type SettingsSection } from './components/CategoryModal';
import { ConfirmDailyDeleteDialog, ImageViewer, NoIncompleteNoticeDialog } from './components/DailyDialogs';
import { DailyPanel } from './components/DailyPanel';
import { DeadlineCreateModal, DeadlineEditModal } from './components/DeadlineModals';
import { PlannerPanel } from './components/PlannerPanel';
import { ProjectCreateModal } from './components/ProjectCreateModal';
import { RoutineCreateModal } from './components/RoutineCreateModal';
import { AnniversaryCreateModal } from './components/AnniversaryCreateModal';
import { TaskEditModal } from './components/TaskEditModal';
import { TimePickerModal } from './components/TimePickerModal';
import { WeeklyPanel } from './components/WeeklyPanel';
import { ProfileModal } from './components/ProfileModal';
import { Overlay, hasEscapeOverlay } from './components/Overlay';
import { RecoveryPasswordDialog } from './components/AuthScreen';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { migrateLegacyTaskImages } from './lib/imageAttachment';
import { runPlannerWrite } from './lib/supabaseSync';

function weekAfter(start: string) {
  return format(addDays(parseDay(start), 7), 'yyyy-MM-dd');
}

// Typography principle: small text is readable at normal weight. Reserve bold for page titles and primary actions only.
// 빠른 만들기·일별 메뉴는 바깥을 눌러도 닫히지 않게 둔다. 달력 클릭과 메뉴 조작이 겹치지 않게 하려는 의도다.
function PlannerApp() {
  const { session, isPasswordRecovery, clearPasswordRecovery, isSyncing, syncError, retrySync, accountReady } = useAuth();
  const isLoggedIn = Boolean(session);
  const showPlanner = isLoggedIn && accountReady;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [weeklyGoalWeekStart, setWeeklyGoalWeekStart] = useState<Date | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState('');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('categories');
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [taskFromSettings, setTaskFromSettings] = useState(false);
  const [isQuickCreateMenuOpen, setIsQuickCreateMenuOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isAnniversaryModalOpen, setIsAnniversaryModalOpen] = useState(false);
  const [isSelectingDeadlineDate, setIsSelectingDeadlineDate] = useState(false);
  const [isSelectingRoutineStart, setIsSelectingRoutineStart] = useState(false);
  const [isSelectingRoutineEnd, setIsSelectingRoutineEnd] = useState(false);
  const [selectingDateForDeadline, setSelectingDateForDeadline] = useState<string | null>(null);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineMemo, setDeadlineMemo] = useState('');
  const [deadlineDueDate, setDeadlineDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deadlineDueTime, setDeadlineDueTime] = useState<string | null>(null);
  const [deadlineReminderDays, setDeadlineReminderDays] = useState<number | null>(null);
  const [deadlineProjectId, setDeadlineProjectId] = useState<string | null>(null);
  const [timePickerKind, setTimePickerKind] = useState<'task' | 'deadline' | 'routine'>('task');
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDomainId, setRoutineDomainId] = useState<string | null>(null);
  const [routineStartDate, setRoutineStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [routineEndDate, setRoutineEndDate] = useState(weekAfter(format(new Date(), 'yyyy-MM-dd')));
  const [routineFreq, setRoutineFreq] = useState<RecurrenceFreq>('daily');
  const [routineWeekdays, setRoutineWeekdays] = useState<number[]>([]);
  const [routineScheduledTime, setRoutineScheduledTime] = useState<string | null>(null);
  const [routineImportant, setRoutineImportant] = useState(false);
  const [anniversaryTitle, setAnniversaryTitle] = useState('');
  const [anniversaryEmoji, setAnniversaryEmoji] = useState('🎉');
  const [anniversaryMonth, setAnniversaryMonth] = useState(new Date().getMonth() + 1);
  const [anniversaryDay, setAnniversaryDay] = useState(new Date().getDate());
  const [anniversaryUseStartYear, setAnniversaryUseStartYear] = useState(false);
  const [anniversaryStartYear, setAnniversaryStartYear] = useState<number | null>(null);

  const [quickAddCategoryId, setQuickAddCategoryId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [selectingDateForTask, setSelectingDateForTask] = useState<string | null>(null);
  const [dateSelectionMode, setDateSelectionMode] = useState<'MOVE_INCOMPLETE' | 'COPY_ALL' | null>(null);
  const [isDailyMenuOpen, setIsDailyMenuOpen] = useState(false);
  const [confirmDailyAction, setConfirmDailyAction] = useState<'DELETE_INCOMPLETE' | 'DELETE_ALL' | null>(null);
  const [isNoIncompleteNoticeOpen, setIsNoIncompleteNoticeOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [timeMeridiem, setTimeMeridiem] = useState<Meridiem>('AM');
  const [timeHour, setTimeHour] = useState(9);
  const [timeMinute, setTimeMinute] = useState(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [justDroppedTaskId, setJustDroppedTaskId] = useState<string | null>(null);
  const dropFeedbackTimer = useRef<number | null>(null);
  const optimisticClearTimer = useRef<number | null>(null);

  const planner = usePlannerData(optimisticTasks);
  const tasks = showPlanner ? planner.tasks : [];
  const categories = showPlanner ? planner.categories : [];
  const goals = showPlanner ? planner.goals : [];
  const deadlines = showPlanner ? planner.deadlines : [];
  const projects = showPlanner ? planner.projects : [];
  const anniversaries = showPlanner ? planner.anniversaries : [];
  const routines = showPlanner ? planner.routines : [];
  const calendarTaskCountByDate = showPlanner ? planner.calendarTaskCountByDate : {};
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateLabel = format(selectedDate, 'yyyy-MM-dd EEEE', { locale: ko });
  const selectedDateIncompleteCount = tasks.filter(task => task.target_date === selectedDateString && !task.is_completed).length;
  const deadlineNotices = useMemo(() =>
    deadlines
      .map(deadline => ({ deadline, remainingDays: differenceInCalendarDays(parseDay(deadline.due_date), selectedDate) }))
      .filter(({ deadline, remainingDays }) => deadline.reminder_days !== null && remainingDays >= 0 && remainingDays <= deadline.reminder_days)
      .sort((a, b) => a.remainingDays - b.remainingDays),
    [deadlines, selectedDate],
  );

  const selectionKind: CalendarSelectionKind = isSelectingRoutineStart
    ? 'routine-start'
    : isSelectingRoutineEnd
      ? 'routine-end'
      : isSelectingDeadlineDate || selectingDateForDeadline
        ? 'deadline'
        : dateSelectionMode === 'COPY_ALL'
          ? 'copy'
          : selectingDateForTask || dateSelectionMode === 'MOVE_INCOMPLETE'
            ? 'move'
            : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (hasEscapeOverlay()) return;
      const consume = (fn: () => void) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        fn();
      };
      if (isQuickCreateMenuOpen) consume(() => setIsQuickCreateMenuOpen(false));
      else if (isSelectingRoutineStart) consume(() => { setIsSelectingRoutineStart(false); setIsRoutineModalOpen(true); });
      else if (isSelectingRoutineEnd) consume(() => { setIsSelectingRoutineEnd(false); setIsRoutineModalOpen(true); });
      else if (isSelectingDeadlineDate) consume(() => { setIsSelectingDeadlineDate(false); setIsDeadlineModalOpen(true); });
      else if (isDailyMenuOpen) consume(() => setIsDailyMenuOpen(false));
      else if (selectingDateForDeadline) consume(() => setSelectingDateForDeadline(null));
      else if (selectingDateForTask) consume(() => setSelectingDateForTask(null));
      else if (dateSelectionMode) consume(() => setDateSelectionMode(null));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickCreateMenuOpen, isSelectingRoutineStart, isSelectingRoutineEnd, isSelectingDeadlineDate, isDailyMenuOpen, selectingDateForDeadline, selectingDateForTask, dateSelectionMode]);

  useEffect(() => () => {
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
  }, []);

  useEffect(() => { void migrateLegacyTaskImages(); }, []);

  useEffect(() => {
    if (!showPlanner) return;
    void materializeRoutines(currentDate);
  }, [showPlanner, currentDate]);

  useEffect(() => {
    setIsDailyMenuOpen(false);
  }, [selectedDateString, viewMode]);

  useEffect(() => {
    if (isLoggedIn) return;
    setIsQuickCreateMenuOpen(false);
    setIsDailyMenuOpen(false);
    setIsCategoryModalOpen(false);
    setIsDeadlineModalOpen(false);
    setIsProjectModalOpen(false);
    setIsRoutineModalOpen(false);
    setIsAnniversaryModalOpen(false);
    setIsSelectingRoutineStart(false);
    setIsSelectingRoutineEnd(false);
    setTaskFromSettings(false);
    setSettingsSection('categories');
    setSettingsProjectId(null);
    setEditingTask(null);
    setIsCreatingTask(false);
    setEditingDeadline(null);
    setConfirmDailyAction(null);
    setIsTimePickerOpen(false);
  }, [isLoggedIn]);

  const restoreSettingsAfterEditor = () => {
    if (!taskFromSettings) return;
    setIsCategoryModalOpen(true);
    setTaskFromSettings(false);
  };

  const closeTaskEditor = () => {
    setEditingTask(null);
    setIsCreatingTask(false);
    setIsTimePickerOpen(false);
    restoreSettingsAfterEditor();
  };

  const closeDeadlineEditor = () => {
    setIsTimePickerOpen(false);
    setEditingDeadline(null);
    restoreSettingsAfterEditor();
  };

  const closeRoutineEditor = () => {
    setIsTimePickerOpen(false);
    setIsRoutineModalOpen(false);
    setIsSelectingRoutineStart(false);
    setIsSelectingRoutineEnd(false);
  };

  const openTimePicker = (kind: 'task' | 'deadline' | 'routine') => {
    const dueDate = kind === 'task'
      ? editingTask?.target_date
      : kind === 'routine'
        ? routineStartDate
        : editingDeadline?.due_date ?? deadlineDueDate;
    const current = kind === 'task'
      ? editingTask?.scheduled_time
      : kind === 'routine'
        ? routineScheduledTime
        : editingDeadline?.due_time ?? deadlineDueTime;
    if (!dueDate) return;
    const date = current ? parseISO(current) : new Date(`${dueDate}T09:00:00`);
    const parts = timePartsFromDate(date);
    setTimeMeridiem(parts.meridiem);
    setTimeHour(parts.hour);
    setTimeMinute(parts.minute);
    setTimePickerKind(kind);
    setIsTimePickerOpen(true);
  };

  const closeAnniversaryEditor = () => {
    setIsAnniversaryModalOpen(false);
  };

  const saveAnniversary = async () => {
    if (!anniversaryTitle.trim()) return;
    const now = new Date().toISOString();
    await runPlannerWrite(() => db.anniversaries.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      title: anniversaryTitle.trim(),
      emoji: anniversaryEmoji,
      month: anniversaryMonth,
      day: anniversaryDay,
      start_year: anniversaryUseStartYear ? anniversaryStartYear : null,
    }));
    setAnniversaryTitle('');
    setAnniversaryEmoji('🎉');
    setAnniversaryUseStartYear(false);
    setAnniversaryStartYear(null);
    closeAnniversaryEditor();
  };

  const openAnniversaryCreate = () => {
    setAnniversaryTitle('');
    setAnniversaryEmoji('🎉');
    setAnniversaryMonth(selectedDate.getMonth() + 1);
    setAnniversaryDay(selectedDate.getDate());
    setAnniversaryUseStartYear(false);
    setAnniversaryStartYear(null);
    setIsAnniversaryModalOpen(true);
  };

  const changeRoutineFreq = (freq: RecurrenceFreq) => {
    setRoutineFreq(freq);
    if ((freq === 'weekly' || freq === 'biweekly') && routineWeekdays.length === 0) {
      setRoutineWeekdays([getISODay(parseDay(routineStartDate))]);
    }
  };

  const saveRoutine = async () => {
    if (!routineTitle.trim()) return;
    const endDate = routineEndDate < routineStartDate ? weekAfter(routineStartDate) : routineEndDate;
    await createRoutine({
      title: routineTitle,
      domain_id: routineDomainId,
      start_date: routineStartDate,
      end_date: endDate,
      freq: routineFreq,
      weekdays: routineWeekdays,
      scheduled_time: routineScheduledTime,
      is_important: routineImportant,
    });
    setRoutineTitle('');
    setRoutineDomainId(null);
    setRoutineImportant(false);
    setRoutineStartDate(format(selectedDate, 'yyyy-MM-dd'));
    setRoutineEndDate(weekAfter(format(selectedDate, 'yyyy-MM-dd')));
    setRoutineFreq('daily');
    setRoutineWeekdays([]);
    setRoutineScheduledTime(null);
    closeRoutineEditor();
  };

  const saveQuickAdd = async (categoryId: string | null, closeAfterSave = false) => {
    if (!quickAddTitle.trim()) {
      if (closeAfterSave) setQuickAddCategoryId(null);
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await runPlannerWrite(() => db.tasks.add({
      ...createBlankTask(dateStr),
      title: quickAddTitle.trim(),
      domain_id: categoryId,
      order: nextOrderFor(tasks, dateStr, categoryId),
    }));
    setQuickAddTitle('');
    if (closeAfterSave) setQuickAddCategoryId(null);
  };

  const handleTaskDragEnd = async (result: DropResult) => {
    const { destination, source } = result;
    setDraggedTaskId(null);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const optimisticResult = applyTaskReorder(tasks, dateStr, result);
    if (!optimisticResult) return;
    setOptimisticTasks(optimisticResult);
    setJustDroppedTaskId(result.draggableId);
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    dropFeedbackTimer.current = window.setTimeout(() => setJustDroppedTaskId(null), 420);

    try {
      await persistTaskReorder(dateStr, result);
      if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
      optimisticClearTimer.current = window.setTimeout(() => setOptimisticTasks(null), 100);
    } catch {
      setOptimisticTasks(null);
    }
  };

  const saveDeadline = async () => {
    if (!deadlineTitle.trim()) return;
    const now = new Date().toISOString();
    await runPlannerWrite(() => db.deadlines.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      title: deadlineTitle.trim(),
      memo: deadlineMemo.trim(),
      due_date: deadlineDueDate,
      due_time: deadlineDueTime,
      reminder_days: deadlineReminderDays,
      project_id: deadlineProjectId,
    }));
    setDeadlineTitle('');
    setDeadlineMemo('');
    setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd'));
    setDeadlineDueTime(null);
    setDeadlineReminderDays(null);
    setDeadlineProjectId(null);
    setIsDeadlineModalOpen(false);
    setIsTimePickerOpen(false);
  };

  const saveEditingTask = async () => {
    if (!editingTask?.title.trim()) return;
    const now = new Date().toISOString();
    if (isCreatingTask) {
      await runPlannerWrite(() => db.tasks.add({
        ...editingTask,
        title: editingTask.title.trim(),
        memo: editingTask.memo.trim(),
        order: nextOrderFor(tasks, editingTask.target_date, editingTask.domain_id),
        created_at: now,
        updated_at: now,
        version: 1,
      }));
      closeTaskEditor();
      return;
    }
    await runPlannerWrite(async () => {
      const current = await db.tasks.get(editingTask.id);
      if (!current || current.deleted_at !== null) return;
      const savedAt = new Date().toISOString();
      if (current.routine_id && current.target_date !== editingTask.target_date) {
        const destinationTasks = (await db.tasks.where('target_date').equals(editingTask.target_date).toArray())
          .filter(task => task.deleted_at === null);
        const order = nextOrderFor(destinationTasks, editingTask.target_date, editingTask.domain_id);
        await db.tasks.bulkPut([
          { ...current, deleted_at: savedAt, updated_at: savedAt, version: current.version + 1 },
          {
            ...current,
            id: crypto.randomUUID(),
            version: 1,
            created_at: savedAt,
            updated_at: savedAt,
            deleted_at: null,
            title: editingTask.title.trim(),
            memo: editingTask.memo.trim(),
            target_date: editingTask.target_date,
            deadline: editingTask.deadline,
            scheduled_time: editingTask.scheduled_time,
            domain_id: editingTask.domain_id,
            goal_id: editingTask.goal_id,
            project_id: editingTask.project_id,
            routine_id: null,
            is_important: editingTask.is_important,
            image_blob: editingTask.image_blob ?? null,
            image_data: editingTask.image_data ?? null,
            image_path: editingTask.image_path,
            order,
          },
        ]);
        return;
      }
      await db.tasks.put({
        ...current,
        title: editingTask.title.trim(),
        memo: editingTask.memo.trim(),
        target_date: editingTask.target_date,
        deadline: editingTask.deadline,
        scheduled_time: editingTask.scheduled_time,
        domain_id: editingTask.domain_id,
        goal_id: editingTask.goal_id,
        project_id: editingTask.project_id,
        routine_id: editingTask.routine_id,
        is_important: editingTask.is_important,
        image_blob: editingTask.image_blob ?? null,
        image_data: editingTask.image_data ?? null,
        image_path: editingTask.image_path,
        updated_at: savedAt,
        version: current.version + 1,
      });
    });
    closeTaskEditor();
  };

  const handleCellClick = async (day: Date) => {
    const destinationDate = format(day, 'yyyy-MM-dd');
    if (isSelectingRoutineStart) {
      setRoutineStartDate(destinationDate);
      setRoutineScheduledTime(current => deadlineOnDate(current, destinationDate));
      setRoutineEndDate(current => (current < destinationDate ? weekAfter(destinationDate) : current));
      setIsSelectingRoutineStart(false);
      setIsRoutineModalOpen(true);
    } else if (isSelectingRoutineEnd) {
      setRoutineEndDate(destinationDate < routineStartDate ? routineStartDate : destinationDate);
      setIsSelectingRoutineEnd(false);
      setIsRoutineModalOpen(true);
    } else if (isSelectingDeadlineDate) {
      setDeadlineDueDate(destinationDate);
      setDeadlineDueTime(current => deadlineOnDate(current, destinationDate));
      setIsSelectingDeadlineDate(false);
      setIsDeadlineModalOpen(true);
    } else if (selectingDateForDeadline) {
      if (editingDeadline && editingDeadline.id === selectingDateForDeadline) {
        setEditingDeadline({
          ...editingDeadline,
          due_date: destinationDate,
          due_time: deadlineOnDate(editingDeadline.due_time, destinationDate),
        });
      }
      setSelectingDateForDeadline(null);
    } else if (dateSelectionMode === 'MOVE_INCOMPLETE') {
      await moveIncompleteTasksToDate(selectedDateString, destinationDate);
      setDateSelectionMode(null);
    } else if (dateSelectionMode === 'COPY_ALL') {
      await copyAllTasksToDate(selectedDateString, destinationDate);
      setDateSelectionMode(null);
    } else if (selectingDateForTask) {
      if (editingTask && editingTask.id === selectingDateForTask) {
        if (editingTask.target_date !== destinationDate) {
          setEditingTask({
            ...editingTask,
            target_date: destinationDate,
            deadline: deadlineOnDate(editingTask.deadline, destinationDate),
            scheduled_time: deadlineOnDate(editingTask.scheduled_time, destinationDate),
          });
        }
        setSelectingDateForTask(null);
      } else {
        await moveTaskToDate(selectingDateForTask, destinationDate);
        setSelectingDateForTask(null);
      }
    }
    setSelectedDate(day);
    setViewMode('DAILY');
  };

  const requireLogin = () => {
    if (isLoggedIn) return true;
    setIsQuickCreateMenuOpen(false);
    setIsDailyMenuOpen(false);
    setIsProfileOpen(true);
    return false;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden justify-center items-stretch gap-7 px-12 pt-10 pb-10 bg-bgPrimary max-[1200px]:gap-3 max-[1200px]:px-8 max-[1200px]:pt-6 max-[1200px]:pb-8 max-[900px]:h-auto max-[900px]:min-h-screen max-[900px]:overflow-visible max-[900px]:flex-col max-[900px]:items-center max-[900px]:gap-5 max-[900px]:px-6 max-[900px]:pt-7 max-[900px]:pb-10">
      {isLoggedIn && (!accountReady || isSyncing || syncError) && (
        <div className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-lg">
          {syncError ? (
            <span className="flex items-center gap-3">
              <span className="text-red-600 dark:text-red-400">계정 데이터와 맞추지 못했습니다.</span>
              <button type="button" onClick={retrySync} className="font-semibold text-fg underline-offset-2 hover:underline">다시 시도</button>
            </span>
          ) : (
            <span className="text-fg-muted">계정 데이터를 불러오는 중…</span>
          )}
        </div>
      )}
      <CalendarBoard
        currentDate={currentDate}
        selectedDate={selectedDate}
        viewMode={viewMode}
        weeklyGoalWeekStart={weeklyGoalWeekStart}
        countsByDate={calendarTaskCountByDate}
        deadlines={deadlines}
        goals={goals}
        anniversaries={anniversaries}
        selectionKind={selectionKind}
        isQuickCreateOpen={isQuickCreateMenuOpen}
        onGoToToday={() => {
          setCurrentDate(new Date());
          setSelectedDate(new Date());
          setViewMode('DAILY');
        }}
        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
        onToggleQuickCreate={() => {
          if (!requireLogin()) return;
          setIsQuickCreateMenuOpen(open => !open);
        }}
        onCreateTask={() => {
          if (!requireLogin()) return;
          setTaskFromSettings(false);
          setIsCreatingTask(true);
          setEditingTask(createBlankTask(format(selectedDate, 'yyyy-MM-dd')));
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateDeadline={() => {
          if (!requireLogin()) return;
          setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd'));
          setDeadlineDueTime(null);
          setDeadlineProjectId(null);
          setIsDeadlineModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateRoutine={() => {
          if (!requireLogin()) return;
          const start = format(selectedDate, 'yyyy-MM-dd');
          setRoutineTitle('');
          setRoutineDomainId(null);
          setRoutineImportant(false);
          setRoutineStartDate(start);
          setRoutineEndDate(weekAfter(start));
          setRoutineFreq('daily');
          setRoutineWeekdays([]);
          setRoutineScheduledTime(null);
          setIsRoutineModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateAnniversary={() => {
          if (!requireLogin()) return;
          openAnniversaryCreate();
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateProject={() => {
          if (!requireLogin()) return;
          setIsProjectModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onOpenCategories={() => {
          if (!requireLogin()) return;
          setSettingsSection('appearance');
          setSettingsProjectId(null);
          setIsCategoryModalOpen(true);
        }}
        onOpenProfile={() => setIsProfileOpen(true)}
        onCancelSelection={() => {
          setSelectingDateForTask(null);
          setSelectingDateForDeadline(null);
          setDateSelectionMode(null);
          if (isSelectingDeadlineDate) {
            setIsSelectingDeadlineDate(false);
            setIsDeadlineModalOpen(true);
          }
          if (isSelectingRoutineStart || isSelectingRoutineEnd) {
            setIsSelectingRoutineStart(false);
            setIsSelectingRoutineEnd(false);
            setIsRoutineModalOpen(true);
          }
        }}
        onCellClick={(day) => { void handleCellClick(day); }}
        onSelectWeek={(weekStart) => {
          setWeeklyGoalWeekStart(weekStart);
          setViewMode('WEEKLY');
        }}
      />

      <PlannerPanel
        viewMode={viewMode}
        selectedDate={selectedDate}
        weeklyGoalWeekStart={weeklyGoalWeekStart}
        isDailyMenuOpen={isDailyMenuOpen}
        deadlineNotices={deadlineNotices}
        projects={projects}
        anniversaries={anniversaries}
        onToggleDailyMenu={() => {
          if (!requireLogin()) return;
          setIsDailyMenuOpen(open => !open);
        }}
        onMoveIncompleteTomorrow={() => {
          if (!requireLogin()) return;
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else void moveIncompleteTasksToDate(selectedDateString, format(addDays(selectedDate, 1), 'yyyy-MM-dd'));
          setIsDailyMenuOpen(false);
        }}
        onMoveIncompletePickDate={() => {
          if (!requireLogin()) return;
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else setDateSelectionMode('MOVE_INCOMPLETE');
          setIsDailyMenuOpen(false);
        }}
        onDeleteIncomplete={() => {
          if (!requireLogin()) return;
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else setConfirmDailyAction('DELETE_INCOMPLETE');
          setIsDailyMenuOpen(false);
        }}
        onCopyAll={() => {
          if (!requireLogin()) return;
          setDateSelectionMode('COPY_ALL');
          setIsDailyMenuOpen(false);
        }}
        onDeleteAll={() => {
          if (!requireLogin()) return;
          setConfirmDailyAction('DELETE_ALL');
          setIsDailyMenuOpen(false);
        }}
        onOpenDeadline={(deadline) => {
          if (!requireLogin()) return;
          setTaskFromSettings(false);
          setEditingDeadline(deadline);
        }}
        onOpenProject={(project) => {
          if (!requireLogin()) return;
          setSettingsSection('projects');
          setSettingsProjectId(project.id);
          setIsCategoryModalOpen(true);
        }}
      >
        {viewMode === 'DAILY' ? (
          isLoggedIn ? (
          <DailyPanel
            selectedDate={selectedDate}
            categories={categories}
            projects={projects}
            tasks={tasks}
            quickAddCategoryId={quickAddCategoryId}
            quickAddTitle={quickAddTitle}
            draggedTaskId={draggedTaskId}
            justDroppedTaskId={justDroppedTaskId}
            onDragStart={setDraggedTaskId}
            onDragEnd={(result) => { void handleTaskDragEnd(result); }}
            onQuickAddCategory={(categoryKey) => {
              if (!requireLogin()) return;
              setQuickAddCategoryId(categoryKey);
              setQuickAddTitle('');
            }}
            onQuickAddTitleChange={setQuickAddTitle}
            onQuickAddSubmit={(categoryId) => {
              if (!requireLogin()) return;
              void saveQuickAdd(categoryId);
            }}
            onQuickAddBlur={(categoryId) => {
              if (!requireLogin()) return;
              void saveQuickAdd(categoryId, true);
            }}
            onOpenTask={(task) => { setTaskFromSettings(false); setIsCreatingTask(false); setEditingTask(task); }}
            onOpenProject={(project) => {
              setSettingsSection('projects');
              setSettingsProjectId(project.id);
              setIsCategoryModalOpen(true);
            }}
            onViewImage={setViewingImage}
          />
          ) : null
        ) : weeklyGoalWeekStart && isLoggedIn ? (
          <WeeklyPanel
            weekStart={weeklyGoalWeekStart}
            goals={goals}
            editingGoalId={editingGoalId}
            editingGoalTitle={editingGoalTitle}
            onEditingGoalIdChange={setEditingGoalId}
            onEditingGoalTitleChange={setEditingGoalTitle}
            onCreate={requireLogin}
          />
        ) : null}
      </PlannerPanel>

      {isDeadlineModalOpen && (
        <DeadlineCreateModal
          title={deadlineTitle}
          memo={deadlineMemo}
          dueDate={deadlineDueDate}
          dueTime={deadlineDueTime}
          reminderDays={deadlineReminderDays}
          projects={projects}
          projectId={deadlineProjectId}
          onTitleChange={setDeadlineTitle}
          onMemoChange={setDeadlineMemo}
          onReminderChange={setDeadlineReminderDays}
          onProjectChange={setDeadlineProjectId}
          onPickDate={() => { setIsTimePickerOpen(false); setIsDeadlineModalOpen(false); setIsSelectingDeadlineDate(true); }}
          onOpenTimePicker={() => openTimePicker('deadline')}
          onClose={() => { setIsTimePickerOpen(false); setIsDeadlineModalOpen(false); setDeadlineProjectId(null); }}
          onSave={() => { void saveDeadline(); }}
        />
      )}

      {editingDeadline && !selectingDateForDeadline && (
        <DeadlineEditModal
          deadline={editingDeadline}
          projects={projects}
          onChange={setEditingDeadline}
          onPickDate={() => { setIsTimePickerOpen(false); setSelectingDateForDeadline(editingDeadline.id); }}
          onOpenTimePicker={() => openTimePicker('deadline')}
          onClose={closeDeadlineEditor}
        />
      )}

      {isProjectModalOpen && (
        <ProjectCreateModal
          nextOrder={projects.reduce((maximum, project) => Math.max(maximum, project.order), -1) + 1}
          onClose={() => setIsProjectModalOpen(false)}
          onCreated={() => setIsProjectModalOpen(false)}
        />
      )}

      {isRoutineModalOpen && !isSelectingRoutineStart && !isSelectingRoutineEnd && (
        <RoutineCreateModal
          title={routineTitle}
          domainId={routineDomainId}
          startDate={routineStartDate}
          endDate={routineEndDate}
          freq={routineFreq}
          weekdays={routineWeekdays}
          scheduledTime={routineScheduledTime}
          isImportant={routineImportant}
          categories={categories}
          onTitleChange={setRoutineTitle}
          onDomainChange={setRoutineDomainId}
          onImportantChange={setRoutineImportant}
          onFreqChange={changeRoutineFreq}
          onWeekdaysChange={setRoutineWeekdays}
          onPickStartDate={() => { setIsTimePickerOpen(false); setIsRoutineModalOpen(false); setIsSelectingRoutineStart(true); }}
          onPickEndDate={() => { setIsTimePickerOpen(false); setIsRoutineModalOpen(false); setIsSelectingRoutineEnd(true); }}
          onOpenTimePicker={() => openTimePicker('routine')}
          onClose={closeRoutineEditor}
          onSave={() => { void saveRoutine(); }}
        />
      )}

      {isAnniversaryModalOpen && (
        <AnniversaryCreateModal
          title={anniversaryTitle}
          emoji={anniversaryEmoji}
          month={anniversaryMonth}
          day={anniversaryDay}
          useStartYear={anniversaryUseStartYear}
          startYear={anniversaryStartYear}
          onTitleChange={setAnniversaryTitle}
          onEmojiChange={setAnniversaryEmoji}
          onMonthChange={setAnniversaryMonth}
          onDayChange={setAnniversaryDay}
          onUseStartYearChange={setAnniversaryUseStartYear}
          onStartYearChange={setAnniversaryStartYear}
          onClose={closeAnniversaryEditor}
          onSave={() => { void saveAnniversary(); }}
        />
      )}

      {editingTask && !selectingDateForTask && (
        <TaskEditModal
          task={editingTask}
          isCreating={isCreatingTask}
          categories={categories}
          projects={projects}
          onChange={setEditingTask}
          onClose={closeTaskEditor}
          onPickDate={() => {
            setIsTimePickerOpen(false);
            setSelectingDateForTask(editingTask.id);
          }}
          onOpenTimePicker={() => openTimePicker('task')}
          onDelete={async () => {
            const now = new Date().toISOString();
            await runPlannerWrite(async () => {
              const current = await db.tasks.get(editingTask.id);
              if (!current || current.deleted_at !== null) return;
              await db.tasks.update(current.id, { deleted_at: now, updated_at: now, version: current.version + 1 });
            });
            closeTaskEditor();
          }}
          onStopRoutine={() => {
            if (!editingTask.routine_id) return;
            void stopRoutine(editingTask.routine_id);
          }}
          onSave={() => { void saveEditingTask(); }}
        />
      )}

      {isTimePickerOpen && (
        timePickerKind === 'task'
          ? editingTask && !selectingDateForTask
          : timePickerKind === 'routine'
            ? isRoutineModalOpen
            : isDeadlineModalOpen || editingDeadline
      ) && (
        <TimePickerModal
          meridiem={timeMeridiem}
          hour={timeHour}
          minute={timeMinute}
          onMeridiemChange={setTimeMeridiem}
          onHourChange={setTimeHour}
          onMinuteChange={setTimeMinute}
          onClose={() => setIsTimePickerOpen(false)}
          onClear={() => {
            if (timePickerKind === 'task' && editingTask) setEditingTask({ ...editingTask, scheduled_time: null });
            else if (timePickerKind === 'routine') setRoutineScheduledTime(null);
            else if (editingDeadline) setEditingDeadline({ ...editingDeadline, due_time: null });
            else setDeadlineDueTime(null);
            setIsTimePickerOpen(false);
          }}
          onConfirm={() => {
            const dueDate = timePickerKind === 'task'
              ? editingTask?.target_date
              : timePickerKind === 'routine'
                ? routineStartDate
                : editingDeadline?.due_date ?? deadlineDueDate;
            if (!dueDate) return;
            const next = isoFromTimeParts(dueDate, timeMeridiem, timeHour, timeMinute);
            if (timePickerKind === 'task' && editingTask) setEditingTask({ ...editingTask, scheduled_time: next });
            else if (timePickerKind === 'routine') setRoutineScheduledTime(next);
            else if (editingDeadline) setEditingDeadline({ ...editingDeadline, due_time: next });
            else setDeadlineDueTime(next);
            setIsTimePickerOpen(false);
          }}
        />
      )}

      {confirmDailyAction && (
        <ConfirmDailyDeleteDialog
          mode={confirmDailyAction}
          dateLabel={selectedDateLabel}
          onCancel={() => setConfirmDailyAction(null)}
          onConfirm={() => { void deleteDayTasks(selectedDateString, confirmDailyAction === 'DELETE_INCOMPLETE').then(() => setConfirmDailyAction(null)); }}
        />
      )}

      {isNoIncompleteNoticeOpen && (
        <NoIncompleteNoticeDialog dateLabel={selectedDateLabel} onClose={() => setIsNoIncompleteNoticeOpen(false)} />
      )}

      {viewingImage && (
        <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {isCategoryModalOpen && (
        <CategoryModal
          categories={categories}
          projects={projects}
          tasks={tasks}
          deadlines={deadlines}
          anniversaries={anniversaries}
          routines={routines}
          initialSection={settingsSection}
          initialProjectId={settingsProjectId}
          onClose={() => setIsCategoryModalOpen(false)}
          onOpenTask={(task) => {
            setTaskFromSettings(true);
            setSettingsSection('projects');
            setSettingsProjectId(task.project_id);
            setIsCategoryModalOpen(false);
            setIsCreatingTask(false);
            setEditingTask(task);
          }}
          onOpenDeadline={(deadline) => {
            setTaskFromSettings(true);
            setSettingsSection('projects');
            setSettingsProjectId(deadline.project_id);
            setIsCategoryModalOpen(false);
            setEditingDeadline(deadline);
          }}
        />
      )}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isPasswordRecovery && (
        <Overlay zClassName="z-[80]" onEscape={clearPasswordRecovery}>
          <section className="w-full max-w-[400px] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <RecoveryPasswordDialog onDone={clearPasswordRecovery} />
          </section>
        </Overlay>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <PlannerApp />
    </AuthProvider>
  );
}

export default App;
