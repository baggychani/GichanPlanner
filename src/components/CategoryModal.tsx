import { useMemo, useState } from 'react';
import { Check, FolderKanban, GripVertical, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { db, type Domain, type Project } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { emojiCategories, flagNameByEmoji } from '../lib/emojis';
import { deleteCategory, reorderCategories } from '../lib/taskOps';
import { EmojiIcon } from './EmojiIcon';
import { Overlay } from './Overlay';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';

export function CategoryModal({
  categories,
  projects,
  onClose,
}: {
  categories: Domain[];
  projects: Project[];
  onClose: () => void;
}) {
  const [section, setSection] = useState<'categories' | 'projects'>('categories');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('📁');
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'new' | 'edit'>('new');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('📁');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<(typeof emojiCategories)[number]['id']>(emojiCategories[0].id);
  const [flagTooltip, setFlagTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const selectedEmojiSet = useMemo(
    () => emojiCategories.find(category => category.id === selectedEmojiCategory) ?? emojiCategories[0],
    [selectedEmojiCategory],
  );

  return (
    <>
      <Overlay
        onEscape={() => {
          if (showEmojiPicker) setShowEmojiPicker(false);
          else if (editingCategoryId) setEditingCategoryId(null);
          else onClose();
        }}
      >
        <div className="relative flex h-[min(680px,85vh)] w-[min(680px,95vw)] overflow-hidden rounded-3xl bg-surface shadow-xl">
          <nav className="flex w-[148px] shrink-0 flex-col gap-1 border-r border-line bg-surface-muted px-2 py-4">
            <p className="mb-2 px-3 text-xs font-medium text-fg-subtle">설정</p>
            <button
              type="button"
              onClick={() => { setSection('categories'); setShowEmojiPicker(false); }}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === 'categories' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <Tags size={16} /> 카테고리
            </button>
            <button
              type="button"
              onClick={() => { setSection('projects'); setShowEmojiPicker(false); setEditingCategoryId(null); }}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === 'projects' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
              )}
            >
              <FolderKanban size={16} /> 프로젝트
            </button>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">{section === 'categories' ? '카테고리 관리' : '프로젝트 관리'}</h3>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-surface-hover"><X size={20} /></button>
          </div>

          {section === 'projects' ? (
            <ProjectSettingsPanel projects={projects} />
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
                                    onClick={() => { setEmojiPickerTarget('edit'); setShowEmojiPicker(open => !open); }}
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
                                    setShowEmojiPicker(false);
                                  }}
                                  aria-label={`${category.name} 저장`}
                                  className="p-1.5 text-fg-subtle hover:text-fg hover:bg-surface rounded-lg transition-colors"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => { setEditingCategoryId(null); setShowEmojiPicker(false); }}
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
                                    setEmojiPickerTarget('edit');
                                    setShowEmojiPicker(false);
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
                setShowEmojiPicker(false);
              }}
              className="relative"
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEmojiPickerTarget('new'); setShowEmojiPicker(open => !open); }}
                  className="w-12 h-12 flex items-center justify-center bg-surface-muted hover:bg-surface-hover rounded-xl text-2xl transition-colors border border-line-strong shrink-0"
                >
                  <EmojiIcon emoji={newCategoryEmoji} className="h-6 w-8" />
                </button>
                <input name="name" type="text" placeholder="새 카테고리 이름" className="flex-1 bg-surface-muted border border-line-strong rounded-xl px-4 outline-none focus:border-fg-subtle transition-colors font-sans" />
                <button type="submit" className="w-12 h-12 flex items-center justify-center bg-ink text-on-ink rounded-xl hover:opacity-90 transition-colors shrink-0"><Plus size={20} /></button>
              </div>

              {showEmojiPicker && (
                <div className="absolute bottom-16 left-1/2 z-[60] flex h-[430px] w-[680px] -translate-x-1/2 flex-col rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-base font-medium text-fg">아이콘 선택</span>
                    <button type="button" onClick={() => setShowEmojiPicker(false)} aria-label="아이콘 선택 닫기" className="p-1 text-fg-subtle hover:text-fg"><X size={16} /></button>
                  </div>
                  <div className="mb-4 grid grid-cols-5 gap-1.5">
                    {emojiCategories.map(category => (
                      <button key={category.id} type="button" onClick={() => setSelectedEmojiCategory(category.id)} className={clsx('flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors', selectedEmojiSet.id === category.id ? 'bg-primary/30 text-fg' : 'text-fg-muted hover:bg-surface-hover')}>
                        <EmojiIcon emoji={category.icon} className="h-4 w-5" /> {category.id}
                      </button>
                    ))}
                  </div>
                  <div className="h-[252px] flex-none overflow-y-auto pr-1">
                    {(selectedEmojiSet.sections ?? [{ id: selectedEmojiSet.id, label: '', emojis: selectedEmojiSet.emojis }]).map(section => (
                      <div key={section.id} className="mb-3 last:mb-0">
                        {section.label && <p className="mb-1.5 px-1 text-xs font-medium text-fg-subtle">{section.label}</p>}
                        <div className="grid grid-cols-10 gap-1.5">
                          {section.emojis.map(emoji => {
                            const flagName = flagNameByEmoji[emoji];
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  if (emojiPickerTarget === 'edit') setEditingCategoryIcon(emoji);
                                  else setNewCategoryEmoji(emoji);
                                  setShowEmojiPicker(false);
                                  setFlagTooltip(null);
                                }}
                                onMouseEnter={(event) => {
                                  if (!flagName) return;
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  setFlagTooltip({ label: flagName, x: rect.left + rect.width / 2, y: rect.top - 8 });
                                }}
                                onMouseLeave={() => setFlagTooltip(null)}
                                onFocus={(event) => {
                                  if (!flagName) return;
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  setFlagTooltip({ label: flagName, x: rect.left + rect.width / 2, y: rect.top - 8 });
                                }}
                                onBlur={() => setFlagTooltip(null)}
                                aria-label={`${emoji} 선택`}
                                className="group relative flex aspect-square items-center justify-center rounded-xl text-2xl hover:bg-primary/20 focus:bg-primary/20"
                              >
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
          )}
          </div>
        </div>
      </Overlay>
      {flagTooltip && (
        <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl" style={{ left: flagTooltip.x, top: flagTooltip.y }}>
          {flagTooltip.label}
        </div>
      )}
    </>
  );
}
