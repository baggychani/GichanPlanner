import { useState } from 'react';
import { FolderKanban, X } from 'lucide-react';
import { db } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { Overlay } from './Overlay';
import { EmojiIcon } from './EmojiIcon';

const PROJECT_ICONS = ['📁', '🎯', '💻', '📚', '🗣️', '📝', '🏠', '💼', '🧪', '✈️'];

type ProjectCreateModalProps = {
  nextOrder: number;
  onClose: () => void;
  onCreated: () => void;
};

export function ProjectCreateModal({ nextOrder, onClose, onCreated }: ProjectCreateModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📁');

  const save = async () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    await runPlannerWrite(() => db.projects.add({
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      title: title.trim(),
      icon,
      domain_id: null,
      due_date: null,
      order: nextOrder,
    }));
    onCreated();
  };

  return (
    <Overlay onEscape={onClose}>
      <div className="flex w-[420px] max-w-full flex-col rounded-3xl bg-surface shadow-xl">
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2 text-fg">
            <FolderKanban size={20} />
            <h3 className="text-lg font-medium">프로젝트 만들기</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="프로젝트 만들기 닫기" className="rounded-full p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-subtle">제목</label>
            <input
              autoFocus
              value={title}
              onChange={event => setTitle(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void save();
                }
              }}
              placeholder="묶을 일의 이름을 적어주세요"
              className="w-full rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-line-strong"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-subtle">아이콘</label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICONS.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setIcon(candidate)}
                  aria-pressed={icon === candidate}
                  aria-label={`${candidate} 아이콘`}
                  className={icon === candidate ? 'grid h-11 w-11 place-items-center rounded-xl bg-primary/30' : 'grid h-11 w-11 place-items-center rounded-xl bg-surface-muted hover:bg-surface-hover'}
                >
                  <EmojiIcon emoji={candidate} className="h-6 w-6" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-surface-hover px-4 py-3 font-bold text-fg-muted hover:bg-line-strong">
            취소
          </button>
          <button
            type="button"
            onClick={() => { void save(); }}
            disabled={!title.trim()}
            className="rounded-xl bg-ink px-5 py-3 font-bold text-on-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            만들기
          </button>
        </div>
      </div>
    </Overlay>
  );
}
