function closeAddComposer(clearValue) {
  const previousHeight = snapshotWidgetHeight();
  if (clearValue) {
    newTaskInput.value = "";
    newTaskDdlInput.value = "";
  }
  taskAddCard.classList.remove("is-open");
  addTaskToggle.setAttribute("aria-expanded", "false");
  animateWidgetHeight(previousHeight);
}
function commitNewTask() {
  const taskName = newTaskInput.value.trim();
  if (!taskName) return;
  const ddl = newTaskDdlInput.value.trim();

  const wasScrollable = todoWidget.classList.contains("is-scrollable");
  const holdId = holdDesktopWindowHeight(getWidgetMaxHeight());
  const previousRects = snapshotMovables();
  const previousHeight = snapshotWidgetHeight();
  const task = createTaskElement(taskName, false, "", ddl);
  task.classList.add("is-new");
  taskList.insertBefore(task, taskAddCard);
  animateWidgetHeight(previousHeight);
  animateListShift(previousRects, { onlyMovedDown: true });
  settleWidgetHeightAfterTaskIntro(task, holdId);

  if (wasScrollable) {
    requestAnimationFrame(() => taskList.scrollTo({ top: taskList.scrollHeight, behavior: "smooth" }));
  }

  newTaskInput.value = "";
  newTaskDdlInput.value = "";
  taskAddCard.classList.add("is-open");
  addTaskToggle.setAttribute("aria-expanded", "true");
  schedulePersist();
  requestAnimationFrame(() => newTaskInput.focus());
}

function settleWidgetHeightAfterTaskIntro(task, holdId) {
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    task.classList.remove("is-new");
    releaseDesktopWindowHeight(holdId);
    settleWidgetHeight();
  };

  task.addEventListener("animationend", settle, { once: true });
  window.setTimeout(settle, 480);
}

function createTaskElement(title, done = false, id = "", ddl = "") {
  const task = document.createElement("div");
  task.className = `task-item flex flex-col rounded-lg p-standard${done ? " is-done" : ""}`;
  assignTaskId(task, "task", id);
  task.innerHTML = `
    <div class="task-head flex items-center justify-between">
      <div class="task-title-group flex items-center gap-standard">
        <button aria-label="Complete task" class="complete-toggle ${done ? "is-checked text-primary" : "text-outline hover:text-primary transition-colors"} flex items-center justify-center" type="button">
          <span class="complete-icon material-symbols-outlined" style="font-variation-settings: 'FILL' ${done ? 1 : 0};">${done ? "check_circle" : "circle"}</span>
        </button>
        <span class="task-title font-task-text text-task-text text-on-surface"></span>
        <span class="task-ddl font-task-subtext text-task-subtext text-primary"></span>
      </div>
      <div class="flex items-center gap-2">
        <div class="done-actions flex gap-1">
          <button aria-label="Edit task" class="edit-task rounded-md flex items-center justify-center" type="button"><span class="material-symbols-outlined text-[18px]">edit</span></button>
          <button aria-label="Delete task" class="delete-task rounded-md flex items-center justify-center" type="button"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </div>
        <button aria-expanded="true" aria-label="Collapse subtasks" class="collapse-toggle text-outline hover:text-on-surface p-1 items-center justify-center" type="button"><span class="material-symbols-outlined text-[20px]">expand_more</span></button>
      </div>
    </div>
    <div class="progress-track"><div class="progress-fill"></div></div>
    <div class="subtask-panel"><div class="subtask-inner"></div></div>
  `;
  task.querySelector(".task-title").textContent = title;
  setTaskDdl(task, ddl);
  return task;
}

function createSubtaskElement(title, done = false, id = "", ddl = "") {
  const row = document.createElement("div");
  row.className = "subtask-row flex items-center gap-standard";
  assignTaskId(row, "subtask", id);
  row.innerHTML = `
    <button aria-label="Complete subtask" class="complete-toggle ${done ? "is-checked text-primary" : "text-outline hover:text-primary transition-colors"} flex items-center justify-center" type="button">
      <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${done ? 1 : 0};">${done ? "check_circle" : "circle"}</span>
    </button>
    <span class="subtask-title font-task-subtext text-task-subtext ${done ? "text-outline line-through" : "text-on-surface"}"></span>
    <span class="subtask-ddl font-task-subtext text-task-subtext text-primary"></span>
    <div class="subtask-actions flex gap-1">
      <button aria-label="Edit subtask" class="edit-task edit-subtask rounded-md flex items-center justify-center" type="button"><span class="material-symbols-outlined text-[16px]">edit</span></button>
      <button aria-label="Delete subtask" class="delete-task delete-subtask rounded-md flex items-center justify-center" type="button"><span class="material-symbols-outlined text-[16px]">delete</span></button>
    </div>
  `;
  row.querySelector(".subtask-title").textContent = title;
  setSubtaskDdl(row, ddl);
  return row;
}

function removeTask(task, startOffset = 0) {
  if (!task || task.classList.contains("add-task-card")) return;

  const previousRects = snapshotMovables();
  const previousHeight = snapshotWidgetHeight();
  const holdId = holdDesktopWindowHeight(previousHeight);
  let removed = false;
  const finish = () => {
    if (removed) return;
    removed = true;
    task.remove();
    animateListShift(previousRects);
    animateWidgetHeightAfterListShift(previousHeight, holdId);
    schedulePersist();
  };

  task.style.transform = `translateX(${startOffset}px)`;
  task.classList.add("is-removing");
  const animation = task.animate(
    [
      { opacity: 1, transform: `translate3d(${startOffset}px, 0, 0) scale(1)` },
      { opacity: 0, transform: "translate3d(52px, 0, 0) scale(.96)" }
    ],
    { duration: 220, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" }
  );
  animation.finished.then(finish, finish);
  window.setTimeout(finish, 280);
}

function removeSubtask(row, startOffset = 0) {
  if (!row) return;

  const task = row.closest(".task-item");
  const previousRects = snapshotMovables();
  const previousHeight = snapshotWidgetHeight();
  const holdId = holdDesktopWindowHeight(previousHeight);
  let removed = false;
  const finish = () => {
    if (removed) return;
    removed = true;
    row.remove();
    normalizeTaskSubtasks(task);
    animateListShift(previousRects);
    animateWidgetHeightAfterListShift(previousHeight, holdId);
    schedulePersist();
  };

  row.style.transform = `translateX(${startOffset}px)`;
  row.classList.add("is-removing");
  const animation = row.animate(
    [
      { opacity: 1, transform: `translate3d(${startOffset}px, 0, 0) scale(1)` },
      { opacity: 0, transform: "translate3d(42px, 0, 0) scale(.96)" }
    ],
    { duration: 190, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" }
  );
  animation.finished.then(finish, finish);
  window.setTimeout(finish, 250);
}

function handleSwipeRelease(event) {
  if (!swipeState || swipeState.pointerId !== event.pointerId || dragState) return false;

  const { element, startX, startY, active } = swipeState;
  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;
  const shouldAct = active && Math.abs(deltaX) >= SWIPE_ACTION_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
  const releaseOffset = getSwipePreviewOffset(deltaX);

  resetSwipe(event, shouldAct && deltaX > 0);

  if (!shouldAct) return false;

  event.preventDefault();
  suppressNextClick = true;

  if (deltaX < 0) startEdit(element);
  else if (element.classList.contains("subtask-row")) removeSubtask(element, releaseOffset);
  else removeTask(element, releaseOffset);

  return true;
}

function handlePointerOutsideWindow() {
  if (dragState || !swipeState) return false;
  const { element, pointerId, startX, currentX } = swipeState;
  const transform = getComputedStyle(element).transform;
  const previewOffset = transform && transform !== "none"
    ? new DOMMatrixReadOnly(transform).m41
    : 0;
  const releaseOffset = previewOffset || (swipeState.active ? getSwipePreviewOffset(currentX - startX) : 0);

  if (!swipeState.active || Math.abs(releaseOffset) < 1) {
    resetSwipe(null);
    return false;
  }

  resetSwipe(null, releaseOffset > 0);
  if (taskList.hasPointerCapture(pointerId)) taskList.releasePointerCapture(pointerId);
  suppressNextClick = true;

  if (releaseOffset < 0) startEdit(element);
  else if (element.classList.contains("subtask-row")) removeSubtask(element, releaseOffset);
  else removeTask(element, releaseOffset);

  return true;
}

function resetSwipe(event, keepTransform = false) {
  if (!swipeState) return;
  const { element, pointerId } = swipeState;
  element.classList.remove("is-swipe-preview");
  if (!keepTransform) element.style.transform = "";
  swipeState = null;
  clearPendingDrag(false);
  if (event && taskList.hasPointerCapture(pointerId)) taskList.releasePointerCapture(pointerId);
}

function getSwipePreviewOffset(deltaX) {
  return Math.max(-52, Math.min(52, deltaX * .38));
}

function focusAdjacentTaskInput(event, fromInput, toInput, direction) {
  if (!toInput || !fromInput) return false;
  if (event.key !== direction) return false;
  const movingRight = direction === "ArrowRight";
  const atEdge = movingRight
    ? fromInput.selectionStart === fromInput.value.length && fromInput.selectionEnd === fromInput.value.length
    : fromInput.selectionStart === 0 && fromInput.selectionEnd === 0;

  if (!atEdge) return false;
  event.preventDefault();
  toInput.focus();
  if (movingRight) toInput.setSelectionRange(0, 0);
  else toInput.setSelectionRange(toInput.value.length, toInput.value.length);
  return true;
}

function startEdit(item) {
  if (!item || item.classList.contains("is-editing")) return;

  const isSubtask = item.classList.contains("subtask-row");
  const label = isSubtask
    ? item.querySelector(".subtask-title")
    : item.querySelector(":scope > .task-head .task-title");
  const ddlLabel = isSubtask
    ? item.querySelector(".subtask-ddl")
    : item.querySelector(":scope > .task-head .task-ddl");

  if (!label) return;

  const previousText = label.textContent.trim();
  const previousDdl = ddlLabel?.textContent.trim() || "";
  const shell = document.createElement("span");
  shell.className = "edit-name-shell flex flex-1 items-center gap-2 px-2 py-0 bg-white/[0.02] rounded-lg border border-white/[0.04] focus-within:bg-white/[0.05] focus-within:border-white/10";

  const input = document.createElement("input");
  input.className = isSubtask
    ? "edit-name-input bg-transparent border-none w-full font-task-subtext text-task-subtext text-on-surface focus:ring-0 p-0 caret-primary"
    : "edit-name-input bg-transparent border-none w-full font-task-text text-task-text text-on-surface focus:ring-0 p-0 caret-primary";
  input.type = "text";
  input.value = previousText;
  input.setAttribute("aria-label", isSubtask ? "Edit subtask name" : "Edit task name");

  shell.appendChild(input);
  let ddlInput = null;
  ddlInput = document.createElement("input");
  ddlInput.className = "task-ddl-input edit-ddl-input bg-transparent border-none font-task-subtext text-task-subtext text-primary focus:ring-0 p-0 caret-primary";
  ddlInput.type = "text";
  ddlInput.value = previousDdl;
  ddlInput.placeholder = "DDL";
  ddlInput.setAttribute("aria-label", isSubtask ? "Edit subtask DDL" : "Edit task DDL");
  shell.appendChild(ddlInput);
  const previousHeight = snapshotWidgetHeight();
  item.classList.add("is-editing");
  label.replaceWith(shell);
  if (ddlLabel) ddlLabel.hidden = true;
  animateWidgetHeight(previousHeight);
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    finishActiveEdit = () => false;
    const previousHeight = snapshotWidgetHeight();
    const next = save ? input.value.trim() : previousText;
    const nextDdl = save ? ddlInput?.value.trim() || "" : previousDdl;
    label.textContent = next || previousText;
    shell.replaceWith(label);
    if (ddlLabel) {
      ddlLabel.hidden = false;
      if (isSubtask) setSubtaskDdl(item, nextDdl);
      else setTaskDdl(item, nextDdl);
    }
    item.classList.remove("is-editing");
    animateWidgetHeight(previousHeight);
    if (save && (label.textContent.trim() !== previousText || nextDdl !== previousDdl)) schedulePersist();
  };
  finishActiveEdit = () => {
    if (finished) return false;
    finish(true);
    return true;
  };

  input.addEventListener("keydown", (event) => {
    if (focusAdjacentTaskInput(event, input, ddlInput, "ArrowRight")) return;
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  const scheduleEditPersist = () => {
    if (input.value.trim() !== previousText || ddlInput.value.trim() !== previousDdl) schedulePersist();
  };
  input.addEventListener("input", scheduleEditPersist);
  ddlInput.addEventListener("input", scheduleEditPersist);
  ddlInput?.addEventListener("keydown", (event) => {
    if (focusAdjacentTaskInput(event, ddlInput, input, "ArrowLeft")) return;
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  const finishWhenEditShellLosesFocus = () => {
    window.setTimeout(() => {
      if (!shell.contains(document.activeElement)) finish(true);
    }, 0);
  };

  input.addEventListener("blur", finishWhenEditShellLosesFocus);
  ddlInput?.addEventListener("blur", finishWhenEditShellLosesFocus);
}
