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
  const bridge = "<style id=\"ads1-theme-bridge-style\">html{color-scheme:light}html[data-ads1-theme=\"dark\"]{color-scheme:dark;background:#091321;color:#e7effb}</style><script>(() => {\n  const original = new WeakMap();\n  const properties = [\"background-color\", \"color\", \"border-top-color\", \"border-right-color\", \"border-bottom-color\", \"border-left-color\"];\n  function save(el) {\n    if (!original.has(el)) {\n      const values = {};\n      for (const property of properties) values[property] = [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)];\n      original.set(el, values);\n    }\n  }\n  function restore(el) {\n    const values = original.get(el);\n    if (!values) return;\n    for (const property of properties) {\n      const [value, priority] = values[property];\n      if (value) el.style.setProperty(property, value, priority);\n      else el.style.removeProperty(property);\n    }\n  }\n  function rgba(value) {\n    const values = String(value).match(/[\d.]+/g);\n    if (!values || values.length < 3) return null;\n    return { r: +values[0], g: +values[1], b: +values[2], a: values.length > 3 ? +values[3] : 1 };\n  }\n  function luminance(color) {\n    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;\n  }\n  function nearestBackground(el) {\n    for (let node = el; node; node = node.parentElement) {\n      const color = rgba(getComputedStyle(node).backgroundColor);\n      if (color && color.a > 0.35) return color;\n    }\n    return { r: 9, g: 19, b: 33, a: 1 };\n  }\n  function apply(theme) {\n    const dark = theme === \"dark\";\n    const root = document.documentElement;\n    root.dataset.ads1Theme = dark ? \"dark\" : \"light\";\n    root.style.colorScheme = dark ? \"dark\" : \"light\";\n    const nodes = [root, ...document.querySelectorAll(\"body *\")];\n    for (const el of nodes) {\n      save(el);\n      restore(el);\n      if (!dark) continue;\n      const background = rgba(getComputedStyle(el).backgroundColor);\n      if (background && background.a > 0.35 && luminance(background) > 0.78) {\n        el.style.setProperty(\"background-color\", el === root || el === document.body ? \"#091321\" : \"#101e30\", \"important\");\n      }\n    }\n    if (!dark) return;\n    for (const el of nodes) {\n      const background = nearestBackground(el);\n      const text = rgba(getComputedStyle(el).color);\n      if (text && luminance(background) < 0.3 && luminance(text) < 0.45) {\n        el.style.setProperty(\"color\", el.tagName === \"A\" ? \"#83c4ff\" : \"#e7effb\", \"important\");\n      }\n      for (const side of [\"top\", \"right\", \"bottom\", \"left\"]) {\n        const property = \"border-\" + side + \"-color\";\n        const border = rgba(getComputedStyle(el).getPropertyValue(property));\n        if (border && border.a > 0.35 && luminance(border) > 0.72) el.style.setProperty(property, \"#33475f\", \"important\");\n      }\n    }\n  }\n  window.addEventListener(\"message\", event => {\n    if (event.source !== parent || !event.data || event.data.type !== \"ADS1_THEME\") return;\n    apply(event.data.theme);\n  });\n})();</script>";
  const headEnd = source.search(/<\/head\s*>/i);
  if (headEnd >= 0) return source.slice(0, headEnd) + bridge + source.slice(headEnd);
  const bodyStart = source.match(/<body\b[^>]*>/i);
  if (bodyStart) {
    const index = source.indexOf(bodyStart[0]) + bodyStart[0].length;
    return source.slice(0, index) + bridge + source.slice(index);
  }
  return bridge + source;
}

const lessonFrameOriginalStyles = new WeakMap();
const lessonFrameObservers = new WeakMap();
const lessonFrameStyleProperties = ["background-color", "color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"];

function applySameOriginLessonTheme(doc, theme) {
  const dark = theme === "dark";
  const root = doc.documentElement;
  if (!root) return false;
  root.style.colorScheme = dark ? "dark" : "light";
  const nodes = [root, ...(doc.body ? [doc.body, ...doc.body.querySelectorAll("*")] : [])];
  function remember(el) {
    if (lessonFrameOriginalStyles.has(el)) return;
    const values = {};
    for (const property of lessonFrameStyleProperties) values[property] = [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)];
    lessonFrameOriginalStyles.set(el, values);
  }
  function restore(el) {
    const values = lessonFrameOriginalStyles.get(el);
    if (!values) return;
    for (const property of lessonFrameStyleProperties) {
      const [value, priority] = values[property];
      if (value) el.style.setProperty(property, value, priority);
      else el.style.removeProperty(property);
    }
  }
  function rgba(value) {
    const values = String(value).match(/[\\d.]+/g);
    if (!values || values.length < 3) return null;
    return { r: +values[0], g: +values[1], b: +values[2], a: values.length > 3 ? +values[3] : 1 };
  }
  function luminance(color) { return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255; }
  function nearestBackground(el) {
    for (let node = el; node; node = node.parentElement) {
      const color = rgba(doc.defaultView.getComputedStyle(node).backgroundColor);
      if (color && color.a > 0.35) return color;
    }
    return { r: 9, g: 19, b: 33, a: 1 };
  }
  for (const el of nodes) {
    remember(el);
    restore(el);
    if (!dark) continue;
    const background = rgba(doc.defaultView.getComputedStyle(el).backgroundColor);
    if (background && background.a > 0.35 && luminance(background) > 0.78) {
      el.style.setProperty("background-color", el === root || el === doc.body ? "#091321" : "#101e30", "important");
    }
  }
  if (dark) {
    for (const el of nodes) {
      const background = nearestBackground(el);
      const text = rgba(doc.defaultView.getComputedStyle(el).color);
      if (text && luminance(background) < 0.3 && luminance(text) < 0.45) {
        el.style.setProperty("color", el.tagName === "A" ? "#83c4ff" : "#e7effb", "important");
      }
      for (const side of ["top", "right", "bottom", "left"]) {
        const property = "border-" + side + "-color";
        const border = rgba(doc.defaultView.getComputedStyle(el).getPropertyValue(property));
        if (border && border.a > 0.35 && luminance(border) > 0.72) el.style.setProperty(property, "#33475f", "important");
      }
    }
  }
  let observer = lessonFrameObservers.get(doc);
  if (!observer && doc.body) {
    observer = new MutationObserver(() => applySameOriginLessonTheme(doc, document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
    observer.observe(doc.body, { childList: true, subtree: true });
    lessonFrameObservers.set(doc, observer);
  }
  return true;
}

function syncLessonFrameTheme(frame) {
  if (!frame?.contentWindow) return;
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  try {
    if (frame.contentDocument && applySameOriginLessonTheme(frame.contentDocument, theme)) return;
  } catch {}
  frame.contentWindow.postMessage({ type: "ADS1_THEME", theme }, "*");
}

function bindLessonFrameTheme(frame) {
  if (!frame || frame.dataset.themeSyncBound) return;
  frame.dataset.themeSyncBound = "true";
  frame.addEventListener("load", () => syncLessonFrameTheme(frame));
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

function chapterCard(chapter) {
  const status = chapter.available ? "Available" : "Waiting for upload";
  const action = "Open chapter <span aria-hidden=\"true\">→</span>";
  const description = chapter.description || "Course lesson supplied by the course team.";
  return `<article class="chapter-card ${chapter.available ? "available" : "unavailable"}" data-search="${escapeHTML(chapter.title.toLowerCase())}">
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
  const arenaUI = window.ADS1ArenaUI;
  return `<section class="hero"><div class="container hero-grid fade-in">
    <div class="hero-content">
      <span class="eyebrow">ADS1 · University of Ouargla</span>
      <h1>Learn algorithms.<br><em>One step at a time.</em></h1>
      <p>Study your ADS1 lessons, explore worked examples, practise algorithm tracing, and test your understanding through interactive activities.</p>
      <div class="hero-actions">
        <a class="button" href="#chapters">Explore chapters <span class="arrow" aria-hidden="true">→</span></a>
        ${arenaUI ? `<a class="button secondary" href="#arena">Enter the Arena <span class="arrow" aria-hidden="true">→</span></a>` : ""}
      </div>
    </div>
    ${arenaUI ? arenaUI.heroDemo() : ""}
  </div></section>
  ${arenaUI ? arenaUI.homeStrip() : ""}
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
  const percent = computeProgressPercent();
  if (Number(currentProfile.progress_percent) === percent) return;
  const { error } = await backendClient.from("profiles")
    .update({ progress_percent: percent })
    .eq("user_id", currentSession.user.id);
  if (!error) currentProfile.progress_percent = percent;
}

function profileColumns() {
  return emailFeature ? "display_name, progress_percent, show_email" : "display_name, progress_percent";
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
    const total = chapters.filter(chapter => chapter.available).length;
    const percent = Number(currentProfile.progress_percent) || 0;
    const arenaSummary = window.ADS1ArenaUI ? window.ADS1ArenaUI.summaryHTML() : "";
    const lessonRows = chapters.filter(chapter => chapter.available).map(chapter => {
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
        <div class="account-lesson-list">${lessonRows}</div>
        ${arenaSummary}
      </section>
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
  const view = page === "chapters" ? home() : page === "chapter" ? chapterPage(query) : page === "lesson" ? lessonPage(query) : page === "account" ? accountPage() : page === "about" ? aboutPage() : page === "arena" && arenaUI ? arenaUI.view() : home();
  app.innerHTML = view;
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === page || (page === "chapter" && link.dataset.nav === "chapters")));
  if (page === "arena" && arenaUI) arenaUI.bind();
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (page === "lesson") document.querySelector("#mark-complete").addEventListener("click", markComplete);
  if (page === "account" && backendClient) bindAccountForms();
  if (page === "account" && currentIsAdmin) bindAdminForms();
  if (page === "home" || page === "chapters") document.querySelector("#chapter-search").addEventListener("input", filterChapters);
  if ((page === "home" || page === "chapters") && arenaUI) arenaUI.bindHome();
  if (page === "lesson") loadRemoteLesson();
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
      display_name: displayName,
      progress_percent: existingProfile?.progress_percent || 0
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
  if (window.ADS1ArenaUI) await window.ADS1ArenaUI.load();
  const percent = computeProgressPercent();
  currentProfile = { ...profile, progress_percent: percent };
  if (Number(profile.progress_percent) !== percent) {
    const { error: percentError } = await backendClient
      .from("profiles")
      .update({ progress_percent: percent })
      .eq("user_id", user.id);
    if (percentError) accountNotice = "Progress loaded, but its public percentage could not be updated.";
  }
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
    const percent = computeProgressPercent();
    const { error: percentError } = await backendClient.from("profiles")
      .update({ progress_percent: percent })
      .eq("user_id", currentSession.user.id);
    if (percentError) {
      button.disabled = false;
      setAccountNotice("Progress was saved, but the shared percentage could not be updated.", "error");
      return;
    }
    if (currentProfile) currentProfile.progress_percent = percent;
  } else {
    localStorage.setItem(`ads1.chapter${chapterId}.completed`, "true");
  }
  button.textContent = "Completed";
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

