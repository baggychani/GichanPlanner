import { useMemo, useState } from 'react';
import { Cake, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db, type Anniversary } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { EmojiIcon } from './EmojiIcon';
import { BirthdayPickerModal } from './BirthdayPickerModal';
import { YearOtpInput } from './YearOtpInput';

export function AnniversarySettingsPanel({
  anniversaries,
  onPickIcon,
}: {
  anniversaries: Anniversary[];
  onPickIcon: (onSelect: (emoji: string) => void) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editEmoji, setEditEmoji] = useState('🎉');
  const [editMonth, setEditMonth] = useState(1);
  const [editDay, setEditDay] = useState(1);
  const [editUseStartYear, setEditUseStartYear] = useState(false);
  const [editStartYear, setEditStartYear] = useState<number | null>(null);
  const [pickingDateFor, setPickingDateFor] = useState<'new' | 'edit' | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎉');
  const [newMonth, setNewMonth] = useState(1);
  const [newDay, setNewDay] = useState(1);
  const [newUseStartYear, setNewUseStartYear] = useState(false);
  const [newStartYear, setNewStartYear] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...anniversaries].sort((a, b) => a.month - b.month || a.day - b.day || a.title.localeCompare(b.title)),
    [anniversaries],
  );

  const closeEdit = () => setEditingId(null);

  const saveNew = async () => {
    if (!newTitle.trim()) return;
    const now = new Date().toISOString();
    await runPlannerWrite(() => db.anniversaries.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      title: newTitle.trim(),
      emoji: newEmoji,
      month: newMonth,
      day: newDay,
      start_year: newUseStartYear ? newStartYear : null,
    }));
    setNewTitle('');
    setNewEmoji('🎉');
    setNewMonth(1);
    setNewDay(1);
    setNewUseStartYear(false);
    setNewStartYear(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="settings-scroll mb-4">
        <div className="space-y-2">
          {sorted.map(item => {
            const isEditing = editingId === item.id;
            return (
              <section key={item.id} className="rounded-2xl border border-line bg-surface-muted px-3 py-2.5">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => onPickIcon(setEditEmoji)} className="inline-flex rounded-lg p-1 hover:bg-surface">
                        <EmojiIcon emoji={editEmoji} className="h-5 w-6" />
                      </button>
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={event => setEditTitle(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 font-medium outline-none ring-1 ring-line-strong"
                      />
                    </div>
                    <button type="button" onClick={() => setPickingDateFor('edit')} className="w-full rounded-xl bg-surface px-3 py-2 text-left text-sm">
                      {editMonth}월 {editDay}일
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditUseStartYear(false)} className={`flex-1 rounded-xl py-2 text-sm ${!editUseStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover'}`}>주년 없음</button>
                      <button type="button" onClick={() => setEditUseStartYear(true)} className={`flex-1 rounded-xl py-2 text-sm ${editUseStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover'}`}>주년 있음</button>
                    </div>
                    {editUseStartYear && <YearOtpInput value={editStartYear} onChange={setEditStartYear} />}
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editTitle.trim()) return;
                          const now = new Date().toISOString();
                          await runPlannerWrite(() => db.anniversaries.put({
                            ...item,
                            title: editTitle.trim(),
                            emoji: editEmoji,
                            month: editMonth,
                            day: editDay,
                            start_year: editUseStartYear ? editStartYear : null,
                            updated_at: now,
                            version: item.version + 1,
                          }));
                          closeEdit();
                        }}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface"
                      >
                        저장
                      </button>
                      <button type="button" onClick={closeEdit} className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface"><X size={16} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <EmojiIcon emoji={item.emoji} className="h-5 w-6 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{item.title}</p>
                      <p className="text-xs text-fg-subtle">
                        {item.month}월 {item.day}일
                        {item.start_year != null ? ` · ${item.start_year}년부터` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditTitle(item.title);
                        setEditEmoji(item.emoji);
                        setEditMonth(item.month);
                        setEditDay(item.day);
                        setEditUseStartYear(item.start_year != null);
                        setEditStartYear(item.start_year);
                      }}
                      aria-label={`${item.title} 수정`}
                      className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface hover:text-fg"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const now = new Date().toISOString();
                        await runPlannerWrite(() => db.anniversaries.update(item.id, {
                          deleted_at: now,
                          updated_at: now,
                          version: item.version + 1,
                        }));
                      }}
                      aria-label={`${item.title} 삭제`}
                      className="rounded-lg p-1.5 text-fg-subtle hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-subtle">
            <Cake size={20} />
            등록된 기념일이 없습니다
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => onPickIcon(setNewEmoji)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface-muted">
              <EmojiIcon emoji={newEmoji} className="h-6 w-8" />
            </button>
            <input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              placeholder="새 기념일 이름"
              className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-muted px-4 outline-none focus:border-fg-subtle"
            />
          </div>
          <button type="button" onClick={() => setPickingDateFor('new')} className="w-full rounded-xl bg-surface-muted px-3 py-2.5 text-left text-sm">
            {newMonth}월 {newDay}일
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => setNewUseStartYear(false)} className={`flex-1 rounded-xl py-2 text-sm ${!newUseStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover'}`}>주년 없음</button>
            <button type="button" onClick={() => setNewUseStartYear(true)} className={`flex-1 rounded-xl py-2 text-sm ${newUseStartYear ? 'bg-ink text-on-ink' : 'bg-surface-hover'}`}>주년 있음</button>
          </div>
          {newUseStartYear && <YearOtpInput value={newStartYear} onChange={setNewStartYear} />}
          <button
            type="button"
            onClick={() => { void saveNew(); }}
            disabled={!newTitle.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-semibold text-on-ink disabled:opacity-40"
          >
            <Plus size={16} /> 기념일 추가
          </button>
        </div>
      </div>

      {pickingDateFor === 'new' && (
        <BirthdayPickerModal
          title="날짜 선택"
          clearLabel="취소"
          month={newMonth}
          day={newDay}
          onMonthChange={setNewMonth}
          onDayChange={setNewDay}
          onClose={() => setPickingDateFor(null)}
          onClear={() => setPickingDateFor(null)}
          onConfirm={() => setPickingDateFor(null)}
        />
      )}
      {pickingDateFor === 'edit' && (
        <BirthdayPickerModal
          title="날짜 선택"
          clearLabel="취소"
          month={editMonth}
          day={editDay}
          onMonthChange={setEditMonth}
          onDayChange={setEditDay}
          onClose={() => setPickingDateFor(null)}
          onClear={() => setPickingDateFor(null)}
          onConfirm={() => setPickingDateFor(null)}
        />
      )}
    </div>
  );
}
