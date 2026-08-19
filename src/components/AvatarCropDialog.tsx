import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Overlay } from './Overlay';

const CROP_SIZE = 320;

type ImageMetrics = { width: number; height: number; baseScale: number };

function clampOffset(value: number, renderedLength: number) {
  return Math.min(0, Math.max(CROP_SIZE - renderedLength, value));
}

export function AvatarCropDialog({ file, onClose, onSave }: {
  file: File;
  onClose: () => void;
  onSave: (image: Blob) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      const baseScale = Math.max(CROP_SIZE / probe.naturalWidth, CROP_SIZE / probe.naturalHeight);
      setMetrics({ width: probe.naturalWidth, height: probe.naturalHeight, baseScale });
      setOffset({ x: (CROP_SIZE - probe.naturalWidth * baseScale) / 2, y: (CROP_SIZE - probe.naturalHeight * baseScale) / 2 });
      setSourceUrl(url);
    };
    probe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const scaled = metrics && { width: metrics.width * metrics.baseScale * zoom, height: metrics.height * metrics.baseScale * zoom };
  const reset = () => {
    if (!metrics) return;
    setZoom(1);
    setOffset({ x: (CROP_SIZE - metrics.width * metrics.baseScale) / 2, y: (CROP_SIZE - metrics.height * metrics.baseScale) / 2 });
  };
  const setZoomSafely = (nextZoom: number) => {
    if (!metrics) return;
    const previousWidth = metrics.width * metrics.baseScale * zoom;
    const previousHeight = metrics.height * metrics.baseScale * zoom;
    const nextWidth = metrics.width * metrics.baseScale * nextZoom;
    const nextHeight = metrics.height * metrics.baseScale * nextZoom;
    // Keep the image point below the crop centre fixed while changing magnification.
    const nextOffset = {
      x: clampOffset(CROP_SIZE / 2 - ((CROP_SIZE / 2 - offset.x) / previousWidth) * nextWidth, nextWidth),
      y: clampOffset(CROP_SIZE / 2 - ((CROP_SIZE / 2 - offset.y) / previousHeight) * nextHeight, nextHeight),
    };
    setZoom(nextZoom); setOffset(nextOffset);
  };
  const crop = () => {
    if (!image.current || !scaled) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.beginPath(); context.arc(256, 256, 256, 0, Math.PI * 2); context.clip();
    const factor = 512 / CROP_SIZE;
    context.drawImage(image.current, offset.x * factor, offset.y * factor, scaled.width * factor, scaled.height * factor);
    canvas.toBlob(blob => { if (blob) onSave(blob); }, 'image/webp', 0.9);
  };

  return (
    <Overlay zClassName="z-[80]">
      <section aria-label="프로필 사진 조절" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">프로필 사진 조절</h2><p className="mt-1 text-sm text-fg-muted">사진을 드래그하고 확대해서 원 안에 맞추세요.</p></div><button onClick={onClose} aria-label="사진 조절 닫기" className="rounded-full p-2 hover:bg-surface-hover"><X size={20} /></button></div>
        <div
          className="relative mx-auto h-80 w-80 touch-none overflow-hidden rounded-full bg-surface-muted shadow-inner"
          onPointerDown={event => { if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; }}
          onPointerMove={event => { if (!drag.current || !scaled) return; setOffset({ x: clampOffset(drag.current.offsetX + event.clientX - drag.current.x, scaled.width), y: clampOffset(drag.current.offsetY + event.clientY - drag.current.y, scaled.height) }); }}
          onPointerUp={() => { drag.current = null; }}
        >
          {sourceUrl && scaled && <img ref={image} src={sourceUrl} alt="자르기 미리보기" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: offset.x, top: offset.y, width: scaled.width, height: scaled.height }} />}
          {!sourceUrl && <div className="grid h-full place-items-center text-sm text-fg-muted">사진을 불러오는 중…</div>}
        </div>
        <div className="mt-6 flex items-center gap-3"><span className="text-sm text-fg-muted">축소</span><input aria-label="사진 확대 비율" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoomSafely(Number(event.target.value))} className="flex-1 accent-indigo-600" /><span className="text-sm text-fg-muted">확대</span></div>
        <div className="mt-6 flex gap-3"><button onClick={reset} className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-surface-muted"><RotateCcw size={16} />초기화</button><button onClick={crop} disabled={!metrics} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink py-3 font-semibold text-on-ink disabled:opacity-40"><Check size={17} />이 사진 사용</button></div>
      </section>
    </Overlay>
  );
}
