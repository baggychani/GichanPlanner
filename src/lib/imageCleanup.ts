import { supabase } from './supabase';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Never remove something uploaded recently: another device may have pushed a
// task/profile row pointing at it that hasn't reached this client's view of
// the server yet.
const SAFETY_MARGIN_MS = 24 * 60 * 60 * 1000;
const LAST_RUN_KEY = 'gichanplan-image-cleanup-at';

type ImageBucket = 'task-images' | 'profile-images';

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function listFilesRecursive(bucket: ImageBucket, folder: string): Promise<Array<{ path: string; createdAt: string }>> {
  if (!supabase) return [];
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (error || !data) return [];
  const files: Array<{ path: string; createdAt: string }> = [];
  for (const entry of data) {
    if (entry.id === null) {
      files.push(...await listFilesRecursive(bucket, `${folder}/${entry.name}`));
    } else {
      files.push({ path: `${folder}/${entry.name}`, createdAt: entry.created_at ?? new Date(0).toISOString() });
    }
  }
  return files;
}

async function referencedTaskImagePaths(ownerId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase.from('tasks').select('image_path').eq('owner_id', ownerId).not('image_path', 'is', null);
  if (error || !data) return new Set();
  return new Set((data as Array<{ image_path: string | null }>).map(row => row.image_path).filter((path): path is string => Boolean(path)));
}

async function referencedAvatarPath(ownerId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('avatar_path').eq('id', ownerId).maybeSingle();
  return (data as { avatar_path: string | null } | null)?.avatar_path ?? null;
}

function isOrphaned(file: { path: string; createdAt: string }, referenced: Set<string> | string | null, cutoff: number) {
  const stillReferenced = referenced instanceof Set ? referenced.has(file.path) : file.path === referenced;
  return !stillReferenced && Date.parse(file.createdAt) < cutoff;
}

// Task/profile image uploads use an immutable, never-overwritten path so a
// changed photo is safely observable by other devices. Nothing else ever
// removes the object it replaced, so this periodically sweeps whatever is no
// longer referenced by any row and old enough to be safe to remove.
export async function cleanupOrphanedImages(ownerId: string) {
  if (!supabase) return;
  const client = supabase;
  const [taskFiles, avatarFiles, referencedTasks, referencedAvatar] = await Promise.all([
    listFilesRecursive('task-images', `${ownerId}/tasks`),
    listFilesRecursive('profile-images', `${ownerId}/avatars`),
    referencedTaskImagePaths(ownerId),
    referencedAvatarPath(ownerId),
  ]);
  const cutoff = Date.now() - SAFETY_MARGIN_MS;
  const orphanedTaskPaths = taskFiles.filter(file => isOrphaned(file, referencedTasks, cutoff)).map(file => file.path);
  const orphanedAvatarPaths = avatarFiles.filter(file => isOrphaned(file, referencedAvatar, cutoff)).map(file => file.path);
  if (orphanedTaskPaths.length) await client.storage.from('task-images').remove(orphanedTaskPaths);
  if (orphanedAvatarPaths.length) await client.storage.from('profile-images').remove(orphanedAvatarPaths);
}

export async function maybeCleanupOrphanedImages() {
  const lastRun = Number(localStorage.getItem(LAST_RUN_KEY) ?? '0');
  if (Date.now() - lastRun < RUN_INTERVAL_MS) return;
  const ownerId = await currentUserId();
  if (!ownerId) return;
  await cleanupOrphanedImages(ownerId);
  localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
}
