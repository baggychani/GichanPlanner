import { db, type CloudShadow, type Deadline, type Domain, type Goal, type Profile, type Project, type Routine, type Schedule, type Task } from './db';
import type { PlannerSyncTable } from './plannerSyncSchema';

export type { CloudShadow };

type MergeRow = { id: string; updated_at: string; version?: number };

export function isNewer(candidate: { updated_at: string; version?: number }, current: { updated_at: string; version?: number }) {
  const candidateTime = Date.parse(candidate.updated_at);
  const currentTime = Date.parse(current.updated_at);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return (candidate.version ?? 0) > (current.version ?? 0);
}

function sameValue(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  if (typeof left === 'object' || typeof right === 'object') {
    try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
  }
  return false;
}

export function threeWayMerge<T extends MergeRow>(
  base: T | undefined,
  local: T,
  remote: T,
  keys: readonly (keyof T)[],
): T {
  if (!base) return isNewer(local, remote) ? local : remote;
  const newer = isNewer(local, remote) ? local : remote;
  const result = { ...newer };
  let mixed = false;
  for (const key of keys) {
    const fromBase = base[key];
    const fromLocal = local[key];
    const fromRemote = remote[key];
    let next: T[typeof key];
    if (sameValue(fromLocal, fromRemote)) next = fromLocal;
    else if (sameValue(fromLocal, fromBase)) next = fromRemote;
    else if (sameValue(fromRemote, fromBase)) next = fromLocal;
    else next = newer[key];
    if (!sameValue(next, newer[key])) mixed = true;
    result[key] = next;
  }
  if (mixed) {
    result.updated_at = new Date().toISOString();
    result.version = Math.max(local.version ?? 1, remote.version ?? 1) + 1;
  }
  return result;
}

export const TASK_MERGE_KEYS = [
  'title', 'target_date', 'deadline', 'scheduled_time', 'domain_id', 'goal_id', 'project_id',
  'routine_id', 'is_important', 'is_completed', 'memo', 'order', 'deleted_at', 'image_path',
] as const satisfies readonly (keyof Task)[];

export const DOMAIN_MERGE_KEYS = ['name', 'icon', 'color', 'order', 'is_archived', 'deleted_at'] as const satisfies readonly (keyof Domain)[];
export const PROJECT_MERGE_KEYS = ['title', 'icon', 'domain_id', 'due_date', 'order', 'deleted_at'] as const satisfies readonly (keyof Project)[];
export const GOAL_MERGE_KEYS = ['domain_id', 'time_frame', 'start_date', 'end_date', 'title', 'is_completed', 'deleted_at'] as const satisfies readonly (keyof Goal)[];
export const DEADLINE_MERGE_KEYS = ['title', 'memo', 'due_date', 'due_time', 'reminder_days', 'project_id', 'deleted_at'] as const satisfies readonly (keyof Deadline)[];
export const SCHEDULE_MERGE_KEYS = ['title', 'target_date', 'start_time', 'end_time', 'domain_id', 'deleted_at'] as const satisfies readonly (keyof Schedule)[];
export const ROUTINE_MERGE_KEYS = ['title', 'domain_id', 'recurrence_rule', 'start_date', 'end_date', 'scheduled_time', 'deleted_at'] as const satisfies readonly (keyof Routine)[];
export const PROFILE_MERGE_KEYS = ['nickname', 'birthday_month', 'birthday_day', 'avatar_path'] as const satisfies readonly (keyof Profile)[];

export const SIMPLE_MERGE_KEYS = {
  domains: DOMAIN_MERGE_KEYS,
  projects: PROJECT_MERGE_KEYS,
  goals: GOAL_MERGE_KEYS,
  deadlines: DEADLINE_MERGE_KEYS,
  schedules: SCHEDULE_MERGE_KEYS,
  routines: ROUTINE_MERGE_KEYS,
} as const;

export type ShadowTable = PlannerSyncTable | 'profiles';

export function shadowKey(table: ShadowTable, rowId: string) {
  return `${table}:${rowId}`;
}

export function rowFromShadow<T extends MergeRow>(shadow: CloudShadow | undefined, rowId: string): T | undefined {
  if (!shadow) return undefined;
  return { id: rowId, updated_at: shadow.updated_at, version: shadow.version, ...JSON.parse(shadow.body) as object } as T;
}

export function shadowFields<T extends object>(row: T, keys: readonly (keyof T)[]) {
  const body: Record<string, unknown> = {};
  for (const key of keys) body[key as string] = row[key];
  return body;
}

export function shadowRecord(table: ShadowTable, row: MergeRow, fields: Record<string, unknown>): CloudShadow {
  return {
    id: shadowKey(table, row.id),
    updated_at: row.updated_at,
    version: row.version ?? 1,
    body: JSON.stringify(fields),
  };
}

export async function writeShadow(table: ShadowTable, row: MergeRow, fields: Record<string, unknown>) {
  await db.cloudShadows.put(shadowRecord(table, row, fields));
}

export function pickTaskImageBlob(imagePath: string | null | undefined, local: Task, remote: Task) {
  if (!imagePath) return null;
  if (local.image_path === imagePath && local.image_blob) return local.image_blob ?? null;
  if (remote.image_path === imagePath && remote.image_blob) return remote.image_blob ?? null;
  return local.image_blob ?? remote.image_blob ?? null;
}

export function pickProfileAvatar(avatarPath: string | null | undefined, local: Profile, remote: Profile) {
  if (!avatarPath) return null;
  if (local.avatar_path === avatarPath && local.avatar) return local.avatar;
  if (remote.avatar_path === avatarPath && remote.avatar) return remote.avatar;
  return local.avatar ?? remote.avatar ?? null;
}

export function earlierCreatedAt(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}
