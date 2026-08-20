import type { Transaction } from 'dexie';
import { db, type Domain, type Profile, type Task } from './db';
import {
  SIMPLE_SYNC_TABLES,
  plannerWriteTables,
  taskFromRemote,
  taskRow,
  versionFrom,
  type PlannerSyncTable,
  type RemoteStamp,
  type RemoteTask,
} from './plannerSyncSchema';
import { maybeSavePlannerCloudSnapshot } from './plannerBackupSnapshots';
import { supabase } from './supabase';

const OWNER_KEY = 'gichanplan-sync-owner';

let applyingRemote = false;
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

async function upsertRows(table: PlannerSyncTable, rows: object[]) {
  if (!supabase || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

function isNewer(candidate: { updated_at: string; version?: number }, current: { updated_at: string; version?: number }) {
  const candidateTime = Date.parse(candidate.updated_at);
  const currentTime = Date.parse(current.updated_at);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return (candidate.version ?? 0) > (current.version ?? 0);
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

function skipCloudPush() {
  return applyingRemote;
}

async function repairTasksInDeletedCategories() {
  const [tasks, domains] = await Promise.all([db.tasks.toArray(), db.domains.toArray()]);
  const deletedIds = new Set(domains.filter(domain => domain.deleted_at !== null).map(domain => domain.id));
  const orphanedTasks = tasks.filter(task =>
    task.deleted_at === null && task.domain_id !== null && deletedIds.has(task.domain_id)
  );
  if (orphanedTasks.length === 0) return;
  const now = new Date().toISOString();
  await db.tasks.bulkPut(orphanedTasks.map(task => ({
    ...task,
    domain_id: null,
    updated_at: now,
    version: task.version + 1,
  })));
}

function mergeByUpdatedAt<T extends { id: string; updated_at: string; version?: number }>(local: T[], remote: T[]) {
  const merged = new Map<string, T>();
  for (const row of local) merged.set(row.id, row);
  for (const row of remote) {
    const existing = merged.get(row.id);
    if (!existing || isNewer(row, existing)) merged.set(row.id, row);
  }
  return [...merged.values()];
}

function keepNewerLocal<T extends { id: string; updated_at: string; version?: number }>(merged: T[], live: T[]) {
  const byId = new Map(merged.map(row => [row.id, row]));
  for (const row of live) {
    const existing = byId.get(row.id);
    if (!existing || isNewer(row, existing)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function pushTask(task: Task, ownerId: string, mode: 'user' | 'bulk') {
  const row = taskRow(task, ownerId, null);
  if (task.image_blob) {
    const extension = task.image_blob.type === 'image/png' ? 'png' : task.image_blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    row.image_path = await uploadBlob('task-images', `${ownerId}/${task.id}.${extension}`, task.image_blob);
    if (mode === 'user') {
      await removeStorageObjects('task-images', taskImagePaths(ownerId, task.id).filter(path => path !== row.image_path));
    }
  } else if (mode === 'user') {
    row.image_path = null;
    await removeStorageObjects('task-images', taskImagePaths(ownerId, task.id));
  } else {
    delete (row as { image_path?: string | null }).image_path;
  }
  await upsertRows('tasks', [row]);
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
  } else if (mode === 'user') {
    payload.avatar_path = null;
    await removeStorageObjects('profile-images', avatarPaths(ownerId));
  }
  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('프로필을 계정에 저장하지 못했습니다.');
}

async function pushAllLocal(ownerId: string) {
  const [tasks, profile] = await Promise.all([db.tasks.toArray(), db.profiles.get('#profile')]);
  for (const task of tasks) await pushTask(task, ownerId, 'bulk');
  for (const spec of SIMPLE_SYNC_TABLES) {
    const rows = await spec.table.toArray();
    await upsertRows(spec.name, rows.map(row => spec.toRow(row as never, ownerId)));
  }
  if (profile) await pushProfile(profile, ownerId, 'bulk');
}

async function pullRemote(ownerId: string, email: string | null) {
  if (!supabase) return;
  const client = supabase;
  const simple = SIMPLE_SYNC_TABLES;
  const results = await Promise.all([
    client.from('tasks').select('*'),
    ...simple.map(spec => client.from(spec.name).select('*')),
    client.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
  ]);
  for (const result of results) {
    if (result.error) throw result.error;
  }
  const tasksRes = results[0];
  const simpleResults = results.slice(1, 1 + simple.length);
  const profileRes = results[results.length - 1];

  const simpleMerged = new Map<string, Array<{ id: string; updated_at: string; version?: number }>>();
  for (let index = 0; index < simple.length; index += 1) {
    const spec = simple[index];
    const local = await spec.table.toArray();
    const remote = (simpleResults[index].data ?? []) as RemoteStamp[];
    simpleMerged.set(spec.name, mergeByUpdatedAt(local, remote.map(row => spec.fromRemote(row as never))));
  }
  const domains = (simpleMerged.get('domains') ?? []) as Domain[];

  const localTasks = await db.tasks.toArray();
  const localById = new Map(localTasks.map(task => [task.id, task]));
  const remoteTasks = (tasksRes.data ?? []) as RemoteTask[];
  const taskIds = new Set([...localById.keys(), ...remoteTasks.map(row => row.id)]);
  const mergedTasks: Task[] = [];
  for (const id of taskIds) {
    const local = localById.get(id);
    const remote = remoteTasks.find(row => row.id === id);
    if (remote && local) {
      const downloaded = remote.image_path ? await downloadBlob('task-images', remote.image_path) : null;
      const remoteImage = remote.image_path ? (downloaded ?? local.image_blob ?? null) : null;
      const fromRemote = taskFromRemote(remote, remoteImage);
      const remoteNewer = isNewer({ updated_at: remote.updated_at, version: versionFrom(remote) }, local);
      mergedTasks.push(preserveDomainIfCleared(remoteNewer ? fromRemote : local, remoteNewer ? local : fromRemote, domains));
    } else if (remote) {
      const downloaded = remote.image_path ? await downloadBlob('task-images', remote.image_path) : null;
      mergedTasks.push(taskFromRemote(remote, downloaded));
    } else if (local) {
      mergedTasks.push(local);
    }
  }

  const remoteProfile = profileRes.data as {
    nickname: string;
    avatar_path: string | null;
    birthday_month?: number | null;
    birthday_day?: number | null;
    created_at: string;
    updated_at: string;
  } | null;
  const localProfile = await db.profiles.get('#profile');
  const useRemoteProfile = Boolean(remoteProfile && (!localProfile || Date.parse(remoteProfile.updated_at) > Date.parse(localProfile.updated_at)));
  const profile: Profile = useRemoteProfile && remoteProfile
    ? {
      id: '#profile',
      nickname: remoteProfile.nickname,
      avatar: remoteProfile.avatar_path
        ? (await downloadBlob('profile-images', remoteProfile.avatar_path) ?? localProfile?.avatar ?? null)
        : null,
      legacy_dexie_user_id: localProfile?.legacy_dexie_user_id ?? null,
      email,
      birthday_month: remoteProfile.birthday_month ?? null,
      birthday_day: remoteProfile.birthday_day ?? null,
      created_at: remoteProfile.created_at,
      updated_at: remoteProfile.updated_at,
    }
    : localProfile ?? {
      id: '#profile',
      nickname: email?.split('@')[0] || '사용자',
      avatar: null,
      legacy_dexie_user_id: null,
      email,
      birthday_month: null,
      birthday_day: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

  applyingRemote = true;
  try {
    await db.transaction('rw', [...plannerWriteTables()], async () => {
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
    });
    await repairTasksInDeletedCategories();
  } finally {
    applyingRemote = false;
  }
}

async function clearLocalPlanner() {
  applyingRemote = true;
  try {
    await db.transaction('rw', [...plannerWriteTables()], async () => {
      await Promise.all([...plannerWriteTables()].map(table => table.clear()));
    });
  } finally {
    applyingRemote = false;
  }
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
  localStorage.setItem(OWNER_KEY, userId);
}

export async function signOutPlanner() {
  try { await waitForPlannerCloud(); } catch { /* keep signing out even if the last push failed */ }
  if (supabase) await supabase.auth.signOut();
  await clearLocalPlanner();
  localStorage.removeItem(OWNER_KEY);
}

async function syncNow() {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await prepareLocalAccount(user.id);
  await pullRemote(user.id, user.email ?? null);
  await pushAllLocal(user.id);
  void maybeSavePlannerCloudSnapshot().catch(error => {
    console.warn('[gichanplanner] 계정 사본을 남기지 못했습니다', error);
  });
}

export function syncPlannerWithCloud() {
  return enqueue(() => syncNow());
}

export function installPlannerSync() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  db.tasks.hook('creating', (_key, obj, trans) => {
    if (skipCloudPush()) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await pushTask(obj, ownerId, 'user'); });
  });
  db.tasks.hook('updating', (_mods, primKey, _obj, trans) => {
    if (skipCloudPush()) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.tasks.get(primKey);
      if (ownerId && row) await pushTask(row, ownerId, 'user');
    });
  });
  for (const spec of SIMPLE_SYNC_TABLES) {
    spec.table.hook('creating', (_key, obj, trans) => {
      if (skipCloudPush()) return;
      whenCommitted(trans, async () => {
        const ownerId = await currentUserId();
                if (ownerId) await upsertRows(spec.name, [spec.toRow(obj as never, ownerId)]);
      });
    });
    spec.table.hook('updating', (_mods, primKey, _obj, trans) => {
      if (skipCloudPush()) return;
      whenCommitted(trans, async () => {
        const ownerId = await currentUserId();
        const row = await spec.table.get(primKey);
        if (ownerId && row) await upsertRows(spec.name, [spec.toRow(row as never, ownerId)]);
      });
    });
  }
  db.profiles.hook('creating', (_key, obj, trans) => {
    if (skipCloudPush()) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await pushProfile(obj, ownerId, 'user'); });
  });
  db.profiles.hook('updating', (_mods, primKey, _obj, trans) => {
    if (skipCloudPush()) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.profiles.get(primKey);
      if (ownerId && row) await pushProfile(row, ownerId, 'user');
    });
  });
}
