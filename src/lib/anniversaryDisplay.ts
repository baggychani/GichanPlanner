import type { Anniversary } from './db';

export function isSameAnniversaryDate(date: Date, month: number, day: number) {
  return date.getMonth() + 1 === month && date.getDate() === day;
}

export function anniversariesOnDate(anniversaries: Anniversary[], date: Date) {
  return anniversaries.filter(item =>
    item.deleted_at === null && isSameAnniversaryDate(date, item.month, item.day),
  );
}

export function anniversaryYearSuffix(startYear: number | null, date: Date) {
  if (startYear == null) return null;
  const years = date.getFullYear() - startYear;
  if (years < 0) return null;
  if (years === 0) return '원년';
  return `${years}주년`;
}

export function anniversaryPanelLabel(item: Anniversary, date: Date) {
  const suffix = anniversaryYearSuffix(item.start_year, date);
  return suffix ? `${item.title} · ${suffix}` : item.title;
}
