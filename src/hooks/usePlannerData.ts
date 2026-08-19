import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../lib/db';
import { countVisibleTasksByDate } from '../lib/taskCounts';
import { repairOrphanedTasks } from '../lib/taskOps';

export function usePlannerData(optimisticTasks: Task[] | null) {
  const hasRepairedOrphanedTasks = useRef(false);

  const persistedTasks = useLiveQuery(async () => {
    const list = await db.tasks.toArray();
    return list
      .filter(t => t.deleted_at === null)
      .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));
  }) || [];
  const tasks = optimisticTasks ?? persistedTasks;

  const calendarTaskCountByDate = useLiveQuery(async () => {
    const [storedTasks, storedCategories] = await Promise.all([db.tasks.toArray(), db.domains.toArray()]);
    return countVisibleTasksByDate(storedTasks, storedCategories);
  }, []) ?? {};

  const categoryQuery = useLiveQuery(() => db.domains.filter(d => d.deleted_at === null).sortBy('order'));
  const categories = categoryQuery ?? [];
  const goals = useLiveQuery(() => db.goals.filter(g => g.deleted_at === null).toArray()) || [];
  const deadlines = useLiveQuery(() => db.deadlines.filter(deadline => deadline.deleted_at === null).toArray()) || [];

  useEffect(() => {
    if (categoryQuery === undefined || hasRepairedOrphanedTasks.current) return;
    hasRepairedOrphanedTasks.current = true;
    void repairOrphanedTasks(categoryQuery.map(category => category.id));
  }, [categoryQuery]);

  return { tasks, categories, goals, deadlines, calendarTaskCountByDate };
}
