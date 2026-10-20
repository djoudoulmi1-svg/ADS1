/* Private, student-authored study plan synced to the signed-in account. */
(() => {
  "use strict";
  const app = () => document.querySelector("#app");
  const escape = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  let tasks = [], activeUserId = null, editingId = null, loading = false, saving = false, error = "", notice = "", requestNumber = 0;

  function store() { return window.ADS1StudyPlanStore; }
  function signedIn() { return Boolean(store() && store().isSignedIn()); }
  function chapters() { return (window.ADS1ChapterCatalog || []).filter(chapter => chapter.available !== false); }
  function summaryHTML() {
    const count = tasks.filter(task => task.completed).length;
    const total = tasks.length;
    const percent = total ? Math.round(count / total * 100) : 0;
    return '<section class="plan-summary" aria-label="Personal plan progress">' +
      '<div class="plan-summary-head"><div><strong>Your plan</strong><small id="plan-progress-text">' + count + ' of ' + total + ' tasks complete</small></div><span id="plan-progress-percent">' + percent + '%</span></div>' +
      '<progress id="plan-progress" max="' + Math.max(1, total) + '" value="' + count + '" aria-label="Personal plan progress ' + percent + ' percent"></progress>' +
      '<small class="plan-privacy">Only you can see these tasks. They stay saved to your account until you remove them.</small></section>';
  }
  function contentHTML() {
    if (!signedIn()) return '<div class="content-note"><p>Sign in to create and save a private study plan.</p><a class="button" href="#account">Go to Account</a></div>';
    if (loading) return '<p class="plan-empty" role="status">Loading your saved plan…</p>';
    const editing = tasks.find(task => String(task.id) === String(editingId));
    const selectedChapter = String((editing && editing.chapter_id) || "");
    const options = chapters().map(chapter => '<option value="' + escape(chapter.id) + '"' + (selectedChapter === String(chapter.id) ? " selected" : "") + '>Chapter ' + escape(chapter.number || chapter.id) + ' · ' + escape(chapter.title) + '</option>').join("");
    const cards = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed)
      || String(a.target_date || "9999").localeCompare(String(b.target_date || "9999"))
      || String(a.created_at || "").localeCompare(String(b.created_at || ""))).map((task, index) => {
        const chapter = chapters().find(item => String(item.id) === String(task.chapter_id));
        const due = task.target_date ? new Date(task.target_date + "T00:00:00").toLocaleDateString() : "";
        return '<article class="plan-task' + (task.completed ? " complete" : "") + '">' +
          '<label class="plan-check"><input type="checkbox" data-plan-toggle="' + escape(task.id) + '"' + (task.completed ? " checked" : "") + '><span class="plan-step" aria-hidden="true">' + String(index + 1).padStart(2, "0") + '</span><span class="plan-task-copy"><strong>' + escape(task.title) + '</strong>' +
          (task.detail ? '<small>' + escape(task.detail) + '</small>' : "") +
          (chapter ? '<small>Chapter ' + escape(chapter.number || chapter.id) + ' · ' + escape(chapter.title) + '</small>' : "") +
          (due ? '<small>Target date: ' + escape(due) + '</small>' : "") +
          '</span></label><div class="plan-task-actions">' +
          (chapter ? '<a href="#lesson/' + encodeURIComponent(chapter.id) + '" class="plan-task-link">Open chapter <span aria-hidden="true">→</span></a>' : "") +
          '<button class="text-button" type="button" data-plan-edit="' + escape(task.id) + '">Edit</button><button class="text-button danger-text" type="button" data-plan-delete="' + escape(task.id) + '">Delete</button></div></article>';
      }).join("");
    return '<form class="plan-builder" id="plan-task-form"><h2>' + (editing ? "Edit your task" : "Add a task to your plan") + '</h2>' +
      '<label for="plan-task-title">What do you want to work on?<input id="plan-task-title" name="title" maxlength="120" required value="' + escape((editing && editing.title) || "") + '" placeholder="For example: Review sequential algorithms"></label>' +
      '<label for="plan-task-detail">Notes or goal details<textarea id="plan-task-detail" name="detail" maxlength="1000" rows="3" placeholder="Add a short reminder (optional)">' + escape((editing && editing.detail) || "") + '</textarea></label>' +
      '<div class="plan-builder-row"><label for="plan-task-chapter">Related chapter (optional)<select id="plan-task-chapter" name="chapterId"><option value="">No chapter selected</option>' + options + '</select></label><label for="plan-task-date">Target date (optional)<input id="plan-task-date" name="targetDate" type="date" value="' + escape((editing && editing.target_date) || "") + '"></label></div>' +
      '<div class="plan-builder-actions"><button class="button" type="submit"' + (saving ? " disabled" : "") + '>' + (saving ? "Saving…" : editing ? "Save changes" : "Save task") + '</button>' +
      (editing ? '<button class="button secondary" type="button" data-plan-cancel>Cancel edit</button>' : "") + '</div></form>' +
      '<section class="plan-task-list" aria-label="Your saved study tasks">' + (cards || '<p class="plan-empty">Your plan is empty. Add the first task you want to complete.</p>') + '</section>';
  }
  function view() {
    const userId = signedIn() ? store().userId() : null;
    if (userId !== activeUserId) {
      activeUserId = userId; tasks = []; editingId = null; loading = false; error = ""; notice = "";
    }
    return '<section class="container page-shell study-plan-page">' +
      '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#home">Home</a><span aria-hidden="true">/</span><strong>Study Plan</strong></nav>' +
      '<span class="eyebrow">Your goals, your pace</span><h1>My Study Plan</h1>' +
      '<p class="plan-intro">Choose what you want to study, add your own notes and target dates, then mark tasks complete as you go. Nothing is prefilled or reset each week.</p>' +
      (signedIn() ? summaryHTML() : "") +
      '<p class="account-notice ' + (error ? "error" : "") + '" id="plan-notice" aria-live="polite">' + escape(error || notice) + '</p>' +
      '<div id="study-plan-content">' + contentHTML() + '</div></section>';
  }
  function paint(page) {
    if (!page || !page.isConnected) return;
    const summary = page.querySelector(".plan-summary");
    if (summary) summary.outerHTML = summaryHTML();
    else if (signedIn()) page.querySelector("#study-plan-content")?.insertAdjacentHTML("beforebegin", summaryHTML());
    const content = page.querySelector("#study-plan-content");
    if (content) content.innerHTML = contentHTML();
    const noticeNode = page.querySelector("#plan-notice");
    if (noticeNode) {
      noticeNode.textContent = error || notice;
      noticeNode.className = "account-notice " + (error ? "error" : "");
    }
  }
  async function loadTasks(page) {
    const id = ++requestNumber;
    loading = true; error = ""; paint(page);
    try {
      const result = await store().list();
      if (id !== requestNumber || !page.isConnected) return;
      if (result?.error || !Array.isArray(result?.tasks)) {
        error = (result && result.error) || "Could not load your plan."; tasks = [];
      } else tasks = result.tasks;
    } catch {
      if (id !== requestNumber) return;
      error = "Could not load your plan. Please try again."; tasks = [];
    }
    loading = false; paint(page);
  }
  async function bind() {
    const page = app()?.querySelector(".study-plan-page");
    if (!page) return;
    if (!page.dataset.bound) {
      page.dataset.bound = "true";
      page.addEventListener("submit", async event => {
        if (event.target.id !== "plan-task-form") return;
        event.preventDefault();
        if (!signedIn() || saving) return;
        const values = new FormData(event.target);
        const task = {
          title: String(values.get("title") || "").trim(),
          detail: String(values.get("detail") || "").trim(),
          chapter_id: String(values.get("chapterId") || ""),
          target_date: String(values.get("targetDate") || "")
        };
        saving = true; notice = ""; paint(page);
        const result = await store().save(task, editingId);
        saving = false;
        if (result?.error) { error = result.error; paint(page); return; }
        editingId = null; notice = "Your task has been saved.";
        await loadTasks(page); paint(page);
        page.querySelector("#plan-task-title")?.focus();
      });
      page.addEventListener("change", async event => {
        const input = event.target.closest("[data-plan-toggle]");
        if (!input || !signedIn()) return;
        input.disabled = true;
        const result = await store().setCompleted(input.dataset.planToggle, input.checked);
        if (result?.error) error = result.error;
        else {
          const task = tasks.find(item => String(item.id) === input.dataset.planToggle);
          if (task) task.completed = input.checked;
          notice = input.checked ? "Task marked complete." : "Task marked incomplete.";
        }
        paint(page);
      });
      page.addEventListener("click", async event => {
        const edit = event.target.closest("[data-plan-edit]");
        if (edit) {
          editingId = edit.dataset.planEdit; paint(page); page.querySelector("#plan-task-title")?.focus(); return;
        }
        if (event.target.closest("[data-plan-cancel]")) { editingId = null; error = ""; paint(page); return; }
        const remove = event.target.closest("[data-plan-delete]");
        if (!remove || !signedIn() || !window.confirm("Delete this task from your study plan?")) return;
        remove.disabled = true;
        const result = await store().remove(remove.dataset.planDelete);
        if (result?.error) { error = result.error; paint(page); return; }
        if (String(editingId) === String(remove.dataset.planDelete)) editingId = null;
        notice = "Task deleted."; await loadTasks(page); paint(page);
      });
    }
    if (!signedIn()) { activeUserId = null; return; }
    const userId = store().userId();
    if (userId !== activeUserId) {
      activeUserId = userId; tasks = []; editingId = null;
      await loadTasks(page);
    }
  }
  window.ADS1StudyPlanUI = { view, bind };
  window.dispatchEvent(new Event("hashchange"));
})();