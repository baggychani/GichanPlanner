/** 칸 높이 102px일 때 보이는 치수. 이보다 커져도 키우지 않는다. */
export const CALENDAR_CELL_DESIGN = {
  height: 102,
  date: 32,
  dateFont: 16,
  bubble: 28,
  bubbleFont: 14,
  bubblePadX: 8,
  pad: 6,
  gap: 6,
  icon: 18,
} as const;

export type CalendarCellMetrics = {
  date: number;
  dateFont: number;
  bubble: number;
  bubbleFont: number;
  bubblePadX: number;
  pad: number;
  gap: number;
  icon: number;
};

const DESIGN_STACK =
  CALENDAR_CELL_DESIGN.pad
  + CALENDAR_CELL_DESIGN.date
  + CALENDAR_CELL_DESIGN.gap
  + CALENDAR_CELL_DESIGN.bubble
  + CALENDAR_CELL_DESIGN.pad;

function clampRound(value: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, value)));
}

export function calendarCellMetrics(cellHeight: number, cellWidth: number): CalendarCellMetrics {
  const design = CALENDAR_CELL_DESIGN;
  if (!(cellHeight > 0) || !(cellWidth > 0) || cellHeight >= design.height) {
    return {
      date: design.date,
      dateFont: design.dateFont,
      bubble: design.bubble,
      bubbleFont: design.bubbleFont,
      bubblePadX: design.bubblePadX,
      pad: design.pad,
      gap: design.gap,
      icon: design.icon,
    };
  }

  // 설계 스택(78px)이 102px 칸의 76%를 쓰던 비율을 유지한다.
  const targetStack = cellHeight * (DESIGN_STACK / design.height);
  const boxScale = Math.max(0.56, targetStack / DESIGN_STACK);

  let pad = clampRound(design.pad * boxScale, 3, design.pad);
  let gap = clampRound(design.gap * boxScale, 2, design.gap);
  let date = clampRound(design.date * boxScale, 18, design.date);
  let bubble = clampRound(design.bubble * boxScale, 14, design.bubble);
  let icon = clampRound(design.icon * boxScale, 12, design.icon);
  let bubblePadX = clampRound(design.bubblePadX * boxScale, 4, design.bubblePadX);

  const maxBubble = Math.floor((cellWidth - pad * 2 - gap - 2) / 2);
  if (maxBubble > 0 && bubble > maxBubble) {
    const squeeze = maxBubble / bubble;
    bubble = Math.max(14, maxBubble);
    date = clampRound(date * Math.min(1, squeeze * 1.04), 18, date);
    icon = clampRound(icon * squeeze, 12, icon);
    bubblePadX = clampRound(bubblePadX * squeeze, 3, bubblePadX);
  }

  const stack = pad + date + gap + bubble + pad;
  if (stack > cellHeight - 1) {
    const fit = (cellHeight - 1) / stack;
    date = clampRound(date * fit, 16, date);
    bubble = clampRound(bubble * fit, 13, bubble);
    pad = clampRound(pad * fit, 2, pad);
    gap = clampRound(gap * fit, 1, gap);
    icon = clampRound(icon * fit, 11, icon);
  }

  return {
    date,
    dateFont: clampRound(date * (design.dateFont / design.date), 10, design.dateFont),
    bubble,
    bubbleFont: clampRound(bubble * (design.bubbleFont / design.bubble), 9, design.bubbleFont),
    bubblePadX,
    pad,
    gap,
    icon,
  };
}

export function applyCalendarCellMetrics(target: HTMLElement, metrics: CalendarCellMetrics) {
  target.style.setProperty('--cal-date', `${metrics.date}px`);
  target.style.setProperty('--cal-date-font', `${metrics.dateFont}px`);
  target.style.setProperty('--cal-bubble', `${metrics.bubble}px`);
  target.style.setProperty('--cal-bubble-font', `${metrics.bubbleFont}px`);
  target.style.setProperty('--cal-bubble-px', `${metrics.bubblePadX}px`);
  target.style.setProperty('--cal-pad', `${metrics.pad}px`);
  target.style.setProperty('--cal-gap', `${metrics.gap}px`);
  target.style.setProperty('--cal-icon', `${metrics.icon}px`);
}
