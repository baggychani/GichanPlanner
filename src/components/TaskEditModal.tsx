import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Image as ImageIcon, Star, Trash2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import type { Domain, Project, Task } from '../lib/db';
import { formatScheduledTime, parseDay } from '../lib/datetime';
import { compressImage } from '../lib/imageAttachment';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { Overlay } from './Overlay';
import { ConfirmDiscardDialog } from './DailyDialogs';

function taskDraftKey(task: Task) {
  return JSON.stringify({
    title: task.title,
    memo: task.memo,
    domain_id: task.domain_id,
    project_id: task.project_id,
    is_important: task.is_important,
    target_date: task.target_date,
    scheduled_time: task.scheduled_time,
    hasImage: Boolean(task.image_blob || task.image_data || task.image_path),
    imageSize: task.image_blob?.size ?? 0,
  });
}

type TaskEditModalProps = {
  task: Task;
  isCreating: boolean;
  categories: Domain[];
  projects: Project[];
  onChange: (task: Task) => void;
  onClose: () => void;
  onPickDate: () => void;
  onOpenTimePicker: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function TaskEditModal({
  task,
  isCreating,
  categories,
  projects,
  onChange,
  onClose,
  onPickDate,
  onOpenTimePicker,
  onDelete,
  onSave,
}: TaskEditModalProps) {
  const [isFileHover, setIsFileHover] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialDraft = useRef(taskDraftKey(task));
  const imageUrl = useObjectUrl(task.image_blob ?? null) ?? task.image_data ?? null;
  const hasImage = Boolean(task.image_blob || task.image_data || task.image_path);

  const requestClose = () => {
    if (taskDraftKey(task) !== initialDraft.current) setDiscardOpen(true);
    else onClose();
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageError(null);
    try {
      const image_blob = await compressImage(file);
      // A replacement must receive a new immutable Storage path during sync.
      // Keeping the old path would make other devices reuse their old blob.
      onChange({ ...task, image_blob, image_data: null, image_path: null });
    } catch {
      setImageError('사진을 압축하지 못했습니다. 다른 이미지 파일을 선택해 주세요.');
    }
  };

  return (
    <Overlay onEscape={requestClose}>
      <div className="bg-surface rounded-3xl w-[420px] max-w-full shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 pb-4 shrink-0">
          <h3 className="text-[17px] font-bold">{isCreating ? '할 일 만들기' : '할 일 상세'}</h3>
          <button onClick={requestClose} className="p-1 hover:bg-surface-hover rounded-full"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-6 pb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">제목</label>
            <input
              type="text"
              autoFocus={isCreating}
              value={task.title}
              onChange={event => onChange({ ...task, title: event.target.value })}
              placeholder="할 일을 적어주세요"
              className="w-full bg-surface-muted rounded-xl px-3 py-2.5 outline-none font-sans text-[15px] font-medium leading-5 border border-transparent focus:border-line-strong"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">카테고리</label>
            <div className="flex gap-2">
              <select
                value={task.domain_id ?? ''}
                onChange={event => onChange({ ...task, domain_id: event.target.value || null })}
                className="min-w-0 flex-1 bg-surface-muted rounded-xl p-3 outline-none font-sans text-sm border border-transparent focus:border-line-strong"
              >
                <option value="">미분류</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange({ ...task, is_important: !task.is_important })}
                aria-pressed={task.is_important}
                aria-label="중요 할 일"
                className={clsx(
                  'shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors',
                  task.is_important ? 'bg-primary text-on-primary' : 'bg-surface-muted text-fg-muted hover:bg-surface-hover',
                )}
              >
                <Star size={16} fill={task.is_important ? 'currentColor' : 'none'} />
                중요
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">프로젝트</label>
            <select
              value={task.project_id ?? ''}
              onChange={event => onChange({ ...task, project_id: event.target.value || null })}
              className="w-full bg-surface-muted rounded-xl p-3 outline-none font-sans text-sm border border-transparent focus:border-line-strong"
            >
              <option value="">없음</option>
              {task.project_id && !projects.some(project => project.id === task.project_id) && (
                <option value={task.project_id}>없는 프로젝트</option>
              )}
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.icon} {project.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">메모</label>
            <textarea
              value={task.memo || ''}
              onChange={event => onChange({ ...task, memo: event.target.value })}
              placeholder="추가적인 메모를 적어보세요"
              className="w-full bg-surface-muted rounded-xl p-3 outline-none h-24 resize-none border border-transparent focus:border-line-strong text-sm font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">이미지 첨부</label>
            {hasImage ? (
              <div className="w-full bg-surface-muted rounded-xl border border-line-strong overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full object-contain max-h-[300px] bg-surface-hover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-surface-hover text-sm text-fg-subtle">사진을 불러오는 중…</div>
                )}
                <div className="p-2 flex justify-end gap-2 bg-surface border-t border-line-strong">
                  <label className="px-3 py-1.5 bg-surface-hover rounded-lg text-sm font-medium cursor-pointer transition-colors text-fg flex items-center gap-1.5">
                    <Upload size={14} />
                    변경
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event.target.files?.[0] ?? null)} />
                  </label>
                  <button
                    onClick={() => onChange({ ...task, image_blob: null, image_data: null, image_path: null })}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 rounded-lg text-sm font-medium text-red-500 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  'w-full bg-surface-muted rounded-xl border-2 border-dashed border-line-strong h-24 flex flex-col items-center justify-center relative transition-colors cursor-pointer',
                  isFileHover ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                )}
                onDragOver={(event) => { event.preventDefault(); setIsFileHover(true); }}
                onDragLeave={(event) => { event.preventDefault(); setIsFileHover(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsFileHover(false);
                  handleImageUpload(event.dataTransfer.files[0] ?? null);
                }}
              >
                <ImageIcon size={24} className="text-fg-subtle mb-2" />
                <span className="text-xs text-fg-muted font-sans font-medium">클릭하거나 이미지를 드래그 앤 드롭</span>
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(event) => handleImageUpload(event.target.files?.[0] ?? null)} />
              </div>
            )}
            {imageError && <p role="alert" className="mt-2 text-xs text-red-500">{imageError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">시간</label>
            <div className="flex items-center justify-between bg-surface-muted rounded-xl p-3 border border-transparent">
              <span className="text-sm font-sans text-fg-muted">{formatScheduledTime(task.scheduled_time) ?? '시간 없음'}</span>
              <button onClick={onOpenTimePicker} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-line-strong rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors shadow-sm text-fg">
                <CalendarIcon size={14} /> 시간 설정
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">날짜</label>
            <div className="flex items-center justify-between bg-surface-muted rounded-xl p-3 border border-transparent">
              <span className="text-sm font-sans font-medium">{format(parseDay(task.target_date), 'yyyy년 MM월 dd일')}</span>
              <button
                onClick={onPickDate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-line-strong rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors shadow-sm text-fg"
              >
                <CalendarIcon size={14} />
                날짜 변경
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 shrink-0 flex justify-between gap-3 border-t border-line">
          {isCreating ? (
            <button onClick={requestClose} className="px-4 py-3 text-fg-muted bg-surface-hover hover:bg-line-strong rounded-xl transition-colors font-bold flex items-center justify-center">
              취소
            </button>
          ) : (
            <button onClick={onDelete} className="px-4 py-3 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 rounded-xl transition-colors font-bold flex items-center justify-center">
              삭제
            </button>
          )}
          <button
            onClick={onSave}
            disabled={!task.title.trim()}
            className="flex-1 py-3 bg-ink text-on-ink rounded-xl font-bold hover:opacity-90 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? '만들기' : '저장'}
          </button>
        </div>
      </div>
      {discardOpen && <ConfirmDiscardDialog onCancel={() => setDiscardOpen(false)} onDiscard={onClose} />}
    </Overlay>
  );
}
