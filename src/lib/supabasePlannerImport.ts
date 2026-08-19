import { supabase } from './supabase';
import type { PortableAttachment, PortablePlannerExport } from './portablePlannerExport';

export type SupabaseImportReport = {
  imported: Record<'tasks' | 'schedules' | 'routines' | 'domains' | 'goals' | 'deadlines' | 'attachments', number>;
};

function attachmentToBlob(attachment: PortableAttachment) {
  const binary = atob(attachment.base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Blob([bytes], { type: attachment.mimeType });
}

async function uploadAttachment(ownerId: string, attachment: PortableAttachment) {
  const client = supabase;
  if (!client) throw new Error('Supabase가 설정되지 않았습니다.');
  const extension = attachment.mimeType === 'image/png' ? 'png' : attachment.mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  const bucket = attachment.owner === 'profile' ? 'profile-images' : 'task-images';
  const path = `${ownerId}/${attachment.ownerId}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, attachmentToBlob(attachment), { upsert: true, contentType: attachment.mimeType });
  if (error) throw error;
  return path;
}

export async function importPortablePlannerExport(archive: PortablePlannerExport): Promise<SupabaseImportReport> {
  const client = supabase;
  if (!client) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  if (!archive.owner.dexieUserId) throw new Error('Dexie 계정으로 로그인한 뒤 새 백업을 내보내야 계정 매핑을 만들 수 있습니다.');
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Supabase에 먼저 로그인해야 가져올 수 있습니다.');

  const taskAttachmentPaths = new Map<string, string>();
  let profileAvatarPath: string | null = null;
  for (const attachment of archive.attachments) {
    const path = await uploadAttachment(user.id, attachment);
    if (attachment.owner === 'task') taskAttachmentPaths.set(attachment.ownerId, path);
    else profileAvatarPath = path;
  }

  const put = async (table: 'tasks' | 'schedules' | 'routines' | 'domains' | 'goals' | 'deadlines', rows: object[]) => {
    if (rows.length === 0) return;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  };
  const withOwner = <T extends { id: string; version: number }>(item: T) => ({ ...item, owner_id: user.id, revision: item.version });

  await put('domains', archive.domains.map(withOwner));
  await put('goals', archive.goals.map(withOwner));
  await put('tasks', archive.tasks.map(task => ({ ...withOwner(task), image_path: taskAttachmentPaths.get(task.id) ?? null })));
  await put('schedules', archive.schedules.map(withOwner));
  await put('routines', archive.routines.map(withOwner));
  await put('deadlines', archive.deadlines.map(withOwner));

  const { error: identityError } = await client.from('legacy_dexie_identities').upsert({
    provider: 'dexie_cloud', legacy_user_id: archive.owner.dexieUserId, legacy_email: archive.owner.email,
    user_id: user.id, migrated_at: new Date().toISOString(),
  }, { onConflict: 'provider,legacy_user_id' });
  if (identityError) throw identityError;

  if (archive.profile) {
    const { error } = await client.from('profiles').update({ nickname: archive.profile.nickname, avatar_path: profileAvatarPath, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) throw error;
  }

  return { imported: { tasks: archive.tasks.length, schedules: archive.schedules.length, routines: archive.routines.length, domains: archive.domains.length, goals: archive.goals.length, deadlines: archive.deadlines.length, attachments: archive.attachments.length } };
}
