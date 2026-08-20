import { useState } from 'react';
import { Check, FolderKanban, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { db, type Project } from '../lib/db';
import { PROJECT_ICONS } from '../lib/projectIcons';
import { runPlannerWrite } from '../lib/supabaseSync';
import { deleteProject, reorderProjects } from '../lib/taskOps';
import { EmojiIcon } from './EmojiIcon';

export function ProjectSettingsPanel({ projects }: { projects: Project[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingIcon, setEditingIcon] = useState('📁');
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [iconPicker, setIconPicker] = useState<'new' | 'edit' | null>(null);

  const closeEdit = () => {
    setEditingId(null);
    setIconPicker(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
        <DragDropContext onDragEnd={(result) => { void reorderProjects(projects, result); }}>
          <Droppable droppableId="projects">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {projects.map((project, index) => (
                  <Draggable key={project.id} draggableId={project.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={clsx(
                          'rounded-xl border px-3 py-2.5 transition-all',
                          snapshot.isDragging ? 'border-line-strong bg-surface shadow-lg' : 'border-line bg-surface-muted',
                        )}
                        style={provided.draggableProps.style}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <div {...provided.dragHandleProps} className="cursor-grab p-0.5 text-fg-subtle hover:text-fg active:cursor-grabbing">
                              <GripVertical size={16} />
                            </div>
                            {editingId === project.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setIconPicker(open => open === 'edit' ? null : 'edit')}
                                  className="inline-flex items-center rounded-lg p-1 hover:bg-surface"
                                  aria-label="프로젝트 아이콘 변경"
                                >
                                  <EmojiIcon emoji={editingIcon} className="h-5 w-6" />
                                </button>
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={event => setEditingTitle(event.target.value)}
                                  className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 font-medium text-fg outline-none ring-1 ring-line-strong focus:ring-fg-subtle"
                                />
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center"><EmojiIcon emoji={project.icon} className="h-5 w-6" /></span>
                                <span className="truncate font-medium text-fg">{project.title}</span>
                              </>
                            )}
                          </div>
                          {editingId === project.id ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!editingTitle.trim()) return;
                                  const now = new Date().toISOString();
                                  await runPlannerWrite(() => db.projects.put({
                                    ...project,
                                    title: editingTitle.trim(),
                                    icon: editingIcon,
                                    updated_at: now,
                                    version: project.version + 1,
                                  }));
                                  closeEdit();
                                }}
                                aria-label={`${project.title} 저장`}
                                className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={closeEdit}
                                aria-label="프로젝트 수정 취소"
                                className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(project.id);
                                  setEditingTitle(project.title);
                                  setEditingIcon(project.icon);
                                  setIconPicker(null);
                                }}
                                aria-label={`${project.title} 수정`}
                                className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingId === project.id) closeEdit();
                                  void deleteProject(project.id);
                                }}
                                aria-label={`${project.title} 삭제`}
                                className="rounded-lg p-1.5 text-fg-subtle transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        {editingId === project.id && iconPicker === 'edit' && (
                          <IconGrid selected={editingIcon} onSelect={(icon) => { setEditingIcon(icon); setIconPicker(null); }} />
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

        {projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-subtle">
            <FolderKanban size={20} />
            등록된 프로젝트가 없습니다
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newTitle.trim()) return;
            const now = new Date().toISOString();
            await runPlannerWrite(() => db.projects.add({
              id: crypto.randomUUID(),
              version: 1,
              created_at: now,
              updated_at: now,
              deleted_at: null,
              title: newTitle.trim(),
              icon: newIcon,
              domain_id: null,
              due_date: null,
              order: projects.reduce((maximum, project) => Math.max(maximum, project.order), -1) + 1,
            }));
            setNewTitle('');
            setNewIcon('📁');
            setIconPicker(null);
          }}
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIconPicker(open => open === 'new' ? null : 'new')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface-muted text-2xl transition-colors hover:bg-surface-hover"
              aria-label="새 프로젝트 아이콘"
            >
              <EmojiIcon emoji={newIcon} className="h-6 w-8" />
            </button>
            <input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              type="text"
              placeholder="새 프로젝트 이름"
              className="flex-1 rounded-xl border border-line-strong bg-surface-muted px-4 font-sans outline-none transition-colors focus:border-fg-subtle"
            />
            <button type="submit" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-on-ink transition-colors hover:opacity-90" aria-label="프로젝트 추가">
              <Plus size={20} />
            </button>
          </div>
          {iconPicker === 'new' && (
            <IconGrid selected={newIcon} onSelect={(icon) => { setNewIcon(icon); setIconPicker(null); }} />
          )}
        </form>
      </div>
    </div>
  );
}

function IconGrid({ selected, onSelect }: { selected: string; onSelect: (icon: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {PROJECT_ICONS.map(candidate => (
        <button
          key={candidate}
          type="button"
          onClick={() => onSelect(candidate)}
          aria-pressed={selected === candidate}
          aria-label={`${candidate} 아이콘`}
          className={selected === candidate ? 'grid h-10 w-10 place-items-center rounded-xl bg-primary/30' : 'grid h-10 w-10 place-items-center rounded-xl bg-surface hover:bg-surface-hover'}
        >
          <EmojiIcon emoji={candidate} className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
