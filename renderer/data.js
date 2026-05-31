function getTaskItems() {
  return Array.from(taskList.querySelectorAll(":scope > .task-item:not(.add-task-card)"));
}

function getAnimatedItems() {
  return [
    ...getTaskItems(),
    taskAddCard,
    ...Array.from(taskList.querySelectorAll(".subtask-row"))
  ].filter(Boolean);
}

function getSubtaskRows(task) {
  return Array.from(task.querySelectorAll(".subtask-row"));
}

function createLocalId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${nextLocalTaskId++}`;
}

function assignTaskId(element, prefix, id) {
  element.dataset.taskId = String(id || createLocalId(prefix));
}

function ensureTaskIds() {
  getTaskItems().forEach((task) => {
    if (!task.dataset.taskId) assignTaskId(task, "task");
    getSubtaskRows(task).forEach((row) => {
      if (!row.dataset.taskId) assignTaskId(row, "subtask");
    });
  });
}

function exportTasks() {
  ensureTaskIds();
  return getTaskItems().map((task, index) => ({
    id: task.dataset.taskId,
    title: getTaskTitle(task),
    ddl: getTaskDdl(task),
    completed: isTaskDone(task),
    collapsed: task.classList.contains("is-collapsed"),
    order: index,
    children: getSubtaskRows(task).map((row, childIndex) => ({
      id: row.dataset.taskId,
      title: getSubtaskTitle(row),
      ddl: getSubtaskDdl(row),
      completed: isSubtaskDone(row),
      order: childIndex
    }))
  }));
}

function createTaskFromData(taskData) {
  const task = createTaskElement(
    taskData?.title || "Untitled task",
    Boolean(taskData?.completed),
    taskData?.id,
    taskData?.ddl || ""
  );
  const inner = task.querySelector(".subtask-inner");

  if (Array.isArray(taskData?.children)) {
    taskData.children.forEach((child) => {
      inner.appendChild(createSubtaskElement(
        child?.title || "Untitled subtask",
        Boolean(child?.completed),
        child?.id,
        child?.ddl || ""
      ));
    });
  }

  normalizeTaskSubtasks(task);
  if (taskData?.collapsed && getSubtaskRows(task).length) {
    task.classList.add("is-collapsed");
    task.querySelector(".collapse-toggle")?.setAttribute("aria-expanded", "false");
  }

  return task;
}

function renderPersistedTasks(tasks) {
  if (!Array.isArray(tasks)) return false;
  getTaskItems().forEach((task) => task.remove());
  tasks.forEach((taskData) => {
    taskList.insertBefore(createTaskFromData(taskData), taskAddCard);
  });
  settleWidgetHeight();
  return true;
}

async function initializePersistence() {
  applyingPersistedTasks = true;
  try {
    const tasks = await window.floatingTodoDesktop?.loadTasks?.();
    if (Array.isArray(tasks)) renderPersistedTasks(tasks);
    else ensureTaskIds();
  } catch (error) {
    console.error("Failed to initialize persisted tasks:", error);
    ensureTaskIds();
  } finally {
    applyingPersistedTasks = false;
    persistenceReady = true;
    schedulePersist();
  }
}

function schedulePersist() {
  if (applyingPersistedTasks || !persistenceReady || !window.floatingTodoDesktop?.saveTasks) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    window.floatingTodoDesktop.saveTasks(exportTasks()).catch((error) => {
      console.error("Failed to save persisted tasks:", error);
    });
  }, SAVE_DEBOUNCE_MS);
}
