const app = document.querySelector("#app");
const nav = document.querySelector(".main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const supabaseConfig = window.ADS1_SUPABASE_CONFIG || {};
const supabaseReady = Boolean(
  window.supabase?.createClient &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseConfig.url || "") &&
  supabaseConfig.publishableKey &&
  !supabaseConfig.publishableKey.startsWith("YOUR_")
);
const backendClient = supabaseReady
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
let currentSession = null;
let currentProfile = null;
let studentNotes = [];
let studentNotesReady = false;
let studentNotesNotice = "";
let editingNoteId = null;
let chapterProgress = new Set();
let sharedProfiles = [];
let accountNotice = "";
let passwordRecoveryMode = false;
let emailFeature = true; // false until the owner applies the email-visibility database update
let currentIsAdmin = false;
let currentIsOwner = false;
let adminChapters = [];
let adminUsers = [];
let adminNotice = "";
let chapterPreviewUrl = null;
const bundledChapters = [
  {
    id: "1",
    number: "01",
    title: "Introduction to Programming",
    available: true,
    file: "CHAPTER1.html?v=dark-audit-2",
    sectionCount: "16 navigation topics",
    description: "The supplied lesson covers computers, problem solving, algorithms, programming languages, C, compilers, and development environments."
  },
  {
    id: "2",
    number: "02",
    title: "Sequential Algorithm",
    available: true,
    file: "CHAPTER2.html?v=dark-audit-2",
    sectionCount: "26 presentation sections",
    description: "Explore sequential algorithms, pseudocode, variables, worked examples, and interactive tracing challenges."
  },
];
let chapters = bundledChapters;

function initializeTheme() {
  let saved = null;
  try { saved = localStorage.getItem("ads1-theme"); } catch {}
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  const theme = saved === "dark" || (saved !== "light" && prefersDark) ? "dark" : "light";
  setTheme(theme);
  document.querySelector("#theme-toggle")?.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
}

function setTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try { localStorage.setItem("ads1-theme", dark ? "dark" : "light"); } catch {}
  const button = document.querySelector("#theme-toggle");
  if (button) {
    button.innerHTML = dark
      ? '<span aria-hidden="true">☀</span><span class="theme-toggle-label">Light mode</span>'
      : '<span aria-hidden="true">☾</span><span class="theme-toggle-label">Dark mode</span>';
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", String(dark));
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = dark ? "#091321" : "#1261d6";
  syncAllLessonFrameThemes();
}

function withLessonThemeBridge(html) {
  const source = String(html || "");
  const initialTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const themedSource = source.replace(/<html\b([^>]*)>/i, (_, attributes) => {
    const cleaned = attributes.replace(/\sdata-ads1-theme=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "");
    return `<html${cleaned} data-ads1-theme="${initialTheme}">`;
  });
  const bridge = "<style id=\"ads1-theme-bridge-style\">html{color-scheme:light}html[data-ads1-theme=\"dark\"]{color-scheme:dark!important;background:#091321!important;color:#e7effb!important}html[data-ads1-theme=\"dark\"] body{background:#091321!important;color:#e7effb!important}html[data-ads1-theme=\"dark\"] body *{color:#e7effb!important;border-color:#33475f!important}html[data-ads1-theme=\"dark\"] body button,html[data-ads1-theme=\"dark\"] body input,html[data-ads1-theme=\"dark\"] body select,html[data-ads1-theme=\"dark\"] body textarea{background-color:#172a40!important;color:#e7effb!important}html[data-ads1-theme=\"dark\"] body a{color:#83c4ff!important}</style><style id=\"ads1-mobile-navigation\">@media(max-width:850px){.sidebar{position:sticky!important;top:72px!important;height:auto!important;max-height:94px!important;display:flex!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;gap:7px!important;padding:8px 10px!important;z-index:9!important}.navlink{flex:0 0 150px!important;min-height:58px;white-space:normal!important;scroll-snap-align:center}.side-label{display:none!important}}@media(max-width:800px){.rail{position:sticky!important;top:76px!important;height:auto!important;max-height:78px!important;display:flex!important;align-items:center!important;gap:8px!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding:8px 12px!important;z-index:8!important}.rail #rail,.rail>div:not(.rail-title){display:flex!important;align-items:center!important;gap:8px!important;min-width:max-content}.rail button{flex:0 0 auto!important;width:auto!important;min-width:48px!important;min-height:44px!important;max-width:180px!important;justify-content:flex-start!important;scroll-snap-align:center}.rail button span:last-child{display:inline-block!important;max-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rail-title{display:none!important}.rail button:focus-visible,.navlink:focus-visible{outline:3px solid #20b8e6!important;outline-offset:2px}}</style><script>(() => {\n  const original = new WeakMap();\n  const properties = [\"background-color\", \"color\", \"border-top-color\", \"border-right-color\", \"border-bottom-color\", \"border-left-color\"];\n  function save(el) {\n    if (!original.has(el)) {\n      const values = {};\n      for (const property of properties) values[property] = [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)];\n      original.set(el, values);\n    }\n  }\n  function restore(el) {\n    const values = original.get(el);\n    if (!values) return;\n    for (const property of properties) {\n      const [value, priority] = values[property];\n      if (value) el.style.setProperty(property, value, priority);\n      else el.style.removeProperty(property);\n    }\n  }\n  function rgba(value) {\n    const values = String(value).match(/[\d.]+/g);\n    if (!values || values.length < 3) return null;\n    return { r: +values[0], g: +values[1], b: +values[2], a: values.length > 3 ? +values[3] : 1 };\n  }\n  function luminance(color) {\n    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;\n  }\n  function nearestBackground(el) {\n    for (let node = el; node; node = node.parentElement) {\n      const color = rgba(getComputedStyle(node).backgroundColor);\n      if (color && color.a > 0.35) return color;\n    }\n    return { r: 9, g: 19, b: 33, a: 1 };\n  }\n  function apply(theme) {\n    const dark = theme === \"dark\";\n    const root = document.documentElement;\n    root.dataset.ads1Theme = dark ? \"dark\" : \"light\";\n    root.style.colorScheme = dark ? \"dark\" : \"light\";\n    const nodes = [root, ...document.querySelectorAll(\"body *\")];\n    for (const el of nodes) {\n      save(el);\n      restore(el);\n      if (!dark) continue;\n      const background = rgba(getComputedStyle(el).backgroundColor);\n      if (background && background.a > 0.35 && luminance(background) > 0.78) {\n        el.style.setProperty(\"background-color\", el === root || el === document.body ? \"#091321\" : \"#101e30\", \"important\");\n      }\n    }\n    if (!dark) return;\n    for (const el of nodes) {\n      const background = nearestBackground(el);\n      const text = rgba(getComputedStyle(el).color);\n      if (text && luminance(background) < 0.3 && luminance(text) < 0.45) {\n        el.style.setProperty(\"color\", el.tagName === \"A\" ? \"#83c4ff\" : \"#e7effb\", \"important\");\n      }\n      for (const side of [\"top\", \"right\", \"bottom\", \"left\"]) {\n        const property = \"border-\" + side + \"-color\";\n        const border = rgba(getComputedStyle(el).getPropertyValue(property));\n        if (border && border.a > 0.35 && luminance(border) > 0.72) el.style.setProperty(property, \"#33475f\", \"important\");\n      }\n    }\n  }\n  window.addEventListener(\"message\", event => {\n    if (event.source !== parent || !event.data || event.data.type !== \"ADS1_THEME\") return;\n    apply(event.data.theme);\n  });\n  const observer = new MutationObserver(records => { if (!records.some(record => record.type === \"childList\" || record.attributeName === \"class\")) return; requestAnimationFrame(() => apply(document.documentElement.dataset.ads1Theme)); });\n  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: [\"class\"] });\n  const currentTheme = document.documentElement.dataset.ads1Theme || \"light\";\n  apply(currentTheme);\n  document.addEventListener(\"DOMContentLoaded\", () => apply(document.documentElement.dataset.ads1Theme || \"light\"), { once: true });\n  window.addEventListener(\"load\", () => apply(document.documentElement.dataset.ads1Theme || \"light\"), { once: true });\n})();</script>";
  const headEnd = themedSource.search(/<\/head\s*>/i);
  if (headEnd >= 0) return themedSource.slice(0, headEnd) + bridge + themedSource.slice(headEnd);
  const bodyStart = themedSource.match(/<body\b[^>]*>/i);
  if (bodyStart) {
    const index = themedSource.indexOf(bodyStart[0]) + bodyStart[0].length;
    return themedSource.slice(0, index) + bridge + themedSource.slice(index);
  }
  return bridge + themedSource;
}

const lessonOriginalBackgrounds = new WeakMap();

function applySameOriginLessonTheme(doc, theme) {
  if (!doc?.documentElement || !doc.head || !doc.body) return false;
  const existing = doc.getElementById("ads1-parent-theme");
  existing?.remove();
  for (const el of [doc.documentElement, doc.body, ...doc.body.querySelectorAll("*")]) {
    const original = lessonOriginalBackgrounds.get(el);
    if (original) {
      if (original.value) el.style.setProperty("background-color", original.value, original.priority);
      else el.style.removeProperty("background-color");
    }
  }
  if (theme !== "dark") {
    doc.documentElement.style.removeProperty("color-scheme");
    return true;
  }
  const style = doc.createElement("style");
  style.id = "ads1-parent-theme";
  style.textContent = `
    :root { color-scheme: dark !important; }
    html, body { background: #091321 !important; color: #e7effb !important; }
    body * { color: #e7effb !important; border-color: #33475f !important; }
    .top, .sidebar, .section, .mini, .slide, .intro-note, .definition, .flow div,
    .keypoints div, .quiz-question, .option, .progress, th, td, .app, .main,
    .rail, .footer, .chapter-pill, .navlink:hover, .navlink.active, .num, .slide summary {
      background-color: #101e30 !important;
    }
    .hero { background: linear-gradient(125deg, #0d3763, #1f6eaa) !important; }
    .brand, .section h2, .section h3, .navlink b, a { color: #83c4ff !important; }
    .code { background: #07111f !important; color: #e9f4ff !important; }
    button { background: #172a40 !important; color: #e7effb !important; border-color: #33475f !important; }
    .btn { background: #1769aa !important; color: #fff !important; }
    .btn.secondary { background: #172a40 !important; color: #e7effb !important; }
    .feedback.good { background: #103326 !important; color: #8de0b3 !important; }
    .feedback.bad { background: #3a2025 !important; color: #ffb8b8 !important; }
    .intro-note { color: #f1dcae !important; }
  `;
  doc.head.appendChild(style);

  const elements = [doc.documentElement, doc.body, ...doc.body.querySelectorAll("*")];
  for (const el of elements) {
    if (!lessonOriginalBackgrounds.has(el)) {
      lessonOriginalBackgrounds.set(el, {
        value: el.style.getPropertyValue("background-color"),
        priority: el.style.getPropertyPriority("background-color")
      });
    }
    const color = doc.defaultView.getComputedStyle(el).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3 || (channels.length > 3 && channels[3] <= 0.35)) continue;
    const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
    if (luminance > 0.72) {
      const isPageSurface = el === doc.documentElement || el === doc.body || el.classList?.contains("app") || el.classList?.contains("main");
      el.style.setProperty("background-color", isPageSurface ? "#091321" : "#101e30", "important");
    }
  }
  doc.documentElement.style.colorScheme = "dark";
  return true;
}

function syncLessonFrameTheme(frame) {
  if (!frame?.contentWindow) return;
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  try {
    applySameOriginLessonTheme(frame.contentDocument, theme);
  } catch {}
  frame.contentWindow.postMessage({ type: "ADS1_THEME", theme }, "*");
}

function bindLessonFrameTheme(frame) {
  if (!frame || frame.dataset.themeSyncBound) return;
  frame.dataset.themeSyncBound = "true";
  frame.addEventListener("load", () => syncLessonFrameTheme(frame));
  if (frame.contentDocument?.readyState === "complete") syncLessonFrameTheme(frame);
}

function syncAllLessonFrameThemes() {
  document.querySelectorAll("iframe.lesson-frame, #chapter-upload-preview").forEach(syncLessonFrameTheme);
}

function route() {
  const [page, query = ""] = location.hash.slice(1).split("/");
  return { page: page || "home", query };
}

function crumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => `${index ? `<span aria-hidden="true">/</span>` : ""}${item.href ? `<a href="${item.href}">${item.label}</a>` : `<strong>${item.label}</strong>`}`).join("")}</nav>`;
}

function getLastOpenedChapterId() {
  try { return localStorage.getItem("ads1.last-opened-chapter") || ""; } catch { return ""; }
}

function chapterCard(chapter) {
  const completed = chapter.available && isChapterComplete(chapter.id);
  const inProgress = chapter.available && !completed && getLastOpenedChapterId() === String(chapter.id);
  const status = completed ? "Completed" : inProgress ? "In progress" : chapter.available ? "Not started" : "Waiting for upload";
  const statusClass = completed ? "complete" : inProgress ? "in-progress" : chapter.available ? "not-started" : "pending";
  const action = completed || inProgress ? "Continue chapter <span aria-hidden=\"true\">→</span>" : "Open chapter <span aria-hidden=\"true\">→</span>";
  const description = chapter.description || "Course lesson supplied by the course team.";
  const searchText = (chapter.title + " " + description).toLowerCase();
  const state = completed ? "completed" : inProgress ? "in-progress" : "not-started";
  return `<article class="chapter-card ${chapter.available ? "available" : "unavailable"}" data-state="${state}" data-search="${escapeHTML(searchText)}">
    <div class="card-top"><span class="chapter-number">CHAPTER ${escapeHTML(chapter.number)}</span><span class="status ${statusClass}">${status}</span></div>
    <h3>${escapeHTML(chapter.title)}</h3><p>${escapeHTML(description)}</p>
    ${chapter.available ? `<a class="card-action" href="#chapter/${escapeHTML(chapter.id)}">${action}</a>` : `<span class="card-action">${action}</span>`}
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
  const arenaUI = window.ADS1ArenaUI;
  return `<section class="hero"><div class="container hero-grid fade-in">
    <div class="hero-content">
      <span class="eyebrow">ADS1 · University of Ouargla</span>
      <h1>Learn algorithms.<br><em>One step at a time.</em></h1>
      <p>Study your ADS1 lessons, explore worked examples, practise algorithm tracing, and test your understanding through interactive activities.</p>
      <div class="hero-actions">
        ${(() => { const last = chapters.find(item => item.available && String(item.id) === getLastOpenedChapterId()); return last ? `<a class="button" href="#lesson/${escapeHTML(last.id)}">Continue: ${escapeHTML(last.title)} <span class="arrow" aria-hidden="true">→</span></a>` : `<a class="button" href="#chapters">Explore chapters <span class="arrow" aria-hidden="true">→</span></a>`; })()}
        ${arenaUI ? `<a class="button secondary" href="#arena">Enter the Arena <span class="arrow" aria-hidden="true">→</span></a>` : ""}
      </div>
    </div>
    ${arenaUI ? arenaUI.heroDemo() : ""}
  </div></section>
  ${arenaUI ? arenaUI.homeStrip() : ""}
  <section class="container learning-guide" aria-labelledby="learning-guide-title">
    <div class="learning-guide-heading"><span class="eyebrow">A simple study path</span><h2 id="learning-guide-title">Make progress one step at a time</h2></div>
    <div class="learning-steps">
      <a class="learning-step" href="#chapters"><span class="learning-step-number">01</span><span><strong>Study a chapter</strong><small>Read the lesson and follow its examples.</small></span><span class="learning-step-arrow" aria-hidden="true">→</span></a>
      <a class="learning-step" href="#arena"><span class="learning-step-number">02</span><span><strong>Practise what you learned</strong><small>Use the Arena to test your understanding.</small></span><span class="learning-step-arrow" aria-hidden="true">→</span></a>
      <a class="learning-step" href="#account"><span class="learning-step-number">03</span><span><strong>Track your progress</strong><small>Mark lessons complete and see your progress.</small></span><span class="learning-step-arrow" aria-hidden="true">→</span></a>
    </div>
  </section>
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
    <div class="chapter-filters" role="group" aria-label="Filter chapters">
      <button class="chapter-filter active" type="button" data-chapter-filter="all" aria-pressed="true">All chapters</button>
      <button class="chapter-filter" type="button" data-chapter-filter="in-progress" aria-pressed="false">In progress</button>
      <button class="chapter-filter" type="button" data-chapter-filter="not-started" aria-pressed="false">Not started</button>
      <button class="chapter-filter" type="button" data-chapter-filter="completed" aria-pressed="false">Completed</button>
    </div>
    <div class="chapter-grid" id="chapter-grid">${chapters.map(chapterCard).join("")}${chapters.some(chapter => chapter.remote) ? "" : waitingChaptersCard()}</div>
    <p class="content-note">Only supplied course material is shown as available. New chapters uploaded by an administrator appear here automatically.</p>
  </div></section>`;
}

function chapterPage(id) {
  const chapter = chapters.find(item => item.id === id && item.available);
  if (!chapter) return home();
  const completed = isChapterComplete(chapter.id);
  return `<section class="container page-shell fade-in">
    ${crumbs([{ label: "Home", href: "#home" }, { label: "Chapters", href: "#chapters" }, { label: `Chapter ${chapter.number}` }])}
    <div class="chapter-intro"><div><span class="eyebrow">Chapter ${escapeHTML(chapter.number)} · Available lesson</span><h1>${escapeHTML(chapter.title)}</h1>
      <p>${escapeHTML(chapter.description)}</p>
    </div><aside class="chapter-aside"><span>Course material</span><strong>${escapeHTML(chapter.sectionCount)}</strong></aside></div>
    <div class="lesson-row"><span class="lesson-index">01</span><div><h2>${escapeHTML(chapter.title)}</h2><p>Integrated lesson · source content and activities preserved</p></div><a class="button" href="#lesson/${escapeHTML(chapter.id)}">${completed ? "Continue lesson" : "Start lesson"}<span class="arrow" aria-hidden="true">→</span></a></div>
    <div class="content-note">The learning outcomes and section list are presented in the lesson as supplied. ${currentSession ? "Your completion status is saved to your account." : "Without an account, completion is saved only in this browser."}${chapter.id === "1" ? " The supplied page labels this lesson Chapter 2, while its cited PDF title identifies it as Chapter 1; this hub lists it as Chapter 1 to keep the separately supplied Sequential Algorithm lesson as Chapter 2." : ""}</div>
  </section>`;
}

function lessonPage(id) {
  const chapter = chapters.find(item => item.id === id && item.available);
  if (!chapter) return home();
  return `<div class="lesson-toolbar"><a class="button secondary" href="#chapter/${escapeHTML(chapter.id)}"><span aria-hidden="true">←</span> Back to chapter</a><div class="lesson-toolbar-title"><strong>${escapeHTML(chapter.title)}</strong><span>Chapter ${escapeHTML(chapter.number)} · University of Ouargla</span></div><button class="button secondary" id="mark-complete" data-chapter="${escapeHTML(chapter.id)}" type="button" ${isChapterComplete(chapter.id) ? "disabled" : ""}>${isChapterComplete(chapter.id) ? "Completed" : "Mark complete"}</button></div>
  <iframe class="lesson-frame" ${chapter.remote ? `data-remote-src="${escapeHTML(chapter.file)}"` : `src="${escapeHTML(chapter.file)}"`} title="Chapter ${escapeHTML(chapter.number)}: ${escapeHTML(chapter.title)} lesson" allow="fullscreen"${chapter.remote ? ' sandbox="allow-scripts allow-forms"' : ""}></iframe>`;
}

// Supabase Storage serves uploaded .html files as text/plain, so loading the
// public URL directly in an iframe shows the source code. Fetch the file as
// text and render it with srcdoc so the browser treats it as a web page.
async function loadRemoteLesson() {
  const frame = document.querySelector("iframe.lesson-frame[data-remote-src]");
  if (!frame) return;
  bindLessonFrameTheme(frame);
  const url = frame.dataset.remoteSrc;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Lesson request failed (${response.status})`);
    const html = await response.text();
    if (!frame.isConnected) return;
    frame.srcdoc = withLessonThemeBridge(html);
  } catch (error) {
    if (!frame.isConnected) return;
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem"><p>This lesson could not be loaded. Please refresh the page and try again.</p></body>`;
  }
}

function isChapterComplete(chapterId) {
  return currentSession
    ? chapterProgress.has(String(chapterId))
    : localStorage.getItem(`ads1.chapter${chapterId}.completed`) === "true";
}

function completedAvailableChapterCount() {
  return chapters.filter(chapter => chapter.available && chapterProgress.has(String(chapter.id))).length;
}

// Course progress = lessons (70%) + Algo Arena levels (30%).
function computeProgressPercent() {
  const arenaUI = window.ADS1ArenaUI;
  const arenaWeight = arenaUI ? arenaUI.WEIGHT_PERCENT : 0;
  const total = chapters.filter(chapter => chapter.available).length;
  const lessons = total ? completedAvailableChapterCount() / total : 0;
  const arena = arenaUI ? arenaUI.completedCount() / arenaUI.levelCount : 0;
  return Math.round((100 - arenaWeight) * lessons + arenaWeight * arena);
}

// Recomputes the percentage after an Arena level or lesson changes and stores it.
async function syncProgressPercent() {
  if (!backendClient || !currentSession || !currentProfile) return;
  // The database recalculates the shared percentage from lesson and Arena rows.
  currentProfile.progress_percent = computeProgressPercent();
}

function profileColumns() {
  return emailFeature ? "display_name, progress_percent, show_email" : "display_name, progress_percent";
}

function studentNotesPanel() {
  const chapterOptions = chapters.filter(chapter => chapter.available).map(chapter =>
    `<option value="${escapeHTML(chapter.id)}">${escapeHTML(chapter.number)} · ${escapeHTML(chapter.title)}</option>`
  ).join("");
  const noteRows = studentNotes.map(note => {
    const chapter = chapters.find(item => String(item.id) === String(note.chapter_id));
    const chapterLabel = chapter ? chapter.title : `Chapter ${note.chapter_id}`;
    const typeLabel = note.note_type === "question" ? "Question" : "Summary";
    const dateLabel = note.updated_at ? new Date(note.updated_at).toLocaleDateString() : "";
    return `<article class="student-note-card">
      <div class="student-note-meta"><span class="student-note-kind ${note.note_type === "question" ? "question" : "summary"}">${typeLabel}</span><span>${escapeHTML(chapterLabel)}</span>${dateLabel ? `<time datetime="${escapeHTML(note.updated_at)}">Updated ${escapeHTML(dateLabel)}</time>` : ""}</div>
      <h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.content)}</p>
      <div class="student-note-actions"><button class="button secondary" type="button" data-edit-note="${escapeHTML(note.id)}">Edit</button><button class="text-button danger-text" type="button" data-delete-note="${escapeHTML(note.id)}">Delete</button></div>
    </article>`;
  }).join("");
  return `<section class="student-notes-panel" id="student-notes" aria-labelledby="student-notes-heading">
    <div class="student-notes-heading"><div><span class="eyebrow">Private to your account</span><h2 id="student-notes-heading">My notes</h2></div><span class="student-notes-count">${studentNotesReady ? studentNotes.length : "—"} saved</span></div>
    <p class="student-notes-intro">Save a summary or a question beside the chapter it belongs to. Only you can read these notes.</p>
    <p class="account-notice ${studentNotesNotice ? "error" : ""}" id="notes-notice" aria-live="polite">${escapeHTML(studentNotesNotice)}</p>
    <form class="student-note-form" id="student-note-form">
      <div class="student-note-fields">
        <label for="student-note-chapter">Chapter<select id="student-note-chapter" name="chapterId" required ${studentNotesReady ? "" : "disabled"}>${chapterOptions}</select></label>
        <label for="student-note-type">Type<select id="student-note-type" name="noteType" required ${studentNotesReady ? "" : "disabled"}><option value="summary">Summary</option><option value="question">Question</option></select></label>
      </div>
      <label for="student-note-title">Title<input id="student-note-title" name="title" maxlength="120" required ${studentNotesReady ? "" : "disabled"} placeholder="A short title"></label>
      <label for="student-note-content">Your note<textarea id="student-note-content" name="content" rows="5" maxlength="10000" required ${studentNotesReady ? "" : "disabled"} placeholder="Write a summary or a question about this chapter…"></textarea></label>
      <div class="student-note-form-actions"><button class="button" id="save-student-note" type="submit" ${studentNotesReady ? "" : "disabled"}>${editingNoteId ? "Save changes" : "Save note"}</button><button class="button secondary" id="cancel-note-edit" type="button" ${editingNoteId ? "" : "hidden"}>Cancel edit</button></div>
    </form>
    <div class="student-notes-list" id="student-notes-list" aria-live="polite">${noteRows || (studentNotesReady ? `<p class="student-notes-empty">Your saved summaries and questions will appear here.</p>` : "")}</div>
  </section>`;
}

async function loadStudentNotes(userId) {
  studentNotes = [];
  studentNotesReady = false;
  if (!backendClient || !userId) return;
  const { data, error } = await backendClient.from("student_notes")
    .select("id, chapter_id, note_type, title, content, created_at, updated_at")
    .eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) {
    studentNotesNotice = "Private notes need a database update before they can be used. Please contact the site owner.";
    editingNoteId = null;
    return;
  }
  studentNotes = Array.isArray(data) ? data : [];
  studentNotesReady = true;
  studentNotesNotice = "";
  if (editingNoteId && !studentNotes.some(note => String(note.id) === String(editingNoteId))) editingNoteId = null;
}

function bindStudentNotes() {
  document.querySelector("#student-note-form")?.addEventListener("submit", saveStudentNote);
  document.querySelector("#cancel-note-edit")?.addEventListener("click", () => {
    editingNoteId = null;
    render();
    document.querySelector("#student-note-title")?.focus();
  });
  document.querySelector("#student-notes-list")?.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-note]");
    if (editButton) {
      const note = studentNotes.find(item => String(item.id) === editButton.dataset.editNote);
      if (!note) return;
      editingNoteId = note.id;
      render();
      const form = document.querySelector("#student-note-form");
      form.elements.chapterId.value = String(note.chapter_id);
      form.elements.noteType.value = note.note_type;
      form.elements.title.value = note.title;
      form.elements.content.value = note.content;
      document.querySelector("#student-note-title")?.focus();
      return;
    }
    const deleteButton = event.target.closest("[data-delete-note]");
    if (deleteButton && window.confirm("Delete this note? This cannot be undone.")) await deleteStudentNote(deleteButton.dataset.deleteNote);
  });
}

async function saveStudentNote(event) {
  event.preventDefault();
  if (!currentSession || !studentNotesReady) return;
  const form = new FormData(event.currentTarget);
  const values = {
    chapter_id: String(form.get("chapterId") || ""),
    note_type: String(form.get("noteType") || ""),
    title: String(form.get("title") || "").trim(),
    content: String(form.get("content") || "").trim(),
    updated_at: new Date().toISOString()
  };
  if (!values.title || !values.content || !["summary", "question"].includes(values.note_type)) return;
  const notice = document.querySelector("#notes-notice");
  if (notice) { notice.textContent = "Saving your private note…"; notice.className = "account-notice"; }
  const result = editingNoteId
    ? await backendClient.from("student_notes").update(values).eq("id", editingNoteId).eq("user_id", currentSession.user.id).select("id").single()
    : await backendClient.from("student_notes").insert({ ...values, user_id: currentSession.user.id }).select("id").single();
  if (result.error) {
    if (notice) { notice.textContent = "Could not save this note. Please try again."; notice.className = "account-notice error"; }
    return;
  }
  editingNoteId = null;
  await loadStudentNotes(currentSession.user.id);
  render();
}

async function deleteStudentNote(noteId) {
  if (!currentSession || !studentNotesReady) return;
  const { error } = await backendClient.from("student_notes").delete().eq("id", noteId).eq("user_id", currentSession.user.id);
  if (error) {
    const notice = document.querySelector("#notes-notice");
    if (notice) { notice.textContent = "Could not delete this note. Please try again."; notice.className = "account-notice error"; }
    return;
  }
  if (String(editingNoteId) === String(noteId)) editingNoteId = null;
  await loadStudentNotes(currentSession.user.id);
  render();
}

function accountPage() {
  if (!backendClient) {
    return `<section class="container account-shell fade-in">
      <span class="eyebrow">Student account</span><h1>Accounts are not connected yet</h1>
      <p class="account-intro">The site needs its secure authentication service configured before students can register. Account passwords are never stored in this website.</p>
      <div class="content-note">Setup requires a Supabase project and a private Google Sheet integration. Follow the owner setup guide, then add only the Supabase project URL and public publishable key to <code>supabase-config.js</code>.</div>
      <a class="button secondary" href="AUTH-SETUP.md">Open account setup guide <span class="arrow" aria-hidden="true">→</span></a>
    </section>`;
  }

  if (currentSession && currentProfile) {
    const availableChapters = chapters.filter(chapter => chapter.available);
    const total = availableChapters.length;
    const completedLessons = completedAvailableChapterCount();
    const percent = Number(currentProfile.progress_percent) || 0;
    const arenaUI = window.ADS1ArenaUI;
    const arenaDone = arenaUI && typeof arenaUI.completedCount === "function" ? arenaUI.completedCount() : 0;
    const arenaTotal = arenaUI && Number(arenaUI.levelCount) ? Number(arenaUI.levelCount) : 0;
    const arenaSummary = arenaUI ? arenaUI.summaryHTML() : "";
    const nextChapter = availableChapters.find(chapter => !chapterProgress.has(String(chapter.id)));
    const nextStep = nextChapter
      ? `<section class="progress-next-step" aria-labelledby="next-step-title"><div><span class="eyebrow">Suggested next step</span><h3 id="next-step-title">Continue with ${escapeHTML(nextChapter.title)}</h3><p>${completedLessons} of ${total} available chapters complete. Pick up with this chapter and mark it complete from the lesson toolbar.</p></div><a class="button" href="#chapter/${encodeURIComponent(nextChapter.id)}">Continue chapter <span aria-hidden="true">→</span></a></section>`
      : arenaDone < arenaTotal
        ? `<section class="progress-next-step" aria-labelledby="next-step-title"><div><span class="eyebrow">Suggested next step</span><h3 id="next-step-title">Practise in Algo Arena</h3><p>All ${total} available chapters are complete. Clear another practice level to build your course progress.</p></div><a class="button" href="#arena">Open the Arena <span aria-hidden="true">→</span></a></section>`
        : `<section class="progress-next-step complete" aria-labelledby="next-step-title"><div><span class="eyebrow">Suggested next step</span><h3 id="next-step-title">All available work is complete</h3><p>You have finished every available chapter and Arena level. Try a Smart Review to keep the key ideas fresh.</p></div><a class="button secondary" href="#arena/review">Try Smart Review <span aria-hidden="true">→</span></a></section>`;
    const lessonRows = availableChapters.map(chapter => {
      const completed = chapterProgress.has(String(chapter.id));
      return `<div class="account-lesson"><span>${escapeHTML(chapter.title)}</span><strong class="${completed ? "lesson-done" : "lesson-pending"}">${completed ? "Completed" : "Not completed"}</strong></div>`;
    }).join("");
    const leaderboardRows = sharedProfiles.map((profile, index) => `<li><span class="leader-rank">${String(index + 1).padStart(2, "0")}</span><span class="leader-name">${escapeHTML(profile.display_name)}${profile.email ? `<small class="leader-email">${escapeHTML(profile.email)}</small>` : ""}</span><span class="leader-xp">${Number(profile.arena_points) ? `${Number(profile.arena_points)} XP` : ""}</span><strong>${Math.round(Number(profile.progress_percent) || 0)}%</strong></li>`).join("");
    return `<section class="container account-shell fade-in">
      <span class="eyebrow">Student account</span><h1>Your learning progress</h1>
      <div class="account-welcome"><div><span>Signed in as</span><strong>${escapeHTML(currentProfile.display_name)}</strong></div><button class="button secondary" id="sign-out" type="button">Sign out</button></div>
      <section class="progress-panel" aria-labelledby="progress-heading">
        <div class="progress-heading"><div><span class="eyebrow">Course progress</span><h2 id="progress-heading">${percent}% complete</h2></div><span class="progress-count">${completedAvailableChapterCount()} of ${total} chapters</span></div>
        <progress class="course-progress" value="${percent}" max="100" aria-label="Course completion ${percent} percent"></progress>
        <div class="progress-metrics" aria-label="Progress breakdown">
          <div class="progress-metric"><span>Chapters</span><strong>${completedLessons} / ${total}</strong><small>completed</small></div>
          <div class="progress-metric"><span>Algo Arena</span><strong>${arenaDone} / ${arenaTotal}</strong><small>levels cleared</small></div>
        </div>
        ${nextStep}
        <h3 class="progress-checklist-title">Chapter checklist</h3>
        <div class="account-lesson-list">${lessonRows}</div>
        ${arenaSummary}
      </section>
      ${studentNotesPanel()}
      <section class="leaderboard-panel" aria-labelledby="leaderboard-heading">
        <div class="leaderboard-heading"><div><span class="eyebrow">Shared with signed-in students</span><h2 id="leaderboard-heading">Course progress board</h2></div><button class="button secondary" id="load-leaderboard" type="button">${sharedProfiles.length ? "Refresh" : "Show board"}</button></div>
        <p>Display names, Arena XP and completion percentages appear here. Detailed lesson records are private, and an email address appears only if its owner chooses to show it.</p>
        ${sharedProfiles.length ? `<ol class="leaderboard-list">${leaderboardRows}</ol>` : `<div class="leaderboard-empty">Select “Show board” to view student progress.</div>`}
      </section>
      ${emailFeature ? `<form id="email-privacy-form" class="privacy-form"><label class="switch"><input type="checkbox" id="show-email" ${currentProfile.show_email ? "checked" : ""}><span class="switch-track" aria-hidden="true"></span><span class="switch-text"><strong>Show my email on the progress board</strong><small>${currentProfile.show_email ? "Other signed-in students can see your email address." : "Your email is hidden. Only your display name is shown."}</small></span></label></form>` : `<p class="privacy-form unavailable">Choosing whether to show your email needs a database update by the site owner, so it is not available yet. Your email stays hidden.</p>`}
      <form id="display-name-form" class="account-name-form"><label for="display-name">Display name</label><div><input id="display-name" name="displayName" maxlength="40" minlength="2" value="${escapeHTML(currentProfile.display_name)}" required><button class="button secondary" type="submit">Update name</button></div></form>
      <p class="account-notice" id="account-notice" aria-live="polite">${escapeHTML(accountNotice)}</p>
      ${currentIsAdmin ? adminPanel() : ""}
    </section>`;
  }

  if (passwordRecoveryMode && currentSession) {
    return `<section class="container account-shell fade-in">
      <span class="eyebrow">Student account</span><h1>Choose a new password</h1>
      <p class="account-intro">Enter a new password for your account. You will stay signed in after saving it.</p>
      <div class="auth-grid">
        <form id="recovery-form" class="auth-form"><h2>New password</h2>
          <label for="recovery-password">New password</label><input id="recovery-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
          <label for="recovery-confirm">Confirm new password</label><input id="recovery-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
          <button class="button" type="submit">Save new password</button>
        </form>
      </div>
      <p class="account-notice" id="account-notice" aria-live="polite">${escapeHTML(accountNotice)}</p>
    </section>`;
  }

  if (currentSession) {
    return `<section class="container account-shell fade-in">
      <span class="eyebrow">Student account</span><h1>Finishing account setup</h1>
      <p class="account-intro">${escapeHTML(accountNotice || "Your account is signed in. Profile data is loading or needs the owner to finish the database setup.")}</p>
      <button class="button secondary" id="sign-out" type="button">Sign out</button>
    </section>`;
  }

  return `<section class="container account-shell fade-in">
    <span class="eyebrow">Student account</span><h1>Join the ADS1 learning hub</h1>
    <p class="account-intro">Use one account per email address. Your detailed progress stays private; signed-in students can see your chosen display name and overall completion percentage.</p>
    <div class="auth-grid">
      <form id="signup-form" class="auth-form"><h2>Create account</h2>
        <label for="signup-name">Display name</label><input id="signup-name" name="displayName" autocomplete="nickname" minlength="2" maxlength="40" required>
        <label for="signup-email">Email</label><input id="signup-email" name="email" type="email" autocomplete="email" required>
        <label for="signup-password">Password</label><input id="signup-password" name="password" type="password" autocomplete="new-password" minlength="8" required>
        <button class="button" type="submit">Sign up</button>
      </form>
      <form id="login-form" class="auth-form"><h2>Sign in</h2>
        <label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="email" required>
        <label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required>
        <button class="button secondary" type="submit">Sign in</button>
        <button class="text-button" id="forgot-password" type="button">Forgot your password?</button>
      </form>
    </div>
    <p class="account-notice" id="account-notice" aria-live="polite">${escapeHTML(accountNotice)}</p>
    <p class="privacy-note">Passwords are managed by Supabase, not stored in the ADS1 website. Emails are used for account access and the owner’s private roster sheet. Only display name and overall progress percentage are shown to other signed-in students.</p>
  </section>`;
}

function adminPanel() {
  const chapterRows = adminChapters.map(chapter => `
    <div class="admin-chapter-row">
      <div class="admin-user-identity"><strong>Chapter ${escapeHTML(chapter.number)} · ${escapeHTML(chapter.title)}</strong><span>${escapeHTML(chapter.available ? "Visible to students" : "Hidden from students")}</span></div>
      <div class="admin-chapter-actions">
        <button class="button secondary admin-user-action admin-chapter-visibility" type="button" data-chapter-id="${escapeHTML(chapter.id)}" data-visible="${chapter.available}">${chapter.available ? "Hide chapter" : "Show chapter"}</button>
        ${chapter.remote ? `<button class="button secondary admin-user-action admin-chapter-delete" type="button" data-delete-chapter-id="${escapeHTML(chapter.id)}">Delete chapter</button>` : ""}
      </div>
    </div>`).join("");
  const rows = adminUsers.map(user => {
    const protectedUser = user.owner || user.administrator || user.userId === currentSession?.user?.id;
    const nextActive = user.disabled;
    const actionLabel = user.disabled ? "Reactivate" : "Deactivate";
    const stateLabel = user.owner ? "Site owner" : user.administrator ? (user.disabled ? "Administrator · Disabled" : "Administrator") : user.disabled ? "Disabled" : "Active";
    const adminAction = user.administrator ? "Revoke admin" : "Make admin";
    return `<div class="admin-user-row">
      <div class="admin-user-identity"><strong>${escapeHTML(user.displayName || "Student")}</strong><span>${escapeHTML(user.email)}</span></div>
      <span class="admin-user-status ${user.disabled ? "disabled" : ""}">${stateLabel}</span>
      ${currentIsOwner && !user.owner ? `<button class="button secondary admin-user-action" type="button" data-admin-user-id="${escapeHTML(user.userId)}" data-is-admin="${user.administrator}" ${!user.confirmed || (user.disabled && !user.administrator) ? "disabled title=\"Account must be confirmed and active to become an administrator\"" : ""}>${adminAction}</button>` : ""}
      <button class="button secondary admin-user-action" type="button" data-user-id="${escapeHTML(user.userId)}" data-active="${nextActive}" ${protectedUser ? "disabled" : ""}>${actionLabel}</button>
    </div>`;
  }).join("");

  return `<section class="admin-panel" aria-labelledby="admin-heading">
    <span class="eyebrow">Site administration</span><h2 id="admin-heading">Administrator tools</h2>
    <p>${currentIsOwner ? "You are the only site owner. You can appoint or remove administrators; appointed administrators can upload chapters and manage student access." : "Only the site owner can appoint administrators. You can upload chapters and manage student access."}</p>
    <form id="chapter-upload-form" class="admin-upload-form">
      <h3>Upload a chapter</h3>
      <div class="admin-upload-grid">
        <label>Chapter number<input name="number" type="number" min="3" max="99" required></label>
        <label>Chapter title<input name="title" maxlength="120" required></label>
      </div>
      <label>Description<textarea name="description" maxlength="1000" rows="3"></textarea></label>
      <label>Self-contained HTML lesson<input name="lesson" type="file" accept=".html,text/html" required></label>
      <p class="admin-help">Choose one HTML lesson file up to 5 MB. Keep its images and styles inside the file.</p>
      <p class="admin-help" id="chapter-preview-status" aria-live="polite">Select a file to preview the rendered lesson before uploading it.</p>
      <iframe class="chapter-upload-preview" id="chapter-upload-preview" title="Rendered chapter preview" sandbox="allow-scripts allow-forms" hidden></iframe>
      <button class="button" type="submit">Upload chapter</button>
    </form>
    <div class="admin-chapters-heading"><h3>Chapter visibility</h3></div>
    <div class="admin-chapters" id="admin-chapters">${chapterRows || `<p class="admin-help">No chapters found.</p>`}</div>
    <p class="account-notice" id="admin-notice" aria-live="polite">${escapeHTML(adminNotice)}</p>
    <div class="admin-users-heading"><h3>Student accounts</h3><button class="button secondary" id="refresh-admin-users" type="button">Refresh list</button></div>
    <div class="admin-users" id="admin-users">${rows || `<p class="admin-help">No student accounts found.</p>`}</div>
  </section>`;
}

function setAdminNotice(message, kind = "") {
  adminNotice = message;
  const notice = document.querySelector("#admin-notice");
  if (notice) {
    notice.textContent = message;
    notice.className = `account-notice ${kind}`;
  }
}

function clearChapterPreview() {
  if (chapterPreviewUrl) URL.revokeObjectURL(chapterPreviewUrl);
  chapterPreviewUrl = null;
}

async function previewChapterFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const preview = document.querySelector("#chapter-upload-preview");
  const status = document.querySelector("#chapter-preview-status");
  if (!preview || !status) return;
  clearChapterPreview();
  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    status.textContent = "Select a file to preview the rendered lesson before uploading it.";
    return;
  }
  status.textContent = `Preparing the preview for ${file.name}…`;
  try {
    const source = await file.text();
    if (!preview.isConnected || input.files?.[0] !== file) return;
    const html = new Blob([withLessonThemeBridge(source)], { type: "text/html;charset=utf-8" });
    chapterPreviewUrl = URL.createObjectURL(html);
    bindLessonFrameTheme(preview);
    preview.src = chapterPreviewUrl;
    preview.hidden = false;
    status.textContent = `Previewing ${file.name}. Its colors follow the site theme. Upload it to make this lesson available to students.`;
  } catch {
    status.textContent = "This HTML file could not be previewed. Try saving it as UTF-8 and selecting it again.";
  }
}

function bindAdminForms() {
  document.querySelector("#chapter-upload-form")?.addEventListener("submit", uploadChapter);
  document.querySelector("#chapter-upload-form [name=lesson]")?.addEventListener("change", previewChapterFile);
  document.querySelector("#refresh-admin-users")?.addEventListener("click", refreshAdminUsers);
  document.querySelector("#admin-users")?.addEventListener("click", handleAdminUserAction);
  document.querySelector("#admin-chapters")?.addEventListener("click", handleAdminChapterAction);
}

async function deleteAdminChapter(button) {
  const chapter = adminChapters.find(item => item.id === button.dataset.deleteChapterId);
  if (!chapter || !chapter.remote) return;
  if (!window.confirm(`Permanently delete Chapter ${chapter.number} · ${chapter.title}? This removes the uploaded lesson and cannot be undone. Use "Hide chapter" if you only want to hide it from students.`)) return;

  button.disabled = true;
  setAdminNotice("Deleting chapter…");
  const { data, error } = await backendClient.functions.invoke("admin-tools", {
    body: { action: "delete-chapter", chapterId: chapter.id }
  });
  if (error || !data?.ok) {
    setAdminNotice(data?.error || error?.message || "Could not delete this chapter.", "error");
    button.disabled = false;
    return;
  }
  await loadChapterCatalog();
  adminNotice = `Chapter ${chapter.number} was deleted.`;
  render();
}

async function handleAdminChapterAction(event) {
  const deleteButton = event.target.closest("button[data-delete-chapter-id]");
  if (deleteButton) {
    if (currentIsAdmin) await deleteAdminChapter(deleteButton);
    return;
  }
  const button = event.target.closest("button[data-chapter-id]");
  if (!button || !currentIsAdmin) return;
  const chapter = adminChapters.find(item => item.id === button.dataset.chapterId);
  if (!chapter) return;
  const visible = button.dataset.visible !== "true";

  button.disabled = true;
  setAdminNotice(visible ? "Showing chapter…" : "Hiding chapter…");
  const { data, error } = await backendClient.functions.invoke("admin-tools", {
    body: { action: "set-chapter-visibility", chapterId: chapter.id, visible }
  });
  if (error || !data?.ok) {
    setAdminNotice(data?.error || error?.message || "Could not update chapter visibility.", "error");
    button.disabled = false;
    return;
  }
  await loadChapterCatalog();
  adminNotice = `Chapter ${chapter.number} is now ${visible ? "visible" : "hidden"} to students.`;
  render();
}

async function refreshAdminUsers() {
  if (!currentIsAdmin) return;
  setAdminNotice("Loading student accounts…");
  const { data, error } = await backendClient.functions.invoke("admin-tools", {
    body: { action: "list-users" }
  });
  if (error || !Array.isArray(data?.users)) {
    setAdminNotice(error?.message || "Could not load student accounts.", "error");
    return;
  }
  adminUsers = data.users;
  adminNotice = "";
  render();
}

async function changeStudentAccess(event) {
  const button = event.target.closest("button[data-user-id]");
  if (!button || !currentIsAdmin) return;
  const active = button.dataset.active === "true";
  const action = active ? "reactivate" : "disable";
  if (!window.confirm(`Are you sure you want to ${action} this student account?`)) return;

  button.disabled = true;
  setAdminNotice(active ? "Reactivating account…" : "Disabling account…");
  const { data, error } = await backendClient.functions.invoke("admin-tools", {
    body: { action: "set-user-active", userId: button.dataset.userId, active }
  });
  if (error || !data?.ok) {
    setAdminNotice(data?.error || error?.message || "Could not change this account.", "error");
    button.disabled = false;
    return;
  }
  await refreshAdminUsers();
  setAdminNotice(active ? "Student account reactivated." : "Student account disabled.", "success");
}

async function handleAdminUserAction(event) {
  const adminButton = event.target.closest("button[data-admin-user-id]");
  if (adminButton) {
    if (!currentIsOwner) return;
    const administrator = adminButton.dataset.isAdmin !== "true";
    const action = administrator ? "grant administrator access to" : "remove administrator access from";
    if (!window.confirm(`Are you sure you want to ${action} this account?`)) return;
    adminButton.disabled = true;
    setAdminNotice(administrator ? "Granting administrator access…" : "Removing administrator access…");
    const { data, error } = await backendClient.functions.invoke("admin-tools", {
      body: { action: "set-admin-status", userId: adminButton.dataset.adminUserId, administrator }
    });
    if (error || !data?.ok) {
      setAdminNotice(data?.error || error?.message || "Could not change administrator access.", "error");
      adminButton.disabled = false;
      return;
    }
    await refreshAdminUsers();
    setAdminNotice(administrator ? "Administrator access granted." : "Administrator access removed.", "success");
    return;
  }
  await changeStudentAccess(event);
}

async function uploadChapter(event) {
  event.preventDefault();
  if (!currentIsAdmin || !currentSession) return;
  const form = new FormData(event.currentTarget);
  const numberValue = String(form.get("number") || "").trim();
  const number = Number(numberValue);
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  const file = form.get("lesson");

  if (!Number.isInteger(number) || number < 3 || number > 99 || !title || !(file instanceof File)) {
    setAdminNotice("Enter a valid chapter number, title, and HTML lesson.", "error");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".html") || (file.type && file.type !== "text/html") || file.size > 5 * 1024 * 1024) {
    setAdminNotice("Choose an HTML file no larger than 5 MB.", "error");
    return;
  }

  const chapterNumber = String(number).padStart(2, "0");
  if (adminChapters.some(chapter => String(chapter.number).padStart(2, "0") === chapterNumber)) {
    setAdminNotice("That chapter number is already in use.", "error");
    return;
  }
  const id = `extra-${number}-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const path = `${id}/${crypto.randomUUID()}.html`;
  setAdminNotice("Uploading the lesson…");
  const { error: uploadError } = await backendClient.storage
    .from("course-chapters")
    .upload(path, file, { contentType: "text/html", cacheControl: "3600", upsert: false });
  if (uploadError) {
    setAdminNotice(uploadError.message, "error");
    return;
  }

  const { error: catalogError } = await backendClient.from("chapter_catalog").insert({
    id,
    number: chapterNumber,
    title,
    description,
    section_count: "HTML lesson",
    file_path: path,
    available: true
  });
  if (catalogError) {
    await backendClient.storage.from("course-chapters").remove([path]);
    setAdminNotice(catalogError.message, "error");
    return;
  }

  clearChapterPreview();
  adminNotice = `Chapter ${String(number).padStart(2, "0")} is now available.`;
  await loadChapterCatalog();
  render();
}

async function loadAdminState() {
  currentIsAdmin = false;
  currentIsOwner = false;
  adminUsers = [];
  if (!backendClient || !currentSession) return;

  const { data, error } = await backendClient.rpc("is_site_admin");
  if (error || data !== true) return;
  currentIsAdmin = true;
  const { data: ownerData } = await backendClient.rpc("is_site_owner");
  currentIsOwner = ownerData === true;
  const { data: result, error: listError } = await backendClient.functions.invoke("admin-tools", {
    body: { action: "list-users" }
  });
  if (listError || !Array.isArray(result?.users)) {
    adminNotice = "Administrator access is ready, but the account manager needs setup.";
    return;
  }
  adminUsers = result.users;
  adminNotice = "";
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
  const arenaUI = window.ADS1ArenaUI;
  const glossaryUI = window.ADS1GlossaryUI;
  const focusUI = window.ADS1FocusTimerUI;
  const view = page === "focus" && focusUI ? focusUI.view() : page === "glossary" && glossaryUI ? glossaryUI.view() : page === "chapters" ? home() : page === "chapter" ? chapterPage(query) : page === "lesson" ? lessonPage(query) : page === "account" ? accountPage() : page === "about" ? aboutPage() : page === "arena" && arenaUI ? arenaUI.view() : home();
  app.innerHTML = view;
  document.querySelectorAll("iframe.lesson-frame").forEach(frame => {
    bindLessonFrameTheme(frame);
    syncLessonFrameTheme(frame);
  });
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === page || (page === "chapter" && link.dataset.nav === "chapters")));
  if (page === "arena" && arenaUI) arenaUI.bind();
  if (page === "glossary" && glossaryUI) glossaryUI.bind();
  if (page === "focus" && focusUI) focusUI.bind();
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (page === "lesson") {
    const lessonChapter = chapters.find(item => item.available && String(item.id) === query);
    if (lessonChapter) { try { localStorage.setItem("ads1.last-opened-chapter", String(lessonChapter.id)); } catch {} }
    document.querySelector("#mark-complete").addEventListener("click", markComplete);
  }
  if (page === "account" && backendClient) bindAccountForms();
  if (page === "account" && currentIsAdmin) bindAdminForms();
  if (page === "home" || page === "chapters") {
    document.querySelector("#chapter-search").addEventListener("input", filterChapters);
    document.querySelectorAll("[data-chapter-filter]").forEach(button => button.addEventListener("click", filterChapters));
  }
  if ((page === "home" || page === "chapters") && arenaUI) arenaUI.bindHome();
  if (page === "lesson") loadRemoteLesson();
  if (page === "lesson") app.focus({ preventScroll: true });
}

function filterChapters(event) {
  if (event.currentTarget?.matches("[data-chapter-filter]")) {
    document.querySelectorAll("[data-chapter-filter]").forEach(button => {
      const active = button === event.currentTarget;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  const search = (document.querySelector("#chapter-search")?.value || "").trim().toLowerCase();
  const activeFilter = document.querySelector("[data-chapter-filter].active")?.dataset.chapterFilter || "all";
  const cards = [...document.querySelectorAll(".chapter-card")];
  let visible = 0;
  cards.forEach(card => {
    const available = card.classList.contains("available");
    const matchesSearch = (card.dataset.search || "").includes(search);
    const matchesFilter = activeFilter === "all" || card.dataset.state === activeFilter;
    const matches = available ? matchesSearch && matchesFilter : !search && activeFilter === "all";
    card.hidden = !matches;
    if (matches) visible++;
  });
  const grid = document.querySelector("#chapter-grid");
  let empty = grid.querySelector(".empty-state");
  if (!visible && !empty) grid.insertAdjacentHTML("beforeend", `<div class="empty-state">No chapters match this search and filter.</div>`);
  if (visible && empty) empty.remove();
}

function setAccountNotice(message, kind = "") {
  accountNotice = message;
  const notice = document.querySelector("#account-notice");
  if (notice) {
    notice.textContent = message;
    notice.className = `account-notice ${kind}`;
  }
}

function bindAccountForms() {
  document.querySelector("#signup-form")?.addEventListener("submit", signUp);
  document.querySelector("#login-form")?.addEventListener("submit", signIn);
  document.querySelector("#forgot-password")?.addEventListener("click", requestPasswordReset);
  document.querySelector("#recovery-form")?.addEventListener("submit", saveNewPassword);
  document.querySelector("#display-name-form")?.addEventListener("submit", updateDisplayName);
  document.querySelector("#show-email")?.addEventListener("change", updateEmailVisibility);
  document.querySelector("#sign-out")?.addEventListener("click", signOut);
  document.querySelector("#load-leaderboard")?.addEventListener("click", loadLeaderboard);
  bindStudentNotes();
}

async function signUp(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const displayName = String(form.get("displayName")).trim();
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  setAccountNotice("Creating your account…");
  const { data, error } = await backendClient.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } }
  });
  if (error) {
    setAccountNotice(error.message, "error");
    return;
  }
  if (!data.session) {
    setAccountNotice("Account created. Check your email to confirm it, then sign in.", "success");
    return;
  }
  currentSession = data.session;
  await loadAccountData(data.session.user);
  await loadAdminState();
  await loadChapterCatalog();
  await syncRoster();
  render();
}

async function signIn(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setAccountNotice("Signing in…");
  const { data, error } = await backendClient.auth.signInWithPassword({
    email: String(form.get("email")).trim().toLowerCase(),
    password: String(form.get("password"))
  });
  if (error) {
    setAccountNotice(error.message, "error");
    return;
  }
  currentSession = data.session;
  await loadAccountData(data.user);
  await loadAdminState();
  await loadChapterCatalog();
  await syncRoster();
  render();
}

async function requestPasswordReset() {
  const email = String(document.querySelector("#login-email")?.value || "").trim().toLowerCase();
  if (!email) {
    setAccountNotice("Enter your email in the Sign in form, then select “Forgot your password?”.", "error");
    document.querySelector("#login-email")?.focus();
    return;
  }
  setAccountNotice("Sending the reset link…");
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await backendClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    setAccountNotice(error.message, "error");
    return;
  }
  // The same message is shown whether or not the email has an account.
  setAccountNotice("If an account exists for that email, a password reset link has been sent. Open it on this device and choose a new password.", "success");
}

async function saveNewPassword(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const password = String(form.get("password"));
  if (password !== String(form.get("confirm"))) {
    setAccountNotice("The two passwords do not match.", "error");
    return;
  }
  setAccountNotice("Saving your new password…");
  const { error } = await backendClient.auth.updateUser({ password });
  if (error) {
    setAccountNotice(error.message, "error");
    return;
  }
  passwordRecoveryMode = false;
  accountNotice = "Your password was updated. You are signed in.";
  render();
}

async function signOut() {
  const { error } = await backendClient.auth.signOut();
  if (error) setAccountNotice(error.message, "error");
  else {
    currentSession = null;
    currentProfile = null;
    currentIsAdmin = false;
    currentIsOwner = false;
    adminUsers = [];
    adminNotice = "";
    chapterProgress.clear();
    sharedProfiles = [];
    accountNotice = "";
    render();
  }
}

async function loadAccountData(user) {
  let { data: existingProfile, error: profileError } = await backendClient
    .from("profiles")
    .select(profileColumns())
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError && emailFeature && /show_email/i.test(`${profileError.message} ${profileError.details || ""}`)) {
    // The email-visibility column has not been added to the database yet.
    emailFeature = false;
    ({ data: existingProfile, error: profileError } = await backendClient
      .from("profiles")
      .select(profileColumns())
      .eq("user_id", user.id)
      .maybeSingle());
  }
  if (profileError) {
    accountNotice = "Profile setup failed. The site owner may need to run the account database setup.";
    return;
  }

  const displayName = existingProfile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "ADS1 student";
  const { data: profile, error: saveProfileError } = await backendClient
    .from("profiles")
    .upsert({
      user_id: user.id,
      display_name: displayName
    }, { onConflict: "user_id" })
    .select(profileColumns())
    .single();
  if (saveProfileError) {
    accountNotice = "Profile setup failed. The site owner may need to run the account database setup.";
    return;
  }

  const { data: rows, error: progressError } = await backendClient
    .from("lesson_progress")
    .select("chapter_id, completed")
    .eq("user_id", user.id);
  if (progressError) {
    accountNotice = "Progress setup failed. The site owner may need to run the account database setup.";
    return;
  }

  chapterProgress = new Set(rows.filter(row => row.completed).map(row => String(row.chapter_id)));
  await loadStudentNotes(user.id);
  if (window.ADS1ArenaUI) await window.ADS1ArenaUI.load();
  const percent = computeProgressPercent();
  currentProfile = { ...profile, progress_percent: percent };
}

async function syncRoster() {
  if (!backendClient || !currentSession) return;
  const { error } = await backendClient.functions.invoke("sync-roster", { body: {} });
  if (error) {
    accountNotice = "Your account works, but the owner’s private Google Sheet sync is not configured yet.";
  } else {
    accountNotice = "Your account and private roster entry are up to date.";
  }
}

async function updateDisplayName(event) {
  event.preventDefault();
  const displayName = String(new FormData(event.currentTarget).get("displayName")).trim();
  const { data, error } = await backendClient
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", currentSession.user.id)
    .select(profileColumns())
    .single();
  if (error) {
    setAccountNotice(error.message, "error");
    return;
  }
  currentProfile = data;
  await syncRoster();
  render();
}

async function updateEmailVisibility(event) {
  const checkbox = event.currentTarget;
  const show = checkbox.checked;
  checkbox.disabled = true;
  const { data, error } = await backendClient
    .from("profiles")
    .update({ show_email: show })
    .eq("user_id", currentSession.user.id)
    .select(profileColumns())
    .single();
  if (error) {
    checkbox.checked = !show;
    checkbox.disabled = false;
    setAccountNotice("Could not change your email visibility. Please try again.", "error");
    return;
  }
  currentProfile = data;
  sharedProfiles = [];
  accountNotice = show ? "Your email is now visible on the progress board." : "Your email is now hidden.";
  render();
}

async function loadLeaderboard() {
  const button = document.querySelector("#load-leaderboard");
  if (button) button.disabled = true;
  let { data, error } = await backendClient.rpc("get_progress_board_v2");
  if (error) {
    // The newer board (with XP and optional emails) is not installed yet: use the original one.
    ({ data, error } = await backendClient.rpc("get_progress_board"));
  }
  if (error) {
    setAccountNotice("Could not load the shared progress board.", "error");
    if (button) button.disabled = false;
    return;
  }
  sharedProfiles = data || [];
  render();
}

async function initializeAccounts() {
  if (!backendClient) {
    return;
  }
  const { data, error } = await backendClient.auth.getSession();
  if (!error && data.session) {
    currentSession = data.session;
    await loadAccountData(data.session.user);
    await loadAdminState();
    await loadChapterCatalog();
  }
  backendClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      passwordRecoveryMode = true;
      accountNotice = "";
      if (window.location.hash !== "#account") window.location.hash = "#account";
    } else if (event === "SIGNED_OUT") {
      passwordRecoveryMode = false;
    }
    window.setTimeout(async () => {
      currentSession = session;
      if (session?.user) {
        await loadAccountData(session.user);
        await loadAdminState();
        await loadChapterCatalog();
        await syncRoster();
      } else {
        currentProfile = null;
        studentNotes = [];
        studentNotesReady = false;
        studentNotesNotice = "";
        editingNoteId = null;
        currentIsAdmin = false;
        currentIsOwner = false;
        adminUsers = [];
        chapterProgress.clear();
        sharedProfiles = [];
        if (window.ADS1ArenaUI) await window.ADS1ArenaUI.load();
        await loadChapterCatalog();
      }
      updateAssistantStatus();
      render();
    }, 0);
  });
}

async function markComplete(event) {
  const button = event.currentTarget;
  const chapterId = button.dataset.chapter;
  button.disabled = true;
  if (currentSession) {
    const { error } = await backendClient.from("lesson_progress").upsert({
      user_id: currentSession.user.id,
      chapter_id: chapterId,
      completed: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,chapter_id" });
    if (error) {
      button.disabled = false;
      setAccountNotice("Could not save progress to your account. Please try again.", "error");
      return;
    }
    chapterProgress.add(chapterId);
    if (currentProfile) currentProfile.progress_percent = computeProgressPercent();
  } else {
    localStorage.setItem(`ads1.chapter${chapterId}.completed`, "true");
  }
  button.classList.add("completion-celebration");
  button.innerHTML = '<span class="completion-check" aria-hidden="true">✓</span> Completed';
}

async function loadChapterCatalog() {
  let catalog = bundledChapters;
  try {
    const response = await fetch("./chapters.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Catalog request failed");
    const staticCatalog = await response.json();
    if (Array.isArray(staticCatalog) && staticCatalog.length) catalog = staticCatalog;
  } catch {
    catalog = bundledChapters;
  }

  let removedIds = new Set();
  if (backendClient) {
    const { data: removedRows, error: removedError } = await backendClient.from("removed_chapters")
      .select("chapter_id");
    removedIds = !removedError && Array.isArray(removedRows)
      ? new Set(removedRows.map(row => String(row.chapter_id)))
      : new Set();
    const { data, error } = await backendClient.from("chapter_catalog")
      .select("id, number, title, description, file_path, section_count, available")
      .order("number");
    if (!error && Array.isArray(data)) {
      const remoteChapters = data.map(chapter => ({
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        description: chapter.description,
        sectionCount: chapter.section_count,
        file: backendClient.storage.from("course-chapters").getPublicUrl(chapter.file_path).data.publicUrl,
        remote: true,
        available: chapter.available
      }));
      const remoteIds = new Set(remoteChapters.map(chapter => chapter.id));
      catalog = [...catalog.filter(chapter => !remoteIds.has(chapter.id)), ...remoteChapters];
      adminChapters = catalog.map(chapter => ({ ...chapter, available: chapter.remote ? chapter.available : !removedIds.has(String(chapter.id)) }));
      catalog = adminChapters.filter(chapter => chapter.available);
    } else {
      adminChapters = catalog.map(chapter => ({ ...chapter, available: !removedIds.has(String(chapter.id)) }));
      catalog = adminChapters.filter(chapter => chapter.available);
    }
  } else {
    adminChapters = catalog.map(chapter => ({ ...chapter }));
  }

  chapters = catalog;
  render();
}
menuToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

async function startApplication() {
  if (window.ADS1ArenaUI) await window.ADS1ArenaUI.load();
  await loadChapterCatalog();
  await initializeAccounts();
  render();
}

window.addEventListener("hashchange", render);
initializeTheme();
render();
startApplication();

