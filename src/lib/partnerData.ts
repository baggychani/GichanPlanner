import type { Deadline, Domain, Goal, Project, Routine, Schedule, Task } from './db';
import { SIMPLE_SYNC_TABLES, taskFromRemote, type RemoteStamp, type RemoteTask } from './plannerSyncSchema';
import { supabase } from './supabase';

export type PartnerPlanner = {
  tasks: Task[];
  schedules: Schedule[];
  routines: Routine[];
  domains: Domain[];
  goals: Goal[];
  deadlines: Deadline[];
  projects: Project[];
};

const EMPTY_PLANNER: PartnerPlanner = { tasks: [], schedules: [], routines: [], domains: [], goals: [], deadlines: [], projects: [] };

// A partner's data never touches Dexie or the sync/merge engine: it is a
// read-only, online-only snapshot fetched straight from Supabase and held
// only in React state, so it can never leak into this device's own
// write-sync path. Row shapes are decoded with the same fromRemote mappers
// the sync engine uses, to avoid a second implementation of that mapping.
export async function fetchPartnerPlanner(partnerId: string): Promise<PartnerPlanner> {
  if (!supabase) return EMPTY_PLANNER;
  const client = supabase;
  const specs = SIMPLE_SYNC_TABLES;

  const [taskRes, simpleRes] = await Promise.all([
    client.from('tasks').select('*').eq('owner_id', partnerId).is('deleted_at', null),
    Promise.all(specs.map(spec => client.from(spec.name).select('*').eq('owner_id', partnerId).is('deleted_at', null))),
  ]);
  if (taskRes.error) throw taskRes.error;
  for (const res of simpleRes) if (res.error) throw res.error;

  const byName: Record<string, unknown[]> = {};
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    byName[spec.name] = ((simpleRes[index].data ?? []) as RemoteStamp[]).map(row => spec.fromRemote(row as never));
  }

  return {
    // Task photos are skipped here on purpose: downloading every attachment
    // just to render a read-only day list is not worth the bandwidth. Photos
    // simply don't show in the partner view for now.
    tasks: ((taskRes.data ?? []) as RemoteTask[]).map(row => taskFromRemote(row, null)),
    schedules: byName.schedules as Schedule[],
    routines: byName.routines as Routine[],
    domains: byName.domains as Domain[],
    goals: byName.goals as Goal[],
    deadlines: byName.deadlines as Deadline[],
    projects: byName.projects as Project[],
  };
}
