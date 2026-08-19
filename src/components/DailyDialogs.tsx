import { X } from 'lucide-react';
import { Overlay } from './Overlay';

export function ConfirmDailyDeleteDialog({
  mode,
  dateLabel,
  onCancel,
  onConfirm,
}: {
  mode: 'DELETE_INCOMPLETE' | 'DELETE_ALL';
  dateLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay zClassName="z-[60]" onEscape={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-medium text-fg">할 일을 삭제할까요?</h3>
        {mode === 'DELETE_ALL' ? (
          <p className="mb-6 text-sm text-fg-muted">모든 할 일 <strong className="font-bold text-fg">({dateLabel})</strong>을 삭제합니다.</p>
        ) : (
          <p className="mb-6 text-sm text-fg-muted">미완료 할 일 <strong className="font-bold text-fg">({dateLabel})</strong>만 삭제합니다.</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-hover">취소</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600">삭제</button>
        </div>
      </div>
    </Overlay>
  );
}

export function NoIncompleteNoticeDialog({
  dateLabel,
  onClose,
}: {
  dateLabel: string;
  onClose: () => void;
}) {
  return (
    <Overlay zClassName="z-[60]" onEscape={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-medium text-fg">미완료 할 일이 없습니다</h3>
        <p className="mb-6 text-sm text-fg-muted"><strong className="font-bold text-fg">{dateLabel}</strong>에는 이동하거나 삭제할 미완료 할 일이 없습니다.</p>
        <div className="flex justify-end"><button onClick={onClose} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-on-ink hover:opacity-90">확인</button></div>
      </div>
    </Overlay>
  );
}

export function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <Overlay
      zClassName="z-[100]"
      className="relative cursor-zoom-out !bg-black/80 p-8 dark:!bg-black/80"
      onEscape={onClose}
      onBackdropClick={onClose}
    >
      <img
        src={src}
        alt="크게 보기"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
      />
      <button
        className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
      >
        <X size={24} />
      </button>
    </Overlay>
  );
}
