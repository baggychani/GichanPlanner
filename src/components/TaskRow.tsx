import clsx from 'clsx';
import { Clock, Star } from 'lucide-react';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import type { Task } from '../lib/db';
import { formatScheduledTime } from '../lib/datetime';

// 이전 카드형 할 일 UI. 지금은 텍스트 행을 쓰지만 레거시 스타일은 남겨 둔다.
const useLegacyTaskCards = false;
const legacyTaskCardClass = 'flex gap-3 p-3 rounded-2xl border bg-surface border-transparent shadow-sm hover:border-line-strong hover:shadow';
const textTaskRowClass = 'flex gap-3 px-3 py-2.5 rounded-xl bg-transparent';

type TaskRowProps = {
  task: Task;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  isDropped: boolean;
  isGrabbing: boolean;
  onToggleComplete: () => void;
  onOpen: () => void;
  onViewImage: (src: string) => void;
};

export function TaskRow({
  task,
  provided,
  snapshot,
  isDropped,
  isGrabbing,
  onToggleComplete,
  onOpen,
  onViewImage,
}: TaskRowProps) {
  const scheduledLabel = formatScheduledTime(task.scheduled_time);
  const hasBody = Boolean(scheduledLabel || task.memo);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={clsx(
        'group will-change-transform transition-[box-shadow,border-color,background-color,opacity] duration-200 ease-out',
        useLegacyTaskCards ? legacyTaskCardClass : textTaskRowClass,
        hasBody ? 'items-start' : 'items-center',
        snapshot.isDragging ? 'bg-surface shadow-xl border border-primary opacity-95' : 'hover:bg-surface-muted',
        isDropped ? 'task-drop-feedback' : '',
        isGrabbing ? 'cursor-grabbing' : '',
      )}
      style={provided.draggableProps.style}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onToggleComplete();
        }}
        aria-label={task.is_completed ? `${task.title} 완료 취소` : `${task.title} 완료`}
        className={clsx('shrink-0 z-10 transition-transform', hasBody ? 'mt-0.5' : '')}
      >
        <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors', task.is_completed ? 'bg-primary border-primary' : 'border-line-strong group-hover:border-primary')}>
          {task.is_completed && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
        </div>
      </button>

      <div className="flex-1 min-w-0" onClick={onOpen}>
        <div className="flex items-center gap-1.5 min-w-0">
          {task.is_important && (
            <Star size={14} strokeWidth={2} fill="currentColor" className={clsx('shrink-0', task.is_completed ? 'text-fg-faint' : 'text-amber-500')} />
          )}
          <div className={clsx('font-sans text-[15px] font-normal leading-snug truncate', task.is_completed ? 'text-fg-subtle line-through decoration-fg-muted decoration-1' : 'text-textPrimary')}>
            {task.title}
          </div>
        </div>
        {scheduledLabel && (
          <div className={clsx('mt-0.5 flex items-center gap-1 text-[13px]', task.is_completed ? 'text-fg-subtle' : 'text-fg-muted')}>
            <Clock size={13} strokeWidth={2} className="shrink-0" />
            <span>{scheduledLabel}</span>
          </div>
        )}
        {task.memo && (
          <div className={clsx('text-sm mt-1 whitespace-pre-wrap', task.is_completed ? 'text-fg-subtle' : 'text-fg-muted')}>{task.memo}</div>
        )}
      </div>

      {task.image_data && (
        <div
          className="w-12 h-12 rounded-lg shrink-0 overflow-hidden cursor-pointer border border-line-strong shadow-sm hover:opacity-90"
          onClick={(event) => {
            event.stopPropagation();
            onViewImage(task.image_data || '');
          }}
        >
          <img src={task.image_data} alt="첨부" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
