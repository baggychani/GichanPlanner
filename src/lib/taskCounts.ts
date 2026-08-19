import type { Domain, Task } from './db';

export type DayTaskCounts = {
  active: number;
  important: number;
  completedActive: number;
  completedImportant: number;
};

export const EMPTY_DAY_COUNTS: DayTaskCounts = {
  active: 0,
  important: 0,
  completedActive: 0,
  completedImportant: 0,
};

export function countVisibleTasksByDate(tasks: Task[], categories: Domain[]): Record<string, DayTaskCounts> {
  const countByDate: Record<string, DayTaskCounts> = {};
  const visibleDomainIds = new Set(categories.filter(category => category.deleted_at === null).map(category => category.id));

  for (const task of tasks) {
    const isVisible = task.domain_id === null || visibleDomainIds.has(task.domain_id);
    if (task.deleted_at !== null || !isVisible) continue;
    const counts = countByDate[task.target_date] ?? { ...EMPTY_DAY_COUNTS };
    if (task.is_completed) {
      if (task.is_important) counts.completedImportant += 1;
      else counts.completedActive += 1;
    } else if (task.is_important) counts.important += 1;
    else counts.active += 1;
    countByDate[task.target_date] = counts;
  }

  return countByDate;
}

export function isDayCleared(counts: DayTaskCounts): boolean {
  return counts.important === 0 && counts.active === 0 && (counts.completedImportant > 0 || counts.completedActive > 0);
}
