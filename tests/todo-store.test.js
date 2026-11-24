'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../src/todo-store.js');

test('createTask normalizes fields and rejects empty titles', () => {
  assert.equal(Store.createTask({ title: '   ' }), null);
  assert.equal(Store.createTask({}), null);

  const task = Store.createTask(
    {
      title: '  Ship To-Do app  ',
      priority: 'high',
      dueDate: '2026-12-01',
      category: '  Work  ',
    },
    1000,
    'id-1'
  );

  assert.deepEqual(task, {
    id: 'id-1',
    title: 'Ship To-Do app',
    completed: false,
    priority: 'high',
    dueDate: '2026-12-01',
    category: 'Work',
    createdAt: 1000,
    updatedAt: 1000,
  });

  const fallback = Store.createTask(
    { title: 'Fallback', priority: 'urgent', dueDate: 'not-a-date' },
    2000,
    'id-2'
  );
  assert.equal(fallback.priority, 'medium');
  assert.equal(fallback.dueDate, '');
});

test('addTask, toggleTask, updateTask, deleteTask, and restoreTask work immutably', () => {
  let tasks = [];
  tasks = Store.addTask(tasks, { title: 'First', priority: 'low' }, 100, 't1');
  tasks = Store.addTask(tasks, { title: 'Second', priority: 'high' }, 200, 't2');

  assert.deepEqual(
    tasks.map((t) => t.id),
    ['t2', 't1']
  );

  const toggled = Store.toggleTask(tasks, 't1', 300);
  assert.equal(toggled[1].completed, true);
  assert.equal(tasks[1].completed, false); // original untouched

  const updated = Store.updateTask(
    toggled,
    't2',
    { title: 'Second (edited)', priority: 'medium', dueDate: '2026-12-10', category: 'Dev' },
    400
  );
  assert.equal(updated[0].title, 'Second (edited)');
  assert.equal(updated[0].priority, 'medium');
  assert.equal(updated[0].dueDate, '2026-12-10');
  assert.equal(updated[0].category, 'Dev');

  // Empty title update is ignored
  const ignored = Store.updateTask(updated, 't2', { title: '   ' }, 500);
  assert.equal(ignored[0].title, 'Second (edited)');

  const del = Store.deleteTask(updated, 't2');
  assert.equal(del.tasks.length, 1);
  assert.equal(del.removed.id, 't2');
  assert.equal(del.index, 0);

  const restored = Store.restoreTask(del.tasks, del.removed, del.index);
  assert.deepEqual(
    restored.map((t) => t.id),
    ['t2', 't1']
  );
});

test('toggleAll, clearCompleted, and reorderTasks behave as expected', () => {
  let tasks = [];
  tasks = Store.addTask(tasks, { title: 'A' }, 1, 'a');
  tasks = Store.addTask(tasks, { title: 'B' }, 2, 'b');
  tasks = Store.addTask(tasks, { title: 'C' }, 3, 'c');

  // Order is [c, b, a]
  const reordered = Store.reorderTasks(tasks, 'a', 'c');
  assert.deepEqual(
    reordered.map((t) => t.id),
    ['a', 'c', 'b']
  );

  const allDone = Store.toggleAll(reordered, true, 10);
  assert.ok(allDone.every((t) => t.completed));

  const cleared = Store.clearCompleted(allDone);
  assert.equal(cleared.length, 0);
});

test('filterAndSortTasks supports status, priority, search, and sort orders', () => {
  const tasks = [
    Store.createTask({ title: 'Buy milk', priority: 'low', dueDate: '2026-11-30', category: 'Home' }, 100, '1'),
    Store.createTask({ title: 'Fix login bug', priority: 'high', dueDate: '2026-11-25', category: 'Work', completed: true }, 200, '2'),
    Store.createTask({ title: 'Write docs', priority: 'high', dueDate: '2026-11-26', category: 'Work' }, 300, '3'),
    Store.createTask({ title: 'Plan trip', priority: 'medium', category: 'Personal' }, 400, '4'),
  ];

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { filter: 'active' }).map((t) => t.id),
    ['1', '3', '4']
  );

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { filter: 'completed' }).map((t) => t.id),
    ['2']
  );

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { priority: 'high' }).map((t) => t.id),
    ['2', '3']
  );

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { search: 'work' }).map((t) => t.id),
    ['2', '3']
  );

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { sort: 'priority' }).map((t) => t.id),
    ['3', '2', '4', '1']
  );

  assert.deepEqual(
    Store.filterAndSortTasks(tasks, { sort: 'dueDate' }).map((t) => t.id),
    ['2', '3', '1', '4']
  );
});

test('getStats computes counts, overdue, and completion percentage', () => {
  const tasks = [
    Store.createTask({ title: 'Past due', dueDate: '2026-11-20', completed: false }, 1, '1'),
    Store.createTask({ title: 'Past due done', dueDate: '2026-11-20', completed: true }, 2, '2'),
    Store.createTask({ title: 'Future', dueDate: '2026-12-01', completed: false }, 3, '3'),
    Store.createTask({ title: 'Done', completed: true }, 4, '4'),
  ];

  const stats = Store.getStats(tasks, '2026-11-24');
  assert.deepEqual(stats, {
    total: 4,
    active: 2,
    completed: 2,
    overdue: 1,
    percentComplete: 50,
  });
});

test('serializeTasks and deserializeTasks round-trip and reject invalid JSON', () => {
  const original = [
    Store.createTask({ title: 'Task 1', priority: 'high', category: 'Core' }, 10, 'id-1'),
    Store.createTask({ title: 'Task 2', completed: true }, 20, 'id-2'),
  ];
  const json = Store.serializeTasks(original);
  const restored = Store.deserializeTasks(json);
  assert.deepEqual(restored, original);

  assert.throws(() => Store.deserializeTasks('{"not": "an array"}'));
  assert.throws(() => Store.deserializeTasks('invalid json'));
});
