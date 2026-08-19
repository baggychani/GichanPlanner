import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-medium text-gray-800">할 일을 삭제할까요?</h3>
        {mode === 'DELETE_ALL' ? (
          <p className="mb-6 text-sm text-gray-500">모든 할 일 <strong className="font-bold text-gray-700">({dateLabel})</strong>을 삭제합니다.</p>
        ) : (
          <p className="mb-6 text-sm text-gray-500">미완료 할 일 <strong className="font-bold text-gray-700">({dateLabel})</strong>만 삭제합니다.</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100">취소</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600">삭제</button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-medium text-gray-800">미완료 할 일이 없습니다</h3>
        <p className="mb-6 text-sm text-gray-500"><strong className="font-bold text-gray-700">{dateLabel}</strong>에는 이동하거나 삭제할 미완료 할 일이 없습니다.</p>
        <div className="flex justify-end"><button onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800">확인</button></div>
      </div>
    </div>
  );
}

export function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-8 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={src}
        alt="크게 보기"
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
      <button
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        onClick={onClose}
      >
        <X size={24} />
      </button>
    </div>
  );
}
