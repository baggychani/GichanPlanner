import Dexie, { type EntityTable } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';

export interface Task {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  title: string;
  target_date: string; // YYYY-MM-DD format
  deadline: string | null; // ISO string
  scheduled_time: string | null; // ISO string, time selected for the task
  domain_id: string | null;
  goal_id: string | null;
  is_important: boolean;
  is_completed: boolean;
  memo: string;
  order: number;
  image_data?: string | null;
}

export interface Schedule {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  title: string;
  target_date: string; // YYYY-MM-DD
  start_time: string; // ISO
  end_time: string; // ISO
  domain_id: string | null;
}

export interface Routine {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  title: string;
  domain_id: string | null;
  recurrence_rule: string;
  start_date: string;
}

export interface Domain {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  name: string;
  icon: string;
  color: string;
  order: number;
  is_archived: boolean;
}

export interface Goal {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  domain_id: string | null;
  time_frame: 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
  start_date: string;
  end_date: string;
  title: string;
  is_completed: boolean;
}

export interface Deadline {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  title: string;
  memo: string;
  due_date: string; // YYYY-MM-DD
  reminder_days: number | null;
}

// `#profile` is a Dexie Cloud private singleton: one profile per account,
// while remaining a normal exportable record for a later backend migration.
export interface Profile {
  id: '#profile';
  nickname: string;
  avatar: Blob | null;
  updated_at: string;
}

const db = new Dexie('GichanPlanDB', { addons: [dexieCloud] }) as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  schedules: EntityTable<Schedule, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  domains: EntityTable<Domain, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  deadlines: EntityTable<Deadline, 'id'>;
  profiles: EntityTable<Profile, 'id'>;
};

db.version(5).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
});

db.version(6).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
}).upgrade(async (transaction) => {
  await transaction.table('tasks').toCollection().modify((task: Task) => {
    if (task.scheduled_time === undefined) {
      task.scheduled_time = task.deadline;
      task.deadline = null;
    }
  });
});

db.version(7).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
});

db.version(8).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
  profiles: 'id',
});

const dexieCloudUrl = import.meta.env.VITE_DEXIE_CLOUD_URL;
if (dexieCloudUrl) {
  db.cloud.configure({
    databaseUrl: dexieCloudUrl,
    // Login stays opt-in so existing local data can be inspected and imported deliberately.
    requireAuth: false,
    socialAuth: true,
    blobMode: 'lazy',
  });
}

export const isDexieCloudConfigured = Boolean(dexieCloudUrl);

export { db };
