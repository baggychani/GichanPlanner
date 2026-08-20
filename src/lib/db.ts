import Dexie, { type EntityTable } from 'dexie';

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
  project_id: string | null;
  is_important: boolean;
  is_completed: boolean;
  memo: string;
  order: number;
  // New uploads are compressed Blobs. `image_data` remains only for upgrading old local records.
  image_blob?: Blob | null;
  image_data?: string | null;
  // null = 사진을 지움. undefined = 아직 계정 경로를 모름.
  image_path?: string | null;
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
  due_time: string | null; // ISO string, optional time on the due date
  reminder_days: number | null;
  project_id: string | null;
}

export interface Project {
  id: string;
  version: number;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;

  title: string;
  icon: string;
  domain_id: string | null;
  due_date: string | null;
  order: number;
}

export interface Profile {
  id: '#profile';
  nickname: string;
  avatar: Blob | null;
  avatar_path?: string | null;
  legacy_dexie_user_id: string | null;
  email: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  created_at: string;
  updated_at: string;
}

export interface CloudShadow {
  id: string;
  updated_at: string;
  version: number;
  body: string;
}

const db = new Dexie('GichanPlanDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  schedules: EntityTable<Schedule, 'id'>;
  routines: EntityTable<Routine, 'id'>;
  domains: EntityTable<Domain, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  deadlines: EntityTable<Deadline, 'id'>;
  projects: EntityTable<Project, 'id'>;
  profiles: EntityTable<Profile, 'id'>;
  cloudShadows: EntityTable<CloudShadow, 'id'>;
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

db.version(9).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
  profiles: 'id',
});

db.version(10).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
  profiles: 'id',
}).upgrade(async (transaction) => {
  await transaction.table('deadlines').toCollection().modify((deadline: Deadline) => {
    if (deadline.due_time === undefined) deadline.due_time = null;
  });
});

db.version(11).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
  profiles: 'id',
}).upgrade(async (transaction) => {
  await transaction.table('profiles').toCollection().modify((profile: Profile) => {
    if (profile.birthday_month === undefined) profile.birthday_month = null;
    if (profile.birthday_day === undefined) profile.birthday_day = null;
  });
});

db.version(12).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, project_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at',
  projects: 'id, deleted_at, order',
  profiles: 'id',
}).upgrade(async (transaction) => {
  await transaction.table('tasks').toCollection().modify((task: Task) => {
    if (task.project_id === undefined) task.project_id = null;
  });
});

db.version(13).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, project_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at, project_id',
  projects: 'id, deleted_at, order',
  profiles: 'id',
}).upgrade(async (transaction) => {
  await transaction.table('deadlines').toCollection().modify((deadline: Deadline) => {
    if (deadline.project_id === undefined) deadline.project_id = null;
  });
});

db.version(14).stores({
  tasks: 'id, target_date, is_completed, is_important, deleted_at, domain_id, project_id, order',
  schedules: 'id, target_date, start_time, deleted_at',
  routines: 'id, start_date, deleted_at',
  domains: 'id, deleted_at, order',
  goals: 'id, time_frame, start_date, deleted_at',
  deadlines: 'id, due_date, deleted_at, project_id',
  projects: 'id, deleted_at, order',
  profiles: 'id',
  cloudShadows: 'id',
});

export { db };
