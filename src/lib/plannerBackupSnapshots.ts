import { createPortablePlannerExport, parsePortablePlannerExport, type PortablePlannerExport } from './portablePlannerExport';
import { supabase } from './supabase';

const BUCKET = 'planner-backups';
const KEEP = 7;
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type PlannerCloudSnapshot = {
  path: string;
  name: string;
  createdAt: string;
};

export type PlannerCloudSnapshotList = {
  snapshots: PlannerCloudSnapshot[];
  available: boolean;
};

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function isMissingBucket(error: { message?: string } | null) {
  const message = error?.message ?? '';
  return /bucket not found/i.test(message);
}

function downloadTextFile(filename: string, contents: string) {
  const file = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function listPlannerCloudSnapshots(): Promise<PlannerCloudSnapshotList> {
  if (!supabase) return { snapshots: [], available: false };
  const ownerId = await currentUserId();
  if (!ownerId) return { snapshots: [], available: false };
  const { data, error } = await supabase.storage.from(BUCKET).list(ownerId, {
    limit: 50,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) {
    if (isMissingBucket(error)) return { snapshots: [], available: false };
    throw error;
  }
  const snapshots = (data ?? [])
    .filter(file => file.name.endsWith('.json'))
    .map(file => ({
      path: `${ownerId}/${file.name}`,
      name: file.name,
      createdAt: file.created_at ?? file.updated_at ?? new Date().toISOString(),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { snapshots, available: true };
}

async function prunePlannerCloudSnapshots() {
  if (!supabase) return;
  const { snapshots, available } = await listPlannerCloudSnapshots();
  if (!available) return;
  const extra = snapshots.slice(KEEP);
  if (extra.length === 0) return;
  await supabase.storage.from(BUCKET).remove(extra.map(file => file.path));
}

export async function savePlannerCloudSnapshot() {
  if (!supabase) throw new Error('로그인 설정이 되어 있지 않습니다.');
  const ownerId = await currentUserId();
  if (!ownerId) throw new Error('로그인한 뒤에 사본을 남길 수 있습니다.');
  const archive = await createPortablePlannerExport();
  const stamp = archive.exportedAt.replace(/[:.]/g, '-');
  const path = `${ownerId}/${stamp}.json`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob([JSON.stringify(archive)], { type: 'application/json' }), {
    upsert: false,
    contentType: 'application/json',
  });
  if (error) throw error;
  await prunePlannerCloudSnapshots();
  return { path, name: `${stamp}.json`, createdAt: archive.exportedAt };
}

export async function maybeSavePlannerCloudSnapshot() {
  const listed = await listPlannerCloudSnapshots();
  if (!listed.available) return;
  const newest = listed.snapshots[0];
  if (newest && Date.now() - Date.parse(newest.createdAt) < MIN_INTERVAL_MS) return;
  await savePlannerCloudSnapshot();
}

export async function readPlannerCloudSnapshot(path: string): Promise<PortablePlannerExport> {
  if (!supabase) throw new Error('로그인 설정이 되어 있지 않습니다.');
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error('사본을 읽지 못했습니다.');
  return parsePortablePlannerExport(await data.text());
}

export async function downloadPlannerCloudSnapshot(path: string) {
  const archive = await readPlannerCloudSnapshot(path);
  const day = archive.exportedAt.slice(0, 10);
  downloadTextFile(`gichanplan-backup-${day}.json`, JSON.stringify(archive));
}
