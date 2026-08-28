import { db, type Deadline, type Domain, type Goal, type Profile, type Project, type Routine, type Schedule, type Task } from './db';
import { dataUrlToBlob } from './imageAttachment';

const EXPORT_VERSION = 1 as const;
// A backup is opened in memory before it is checked. Keep an accidental or
// hostile import from exhausting the tab while still allowing many photos.
export const MAX_PORTABLE_EXPORT_BYTES = 100 * 1024 * 1024;

export type PortableAttachment = {
  id: string;
  owner: 'task' | 'profile';
  ownerId: string;
  mimeType: string;
  base64: string;
};

export type PortablePlannerExport = {
  format: 'gichanplan-portable';
  version: number;
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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || isNullableString(value);
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value));
}

function isNullableTimestamp(value: unknown): boolean {
  return value === null || isTimestamp(value);
}

function isOptionalNullableTimestamp(value: unknown): boolean {
  return value === undefined || isNullableTimestamp(value);
}

function isDay(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isId(value: unknown): value is string {
  return isString(value) && value.length > 0 && value.length <= 200;
}

function isStampedRow(value: unknown): value is UnknownRecord {
  return isRecord(value)
    && isId(value.id)
    && Number.isSafeInteger(value.version) && (value.version as number) >= 1
    && isTimestamp(value.created_at)
    && isTimestamp(value.updated_at)
    && isNullableTimestamp(value.deleted_at);
}

function isOptionalId(value: unknown): boolean {
  return value === undefined || isNullableString(value);
}

function isOptionalBirthday(value: unknown, maximum: number): boolean {
  return value === undefined || value === null || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= maximum);
}

function isTaskRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.title)
    && isDay(value.target_date)
    && isOptionalNullableTimestamp(value.deadline)
    && isOptionalNullableTimestamp(value.scheduled_time)
    && isOptionalId(value.domain_id)
    && isOptionalId(value.goal_id)
    && isOptionalId(value.project_id)
    && typeof value.is_important === 'boolean'
    && typeof value.is_completed === 'boolean'
    && isString(value.memo)
    && Number.isSafeInteger(value.order)
    && isOptionalNullableString(value.image_path);
}

function isScheduleRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.title)
    && isDay(value.target_date)
    && isTimestamp(value.start_time)
    && isTimestamp(value.end_time)
    && isOptionalId(value.domain_id);
}

function isRoutineRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.title)
    && isOptionalId(value.domain_id)
    && isString(value.recurrence_rule)
    && isDay(value.start_date);
}

function isDomainRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.name)
    && isString(value.icon)
    && isString(value.color)
    && Number.isSafeInteger(value.order)
    && typeof value.is_archived === 'boolean';
}

function isGoalRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isOptionalId(value.domain_id)
    && (value.time_frame === 'TODAY' || value.time_frame === 'WEEK' || value.time_frame === 'MONTH' || value.time_frame === 'CUSTOM')
    && isDay(value.start_date)
    && isDay(value.end_date)
    && isString(value.title)
    && typeof value.is_completed === 'boolean';
}

function isDeadlineRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.title)
    && isString(value.memo)
    && isDay(value.due_date)
    && (value.due_time === undefined || isNullableTimestamp(value.due_time))
    && (value.reminder_days === null || Number.isSafeInteger(value.reminder_days))
    && isOptionalId(value.project_id);
}

function isProjectRow(value: unknown): boolean {
  if (!isStampedRow(value)) return false;
  return isString(value.title)
    && isString(value.icon)
    && isOptionalId(value.domain_id)
    && (value.due_date === null || isDay(value.due_date))
    && Number.isSafeInteger(value.order);
}

function isProfileRow(value: unknown): boolean {
  if (!isRecord(value) || value.id !== '#profile') return false;
  return isString(value.nickname)
    && isOptionalNullableString(value.avatar_path)
    && isNullableString(value.legacy_dexie_user_id)
    && isNullableString(value.email)
    && isOptionalBirthday(value.birthday_month, 12)
    && isOptionalBirthday(value.birthday_day, 31)
    && isTimestamp(value.created_at)
    && isTimestamp(value.updated_at);
}

function hasUniqueIds(rows: unknown[]): boolean {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isRecord(row) || !isId(row.id) || ids.has(row.id)) return false;
    ids.add(row.id);
  }
  return true;
}

function isBase64(value: unknown): value is string {
  return isString(value)
    && value.length > 0
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

function areValidAttachments(attachments: unknown[], taskIds: Set<string>, hasProfile: boolean): boolean {
  const ids = new Set<string>();
  let totalEncodedBytes = 0;
  for (const attachment of attachments) {
    if (!isRecord(attachment)
      || !isId(attachment.id)
      || ids.has(attachment.id)
      || !isBase64(attachment.base64)
      || !isString(attachment.mimeType)
      || !attachment.mimeType.startsWith('image/')
      || (attachment.owner !== 'task' && attachment.owner !== 'profile')
      || !isId(attachment.ownerId)) return false;
    totalEncodedBytes += attachment.base64.length;
    if (totalEncodedBytes > MAX_PORTABLE_EXPORT_BYTES) return false;
    if (attachment.owner === 'task') {
      if (attachment.id !== `task:${attachment.ownerId}` || !taskIds.has(attachment.ownerId)) return false;
    } else if (!hasProfile || attachment.id !== 'profile:avatar' || attachment.ownerId !== '#profile') {
      return false;
    }
    ids.add(attachment.id);
  }
  return true;
}

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
  if (!isRecord(value)) return false;
  const candidate = value as Partial<PortablePlannerExport>;
  if (candidate.format !== 'gichanplan-portable'
    || !Number.isInteger(candidate.version)
    || (candidate.version as number) < 1
    || (candidate.version as number) > EXPORT_VERSION
    || !isTimestamp(candidate.exportedAt)
    || !isRecord(candidate.owner)
    || !isNullableString(candidate.owner.dexieUserId)
    || !isNullableString(candidate.owner.email)
    || !isNullableString(candidate.owner.nickname)
    || !(candidate.profile === null || isProfileRow(candidate.profile))
    || !Array.isArray(candidate.tasks)
    || !Array.isArray(candidate.schedules)
    || !Array.isArray(candidate.routines)
    || !Array.isArray(candidate.domains)
    || !Array.isArray(candidate.goals)
    || !Array.isArray(candidate.deadlines)
    || !(candidate.projects === undefined || Array.isArray(candidate.projects))
    || !Array.isArray(candidate.attachments)) return false;

  const tables: Array<[unknown[], (row: unknown) => boolean]> = [
    [candidate.tasks, isTaskRow],
    [candidate.schedules, isScheduleRow],
    [candidate.routines, isRoutineRow],
    [candidate.domains, isDomainRow],
    [candidate.goals, isGoalRow],
    [candidate.deadlines, isDeadlineRow],
    [candidate.projects ?? [], isProjectRow],
  ];
  if (tables.some(([rows, validRow]) => !hasUniqueIds(rows) || rows.some(row => !validRow(row)))) return false;
  const taskIds = new Set(candidate.tasks.map(task => (task as { id: string }).id));
  return areValidAttachments(candidate.attachments, taskIds, candidate.profile !== null);
}

export function parsePortablePlannerExport(text: string): PortablePlannerExport {
  if (text.length > MAX_PORTABLE_EXPORT_BYTES) throw new Error('백업 파일이 너무 큽니다.');
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
