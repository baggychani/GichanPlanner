import type { DropResult } from '@hello-pangea/dnd';
import { db, type Domain, type Task } from './db';
import { deadlineOnDate } from './datetime';
import { runPlannerWrite } from './supabaseSync';

export function createBlankTask(targetDate: string): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    title: '',
    memo: '',
    target_date: targetDate,
    deadline: null,
    scheduled_time: null,
    domain_id: null,
    goal_id: null,
    project_id: null,
    is_important: false,
    is_completed: false,
    order: 0,
    image_blob: null,
    image_data: null,
    image_path: null,
  };
}

export async function toggleTaskCompleted(taskId: string) {
  return runPlannerWrite(async () => {
    const current = await db.tasks.get(taskId);
    if (!current || current.deleted_at !== null) return;
    await db.tasks.update(taskId, {
      is_completed: !current.is_completed,
      updated_at: new Date().toISOString(),
      version: current.version + 1,
    });
  });
}

export async function toggleGoalCompleted(goalId: string) {
  return runPlannerWrite(async () => {
    const current = await db.goals.get(goalId);
    if (!current || current.deleted_at !== null) return;
    await db.goals.update(goalId, {
      is_completed: !current.is_completed,
      updated_at: new Date().toISOString(),
      version: current.version + 1,
    });
  });
}

export function taskMatchesCategory(task: Task, categoryId: string | null, activeCategoryIds: Set<string>) {
  if (categoryId === null) return task.domain_id === null || !activeCategoryIds.has(task.domain_id);
  return task.domain_id === categoryId;
}

export async function moveIncompleteTasksToDate(sourceDate: string, destinationDate: string) {
  if (sourceDate === destinationDate) return;
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, async () => {
    const [sourceTasks, destinationTasks] = await Promise.all([
      db.tasks.where('target_date').equals(sourceDate).toArray(),
      db.tasks.where('target_date').equals(destinationDate).toArray(),
    ]);
    const movingTasks = sourceTasks.filter(task => task.deleted_at === null && !task.is_completed);
    if (movingTasks.length === 0) return;
    const now = new Date().toISOString();
    const nextOrderByDomain = new Map<string | null, number>();
    for (const task of destinationTasks.filter(task => task.deleted_at === null)) {
      nextOrderByDomain.set(task.domain_id, Math.max(nextOrderByDomain.get(task.domain_id) ?? -1, task.order));
    }
    const moved = movingTasks.map(task => {
      const order = (nextOrderByDomain.get(task.domain_id) ?? -1) + 1;
      nextOrderByDomain.set(task.domain_id, order);
      return { ...task, target_date: destinationDate, deadline: deadlineOnDate(task.deadline, destinationDate), scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate), order, updated_at: now, version: task.version + 1 };
    });
    const remaining = sourceTasks.filter(task => task.deleted_at === null && task.is_completed);
    const normalizedRemaining = remaining
      .sort((a, b) => a.domain_id === b.domain_id ? a.order - b.order : String(a.domain_id).localeCompare(String(b.domain_id)))
      .map((task, index, all) => {
        const order = all.slice(0, index).filter(previous => previous.domain_id === task.domain_id).length;
        return task.order === order ? task : { ...task, order, updated_at: now, version: task.version + 1 };
      });
    await db.tasks.bulkPut([...moved, ...normalizedRemaining]);
  });
  });
}

export async function copyAllTasksToDate(sourceDate: string, destinationDate: string) {
  if (sourceDate === destinationDate) return;
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, async () => {
    const [sourceTasks, destinationTasks] = await Promise.all([
      db.tasks.where('target_date').equals(sourceDate).toArray(),
      db.tasks.where('target_date').equals(destinationDate).toArray(),
    ]);
    const now = new Date().toISOString();
    const nextOrderByDomain = new Map<string | null, number>();
    for (const task of destinationTasks.filter(task => task.deleted_at === null)) {
      nextOrderByDomain.set(task.domain_id, Math.max(nextOrderByDomain.get(task.domain_id) ?? -1, task.order));
    }
    const copies = sourceTasks.filter(task => task.deleted_at === null).map(task => {
      const order = (nextOrderByDomain.get(task.domain_id) ?? -1) + 1;
      nextOrderByDomain.set(task.domain_id, order);
      return {
        ...task,
        id: crypto.randomUUID(),
        version: 1,
        created_at: now,
        updated_at: now,
        target_date: destinationDate,
        deadline: deadlineOnDate(task.deadline, destinationDate),
        scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate),
        is_completed: false,
        order,
        image_path: null,
      };
    });
    if (copies.length > 0) await db.tasks.bulkPut(copies);
  });
  });
}

export async function deleteDayTasks(sourceDate: string, incompleteOnly: boolean) {
  return runPlannerWrite(async () => {
  const dayTasks = await db.tasks.where('target_date').equals(sourceDate).toArray();
  const now = new Date().toISOString();
  const targets = dayTasks.filter(task => task.deleted_at === null && (!incompleteOnly || !task.is_completed));
  if (targets.length > 0) await db.tasks.bulkPut(targets.map(task => ({ ...task, deleted_at: now, updated_at: now, version: task.version + 1 })));
  });
}

export async function moveTaskToDate(taskId: string, destinationDate: string) {
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(taskId);
    if (!task || task.deleted_at !== null || task.target_date === destinationDate) return;

    const [sourceTasks, destinationTasks] = await Promise.all([
      db.tasks.where('target_date').equals(task.target_date).toArray(),
      db.tasks.where('target_date').equals(destinationDate).toArray(),
    ]);
    const remainingSourceTasks = sourceTasks
      .filter(candidate => candidate.deleted_at === null && candidate.domain_id === task.domain_id && candidate.id !== task.id)
      .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));
    const destinationOrder = destinationTasks.filter(candidate =>
      candidate.deleted_at === null && candidate.domain_id === task.domain_id
    ).length;
    const now = new Date().toISOString();

    await db.tasks.bulkPut([
      ...remainingSourceTasks.map((candidate, order) => ({
        ...candidate,
        order,
        updated_at: candidate.order === order ? candidate.updated_at : now,
        version: candidate.order === order ? candidate.version : candidate.version + 1,
      })),
      {
        ...task,
        target_date: destinationDate,
        deadline: deadlineOnDate(task.deadline, destinationDate),
        scheduled_time: deadlineOnDate(task.scheduled_time, destinationDate),
        order: destinationOrder,
        updated_at: now,
        version: task.version + 1,
      },
    ]);
  });
  });
}

export function applyTaskReorder(currentTasks: Task[], dateStr: string, result: DropResult): Task[] | null {
  const { destination, source, draggableId } = result;
  if (!destination) return null;

  const sourceDomainId = source.droppableId === 'unassigned' ? null : source.droppableId;
  const destDomainId = destination.droppableId === 'unassigned' ? null : destination.droppableId;
  const sourceTasks = currentTasks.filter(task => task.target_date === dateStr && task.domain_id === sourceDomainId);
  const destinationTasks = source.droppableId === destination.droppableId
    ? sourceTasks
    : currentTasks.filter(task => task.target_date === dateStr && task.domain_id === destDomainId);
  const sourceIndex = sourceTasks.findIndex(task => task.id === draggableId);
  if (sourceIndex === -1) return null;

  const [taskToMove] = sourceTasks.splice(sourceIndex, 1);
  const destinationIndex = Math.min(destination.index, destinationTasks.length);
  if (source.droppableId === destination.droppableId) {
    sourceTasks.splice(destinationIndex, 0, taskToMove);
  } else {
    destinationTasks.splice(destinationIndex, 0, { ...taskToMove, domain_id: destDomainId });
  }

  const replacements = new Map<string, Task>();
  const orderTasks = (group: Task[]) => group.forEach((task, index) => {
    replacements.set(task.id, { ...task, order: index });
  });
  orderTasks(sourceTasks);
  if (source.droppableId !== destination.droppableId) orderTasks(destinationTasks);

  return currentTasks.map(task => replacements.get(task.id) ?? task);
}

export async function persistTaskReorder(dateStr: string, result: DropResult) {
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, async () => {
    const storedTasks = (await db.tasks.where('target_date').equals(dateStr).toArray())
      .filter(task => task.deleted_at === null);
    const reorderedTasks = applyTaskReorder(storedTasks, dateStr, result);
    if (!reorderedTasks) return;

    const now = new Date().toISOString();
    await db.tasks.bulkPut(reorderedTasks.map(task => {
      const previous = storedTasks.find(storedTask => storedTask.id === task.id)!;
      const changed = previous.order !== task.order || previous.domain_id !== task.domain_id;
      return changed
        ? { ...task, updated_at: now, version: previous.version + 1 }
        : task;
    }));
  });
  });
}

export async function reorderCategories(categories: Domain[], result: DropResult) {
  const { destination, source } = result;
  if (!destination || destination.index === source.index) return;
  return runPlannerWrite(async () => {
  const items = Array.from(categories);
  const [reorderedItem] = items.splice(source.index, 1);
  items.splice(destination.index, 0, reorderedItem);
  const now = new Date().toISOString();
  await db.domains.bulkPut(items.map((cat, index) => ({
    ...cat,
    order: index,
    updated_at: now,
    version: cat.version + 1,
  })));
  });
}

export async function deleteCategory(categoryId: string) {
  return runPlannerWrite(async () => {
  await db.transaction('rw', [db.tasks, db.schedules, db.routines, db.domains, db.goals, db.projects], async () => {
    const now = new Date().toISOString();
    const [categoryTasks, categorySchedules, categoryRoutines, categoryGoals, categoryProjects] = await Promise.all([
      db.tasks.where('domain_id').equals(categoryId).toArray(),
      db.schedules.filter(schedule => schedule.domain_id === categoryId && schedule.deleted_at === null).toArray(),
      db.routines.filter(routine => routine.domain_id === categoryId && routine.deleted_at === null).toArray(),
      db.goals.filter(goal => goal.domain_id === categoryId && goal.deleted_at === null).toArray(),
      db.projects.filter(project => project.domain_id === categoryId && project.deleted_at === null).toArray(),
    ]);
    const activeTasks = categoryTasks.filter(task => task.deleted_at === null);
    if (activeTasks.length > 0) {
      await db.tasks.bulkPut(activeTasks.map(task => ({
        ...task,
        domain_id: null,
        updated_at: now,
        version: task.version + 1,
      })));
    }
    if (categorySchedules.length > 0) await db.schedules.bulkPut(categorySchedules.map(schedule => ({ ...schedule, domain_id: null, updated_at: now, version: schedule.version + 1 })));
    if (categoryRoutines.length > 0) await db.routines.bulkPut(categoryRoutines.map(routine => ({ ...routine, domain_id: null, updated_at: now, version: routine.version + 1 })));
    if (categoryGoals.length > 0) await db.goals.bulkPut(categoryGoals.map(goal => ({ ...goal, domain_id: null, updated_at: now, version: goal.version + 1 })));
    if (categoryProjects.length > 0) await db.projects.bulkPut(categoryProjects.map(project => ({ ...project, domain_id: null, updated_at: now, version: project.version + 1 })));
    const category = await db.domains.get(categoryId);
    if (category) await db.domains.put({ ...category, deleted_at: now, updated_at: now, version: category.version + 1 });
  });
  });
}

export async function deleteProject(projectId: string) {
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, db.deadlines, db.projects, async () => {
    const now = new Date().toISOString();
    const [projectTasks, projectDeadlines] = await Promise.all([
      db.tasks.where('project_id').equals(projectId).toArray(),
      db.deadlines.where('project_id').equals(projectId).toArray(),
    ]);
    const activeTasks = projectTasks.filter(task => task.deleted_at === null);
    const activeDeadlines = projectDeadlines.filter(deadline => deadline.deleted_at === null);
    if (activeTasks.length > 0) {
      await db.tasks.bulkPut(activeTasks.map(task => ({
        ...task,
        project_id: null,
        updated_at: now,
        version: task.version + 1,
      })));
    }
    if (activeDeadlines.length > 0) {
      await db.deadlines.bulkPut(activeDeadlines.map(deadline => ({
        ...deadline,
        project_id: null,
        updated_at: now,
        version: deadline.version + 1,
      })));
    }
    const project = await db.projects.get(projectId);
    if (project) await db.projects.put({ ...project, deleted_at: now, updated_at: now, version: project.version + 1 });
  });
  });
}

export async function deleteGoal(goalId: string) {
  return runPlannerWrite(async () => {
  await db.transaction('rw', db.tasks, db.goals, async () => {
    const now = new Date().toISOString();
    const linkedTasks = await db.tasks.filter(task => task.goal_id === goalId && task.deleted_at === null).toArray();
    if (linkedTasks.length > 0) {
      await db.tasks.bulkPut(linkedTasks.map(task => ({
        ...task,
        goal_id: null,
        updated_at: now,
        version: task.version + 1,
      })));
    }
    const goal = await db.goals.get(goalId);
    if (goal && goal.deleted_at === null) {
      await db.goals.put({ ...goal, deleted_at: now, updated_at: now, version: goal.version + 1 });
    }
  });
  });
}

export function nextOrderFor(tasks: Task[], dateStr: string, domainId: string | null) {
  return tasks
    .filter(task => task.target_date === dateStr && task.domain_id === domainId)
    .reduce((maximum, task) => Math.max(maximum, task.order), -1) + 1;
}
