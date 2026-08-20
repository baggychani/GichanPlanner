import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { db, type Domain, type Task } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { ClearMark } from './ClearMark';
import { CountBubble } from './CountBubble';
import { EmojiIcon } from './EmojiIcon';
import { TaskRow } from './TaskRow';

type DailyPanelProps = {
  selectedDate: Date;
  categories: Domain[];
  tasks: Task[];
  quickAddCategoryId: string | null;
  quickAddTitle: string;
  draggedTaskId: string | null;
  justDroppedTaskId: string | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: (result: DropResult) => void;
  onQuickAddCategory: (categoryKey: string) => void;
  onQuickAddTitleChange: (title: string) => void;
  onQuickAddSubmit: (categoryId: string | null) => void;
  onQuickAddBlur: (categoryId: string | null) => void;
  onOpenTask: (task: Task) => void;
  onViewImage: (src: string) => void;
};

export function DailyPanel({
  selectedDate,
  categories,
  tasks,
  quickAddCategoryId,
  quickAddTitle,
  draggedTaskId,
  justDroppedTaskId,
  onDragStart,
  onDragEnd,
  onQuickAddCategory,
  onQuickAddTitleChange,
  onQuickAddSubmit,
  onQuickAddBlur,
  onOpenTask,
  onViewImage,
}: DailyPanelProps) {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = tasks.filter(task => task.target_date === dateStr);

  const renderCategorySection = (categoryId: string | null, name: string, icon: string) => {
    const categoryTasks = dayTasks.filter(task => task.domain_id === categoryId);
    const incompleteCategoryTasks = categoryTasks.filter(task => !task.is_completed);
    const importantCategoryCount = incompleteCategoryTasks.filter(task => task.is_important).length;
    const activeCategoryCount = incompleteCategoryTasks.length - importantCategoryCount;
    const categoryCleared = categoryTasks.length > 0 && incompleteCategoryTasks.length === 0;
    const isAdding = quickAddCategoryId === (categoryId || 'unassigned');

    return (
      <Droppable droppableId={categoryId || 'unassigned'} key={categoryId || 'unassigned'}>
        {(provided, snapshot) => (
          <div
            className={clsx(
              'space-y-2 p-2 rounded-2xl transition-[background-color,box-shadow,margin] duration-200 ease-out',
              categoryTasks.length === 0 && !isAdding ? 'mb-2' : 'mb-5',
              snapshot.isDraggingOver ? 'bg-primary/10 ring-1 ring-primary/40 shadow-inner' : '',
            )}
          >
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted border border-line">
                  <span className="text-sm inline-flex items-center"><EmojiIcon emoji={icon} /></span>
                  <span className="text-sm font-medium text-fg-muted">{name}</span>
                </div>
                {importantCategoryCount > 0 && <CountBubble count={importantCategoryCount} tone="important" />}
                {activeCategoryCount > 0 && <CountBubble count={activeCategoryCount} tone="plain" />}
                {categoryCleared && <ClearMark />}
              </div>
              <button
                onClick={() => onQuickAddCategory(categoryId || 'unassigned')}
                aria-label={`${name}에 할 일 추가`}
                title={`${name}에 할 일 추가`}
                className="p-1.5 bg-surface-muted text-fg-subtle hover:text-fg hover:bg-surface-hover rounded-full transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-0.5 pl-1 min-h-[10px]"
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
                        void runPlannerWrite(() => db.tasks.update(task.id, { is_completed: !task.is_completed, updated_at: new Date().toISOString(), version: task.version + 1 }));
                      }}
                      onOpen={() => onOpenTask(task)}
                      onViewImage={onViewImage}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {isAdding && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    onQuickAddSubmit(categoryId);
                  }}
                  className="flex items-center gap-3 px-3 py-1"
                >
                  <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-line-strong bg-surface" />
                  <input
                    autoFocus
                    type="text"
                    value={quickAddTitle}
                    onChange={(event) => onQuickAddTitleChange(event.target.value)}
                    placeholder="할 일 입력..."
                    onBlur={(event) => {
                      const nextTarget = event.relatedTarget as Node | null;
                      if (nextTarget && event.currentTarget.form?.contains(nextTarget)) return;
                      onQuickAddBlur(categoryId);
                    }}
                    className="w-full bg-transparent border-b border-primary/50 py-1 outline-none font-sans text-[15px] focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    aria-label={`${name} 할 일 저장`}
                    className="p-1.5 rounded-lg text-fg-subtle hover:bg-primary/20 hover:text-fg transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </form>
              )}

              {!isAdding && categoryTasks.length === 0 && !snapshot.isDraggingOver && (
                <div className="pl-9 pt-2 pb-1 text-sm text-fg-faint font-sans">등록된 할 일이 없습니다</div>
              )}
            </div>
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="pr-0">
      <DragDropContext onDragStart={(start) => onDragStart(start.draggableId)} onDragEnd={onDragEnd}>
        {categories.map(category => renderCategorySection(category.id, category.name, category.icon))}
        {renderCategorySection(null, '미분류', '📥')}
      </DragDropContext>
    </div>
  );
}
