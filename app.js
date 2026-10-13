const app = document.querySelector("#app");
const nav = document.querySelector(".main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const bundledChapters = [
  {
    id: "1",
    number: "01",
    title: "Introduction to Programming",
    available: true,
    file: "CHAPTER1.html",
    sectionCount: "16 navigation topics",
    description: "The supplied lesson covers computers, problem solving, algorithms, programming languages, C, compilers, and development environments."
  },
  {
    id: "2",
    number: "02",
    title: "Sequential Algorithm",
    available: true,
    file: "CHAPTER2.html",
    sectionCount: "26 presentation sections",
    description: "Explore sequential algorithms, pseudocode, variables, worked examples, and interactive tracing challenges."
  },
];
let chapters = bundledChapters;

function route() {
  const [page, query = ""] = location.hash.slice(1).split("/");
  return { page: page || "home", query };
}

function crumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => `${index ? `<span aria-hidden="true">/</span>` : ""}${item.href ? `<a href="${item.href}">${item.label}</a>` : `<strong>${item.label}</strong>`}`).join("")}</nav>`;
}

function chapterCard(chapter) {
  const status = chapter.available ? "Available" : "Waiting for upload";
  const action = "Open chapter <span aria-hidden=\"true\">→</span>";
  const description = chapter.description || "Course lesson supplied by the course team.";
  return `<article class="chapter-card ${chapter.available ? "available" : "unavailable"}" data-search="${chapter.title.toLowerCase()}">
    <div class="card-top"><span class="chapter-number">CHAPTER ${escapeHTML(chapter.number)}</span><span class="status ${chapter.available ? "" : "pending"}">${status}</span></div>
    <h3>${escapeHTML(chapter.title)}</h3><p>${escapeHTML(description)}</p>
    ${chapter.available ? `<a class="card-action" href="#chapter/${chapter.id}">${action}</a>` : `<span class="card-action">${action}</span>`}
  </article>`;
}

function waitingChaptersCard() {
  return `<article class="chapter-card unavailable" aria-label="Other chapters waiting to be uploaded">
    <div class="card-top"><span class="chapter-number">MORE CHAPTERS</span><span class="status pending">Waiting for upload</span></div>
    <h3>Other chapters</h3>
    <p>Additional course chapters will appear here when their lesson files are uploaded.</p>
    <span class="card-action">Not available yet</span>
  </article>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function home() {
  return `<section class="hero"><div class="container hero-content fade-in">
    <span class="eyebrow">ADS1 · University of Ouargla</span>
    <h1>Learn algorithms.<br><em>One step at a time.</em></h1>
    <p>Study your ADS1 lessons, explore worked examples, practise algorithm tracing, and test your understanding through interactive activities.</p>
    <a class="button" href="#chapters">Explore chapters <span class="arrow" aria-hidden="true">→</span></a>
  </div></section>
  <section class="container overview" aria-label="Course information">
    <div class="section-heading"><span class="eyebrow">Your course</span><h2>Built around the material</h2></div>
    <div class="facts">
      <div class="fact"><strong>ADS1</strong><span>Module</span></div>
      <div class="fact"><strong>Algorithmique et Structures de Données</strong><span>Computer Science · First year</span></div>
      <div class="fact"><strong>Lessons · examples · practice</strong><span>Learning format</span></div>
    </div>
  </section>
  <section class="chapters-section" id="chapters"><div class="container">
    <div class="section-top"><div><span class="eyebrow">Course library</span><h2>Choose a chapter</h2></div>
      <label class="search-wrap"><span class="search-icon" aria-hidden="true"></span><input id="chapter-search" type="search" placeholder="Search available material" aria-label="Search chapters"></label>
    </div>
    <div class="chapter-grid" id="chapter-grid">${chapters.map(chapterCard).join("")}${waitingChaptersCard()}</div>
    <p class="content-note">Only source material that has been provided is shown as available. Additional chapter titles and lessons will be added from the official course files.</p>
  </div></section>`;
}

function chapterPage(id) {
  const chapter = chapters.find(item => item.id === id && item.available);
  if (!chapter) return home();
  const completed = localStorage.getItem(`ads1.chapter${chapter.id}.completed`) === "true";
  return `<section class="container page-shell fade-in">
    ${crumbs([{ label: "Home", href: "#home" }, { label: "Chapters", href: "#chapters" }, { label: `Chapter ${chapter.number}` }])}
    <div class="chapter-intro"><div><span class="eyebrow">Chapter ${chapter.number} · Available lesson</span><h1>${chapter.title}</h1>
      <p>${chapter.description}</p>
    </div><aside class="chapter-aside"><span>Course material</span><strong>${chapter.sectionCount}</strong></aside></div>
    <div class="lesson-row"><span class="lesson-index">01</span><div><h2>${chapter.title}</h2><p>Integrated lesson · source content and activities preserved</p></div><a class="button" href="#lesson/${chapter.id}">${completed ? "Continue lesson" : "Start lesson"}<span class="arrow" aria-hidden="true">→</span></a></div>
    <div class="content-note">The learning outcomes and section list are presented in the lesson as supplied. Progress saved on this device only; it is not synchronized between browsers or devices.${chapter.id === "1" ? " The supplied page labels this lesson Chapter 2, while its cited PDF title identifies it as Chapter 1; this hub lists it as Chapter 1 to keep the separately supplied Sequential Algorithm lesson as Chapter 2." : ""}</div>
  </section>`;
}

function lessonPage(id) {
  const chapter = chapters.find(item => item.id === id && item.available);
  if (!chapter) return home();
  return `<div class="lesson-toolbar"><a class="button secondary" href="#chapter/${chapter.id}"><span aria-hidden="true">←</span> Back to chapter</a><div class="lesson-toolbar-title"><strong>${chapter.title}</strong><span>Chapter ${chapter.number} · University of Ouargla</span></div><button class="button secondary" id="mark-complete" data-chapter="${chapter.id}" type="button">${localStorage.getItem(`ads1.chapter${chapter.id}.completed`) === "true" ? "Completed" : "Mark complete"}</button></div>
  <iframe class="lesson-frame" src="${chapter.file}" title="Chapter ${chapter.number}: ${chapter.title} lesson" allow="fullscreen"></iframe>`;
}

function aboutPage() {
  return `<section class="container about-band fade-in">${crumbs([{ label: "Home", href: "#home" }, { label: "About" }])}
    <span class="eyebrow">About the hub</span><h1>ADS1 Learning Hub</h1>
    <p>A learning space for first-year Computer Science students studying Algorithmique et Structures de Données at the University of Ouargla. Lessons are added from supplied course material; chapters without source files remain unavailable rather than being filled with guessed content.</p>
    <div class="about-rule"></div><a class="button secondary" href="#chapters">Browse available chapters <span class="arrow" aria-hidden="true">→</span></a>
  </section>`;
}

function render() {
  const { page, query } = route();
  const view = page === "chapters" ? home() : page === "chapter" ? chapterPage(query) : page === "lesson" ? lessonPage(query) : page === "about" ? aboutPage() : home();
  app.innerHTML = view;
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === page || (page === "chapter" && link.dataset.nav === "chapters")));
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (page === "lesson") document.querySelector("#mark-complete").addEventListener("click", markComplete);
  if (page === "home" || page === "chapters") document.querySelector("#chapter-search").addEventListener("input", filterChapters);
  if (page === "lesson") app.focus({ preventScroll: true });
}

function filterChapters(event) {
  const search = event.target.value.trim().toLowerCase();
  const cards = [...document.querySelectorAll(".chapter-card")];
  let visible = 0;
  cards.forEach(card => {
    const matches = card.dataset.search.includes(search) && (card.classList.contains("available") || !search);
    card.hidden = !matches;
    if (matches) visible++;
  });
  const grid = document.querySelector("#chapter-grid");
  let empty = grid.querySelector(".empty-state");
  if (!visible && !empty) grid.insertAdjacentHTML("beforeend", `<div class="empty-state">No available lesson matches that search.</div>`);
  if (visible && empty) empty.remove();
}

function markComplete(event) {
  localStorage.setItem(`ads1.chapter${event.currentTarget.dataset.chapter}.completed`, "true");
  event.currentTarget.textContent = "Completed";
  event.currentTarget.disabled = true;
}

menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
async function loadChapterCatalog() {
  try {
    const response = await fetch("./chapters.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const catalog = await response.json();
    if (Array.isArray(catalog) && catalog.length) chapters = catalog;
  } catch {
    chapters = bundledChapters;
  }
  render();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);
render();
loadChapterCatalog();