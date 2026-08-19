import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameMonth, isSameDay, addDays, isToday, parseISO, differenceInCalendarDays
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, AlertCircle, Settings, Target, X, Trash2, Calendar as CalendarIcon, GripVertical, Image as ImageIcon, Upload, Pencil, Check, Repeat2, MoreHorizontal, Copy, ArrowRight, CalendarDays, CircleX, ListTodo } from 'lucide-react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Deadline, type Task } from './lib/db';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { emojiCategories, flagNameByEmoji } from './lib/emojis';
import { deadlineOnDate, formatScheduledTime, isoFromTimeParts, timePartsFromDate, type Meridiem } from './lib/datetime';
import { EmojiIcon } from './components/EmojiIcon';
import { TaskRow } from './components/TaskRow';
import { TimePickerModal } from './components/TimePickerModal';
import { ConfirmDailyDeleteDialog, ImageViewer, NoIncompleteNoticeDialog } from './components/DailyDialogs';

// Typography principle: small text is readable at normal weight. Reserve bold for page titles and primary actions only.
// 빠른 만들기·일별 메뉴는 바깥을 눌러도 닫히지 않게 둔다. 달력 클릭과 메뉴 조작이 겹치지 않게 하려는 의도다.
function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [weeklyGoalWeekStart, setWeeklyGoalWeekStart] = useState<Date | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState('');

  // Modals state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('📁');
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'new' | 'edit'>('new');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [flagTooltip, setFlagTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📁');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<(typeof emojiCategories)[number]['id']>(emojiCategories[0].id);
  const [isQuickCreateMenuOpen, setIsQuickCreateMenuOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isSelectingDeadlineDate, setIsSelectingDeadlineDate] = useState(false);
  const [selectingDateForDeadline, setSelectingDateForDeadline] = useState<string | null>(null);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineMemo, setDeadlineMemo] = useState('');
  const [deadlineDueDate, setDeadlineDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deadlineReminderDays, setDeadlineReminderDays] = useState<number | null>(null);
  
  // Quick Add State
  const [quickAddCategoryId, setQuickAddCategoryId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Move Task to Date State
  const [selectingDateForTask, setSelectingDateForTask] = useState<string | null>(null);
  const [dateSelectionMode, setDateSelectionMode] = useState<'MOVE_INCOMPLETE' | 'COPY_ALL' | null>(null);
  const [isDailyMenuOpen, setIsDailyMenuOpen] = useState(false);
  const [confirmDailyAction, setConfirmDailyAction] = useState<'DELETE_INCOMPLETE' | 'DELETE_ALL' | null>(null);
  const [isNoIncompleteNoticeOpen, setIsNoIncompleteNoticeOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [timeMeridiem, setTimeMeridiem] = useState<Meridiem>('AM');
  const [timeHour, setTimeHour] = useState(9);
  const [timeMinute, setTimeMinute] = useState(0);

  // Full Screen Image Viewer
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [justDroppedTaskId, setJustDroppedTaskId] = useState<string | null>(null);
  const dropFeedbackTimer = useRef<number | null>(null);
  const optimisticClearTimer = useRef<number | null>(null);
  const hasRepairedOrphanedTasks = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingImage) setViewingImage(null);
        else if (showEmojiPicker) setShowEmojiPicker(false);
        else if (isQuickCreateMenuOpen) setIsQuickCreateMenuOpen(false);
        else if (isDeadlineModalOpen) setIsDeadlineModalOpen(false);
        else if (isSelectingDeadlineDate) { setIsSelectingDeadlineDate(false); setIsDeadlineModalOpen(true); }
        else if (isDailyMenuOpen) setIsDailyMenuOpen(false);
        else if (isTimePickerOpen) setIsTimePickerOpen(false);
        else if (confirmDailyAction) setConfirmDailyAction(null);
        else if (isNoIncompleteNoticeOpen) setIsNoIncompleteNoticeOpen(false);
        else if (isCategoryModalOpen && editingCategoryId) setEditingCategoryId(null);
        else if (isCategoryModalOpen) setIsCategoryModalOpen(false);
        else if (editingDeadline) setEditingDeadline(null);
        else if (selectingDateForDeadline) setSelectingDateForDeadline(null);
        else if (selectingDateForTask) setSelectingDateForTask(null);
        else if (editingTask) { setEditingTask(null); setIsCreatingTask(false); setIsTimePickerOpen(false); }
        else if (dateSelectionMode) setDateSelectionMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingImage, showEmojiPicker, isQuickCreateMenuOpen, isDeadlineModalOpen, isSelectingDeadlineDate, isDailyMenuOpen, isTimePickerOpen, confirmDailyAction, isNoIncompleteNoticeOpen, isCategoryModalOpen, editingCategoryId, editingDeadline, editingTask, selectingDateForDeadline, selectingDateForTask, dateSelectionMode]);

  useEffect(() => () => {
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
  }, []);

  // We sort tasks by order ascending in memory to handle legacy tasks without order
  const persistedTasks = useLiveQuery(async () => {
    const list = await db.tasks.toArray();
    return list
      .filter(t => t.deleted_at === null)
      .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));
  }) || [];
  const tasks = optimisticTasks ?? persistedTasks;
  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateLabel = format(selectedDate, 'yyyy-MM-dd EEEE', { locale: ko });
  const selectedDateIncompleteCount = tasks.filter(task => task.target_date === selectedDateString && !task.is_completed).length;

  const calendarActiveTaskCountByDate = useLiveQuery(async () => {
    const countByDate: Record<string, number> = {};
    const [storedTasks, storedCategories] = await Promise.all([db.tasks.toArray(), db.domains.toArray()]);
    const visibleDomainIds = new Set(storedCategories.filter(category => category.deleted_at === null).map(category => category.id));
    for (const task of storedTasks) {
      const isVisible = task.domain_id === null || visibleDomainIds.has(task.domain_id);
      if (task.deleted_at === null && !task.is_completed && isVisible) {
        countByDate[task.target_date] = (countByDate[task.target_date] ?? 0) + 1;
      }
    }
    return countByDate;
  }, []) ?? {};
  
  const categoryQuery = useLiveQuery(() => db.domains.filter(d => d.deleted_at === null).sortBy('order'));
  const categories = categoryQuery ?? [];
  const goals = useLiveQuery(() => db.goals.filter(g => g.deleted_at === null).toArray()) || [];
  const deadlines = useLiveQuery(() => db.deadlines.filter(deadline => deadline.deleted_at === null).toArray()) || [];
  const selectedEmojiSet = useMemo(() => emojiCategories.find(category => category.id === selectedEmojiCategory) ?? emojiCategories[0], [selectedEmojiCategory]);
  const deadlineNotices = useMemo(() =>
    deadlines
      .map(deadline => ({ deadline, remainingDays: differenceInCalendarDays(parseISO(deadline.due_date), selectedDate) }))
      .filter(({ deadline, remainingDays }) => deadline.reminder_days !== null && remainingDays >= 0 && remainingDays <= deadline.reminder_days)
      .sort((a, b) => a.remainingDays - b.remainingDays),
    [deadlines, selectedDate]
  );

  useEffect(() => {
    if (categoryQuery === undefined || hasRepairedOrphanedTasks.current) return;
    hasRepairedOrphanedTasks.current = true;
    void db.transaction('rw', db.tasks, async () => {
      const activeDomainIds = new Set(categoryQuery.map(category => category.id));
      const orphanedTasks = (await db.tasks.toArray()).filter(task =>
        task.deleted_at === null && task.domain_id !== null && !activeDomainIds.has(task.domain_id)
      );
      if (orphanedTasks.length === 0) return;

      const now = new Date().toISOString();
      await db.tasks.bulkPut(orphanedTasks.map(task => ({
        ...task,
        domain_id: null,
        updated_at: now,
        version: task.version + 1,
      })));
    });
  }, [categoryQuery]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setViewMode('DAILY');
  };

  const moveIncompleteTasksToDate = async (destinationDate: string) => {
    const sourceDate = format(selectedDate, 'yyyy-MM-dd');
    if (sourceDate === destinationDate) return;
    await db.transaction('rw', db.tasks, async () => {
      const [sourceTasks, destinationTasks] = await Promise.all([
        db.tasks.where('target_date').equals(sourceDate).toArray(),
        db.tasks.where('target_date').equals(destinationDate).toArray(),
      ]);
      const movingTasks = sourceTasks.filter(task => task.deleted_at === null && !task.is_completed);
      if (movingTasks.length === 0) return;
      const now = new Date().toISOString();
      const nextOrderByDomain = new Map<string | null, number>();
      for (const task of destinationTasks.filter(task => task.deleted_at === null)) {
        nextOrderByDomain.set(task.domain_id, Math.max(nextOrderByDomain.get(task.domain_id) ?? -1, task.order));
      }
      const moved = movingTasks.map(task => {
        const order = (nextOrderByDomain.get(task.domain_id) ?? -1) + 1;
        nextOrderByDomain.set(task.domain_id, order);
        return { ...task, target_date: destinationDate, deadline: deadlineOnDate(task.deadline, destinationDate), scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate), order, updated_at: now, version: task.version + 1 };
      });
      const remaining = sourceTasks.filter(task => task.deleted_at === null && task.is_completed);
      const normalizedRemaining = remaining
        .sort((a, b) => a.domain_id === b.domain_id ? a.order - b.order : String(a.domain_id).localeCompare(String(b.domain_id)))
        .map((task, index, all) => {
          const order = all.slice(0, index).filter(previous => previous.domain_id === task.domain_id).length;
          return task.order === order ? task : { ...task, order, updated_at: now, version: task.version + 1 };
        });
      await db.tasks.bulkPut([...moved, ...normalizedRemaining]);
    });
  };

  const copyAllTasksToDate = async (destinationDate: string) => {
    const sourceDate = format(selectedDate, 'yyyy-MM-dd');
    if (sourceDate === destinationDate) return;
    await db.transaction('rw', db.tasks, async () => {
      const [sourceTasks, destinationTasks] = await Promise.all([
        db.tasks.where('target_date').equals(sourceDate).toArray(),
        db.tasks.where('target_date').equals(destinationDate).toArray(),
      ]);
      const now = new Date().toISOString();
      const nextOrderByDomain = new Map<string | null, number>();
      for (const task of destinationTasks.filter(task => task.deleted_at === null)) {
        nextOrderByDomain.set(task.domain_id, Math.max(nextOrderByDomain.get(task.domain_id) ?? -1, task.order));
      }
      const copies = sourceTasks.filter(task => task.deleted_at === null).map(task => {
        const order = (nextOrderByDomain.get(task.domain_id) ?? -1) + 1;
        nextOrderByDomain.set(task.domain_id, order);
        return {
          ...task,
          id: crypto.randomUUID(),
          version: 1,
          created_at: now,
          updated_at: now,
          target_date: destinationDate,
          deadline: deadlineOnDate(task.deadline, destinationDate),
          scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate),
          is_completed: false,
          order,
        };
      });
      if (copies.length > 0) await db.tasks.bulkPut(copies);
    });
  };

  const deleteDayTasks = async (incompleteOnly: boolean) => {
    const sourceDate = format(selectedDate, 'yyyy-MM-dd');
    const dayTasks = await db.tasks.where('target_date').equals(sourceDate).toArray();
    const now = new Date().toISOString();
    const targets = dayTasks.filter(task => task.deleted_at === null && (!incompleteOnly || !task.is_completed));
    if (targets.length > 0) await db.tasks.bulkPut(targets.map(task => ({ ...task, deleted_at: now, updated_at: now, version: task.version + 1 })));
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
      await moveIncompleteTasksToDate(destinationDate);
      setDateSelectionMode(null);
    } else if (dateSelectionMode === 'COPY_ALL') {
      await copyAllTasksToDate(destinationDate);
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
        await db.transaction('rw', db.tasks, async () => {
          const task = await db.tasks.get(selectingDateForTask);
          if (!task || task.deleted_at !== null || task.target_date === destinationDate) return;

          const [sourceTasks, destinationTasks] = await Promise.all([
            db.tasks.where('target_date').equals(task.target_date).toArray(),
            db.tasks.where('target_date').equals(destinationDate).toArray(),
          ]);
          const remainingSourceTasks = sourceTasks
            .filter(candidate => candidate.deleted_at === null && candidate.domain_id === task.domain_id && candidate.id !== task.id)
            .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));
          const destinationOrder = destinationTasks.filter(candidate =>
            candidate.deleted_at === null && candidate.domain_id === task.domain_id
          ).length;
          const now = new Date().toISOString();

          await db.tasks.bulkPut([
            ...remainingSourceTasks.map((candidate, order) => ({
              ...candidate,
              order,
              updated_at: candidate.order === order ? candidate.updated_at : now,
              version: candidate.order === order ? candidate.version : candidate.version + 1,
            })),
            {
              ...task,
              target_date: destinationDate,
              deadline: deadlineOnDate(task.deadline, destinationDate),
              scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate),
              order: destinationOrder,
              updated_at: now,
              version: task.version + 1,
            },
          ]);
        });
        setSelectingDateForTask(null);
      }
    }
    setSelectedDate(day);
    setViewMode('DAILY');
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-6 pl-4 relative">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold">{format(currentDate, 'yyyy. MM')}</h1>
        <button onClick={goToToday} className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 shadow-sm transition-colors">
          오늘
        </button>
      </div>
      
      {(selectingDateForTask || selectingDateForDeadline || dateSelectionMode || isSelectingDeadlineDate) && (
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold shadow-2xl flex items-center gap-4 z-50 transition-transform">
          <span>{(isSelectingDeadlineDate || selectingDateForDeadline) ? '데드라인 날짜를 달력에서 선택하세요' : dateSelectionMode === 'COPY_ALL' ? '복사할 날짜를 달력에서 선택하세요' : '이동할 날짜를 달력에서 선택하세요'}</span>
          <button onClick={() => { setSelectingDateForTask(null); setSelectingDateForDeadline(null); setDateSelectionMode(null); if (isSelectingDeadlineDate) { setIsSelectingDeadlineDate(false); setIsDeadlineModalOpen(true); } }} className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 text-sm transition-colors">취소</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 바깥 클릭으로 닫히지 않음. 메뉴를 연 채 달력을 보는 흐름을 유지하기 위한 의도. */}
        <div className="relative">
          <button
            onClick={() => setIsQuickCreateMenuOpen(open => !open)}
            aria-label="빠른 만들기 메뉴"
            aria-expanded={isQuickCreateMenuOpen}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            title="빠른 만들기"
          >
            <Plus size={24} />
          </button>
          <div className={clsx(
            "absolute top-12 right-0 w-48 overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl origin-top-right transition-all duration-200 z-40",
            isQuickCreateMenuOpen ? "scale-100 opacity-100 translate-y-0" : "pointer-events-none scale-95 opacity-0 -translate-y-1"
          )}>
            <button onClick={() => {
              const now = new Date().toISOString();
              setIsCreatingTask(true);
              setEditingTask({
                id: crypto.randomUUID(),
                version: 1,
                created_at: now,
                updated_at: now,
                deleted_at: null,
                title: '',
                memo: '',
                target_date: format(selectedDate, 'yyyy-MM-dd'),
                deadline: null,
                scheduled_time: null,
                domain_id: null,
                goal_id: null,
                is_important: false,
                is_completed: false,
                order: 0,
                image_data: null,
              });
              setIsQuickCreateMenuOpen(false);
            }} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <ListTodo size={16} /> 할 일 만들기
            </button>
            <button onClick={() => { setDeadlineDueDate(format(selectedDate, 'yyyy-MM-dd')); setIsDeadlineModalOpen(true); setIsQuickCreateMenuOpen(false); }} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
              <AlertCircle size={16} /> 데드라인 만들기
            </button>
            <button disabled className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-400 cursor-not-allowed">
              <Repeat2 size={16} /> 루틴 만들기
            </button>
          </div>
        </div>
        <button onClick={() => setIsCategoryModalOpen(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600" title="카테고리 관리">
          <Settings size={22} />
        </button>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );

  const renderDays = () => {
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    return (
      <div className="grid grid-cols-7 bg-white rounded-t-3xl pt-2 pb-2 border-b border-gray-100">
        {days.map((day, i) => (
          <div key={day} className={clsx(
            "text-center text-sm font-medium py-2",
            i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-gray-500"
          )}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      const weekStart = day;
      const isLastRow = addDays(weekStart, 7) > endDate;

      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dateStr = format(day, 'yyyy-MM-dd');
        
        const activeTaskCount = calendarActiveTaskCountByDate[dateStr] ?? 0;
        const dayDeadlines = deadlines.filter(deadline => deadline.due_date === dateStr);
        const hasDeadline = dayDeadlines.length > 0;
        
        const isWeekend = i === 5 || i === 6;

        days.push(
          <div
            key={day.toString()}
            onClick={() => handleCellClick(cloneDay)}
            className={clsx(
              "min-h-[110px] p-2 border-gray-100 transition-all cursor-pointer relative group",
              (selectingDateForTask || selectingDateForDeadline || dateSelectionMode || isSelectingDeadlineDate) ? "hover:bg-primary/20" : "hover:brightness-95",
              isWeekend && !(selectingDateForTask || selectingDateForDeadline || dateSelectionMode || isSelectingDeadlineDate) ? (i === 6 ? "bg-red-50/30" : "bg-blue-50/30") : "bg-white",
              !isSameMonth(day, monthStart) ? "opacity-40" : "",
              isSameDay(day, selectedDate) && !(selectingDateForTask || selectingDateForDeadline || dateSelectionMode || isSelectingDeadlineDate) && viewMode === 'DAILY' ? "ring-2 ring-primary ring-inset z-10" : "",
              hasDeadline ? "shadow-[inset_-5px_0_12px_-7px_rgba(239,68,68,0.95)]" : "",
              !isLastRow ? "border-b" : "",
              i !== 6 ? "border-r" : "",
              isLastRow && i === 0 ? "rounded-bl-3xl" : "",
              isLastRow && i === 6 ? "rounded-br-3xl" : ""
            )}
          >
            <div className="flex justify-between items-start">
              <span className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-full text-base font-semibold",
                isToday(day) ? "bg-primary text-textPrimary" : 
                i === 5 ? "text-blue-500" : 
                i === 6 ? "text-red-500" : ""
              )}>
                {format(day, 'd')}
              </span>
              {hasDeadline && <AlertCircle size={18} strokeWidth={2.5} className="text-red-500 drop-shadow-sm" aria-label={`${dayDeadlines.length}개의 데드라인`} />}
            </div>

            <div className="mt-2 flex flex-col items-center gap-1">
              {activeTaskCount > 0 && (
                <div className="min-w-7 px-2 py-1 rounded-full text-sm font-bold w-max bg-gray-100 text-gray-700 text-center">
                  {activeTaskCount}
                </div>
              )}
            </div>
          </div>
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
        <div className="relative grid grid-cols-7" key={cloneWeekStart.toString()}>
          {/* Weekly Goal Floating Button - OUTSIDE the hidden overflow */}
          <div 
            className={clsx(
              "absolute -left-16 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border shadow-sm flex items-center justify-center cursor-pointer transition-all z-10",
              isSelectedWeek ? "bg-primary border-primary text-textPrimary scale-110" : "bg-white border-gray-200 text-gray-400 hover:text-primary hover:bg-gray-50 hover:scale-110"
            )}
            onClick={() => {
              setWeeklyGoalWeekStart(cloneWeekStart);
              setViewMode('WEEKLY');
            }}
            title="주간 목표"
          >
            <Target size={18} />
            {weeklyGoalCount > 0 && (
              <span className="absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border border-white bg-gray-100 text-[10px] font-medium text-gray-600">
                {weeklyGoalCount}
              </span>
            )}
          </div>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="bg-white rounded-b-3xl">{rows}</div>;
  };

  const saveQuickAdd = async (categoryId: string | null, closeAfterSave = false) => {
    if (!quickAddTitle.trim()) {
      if (closeAfterSave) setQuickAddCategoryId(null);
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const categoryTasks = tasks.filter(t => t.target_date === dateStr && t.domain_id === categoryId);
    const nextOrder = categoryTasks.reduce((maximum, task) => Math.max(maximum, task.order), -1) + 1;

    await db.tasks.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      title: quickAddTitle.trim(),
      memo: '',
      target_date: dateStr,
      deadline: null,
      scheduled_time: null,
      domain_id: categoryId,
      goal_id: null,
      is_important: false,
      is_completed: false,
      order: nextOrder
    });
    
    setQuickAddTitle('');
    if (closeAfterSave) setQuickAddCategoryId(null);
  };

  const handleQuickAdd = async (e: React.FormEvent<HTMLFormElement>, categoryId: string | null) => {
    e.preventDefault();
    await saveQuickAdd(categoryId);
  };

  const showDropFeedback = (taskId: string) => {
    setJustDroppedTaskId(taskId);
    if (dropFeedbackTimer.current !== null) window.clearTimeout(dropFeedbackTimer.current);
    dropFeedbackTimer.current = window.setTimeout(() => setJustDroppedTaskId(null), 420);
  };

  const handleTaskDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    setDraggedTaskId(null);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const sourceDomainId = source.droppableId === 'unassigned' ? null : source.droppableId;
    const destDomainId = destination.droppableId === 'unassigned' ? null : destination.droppableId;

    const applyReorder = (currentTasks: Task[]) => {
      const sourceTasks = currentTasks.filter(task => task.target_date === dateStr && task.domain_id === sourceDomainId);
      const destinationTasks = source.droppableId === destination.droppableId
        ? sourceTasks
        : currentTasks.filter(task => task.target_date === dateStr && task.domain_id === destDomainId);
      const sourceIndex = sourceTasks.findIndex(task => task.id === draggableId);
      if (sourceIndex === -1) return null;

      const [taskToMove] = sourceTasks.splice(sourceIndex, 1);
      const destinationIndex = Math.min(destination.index, destinationTasks.length);
      if (source.droppableId === destination.droppableId) {
        sourceTasks.splice(destinationIndex, 0, taskToMove);
      } else {
        destinationTasks.splice(destinationIndex, 0, { ...taskToMove, domain_id: destDomainId });
      }

      const replacements = new Map<string, Task>();
      const orderTasks = (group: Task[]) => group.forEach((task, index) => {
        replacements.set(task.id, { ...task, order: index });
      });
      orderTasks(sourceTasks);
      if (source.droppableId !== destination.droppableId) orderTasks(destinationTasks);

      return currentTasks.map(task => replacements.get(task.id) ?? task);
    };

    const optimisticResult = applyReorder(tasks);
    if (!optimisticResult) return;
    setOptimisticTasks(optimisticResult);
    showDropFeedback(draggableId);

    try {
      await db.transaction('rw', db.tasks, async () => {
        const storedTasks = (await db.tasks.where('target_date').equals(dateStr).toArray())
          .filter(task => task.deleted_at === null);
        const reorderedTasks = applyReorder(storedTasks);
        if (!reorderedTasks) return;

        const now = new Date().toISOString();
        await db.tasks.bulkPut(reorderedTasks.map(task => {
          const previous = storedTasks.find(storedTask => storedTask.id === task.id)!;
          const changed = previous.order !== task.order || previous.domain_id !== task.domain_id;
          return changed
            ? { ...task, updated_at: now, version: previous.version + 1 }
            : task;
        }));
      });
      if (optimisticClearTimer.current !== null) window.clearTimeout(optimisticClearTimer.current);
      optimisticClearTimer.current = window.setTimeout(() => setOptimisticTasks(null), 100);
    } catch {
      setOptimisticTasks(null);
    }
  };

  const handleCategoryDragEnd = async (result: DropResult) => {
    const { destination, source } = result;
    if (!destination || destination.index === source.index) return;
    
    const items = Array.from(categories);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    const updates = items.map((cat, index) => ({
      ...cat,
      order: index,
      updated_at: new Date().toISOString(),
      version: cat.version + 1
    }));
    await db.domains.bulkPut(updates);
  };

  const handleCategoryDelete = async (categoryId: string) => {
    await db.transaction('rw', db.tasks, db.domains, async () => {
      const now = new Date().toISOString();
      const categoryTasks = await db.tasks.where('domain_id').equals(categoryId).toArray();
      if (categoryTasks.length > 0) {
        await db.tasks.bulkPut(categoryTasks.map(task => ({
          ...task,
          domain_id: null,
          updated_at: now,
          version: task.version + 1
        })));
      }
      const category = await db.domains.get(categoryId);
      if (category) await db.domains.put({ ...category, deleted_at: now, updated_at: now, version: category.version + 1 });
    });
  };

  const handleImageUpload = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const image_data = ev.target?.result;
      if (typeof image_data !== 'string') return;
      setEditingTask(current => current ? { ...current, image_data } : current);
    };
    reader.readAsDataURL(file);
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

  const applySelectedTime = () => {
    if (!editingTask) return;
    setEditingTask({ ...editingTask, scheduled_time: isoFromTimeParts(editingTask.target_date, timeMeridiem, timeHour, timeMinute) });
    setIsTimePickerOpen(false);
  };

  const renderDailyPanel = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayTasks = tasks.filter((t: Task) => t.target_date === dateStr);
    
    const renderCategorySection = (categoryId: string | null, name: string, icon: string) => {
      const categoryTasks = dayTasks.filter(t => t.domain_id === categoryId);
      const activeCategoryTasksCount = categoryTasks.filter(t => !t.is_completed).length;
      const isAdding = quickAddCategoryId === (categoryId || 'unassigned');

      return (
        <Droppable droppableId={categoryId || 'unassigned'} key={categoryId || 'unassigned'}>
          {(provided, snapshot) => (
            <div 
              className={clsx(
                "p-2 rounded-2xl transition-[background-color,box-shadow,margin] duration-200 ease-out",
                categoryTasks.length === 0 && !isAdding ? "mb-1" : "space-y-2 mb-5",
                snapshot.isDraggingOver ? "bg-primary/10 ring-1 ring-primary/40 shadow-inner" : ""
              )}
            >
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
                    <span className="text-sm inline-flex items-center"><EmojiIcon emoji={icon} /></span>
                    <span className="text-sm font-medium text-gray-600">{name}</span>
                  </div>
                  {activeCategoryTasksCount > 0 && (
                    <span className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-gray-100 text-[11px] font-medium text-gray-500 border border-gray-200">
                      {activeCategoryTasksCount}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setQuickAddCategoryId(categoryId || 'unassigned');
                    setQuickAddTitle('');
                  }}
                  aria-label={`${name}에 할 일 추가`}
                  title={`${name}에 할 일 추가`}
                  className="p-1.5 bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2 pl-1 min-h-[10px]"
              >
                {categoryTasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <TaskRow
                        task={task}
                        provided={provided}
                        snapshot={snapshot}
                        isDropped={justDroppedTaskId === task.id}
                        isGrabbing={draggedTaskId === task.id}
                        onToggleComplete={() => {
                          void db.tasks.update(task.id, { is_completed: !task.is_completed, updated_at: new Date().toISOString(), version: task.version + 1 });
                        }}
                        onOpen={() => { setIsCreatingTask(false); setEditingTask(task); }}
                        onViewImage={(src) => setViewingImage(src)}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {isAdding && (
                  <form onSubmit={(e) => handleQuickAdd(e, categoryId)} className="flex items-center gap-3 px-3 py-1">
                    <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-200 bg-white" />
                    <input 
                      autoFocus
                      type="text" 
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      placeholder="할 일 입력..." 
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget as Node | null;
                        if (nextTarget && event.currentTarget.form?.contains(nextTarget)) return;
                        void saveQuickAdd(categoryId, true);
                      }}
                      className="w-full bg-transparent border-b border-primary/50 py-1 outline-none font-sans text-base focus:border-primary transition-colors"
                    />
                    <button
                      type="submit"
                      aria-label={`${name} 할 일 저장`}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-primary/20 hover:text-gray-700 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                )}
                
                {!isAdding && categoryTasks.length === 0 && !snapshot.isDraggingOver && (
                  <div className="pl-9 py-0.5 text-sm text-gray-300 font-sans">할 일이 없습니다</div>
                )}
              </div>
            </div>
          )}
        </Droppable>
      );
    };

    return (
      <div className="pr-1">
        <DragDropContext onDragStart={(start) => setDraggedTaskId(start.draggableId)} onDragEnd={handleTaskDragEnd}>
          {categories.map(c => renderCategorySection(c.id, c.name, c.icon))}
          {renderCategorySection(null, '미분류', '📥')}
        </DragDropContext>
      </div>
    );
  };

  const renderWeeklyPanel = () => {
    if (!weeklyGoalWeekStart) return null;
    const weekGoals = goals.filter(g => g.time_frame === 'WEEK' && g.start_date === format(weeklyGoalWeekStart, 'yyyy-MM-dd'));
    const completedGoalCount = weekGoals.filter(goal => goal.is_completed).length;

    return (
      <div className="pr-1 pb-2 flex flex-col gap-6">
        <form onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(e.currentTarget);
          const title = fd.get('title') as string;
          if(!title.trim()) return;
          await db.goals.add({
            id: crypto.randomUUID(), version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
            domain_id: null, time_frame: 'WEEK', start_date: format(weeklyGoalWeekStart, 'yyyy-MM-dd'), end_date: format(addDays(weeklyGoalWeekStart, 6), 'yyyy-MM-dd'), title: title.trim(), is_completed: false
          });
          form.reset();
        }} className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100">
          <input name="title" type="text" placeholder="새로운 주간 목표 추가..." className="flex-1 bg-transparent px-3 outline-none font-sans text-base font-medium transition-colors" />
          <button type="submit" className="w-10 h-10 flex items-center justify-center bg-primary text-textPrimary rounded-xl font-bold hover:bg-yellow-400 transition-colors shrink-0"><Plus size={20}/></button>
        </form>

        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-bold text-gray-500">이번 주 체크리스트</span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-500">완료 {completedGoalCount}/{weekGoals.length}</span>
        </div>

        <div className="space-y-3">
          {weekGoals.map(g => (
            <div key={g.id} className={clsx("flex items-center gap-3 p-4 rounded-2xl bg-white border shadow-sm group transition-colors", g.is_completed ? "border-gray-100 bg-gray-50" : "border-gray-200")}>
              <button
                onClick={() => db.goals.update(g.id, { is_completed: !g.is_completed, updated_at: new Date().toISOString(), version: g.version + 1 })}
                aria-label={g.is_completed ? `${g.title} 완료 취소` : `${g.title} 완료`}
                className={clsx("w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors", g.is_completed ? "bg-primary border-primary text-gray-700" : "border-gray-300 hover:border-primary")}
              >
                {g.is_completed && <Check size={13} strokeWidth={3} />}
              </button>
              {editingGoalId === g.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!editingGoalTitle.trim()) return;
                    await db.goals.update(g.id, { title: editingGoalTitle.trim(), updated_at: new Date().toISOString(), version: g.version + 1 });
                    setEditingGoalId(null);
                  }}
                >
                  <input autoFocus value={editingGoalTitle} onChange={(e) => setEditingGoalTitle(e.target.value)} className="flex-1 min-w-0 rounded-lg bg-gray-100 px-2 py-1 font-sans text-base font-medium outline-none focus:ring-1 focus:ring-primary" />
                  <button type="submit" className="rounded-lg px-2 py-1 text-xs font-bold text-gray-700 hover:bg-primary/20">저장</button>
                  <button type="button" onClick={() => setEditingGoalId(null)} className="rounded-lg px-2 py-1 text-xs font-bold text-gray-400 hover:bg-gray-100">취소</button>
                </form>
              ) : (
                <span className={clsx("flex-1 min-w-0 font-sans text-lg font-medium", g.is_completed ? "text-gray-400 line-through" : "text-gray-800")}>{g.title}</span>
              )}
              {editingGoalId !== g.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingGoalId(g.id); setEditingGoalTitle(g.title); }} aria-label={`${g.title} 수정`} className="p-2 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil size={16}/></button>
                  <button onClick={() => db.goals.update(g.id, { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: g.version + 1 })} aria-label={`${g.title} 삭제`} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              )}
            </div>
          ))}
          {weekGoals.length === 0 && (
            <div className="text-center text-gray-400 py-12 text-sm font-sans flex flex-col items-center gap-3">
              <Target size={32} className="text-gray-300" />
              이번 주 목표가 없습니다
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPanel = () => {
    return (
      <div className="w-[500px] bg-white p-8 flex flex-col h-[calc(100vh-3rem)] sticky top-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-2xl font-bold">
            {viewMode === 'DAILY' 
              ? format(selectedDate, 'M월 d일 (E)', { locale: ko })
              : `${format(weeklyGoalWeekStart!, 'M월 d일')} 주간 목표`}
          </h2>
          {viewMode === 'DAILY' && (
            <div className="relative">
              {/* 바깥 클릭으로 닫히지 않음. 메뉴를 연 채 날짜를 확인하는 흐름을 유지하기 위한 의도. */}
              <button onClick={() => setIsDailyMenuOpen(open => !open)} aria-label="일별 할 일 메뉴" aria-expanded={isDailyMenuOpen} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <MoreHorizontal size={22}/>
              </button>
              <div className={clsx(
                "absolute right-0 top-11 z-40 w-56 origin-top-right rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl transition-all duration-200",
                isDailyMenuOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
              )}>
                <button onClick={async () => { if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true); else await moveIncompleteTasksToDate(format(addDays(selectedDate, 1), 'yyyy-MM-dd')); setIsDailyMenuOpen(false); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"><ArrowRight size={16} className="text-indigo-400"/>미완료 할 일을 내일 하기</button>
                <button onClick={() => { if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true); else setDateSelectionMode('MOVE_INCOMPLETE'); setIsDailyMenuOpen(false); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"><CalendarDays size={16} className="text-indigo-400"/>미완료 할 일을 다른 날 하기</button>
                <button onClick={() => { if (selectedDateIncompleteCount === 0) setIsNoIncompleteNoticeOpen(true); else setConfirmDailyAction('DELETE_INCOMPLETE'); setIsDailyMenuOpen(false); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"><CircleX size={16}/>미완료 할 일 삭제</button>
                <div className="mx-2 my-1 border-t border-gray-100"/>
                <button onClick={() => { setDateSelectionMode('COPY_ALL'); setIsDailyMenuOpen(false); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"><Copy size={16} className="text-indigo-400"/>모든 할 일 복사</button>
                <button onClick={() => { setConfirmDailyAction('DELETE_ALL'); setIsDailyMenuOpen(false); }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"><Trash2 size={16}/>모든 할 일 삭제</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {viewMode === 'DAILY' ? renderDailyPanel() : renderWeeklyPanel()}
        </div>
        {viewMode === 'DAILY' && deadlineNotices.length > 0 && (
          <section className="shrink-0 mt-4 max-h-[40%] overflow-y-auto border-t border-red-100 pt-4 space-y-2" aria-label="데드라인 알림">
            <p className="px-1 text-xs font-medium text-red-500">데드라인 알림</p>
            {deadlineNotices.map(({ deadline, remainingDays }) => (
              <div key={deadline.id} role="button" tabIndex={0} onClick={() => setEditingDeadline(deadline)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setEditingDeadline(deadline); }} className={clsx("group flex cursor-pointer gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 shadow-sm transition-colors hover:bg-red-50", deadline.memo ? "items-start" : "items-center")}>
                <span className={clsx("shrink-0 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white", deadline.memo ? "mt-0.5" : "")}>D-{remainingDays}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{deadline.title}</p>
                  {deadline.memo && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{deadline.memo}</p>}
                </div>
                <span className={clsx("ml-auto shrink-0 text-xs text-red-500", deadline.memo ? "mt-0.5" : "")}>{format(parseISO(deadline.due_date), 'M/d')}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex justify-center p-6 gap-10 bg-bgPrimary pl-24">
      <div className="w-[800px] shrink-0 relative">
        {renderHeader()}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 relative z-0">
          {renderDays()}
          {renderCells()}
        </div>
      </div>
      {renderPanel()}

      {isDeadlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-2 text-red-500"><AlertCircle size={20} /><h3 className="text-lg font-medium text-gray-800">데드라인 만들기</h3></div>
              <button onClick={() => setIsDeadlineModalOpen(false)} aria-label="데드라인 만들기 닫기" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="space-y-4 overflow-y-auto px-6 pb-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">제목</label>
                <input autoFocus value={deadlineTitle} onChange={(event) => setDeadlineTitle(event.target.value)} placeholder="마감할 일을 적어주세요" className="w-full rounded-xl border border-transparent bg-gray-50 p-3 text-base font-medium outline-none focus:border-red-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">메모</label>
                <textarea value={deadlineMemo} onChange={(event) => setDeadlineMemo(event.target.value)} placeholder="필요한 메모를 적어주세요" className="h-20 w-full resize-none rounded-xl border border-transparent bg-gray-50 p-3 text-sm outline-none focus:border-red-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">데드라인 날짜</label>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                  <span className="text-sm text-gray-700">{format(parseISO(deadlineDueDate), 'yyyy년 MM월 dd일 (E)', { locale: ko })}</span>
                  <button onClick={() => { setIsDeadlineModalOpen(false); setIsSelectingDeadlineDate(true); }} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"><CalendarIcon size={14} /> 날짜 선택</button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-400">알림 시작</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[null, 1, 3, 7, 14, 30].map(days => (
                    <button key={days ?? 'none'} onClick={() => setDeadlineReminderDays(days)} className={clsx("rounded-xl px-1 py-2 text-sm font-medium transition-colors", deadlineReminderDays === days ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                      {days === null ? '없음' : `${days}일 전`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">설정한 기간에만 오른쪽 일정 창에서 디데이를 표시합니다.</p>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-6 pb-6 pt-4">
              <button onClick={() => setIsDeadlineModalOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100">취소</button>
              <button onClick={saveDeadline} disabled={!deadlineTitle.trim()} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-200">데드라인 만들기</button>
            </div>
          </div>
        </div>
      )}

      {editingDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="flex max-h-[90vh] w-[440px] flex-col rounded-3xl bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-2 text-red-500"><AlertCircle size={20} /><h3 className="text-lg font-medium text-gray-800">데드라인 상세</h3></div>
              <button onClick={() => setEditingDeadline(null)} aria-label="데드라인 상세 닫기" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="space-y-4 overflow-y-auto px-6 pb-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">제목</label>
                <input value={editingDeadline.title} onChange={(event) => setEditingDeadline({ ...editingDeadline, title: event.target.value })} className="w-full rounded-xl border border-transparent bg-gray-50 p-3 text-base font-medium outline-none focus:border-red-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">메모</label>
                <textarea value={editingDeadline.memo} onChange={(event) => setEditingDeadline({ ...editingDeadline, memo: event.target.value })} placeholder="필요한 메모를 적어주세요" className="h-20 w-full resize-none rounded-xl border border-transparent bg-gray-50 p-3 text-sm outline-none focus:border-red-200" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">데드라인 날짜</label>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                  <span className="text-sm text-gray-700">{format(parseISO(editingDeadline.due_date), 'yyyy년 MM월 dd일 (E)', { locale: ko })}</span>
                  <button onClick={() => { setSelectingDateForDeadline(editingDeadline.id); setEditingDeadline(null); }} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"><CalendarIcon size={14} /> 날짜 변경</button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-400">알림 시작</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[null, 1, 3, 7, 14, 30].map(days => (
                    <button key={days ?? 'none'} onClick={() => setEditingDeadline({ ...editingDeadline, reminder_days: days })} className={clsx("rounded-xl px-1 py-2 text-sm font-medium transition-colors", editingDeadline.reminder_days === days ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                      {days === null ? '없음' : `${days}일 전`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 justify-between gap-2 border-t border-gray-100 px-6 pb-6 pt-4">
              <button onClick={async () => { const now = new Date().toISOString(); await db.deadlines.update(editingDeadline.id, { deleted_at: now, updated_at: now, version: editingDeadline.version + 1 }); setEditingDeadline(null); }} className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-100">삭제</button>
              <button onClick={async () => { if (!editingDeadline.title.trim()) return; const now = new Date().toISOString(); await db.deadlines.put({ ...editingDeadline, title: editingDeadline.title.trim(), memo: editingDeadline.memo.trim(), updated_at: now, version: editingDeadline.version + 1 }); setEditingDeadline(null); }} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {editingTask && !selectingDateForTask && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-[420px] shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 pb-4 shrink-0">
              <h3 className="text-lg font-bold">{isCreatingTask ? '할 일 만들기' : '할 일 상세'}</h3>
              <button onClick={() => { setEditingTask(null); setIsCreatingTask(false); setIsTimePickerOpen(false); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto px-6 pb-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">제목</label>
                <input 
                  type="text" 
                  autoFocus={isCreatingTask}
                  value={editingTask.title}
                  onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                  placeholder="할 일을 적어주세요"
                  className="w-full bg-gray-50 rounded-xl p-3 outline-none font-sans text-lg font-medium border border-transparent focus:border-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">카테고리</label>
                <select
                  value={editingTask.domain_id ?? ''}
                  onChange={event => setEditingTask({ ...editingTask, domain_id: event.target.value || null })}
                  className="w-full bg-gray-50 rounded-xl p-3 outline-none font-sans text-sm border border-transparent focus:border-gray-200"
                >
                  <option value="">미분류</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">메모</label>
                <textarea 
                  value={editingTask.memo || ''}
                  onChange={e => setEditingTask({...editingTask, memo: e.target.value})}
                  placeholder="추가적인 메모를 적어보세요"
                  className="w-full bg-gray-50 rounded-xl p-3 outline-none h-24 resize-none border border-transparent focus:border-gray-200 text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">이미지 첨부</label>
                {editingTask.image_data ? (
                  <div className="w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <img src={editingTask.image_data} alt="첨부" className="w-full object-contain max-h-[300px] bg-gray-100" />
                    <div className="p-2 flex justify-end gap-2 bg-white border-t border-gray-200">
                         <label className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer transition-colors text-gray-700 flex items-center gap-1.5">
                         <Upload size={14} />
                         변경
                         <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                           if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
                         }} />
                       </label>
                       <button 
                         onClick={() => setEditingTask({...editingTask, image_data: null})}
                         className="px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-500 transition-colors flex items-center gap-1.5"
                       >
                         <Trash2 size={14} />
                         삭제
                       </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="w-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 hover:bg-gray-100 h-24 flex flex-col items-center justify-center relative transition-colors cursor-pointer"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-gray-100'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-gray-100'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-gray-100');
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0]);
                    }}
                  >
                    <ImageIcon size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500 font-sans font-medium">클릭하거나 이미지를 드래그 앤 드롭</span>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
                    }} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">시간</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-transparent">
                  <span className="text-sm font-sans text-gray-600">{formatScheduledTime(editingTask.scheduled_time) ?? '시간 없음'}</span>
                  <button onClick={openTimePicker} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors shadow-sm text-gray-700">
                    <CalendarIcon size={14} /> 시간 설정
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">날짜</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-transparent">
                  <span className="text-sm font-sans font-medium">{format(parseISO(editingTask.target_date), 'yyyy년 MM월 dd일')}</span>
                  <button 
                    onClick={() => {
                      setIsTimePickerOpen(false);
                      setSelectingDateForTask(editingTask.id);
                      if (!isCreatingTask) setEditingTask(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors shadow-sm text-gray-700"
                  >
                    <CalendarIcon size={14} />
                    날짜 변경
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 shrink-0 flex justify-between gap-3 border-t border-gray-100">
              {isCreatingTask ? (
                <button
                  onClick={() => { setEditingTask(null); setIsCreatingTask(false); setIsTimePickerOpen(false); }}
                  className="px-4 py-3 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-bold flex items-center justify-center"
                >
                  취소
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    const now = new Date().toISOString();
                    await db.tasks.update(editingTask.id, {
                      deleted_at: now,
                      updated_at: now,
                      version: editingTask.version + 1,
                    });
                    setEditingTask(null);
                  }}
                  className="px-4 py-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-colors font-bold flex items-center justify-center"
                >
                  삭제
                </button>
              )}
              <button 
                onClick={async () => {
                  if (!editingTask.title.trim()) return;
                  const now = new Date().toISOString();
                  if (isCreatingTask) {
                    const categoryTasks = tasks.filter(task => task.target_date === editingTask.target_date && task.domain_id === editingTask.domain_id);
                    const nextOrder = categoryTasks.reduce((maximum, task) => Math.max(maximum, task.order), -1) + 1;
                    await db.tasks.add({
                      ...editingTask,
                      title: editingTask.title.trim(),
                      memo: editingTask.memo.trim(),
                      order: nextOrder,
                      created_at: now,
                      updated_at: now,
                      version: 1,
                    });
                    setIsCreatingTask(false);
                    setEditingTask(null);
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
                }}
                disabled={!editingTask.title.trim()}
                className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isCreatingTask ? '만들기' : '저장'}
              </button>
            </div>
          </div>
        </div>
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
          onConfirm={applySelectedTime}
        />
      )}

      {confirmDailyAction && (
        <ConfirmDailyDeleteDialog
          mode={confirmDailyAction}
          dateLabel={selectedDateLabel}
          onCancel={() => setConfirmDailyAction(null)}
          onConfirm={() => { void deleteDayTasks(confirmDailyAction === 'DELETE_INCOMPLETE').then(() => setConfirmDailyAction(null)); }}
        />
      )}

      {isNoIncompleteNoticeOpen && (
        <NoIncompleteNoticeDialog dateLabel={selectedDateLabel} onClose={() => setIsNoIncompleteNoticeOpen(false)} />
      )}

      {viewingImage && (
        <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {/* Category Manage Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 w-[420px] shadow-xl max-h-[80vh] flex flex-col relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">카테고리 관리</h3>
              <button onClick={() => { setIsCategoryModalOpen(false); setEditingCategoryId(null); setShowEmojiPicker(false); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 pr-1">
              <DragDropContext onDragEnd={handleCategoryDragEnd}>
                <Droppable droppableId="categories">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {categories.map((c, index) => (
                        <Draggable key={c.id} draggableId={c.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={clsx(
                                "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all",
                                snapshot.isDragging ? "bg-white shadow-lg border-gray-300" : "bg-gray-50 border-gray-100"
                              )}
                              style={provided.draggableProps.style}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div {...provided.dragHandleProps} className="p-0.5 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing">
                                  <GripVertical size={16} />
                                </div>
                                {editingCategoryId === c.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => { setEmojiPickerTarget('edit'); setShowEmojiPicker(open => !open); }}
                                      className="inline-flex items-center rounded-lg p-1 hover:bg-white"
                                      aria-label="카테고리 아이콘 변경"
                                    >
                                      <EmojiIcon emoji={editingCategoryIcon} className="h-5 w-6" />
                                    </button>
                                    <input
                                      autoFocus
                                      value={editingCategoryName}
                                      onChange={event => setEditingCategoryName(event.target.value)}
                                      className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 font-medium text-gray-700 outline-none ring-1 ring-gray-200 focus:ring-gray-400"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <span className="inline-flex items-center"><EmojiIcon emoji={c.icon} className="h-5 w-6" /></span>
                                    <span className="font-medium text-gray-700 truncate">{c.name}</span>
                                  </>
                                )}
                              </div>
                              {editingCategoryId === c.id ? (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={async () => {
                                      if (!editingCategoryName.trim()) return;
                                      const now = new Date().toISOString();
                                      await db.domains.put({
                                        ...c,
                                        name: editingCategoryName.trim(),
                                        icon: editingCategoryIcon,
                                        updated_at: now,
                                        version: c.version + 1,
                                      });
                                      setEditingCategoryId(null);
                                      setShowEmojiPicker(false);
                                    }}
                                    aria-label={`${c.name} 저장`}
                                    className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-white rounded-lg transition-colors"
                                  >
                                    <Check size={16}/>
                                  </button>
                                  <button
                                    onClick={() => { setEditingCategoryId(null); setShowEmojiPicker(false); }}
                                    aria-label="카테고리 수정 취소"
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                                  >
                                    <X size={16}/>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingCategoryId(c.id);
                                      setEditingCategoryName(c.name);
                                      setEditingCategoryIcon(c.icon);
                                      setEmojiPickerTarget('edit');
                                      setShowEmojiPicker(false);
                                    }}
                                    aria-label={`${c.name} 수정`}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                                  >
                                    <Pencil size={16}/>
                                  </button>
                                  <button onClick={() => { if (editingCategoryId === c.id) setEditingCategoryId(null); void handleCategoryDelete(c.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16}/>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              
              {categories.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">등록된 카테고리가 없습니다</div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(e.currentTarget);
                const name = fd.get('name') as string;
                if(!name.trim()) return;
                await db.domains.add({
                  id: crypto.randomUUID(), version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
                  name: name.trim(), icon: newCategoryEmoji, color: '#666666', order: categories.length, is_archived: false
                });
                form.reset();
                setShowEmojiPicker(false);
              }} className="relative">
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => { setEmojiPickerTarget('new'); setShowEmojiPicker(!showEmojiPicker); }}
                    className="w-12 h-12 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-xl text-2xl transition-colors border border-gray-200 shrink-0"
                  >
                    <EmojiIcon emoji={newCategoryEmoji} className="h-6 w-8" />
                  </button>
                  <input name="name" type="text" placeholder="새 카테고리 이름" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 outline-none focus:border-gray-400 transition-colors font-sans" />
                  <button type="submit" className="w-12 h-12 flex items-center justify-center bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shrink-0"><Plus size={20}/></button>
                </div>
                
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-1/2 z-[60] flex h-[430px] w-[680px] -translate-x-1/2 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-base font-medium text-gray-700">아이콘 선택</span>
                      <button type="button" onClick={() => setShowEmojiPicker(false)} aria-label="아이콘 선택 닫기" className="p-1 text-gray-400 hover:text-gray-700"><X size={16}/></button>
                    </div>
                    <div className="mb-4 grid grid-cols-5 gap-1.5">
                      {emojiCategories.map(category => (
                        <button key={category.id} type="button" onClick={() => setSelectedEmojiCategory(category.id)} className={clsx("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors", selectedEmojiSet.id === category.id ? "bg-primary/30 text-gray-800" : "text-gray-500 hover:bg-gray-100")}><EmojiIcon emoji={category.icon} className="h-4 w-5" /> {category.id}</button>
                      ))}
                    </div>
                    <div className="h-[252px] flex-none overflow-y-auto pr-1">
                      {(selectedEmojiSet.sections ?? [{ id: selectedEmojiSet.id, label: '', emojis: selectedEmojiSet.emojis }]).map(section => (
                        <div key={section.id} className="mb-3 last:mb-0">
                          {section.label && <p className="mb-1.5 px-1 text-xs font-medium text-gray-400">{section.label}</p>}
                          <div className="grid grid-cols-10 gap-1.5">
                            {section.emojis.map(emoji => {
                              const flagName = flagNameByEmoji[emoji];
                              return (
                                <button key={emoji} type="button" onClick={() => { if (emojiPickerTarget === 'edit') setEditingCategoryIcon(emoji); else setNewCategoryEmoji(emoji); setShowEmojiPicker(false); setFlagTooltip(null); }} onMouseEnter={(event) => { if (flagName) { const rect = event.currentTarget.getBoundingClientRect(); setFlagTooltip({ label: flagName, x: rect.left + rect.width / 2, y: rect.top - 8 }); } }} onMouseLeave={() => setFlagTooltip(null)} onFocus={(event) => { if (flagName) { const rect = event.currentTarget.getBoundingClientRect(); setFlagTooltip({ label: flagName, x: rect.left + rect.width / 2, y: rect.top - 8 }); } }} onBlur={() => setFlagTooltip(null)} aria-label={`${emoji} 선택`} className="group relative flex aspect-square items-center justify-center rounded-xl text-2xl hover:bg-primary/20 focus:bg-primary/20">
                                  <EmojiIcon emoji={emoji} className="h-7 w-7" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
      {flagTooltip && (
        <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl" style={{ left: flagTooltip.x, top: flagTooltip.y }}>
          {flagTooltip.label}
        </div>
      )}
    </div>
  );
}

export default App;
