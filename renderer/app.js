addTaskToggle.addEventListener("click", () => {
  const willOpen = !taskAddCard.classList.contains("is-open");
  const previousHeight = snapshotWidgetHeight();
  taskAddCard.classList.toggle("is-open", willOpen);
  addTaskToggle.setAttribute("aria-expanded", String(willOpen));
  animateWidgetHeight(previousHeight);
  if (willOpen) requestAnimationFrame(() => newTaskInput.focus());
  else closeAddComposer(true);
});

document.addEventListener("pointerdown", (event) => {
  if (!taskAddCard.classList.contains("is-open")) return;
  if (taskAddCard.contains(event.target)) return;
  closeAddComposer(false);
});

topAddComposer.addEventListener("submit", (event) => {
  event.preventDefault();
  commitNewTask();
});

newTaskInput.addEventListener("keydown", (event) => {
  if (focusAdjacentTaskInput(event, newTaskInput, newTaskDdlInput, "ArrowRight")) return;
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    commitNewTask();
    return;
  }
  if (event.key === "Escape") {
    closeAddComposer(true);
    addTaskToggle.focus();
  }
});

newTaskDdlInput.addEventListener("keydown", (event) => {
  if (focusAdjacentTaskInput(event, newTaskDdlInput, newTaskInput, "ArrowLeft")) return;
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    commitNewTask();
    return;
  }
  if (event.key === "Escape") {
    closeAddComposer(true);
    addTaskToggle.focus();
  }
});

taskList.addEventListener("click", (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    if (!event.target.closest(".edit-task, .delete-task, .complete-toggle, .collapse-toggle")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  const editSubtaskButton = event.target.closest(".edit-subtask");
  if (editSubtaskButton) {
    startEdit(editSubtaskButton.closest(".subtask-row"));
    return;
  }

  const deleteSubtaskButton = event.target.closest(".delete-subtask");
  if (deleteSubtaskButton) {
    removeSubtask(deleteSubtaskButton.closest(".subtask-row"));
    return;
  }

  const editButton = event.target.closest(".edit-task");
  if (editButton) {
    startEdit(editButton.closest(".task-item"));
    return;
  }

  const deleteButton = event.target.closest(".delete-task");
  if (deleteButton) {
    removeTask(deleteButton.closest(".task-item"));
    return;
  }

  const collapseButton = event.target.closest(".collapse-toggle");
  if (collapseButton) {
    const task = collapseButton.closest(".task-item");
    const willCollapse = !task.classList.contains("is-collapsed");
    const previousHeight = snapshotWidgetHeight();
    task.classList.toggle("is-collapsed", willCollapse);
    collapseButton.setAttribute("aria-expanded", String(!willCollapse));
    const holdId = holdDesktopWindowHeight(getWidgetMaxHeight());
    animateWidgetHeight(previousHeight);
    settleWidgetHeightAfterPanelTransition(task, holdId);
    schedulePersist();
    return;
  }

  const completeButton = event.target.closest(".complete-toggle");
  if (!completeButton) return;

  const subtaskRow = completeButton.closest(".subtask-row");
  if (subtaskRow) {
    setSubtaskComplete(completeButton, !completeButton.classList.contains("is-checked"));
    updateTaskFromSubtasks(subtaskRow.closest(".task-item"));
    return;
  }

  const task = completeButton.closest(".task-item");
  const willComplete = !completeButton.classList.contains("is-checked");
  setTaskDone(task, willComplete);
  getSubtaskRows(task).forEach((row) => setSubtaskComplete(row.querySelector(".complete-toggle"), willComplete));
  updateTaskFromSubtasks(task, { skipDone: true });
});

function setAltWindowDrag(enabled) {
  document.body.classList.toggle("is-alt-window-dragging", enabled);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Alt") setAltWindowDrag(true);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Alt") setAltWindowDrag(false);
});

window.addEventListener("blur", () => finishActiveEdit());
window.addEventListener("blur", () => {
  setAltWindowDrag(false);
  closeAddComposer(false);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  finishActiveEdit();
  setAltWindowDrag(false);
  closeAddComposer(false);
});

window.addEventListener("floating-todo-window-visibility", (event) => {
  document.body.classList.toggle("is-window-hidden", !event.detail?.visible);
});

taskList.addEventListener("pointerdown", (event) => {
  if (event.altKey) return;
  if (event.button !== 0 || isInteractiveTarget(event.target)) return;
  const row = event.target.closest(".subtask-row");
  const task = row ? row.closest(".task-item") : event.target.closest(".task-item");
  const element = row || task;
  if (!element || element.classList.contains("add-task-card") || element.classList.contains("is-removing")) return;

  swipeState = {
    pointerId: event.pointerId,
    element,
    type: row ? "subtask" : "task",
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    active: false
  };

  pendingDrag = {
    type: row ? "subtask" : "task",
    element,
    sourceTask: task,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    timer: window.setTimeout(startDrag, LONG_PRESS_MS)
  };

  taskList.setPointerCapture(event.pointerId);
});

taskList.addEventListener("pointermove", (event) => {
  if (swipeState && swipeState.pointerId === event.pointerId && !dragState) {
    swipeState.currentX = event.clientX;
    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;

    if (Math.abs(deltaX) > SWIPE_PREVIEW_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      swipeState.active = true;
      clearPendingDrag(false);
      event.preventDefault();
      const limited = getSwipePreviewOffset(deltaX);
      swipeState.element.classList.add("is-swipe-preview");
      swipeState.element.style.transform = `translateX(${limited}px)`;
    }
  }

  if (pendingDrag && pendingDrag.pointerId === event.pointerId) {
    pendingDrag.currentX = event.clientX;
    pendingDrag.currentY = event.clientY;
    const moved = Math.hypot(event.clientX - pendingDrag.startX, event.clientY - pendingDrag.startY);
    if (!dragState && moved > DRAG_CANCEL_DISTANCE) clearPendingDrag();
  }

  if (!dragState || dragState.pointerId !== event.pointerId) return;
  event.preventDefault();
  moveDraggedItem(event.clientX, event.clientY);
});

taskList.addEventListener("pointerup", (event) => {
  if (handleSwipeRelease(event)) return;
  finishDrag(event);
});

taskList.addEventListener("pointercancel", (event) => {
  resetSwipe(event);
  finishDrag(event);
});

taskList.addEventListener("pointerleave", handlePointerOutsideWindow);

window.addEventListener("floating-todo-window-blur", handlePointerOutsideWindow);
window.addEventListener("floating-todo-window-blur", () => finishActiveEdit());
getTaskItems().forEach(normalizeTaskSubtasks);
ensureTaskIds();
initializeWidgetHeight();
initializePersistence();
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => syncDesktopWindowHeight()).observe(todoWidget);
}
window.addEventListener("load", settleWidgetHeight);
window.addEventListener("resize", settleWidgetHeight);
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    applyWidgetHeight();
    enableWidgetHeightTransitions();
  });
} else {
  requestAnimationFrame(enableWidgetHeightTransitions);
}
