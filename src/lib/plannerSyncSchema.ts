import { db, type Anniversary, type Deadline, type Domain, type Goal, type Profile, type Project, type Routine, type Schedule, type Task } from './db';

export const PLANNER_SYNC_TABLES = ['tasks', 'schedules', 'routines', 'anniversaries', 'domains', 'goals', 'deadlines', 'projects'] as const;
export type PlannerSyncTable = (typeof PLANNER_SYNC_TABLES)[number];

type AssertCovered<T> = [T] extends [never] ? true : T;

export type RemoteStamp = {
  id: string;
  revision?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function versionFrom(row: RemoteStamp) {
  return row.revision ?? 1;
}

function stampRow(row: { id: string; version: number; created_at: string; updated_at: string; deleted_at: string | null }, ownerId: string) {
  return {
    id: row.id,
    owner_id: ownerId,
    revision: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function taskRow(task: Task, ownerId: string, imagePath: string | null) {
  return {
    ...stampRow(task, ownerId),
    title: task.title,
    target_date: task.target_date,
    deadline: task.deadline,
    scheduled_time: task.scheduled_time,
    domain_id: task.domain_id,
    goal_id: task.goal_id,
    project_id: task.project_id ?? null,
    routine_id: task.routine_id ?? null,
    is_important: task.is_important,
    is_completed: task.is_completed,
    memo: task.memo,
    order: task.order,
    image_path: imagePath,
  };
}

export type RemoteTask = RemoteStamp & {
  title: string;
  target_date: string;
  deadline: string | null;
  scheduled_time: string | null;
  domain_id: string | null;
  goal_id: string | null;
  project_id: string | null;
  routine_id: string | null;
  is_important: boolean;
  is_completed: boolean;
  memo: string;
  order: number;
  image_path: string | null;
};

export function taskFromRemote(row: RemoteTask, imageBlob: Blob | null): Task {
  return {
    id: row.id,
    version: versionFrom(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    title: row.title,
    target_date: row.target_date,
    deadline: row.deadline,
    scheduled_time: row.scheduled_time,
    domain_id: row.domain_id,
    goal_id: row.goal_id,
    project_id: row.project_id ?? null,
    routine_id: row.routine_id ?? null,
    is_important: row.is_important,
    is_completed: row.is_completed,
    memo: row.memo ?? '',
    order: row.order ?? 0,
    image_blob: imageBlob,
    image_data: null,
    image_path: row.image_path ?? null,
  };
}

export function domainRow(domain: Domain, ownerId: string) {
  return {
    ...stampRow(domain, ownerId),
    name: domain.name,
    icon: domain.icon,
    color: domain.color,
    order: domain.order,
    is_archived: domain.is_archived,
  };
}

export function domainFromRemote(row: RemoteStamp & Domain): Domain {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    name: row.name, icon: row.icon, color: row.color, order: row.order, is_archived: row.is_archived,
  };
}

export function projectRow(project: Project, ownerId: string) {
  return {
    ...stampRow(project, ownerId),
    title: project.title,
    icon: project.icon,
    domain_id: project.domain_id,
    due_date: project.due_date,
    order: project.order,
  };
}

export function projectFromRemote(row: RemoteStamp & Project): Project {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, icon: row.icon, domain_id: row.domain_id ?? null, due_date: row.due_date ?? null, order: row.order ?? 0,
  };
}

export function goalRow(goal: Goal, ownerId: string) {
  return {
    ...stampRow(goal, ownerId),
    domain_id: goal.domain_id,
    time_frame: goal.time_frame,
    start_date: goal.start_date,
    end_date: goal.end_date,
    title: goal.title,
    is_completed: goal.is_completed,
  };
}

export function goalFromRemote(row: RemoteStamp & Goal): Goal {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    domain_id: row.domain_id, time_frame: row.time_frame, start_date: row.start_date, end_date: row.end_date,
    title: row.title, is_completed: row.is_completed,
  };
}

export function deadlineRow(deadline: Deadline, ownerId: string) {
  return {
    ...stampRow(deadline, ownerId),
    title: deadline.title,
    memo: deadline.memo,
    due_date: deadline.due_date,
    due_time: deadline.due_time,
    reminder_days: deadline.reminder_days,
    project_id: deadline.project_id ?? null,
  };
}

export function deadlineFromRemote(row: RemoteStamp & Deadline): Deadline {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, memo: row.memo, due_date: row.due_date, due_time: row.due_time ?? null, reminder_days: row.reminder_days,
    project_id: row.project_id ?? null,
  };
}

export function scheduleRow(schedule: Schedule, ownerId: string) {
  return {
    ...stampRow(schedule, ownerId),
    title: schedule.title,
    target_date: schedule.target_date,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    domain_id: schedule.domain_id,
  };
}

export function scheduleFromRemote(row: RemoteStamp & Schedule): Schedule {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, target_date: row.target_date, start_time: row.start_time, end_time: row.end_time, domain_id: row.domain_id,
  };
}

export function routineRow(routine: Routine, ownerId: string) {
  return {
    ...stampRow(routine, ownerId),
    title: routine.title,
    domain_id: routine.domain_id,
    recurrence_rule: routine.recurrence_rule,
    start_date: routine.start_date,
    end_date: routine.end_date ?? null,
    scheduled_time: routine.scheduled_time ?? null,
    is_important: routine.is_important ?? false,
  };
}

export function routineFromRemote(row: RemoteStamp & Routine): Routine {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, domain_id: row.domain_id, recurrence_rule: row.recurrence_rule, start_date: row.start_date,
    end_date: row.end_date ?? null, scheduled_time: row.scheduled_time ?? null, is_important: row.is_important ?? false,
  };
}

export function anniversaryRow(anniversary: Anniversary, ownerId: string) {
  return {
    ...stampRow(anniversary, ownerId),
    title: anniversary.title,
    emoji: anniversary.emoji,
    month: anniversary.month,
    day: anniversary.day,
    start_year: anniversary.start_year,
  };
}

export function anniversaryFromRemote(row: RemoteStamp & Anniversary): Anniversary {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, emoji: row.emoji, month: row.month, day: row.day, start_year: row.start_year ?? null,
  };
}

type CloudExtras = 'owner_id' | 'revision';
type SyncedLocal<T> = Exclude<keyof T, 'version' | 'image_blob' | 'image_data' | 'avatar' | 'legacy_dexie_user_id' | 'email'>;
type MissingFromCloud<T, Cloud> = Exclude<SyncedLocal<T>, Exclude<keyof Cloud, CloudExtras>>;

const _taskCovered: AssertCovered<MissingFromCloud<Task, ReturnType<typeof taskRow>>> = true;
const _domainCovered: AssertCovered<MissingFromCloud<Domain, ReturnType<typeof domainRow>>> = true;
const _projectCovered: AssertCovered<MissingFromCloud<Project, ReturnType<typeof projectRow>>> = true;
const _goalCovered: AssertCovered<MissingFromCloud<Goal, ReturnType<typeof goalRow>>> = true;
const _deadlineCovered: AssertCovered<MissingFromCloud<Deadline, ReturnType<typeof deadlineRow>>> = true;
const _scheduleCovered: AssertCovered<MissingFromCloud<Schedule, ReturnType<typeof scheduleRow>>> = true;
const _routineCovered: AssertCovered<MissingFromCloud<Routine, ReturnType<typeof routineRow>>> = true;
const _anniversaryCovered: AssertCovered<MissingFromCloud<Anniversary, ReturnType<typeof anniversaryRow>>> = true;
void _taskCovered; void _domainCovered; void _projectCovered; void _goalCovered;
void _deadlineCovered; void _scheduleCovered; void _routineCovered; void _anniversaryCovered;

type ProfileCloud = {
  id: string;
  nickname: string;
  birthday_month: number | null;
  birthday_day: number | null;
  created_at: string;
  updated_at: string;
  avatar_path?: string | null;
};
const _profileCovered: AssertCovered<MissingFromCloud<Profile, ProfileCloud>> = true;
void _profileCovered;

export const SIMPLE_SYNC_TABLES = [
  { name: 'domains' as const, table: db.domains, toRow: domainRow, fromRemote: domainFromRemote },
  { name: 'projects' as const, table: db.projects, toRow: projectRow, fromRemote: projectFromRemote },
  { name: 'goals' as const, table: db.goals, toRow: goalRow, fromRemote: goalFromRemote },
  { name: 'deadlines' as const, table: db.deadlines, toRow: deadlineRow, fromRemote: deadlineFromRemote },
  { name: 'schedules' as const, table: db.schedules, toRow: scheduleRow, fromRemote: scheduleFromRemote },
  { name: 'routines' as const, table: db.routines, toRow: routineRow, fromRemote: routineFromRemote },
  { name: 'anniversaries' as const, table: db.anniversaries, toRow: anniversaryRow, fromRemote: anniversaryFromRemote },
];

type SimpleName = (typeof SIMPLE_SYNC_TABLES)[number]['name'];
type CoveredTables = 'tasks' | SimpleName;
const _allTables: AssertCovered<Exclude<PlannerSyncTable, CoveredTables> | Exclude<CoveredTables, PlannerSyncTable>> = true;
void _allTables;

export function plannerWriteTables() {
  return [db.tasks, db.domains, db.goals, db.deadlines, db.schedules, db.routines, db.anniversaries, db.projects, db.profiles, db.cloudShadows] as const;
}
