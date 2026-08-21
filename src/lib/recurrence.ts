import {
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  isAfter,
  isBefore,
  startOfWeek,
} from 'date-fns';
import { parseDay } from './datetime';

export type RecurrenceFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  weekdays: number[];
};

export const WEEKDAY_OPTIONS = [
  { iso: 1, label: '월' },
  { iso: 2, label: '화' },
  { iso: 3, label: '수' },
  { iso: 4, label: '목' },
  { iso: 5, label: '금' },
  { iso: 6, label: '토' },
  { iso: 7, label: '일' },
] as const;

export const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'biweekly', label: '격주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
];

function ymd(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function weekdaysOrStart(rule: RecurrenceRule, start: Date) {
  return rule.weekdays.length > 0 ? rule.weekdays : [getISODay(start)];
}

export function encodeRecurrenceRule(rule: RecurrenceRule): string {
  return JSON.stringify({
    freq: rule.freq,
    weekdays: rule.freq === 'weekly' || rule.freq === 'biweekly' ? rule.weekdays : [],
  });
}

export function parseRecurrenceRule(raw: string): RecurrenceRule {
  try {
    const parsed = JSON.parse(raw) as { freq?: string; weekdays?: unknown };
    const freq = parsed.freq;
    if (freq === 'daily' || freq === 'weekly' || freq === 'biweekly' || freq === 'monthly' || freq === 'yearly') {
      const weekdays = Array.isArray(parsed.weekdays)
        ? parsed.weekdays.filter((day): day is number => typeof day === 'number' && day >= 1 && day <= 7)
        : [];
      return { freq, weekdays };
    }
  } catch {
    // 예전 빈 값이나 깨진 규칙은 매일로 둔다.
  }
  return { freq: 'daily', weekdays: [] };
}

export function routineOccursOn(date: Date, start: Date, rule: RecurrenceRule): boolean {
  if (ymd(date) < ymd(start)) return false;
  switch (rule.freq) {
    case 'daily':
      return true;
    case 'weekly':
      return weekdaysOrStart(rule, start).includes(getISODay(date));
    case 'biweekly': {
      if (!weekdaysOrStart(rule, start).includes(getISODay(date))) return false;
      const startWeek = startOfWeek(start, { weekStartsOn: 1 });
      const dateWeek = startOfWeek(date, { weekStartsOn: 1 });
      return differenceInCalendarWeeks(dateWeek, startWeek, { weekStartsOn: 1 }) % 2 === 0;
    }
    case 'monthly': {
      const want = start.getDate();
      return date.getDate() === Math.min(want, endOfMonth(date).getDate());
    }
    case 'yearly': {
      const month = start.getMonth();
      const day = start.getDate();
      if (month === 1 && day === 29) {
        return date.getMonth() === 1 && date.getDate() === Math.min(29, endOfMonth(new Date(date.getFullYear(), 1, 1)).getDate());
      }
      return date.getMonth() === month && date.getDate() === day;
    }
  }
}

export function routineDatesInRange(
  startYmd: string,
  endYmd: string | null,
  rule: RecurrenceRule,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const start = parseDay(startYmd);
  const hardEnd = endYmd ? parseDay(endYmd) : parseDay(rangeEnd);
  const from = parseDay(rangeStart);
  const to = parseDay(rangeEnd);
  const begin = isAfter(from, start) ? from : start;
  const finish = isBefore(to, hardEnd) ? to : hardEnd;
  if (ymd(begin) > ymd(finish)) return [];
  return eachDayOfInterval({ start: begin, end: finish })
    .filter(date => routineOccursOn(date, start, rule))
    .map(ymd);
}
