(function () {
  'use strict';

  const Store = window.TodoStore;
  const STORAGE_KEY = 'taskflow.tasks.v1';
  const THEME_KEY = 'taskflow.theme.v1';

  const state = {
    tasks: [],
    filter: 'all',
    priority: 'all',
    search: '',
    sort: 'manual',
    editingId: null,
    draggingId: null,
  };

  let toastTimer = null;
  let lastDeleted = null;

  // DOM references
  const dom = {
    todayLabel: document.getElementById('today-label'),
    themeToggle: document.getElementById('theme-toggle'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),

    statActive: document.getElementById('stat-active'),
    statCompleted: document.getElementById('stat-completed'),
    statOverdue: document.getElementById('stat-overdue'),
    statOverduePill: document.getElementById('stat-overdue-pill'),
    statPercent: document.getElementById('stat-percent'),
    progressFill: document.getElementById('progress-fill'),
    progressTrack: document.getElementById('progress-bar-track'),

    taskForm: document.getElementById('task-form'),
    taskTitle: document.getElementById('task-title'),
    taskPriority: document.getElementById('task-priority'),
    taskDueDate: document.getElementById('task-due-date'),
    taskCategory: document.getElementById('task-category'),

    filterTabs: Array.from(document.querySelectorAll('.filter-tab')),
    searchInput: document.getElementById('search-input'),
    priorityFilter: document.getElementById('priority-filter'),
    sortSelect: document.getElementById('sort-select'),

    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptyMessage: document.getElementById('empty-message'),
    listFooter: document.getElementById('list-footer'),
    dragHint: document.getElementById('drag-hint'),
    toggleAllBtn: document.getElementById('toggle-all-btn'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),

    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastAction: document.getElementById('toast-action'),
  };

  // Safe storage helpers
  function loadTasks() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return Store.deserializeTasks(raw);
    } catch (_err) {
      return [];
    }
  }

  function saveTasks() {
    try {
      window.localStorage.setItem(STORAGE_KEY, Store.serializeTasks(state.tasks));
    } catch (_err) {
      // Ignore quota / privacy mode errors
    }
  }

  function initTheme() {
    let theme = null;
    try {
      theme = window.localStorage.getItem(THEME_KEY);
    } catch (_err) {
      theme = null;
    }
    if (!theme) {
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    applyTheme(theme, false);
  }

  function applyTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch (_err) {
        // Ignore storage errors
      }
    }
  }

  function showToast(message, actionLabel, onAction) {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    dom.toastMessage.textContent = message;
    if (actionLabel && typeof onAction === 'function') {
      dom.toastAction.textContent = actionLabel;
      dom.toastAction.hidden = false;
      dom.toastAction.onclick = function () {
        onAction();
        hideToast();
      };
    } else {
      dom.toastAction.hidden = true;
      dom.toastAction.onclick = null;
    }
    dom.toast.hidden = false;
    toastTimer = setTimeout(hideToast, 4500);
  }

  function hideToast() {
    dom.toast.hidden = true;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function formatDueDate(dateStr, todayStr) {
    if (!dateStr) return '';
    if (dateStr === todayStr) return 'Due today';

    const parts = dateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const formatted = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
    return dateStr < todayStr ? `Overdue (${formatted})` : `Due ${formatted}`;
  }

  function createSvg(paths, size = 15) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    for (const def of paths) {
      const el = document.createElementNS(svgNS, def.tag);
      for (const [key, val] of Object.entries(def.attrs)) {
        el.setAttribute(key, val);
      }
      svg.appendChild(el);
    }
    return svg;
  }

  function renderStats(todayStr) {
    const stats = Store.getStats(state.tasks, todayStr);
    dom.statActive.textContent = String(stats.active);
    dom.statCompleted.textContent = String(stats.completed);
    dom.statOverdue.textContent = String(stats.overdue);
    dom.statPercent.textContent = `${stats.percentComplete}%`;
    dom.statOverduePill.classList.toggle('has-overdue', stats.overdue > 0);
    dom.progressFill.style.width = `${stats.percentComplete}%`;
    dom.progressTrack.setAttribute('aria-valuenow', String(stats.percentComplete));

    const hasTasks = stats.total > 0;
    dom.listFooter.hidden = !hasTasks;
    const allDone = hasTasks && stats.active === 0;
    dom.toggleAllBtn.textContent = allDone ? 'Uncheck all' : 'Complete all';
    dom.clearCompletedBtn.disabled = stats.completed === 0;
    dom.dragHint.hidden = state.sort !== 'manual' || stats.total < 2;
  }

  function buildEditView(task) {
    const form = document.createElement('form');
    form.className = 'task-edit-form';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'task-edit-input';
    titleInput.value = task.title;
    titleInput.maxLength = 200;
    titleInput.required = true;
    titleInput.setAttribute('aria-label', 'Edit task title');

    const row = document.createElement('div');
    row.className = 'task-edit-row';

    const prioritySelect = document.createElement('select');
    prioritySelect.setAttribute('aria-label', 'Edit priority');
    for (const p of Store.PRIORITIES) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p.charAt(0).toUpperCase() + p.slice(1) + ' priority';
      if (p === task.priority) opt.selected = true;
      prioritySelect.appendChild(opt);
    }

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = task.dueDate || '';
    dateInput.setAttribute('aria-label', 'Edit due date');

    const catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.value = task.category || '';
    catInput.placeholder = 'Tag';
    catInput.maxLength = 32;
    catInput.setAttribute('aria-label', 'Edit tag');

    const buttons = document.createElement('div');
    buttons.className = 'task-edit-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mini-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      state.editingId = null;
      render();
    });

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'mini-btn save';
    saveBtn.textContent = 'Save';

    buttons.append(cancelBtn, saveBtn);
    row.append(prioritySelect, dateInput, catInput, buttons);
    form.append(titleInput, row);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const trimmed = titleInput.value.trim();
      if (!trimmed) {
        titleInput.focus();
        return;
      }
      state.tasks = Store.updateTask(state.tasks, task.id, {
        title: trimmed,
        priority: prioritySelect.value,
        dueDate: dateInput.value,
        category: catInput.value,
      });
      state.editingId = null;
      saveTasks();
      render();
    });

    form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        state.editingId = null;
        render();
      }
    });

    setTimeout(() => {
      titleInput.focus();
      titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
    }, 0);

    return form;
  }

  function buildTaskItem(task, todayStr) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' is-completed' : '');
    li.dataset.id = task.id;

    const canDrag = state.sort === 'manual' && state.editingId !== task.id;
    li.draggable = canDrag;

    if (canDrag) {
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.title = 'Drag to reorder';
      handle.setAttribute('aria-hidden', 'true');
      handle.textContent = '⋮⋮';
      li.appendChild(handle);

      li.addEventListener('dragstart', (event) => {
        state.draggingId = task.id;
        li.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', task.id);
        }
      });

      li.addEventListener('dragend', () => {
        state.draggingId = null;
        li.classList.remove('is-dragging');
        for (const el of dom.taskList.querySelectorAll('.is-drag-over')) {
          el.classList.remove('is-drag-over');
        }
      });

      li.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (state.draggingId && state.draggingId !== task.id) {
          li.classList.add('is-drag-over');
        }
      });

      li.addEventListener('dragleave', () => {
        li.classList.remove('is-drag-over');
      });

      li.addEventListener('drop', (event) => {
        event.preventDefault();
        li.classList.remove('is-drag-over');
        const fromId = state.draggingId || (event.dataTransfer && event.dataTransfer.getData('text/plain'));
        if (fromId && fromId !== task.id) {
          state.tasks = Store.reorderTasks(state.tasks, fromId, task.id);
          saveTasks();
          render();
        }
      });
    }

    const checkbox = document.createElement('button');
    checkbox.type = 'button';
    checkbox.className = 'task-checkbox';
    checkbox.setAttribute('aria-pressed', String(task.completed));
    checkbox.setAttribute(
      'aria-label',
      task.completed ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`
    );
    if (task.completed) {
      checkbox.appendChild(
        createSvg([{ tag: 'polyline', attrs: { points: '20 6 9 17 4 12' } }], 14)
      );
    }
    checkbox.addEventListener('click', () => {
      state.tasks = Store.toggleTask(state.tasks, task.id);
      saveTasks();
      render();
    });

    const body = document.createElement('div');
    body.className = 'task-body';

    if (state.editingId === task.id) {
      body.appendChild(buildEditView(task));
      li.append(checkbox, body);
      return li;
    }

    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;
    title.title = 'Double-click to edit';
    title.addEventListener('dblclick', () => {
      state.editingId = task.id;
      render();
    });
    body.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'task-badges';

    const priorityBadge = document.createElement('span');
    priorityBadge.className = `badge badge-priority-${task.priority}`;
    priorityBadge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    badges.appendChild(priorityBadge);

    if (task.dueDate) {
      const dueBadge = document.createElement('span');
      const overdue = Store.isOverdue(task, todayStr);
      dueBadge.className = 'badge badge-due' + (overdue ? ' is-overdue' : '');
      dueBadge.textContent = formatDueDate(task.dueDate, todayStr);
      badges.appendChild(dueBadge);
    }

    if (task.category) {
      const catBadge = document.createElement('span');
      catBadge.className = 'badge badge-category';
      catBadge.textContent = `#${task.category}`;
      badges.appendChild(catBadge);
    }

    body.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-action-btn';
    editBtn.title = 'Edit task';
    editBtn.setAttribute('aria-label', `Edit "${task.title}"`);
    editBtn.appendChild(
      createSvg([
        { tag: 'path', attrs: { d: 'M12 20h9' } },
        { tag: 'path', attrs: { d: 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' } },
      ])
    );
    editBtn.addEventListener('click', () => {
      state.editingId = task.id;
      render();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'task-action-btn delete';
    deleteBtn.title = 'Delete task';
    deleteBtn.setAttribute('aria-label', `Delete "${task.title}"`);
    deleteBtn.appendChild(
      createSvg([
        { tag: 'polyline', attrs: { points: '3 6 5 6 21 6' } },
        { tag: 'path', attrs: { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' } },
        { tag: 'path', attrs: { d: 'M10 11v6' } },
        { tag: 'path', attrs: { d: 'M14 11v6' } },
      ])
    );
    deleteBtn.addEventListener('click', () => {
      const result = Store.deleteTask(state.tasks, task.id);
      state.tasks = result.tasks;
      lastDeleted = { task: result.removed, index: result.index };
      saveTasks();
      render();
      showToast('Task deleted', 'Undo', () => {
        if (lastDeleted && lastDeleted.task) {
          state.tasks = Store.restoreTask(state.tasks, lastDeleted.task, lastDeleted.index);
          lastDeleted = null;
          saveTasks();
          render();
        }
      });
    });

    actions.append(editBtn, deleteBtn);
    li.append(checkbox, body, actions);
    return li;
  }

  function render() {
    const todayStr = Store.getTodayDateString();
    renderStats(todayStr);

    const visible = Store.filterAndSortTasks(state.tasks, {
      filter: state.filter,
      priority: state.priority,
      search: state.search,
      sort: state.sort,
    });

    dom.taskList.textContent = '';

    if (visible.length === 0) {
      dom.emptyState.hidden = false;
      if (state.tasks.length === 0) {
        dom.emptyTitle.textContent = 'No tasks yet';
        dom.emptyMessage.textContent = 'Add your first task above to get started.';
      } else {
        dom.emptyTitle.textContent = 'No matching tasks';
        dom.emptyMessage.textContent = 'Try adjusting your filters or search query.';
      }
      return;
    }

    dom.emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    for (const task of visible) {
      fragment.appendChild(buildTaskItem(task, todayStr));
    }
    dom.taskList.appendChild(fragment);
  }

  function bindEvents() {
    dom.taskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = dom.taskTitle.value.trim();
      if (!title) {
        dom.taskTitle.focus();
        return;
      }

      state.tasks = Store.addTask(state.tasks, {
        title,
        priority: dom.taskPriority.value,
        dueDate: dom.taskDueDate.value,
        category: dom.taskCategory.value,
      });

      dom.taskTitle.value = '';
      dom.taskDueDate.value = '';
      dom.taskCategory.value = '';
      dom.taskTitle.focus();

      saveTasks();
      render();
    });

    for (const tab of dom.filterTabs) {
      tab.addEventListener('click', () => {
        state.filter = tab.dataset.filter;
        for (const btn of dom.filterTabs) {
          const active = btn === tab;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-selected', String(active));
        }
        render();
      });
    }

    dom.searchInput.addEventListener('input', (event) => {
      state.search = event.target.value;
      render();
    });

    dom.priorityFilter.addEventListener('change', (event) => {
      state.priority = event.target.value;
      render();
    });

    dom.sortSelect.addEventListener('change', (event) => {
      state.sort = event.target.value;
      render();
    });

    dom.toggleAllBtn.addEventListener('click', () => {
      const stats = Store.getStats(state.tasks);
      const shouldComplete = stats.active > 0;
      state.tasks = Store.toggleAll(state.tasks, shouldComplete);
      saveTasks();
      render();
    });

    dom.clearCompletedBtn.addEventListener('click', () => {
      const previous = state.tasks.slice();
      const clearedCount = previous.filter((t) => t.completed).length;
      if (clearedCount === 0) return;

      state.tasks = Store.clearCompleted(state.tasks);
      saveTasks();
      render();
      showToast(
        `Cleared ${clearedCount} completed ${clearedCount === 1 ? 'task' : 'tasks'}`,
        'Undo',
        () => {
          state.tasks = previous;
          saveTasks();
          render();
        }
      );
    });

    dom.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    dom.exportBtn.addEventListener('click', () => {
      const json = Store.serializeTasks(state.tasks);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `taskflow-backup-${Store.getTodayDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Tasks exported as JSON');
    });

    dom.importBtn.addEventListener('click', () => {
      dom.importFile.value = '';
      dom.importFile.click();
    });

    dom.importFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = Store.deserializeTasks(String(reader.result || ''));
          const existingIds = new Set(state.tasks.map((t) => t.id));
          const merged = imported
            .filter((t) => !existingIds.has(t.id))
            .concat(state.tasks);
          const addedCount = merged.length - state.tasks.length;
          state.tasks = merged;
          saveTasks();
          render();
          showToast(`Imported ${addedCount} ${addedCount === 1 ? 'task' : 'tasks'}`);
        } catch (_err) {
          showToast('Could not import file — invalid JSON format');
        }
      };
      reader.readAsText(file);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== '/') return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      dom.searchInput.focus();
    });
  }

  function init() {
    initTheme();
    dom.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    state.tasks = loadTasks();
    bindEvents();
    render();
  }

  init();
})();
