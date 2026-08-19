import { addDays, format } from 'date-fns';
import { Check, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { db, type Goal } from '../lib/db';
import { ClearMark } from './ClearMark';

type WeeklyPanelProps = {
  weekStart: Date;
  goals: Goal[];
  editingGoalId: string | null;
  editingGoalTitle: string;
  onEditingGoalIdChange: (id: string | null) => void;
  onEditingGoalTitleChange: (title: string) => void;
  onCreate?: () => boolean;
};

export function WeeklyPanel({
  weekStart,
  goals,
  editingGoalId,
  editingGoalTitle,
  onEditingGoalIdChange,
  onEditingGoalTitleChange,
  onCreate,
}: WeeklyPanelProps) {
  const weekGoals = goals.filter(goal => goal.time_frame === 'WEEK' && goal.start_date === format(weekStart, 'yyyy-MM-dd'));
  const completedGoalCount = weekGoals.filter(goal => goal.is_completed).length;

  return (
    <div className="pb-2 flex flex-col gap-6">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (onCreate && !onCreate()) return;
          const form = event.currentTarget;
          const title = (new FormData(form).get('title') as string).trim();
          if (!title) return;
          const now = new Date().toISOString();
          await db.goals.add({
            id: crypto.randomUUID(),
            version: 1,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            domain_id: null,
            time_frame: 'WEEK',
            start_date: format(weekStart, 'yyyy-MM-dd'),
            end_date: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
            title,
            is_completed: false,
          });
          form.reset();
        }}
        className="flex gap-2 bg-surface-muted p-2 rounded-2xl border border-line"
      >
        <input name="title" type="text" placeholder="새로운 주간 목표 추가..." className="flex-1 bg-transparent px-3 outline-none font-sans text-base font-medium transition-colors" />
        <button type="submit" className="w-10 h-10 flex items-center justify-center bg-primary text-on-primary rounded-xl font-bold hover:bg-yellow-400 transition-colors shrink-0"><Plus size={20} /></button>
      </form>

      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-fg-muted">이번 주 체크리스트</span>
        {weekGoals.length > 0 && completedGoalCount === weekGoals.length ? (
          <ClearMark />
        ) : (
          <span className="rounded-full border border-line-strong bg-surface-muted px-2 py-1 text-xs font-bold text-fg-muted">완료 {completedGoalCount}/{weekGoals.length}</span>
        )}
      </div>

      <div className="space-y-3">
        {weekGoals.map(goal => (
          <div key={goal.id} className={clsx('flex items-center gap-3 p-3 rounded-2xl bg-surface border shadow-sm group transition-colors', goal.is_completed ? 'border-line bg-surface-muted' : 'border-line-strong')}>
            <button
              onClick={() => db.goals.update(goal.id, { is_completed: !goal.is_completed, updated_at: new Date().toISOString(), version: goal.version + 1 })}
              aria-label={goal.is_completed ? `${goal.title} 완료 취소` : `${goal.title} 완료`}
              className={clsx('w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors', goal.is_completed ? 'bg-primary border-primary text-fg' : 'border-line-strong hover:border-primary')}
            >
              {goal.is_completed && <Check size={13} strokeWidth={3} />}
            </button>
            {editingGoalId === goal.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!editingGoalTitle.trim()) return;
                  await db.goals.update(goal.id, { title: editingGoalTitle.trim(), updated_at: new Date().toISOString(), version: goal.version + 1 });
                  onEditingGoalIdChange(null);
                }}
              >
                <input autoFocus value={editingGoalTitle} onChange={(event) => onEditingGoalTitleChange(event.target.value)} className="flex-1 min-w-0 rounded-lg bg-surface-hover px-2 py-1 font-sans text-[15px] font-medium outline-none focus:ring-1 focus:ring-primary" />
                <button type="submit" className="rounded-lg px-2 py-1 text-xs font-bold text-fg hover:bg-primary/20">저장</button>
                <button type="button" onClick={() => onEditingGoalIdChange(null)} className="rounded-lg px-2 py-1 text-xs font-bold text-fg-subtle hover:bg-surface-hover">취소</button>
              </form>
            ) : (
              <span className={clsx('flex-1 min-w-0 font-sans text-[15px] font-medium', goal.is_completed ? 'text-fg-subtle line-through decoration-fg-muted decoration-1' : 'text-fg')}>{goal.title}</span>
            )}
            {editingGoalId !== goal.id && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => { onEditingGoalIdChange(goal.id); onEditingGoalTitleChange(goal.title); }} aria-label={`${goal.title} 수정`} className="p-2 text-fg-faint hover:text-fg hover:bg-surface-hover rounded-lg transition-colors"><Pencil size={16} /></button>
                <button onClick={() => db.goals.update(goal.id, { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), version: goal.version + 1 })} aria-label={`${goal.title} 삭제`} className="p-2 text-fg-faint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        ))}
        {weekGoals.length === 0 && (
          <div className="text-center text-fg-subtle py-12 text-sm font-sans flex flex-col items-center gap-3">
            <Target size={32} className="text-fg-faint" />
            이번 주 목표가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
