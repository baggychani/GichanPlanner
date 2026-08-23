import { useState } from 'react';
import { FolderKanban, X } from 'lucide-react';
import { db } from '../lib/db';
import { runPlannerWrite } from '../lib/supabaseSync';
import { Overlay } from './Overlay';
import { EmojiPickerOverlay } from './EmojiPickerOverlay';
import { EmojiIcon } from './EmojiIcon';

type ProjectCreateModalProps = {
  nextOrder: number;
  onClose: () => void;
  onCreated: () => void;
};

export function ProjectCreateModal({ nextOrder, onClose, onCreated }: ProjectCreateModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📁');
  const [pickingIcon, setPickingIcon] = useState(false);

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
    <>
    <Overlay onEscape={pickingIcon ? undefined : onClose}>
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
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPickingIcon(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface-muted hover:bg-surface-hover"
              aria-label="프로젝트 아이콘 선택"
            >
              <EmojiIcon emoji={icon} className="h-7 w-7" />
            </button>
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
              placeholder="프로젝트의 이름을 적어주세요"
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-surface-muted p-3 text-base font-medium outline-none focus:border-line-strong"
            />
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
    {pickingIcon && (
      <EmojiPickerOverlay
        onClose={() => setPickingIcon(false)}
        onSelect={(emoji) => { setIcon(emoji); setPickingIcon(false); }}
      />
    )}
    </>
  );
}
