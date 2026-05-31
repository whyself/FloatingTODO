function isInteractiveTarget(target) {
  return Boolean(target.closest("button, input, form, a"));
}

function clearPendingDrag(releasePointer = true) {
  if (!pendingDrag) return;
  const pointerId = pendingDrag.pointerId;
  window.clearTimeout(pendingDrag.timer);
  pendingDrag = null;
  document.body.classList.remove("is-dragging-task");
  if (releasePointer && taskList.hasPointerCapture(pointerId)) taskList.releasePointerCapture(pointerId);
}

function startDrag() {
  if (!pendingDrag) return;

  swipeState = null;
  const { type, element, pointerId, currentX, currentY, sourceTask } = pendingDrag;
  document.body.classList.add("is-dragging-task");
  holdDesktopWindowHeight(getWidgetMaxHeight());
  window.getSelection()?.removeAllRanges();

  const rect = element.getBoundingClientRect();
  const placeholder = document.createElement("div");
  placeholder.className = type === "task" ? "drop-main-placeholder" : "drop-subtask-placeholder";
  placeholder.style.height = `${rect.height}px`;

  if (type === "task") taskList.insertBefore(placeholder, element);
  else element.parentElement.insertBefore(placeholder, element);

  const previousMargin = element.style.margin;
  const previousDisplay = element.style.display;
  const previousVisibility = element.style.visibility;
  const ghost = element.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.classList.add("drag-ghost", "is-dragging");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "translate3d(0, 0, 0)"
  });

  element.classList.add("is-dragging");
  element.style.display = "none";
  element.style.visibility = "hidden";
  document.body.appendChild(ghost);

  dragState = {
    type,
    element,
    ghost,
    sourceTask,
    placeholder,
    pointerId,
    offsetX: currentX - rect.left,
    offsetY: currentY - rect.top,
    dragWidth: rect.width,
    dragHeight: rect.height,
    ghostLeft: rect.left,
    ghostTop: rect.top,
    originalMargin: previousMargin,
    originalDisplay: previousDisplay,
    originalVisibility: previousVisibility,
    mode: type === "task" ? "main" : "subtask",
    targetTask: type === "subtask" ? sourceTask : null
  };

  pendingDrag = null;
}

function moveDraggedItem(clientX, clientY) {
  const { element, ghost, offsetX, offsetY, ghostLeft, ghostTop } = dragState;

  ghost.style.transform = `translate3d(${clientX - offsetX - ghostLeft}px, ${clientY - offsetY - ghostTop}px, 0)`;

  const previousRects = snapshotMovables();
  const previousHeight = snapshotWidgetHeight();
  clearDropTargets();

  const targetTask = getTaskUnderPointer(clientX, clientY);
  const canBecomeSubtask = dragState.type === "subtask" || !element.classList.contains("has-subtasks");

  if (canBecomeSubtask && targetTask && targetTask !== element && targetTask !== dragState.sourceTask) {
    placeSubtaskPlaceholder(targetTask, clientY);
  } else if (dragState.type === "subtask" && targetTask === dragState.sourceTask) {
    placeSubtaskPlaceholder(targetTask, clientY);
  } else {
    placeMainPlaceholder(clientY);
  }

  animateWidgetHeight(previousHeight);
  animateListShift(previousRects);
}

function getTaskUnderPointer(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  return element?.closest(".task-item:not(.is-dragging):not(.add-task-card)");
}

function placeMainPlaceholder(clientY) {
  dragState.mode = "main";
  dragState.targetTask = null;
  dragState.placeholder.className = "drop-main-placeholder";
  dragState.placeholder.style.height = dragState.type === "task" ? `${dragState.dragHeight}px` : "48px";

  const afterElement = getMainAfterElement(clientY);
  if (afterElement) taskList.insertBefore(dragState.placeholder, afterElement);
  else taskList.insertBefore(dragState.placeholder, taskAddCard);
}

function placeSubtaskPlaceholder(targetTask, clientY) {
  dragState.mode = "subtask";
  dragState.targetTask = targetTask;
  previewSubtaskChrome(targetTask);
  targetTask.classList.add("is-subtask-target");

  const inner = targetTask.querySelector(".subtask-inner");
  dragState.placeholder.className = "drop-subtask-placeholder";
  dragState.placeholder.style.height = "32px";

  const afterRow = getSubtaskAfterElement(inner, clientY);
  if (afterRow) inner.insertBefore(dragState.placeholder, afterRow);
  else inner.appendChild(dragState.placeholder);
}

function getMainAfterElement(clientY) {
  return getTaskItems()
    .filter((item) => !item.classList.contains("is-dragging") && item !== dragState.sourceTask)
    .reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function getSubtaskAfterElement(inner, clientY) {
  return Array.from(inner.querySelectorAll(".subtask-row:not(.is-dragging)"))
    .reduce((closest, row) => {
      const box = row.getBoundingClientRect();
      const offset = clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: row };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function finishDrag(event) {
  if (pendingDrag && pendingDrag.pointerId === event.pointerId) clearPendingDrag();
  if (!dragState || dragState.pointerId !== event.pointerId) return;

  const previousRects = snapshotMovables();
  const previousHeight = snapshotWidgetHeight();
  const { type, element, placeholder, sourceTask, mode, targetTask, originalMargin, originalDisplay, originalVisibility } = dragState;

  if (mode === "subtask") {
    ensureSubtaskChrome(targetTask);

    if (type === "task") {
      const row = createSubtaskElement(getTaskTitle(element), isTaskDone(element), element.dataset.taskId, getTaskDdl(element));
      placeholder.replaceWith(row);
      element.remove();
    } else {
      resetDraggedElement(element, originalMargin, originalDisplay, originalVisibility);
      placeholder.replaceWith(element);
    }

    if (sourceTask && sourceTask !== targetTask) normalizeTaskSubtasks(sourceTask);
    normalizeTaskSubtasks(targetTask);
  } else {
    if (type === "subtask") {
      const task = createTaskElement(getSubtaskTitle(element), isSubtaskDone(element), element.dataset.taskId, getSubtaskDdl(element));
      placeholder.replaceWith(task);
      element.remove();
      normalizeTaskSubtasks(sourceTask);
      task.classList.add("is-drop-settling");
      task.addEventListener("animationend", () => task.classList.remove("is-drop-settling"), { once: true });
    } else {
      resetDraggedElement(element, originalMargin, originalDisplay, originalVisibility);
      placeholder.replaceWith(element);
      element.classList.add("is-drop-settling");
      element.addEventListener("animationend", () => element.classList.remove("is-drop-settling"), { once: true });
    }
  }

  dragState.ghost.remove();
  clearDropTargets();
  animateWidgetHeight(previousHeight);
  animateListShift(previousRects);
  dragState = null;
  document.body.classList.remove("is-dragging-task");
  releaseDesktopWindowHeight();
  settleWidgetHeight();
  suppressNextClick = true;
  schedulePersist();

  if (taskList.hasPointerCapture(event.pointerId)) taskList.releasePointerCapture(event.pointerId);
}

function resetDraggedElement(element, originalMargin, originalDisplay, originalVisibility) {
  element.classList.remove("is-dragging");
  element.style.position = "";
  element.style.left = "";
  element.style.top = "";
  element.style.width = "";
  element.style.margin = originalMargin || "";
  element.style.display = originalDisplay || "";
  element.style.visibility = originalVisibility || "";
  element.style.transform = "";
}

function clearDropTargets() {
  taskList.querySelectorAll(".is-subtask-target").forEach((task) => {
    task.classList.remove("is-subtask-target");
    if (!getSubtaskRows(task).length) {
      task.classList.remove("has-subtasks", "is-growing", "is-collapsed");
      task.querySelector(".progress-fill").style.width = "0%";
    }
  });
}

function previewSubtaskChrome(task) {
  if (task.classList.contains("has-subtasks")) return;
  task.classList.add("has-subtasks", "is-growing");
  task.classList.remove("is-collapsed");
  task.querySelector(".collapse-toggle")?.setAttribute("aria-expanded", "true");
}

function ensureSubtaskChrome(task) {
  if (task.classList.contains("has-subtasks")) return;
  task.classList.add("has-subtasks", "is-growing");
  task.classList.remove("is-collapsed");
  task.querySelector(".collapse-toggle")?.setAttribute("aria-expanded", "true");
  task.addEventListener("animationend", () => task.classList.remove("is-growing"), { once: true });
}
