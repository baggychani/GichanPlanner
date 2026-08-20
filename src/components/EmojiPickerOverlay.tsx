import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { emojiCategories, flagNameByEmoji } from '../lib/emojis';
import { EmojiIcon } from './EmojiIcon';
import { Overlay } from './Overlay';

export function EmojiPickerOverlay({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<(typeof emojiCategories)[number]['id']>(emojiCategories[0].id);
  const [flagTooltip, setFlagTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const selectedEmojiSet = useMemo(
    () => emojiCategories.find(category => category.id === selectedEmojiCategory) ?? emojiCategories[0],
    [selectedEmojiCategory],
  );

  return (
    <>
      <Overlay zClassName="z-[70]" onEscape={onClose} onBackdropClick={onClose}>
        <div className="flex h-[min(430px,80vh)] w-[min(680px,92vw)] flex-col rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-medium text-fg">아이콘 선택</span>
            <button type="button" onClick={onClose} aria-label="아이콘 선택 닫기" className="p-1 text-fg-subtle hover:text-fg"><X size={16} /></button>
          </div>
          <div className="mb-4 grid grid-cols-5 gap-1.5">
            {emojiCategories.map(category => (
              <button key={category.id} type="button" onClick={() => setSelectedEmojiCategory(category.id)} className={clsx('flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors', selectedEmojiSet.id === category.id ? 'bg-primary/30 text-fg' : 'text-fg-muted hover:bg-surface-hover')}>
                <EmojiIcon emoji={category.icon} className="h-4 w-5" /> {category.id}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {(selectedEmojiSet.sections ?? [{ id: selectedEmojiSet.id, label: '', emojis: selectedEmojiSet.emojis }]).map(group => (
              <div key={group.id} className="mb-3 last:mb-0">
                {group.label && <p className="mb-1.5 px-1 text-xs font-medium text-fg-subtle">{group.label}</p>}
                <div className="grid grid-cols-10 gap-1.5">
                  {group.emojis.map(emoji => {
                    const flagName = flagNameByEmoji[emoji];
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSelect(emoji)}
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
      </Overlay>
      {flagTooltip && (
        <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl" style={{ left: flagTooltip.x, top: flagTooltip.y }}>
          {flagTooltip.label}
        </div>
      )}
    </>
  );
}
