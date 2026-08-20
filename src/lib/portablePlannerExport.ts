import { db, type Deadline, type Domain, type Goal, type Profile, type Project, type Routine, type Schedule, type Task } from './db';
import { dataUrlToBlob } from './imageAttachment';

const EXPORT_VERSION = 1 as const;

export type PortableAttachment = {
  id: string;
  owner: 'task' | 'profile';
  ownerId: string;
  mimeType: string;
  base64: string;
};

export type PortablePlannerExport = {
  format: 'gichanplan-portable';
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  owner: {
    dexieUserId: string | null;
    email: string | null;
    nickname: string | null;
  };
  profile: Omit<Profile, 'avatar'> | null;
  tasks: Array<Omit<Task, 'image_blob' | 'image_data'>>;
  schedules: Schedule[];
  routines: Routine[];
  domains: Domain[];
  goals: Goal[];
  deadlines: Deadline[];
  projects?: Project[];
  attachments: PortableAttachment[];
};

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createPortablePlannerExport(): Promise<PortablePlannerExport> {
  const [tasks, schedules, routines, domains, goals, deadlines, projects, profile] = await Promise.all([
    db.tasks.toArray(), db.schedules.toArray(), db.routines.toArray(), db.domains.toArray(),
    db.goals.toArray(), db.deadlines.toArray(), db.projects.toArray(), db.profiles.get('#profile'),
  ]);
  const attachments: PortableAttachment[] = [];
  for (const task of tasks) {
    const blob = task.image_blob ?? (task.image_data ? await dataUrlToBlob(task.image_data) : null);
    if (!blob) continue;
    attachments.push({ id: `task:${task.id}`, owner: 'task', ownerId: task.id, mimeType: blob.type || 'image/webp', base64: await blobToBase64(blob) });
  }
  if (profile?.avatar) attachments.push({ id: 'profile:avatar', owner: 'profile', ownerId: profile.id, mimeType: profile.avatar.type || 'image/webp', base64: await blobToBase64(profile.avatar) });

  const portableProfile = profile ? (() => {
    const { avatar: _avatar, ...rest } = profile;
    return rest;
  })() : null;
  return {
    format: 'gichanplan-portable', version: EXPORT_VERSION, exportedAt: new Date().toISOString(),
    owner: { dexieUserId: profile?.legacy_dexie_user_id ?? null, email: profile?.email ?? null, nickname: profile?.nickname ?? null },
    profile: portableProfile,
    tasks: tasks.map(({ image_blob: _blob, image_data: _legacyImage, ...task }) => task),
    schedules, routines, domains, goals, deadlines, projects, attachments,
  };
}

export function validatePortablePlannerExport(value: unknown): value is PortablePlannerExport {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortablePlannerExport>;
  return candidate.format === 'gichanplan-portable' && candidate.version === EXPORT_VERSION
    && Array.isArray(candidate.tasks) && Array.isArray(candidate.attachments);
}

export function parsePortablePlannerExport(text: string): PortablePlannerExport {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('이 파일은 플래너 백업이 아닙니다.');
  }
  if (!validatePortablePlannerExport(value)) throw new Error('이 파일은 플래너 백업이 아닙니다.');
  return value;
}

export async function downloadPortablePlannerExport() {
  const archive = await createPortablePlannerExport();
  const file = new Blob([JSON.stringify(archive)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `gichanplan-backup-${archive.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
