import { addDays, endOfMonth, format, max as maxDate, min as minDate, startOfMonth, subDays } from 'date-fns';
import { db, type Routine, type Task } from './db';
import { deadlineOnDate } from './datetime';
import { encodeRecurrenceRule, parseRecurrenceRule, routineDatesInRange, type RecurrenceRule } from './recurrence';
import { createBlankTask, nextOrderFor } from './taskOps';
import { pushTasksBatch, runPlannerWrite } from './supabaseSync';

export type RoutineDraft = {
  title: string;
  domain_id: string | null;
  start_date: string;
  end_date: string;
  freq: RecurrenceRule['freq'];
  weekdays: number[];
  scheduled_time: string | null;
  is_important: boolean;
};

function ymd(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

async function routineInstanceId(routineId: string, date: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`gichan-routine:${routineId}:${date}`));
  const bytes = new Uint8Array(digest).subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function createRoutine(draft: RoutineDraft) {
  const title = draft.title.trim();
  if (!title) return;
  const now = new Date().toISOString();
  const weekdays = draft.freq === 'weekly' || draft.freq === 'biweekly' ? draft.weekdays : [];
  const routine: Routine = {
    id: crypto.randomUUID(),
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title,
    domain_id: draft.domain_id,
    recurrence_rule: encodeRecurrenceRule({ freq: draft.freq, weekdays }),
    start_date: draft.start_date,
    end_date: draft.end_date,
    scheduled_time: draft.scheduled_time,
    is_important: draft.is_important,
  };
  await runPlannerWrite(async () => {
    await db.routines.add(routine);
    const added = await fillRoutineTasks([routine], new Date(draft.start_date + 'T00:00:00'));
    if (added.length > 0) void pushTasksBatch(added);
  });
}

export async function materializeRoutines(viewedMonth: Date) {
  const routines = await db.routines.filter(routine => routine.deleted_at === null).toArray();
  if (routines.length === 0) return;
  const added = await runPlannerWrite(() => fillRoutineTasks(routines, viewedMonth));
  if (added.length > 0) void pushTasksBatch(added);
}

async function fillRoutineTasks(routines: Routine[], viewedMonth: Date): Promise<Task[]> {
  const today = new Date();
  const rangeStart = ymd(minDate([subDays(today, 7), startOfMonth(viewedMonth)]));
  const rangeEnd = ymd(maxDate([addDays(today, 90), endOfMonth(viewedMonth)]));
  const allTasks = await db.tasks.toArray();
  const existing = new Set(
    allTasks
      .filter(task => task.routine_id)
      .map(task => `${task.routine_id}:${task.target_date}`),
  );
  const existingIds = new Set(allTasks.map(task => task.id));
  const liveTasks = allTasks.filter(task => task.deleted_at === null);
  const toAdd = [];
  for (const routine of routines) {
    const rule = parseRecurrenceRule(routine.recurrence_rule);
    const dates = routineDatesInRange(routine.start_date, routine.end_date, rule, rangeStart, rangeEnd);
    for (const date of dates) {
      const key = `${routine.id}:${date}`;
      if (existing.has(key)) continue;
      const id = await routineInstanceId(routine.id, date);
      if (existingIds.has(id)) continue;
      existing.add(key);
      existingIds.add(id);
      const order = nextOrderFor([...liveTasks, ...toAdd], date, routine.domain_id);
      const task = {
        ...createBlankTask(date),
        id,
        title: routine.title,
        domain_id: routine.domain_id,
        scheduled_time: deadlineOnDate(routine.scheduled_time, date),
        routine_id: routine.id,
        is_important: routine.is_important ?? false,
        order,
      };
      toAdd.push(task);
    }
  }
  if (toAdd.length > 0) await db.tasks.bulkPut(toAdd);
  return toAdd;
}

export type RoutineRemovalScope = 'future' | 'all';

export async function removeRoutine(routineId: string, scope: RoutineRemovalScope = 'future') {
  const today = ymd(new Date());
  return runPlannerWrite(async () => {
    const routine = await db.routines.get(routineId);
    if (!routine || routine.deleted_at !== null) return;
    const now = new Date().toISOString();
    await db.routines.update(routineId, { deleted_at: now, updated_at: now, version: routine.version + 1 });
    const linked = await db.tasks.filter(task => task.routine_id === routineId).toArray();
    const targets = linked.filter(task => {
      if (task.deleted_at !== null) return false;
      return scope === 'all' || task.target_date >= today;
    });
    if (targets.length > 0) {
      await db.tasks.bulkPut(targets.map(task => ({
        ...task,
        deleted_at: now,
        updated_at: now,
        version: task.version + 1,
      })));
    }
  });
}

export async function stopRoutine(routineId: string) {
  return removeRoutine(routineId, 'future');
}
