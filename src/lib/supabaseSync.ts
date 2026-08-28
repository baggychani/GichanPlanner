import type { Transaction } from 'dexie';
import { db, type Domain, type Profile, type Task } from './db';
import {
  PROFILE_MERGE_KEYS,
  SIMPLE_MERGE_KEYS,
  TASK_MERGE_KEYS,
  earlierCreatedAt,
  isNewer,
  pickProfileAvatar,
  pickTaskImageBlob,
  rowFromShadow,
  shadowFields,
  shadowRecord,
  threeWayMerge,
  writeShadow,
  type CloudShadow,
  type ShadowTable,
} from './plannerMerge';
import {
  PLANNER_SYNC_TABLES,
  SIMPLE_SYNC_TABLES,
  plannerWriteTables,
  taskFromRemote,
  taskRow,
  type PlannerSyncTable,
  type RemoteStamp,
  type RemoteTask,
} from './plannerSyncSchema';
import { maybeSavePlannerCloudSnapshot } from './plannerBackupSnapshots';
import { supabase } from './supabase';

const OWNER_KEY = 'gichanplan-sync-owner';
const SYNC_CURSOR_KEY = 'gichanplan-sync-cursor';
// PostgREST returns at most 1,000 rows by default. Keep reads paged so a
// long-lived planner can still be fully hydrated on a new device.
const REMOTE_READ_PAGE_SIZE = 1_000;

let hooksInstalled = false;
let syncChain: Promise<void> = Promise.resolve();
let lastError: unknown = null;
const listeners = new Set<(error: unknown) => void>();

function notify(error: unknown) {
  lastError = error;
  for (const listener of listeners) listener(error);
}

export function subscribePlannerSync(listener: (error: unknown) => void) {
  listeners.add(listener);
  listener(lastError);
  return () => { listeners.delete(listener); };
}

let inflight = 0;

function enqueue(work: () => Promise<void>) {
  inflight += 1;
  const run = syncChain.then(async () => {
    await work();
    notify(null);
  });
  syncChain = run.catch(error => {
    console.error('[gichanplanner] 동기화 실패', error);
    notify(error);
  }).finally(() => {
    inflight -= 1;
  });
  return run;
}

export async function waitForPlannerCloud() {
  await new Promise<void>(resolve => { window.setTimeout(resolve, 0); });
  for (let i = 0; i < 8; i += 1) {
    await syncChain;
    if (inflight === 0) break;
  }
  if (lastError) throw lastError;
}

export async function runPlannerWrite<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    notify(error);
    throw error;
  }
}

function whenCommitted(trans: Transaction, work: () => Promise<void>) {
  trans.on('complete', () => { void enqueue(work); });
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function uploadBlob(bucket: 'profile-images' | 'task-images', path: string, blob: Blob) {
  if (!supabase) return null;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/webp',
  });
  if (error) throw error;
  return path;
}

async function removeStorageObjects(bucket: 'profile-images' | 'task-images', paths: string[]) {
  if (!supabase || paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}

function taskImagePaths(ownerId: string, taskId: string) {
  return [`${ownerId}/${taskId}.webp`, `${ownerId}/${taskId}.png`, `${ownerId}/${taskId}.jpg`];
}

function avatarPaths(ownerId: string) {
  return [`${ownerId}/avatar.webp`, `${ownerId}/avatar.png`, `${ownerId}/avatar.jpg`];
}

async function downloadBlob(bucket: 'profile-images' | 'task-images', path: string | null) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return data;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(Math.max(limit, 1), Math.max(items.length, 1));
  if (items.length === 0) return results;
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function imageCacheKey(bucket: 'profile-images' | 'task-images', path: string) {
  return `${bucket}:${path}`;
}

async function downloadBlobs(needs: Array<{ bucket: 'profile-images' | 'task-images'; path: string }>) {
  const unique = new Map<string, { bucket: 'profile-images' | 'task-images'; path: string }>();
  for (const need of needs) unique.set(imageCacheKey(need.bucket, need.path), need);
  const blobs = new Map<string, Blob | null>();
  await mapPool([...unique.values()], 6, async (need) => {
    blobs.set(imageCacheKey(need.bucket, need.path), await downloadBlob(need.bucket, need.path));
  });
  return blobs;
}

function localHasImage(localPath: string | null | undefined, localBlob: Blob | null | undefined, remotePath: string | null) {
  return Boolean(remotePath && localBlob && localPath === remotePath);
}

async function upsertRows(table: PlannerSyncTable, rows: object[]) {
  if (!supabase || rows.length === 0) return;
  for (let offset = 0; offset < rows.length; offset += 250) {
    const chunk = rows.slice(offset, offset + 250);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

function readSyncCursor(ownerId: string) {
  try {
    const stored = localStorage.getItem(SYNC_CURSOR_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as { ownerId?: unknown; updatedSince?: unknown };
    if (value.ownerId !== ownerId || typeof value.updatedSince !== 'string' || Number.isNaN(Date.parse(value.updatedSince))) return null;
    return value.updatedSince;
  } catch {
    return null;
  }
}

function writeSyncCursor(ownerId: string, updatedSince: string) {
  localStorage.setItem(SYNC_CURSOR_KEY, JSON.stringify({ ownerId, updatedSince }));
}

function clearSyncCursor() {
  localStorage.removeItem(SYNC_CURSOR_KEY);
}

async function fetchAllRemoteRows(table: PlannerSyncTable, updatedSince: string | null): Promise<object[]> {
  if (!supabase) return [];
  const rows: object[] = [];
  for (let start = 0; ; start += REMOTE_READ_PAGE_SIZE) {
    const source = supabase
      .from(table)
      .select('*');
    // Initial hydration walks a stable id index. Delta hydration starts at the
    // timestamp cursor, which uses the owner_id/updated_at/id index added in
    // the production migration.
    const request = updatedSince
      ? source.gte('updated_at', updatedSince).order('updated_at', { ascending: true }).order('id', { ascending: true })
      : source.order('id', { ascending: true });
    const { data, error } = await request.range(start, start + REMOTE_READ_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < REMOTE_READ_PAGE_SIZE) return rows;
  }
}

function sameTaskCore(a: Task, b: Task) {
  return a.title === b.title
    && a.target_date === b.target_date
    && a.is_completed === b.is_completed
    && a.is_important === b.is_important
    && a.memo === b.memo
    && a.order === b.order
    && a.deadline === b.deadline
    && a.scheduled_time === b.scheduled_time
    && a.goal_id === b.goal_id
    && a.project_id === b.project_id;
}

// 할 일만 먼저 도착해 카테고리가 비어 보일 때, 분류만 지운 쪽을 다른 기기의 분류로 되돌린다.
function preserveDomainIfCleared(winner: Task, loser: Task, domains: Domain[]): Task {
  if (winner.domain_id != null || loser.domain_id == null) return winner;
  if (!domains.some(domain => domain.id === loser.domain_id && domain.deleted_at === null)) return winner;
  if (!sameTaskCore(winner, loser)) return winner;
  return { ...winner, domain_id: loser.domain_id };
}

function markApplyingRemote(trans: Transaction) {
  (trans as Transaction & { applyingRemote?: boolean }).applyingRemote = true;
}

function skipCloudPush(trans: Transaction) {
  return Boolean((trans as Transaction & { applyingRemote?: boolean }).applyingRemote);
}

async function repairRowsWithDeletedParents() {
  const [tasks, schedules, routines, domains, goals, deadlines, projects] = await Promise.all([
    db.tasks.toArray(), db.schedules.toArray(), db.routines.toArray(), db.domains.toArray(),
    db.goals.toArray(), db.deadlines.toArray(), db.projects.toArray(),
  ]);
  const deletedDomainIds = new Set(domains.filter(row => row.deleted_at !== null).map(row => row.id));
  const deletedGoalIds = new Set(goals.filter(row => row.deleted_at !== null).map(row => row.id));
  const deletedProjectIds = new Set(projects.filter(row => row.deleted_at !== null).map(row => row.id));
  const now = new Date().toISOString();

  const repairedTasks = tasks.flatMap(task => {
    if (task.deleted_at !== null) return [];
    const domain_id = task.domain_id && deletedDomainIds.has(task.domain_id) ? null : task.domain_id;
    const goal_id = task.goal_id && deletedGoalIds.has(task.goal_id) ? null : task.goal_id;
    const project_id = task.project_id && deletedProjectIds.has(task.project_id) ? null : task.project_id;
    return domain_id !== task.domain_id || goal_id !== task.goal_id || project_id !== task.project_id
      ? [{ ...task, domain_id, goal_id, project_id, updated_at: now, version: task.version + 1 }]
      : [];
  });
  const repairedSchedules = schedules.flatMap(schedule =>
    schedule.deleted_at === null && schedule.domain_id && deletedDomainIds.has(schedule.domain_id)
      ? [{ ...schedule, domain_id: null, updated_at: now, version: schedule.version + 1 }]
      : []);
  const repairedRoutines = routines.flatMap(routine =>
    routine.deleted_at === null && routine.domain_id && deletedDomainIds.has(routine.domain_id)
      ? [{ ...routine, domain_id: null, updated_at: now, version: routine.version + 1 }]
      : []);
  const repairedGoals = goals.flatMap(goal =>
    goal.deleted_at === null && goal.domain_id && deletedDomainIds.has(goal.domain_id)
      ? [{ ...goal, domain_id: null, updated_at: now, version: goal.version + 1 }]
      : []);
  const repairedDeadlines = deadlines.flatMap(deadline =>
    deadline.deleted_at === null && deadline.project_id && deletedProjectIds.has(deadline.project_id)
      ? [{ ...deadline, project_id: null, updated_at: now, version: deadline.version + 1 }]
      : []);
  const repairedProjects = projects.flatMap(project =>
    project.deleted_at === null && project.domain_id && deletedDomainIds.has(project.domain_id)
      ? [{ ...project, domain_id: null, updated_at: now, version: project.version + 1 }]
      : []);

  await Promise.all([
    repairedTasks.length ? db.tasks.bulkPut(repairedTasks) : undefined,
    repairedSchedules.length ? db.schedules.bulkPut(repairedSchedules) : undefined,
    repairedRoutines.length ? db.routines.bulkPut(repairedRoutines) : undefined,
    repairedGoals.length ? db.goals.bulkPut(repairedGoals) : undefined,
    repairedDeadlines.length ? db.deadlines.bulkPut(repairedDeadlines) : undefined,
    repairedProjects.length ? db.projects.bulkPut(repairedProjects) : undefined,
  ]);
}

function keepNewerLocal<T extends { id: string; updated_at: string; version?: number }>(merged: T[], live: T[]) {
  const byId = new Map(merged.map(row => [row.id, row]));
  for (const row of live) {
    const existing = byId.get(row.id);
    if (!existing || isNewer(row, existing)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function mergeTask(base: Task | undefined, local: Task, remote: Task, domains: Domain[]) {
  const merged = threeWayMerge(base, local, remote, TASK_MERGE_KEYS);
  merged.created_at = earlierCreatedAt(local.created_at, remote.created_at);
  merged.image_blob = pickTaskImageBlob(merged.image_path, local, remote);
  merged.image_data = null;
  return preserveDomainIfCleared(preserveDomainIfCleared(merged, local, domains), remote, domains);
}

function mergeProfile(base: Profile | undefined, local: Profile, remote: Profile, email: string | null): Profile {
  const merged = threeWayMerge(base, local, remote, PROFILE_MERGE_KEYS);
  return {
    ...merged,
    id: '#profile',
    created_at: earlierCreatedAt(local.created_at, remote.created_at),
    avatar: pickProfileAvatar(merged.avatar_path, local, remote),
    legacy_dexie_user_id: local.legacy_dexie_user_id ?? remote.legacy_dexie_user_id,
    email: email ?? local.email ?? remote.email,
  };
}

function profileFromRemote(
  remote: {
    nickname: string;
    avatar_path: string | null;
    birthday_month?: number | null;
    birthday_day?: number | null;
    created_at: string;
    updated_at: string;
  },
  avatar: Blob | null,
  local: Profile | undefined,
  email: string | null,
): Profile {
  return {
    id: '#profile',
    nickname: remote.nickname,
    avatar,
    avatar_path: remote.avatar_path,
    legacy_dexie_user_id: local?.legacy_dexie_user_id ?? null,
    email,
    birthday_month: remote.birthday_month ?? null,
    birthday_day: remote.birthday_day ?? null,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
  };
}

async function rememberShadows() {
  const shadows: CloudShadow[] = [];
  for (const task of await db.tasks.toArray()) {
    shadows.push(shadowRecord('tasks', task, shadowFields(task, TASK_MERGE_KEYS)));
  }
  for (const spec of SIMPLE_SYNC_TABLES) {
    const keys = SIMPLE_MERGE_KEYS[spec.name];
    for (const row of await spec.table.toArray()) {
      shadows.push(shadowRecord(spec.name, row as { id: string; updated_at: string; version?: number }, shadowFields(row as never, keys as never)));
    }
  }
  const profile = await db.profiles.get('#profile');
  if (profile) shadows.push(shadowRecord('profiles', { ...profile, version: 1 }, shadowFields(profile, PROFILE_MERGE_KEYS)));
  if (shadows.length) await db.cloudShadows.bulkPut(shadows);
}

async function resolveTaskImagePath(task: Task, ownerId: string, mode: 'user' | 'bulk') {
  if (task.image_blob) {
    const extension = task.image_blob.type === 'image/png' ? 'png' : task.image_blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const path = await uploadBlob('task-images', `${ownerId}/${task.id}.${extension}`, task.image_blob);
    if (mode === 'user') await removeStorageObjects('task-images', taskImagePaths(ownerId, task.id).filter(candidate => candidate !== path));
    return { path, omit: false as const };
  }
  if (task.image_path === null) {
    if (mode === 'user') await removeStorageObjects('task-images', taskImagePaths(ownerId, task.id));
    return { path: null, omit: false as const };
  }
  if (task.image_path) return { path: task.image_path, omit: false as const };
  return { path: null, omit: true as const };
}

async function persistTaskImagePath(taskId: string, path: string | null) {
  await db.transaction('rw', db.tasks, async trans => {
    markApplyingRemote(trans);
    await db.tasks.update(taskId, { image_path: path });
  });
}

async function fetchRemoteTask(taskId: string): Promise<RemoteTask | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (error) throw error;
  return (data as RemoteTask | null) ?? null;
}

async function pushTask(task: Task, ownerId: string, mode: 'user' | 'bulk') {
  let next = task;
  if (mode === 'user') {
    const remote = await fetchRemoteTask(task.id);
    if (remote) {
      const downloaded = remote.image_path && remote.image_path !== task.image_path
        ? await downloadBlob('task-images', remote.image_path)
        : null;
      const remoteTask = taskFromRemote(remote, downloaded ?? (remote.image_path === task.image_path ? task.image_blob ?? null : null));
      const base = rowFromShadow<Task>(await db.cloudShadows.get(`tasks:${task.id}`), task.id);
      const domains = await db.domains.toArray();
      next = mergeTask(base, task, remoteTask, domains);
      if (next.updated_at !== task.updated_at || next.version !== task.version) {
        await db.transaction('rw', db.tasks, async trans => {
          markApplyingRemote(trans);
          await db.tasks.put(next);
        });
      }
    }
  }
  const image = await resolveTaskImagePath(next, ownerId, mode);
  const row = taskRow(next, ownerId, image.path);
  if (image.omit) delete (row as { image_path?: string | null }).image_path;
  await upsertRows('tasks', [row]);
  if (!image.omit && image.path !== next.image_path) await persistTaskImagePath(next.id, image.path);
  const stored = { ...next, image_path: image.omit ? next.image_path : image.path };
  await writeShadow('tasks', stored, shadowFields(stored, TASK_MERGE_KEYS));
}

async function pushProfile(profile: Profile, ownerId: string, mode: 'user' | 'bulk') {
  if (!supabase) return;
  const payload: {
    id: string;
    nickname: string;
    updated_at: string;
    birthday_month: number | null;
    birthday_day: number | null;
    avatar_path?: string | null;
  } = {
    id: ownerId,
    nickname: profile.nickname.slice(0, 40) || '사용자',
    birthday_month: profile.birthday_month,
    birthday_day: profile.birthday_day,
    updated_at: profile.updated_at,
  };
  if (profile.avatar) {
    const extension = profile.avatar.type === 'image/png' ? 'png' : profile.avatar.type === 'image/jpeg' ? 'jpg' : 'webp';
    payload.avatar_path = await uploadBlob('profile-images', `${ownerId}/avatar.${extension}`, profile.avatar);
    if (mode === 'user') {
      await removeStorageObjects('profile-images', avatarPaths(ownerId).filter(path => path !== payload.avatar_path));
    }
  } else if (profile.avatar_path === null) {
    payload.avatar_path = null;
    if (mode === 'user') await removeStorageObjects('profile-images', avatarPaths(ownerId));
  } else if (profile.avatar_path) {
    payload.avatar_path = profile.avatar_path;
  }
  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  if (payload.avatar_path && payload.avatar_path !== profile.avatar_path) {
    await db.transaction('rw', db.profiles, async trans => {
      markApplyingRemote(trans);
      await db.profiles.update('#profile', { avatar_path: payload.avatar_path });
    });
  }
  await writeShadow('profiles', { ...profile, id: '#profile', version: 1 }, shadowFields({ ...profile, avatar_path: payload.avatar_path ?? profile.avatar_path }, PROFILE_MERGE_KEYS));
}

async function pushSimpleRow(
  spec: (typeof SIMPLE_SYNC_TABLES)[number],
  local: { id: string; updated_at: string; version: number },
  ownerId: string,
  mode: 'user' | 'bulk',
) {
  let next = local;
  if (mode === 'user' && supabase) {
    const { data, error } = await supabase.from(spec.name).select('*').eq('id', local.id).maybeSingle();
    if (error) throw error;
    if (data) {
      const remote = spec.fromRemote(data as never);
      const base = rowFromShadow(await db.cloudShadows.get(`${spec.name}:${local.id}`), local.id);
      next = threeWayMerge(base, local, remote as typeof local, SIMPLE_MERGE_KEYS[spec.name] as never) as typeof local;
      if (next.updated_at !== local.updated_at || next.version !== local.version) {
        await db.transaction('rw', spec.table, async trans => {
          markApplyingRemote(trans);
          await spec.table.put(next as never);
        });
      }
    }
  }
  await upsertRows(spec.name, [spec.toRow(next as never, ownerId)]);
  await writeShadow(spec.name as ShadowTable, next, shadowFields(next as never, SIMPLE_MERGE_KEYS[spec.name] as never));
}

async function pushAllLocal(ownerId: string) {
  const [tasks, profile, shadowRows] = await Promise.all([db.tasks.toArray(), db.profiles.get('#profile'), db.cloudShadows.toArray()]);
  const shadowById = new Map(shadowRows.map(row => [row.id, row]));
  const needsPush = (table: ShadowTable, row: { id: string; updated_at: string; version?: number }, fields: Record<string, unknown>) => {
    const shadow = shadowById.get(`${table}:${row.id}`);
    return !shadow || isNewer(row, shadow) || shadow.body !== JSON.stringify(fields);
  };
  const changedTasks = tasks.filter(task => needsPush('tasks', task, shadowFields(task, TASK_MERGE_KEYS)));
  const resolved = await mapPool(changedTasks, 4, async task => ({ task, image: await resolveTaskImagePath(task, ownerId, 'bulk') }));
  await mapPool(
    resolved.filter(({ task, image }) => !image.omit && image.path !== task.image_path),
    4,
    ({ task, image }) => persistTaskImagePath(task.id, image.path),
  );
  await upsertRows('tasks', resolved.map(({ task, image }) => {
    const row = taskRow(task, ownerId, image.path);
    if (image.omit) delete (row as { image_path?: string | null }).image_path;
    return row;
  }));
  const shadows: CloudShadow[] = resolved.map(({ task, image }) => {
    const stored = { ...task, image_path: image.omit ? task.image_path : image.path };
    return shadowRecord('tasks', stored, shadowFields(stored, TASK_MERGE_KEYS));
  });
  for (const spec of SIMPLE_SYNC_TABLES) {
    const rows = (await spec.table.toArray() as Array<{ id: string; updated_at: string; version: number }>)
      .filter(row => needsPush(spec.name, row, shadowFields(row as never, SIMPLE_MERGE_KEYS[spec.name] as never)));
    await upsertRows(spec.name, rows.map(row => spec.toRow(row as never, ownerId)));
    for (const row of rows) {
      shadows.push(shadowRecord(spec.name as ShadowTable, row, shadowFields(row as never, SIMPLE_MERGE_KEYS[spec.name] as never)));
    }
  }
  if (profile && needsPush('profiles', { ...profile, version: 1 }, shadowFields(profile, PROFILE_MERGE_KEYS))) {
    await pushProfile(profile, ownerId, 'bulk');
  }
  if (shadows.length) await db.cloudShadows.bulkPut(shadows);
}

async function pullRemote(ownerId: string, email: string | null) {
  if (!supabase) return;
  const client = supabase;
  const simple = SIMPLE_SYNC_TABLES;
  // With no local merge base we must hydrate everything. Afterwards, retain
  // the pull's start time as an inclusive cursor: changes made while a pull is
  // in flight are safely seen on the next pass.
  const hasMergeBase = (await db.cloudShadows.count()) > 0;
  const updatedSince = hasMergeBase ? readSyncCursor(ownerId) : null;
  const pullStartedAt = new Date().toISOString();
  const [taskRows, simpleRows, profileRes] = await Promise.all([
    fetchAllRemoteRows('tasks', updatedSince),
    Promise.all(simple.map(spec => fetchAllRemoteRows(spec.name, updatedSince))),
    client.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
  ]);
  if (profileRes.error) throw profileRes.error;
  const shadowRows = await db.cloudShadows.toArray();
  const shadows = new Map(shadowRows.map(row => [row.id, row]));

  const remoteShadows: CloudShadow[] = [];
  const simpleMerged = new Map<string, Array<{ id: string; updated_at: string; version?: number }>>();
  for (let index = 0; index < simple.length; index += 1) {
    const spec = simple[index];
    const keys = SIMPLE_MERGE_KEYS[spec.name];
    const localRows = await spec.table.toArray() as Array<{ id: string; updated_at: string; version: number }>;
    const localById = new Map(localRows.map(row => [row.id, row]));
    const remoteRows = (simpleRows[index] as RemoteStamp[]).map(row => spec.fromRemote(row as never) as { id: string; updated_at: string; version: number });
    const remoteById = new Map(remoteRows.map(row => [row.id, row]));
    const merged: typeof localRows = [];
    for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
      const local = localById.get(id);
      const remote = remoteById.get(id);
      if (remote && local) merged.push(threeWayMerge(rowFromShadow(shadows.get(`${spec.name}:${id}`), id), local, remote, keys as never) as typeof local);
      else merged.push((remote ?? local)!);
      if (remote) remoteShadows.push(shadowRecord(spec.name, remote, shadowFields(remote as never, keys as never)));
    }
    simpleMerged.set(spec.name, merged);
  }
  const domains = (simpleMerged.get('domains') ?? []) as Domain[];

  const localTasks = await db.tasks.toArray();
  const localById = new Map(localTasks.map(task => [task.id, task]));
  const remoteTasks = taskRows as RemoteTask[];
  const remoteTaskById = new Map(remoteTasks.map(row => [row.id, row]));
  const remoteProfileRow = profileRes.data as {
    nickname: string;
    avatar_path: string | null;
    birthday_month?: number | null;
    birthday_day?: number | null;
    created_at: string;
    updated_at: string;
  } | null;
  const localProfile = await db.profiles.get('#profile');
  const imageNeeds: Array<{ bucket: 'profile-images' | 'task-images'; path: string }> = [];
  for (const remote of remoteTasks) {
    if (!remote.image_path) continue;
    const local = localById.get(remote.id);
    if (!localHasImage(local?.image_path, local?.image_blob, remote.image_path)) {
      imageNeeds.push({ bucket: 'task-images', path: remote.image_path });
    }
  }
  if (remoteProfileRow?.avatar_path && !localHasImage(localProfile?.avatar_path, localProfile?.avatar, remoteProfileRow.avatar_path)) {
    imageNeeds.push({ bucket: 'profile-images', path: remoteProfileRow.avatar_path });
  }
  const blobs = await downloadBlobs(imageNeeds);

  const taskIds = new Set([...localById.keys(), ...remoteTaskById.keys()]);
  const mergedTasks: Task[] = [];
  for (const id of taskIds) {
    const local = localById.get(id);
    const remote = remoteTaskById.get(id);
    if (remote && local) {
      const downloaded = remote.image_path ? blobs.get(imageCacheKey('task-images', remote.image_path)) ?? null : null;
      const remoteImage = remote.image_path
        ? (downloaded ?? (remote.image_path === local.image_path ? local.image_blob ?? null : null))
        : null;
      const fromRemote = taskFromRemote(remote, remoteImage ?? (remote.image_path === local.image_path ? local.image_blob ?? null : null));
      mergedTasks.push(mergeTask(rowFromShadow<Task>(shadows.get(`tasks:${id}`), id), local, fromRemote, domains));
    } else if (remote) {
      const downloaded = remote.image_path ? blobs.get(imageCacheKey('task-images', remote.image_path)) ?? null : null;
      mergedTasks.push(taskFromRemote(remote, downloaded ?? null));
    } else if (local) {
      mergedTasks.push(local);
    }
    if (remote) {
      const fromRemote = taskFromRemote(remote, null);
      remoteShadows.push(shadowRecord('tasks', fromRemote, shadowFields(fromRemote, TASK_MERGE_KEYS)));
    }
  }

  let profile: Profile = localProfile ?? {
    id: '#profile',
    nickname: email?.split('@')[0] || '사용자',
    avatar: null,
    avatar_path: null,
    legacy_dexie_user_id: null,
    email,
    birthday_month: null,
    birthday_day: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (remoteProfileRow) {
    const downloaded = remoteProfileRow.avatar_path
      ? blobs.get(imageCacheKey('profile-images', remoteProfileRow.avatar_path)) ?? null
      : null;
    const remoteAvatar = remoteProfileRow.avatar_path
      ? (downloaded ?? (remoteProfileRow.avatar_path === localProfile?.avatar_path ? localProfile.avatar ?? null : null))
      : null;
    const fromRemote = profileFromRemote(remoteProfileRow, remoteAvatar, localProfile, email);
    profile = localProfile
      ? mergeProfile(rowFromShadow<Profile>(shadows.get('profiles:#profile'), '#profile'), localProfile, fromRemote, email)
      : fromRemote;
    remoteShadows.push(shadowRecord('profiles', { ...fromRemote, version: 1 }, shadowFields(fromRemote, PROFILE_MERGE_KEYS)));
  }

  await db.transaction('rw', [...plannerWriteTables()], async trans => {
    markApplyingRemote(trans);
    const liveTasks = keepNewerLocal(mergedTasks, await db.tasks.toArray());
    if (liveTasks.length) await db.tasks.bulkPut(liveTasks);
    for (const spec of simple) {
      const merged = simpleMerged.get(spec.name) ?? [];
      const live = keepNewerLocal(merged, await spec.table.toArray() as Array<{ id: string; updated_at: string; version?: number }>);
      if (live.length) await (spec.table as { bulkPut: (rows: unknown[]) => Promise<unknown> }).bulkPut(live);
    }
    const liveProfile = await db.profiles.get('#profile');
    const nextProfile = liveProfile && isNewer(liveProfile, profile) ? liveProfile : profile;
    await db.profiles.put(nextProfile.email === email || !email ? nextProfile : { ...nextProfile, email });
    if (remoteShadows.length) await db.cloudShadows.bulkPut(remoteShadows);
    await repairRowsWithDeletedParents();
  });
  writeSyncCursor(ownerId, pullStartedAt);
}

async function clearLocalPlanner() {
  await db.transaction('rw', [...plannerWriteTables()], async trans => {
    markApplyingRemote(trans);
    await Promise.all([...plannerWriteTables()].map(table => table.clear()));
  });
  clearSyncCursor();
}

export function localAccountNeedsReset(userId: string) {
  const storedOwner = localStorage.getItem(OWNER_KEY);
  return Boolean(storedOwner && storedOwner !== userId);
}

export function localAccountNeedsCloudHydration(userId: string) {
  const storedOwner = localStorage.getItem(OWNER_KEY);
  return !storedOwner || storedOwner !== userId;
}

export async function prepareLocalAccount(userId: string) {
  const storedOwner = localStorage.getItem(OWNER_KEY);
  if (storedOwner && storedOwner !== userId) await clearLocalPlanner();
  if (!storedOwner) clearSyncCursor();
  localStorage.setItem(OWNER_KEY, userId);
}

export async function signOutPlanner() {
  try { await waitForPlannerCloud(); } catch { /* keep signing out even if the last push failed */ }
  if (supabase) await supabase.auth.signOut();
  await clearLocalPlanner();
  localStorage.removeItem(OWNER_KEY);
}

async function syncNow(onHydrated?: () => void) {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;
  await prepareLocalAccount(user.id);
  await pullRemote(user.id, user.email ?? null);
  onHydrated?.();
  await pushAllLocal(user.id);
  await rememberShadows();
  void maybeSavePlannerCloudSnapshot().catch(error => {
    console.warn('[gichanplanner] 계정 사본을 남기지 못했습니다', error);
  });
}

export function syncPlannerWithCloud(onHydrated?: () => void) {
  return enqueue(() => syncNow(onHydrated));
}

// A device can stay open for hours. Realtime makes cross-device edits visible
// without polling, while the debounce keeps a burst of row updates to one
// conflict-aware sync pass.
export function subscribePlannerRealtime(ownerId: string) {
  const client = supabase;
  if (!client) return () => {};
  let timer: number | null = null;
  const scheduleSync = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void syncPlannerWithCloud().catch(() => {});
    }, 700);
  };
  let channel = client.channel(`gichanplan:${ownerId}`);
  for (const table of PLANNER_SYNC_TABLES) {
    channel = channel.on('postgres_changes', {
      event: '*', schema: 'public', table, filter: `owner_id=eq.${ownerId}`,
    }, scheduleSync);
  }
  channel = channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${ownerId}`,
  }, scheduleSync);
  void channel.subscribe();
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    void client.removeChannel(channel);
  };
}

export function installPlannerSync() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  db.tasks.hook('creating', (_key, _obj, trans) => {
    if (skipCloudPush(trans)) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.tasks.get(_key);
      if (ownerId && row) await pushTask(row, ownerId, 'user');
    });
  });
  db.tasks.hook('updating', (_mods, primKey, _obj, trans) => {
    if (skipCloudPush(trans)) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.tasks.get(primKey);
      if (ownerId && row) await pushTask(row, ownerId, 'user');
    });
  });
  for (const spec of SIMPLE_SYNC_TABLES) {
    spec.table.hook('creating', (_key, _obj, trans) => {
      if (skipCloudPush(trans)) return;
      whenCommitted(trans, async () => {
        const ownerId = await currentUserId();
        const row = await spec.table.get(_key);
        if (ownerId && row) await pushSimpleRow(spec, row as { id: string; updated_at: string; version: number }, ownerId, 'user');
      });
    });
    spec.table.hook('updating', (_mods, primKey, _obj, trans) => {
      if (skipCloudPush(trans)) return;
      whenCommitted(trans, async () => {
        const ownerId = await currentUserId();
        const row = await spec.table.get(primKey);
        if (ownerId && row) await pushSimpleRow(spec, row as { id: string; updated_at: string; version: number }, ownerId, 'user');
      });
    });
  }
  db.profiles.hook('creating', (_key, _obj, trans) => {
    if (skipCloudPush(trans)) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.profiles.get(_key);
      if (ownerId && row) await pushProfile(row, ownerId, 'user');
    });
  });
  db.profiles.hook('updating', (_mods, primKey, _obj, trans) => {
    if (skipCloudPush(trans)) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.profiles.get(primKey);
      if (ownerId && row) await pushProfile(row, ownerId, 'user');
    });
  });
}
