(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TodoStore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRIORITIES = ['low', 'medium', 'high'];
  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
  const FILTERS = ['all', 'active', 'completed'];
  const SORTS = ['manual', 'newest', 'priority', 'dueDate'];

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function normalizePriority(priority) {
    return PRIORITIES.includes(priority) ? priority : 'medium';
  }

  function normalizeDueDate(dueDate) {
    if (typeof dueDate !== 'string') return '';
    const trimmed = dueDate.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
  }

  function normalizeCategory(category) {
    if (typeof category !== 'string') return '';
    return category.trim().slice(0, 32);
  }

  function getTodayDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function createTask(input, now = Date.now(), id = generateId()) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    if (!title) {
      return null;
    }

    return {
      id: String(id),
      title: title.slice(0, 200),
      completed: Boolean(input.completed),
      priority: normalizePriority(input.priority),
      dueDate: normalizeDueDate(input.dueDate),
      category: normalizeCategory(input.category),
      createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
      updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
    };
  }

  function addTask(tasks, input, now = Date.now(), id = generateId()) {
    const task = createTask(input, now, id);
    if (!task) return tasks.slice();
    return [task, ...tasks];
  }

  function toggleTask(tasks, id, now = Date.now()) {
    return tasks.map((task) =>
      task.id === id
        ? { ...task, completed: !task.completed, updatedAt: now }
        : task
    );
  }

  function updateTask(tasks, id, patch, now = Date.now()) {
    return tasks.map((task) => {
      if (task.id !== id) return task;

      const nextTitle =
        patch && typeof patch.title === 'string'
          ? patch.title.trim().slice(0, 200)
          : task.title;

      if (!nextTitle) return task;

      return {
        ...task,
        title: nextTitle,
        priority:
          patch && 'priority' in patch
            ? normalizePriority(patch.priority)
            : task.priority,
        dueDate:
          patch && 'dueDate' in patch
            ? normalizeDueDate(patch.dueDate)
            : task.dueDate,
        category:
          patch && 'category' in patch
            ? normalizeCategory(patch.category)
            : task.category,
        updatedAt: now,
      };
    });
  }

  function deleteTask(tasks, id) {
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return { tasks: tasks.slice(), removed: null, index: -1 };
    }
    const removed = tasks[index];
    const next = tasks.slice(0, index).concat(tasks.slice(index + 1));
    return { tasks: next, removed, index };
  }

  function restoreTask(tasks, task, index) {
    if (!task) return tasks.slice();
    const withoutDup = tasks.filter((item) => item.id !== task.id);
    const safeIndex = Math.max(0, Math.min(index, withoutDup.length));
    return withoutDup
      .slice(0, safeIndex)
      .concat([task], withoutDup.slice(safeIndex));
  }

  function clearCompleted(tasks) {
    return tasks.filter((task) => !task.completed);
  }

  function toggleAll(tasks, completed, now = Date.now()) {
    const target = Boolean(completed);
    return tasks.map((task) =>
      task.completed === target
        ? task
        : { ...task, completed: target, updatedAt: now }
    );
  }

  function reorderTasks(tasks, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return tasks.slice();
    const fromIndex = tasks.findIndex((task) => task.id === fromId);
    const toIndex = tasks.findIndex((task) => task.id === toId);
    if (fromIndex === -1 || toIndex === -1) return tasks.slice();

    const next = tasks.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function isOverdue(task, todayStr = getTodayDateString()) {
    return Boolean(!task.completed && task.dueDate && task.dueDate < todayStr);
  }

  function filterAndSortTasks(tasks, options = {}) {
    const filter = FILTERS.includes(options.filter) ? options.filter : 'all';
    const priority = PRIORITIES.includes(options.priority) ? options.priority : 'all';
    const search = typeof options.search === 'string' ? options.search.trim().toLowerCase() : '';
    const sort = SORTS.includes(options.sort) ? options.sort : 'manual';

    const filtered = tasks.filter((task) => {
      if (filter === 'active' && task.completed) return false;
      if (filter === 'completed' && !task.completed) return false;
      if (priority !== 'all' && task.priority !== priority) return false;
      if (search) {
        const hay = `${task.title} ${task.category || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    if (sort === 'manual') {
      return filtered;
    }

    return filtered.slice().sort((a, b) => {
      if (sort === 'newest') {
        return b.createdAt - a.createdAt;
      }
      if (sort === 'priority') {
        const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      }
      if (sort === 'dueDate') {
        if (a.dueDate && b.dueDate) {
          const cmp = a.dueDate.localeCompare(b.dueDate);
          return cmp !== 0 ? cmp : PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt - a.createdAt;
      }
      return 0;
    });
  }

  function getStats(tasks, todayStr = getTodayDateString()) {
    const total = tasks.length;
    let completed = 0;
    let overdue = 0;

    for (const task of tasks) {
      if (task.completed) {
        completed += 1;
      } else if (isOverdue(task, todayStr)) {
        overdue += 1;
      }
    }

    const active = total - completed;
    const percentComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, active, completed, overdue, percentComplete };
  }

  function serializeTasks(tasks) {
    return JSON.stringify(tasks, null, 2);
  }

  function deserializeTasks(jsonString) {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
      return [];
    }
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected a JSON array of tasks.');
    }
    const seen = new Set();
    const valid = [];
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue;
      const task = createTask(raw, typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(), raw.id || generateId());
      if (task && !seen.has(task.id)) {
        seen.add(task.id);
        valid.push(task);
      }
    }
    return valid;
  }

  return {
    PRIORITIES,
    FILTERS,
    SORTS,
    generateId,
    getTodayDateString,
    createTask,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    restoreTask,
    clearCompleted,
    toggleAll,
    reorderTasks,
    isOverdue,
    filterAndSortTasks,
    getStats,
    serializeTasks,
    deserializeTasks,
  };
});
