import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, subMonths } from 'date-fns';
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
import { usePlannerData } from './hooks/usePlannerData';
import { CalendarBoard, type CalendarSelectionKind } from './components/CalendarBoard';
import { CategoryModal } from './components/CategoryModal';
import { ConfirmDailyDeleteDialog, ImageViewer, NoIncompleteNoticeDialog } from './components/DailyDialogs';
import { DailyPanel } from './components/DailyPanel';
import { DeadlineCreateModal, DeadlineEditModal } from './components/DeadlineModals';
import { PlannerPanel } from './components/PlannerPanel';
import { ProjectCreateModal } from './components/ProjectCreateModal';
import { TaskEditModal } from './components/TaskEditModal';
import { TimePickerModal } from './components/TimePickerModal';
import { WeeklyPanel } from './components/WeeklyPanel';
import { ProfileModal } from './components/ProfileModal';
import { Overlay, hasEscapeOverlay } from './components/Overlay';
import { RecoveryPasswordDialog } from './components/AuthScreen';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { migrateLegacyTaskImages } from './lib/imageAttachment';
import { runPlannerWrite } from './lib/supabaseSync';

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
  const [isQuickCreateMenuOpen, setIsQuickCreateMenuOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSelectingDeadlineDate, setIsSelectingDeadlineDate] = useState(false);
  const [selectingDateForDeadline, setSelectingDateForDeadline] = useState<string | null>(null);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineMemo, setDeadlineMemo] = useState('');
  const [deadlineDueDate, setDeadlineDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deadlineDueTime, setDeadlineDueTime] = useState<string | null>(null);
  const [deadlineReminderDays, setDeadlineReminderDays] = useState<number | null>(null);
  const [timePickerKind, setTimePickerKind] = useState<'task' | 'deadline'>('task');

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

  const selectionKind: CalendarSelectionKind = isSelectingDeadlineDate || selectingDateForDeadline
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
      else if (isSelectingDeadlineDate) consume(() => { setIsSelectingDeadlineDate(false); setIsDeadlineModalOpen(true); });
      else if (isDailyMenuOpen) consume(() => setIsDailyMenuOpen(false));
      else if (selectingDateForDeadline) consume(() => setSelectingDateForDeadline(null));
      else if (selectingDateForTask) consume(() => setSelectingDateForTask(null));
      else if (dateSelectionMode) consume(() => setDateSelectionMode(null));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickCreateMenuOpen, isSelectingDeadlineDate, isDailyMenuOpen, selectingDateForDeadline, selectingDateForTask, dateSelectionMode]);

  useEffect(() => () => {
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
  }, []);

  useEffect(() => { void migrateLegacyTaskImages(); }, []);

  useEffect(() => {
    if (isLoggedIn) return;
    setIsQuickCreateMenuOpen(false);
    setIsDailyMenuOpen(false);
    setIsCategoryModalOpen(false);
    setIsDeadlineModalOpen(false);
    setIsProjectModalOpen(false);
    setEditingTask(null);
    setIsCreatingTask(false);
    setEditingDeadline(null);
    setConfirmDailyAction(null);
    setIsTimePickerOpen(false);
  }, [isLoggedIn]);

  const closeTaskEditor = () => {
    setEditingTask(null);
    setIsCreatingTask(false);
    setIsTimePickerOpen(false);
  };

  const openTimePicker = (kind: 'task' | 'deadline') => {
    const dueDate = kind === 'task'
      ? editingTask?.target_date
      : editingDeadline?.due_date ?? deadlineDueDate;
    const current = kind === 'task'
      ? editingTask?.scheduled_time
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
    }));
    setDeadlineTitle('');
    setDeadlineMemo('');
    setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd'));
    setDeadlineDueTime(null);
    setDeadlineReminderDays(null);
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
    const { id, ...changes } = editingTask;
    await runPlannerWrite(() => db.tasks.update(id, {
      ...changes,
      title: editingTask.title.trim(),
      memo: editingTask.memo.trim(),
      updated_at: now,
      version: editingTask.version + 1,
    }));
    setEditingTask(null);
  };

  const handleCellClick = async (day: Date) => {
    const destinationDate = format(day, 'yyyy-MM-dd');
    if (isSelectingDeadlineDate) {
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
    <div className="flex h-screen w-full overflow-hidden justify-center items-stretch gap-8 px-6 py-7 bg-bgPrimary max-[1200px]:gap-4 max-[1200px]:px-4 max-[1200px]:py-4 max-[900px]:h-auto max-[900px]:min-h-screen max-[900px]:overflow-visible max-[900px]:flex-col max-[900px]:items-center max-[900px]:gap-5 max-[900px]:px-4 max-[900px]:py-5">
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
          setIsCreatingTask(true);
          setEditingTask(createBlankTask(format(selectedDate, 'yyyy-MM-dd')));
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateDeadline={() => {
          if (!requireLogin()) return;
          setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd'));
          setDeadlineDueTime(null);
          setIsDeadlineModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateProject={() => {
          if (!requireLogin()) return;
          setIsProjectModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onOpenCategories={() => {
          if (!requireLogin()) return;
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
          setEditingDeadline(deadline);
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
            onOpenTask={(task) => { setIsCreatingTask(false); setEditingTask(task); }}
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
          onTitleChange={setDeadlineTitle}
          onMemoChange={setDeadlineMemo}
          onReminderChange={setDeadlineReminderDays}
          onPickDate={() => { setIsTimePickerOpen(false); setIsDeadlineModalOpen(false); setIsSelectingDeadlineDate(true); }}
          onOpenTimePicker={() => openTimePicker('deadline')}
          onClose={() => { setIsTimePickerOpen(false); setIsDeadlineModalOpen(false); }}
          onSave={() => { void saveDeadline(); }}
        />
      )}

      {editingDeadline && !selectingDateForDeadline && (
        <DeadlineEditModal
          deadline={editingDeadline}
          onChange={setEditingDeadline}
          onPickDate={() => { setIsTimePickerOpen(false); setSelectingDateForDeadline(editingDeadline.id); }}
          onOpenTimePicker={() => openTimePicker('deadline')}
          onClose={() => { setIsTimePickerOpen(false); setEditingDeadline(null); }}
        />
      )}

      {isProjectModalOpen && (
        <ProjectCreateModal
          nextOrder={projects.reduce((maximum, project) => Math.max(maximum, project.order), -1) + 1}
          onClose={() => setIsProjectModalOpen(false)}
          onCreated={() => setIsProjectModalOpen(false)}
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
            await runPlannerWrite(() => db.tasks.update(editingTask.id, { deleted_at: now, updated_at: now, version: editingTask.version + 1 }));
            setEditingTask(null);
          }}
          onSave={() => { void saveEditingTask(); }}
        />
      )}

      {isTimePickerOpen && (timePickerKind === 'task' ? editingTask && !selectingDateForTask : isDeadlineModalOpen || editingDeadline) && (
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
            else if (editingDeadline) setEditingDeadline({ ...editingDeadline, due_time: null });
            else setDeadlineDueTime(null);
            setIsTimePickerOpen(false);
          }}
          onConfirm={() => {
            const dueDate = timePickerKind === 'task'
              ? editingTask?.target_date
              : editingDeadline?.due_date ?? deadlineDueDate;
            if (!dueDate) return;
            const next = isoFromTimeParts(dueDate, timeMeridiem, timeHour, timeMinute);
            if (timePickerKind === 'task' && editingTask) setEditingTask({ ...editingTask, scheduled_time: next });
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
        <CategoryModal categories={categories} projects={projects} onClose={() => setIsCategoryModalOpen(false)} />
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
