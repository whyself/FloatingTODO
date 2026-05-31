function normalizeTaskSubtasks(task) {
  if (!task) return;

  const rows = getSubtaskRows(task);
  task.classList.toggle("has-subtasks", rows.length > 0);

  if (!rows.length) {
    task.classList.remove("is-collapsed");
    task.querySelector(".progress-fill").style.width = "0%";
    return;
  }

  updateTaskFromSubtasks(task);
}

function getTaskTitle(task) {
  return task.querySelector(":scope > .task-head .edit-name-input")?.value.trim() ||
    task.querySelector(".task-title")?.textContent.trim() ||
    "Untitled task";
}

function getTaskDdl(task) {
  return task.querySelector(":scope > .task-head .edit-ddl-input")?.value.trim() ||
    task.querySelector(":scope > .task-head .task-ddl")?.textContent.trim() ||
    "";
}

function setTaskDdl(task, ddl) {
  const label = task?.querySelector(":scope > .task-head .task-ddl");
  if (!label) return;
  const next = String(ddl || "").trim();
  label.textContent = next;
  label.hidden = !next;
}

function getSubtaskTitle(row) {
  return row.querySelector(".edit-name-input")?.value.trim() ||
    row.querySelector(".subtask-title")?.textContent.trim() ||
    "Untitled subtask";
}

function getSubtaskDdl(row) {
  return row.querySelector(".edit-ddl-input")?.value.trim() ||
    row.querySelector(".subtask-ddl")?.textContent.trim() ||
    "";
}

function setSubtaskDdl(row, ddl) {
  const label = row?.querySelector(".subtask-ddl");
  if (!label) return;
  const next = String(ddl || "").trim();
  label.textContent = next;
  label.hidden = !next;
}

function isTaskDone(task) {
  return task.classList.contains("is-done");
}

function isSubtaskDone(row) {
  return row.querySelector(".complete-toggle")?.classList.contains("is-checked") || false;
}

function setCompleteButton(button, checked) {
  const icon = button.querySelector(".material-symbols-outlined");
  button.classList.toggle("is-checked", checked);
  button.classList.toggle("text-primary", checked);
  button.classList.toggle("text-outline", !checked);
  icon.textContent = checked ? "check_circle" : "circle";
  icon.style.fontVariationSettings = `'FILL' ${checked ? 1 : 0}`;
}

function setSubtaskComplete(button, checked) {
  setCompleteButton(button, checked);
  const label = button.closest(".subtask-row")?.querySelector(".subtask-title");
  if (!label) return;
  label.classList.toggle("line-through", checked);
  label.classList.toggle("text-outline", checked);
  label.classList.toggle("text-on-surface", !checked);
  schedulePersist();
}

function setTaskDone(task, done) {
  const previousHeight = snapshotWidgetHeight();
  const mainButton = task.querySelector(":scope > .task-head .complete-toggle");
  if (mainButton) setCompleteButton(mainButton, done);

  task.classList.toggle("is-done", done);
  task.classList.remove("is-completing");
  void task.offsetWidth;
  task.classList.add("is-completing");
  animateWidgetHeight(previousHeight);
  schedulePersist();
}

function updateTaskFromSubtasks(task, options = {}) {
  const rows = getSubtaskRows(task);
  if (!rows.length) return;

  const completed = rows.filter((row) => isSubtaskDone(row)).length;
  const progressFill = task.querySelector(".progress-fill");

  if (progressFill) progressFill.style.width = `${Math.round((completed / rows.length) * 100)}%`;
  if (!options.skipDone) setTaskDone(task, completed === rows.length);
}
