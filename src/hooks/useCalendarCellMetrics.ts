import { useLayoutEffect, useRef } from 'react';
import { applyCalendarCellMetrics, calendarCellMetrics } from '../lib/calendarScale';

export function useCalendarCellMetrics(weekCount: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body || weekCount < 1) return;

    const apply = () => {
      applyCalendarCellMetrics(
        root,
        calendarCellMetrics(body.clientHeight / weekCount, body.clientWidth / 7),
      );
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(body);
    return () => observer.disconnect();
  }, [weekCount]);

  return { rootRef, bodyRef };
}
