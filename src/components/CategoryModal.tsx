import { useEffect, useState } from 'react';
import { Check, Download, FolderKanban, GripVertical, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { db, type Deadline, type Domain, type Project, type Task } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { deleteCategory, reorderCategories } from '../lib/taskOps';
import { EmojiIcon } from './EmojiIcon';
import { EmojiPickerOverlay } from './EmojiPickerOverlay';
import { Overlay } from './Overlay';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { downloadPortablePlannerExport } from '../lib/portablePlannerExport';

type SettingsSection = 'categories' | 'projects' | 'data';

export function CategoryModal({
  categories,
  projects,
  tasks,
  deadlines,
  initialSection = 'categories',
  initialProjectId = null,
  onClose,
  onOpenTask,
  onOpenDeadline,
}: {
  categories: Domain[];
  projects: Project[];
  tasks: Task[];
  deadlines: Deadline[];
  initialSection?: SettingsSection;
  initialProjectId?: string | null;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onOpenDeadline: (deadline: Deadline) => void;
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('📁');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📁');
  const [iconPicker, setIconPicker] = useState<{ onSelect: (emoji: string) => void } | null>(null);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!backupStatus) return;
    const timer = window.setTimeout(() => setBackupStatus(null), 2200);
    return () => window.clearTimeout(timer);
  }, [backupStatus]);

  const sectionTitle = section === 'categories' ? '카테고리 관리' : section === 'projects' ? '프로젝트 관리' : '데이터';

  return (
    <>
      <Overlay
        onEscape={() => {
          if (editingCategoryId) setEditingCategoryId(null);
          else onClose();
        }}
      >
        <div className="relative flex h-[min(680px,85vh)] w-[min(712px,95vw)] overflow-hidden rounded-3xl bg-surface shadow-xl">
          <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-line bg-surface-muted px-2 py-4">
            <p className="mb-2 px-3 text-xs font-medium text-fg-subtle">설정</p>
            <button
              type="button"
              onClick={() => setSection('categories')}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === 'categories' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <Tags size={16} /> 카테고리
            </button>
            <button
              type="button"
              onClick={() => { setSection('projects'); setEditingCategoryId(null); }}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === 'projects' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <FolderKanban size={16} /> 프로젝트
            </button>
            <button
              type="button"
              onClick={() => { setSection('data'); setEditingCategoryId(null); }}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === 'data' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <Download size={16} /> 데이터
            </button>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{sectionTitle}</h3>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-surface-hover"><X size={20} /></button>
            </div>

            {section === 'projects' ? (
              <ProjectSettingsPanel
                projects={projects}
                tasks={tasks}
                deadlines={deadlines}
                initialOpenId={initialProjectId}
                onOpenTask={onOpenTask}
                onOpenDeadline={onOpenDeadline}
                onPickIcon={(onSelect) => setIconPicker({ onSelect })}
              />
            ) : section === 'data' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="text-sm leading-6 text-fg-muted">
                  이 기기에 있는 할 일, 데드라인, 프로젝트, 사진을 JSON 파일로 저장합니다. 사이트 기능이 바뀌어도 이 파일은 그대로입니다.
                </p>
                <button
                  type="button"
                  disabled={isDownloadingBackup}
                  onClick={() => {
                    setIsDownloadingBackup(true);
                    void downloadPortablePlannerExport()
                      .then(() => setBackupStatus('데이터를 받았습니다.'))
                      .catch(() => setBackupStatus('데이터를 받지 못했습니다.'))
                      .finally(() => setIsDownloadingBackup(false));
                  }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-semibold text-on-ink disabled:opacity-40"
                >
                  <Download size={16} />
                  {isDownloadingBackup ? '받는 중…' : '데이터 받기'}
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
                  <DragDropContext onDragEnd={(result) => { void reorderCategories(categories, result); }}>
                    <Droppable droppableId="categories">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {categories.map((category, index) => (
                            <Draggable key={category.id} draggableId={category.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={clsx(
                                    'flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all',
                                    snapshot.isDragging ? 'bg-surface shadow-lg border-line-strong' : 'bg-surface-muted border-line',
                                  )}
                                  style={provided.draggableProps.style}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div {...provided.dragHandleProps} className="p-0.5 text-fg-subtle hover:text-fg cursor-grab active:cursor-grabbing">
                                      <GripVertical size={16} />
                                    </div>
                                    {editingCategoryId === category.id ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setIconPicker({ onSelect: setEditingCategoryIcon })}
                                          className="inline-flex items-center rounded-lg p-1 hover:bg-surface"
                                          aria-label="카테고리 아이콘 변경"
                                        >
                                          <EmojiIcon emoji={editingCategoryIcon} className="h-5 w-6" />
                                        </button>
                                        <input
                                          autoFocus
                                          value={editingCategoryName}
                                          onChange={event => setEditingCategoryName(event.target.value)}
                                          className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 font-medium text-fg outline-none ring-1 ring-line-strong focus:ring-fg-subtle"
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <span className="inline-flex items-center"><EmojiIcon emoji={category.icon} className="h-5 w-6" /></span>
                                        <span className="font-medium text-fg truncate">{category.name}</span>
                                      </>
                                    )}
                                  </div>
                                  {editingCategoryId === category.id ? (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={async () => {
                                          if (!editingCategoryName.trim()) return;
                                          const now = new Date().toISOString();
                                          await runPlannerWrite(() => db.domains.put({
                                            ...category,
                                            name: editingCategoryName.trim(),
                                            icon: editingCategoryIcon,
                                            updated_at: now,
                                            version: category.version + 1,
                                          }));
                                          setEditingCategoryId(null);
                                        }}
                                        aria-label={`${category.name} 저장`}
                                        className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface rounded-lg transition-colors"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        onClick={() => setEditingCategoryId(null)}
                                        aria-label="카테고리 수정 취소"
                                        className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface rounded-lg transition-colors"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingCategoryId(category.id);
                                          setEditingCategoryName(category.name);
                                          setEditingCategoryIcon(category.icon);
                                        }}
                                        aria-label={`${category.name} 수정`}
                                        className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface rounded-lg transition-colors"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (editingCategoryId === category.id) setEditingCategoryId(null);
                                          void deleteCategory(category.id);
                                        }}
                                        className="p-1.5 text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                      >
                                        <Trash2 size={16} />
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
                    <div className="text-center text-fg-subtle py-8 text-sm">등록된 카테고리가 없습니다</div>
                  )}
                </div>

                <div className="pt-4 border-t border-line">
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const name = (new FormData(form).get('name') as string).trim();
                      if (!name) return;
                      const now = new Date().toISOString();
                      await runPlannerWrite(() => db.domains.add({
                        id: crypto.randomUUID(),
                        version: 1,
                        created_at: now,
                        updated_at: now,
                        deleted_at: null,
                        name,
                        icon: newCategoryEmoji,
                        color: '#666666',
                        order: categories.length,
                        is_archived: false,
                      }));
                      form.reset();
                    }}
                  >
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIconPicker({ onSelect: setNewCategoryEmoji })}
                        className="w-12 h-12 flex items-center justify-center bg-surface-muted hover:bg-surface-hover rounded-xl text-2xl transition-colors border border-line-strong shrink-0"
                      >
                        <EmojiIcon emoji={newCategoryEmoji} className="h-6 w-8" />
                      </button>
                      <input name="name" type="text" placeholder="새 카테고리 이름" className="flex-1 bg-surface-muted border border-line-strong rounded-xl px-4 outline-none focus:border-fg-subtle transition-colors font-sans" />
                      <button type="submit" className="w-12 h-12 flex items-center justify-center bg-ink text-on-ink rounded-xl hover:opacity-90 transition-colors shrink-0"><Plus size={20} /></button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
          {backupStatus && (
            <p role="status" className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink shadow-lg">
              {backupStatus}
            </p>
          )}
        </div>
      </Overlay>
      {iconPicker && (
        <EmojiPickerOverlay
          onClose={() => setIconPicker(null)}
          onSelect={(emoji) => {
            iconPicker.onSelect(emoji);
            setIconPicker(null);
          }}
        />
      )}
    </>
  );
}
