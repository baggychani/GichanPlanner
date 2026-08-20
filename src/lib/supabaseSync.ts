import type { Transaction } from 'dexie';
import { db, type Deadline, type Domain, type Goal, type Profile, type Routine, type Schedule, type Task } from './db';
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
    const result = await op();
    await waitForPlannerCloud();
    return result;
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

async function upsertRows(table: 'tasks' | 'schedules' | 'routines' | 'domains' | 'goals' | 'deadlines', rows: object[]) {
  if (!supabase || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

type RemoteStamp = {
  id: string;
  revision?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function versionFrom(row: RemoteStamp) {
  return row.revision ?? 1;
}

function taskRow(task: Task, ownerId: string, imagePath: string | null) {
  return {
    id: task.id, owner_id: ownerId, revision: task.version,
    created_at: task.created_at, updated_at: task.updated_at, deleted_at: task.deleted_at,
    title: task.title, target_date: task.target_date, deadline: task.deadline, scheduled_time: task.scheduled_time,
    domain_id: task.domain_id, goal_id: task.goal_id, is_important: task.is_important, is_completed: task.is_completed,
    memo: task.memo, order: task.order, image_path: imagePath,
  };
}

function domainRow(domain: Domain, ownerId: string) {
  return {
    id: domain.id, owner_id: ownerId, revision: domain.version,
    created_at: domain.created_at, updated_at: domain.updated_at, deleted_at: domain.deleted_at,
    name: domain.name, icon: domain.icon, color: domain.color, order: domain.order, is_archived: domain.is_archived,
  };
}

function goalRow(goal: Goal, ownerId: string) {
  return {
    id: goal.id, owner_id: ownerId, revision: goal.version,
    created_at: goal.created_at, updated_at: goal.updated_at, deleted_at: goal.deleted_at,
    domain_id: goal.domain_id, time_frame: goal.time_frame, start_date: goal.start_date, end_date: goal.end_date,
    title: goal.title, is_completed: goal.is_completed,
  };
}

function deadlineRow(deadline: Deadline, ownerId: string) {
  return {
    id: deadline.id, owner_id: ownerId, revision: deadline.version,
    created_at: deadline.created_at, updated_at: deadline.updated_at, deleted_at: deadline.deleted_at,
    title: deadline.title, memo: deadline.memo, due_date: deadline.due_date, due_time: deadline.due_time,
    reminder_days: deadline.reminder_days,
  };
}

function scheduleRow(schedule: Schedule, ownerId: string) {
  return {
    id: schedule.id, owner_id: ownerId, revision: schedule.version,
    created_at: schedule.created_at, updated_at: schedule.updated_at, deleted_at: schedule.deleted_at,
    title: schedule.title, target_date: schedule.target_date, start_time: schedule.start_time, end_time: schedule.end_time,
    domain_id: schedule.domain_id,
  };
}

function routineRow(routine: Routine, ownerId: string) {
  return {
    id: routine.id, owner_id: ownerId, revision: routine.version,
    created_at: routine.created_at, updated_at: routine.updated_at, deleted_at: routine.deleted_at,
    title: routine.title, domain_id: routine.domain_id, recurrence_rule: routine.recurrence_rule, start_date: routine.start_date,
  };
}

type RemoteTask = RemoteStamp & {
  title: string; target_date: string; deadline: string | null; scheduled_time: string | null;
  domain_id: string | null; goal_id: string | null; is_important: boolean; is_completed: boolean;
  memo: string; order: number; image_path: string | null;
};

function taskFromRemote(row: RemoteTask, imageBlob: Blob | null): Task {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, target_date: row.target_date, deadline: row.deadline, scheduled_time: row.scheduled_time,
    domain_id: row.domain_id, goal_id: row.goal_id, is_important: row.is_important, is_completed: row.is_completed,
    memo: row.memo ?? '', order: row.order ?? 0, image_blob: imageBlob, image_data: null,
  };
}

function domainFromRemote(row: RemoteStamp & Domain): Domain {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    name: row.name, icon: row.icon, color: row.color, order: row.order, is_archived: row.is_archived,
  };
}

function goalFromRemote(row: RemoteStamp & Goal): Goal {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    domain_id: row.domain_id, time_frame: row.time_frame, start_date: row.start_date, end_date: row.end_date,
    title: row.title, is_completed: row.is_completed,
  };
}

function deadlineFromRemote(row: RemoteStamp & Deadline): Deadline {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, memo: row.memo, due_date: row.due_date, due_time: row.due_time ?? null, reminder_days: row.reminder_days,
  };
}

function scheduleFromRemote(row: RemoteStamp & Schedule): Schedule {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, target_date: row.target_date, start_time: row.start_time, end_time: row.end_time, domain_id: row.domain_id,
  };
}

function routineFromRemote(row: RemoteStamp & Routine): Routine {
  return {
    id: row.id, version: versionFrom(row), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at,
    title: row.title, domain_id: row.domain_id, recurrence_rule: row.recurrence_rule, start_date: row.start_date,
  };
}

function isNewer(candidate: { updated_at: string; version?: number }, current: { updated_at: string; version?: number }) {
  const candidateTime = Date.parse(candidate.updated_at);
  const currentTime = Date.parse(current.updated_at);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return (candidate.version ?? 0) > (current.version ?? 0);
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
  const [tasks, domains, goals, deadlines, schedules, routines, profile] = await Promise.all([
    db.tasks.toArray(), db.domains.toArray(), db.goals.toArray(), db.deadlines.toArray(),
    db.schedules.toArray(), db.routines.toArray(), db.profiles.get('#profile'),
  ]);
  for (const task of tasks) await pushTask(task, ownerId, 'bulk');
  await upsertRows('domains', domains.map(domain => domainRow(domain, ownerId)));
  await upsertRows('goals', goals.map(goal => goalRow(goal, ownerId)));
  await upsertRows('deadlines', deadlines.map(deadline => deadlineRow(deadline, ownerId)));
  await upsertRows('schedules', schedules.map(schedule => scheduleRow(schedule, ownerId)));
  await upsertRows('routines', routines.map(routine => routineRow(routine, ownerId)));
  if (profile) await pushProfile(profile, ownerId, 'bulk');
}

async function pullRemote(ownerId: string, email: string | null) {
  if (!supabase) return;
  const client = supabase;
  const [tasksRes, domainsRes, goalsRes, deadlinesRes, schedulesRes, routinesRes, profileRes] = await Promise.all([
    client.from('tasks').select('*'),
    client.from('domains').select('*'),
    client.from('goals').select('*'),
    client.from('deadlines').select('*'),
    client.from('schedules').select('*'),
    client.from('routines').select('*'),
    client.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
  ]);
  for (const result of [tasksRes, domainsRes, goalsRes, deadlinesRes, schedulesRes, routinesRes, profileRes]) {
    if (result.error) throw result.error;
  }

  const localTasks = await db.tasks.toArray();
  const localById = new Map(localTasks.map(task => [task.id, task]));
  const remoteTasks = (tasksRes.data ?? []) as RemoteTask[];
  const taskIds = new Set([...localById.keys(), ...remoteTasks.map(row => row.id)]);
  const mergedTasks: Task[] = [];
  for (const id of taskIds) {
    const local = localById.get(id);
    const remote = remoteTasks.find(row => row.id === id);
    if (remote && (!local || isNewer({ updated_at: remote.updated_at, version: versionFrom(remote) }, local))) {
      const downloaded = remote.image_path ? await downloadBlob('task-images', remote.image_path) : null;
      const imageBlob = remote.image_path
        ? (downloaded ?? local?.image_blob ?? null)
        : null;
      mergedTasks.push(taskFromRemote(remote, imageBlob));
    } else if (local) {
      mergedTasks.push(local);
    }
  }

  const domains = mergeByUpdatedAt(await db.domains.toArray(), ((domainsRes.data ?? []) as Array<RemoteStamp & Domain>).map(domainFromRemote));
  const goals = mergeByUpdatedAt(await db.goals.toArray(), ((goalsRes.data ?? []) as Array<RemoteStamp & Goal>).map(goalFromRemote));
  const deadlines = mergeByUpdatedAt(await db.deadlines.toArray(), ((deadlinesRes.data ?? []) as Array<RemoteStamp & Deadline>).map(deadlineFromRemote));
  const schedules = mergeByUpdatedAt(await db.schedules.toArray(), ((schedulesRes.data ?? []) as Array<RemoteStamp & Schedule>).map(scheduleFromRemote));
  const routines = mergeByUpdatedAt(await db.routines.toArray(), ((routinesRes.data ?? []) as Array<RemoteStamp & Routine>).map(routineFromRemote));

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
    await db.transaction('rw', [db.tasks, db.domains, db.goals, db.deadlines, db.schedules, db.routines, db.profiles], async () => {
      await Promise.all([db.tasks.clear(), db.domains.clear(), db.goals.clear(), db.deadlines.clear(), db.schedules.clear(), db.routines.clear()]);
      if (mergedTasks.length) await db.tasks.bulkPut(mergedTasks);
      if (domains.length) await db.domains.bulkPut(domains);
      if (goals.length) await db.goals.bulkPut(goals);
      if (deadlines.length) await db.deadlines.bulkPut(deadlines);
      if (schedules.length) await db.schedules.bulkPut(schedules);
      if (routines.length) await db.routines.bulkPut(routines);
      await db.profiles.put(profile.email === email || !email ? profile : { ...profile, email });
    });
  } finally {
    applyingRemote = false;
  }
}

async function clearLocalPlanner() {
  applyingRemote = true;
  try {
    await db.transaction('rw', [db.tasks, db.domains, db.goals, db.deadlines, db.schedules, db.routines, db.profiles], async () => {
      await Promise.all([db.tasks.clear(), db.domains.clear(), db.goals.clear(), db.deadlines.clear(), db.schedules.clear(), db.routines.clear(), db.profiles.clear()]);
    });
  } finally {
    applyingRemote = false;
  }
}

export function localAccountNeedsReset(userId: string) {
  const storedOwner = localStorage.getItem(OWNER_KEY);
  return Boolean(storedOwner && storedOwner !== userId);
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
}

export function syncPlannerWithCloud() {
  return enqueue(() => syncNow());
}

export function installPlannerSync() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  db.tasks.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await pushTask(obj, ownerId, 'user'); });
  });
  db.tasks.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.tasks.get(primKey);
      if (ownerId && row) await pushTask(row, ownerId, 'user');
    });
  });
  db.domains.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await upsertRows('domains', [domainRow(obj, ownerId)]); });
  });
  db.domains.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.domains.get(primKey);
      if (ownerId && row) await upsertRows('domains', [domainRow(row, ownerId)]);
    });
  });
  db.goals.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await upsertRows('goals', [goalRow(obj, ownerId)]); });
  });
  db.goals.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.goals.get(primKey);
      if (ownerId && row) await upsertRows('goals', [goalRow(row, ownerId)]);
    });
  });
  db.deadlines.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      if (!ownerId) return;
      await upsertRows('deadlines', [deadlineRow(obj, ownerId)]);
    });
  });
  db.deadlines.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.deadlines.get(primKey);
      if (!ownerId || !row) return;
      await upsertRows('deadlines', [deadlineRow(row, ownerId)]);
    });
  });
  db.schedules.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await upsertRows('schedules', [scheduleRow(obj, ownerId)]); });
  });
  db.schedules.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.schedules.get(primKey);
      if (ownerId && row) await upsertRows('schedules', [scheduleRow(row, ownerId)]);
    });
  });
  db.routines.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await upsertRows('routines', [routineRow(obj, ownerId)]); });
  });
  db.routines.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.routines.get(primKey);
      if (ownerId && row) await upsertRows('routines', [routineRow(row, ownerId)]);
    });
  });
  db.profiles.hook('creating', (_key, obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => { const ownerId = await currentUserId(); if (ownerId) await pushProfile(obj, ownerId, 'user'); });
  });
  db.profiles.hook('updating', (_mods, primKey, _obj, trans) => {
    if (applyingRemote) return;
    whenCommitted(trans, async () => {
      const ownerId = await currentUserId();
      const row = await db.profiles.get(primKey);
      if (ownerId && row) await pushProfile(row, ownerId, 'user');
    });
  });
}
