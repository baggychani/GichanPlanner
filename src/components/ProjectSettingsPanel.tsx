import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Check, ChevronRight, FolderKanban, Pencil, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { db, type Deadline, type Project, type Task } from '../lib/db';
import { parseDay } from '../lib/datetime';
import { runPlannerWrite } from '../lib/supabaseSync';
import { deleteProject } from '../lib/taskOps';
import { EmojiIcon } from './EmojiIcon';

export function ProjectSettingsPanel({
  projects,
  tasks,
  deadlines,
  initialOpenId = null,
  onOpenTask,
  onOpenDeadline,
  onPickIcon,
}: {
  projects: Project[];
  tasks: Task[];
  deadlines: Deadline[];
  initialOpenId?: string | null;
  onOpenTask: (task: Task) => void;
  onOpenDeadline: (deadline: Deadline) => void;
  onPickIcon: (onSelect: (emoji: string) => void) => void;
}) {
  const [openId, setOpenId] = useState<string | null | undefined>(initialOpenId ?? undefined);
  const activeId = openId === undefined ? projects[0]?.id ?? null : openId;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingIcon, setEditingIcon] = useState('📁');
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('📁');

  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.project_id) continue;
      const list = grouped.get(task.project_id) ?? [];
      list.push(task);
      grouped.set(task.project_id, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.target_date.localeCompare(b.target_date) || a.order - b.order || a.created_at.localeCompare(b.created_at));
    }
    return grouped;
  }, [tasks]);

  const deadlinesByProject = useMemo(() => {
    const grouped = new Map<string, Deadline[]>();
    for (const deadline of deadlines) {
      if (!deadline.project_id) continue;
      const list = grouped.get(deadline.project_id) ?? [];
      list.push(deadline);
      grouped.set(deadline.project_id, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at));
    }
    return grouped;
  }, [deadlines]);

  const closeEdit = () => setEditingId(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
        <div className="space-y-2">
          {projects.map(project => {
            const projectTasks = tasksByProject.get(project.id) ?? [];
            const projectDeadlines = deadlinesByProject.get(project.id) ?? [];
            const completed = projectTasks.filter(task => task.is_completed).length;
            const total = projectTasks.length;
            const isOpen = activeId === project.id;
            const isEditing = editingId === project.id;
            return (
              <section
                key={project.id}
                className={clsx('rounded-2xl border', isOpen ? 'border-line-strong bg-surface' : 'border-line bg-surface-muted')}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => { setOpenId(isOpen ? null : project.id); if (isEditing) closeEdit(); }}
                    className="grid h-10 w-10 shrink-0 place-items-center text-fg-subtle hover:text-fg"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `${project.title} 접기` : `${project.title} 펼치기`}
                  >
                    <ChevronRight size={16} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                  </button>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onPickIcon(setEditingIcon)}
                        className="inline-flex shrink-0 items-center rounded-lg p-1 hover:bg-surface-muted"
                        aria-label="프로젝트 아이콘 변경"
                      >
                        <EmojiIcon emoji={editingIcon} className="h-5 w-6" />
                      </button>
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={event => setEditingTitle(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg bg-surface-muted px-2 py-1 font-medium text-fg outline-none ring-1 ring-line-strong"
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : project.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2 text-left"
                    >
                      <EmojiIcon emoji={project.icon} className="h-5 w-6 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium text-fg">{project.title}</span>
                    </button>
                  )}
                  <span className="shrink-0 text-xs font-medium text-fg-subtle">{total === 0 ? '할 일 없음' : `${completed}/${total}`}</span>
                  {isEditing ? (
                    <div className="flex shrink-0 items-center gap-0.5 pr-1">
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
                        className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg"
                      >
                        <Check size={16} />
                      </button>
                      <button type="button" onClick={closeEdit} aria-label="프로젝트 수정 취소" className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-0.5 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenId(project.id);
                          setEditingId(project.id);
                          setEditingTitle(project.title);
                          setEditingIcon(project.icon);
                        }}
                        aria-label={`${project.title} 이름 수정`}
                        className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { void deleteProject(project.id); }}
                        aria-label={`${project.title} 삭제`}
                        className="rounded-lg p-1.5 text-fg-subtle hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-line px-3 pb-3 pt-2">
                    {total > 0 && (
                      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((completed / total) * 100)}%` }} />
                      </div>
                    )}
                    {projectTasks.length === 0 && projectDeadlines.length === 0 ? (
                      <p className="px-1 py-3 text-sm text-fg-subtle">아직 묶인 할 일이나 데드라인이 없습니다. 상세에서 이 프로젝트를 고르면 여기 모입니다.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {projectDeadlines.map(deadline => (
                          <li key={deadline.id}>
                            <button
                              type="button"
                              onClick={() => onOpenDeadline(deadline)}
                              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              <AlertCircle size={14} className="shrink-0 text-red-500" />
                              <span className="w-10 shrink-0 text-xs text-red-500">{format(parseDay(deadline.due_date), 'M.d')}</span>
                              <span className="inline-flex max-w-[7.5rem] shrink-0 items-center gap-0.5 rounded-md bg-surface-muted px-1.5 py-0.5">
                                <EmojiIcon emoji={project.icon} className="h-3.5 w-3.5" />
                                <span className="truncate text-[11px] font-medium leading-none text-fg-muted">{project.title}</span>
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-fg">{deadline.title}</span>
                            </button>
                          </li>
                        ))}
                        {projectTasks.map(task => (
                          <li key={task.id}>
                            <button
                              type="button"
                              onClick={() => onOpenTask(task)}
                              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-surface-muted"
                            >
                              <span className={clsx('grid h-4 w-4 shrink-0 place-items-center rounded-full border-2', task.is_completed ? 'border-primary bg-primary' : 'border-line-strong')}>
                                {task.is_completed && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="w-10 shrink-0 text-xs text-fg-subtle">{format(parseDay(task.target_date), 'M.d')}</span>
                              <span className={clsx('min-w-0 flex-1 truncate text-sm', task.is_completed ? 'text-fg-subtle line-through' : 'text-fg')}>{task.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

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
            const id = crypto.randomUUID();
            await runPlannerWrite(() => db.projects.add({
              id,
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
            setOpenId(id);
          }}
        >
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPickIcon(setNewIcon)}
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
        </form>
      </div>
    </div>
  );
}
