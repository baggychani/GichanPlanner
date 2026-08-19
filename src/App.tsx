import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { DropResult } from '@hello-pangea/dnd';
import { db, type Deadline, type Task } from './lib/db';
import { deadlineOnDate, isoFromTimeParts, timePartsFromDate, type Meridiem } from './lib/datetime';
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
import { TaskEditModal } from './components/TaskEditModal';
import { TimePickerModal } from './components/TimePickerModal';
import { WeeklyPanel } from './components/WeeklyPanel';

// Typography principle: small text is readable at normal weight. Reserve bold for page titles and primary actions only.
// 빠른 만들기·일별 메뉴는 바깥을 눌러도 닫히지 않게 둔다. 달력 클릭과 메뉴 조작이 겹치지 않게 하려는 의도다.
function App() {
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
  const [isSelectingDeadlineDate, setIsSelectingDeadlineDate] = useState(false);
  const [selectingDateForDeadline, setSelectingDateForDeadline] = useState<string | null>(null);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineMemo, setDeadlineMemo] = useState('');
  const [deadlineDueDate, setDeadlineDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deadlineReminderDays, setDeadlineReminderDays] = useState<number | null>(null);

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

  const { tasks, categories, goals, deadlines, calendarTaskCountByDate } = usePlannerData(optimisticTasks);
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateLabel = format(selectedDate, 'yyyy-MM-dd EEEE', { locale: ko });
  const selectedDateIncompleteCount = tasks.filter(task => task.target_date === selectedDateString && !task.is_completed).length;
  const deadlineNotices = useMemo(() =>
    deadlines
      .map(deadline => ({ deadline, remainingDays: differenceInCalendarDays(parseISO(deadline.due_date), selectedDate) }))
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
      if (viewingImage) setViewingImage(null);
      else if (isCategoryModalOpen) return;
      else if (isQuickCreateMenuOpen) setIsQuickCreateMenuOpen(false);
      else if (isDeadlineModalOpen) setIsDeadlineModalOpen(false);
      else if (isSelectingDeadlineDate) { setIsSelectingDeadlineDate(false); setIsDeadlineModalOpen(true); }
      else if (isDailyMenuOpen) setIsDailyMenuOpen(false);
      else if (isTimePickerOpen) setIsTimePickerOpen(false);
      else if (confirmDailyAction) setConfirmDailyAction(null);
      else if (isNoIncompleteNoticeOpen) setIsNoIncompleteNoticeOpen(false);
      else if (editingDeadline) setEditingDeadline(null);
      else if (selectingDateForDeadline) setSelectingDateForDeadline(null);
      else if (selectingDateForTask) setSelectingDateForTask(null);
      else if (editingTask) { setEditingTask(null); setIsCreatingTask(false); setIsTimePickerOpen(false); }
      else if (dateSelectionMode) setDateSelectionMode(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImage, isCategoryModalOpen, isQuickCreateMenuOpen, isDeadlineModalOpen, isSelectingDeadlineDate, isDailyMenuOpen, isTimePickerOpen, confirmDailyAction, isNoIncompleteNoticeOpen, editingDeadline, editingTask, selectingDateForDeadline, selectingDateForTask, dateSelectionMode]);

  useEffect(() => () => {
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
  }, []);

  const closeTaskEditor = () => {
    setEditingTask(null);
    setIsCreatingTask(false);
    setIsTimePickerOpen(false);
  };

  const saveQuickAdd = async (categoryId: string | null, closeAfterSave = false) => {
    if (!quickAddTitle.trim()) {
      if (closeAfterSave) setQuickAddCategoryId(null);
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await db.tasks.add({
      ...createBlankTask(dateStr),
      title: quickAddTitle.trim(),
      domain_id: categoryId,
      order: nextOrderFor(tasks, dateStr, categoryId),
    });
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

  const openTimePicker = () => {
    if (!editingTask) return;
    const date = editingTask.scheduled_time ? parseISO(editingTask.scheduled_time) : new Date(`${editingTask.target_date}T09:00:00`);
    const parts = timePartsFromDate(date);
    setTimeMeridiem(parts.meridiem);
    setTimeHour(parts.hour);
    setTimeMinute(parts.minute);
    setIsTimePickerOpen(true);
  };

  const saveDeadline = async () => {
    if (!deadlineTitle.trim()) return;
    const now = new Date().toISOString();
    await db.deadlines.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      title: deadlineTitle.trim(),
      memo: deadlineMemo.trim(),
      due_date: deadlineDueDate,
      reminder_days: deadlineReminderDays,
    });
    setDeadlineTitle('');
    setDeadlineMemo('');
    setDeadlineReminderDays(null);
    setIsDeadlineModalOpen(false);
  };

  const saveEditingTask = async () => {
    if (!editingTask?.title.trim()) return;
    const now = new Date().toISOString();
    if (isCreatingTask) {
      await db.tasks.add({
        ...editingTask,
        title: editingTask.title.trim(),
        memo: editingTask.memo.trim(),
        order: nextOrderFor(tasks, editingTask.target_date, editingTask.domain_id),
        created_at: now,
        updated_at: now,
        version: 1,
      });
      closeTaskEditor();
      return;
    }
    const { id, ...changes } = editingTask;
    await db.tasks.update(id, {
      ...changes,
      title: editingTask.title.trim(),
      memo: editingTask.memo.trim(),
      updated_at: now,
      version: editingTask.version + 1,
    });
    setEditingTask(null);
  };

  const handleCellClick = async (day: Date) => {
    const destinationDate = format(day, 'yyyy-MM-dd');
    if (isSelectingDeadlineDate) {
      setDeadlineDueDate(destinationDate);
      setIsSelectingDeadlineDate(false);
      setIsDeadlineModalOpen(true);
    } else if (selectingDateForDeadline) {
      const deadline = await db.deadlines.get(selectingDateForDeadline);
      if (deadline && deadline.deleted_at === null) {
        const updatedDeadline = { ...deadline, due_date: destinationDate, updated_at: new Date().toISOString(), version: deadline.version + 1 };
        await db.deadlines.put(updatedDeadline);
        setEditingDeadline(updatedDeadline);
      }
      setSelectingDateForDeadline(null);
    } else if (dateSelectionMode === 'MOVE_INCOMPLETE') {
      await moveIncompleteTasksToDate(selectedDateString, destinationDate);
      setDateSelectionMode(null);
    } else if (dateSelectionMode === 'COPY_ALL') {
      await copyAllTasksToDate(selectedDateString, destinationDate);
      setDateSelectionMode(null);
    } else if (selectingDateForTask) {
      if (isCreatingTask && editingTask && editingTask.id === selectingDateForTask) {
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

  return (
    <div className="min-h-screen flex justify-center p-6 gap-10 bg-bgPrimary pl-24">
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
        onToggleQuickCreate={() => setIsQuickCreateMenuOpen(open => !open)}
        onCreateTask={() => {
          setIsCreatingTask(true);
          setEditingTask(createBlankTask(format(selectedDate, 'yyyy-MM-dd')));
          setIsQuickCreateMenuOpen(false);
        }}
        onCreateDeadline={() => {
          setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd'));
          setIsDeadlineModalOpen(true);
          setIsQuickCreateMenuOpen(false);
        }}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
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
        onToggleDailyMenu={() => setIsDailyMenuOpen(open => !open)}
        onMoveIncompleteTomorrow={() => {
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else void moveIncompleteTasksToDate(selectedDateString, format(addDays(selectedDate, 1), 'yyyy-MM-dd'));
          setIsDailyMenuOpen(false);
        }}
        onMoveIncompletePickDate={() => {
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else setDateSelectionMode('MOVE_INCOMPLETE');
          setIsDailyMenuOpen(false);
        }}
        onDeleteIncomplete={() => {
          if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true);
          else setConfirmDailyAction('DELETE_INCOMPLETE');
          setIsDailyMenuOpen(false);
        }}
        onCopyAll={() => { setDateSelectionMode('COPY_ALL'); setIsDailyMenuOpen(false); }}
        onDeleteAll={() => { setConfirmDailyAction('DELETE_ALL'); setIsDailyMenuOpen(false); }}
        onOpenDeadline={setEditingDeadline}
      >
        {viewMode === 'DAILY' ? (
          <DailyPanel
            selectedDate={selectedDate}
            categories={categories}
            tasks={tasks}
            quickAddCategoryId={quickAddCategoryId}
            quickAddTitle={quickAddTitle}
            draggedTaskId={draggedTaskId}
            justDroppedTaskId={justDroppedTaskId}
            onDragStart={setDraggedTaskId}
            onDragEnd={(result) => { void handleTaskDragEnd(result); }}
            onQuickAddCategory={(categoryKey) => { setQuickAddCategoryId(categoryKey); setQuickAddTitle(''); }}
            onQuickAddTitleChange={setQuickAddTitle}
            onQuickAddSubmit={(categoryId) => { void saveQuickAdd(categoryId); }}
            onQuickAddBlur={(categoryId) => { void saveQuickAdd(categoryId, true); }}
            onOpenTask={(task) => { setIsCreatingTask(false); setEditingTask(task); }}
            onViewImage={setViewingImage}
          />
        ) : weeklyGoalWeekStart ? (
          <WeeklyPanel
            weekStart={weeklyGoalWeekStart}
            goals={goals}
            editingGoalId={editingGoalId}
            editingGoalTitle={editingGoalTitle}
            onEditingGoalIdChange={setEditingGoalId}
            onEditingGoalTitleChange={setEditingGoalTitle}
          />
        ) : null}
      </PlannerPanel>

      {isDeadlineModalOpen && (
        <DeadlineCreateModal
          title={deadlineTitle}
          memo={deadlineMemo}
          dueDate={deadlineDueDate}
          reminderDays={deadlineReminderDays}
          onTitleChange={setDeadlineTitle}
          onMemoChange={setDeadlineMemo}
          onReminderChange={setDeadlineReminderDays}
          onPickDate={() => { setIsDeadlineModalOpen(false); setIsSelectingDeadlineDate(true); }}
          onClose={() => setIsDeadlineModalOpen(false)}
          onSave={() => { void saveDeadline(); }}
        />
      )}

      {editingDeadline && (
        <DeadlineEditModal
          deadline={editingDeadline}
          onChange={setEditingDeadline}
          onPickDate={() => { setSelectingDateForDeadline(editingDeadline.id); setEditingDeadline(null); }}
          onClose={() => setEditingDeadline(null)}
        />
      )}

      {editingTask && !selectingDateForTask && (
        <TaskEditModal
          task={editingTask}
          isCreating={isCreatingTask}
          categories={categories}
          onChange={setEditingTask}
          onClose={closeTaskEditor}
          onPickDate={() => {
            setIsTimePickerOpen(false);
            setSelectingDateForTask(editingTask.id);
            if (!isCreatingTask) setEditingTask(null);
          }}
          onOpenTimePicker={openTimePicker}
          onDelete={async () => {
            const now = new Date().toISOString();
            await db.tasks.update(editingTask.id, { deleted_at: now, updated_at: now, version: editingTask.version + 1 });
            setEditingTask(null);
          }}
          onSave={() => { void saveEditingTask(); }}
        />
      )}

      {isTimePickerOpen && editingTask && !selectingDateForTask && (
        <TimePickerModal
          meridiem={timeMeridiem}
          hour={timeHour}
          minute={timeMinute}
          onMeridiemChange={setTimeMeridiem}
          onHourChange={setTimeHour}
          onMinuteChange={setTimeMinute}
          onClear={() => { setEditingTask({ ...editingTask, scheduled_time: null }); setIsTimePickerOpen(false); }}
          onConfirm={() => {
            setEditingTask({ ...editingTask, scheduled_time: isoFromTimeParts(editingTask.target_date, timeMeridiem, timeHour, timeMinute) });
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
        <CategoryModal categories={categories} onClose={() => setIsCategoryModalOpen(false)} />
      )}
    </div>
  );
}

export default App;
