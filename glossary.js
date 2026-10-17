/* Searchable ADS1 concept glossary, kept in sync with the hash-based site router. */
(() => {
  "use strict";
  const entries = [
    ["Algorithm", "A finite, ordered set of clear steps for solving a problem.", 1],
    ["Program", "An algorithm expressed in a programming language so a computer can execute it.", 1],
    ["Input", "Data supplied to a computer or algorithm for processing.", 1],
    ["Output", "Information produced after processing input.", 1],
    ["Processing cycle", "The repeated input, processing, and output stages used to handle information.", 1],
    ["Problem solving", "Understanding a problem, designing a solution, and checking that it works.", 1],
    ["Pseudocode", "A readable, language-independent way to describe algorithm steps.", 1],
    ["Flowchart", "A diagram that represents an algorithm with standard shapes and arrows.", 1],
    ["Sequence", "Instructions carried out one after another in their written order.", 2],
    ["Variable", "A named place used to hold a value that an algorithm can read or change.", 2],
    ["Assignment", "An operation that stores a value in a variable, often written with an arrow.", 2],
    ["Condition", "A true-or-false test that can control which instructions run.", 2],
    ["Selection", "A structure that chooses between actions based on a condition.", 2],
    ["Iteration", "Repeating a group of instructions, usually while a condition holds or for a set count.", 2],
    ["Counter", "A variable updated to track how many times a repeated action has occurred.", 2],
    ["Accumulator", "A variable updated repeatedly to collect a running total or result.", 2],
    ["Compiler", "A program that translates source code into a form a computer can execute.", 1],
    ["Source code", "Human-readable instructions written in a programming language.", 1],
    ["Programming language", "A formal notation used to express instructions for a computer.", 1],
    ["Array", "A collection of related values accessed by their positions, called indices.", 2],
    ["Index", "A position used to access an element in an ordered collection such as an array.", 2],
    ["Maximum", "The greatest value in a set; an algorithm can find it by tracking the best value seen so far.", 2],
    ["Average", "The sum of values divided by how many values there are.", 2],
    ["Swap", "Exchange two values, often using a temporary variable to preserve one value.", 2],
    ["Trace table", "A table that records variable values step by step while an algorithm runs.", 2]
  ];

  const escape = value => String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const app = () => document.querySelector("#app");
  let filter = "all";
  let search = "";

  function visibleEntries() {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter(([name, definition, chapter]) =>
      (filter === "all" || String(chapter) === filter) &&
      (!term || name.toLocaleLowerCase().includes(term) || definition.toLocaleLowerCase().includes(term)));
  }

  function renderCards() {
    const host = app()?.querySelector("#glossary-results");
    if (!host) return;
    const rows = visibleEntries();
    host.innerHTML = rows.length
      ? rows.map(([name, definition, chapter]) => `<article class="glossary-card"><div class="glossary-card-top"><h2>${escape(name)}</h2><a href="#lesson/${chapter}" aria-label="Open Chapter ${chapter}">Chapter ${String(chapter).padStart(2, "0")} <span aria-hidden="true">↗</span></a></div><p>${escape(definition)}</p></article>`).join("")
      : '<p class="glossary-empty" role="status">No matching terms. Try a different word or chapter filter.</p>';
    const count = app()?.querySelector("#glossary-count");
    if (count) count.textContent = `${rows.length} term${rows.length === 1 ? "" : "s"}`;
  }

  function page() {
    filter = "all";
    search = "";
    document.title = "ADS1 Glossary | ADS1 Learning Hub";
    return `<section class="container page-shell glossary-page">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#home">Home</a><span aria-hidden="true">/</span><strong>Glossary</strong></nav>
      <span class="eyebrow">Quick reference</span><h1>ADS1 Glossary</h1>
      <p class="glossary-intro">Search key ideas from the course, then open the related chapter to study them in context.</p>
      <div class="glossary-tools">
        <label class="visually-hidden" for="glossary-search">Search glossary terms</label>
        <input id="glossary-search" type="search" placeholder="Search a term or definition" autocomplete="off">
        <div class="glossary-filters" role="group" aria-label="Filter terms by chapter">
          <button type="button" class="button secondary active" data-glossary-filter="all" aria-pressed="true">All chapters</button>
          <button type="button" class="button secondary" data-glossary-filter="1" aria-pressed="false">Chapter 01</button>
          <button type="button" class="button secondary" data-glossary-filter="2" aria-pressed="false">Chapter 02</button>
        </div>
      </div>
      <p id="glossary-count" class="glossary-count" aria-live="polite"></p>
      <div id="glossary-results" class="glossary-grid"></div>
    </section>`;
  }

  function bind() {
    const root = app();
    if (!root?.querySelector(".glossary-page")) return;
    root.querySelector("#glossary-search").addEventListener("input", event => {
      search = event.target.value;
      renderCards();
    });
    root.querySelectorAll("[data-glossary-filter]").forEach(button => {
      button.addEventListener("click", () => {
        filter = button.dataset.glossaryFilter;
        root.querySelectorAll("[data-glossary-filter]").forEach(item => {
          const selected = item === button;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        renderCards();
      });
    });
    renderCards();
  }

  function show() {
    const pageName = location.hash.slice(1).split("/")[0] || "home";
    if (pageName !== "glossary") return;
    app().innerHTML = page();
    document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === "glossary"));
    bind();
  }

  window.ADS1GlossaryUI = { view: page, bind };
  window.addEventListener("hashchange", show);
  show();
})();
