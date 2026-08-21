import { db, type Deadline, type Domain, type Goal, type Profile, type Project, type Routine, type Schedule, type Task } from './db';
import type { PortableAttachment, PortablePlannerExport } from './portablePlannerExport';
import { supabase } from './supabase';
import { syncPlannerWithCloud, waitForPlannerCloud } from './supabaseSync';

export type SupabaseImportReport = {
  imported: Record<'tasks' | 'schedules' | 'routines' | 'domains' | 'goals' | 'deadlines' | 'projects' | 'attachments', number>;
};

function attachmentToBlob(attachment: PortableAttachment) {
  const binary = atob(attachment.base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Blob([bytes], { type: attachment.mimeType });
}

function isNewer(candidate: { updated_at: string; version?: number }, current: { updated_at: string; version?: number }) {
  const candidateTime = Date.parse(candidate.updated_at);
  const currentTime = Date.parse(current.updated_at);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  return (candidate.version ?? 0) > (current.version ?? 0);
}

async function takeNewer<T extends { id: string; updated_at: string; version: number }>(
  get: (id: string) => Promise<T | undefined>,
  put: (rows: T[]) => Promise<unknown>,
  incoming: T[],
) {
  const written: T[] = [];
  for (const row of incoming) {
    const current = await get(row.id);
    if (!current || isNewer(row, current)) written.push(row);
  }
  if (written.length) await put(written);
  return written.length;
}

export async function importPortablePlannerExport(archive: PortablePlannerExport): Promise<SupabaseImportReport> {
  if (!supabase) throw new Error('로그인 설정이 되어 있지 않습니다.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('로그인한 뒤에 넣을 수 있습니다.');

  await syncPlannerWithCloud();
  await waitForPlannerCloud();

  const taskBlobs = new Map<string, Blob>();
  let profileAvatar: Blob | null = null;
  for (const attachment of archive.attachments) {
    const blob = attachmentToBlob(attachment);
    if (attachment.owner === 'task') taskBlobs.set(attachment.ownerId, blob);
    else profileAvatar = blob;
  }

  const tasks: Task[] = archive.tasks.map(task => ({
    ...task,
    project_id: task.project_id ?? null,
    routine_id: task.routine_id ?? null,
    image_blob: taskBlobs.get(task.id) ?? null,
    image_data: null,
    image_path: taskBlobs.has(task.id) ? null : (task.image_path ?? null),
  }));
  const schedules: Schedule[] = archive.schedules ?? [];
  const routines: Routine[] = (archive.routines ?? []).map(routine => ({
    ...routine,
    end_date: routine.end_date ?? null,
    scheduled_time: routine.scheduled_time ?? null,
  }));
  const domains: Domain[] = archive.domains ?? [];
  const goals: Goal[] = archive.goals ?? [];
  const deadlines: Deadline[] = (archive.deadlines ?? []).map(deadline => ({
    ...deadline,
    due_time: deadline.due_time ?? null,
    project_id: deadline.project_id ?? null,
  }));
  const projects: Project[] = archive.projects ?? [];

  const imported = {
    tasks: await takeNewer(id => db.tasks.get(id), rows => db.tasks.bulkPut(rows), tasks),
    schedules: await takeNewer(id => db.schedules.get(id), rows => db.schedules.bulkPut(rows), schedules),
    routines: await takeNewer(id => db.routines.get(id), rows => db.routines.bulkPut(rows), routines),
    domains: await takeNewer(id => db.domains.get(id), rows => db.domains.bulkPut(rows), domains),
    goals: await takeNewer(id => db.goals.get(id), rows => db.goals.bulkPut(rows), goals),
    deadlines: await takeNewer(id => db.deadlines.get(id), rows => db.deadlines.bulkPut(rows), deadlines),
    projects: await takeNewer(id => db.projects.get(id), rows => db.projects.bulkPut(rows), projects),
    attachments: archive.attachments.length,
  };

  if (archive.profile) {
    const current = await db.profiles.get('#profile');
    if (!current || isNewer(archive.profile, current)) {
      const profile: Profile = {
        ...archive.profile,
        email: current?.email ?? archive.profile.email ?? user.email ?? null,
        avatar: profileAvatar,
        avatar_path: profileAvatar ? null : (archive.profile.avatar_path ?? null),
      };
      await db.profiles.put(profile);
    }
  }

  if (archive.owner.dexieUserId) {
    const { error: identityError } = await supabase.from('legacy_dexie_identities').upsert({
      provider: 'dexie_cloud',
      legacy_user_id: archive.owner.dexieUserId,
      legacy_email: archive.owner.email,
      user_id: user.id,
      migrated_at: new Date().toISOString(),
    }, { onConflict: 'provider,legacy_user_id' });
    if (identityError) throw identityError;
  }

  await waitForPlannerCloud();
  return { imported };
}
