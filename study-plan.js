/* Private browser-local weekly study checklist. */
(() => {
  "use strict";
  const STORAGE_KEY = "ads1.study-plan.v1";
  const app = () => document.querySelector("#app");
  const tasks = [
    { id: "chapter-1", title: "Review Chapter 01", detail: "Refresh the core ideas about computers, algorithms, and programming.", href: "#lesson/1", action: "Open Chapter 01" },
    { id: "chapter-2", title: "Study Chapter 02", detail: "Work through sequential algorithms and their examples.", href: "#lesson/2", action: "Open Chapter 02" },
    { id: "practice", title: "Practise tracing", detail: "Follow an algorithm step by step in Trace Lab.", href: "#arena/trace/1", action: "Open Trace Lab" },
    { id: "debug", title: "Find an algorithm bug", detail: "Choose a faulty line and repair it in Bug Lab.", href: "#arena/debug", action: "Open Bug Lab" },
    { id: "focus", title: "Complete a focus session", detail: "Set aside time for one chapter with the study timer.", href: "#focus", action: "Open Focus" }
  ];
  function weekKey(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const year = d.getFullYear();
    const firstThursday = new Date(year, 0, 4);
    const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function readDone() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return new Set(data.week === weekKey() && Array.isArray(data.done) ? data.done : []);
    } catch { return new Set(); }
  }
  function render() {
    const done = readDone();
    const total = tasks.length;
    const count = tasks.filter(task => done.has(task.id)).length;
    const cards = tasks.map((task, i) => `<article class="plan-task${done.has(task.id) ? " complete" : ""}">
      <label class="plan-check"><input type="checkbox" data-plan-task="${escape(task.id)}" ${done.has(task.id) ? "checked" : ""}><span class="plan-step" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span class="plan-task-copy"><strong>${escape(task.title)}</strong><small>${escape(task.detail)}</small></span></label>
      <a href="${task.href}" class="plan-task-link">${escape(task.action)} <span aria-hidden="true">→</span></a>
    </article>`).join("");
    return `<section class="container page-shell study-plan-page">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#home">Home</a><span aria-hidden="true">/</span><strong>Study Plan</strong></nav>
      <span class="eyebrow">Your next steps</span><h1>Weekly Study Plan</h1>
      <p class="plan-intro">A short checklist to keep your ADS1 study moving. Check off each step as you complete it; it resets for a new week.</p>
      <section class="plan-summary" aria-label="Weekly plan progress">
        <div class="plan-summary-head"><div><strong>This week</strong><small id="plan-progress-text">${count} of ${total} steps complete</small></div><span id="plan-progress-percent">${Math.round(count / total * 100)}%</span></div>
        <progress id="plan-progress" max="${total}" value="${count}" aria-label="Weekly study plan progress"></progress>
        <small class="plan-privacy">Your checklist is stored only in this browser. It does not affect XP or account progress.</small>
      </section>
      <div class="plan-task-list">${cards}</div>
    </section>`;
  }
  function bind() {
    const page = app()?.querySelector(".study-plan-page");
    if (!page || page.dataset.bound) return;
    page.dataset.bound = "true";
    page.addEventListener("change", event => {
      const input = event.target.closest("[data-plan-task]");
      if (!input) return;
      const done = readDone();
      if (input.checked) done.add(input.dataset.planTask); else done.delete(input.dataset.planTask);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ week: weekKey(), done: [...done] })); } catch { /* ignore unavailable storage */ }
      const count = tasks.filter(task => done.has(task.id)).length;
      const total = tasks.length;
      page.querySelector("#plan-progress").value = count;
      page.querySelector("#plan-progress-text").textContent = `${count} of ${total} steps complete`;
      page.querySelector("#plan-progress-percent").textContent = `${Math.round(count / total * 100)}%`;
      input.closest(".plan-task").classList.toggle("complete", input.checked);
    });
  }
  window.ADS1StudyPlanUI = { view: render, bind };
  window.dispatchEvent(new Event("hashchange"));
})();
