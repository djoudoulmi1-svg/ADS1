/* Local study focus timer. No account data, network calls, or XP changes. */
(() => {
  "use strict";
  const STORAGE_KEY = "ads1.focus.sessions.v1";
  const app = () => document.querySelector("#app");
  const state = { mode: "focus", minutes: 25, seconds: 1500, running: false, timer: null, chapter: "1" };
  const format = value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function readCount() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value.day === today() ? Number(value.count) || 0 : 0;
    } catch { return 0; }
  }
  function saveCount(count) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: today(), count })); } catch { /* ignore unavailable storage */ }
  }
  function page() {
    const count = readCount();
    return `<section class="container page-shell focus-page">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#home">Home</a><span aria-hidden="true">/</span><strong>Focus</strong></nav>
      <span class="eyebrow">Study tools</span><h1>Study Focus</h1>
      <p class="focus-intro">Set aside a little time for one chapter. Your session count is stored in this browser and never changes your XP.</p>
      <section class="focus-panel" aria-labelledby="focus-heading">
        <div class="focus-setup">
          <label for="focus-chapter">Choose a chapter
            <select id="focus-chapter"><option value="1" ${state.chapter === "1" ? "selected" : ""}>Chapter 01 · Introduction to Programming</option><option value="2" ${state.chapter === "2" ? "selected" : ""}>Chapter 02 · Sequential Algorithm</option></select>
          </label>
          <fieldset class="focus-presets"><legend>Focus session length</legend>
            ${[15, 25, 45].map(minutes => `<button type="button" class="button secondary${state.minutes === minutes ? " active" : ""}" data-focus-minutes="${minutes}" aria-pressed="${state.minutes === minutes}">${minutes} min</button>`).join("")}
          </fieldset>
        </div>
        <div class="focus-clock-wrap">
          <p id="focus-mode" class="focus-mode">${state.mode === "focus" ? "Focus session" : "Short break"}</p>
          <time id="focus-clock" class="focus-clock" role="timer" aria-label="${format(state.seconds)} remaining">${format(state.seconds)}</time>
          <p id="focus-message" class="focus-message" role="status">${state.running ? "Stay with your study session." : "When you are ready, start your focus session."}</p>
          <div class="focus-actions"><button type="button" class="button" id="focus-start">${state.running ? "Pause" : "Start focus"}</button><button type="button" class="button secondary" id="focus-reset">Reset</button></div>
        </div>
        <div class="focus-footer"><p><strong id="focus-count">${count}</strong> focus session${count === 1 ? "" : "s"} completed today on this browser.</p><a class="button secondary" id="focus-open-chapter" href="#lesson/${state.chapter}">Open selected chapter <span aria-hidden="true">→</span></a></div>
      </section>
    </section>`;
  }
  function paint() {
    const root = app();
    const clock = root?.querySelector("#focus-clock");
    if (!clock) return;
    clock.textContent = format(state.seconds);
    clock.setAttribute("aria-label", `${format(state.seconds)} remaining`);
    const start = root.querySelector("#focus-start");
    start.textContent = state.running ? "Pause" : state.mode === "focus" ? "Start focus" : "Start break";
    root.querySelector("#focus-mode").textContent = state.mode === "focus" ? "Focus session" : "Short break";
    root.querySelector("#focus-open-chapter").href = `#lesson/${state.chapter}`;
  }
  function pause() {
    state.running = false;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    paint();
  }
  function finish() {
    pause();
    if (state.mode === "focus") {
      const count = readCount() + 1;
      saveCount(count);
      state.mode = "break";
      state.seconds = 5 * 60;
      const message = app()?.querySelector("#focus-message");
      if (message) message.textContent = "Focus complete. Take a short five-minute break.";
      const countNode = app()?.querySelector("#focus-count");
      if (countNode) countNode.textContent = count;
      const sessionLabel = app()?.querySelector(".focus-footer p");
      if (sessionLabel) sessionLabel.innerHTML = `<strong id="focus-count">${count}</strong> focus session${count === 1 ? "" : "s"} completed today on this browser.`;
    } else {
      state.mode = "focus";
      state.seconds = state.minutes * 60;
      const message = app()?.querySelector("#focus-message");
      if (message) message.textContent = "Break finished. Start another focus session when you are ready.";
    }
    paint();
  }
  function bind() {
    const pageRoot = app()?.querySelector(".focus-page");
    if (!pageRoot || pageRoot.dataset.focusBound) return;
    pageRoot.dataset.focusBound = "true";
    pageRoot.querySelector("#focus-chapter").addEventListener("change", event => {
      state.chapter = event.target.value;
      paint();
    });
    pageRoot.querySelectorAll("[data-focus-minutes]").forEach(button => button.addEventListener("click", () => {
      state.minutes = Number(button.dataset.focusMinutes);
      if (!state.running && state.mode === "focus") state.seconds = state.minutes * 60;
      pageRoot.querySelectorAll("[data-focus-minutes]").forEach(item => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      paint();
    }));
    pageRoot.querySelector("#focus-start").addEventListener("click", () => {
      if (state.running) { pause(); pageRoot.querySelector("#focus-message").textContent = "Paused. Resume when you are ready."; return; }
      state.running = true;
      pageRoot.querySelector("#focus-message").textContent = state.mode === "focus" ? "Stay with your study session." : "Enjoy your short break.";
      state.timer = window.setInterval(() => {
        if (state.seconds > 0) state.seconds--;
        if (state.seconds === 0) finish();
        else paint();
      }, 1000);
      paint();
    });
    pageRoot.querySelector("#focus-reset").addEventListener("click", () => {
      pause();
      state.mode = "focus";
      state.seconds = state.minutes * 60;
      pageRoot.querySelector("#focus-message").textContent = "Timer reset. Start when you are ready.";
      paint();
    });
    paint();
  }
  window.ADS1FocusTimerUI = { view: page, bind };
})();
