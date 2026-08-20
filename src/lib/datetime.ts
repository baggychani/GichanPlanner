import { parse, parseISO } from 'date-fns';

export type Meridiem = 'AM' | 'PM';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(ymd: string): Date {
  return parse(ymd, 'yyyy-MM-dd', new Date());
}

export function parseDateValue(value: string): Date {
  return DAY_PATTERN.test(value) ? parseDay(value) : parseISO(value);
}

export function deadlineOnDate(value: string | null, targetDate: string): string | null {
  if (!value) return null;
  const original = parseDateValue(value);
  const next = parseDay(targetDate);
  next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return next.toISOString();
}

export function formatScheduledTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hours = date.getHours();
  const meridiem: Meridiem = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${meridiem} ${hour12}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timePartsFromDate(date: Date): { meridiem: Meridiem; hour: number; minute: number } {
  const roundedMinutes = Math.round(date.getMinutes() / 5) * 5;
  const hours = (date.getHours() + (roundedMinutes === 60 ? 1 : 0)) % 24;
  return {
    meridiem: hours >= 12 ? 'PM' : 'AM',
    hour: hours % 12 || 12,
    minute: roundedMinutes === 60 ? 0 : roundedMinutes,
  };
}

export function isoFromTimeParts(targetDate: string, meridiem: Meridiem, hour: number, minute: number): string {
  const date = parseDay(targetDate);
  const hours = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  date.setHours(hours, minute, 0, 0);
  return date.toISOString();
}

export function isSameBirthday(date: Date, month: number | null | undefined, day: number | null | undefined): boolean {
  return month != null && day != null && date.getMonth() + 1 === month && date.getDate() === day;
}
