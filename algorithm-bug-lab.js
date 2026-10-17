/* Algorithm Bug Lab: interactive pseudocode debugging practice. */
(() => {
  "use strict";
  const arena = window.ADS1ArenaUI;
  if (!arena) return;
  const escape = value => window.escapeHTML
    ? window.escapeHTML(value)
    : String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const challenges = [
    {
      title: "Find the maximum",
      context: "Input: a = 12, b = 7, c = 5",
      lines: ["Read(a, b, c)", "max ← b", "If c > max Then", "  max ← c", "End If", "Print(max)"],
      bug: 1, fix: "max ← a",
      hint: "What value should the algorithm use as its first candidate for the maximum?",
      why: "The first candidate must be a. Starting from b ignores a whenever both b and c are smaller.",
      result: "With the sample input, the correct maximum is 12."
    },
    {
      title: "Calculate the average",
      context: "Input: x = 6, y = 9, z = 12",
      lines: ["Read(x, y, z)", "sum ← x + y + z", "average ← sum / 2", "Print(average)"],
      bug: 2, fix: "average ← sum / 3",
      hint: "The sum contains three values. How many values should the total be divided by?",
      why: "An arithmetic mean divides the total by the number of values, which is three here.",
      result: "The average is 9."
    },
    {
      title: "Swap two values",
      context: "Input: a = 4, b = 9",
      lines: ["Read(a, b)", "temp ← a", "a ← b", "b ← a", "Print(a, b)"],
      bug: 3, fix: "b ← temp",
      hint: "After line 3, the original value of a is still stored in a temporary variable.",
      why: "Line 3 overwrites a. Assigning b from a copies the new value twice; use the saved original value in temp.",
      result: "The swapped values should be a = 9 and b = 4."
    },
    {
      title: "Find a rectangle's area",
      context: "Input: length = 8, width = 3",
      lines: ["Read(length, width)", "area ← length + width", "Print(area)"],
      bug: 1, fix: "area ← length * width",
      hint: "Area counts square units. Which operation combines the two side lengths?",
      why: "A rectangle's area is the product of its length and width, not their sum.",
      result: "The area is 24 square units."
    }
    ,
    {
      title: "Calculate a factorial",
      context: "Input: n = 4",
      lines: ["Read(n)", "result ← 0", "For i ← 1 to n", "  result ← result * i", "End For", "Print(result)"],
      bug: 1, fix: "result ← 1",
      hint: "Multiplication keeps a value unchanged when multiplied by which starting number?",
      why: "A factorial multiplies the numbers from 1 to n. Starting at zero makes every later product stay zero.",
      result: "For n = 4, the factorial is 24."
    },
    {
      title: "Count values above a limit",
      context: "Values: [3, 8, 2, 10], limit = 5",
      lines: ["count ← 0", "For i ← 1 to 4", "  If values[i] > 5 Then", "    count ← i", "  End If", "End For", "Print(count)"],
      bug: 3, fix: "count ← count + 1",
      hint: "The count should increase by one each time a value matches, regardless of its position.",
      why: "Assigning i stores the current position, not the number of matches found so far.",
      result: "Two values are above 5, so the count is 2."
    },
    {
      title: "Sum an array",
      context: "Values: [4, 6, 3], n = 3",
      lines: ["sum ← 0", "For i ← 1 to n - 1", "  sum ← sum + values[i]", "End For", "Print(sum)"],
      bug: 1, fix: "For i ← 1 to n",
      hint: "Does the loop reach the final element when it stops at n - 1?",
      why: "The array has n elements, so the loop must include index n to add every value.",
      result: "The complete array sum is 13."
    },
    {
      title: "Find the first matching value",
      context: "Values: [7, 2, 9, 2], target = 2",
      lines: ["position ← -1", "For i ← 1 to 4", "  If values[i] = target Then", "    position ← i", "  End If", "End For", "Print(position)"],
      bug: 5, fix: "Exit For",
      hint: "After finding the target once, should the search continue if you need the first match?",
      why: "The loop continues and overwrites position when it finds another match. Stop after the first match.",
      result: "The first matching value is at position 2."
    }
  ];
  const state = { index: 0, phase: "identify", fix: "", feedback: "", hint: false, solved: new Set() };
  const active = () => location.hash.replace(/^#/, "").split("/")[0] === "arena" &&
    location.hash.replace(/^#/, "").split("/")[1] === "debug";

  function reset(index) {
    state.index = index;
    state.phase = "identify";
    state.fix = "";
    state.feedback = "";
    state.hint = false;
  }

  function bodyHTML() {
    const item = challenges[state.index];
    const lines = item.lines.map((line, i) => {
      const selected = state.phase !== "identify" && i === item.bug;
      return `<button type="button" class="debug-line${selected ? " selected" : ""}" data-debug-line="${i}" aria-pressed="${selected}" ${state.phase !== "identify" ? "disabled" : ""}><span class="debug-line-number">${String(i + 1).padStart(2, "0")}</span><code>${escape(line)}</code></button>`;
    }).join("");
    const feedback = state.feedback ? `<p class="debug-feedback ${state.phase === "solved" ? "success" : "error"}" role="status">${escape(state.feedback)}</p>` : "";
    let controls;
    if (state.phase === "identify") {
      controls = `<p class="panel-note">Select the line that causes the bug. Reveal a hint if you need one.</p><button type="button" class="button secondary" data-debug-action="hint">Show a hint</button>${state.hint ? `<p class="debug-hint">${escape(item.hint)}</p>` : ""}${feedback}`;
    } else if (state.phase === "repair") {
      controls = `<label class="debug-fix-label" for="debug-fix">Rewrite line ${item.bug + 1} to fix it</label><div class="debug-fix-row"><input id="debug-fix" type="text" autocomplete="off" spellcheck="false" value="${escape(state.fix)}" placeholder="Type the corrected pseudocode line"><button type="button" class="button" data-debug-action="check">Check my fix</button></div><button type="button" class="text-button" data-debug-action="hint">Show a hint</button>${state.hint ? `<p class="debug-hint">${escape(item.hint)}</p>` : ""}${feedback}`;
    } else {
      controls = `<div class="debug-explanation"><strong>Why it was wrong</strong><p>${escape(item.why)}</p><small>${escape(item.result)}</small></div><button type="button" class="button" data-debug-action="next">${state.solved.size === challenges.length ? "Start again" : "Next bug"} <span aria-hidden="true">→</span></button>${feedback}`;
    }
    return `<div class="debugger-progress"><span>Bug ${state.index + 1} of ${challenges.length}</span><span>${state.solved.size} solved</span></div><h2 id="debug-case-title">${escape(item.title)}</h2><p class="debug-context">${escape(item.context)}</p><div class="debug-code-list" role="group" aria-label="Choose the incorrect algorithm line">${lines}</div><div class="debug-controls">${controls}</div>`;
  }

  function page() {
    return `<section class="container arena-shell fade-in" data-track="debugger"><p class="crumbs"><a href="#home">Home</a><span aria-hidden="true"> / </span><a href="#arena">Algo Arena</a><span aria-hidden="true"> / </span><span>Bug Lab</span></p><span class="eyebrow">Algorithm practice</span><h1>Algorithm Bug Lab</h1><p class="arena-intro">Find the faulty pseudocode line, rewrite it, and see why the correction works. Your attempts stay in this browser and do not affect XP.</p><section class="arena-panel debugger-panel" aria-labelledby="debug-case-title"><div id="debugger-body">${bodyHTML()}</div></section></section>`;
  }

  function bind() {
    const body = document.querySelector("#app #debugger-body");
    if (!body || body.dataset.bound) return;
    body.dataset.bound = "true";
    body.addEventListener("input", event => {
      if (event.target.id === "debug-fix") state.fix = event.target.value;
    });
    body.addEventListener("keydown", event => {
      if (event.target.id === "debug-fix" && event.key === "Enter") {
        event.preventDefault();
        check();
      }
    });
    function check() {
      const item = challenges[state.index];
      const normalize = value => String(value).toLocaleLowerCase().replace(/←|<-/g, "=").replace(/\s+/g, "");
      if (normalize(state.fix) === normalize(item.fix)) {
        state.phase = "solved";
        state.solved.add(state.index);
        state.feedback = "Correct. You found and repaired the bug.";
      } else {
        state.feedback = "That correction does not fix this case yet. Check the hint and try again.";
      }
      body.innerHTML = bodyHTML();
      if (state.phase === "repair") body.querySelector("#debug-fix")?.focus();
    }
    body.addEventListener("click", event => {
      const line = event.target.closest("[data-debug-line]");
      if (line && state.phase === "identify") {
        if (Number(line.dataset.debugLine) === challenges[state.index].bug) {
          state.phase = "repair";
          state.feedback = "Good catch. Now rewrite that line so the algorithm works.";
        } else {
          state.feedback = "That line is consistent with the algorithm. Inspect the other steps.";
        }
        body.innerHTML = bodyHTML();
        if (state.phase === "repair") body.querySelector("#debug-fix")?.focus();
        return;
      }
      const action = event.target.closest("[data-debug-action]")?.dataset.debugAction;
      if (action === "hint") state.hint = !state.hint;
      else if (action === "check" && state.phase === "repair") { check(); return; }
      else if (action === "next" && state.phase === "solved") {
        if (state.solved.size === challenges.length) {
          state.solved.clear();
          reset(0);
        } else {
          const next = challenges.findIndex((_, i) => !state.solved.has(i));
          reset(next < 0 ? 0 : next);
        }
      } else return;
      body.innerHTML = bodyHTML();
    });
  }

  const originalView = arena.view;
  const originalBind = arena.bind;
  arena.view = function () { return active() ? page() : originalView(); };
  arena.bind = function () { if (active()) return bind(); return originalBind(); };
})();
