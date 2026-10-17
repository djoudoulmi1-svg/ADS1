/* Algo Arena: the practice section of the ADS1 Learning Hub (browser UI).
 *
 * Needs arena-core.js (loaded first). When its functions run it also uses these
 * globals from app.js: backendClient, currentSession, escapeHTML, crumbs and
 * syncProgressPercent. app.js talks to this file only through window.ADS1ArenaUI. */
(function () {
  "use strict";
  const A = window.ADS1Arena;
  if (!A) return;

  const WEIGHT_PERCENT = 30; // share of the course progress given by Arena levels
  const LOCAL_KEY = "ads1.arena.v1";
  const DAILY_KEY = "ads1.daily.v1";
  const esc = value => escapeHTML(value);

  /* ------------------------------ persistence ------------------------------ */
  const progressState = { map: {}, dbOk: true };

  const signedIn = () => Boolean(backendClient && currentSession);
  const localKey = () => (signedIn() ? `${LOCAL_KEY}.${currentSession.user.id}` : LOCAL_KEY);

  function readLocal() {
    const clean = {};
    try {
      const raw = JSON.parse(localStorage.getItem(localKey()) || "{}") || {};
      A.TRACK_ORDER.forEach(trackId => A.TRACKS[trackId].levels.forEach(level => {
        const rec = raw[A.levelId(trackId, level.n)];
        if (rec && typeof rec === "object") {
          const done = rec.done === true;
          clean[A.levelId(trackId, level.n)] = { best: Math.max(0, Math.min(100, Number(rec.best) || 0)), done, points: done ? A.LEVEL_XP : 0 };
        }
      }));
    } catch { /* storage unavailable or corrupted: start empty */ }
    return clean;
  }
  function writeLocal() {
    try { localStorage.setItem(localKey(), JSON.stringify(progressState.map)); } catch { /* ignore */ }
  }

  /** Loads the signed-in student's results, or this browser's results when signed out. */
  async function load() {
    progressState.dbOk = true;
    if (signedIn()) {
      const { data, error } = await backendClient.from("arena_progress")
        .select("level_id, best_score, completed, points")
        .eq("user_id", currentSession.user.id);
      if (!error && Array.isArray(data)) {
        progressState.map = {};
        data.forEach(row => {
          progressState.map[row.level_id] = { best: row.best_score, done: row.completed, points: row.completed ? A.LEVEL_XP : 0 };
        });
        return;
      }
      progressState.dbOk = false; // table missing or unreachable: keep results in this browser
    }
    progressState.map = readLocal();
  }

  async function save(levelId, score, passed) {
    const prev = progressState.map[levelId] || { best: 0, done: false, points: 0 };
    const done = prev.done || passed;
    progressState.map[levelId] = { best: Math.max(prev.best, score), done, points: done ? A.LEVEL_XP : 0 };
    if (signedIn() && progressState.dbOk) {
      const next = progressState.map[levelId];
      const { error } = await backendClient.from("arena_progress").upsert({
        user_id: currentSession.user.id,
        level_id: levelId,
        best_score: next.best,
        completed: next.done,
        points: next.points,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,level_id" });
      if (error) progressState.dbOk = false;
    }
    if (!signedIn() || !progressState.dbOk) writeLocal();
    if (signedIn()) await syncProgressPercent();
    return { justCompleted: passed && !prev.done };
  }

  const levelRecord = (trackId, n) => progressState.map[A.levelId(trackId, n)];
  const completedCount = () => Object.values(progressState.map).filter(rec => rec.done).length;
  const totalXP = () => Object.values(progressState.map).reduce((sum, rec) => sum + (rec.done ? rec.points : 0), 0);
  const isUnlocked = (trackId, n) => n === 1 || Boolean(levelRecord(trackId, n - 1)?.done);
  const levelStatus = (trackId, n) => (levelRecord(trackId, n)?.done ? "done" : isUnlocked(trackId, n) ? "open" : "locked");

  async function finishLevel(trackId, n, score, passed) {
    const xpBefore = totalXP();
    const before = A.rankFor(xpBefore);
    const { justCompleted } = await save(A.levelId(trackId, n), score, passed);
    const xpAfter = totalXP();
    const after = A.rankFor(xpAfter);
    return { justCompleted, rankUp: after.index > before.index ? after.name : null, xpBefore, xpAfter };
  }

  /* ------------------------------ rank emblems and celebration ------------------------------ */
  const RANK_TIERS = ["#64748b", "#b45309", "#0f766e", "#1d4ed8", "#7e22ce", "#b7791f"];

  /** A hexagon badge: its colour and the number of dots under the star grow with the rank. */
  function rankEmblem(index, size = 56) {
    const color = RANK_TIERS[Math.min(index, RANK_TIERS.length - 1)];
    const pips = Array.from({ length: index + 1 }, (_, i) => `<circle cx="${(32 + (i - index / 2) * 6).toFixed(1)}" cy="50" r="2" fill="#fff"/>`).join("");
    return `<svg class="emblem" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false"><polygon points="32,3 58,17.5 58,46.5 32,61 6,46.5 6,17.5" fill="${color}"/><polygon points="32,9 53,21 53,43 32,55 11,43 11,21" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/><polygon points="32,15 35.5,25 46,25 37.5,31.5 40.7,41.5 32,35.5 23.3,41.5 26.5,31.5 18,25 28.5,25" fill="#fff"/>${pips}</svg>`;
  }

  /** Falling confetti made only of CSS: the pieces are fixed, so no randomness is needed. */
  function confettiHTML() {
    const colors = ["var(--accent, #13805f)", "#f5b82e", "#20b8e6", "#e5484d", "#13805f"];
    const pieces = Array.from({ length: 22 }, (_, i) => {
      const x = 6 + (i * 37) % 88;
      const drift = ((i * 53) % 41) - 20;
      const delay = ((i % 7) * 0.06).toFixed(2);
      const spin = 120 + (i * 47) % 300;
      const size = 6 + (i % 3) * 2;
      return `<i style="--x:${x}%;--dx:${drift}px;--delay:${delay}s;--rot:${spin}deg;--s:${size}px;--c:${colors[i % colors.length]}"></i>`;
    }).join("");
    return `<span class="confetti" aria-hidden="true">${pieces}</span>`;
  }

  const rankPercent = (xp, rank) => (rank.next ? Math.round((xp - A.RANKS[rank.index].xp) / (rank.next.xp - A.RANKS[rank.index].xp) * 100) : 100);

  function bannerHTML(trackId, n, passed, info, failText) {
    if (!passed) return `<div class="result-banner fail" role="status"><strong>Not cleared yet.</strong> ${esc(failText)}</div>`;
    const hasNext = Boolean(A.TRACKS[trackId].levels[n]);
    const link = hasNext ? `<a href="#arena/${trackId}/${n + 1}">Next level <span aria-hidden="true">→</span></a>` : `<a href="#arena/${trackId}">Back to the track <span aria-hidden="true">→</span></a>`;
    if (!info.justCompleted) return `<div class="result-banner win" role="status"><strong>Level cleared!</strong> You had already cleared this level. ${link}</div>`;

    const before = A.rankFor(info.xpBefore);
    const after = A.rankFor(info.xpAfter);
    const from = rankPercent(info.xpBefore, before);
    const to = info.rankUp ? 100 : rankPercent(info.xpAfter, after);
    const progressText = after.next ? `${info.xpAfter} XP · ${after.toNext} XP to ${after.next.name}` : `${info.xpAfter} XP · top rank reached`;
    const label = info.rankUp ? `Rank ${before.name} completed` : progressText;
    const rankUp = info.rankUp
      ? `<div class="rank-up">${rankEmblem(after.index, 64)}<div><small>New rank</small><strong>${esc(info.rankUp)}</strong><small>${esc(progressText)}</small></div></div>`
      : "";
    return `<div class="result-banner win celebrate" role="status">${confettiHTML()}
      <div class="win-head"><strong>Level cleared!</strong><span class="xp-gain">+${A.LEVEL_XP} XP</span></div>
      <div class="xp-meter" role="img" aria-label="${esc(label)}" style="--from:${from}%;--to:${to}%"><span class="xp-fill"></span></div>
      <small class="xp-caption">${esc(label)}</small>
      ${rankUp}
      <div class="win-next">${link}</div>
    </div>`;
  }

  /* ------------------------------ routing ------------------------------ */
  const hashParts = () => location.hash.slice(1).split("/");

  function current() {
    const [, trackId, levelText] = hashParts();
    const track = A.TRACKS[trackId];
    if (!track) return { kind: "overview" };
    const n = Number(levelText);
    if (!levelText) return { kind: "track", track };
    if (!Number.isInteger(n) || !track.levels[n - 1]) return { kind: "track", track };
    if (!isUnlocked(track.id, n)) return { kind: "track", track, message: "Clear the previous level first to unlock that one." };
    return { kind: "level", track, n };
  }

  function view() {
    const where = current();
    if (where.kind === "overview") return overviewPage();
    if (where.kind === "track") return trackPage(where.track, where.message);
    if (where.track.id === "trace") return tracePage(where.n);
    if (where.track.id === "exam") return examPage(where.n);
    return clabPage(where.n);
  }

  function bind() {
    const root = document.querySelector("#app .arena-shell");
    if (!root) return;
    const where = current();
    if (where.kind === "track" && where.track.id === "clab") bindPlayground(root);
    if (where.kind !== "level") return;
    if (where.track.id === "trace") bindTrace(root, where.n);
    else if (where.track.id === "exam") bindExam(root, where.n);
    else bindClab(root, where.n);
  }

  /* ------------------------------ overview and track pages ------------------------------ */
  function rankPanel() {
    const xp = totalXP();
    const rank = A.rankFor(xp);
    const low = A.RANKS[rank.index].xp;
    const percent = rank.next ? Math.round((xp - low) / (rank.next.xp - low) * 100) : 100;
    return `<section class="rank-panel" aria-label="Your rank">
      <div class="rank-badge" aria-hidden="true">${rankEmblem(rank.index, 56)}</div>
      <div class="rank-info"><span>Your rank</span><strong>${esc(rank.name)}</strong><small>${xp} XP · ${completedCount()} of ${A.LEVEL_COUNT} levels cleared</small></div>
      <div class="rank-next"><progress value="${percent}" max="100" aria-label="Progress to the next rank"></progress><small>${rank.next ? `${rank.toNext} XP to ${esc(rank.next.name)}` : "You reached the top rank"}</small></div>
    </section>`;
  }

  function pills(trackId) {
    return `<ol class="level-pills" data-track="${trackId}" aria-label="Levels">${A.TRACKS[trackId].levels.map(level => {
      const status = levelStatus(trackId, level.n);
      const word = status === "done" ? "cleared" : status === "open" ? "open" : "locked";
      return `<li class="pill ${status}" title="Level ${level.n}: ${esc(level.name)}"><span class="sr-only">Level ${level.n}, ${word}</span><span aria-hidden="true">${level.n}</span></li>`;
    }).join("")}</ol>`;
  }

  function trackCard(trackId) {
    const track = A.TRACKS[trackId];
    const cleared = track.levels.filter(level => levelStatus(trackId, level.n) === "done").length;
    return `<article class="track-card" data-track="${trackId}">
      <div class="track-icon" aria-hidden="true">${esc(track.icon)}</div>
      <h3>${esc(track.name)}</h3><p class="track-tagline">${esc(track.tagline)}</p><p>${esc(track.blurb)}</p>
      ${pills(trackId)}
      <a class="card-action" href="#arena/${trackId}">${cleared ? "Continue track" : "Enter track"} <span aria-hidden="true">→</span></a>
    </article>`;
  }

  function savedNote() {
    if (!signedIn()) return "You are not signed in, so your results are saved only in this browser. Sign in from the Account page to keep them with your account.";
    if (!progressState.dbOk) return "Your results are saved in this browser for now; the site owner still has to finish a database update to store them in your account.";
    return "Your results are saved to your account.";
  }

  function overviewPage() {
    return `<section class="container arena-shell fade-in">
      ${crumbs([{ label: "Home", href: "#home" }, { label: "Arena" }])}
      <span class="eyebrow">Practice zone</span><h1>Algo Arena</h1>
      <p class="arena-intro">Three scored tracks with three levels each, plus a debugging lab. Clear a level to earn ${A.LEVEL_XP} XP, climb the ranks and raise your course progress.</p>
      ${rankPanel()}
      <div class="track-grid">${A.TRACK_ORDER.map(trackCard).join("")}</div>
      <article class="track-card debugger-card"><div class="track-icon" aria-hidden="true">⌕</div><span class="track-tagline">NEW PRACTICE</span><h3>Algorithm Bug Lab</h3><p>Find a faulty line, repair the pseudocode, and understand why the fix works.</p><a class="card-action" href="#arena/debug">Start debugging <span aria-hidden="true">→</span></a></article>
      <div class="content-note">Arena levels count for ${WEIGHT_PERCENT}% of your course progress and the lessons count for the other ${100 - WEIGHT_PERCENT}%. ${esc(savedNote())}</div>
    </section>`;
  }

  function trackPage(track, message) {
    const rows = track.levels.map(level => {
      const status = levelStatus(track.id, level.n);
      const rec = levelRecord(track.id, level.n);
      const label = status === "done" ? `Cleared · best ${rec.best}%` : status === "open" ? "Open" : "Locked";
      const action = status === "locked"
        ? `<span class="button secondary locked" aria-disabled="true">Locked</span>`
        : `<a class="button${status === "done" ? " secondary" : ""}" href="#arena/${track.id}/${level.n}">${status === "done" ? "Replay" : "Start"} <span class="arrow" aria-hidden="true">→</span></a>`;
      return `<div class="level-row ${status}"><span class="lesson-index">${level.n}</span><div><h2>${esc(level.name)}</h2><p>${esc(level.desc)}</p></div><span class="level-status ${status}">${label}</span>${action}</div>`;
    }).join("");
    return `<section class="container arena-shell fade-in" data-track="${track.id}">
      ${crumbs([{ label: "Home", href: "#home" }, { label: "Arena", href: "#arena" }, { label: esc(track.name) }])}
      <span class="eyebrow">${esc(track.tagline)}</span><h1>${esc(track.name)}</h1>
      <p class="arena-intro">${esc(track.blurb)}</p>
      ${message ? `<div class="content-note">${esc(message)}</div>` : ""}
      <div class="level-list">${rows}</div>
      ${track.id === "clab" ? playgroundHTML() : ""}
    </section>`;
  }

  function levelHeader(track, level) {
    return `${crumbs([{ label: "Home", href: "#home" }, { label: "Arena", href: "#arena" }, { label: esc(track.name), href: `#arena/${track.id}` }, { label: `Level ${level.n}` }])}
      <span class="eyebrow">Level ${level.n} · ${esc(track.name)}</span><h1>${esc(level.name)}</h1><p class="arena-intro">${esc(level.desc)}</p>`;
  }

  /* ------------------------------ Trace Lab ------------------------------ */
  let trace = null;

  function randomInputs(program) {
    const inputs = {};
    program.inputs.forEach(def => { inputs[def.name] = def.min + Math.floor(Math.random() * (def.max - def.min + 1)); });
    if (program.id === "gcd" && inputs.a === inputs.b) inputs.b = inputs.a > 30 ? inputs.a - 5 : inputs.a + 5;
    return inputs;
  }
  function recomputeTrace() {
    const program = A.TRACE_PROGRAMS[trace.progId];
    const result = A.runTrace(program, trace.inputs);
    trace.frames = result.frames;
    trace.truncated = result.truncated;
    trace.step = 0;
  }
  function ensureTrace(n) {
    if (trace && trace.n === n) return;
    const progId = A.TRACKS.trace.levels[n - 1].programs[0];
    trace = { n, progId, inputs: randomInputs(A.TRACE_PROGRAMS[progId]), challenge: null, answers: [], result: null, info: null };
    recomputeTrace();
  }

  function explorerHTML() {
    const program = A.TRACE_PROGRAMS[trace.progId];
    const frame = trace.frames[trace.step];
    const finished = frame.next === null;
    const lines = program.lines.map((text, i) => `<li class="${frame.next === i ? "current" : frame.executed === i ? "last" : ""}"><code>${esc(text)}</code></li>`).join("");
    const boxes = program.vars.map(name => {
      const prev = trace.frames[Math.max(0, trace.step - 1)].vars[name];
      return `<div class="var-box${trace.step > 0 && frame.vars[name] !== prev ? " changed" : ""}"><span>${esc(name)}</span><strong>${A.fmtNum(frame.vars[name])}</strong></div>`;
    }).join("");
    const head = `<tr><th scope="col">Step</th><th scope="col">Line executed</th>${program.vars.map(name => `<th scope="col">${esc(name)}</th>`).join("")}</tr>`;
    const body = trace.frames.slice(1, trace.step + 1).map((f, k) => {
      const prev = trace.frames[k];
      return `<tr><td>${k + 1}</td><td><code>${esc(program.lines[f.executed].trim())}</code></td>${program.vars.map(name => `<td class="${f.vars[name] !== prev.vars[name] ? "changed" : ""}">${A.fmtNum(f.vars[name])}</td>`).join("")}</tr>`;
    }).join("");
    const inputs = program.inputs.map(def => `<label>${esc(def.name)}<input type="number" step="1" min="${def.min}" max="${def.max}" data-trace-input="${esc(def.name)}" value="${trace.inputs[def.name]}"></label>`).join("");
    const tabs = A.TRACKS.trace.levels[trace.n - 1].programs.map(id => `<button type="button" class="tab${id === trace.progId ? " active" : ""}" data-trace-prog="${id}" aria-pressed="${id === trace.progId}">${esc(A.TRACE_PROGRAMS[id].title)}</button>`).join("");
    return `<div class="tab-row" role="group" aria-label="Choose an algorithm">${tabs}</div>
      <div class="trace-inputs"><span class="inputs-label">Inputs</span>${inputs}<button type="button" class="button secondary" data-trace="random">Random values</button></div>
      <div class="trace-grid">
        <ol class="code-box" aria-label="Pseudocode">${lines}</ol>
        <div class="trace-side">
          <div class="var-boxes" aria-label="Current values of the variables">${boxes}</div>
          <div class="trace-controls">
            <button type="button" class="button" data-trace="step" ${finished ? "disabled" : ""}>Step <span aria-hidden="true">→</span></button>
            <button type="button" class="button secondary" data-trace="run" ${finished ? "disabled" : ""}>Run to the end</button>
            <button type="button" class="button secondary" data-trace="reset" ${trace.step === 0 ? "disabled" : ""}>Reset</button>
          </div>
          <p class="trace-output" aria-live="polite">${finished ? `Output: <strong>${esc(frame.out.join(" | ") || "nothing")}</strong>${trace.truncated ? " (stopped: too many steps)" : ""}` : `Step ${trace.step} of the run. The highlighted line runs next.`}</p>
        </div>
      </div>
      ${trace.step > 0 ? `<div class="table-wrap"><table class="trace-table"><caption>Trace table</caption><thead>${head}</thead><tbody>${body}</tbody></table></div>` : ""}`;
  }

  function challengeHTML() {
    if (!trace.challenge) {
      return `<p>You will get 3 algorithms with random values. Work out the final value of one variable in each, by hand or with the explorer above. Get <strong>2 of 3</strong> right to clear the level.</p>
        <button type="button" class="button" data-trace="challenge">Start the challenge</button>`;
    }
    const items = trace.challenge.map((item, i) => {
      const program = A.TRACE_PROGRAMS[item.programId];
      const res = trace.result?.items[i];
      return `<article class="challenge-item ${res ? (res.ok ? "ok" : "bad") : ""}">
        <h3>${i + 1}. ${esc(program.title)}</h3>
        <pre class="pseudo">${esc(program.lines.join("\n"))}</pre>
        <p>Inputs: <strong>${esc(Object.entries(item.inputs).map(([k, v]) => `${k} = ${v}`).join(", "))}</strong>. What is the final value of <strong>${esc(item.varName)}</strong>?</p>
        <label class="answer-line"><span class="sr-only">Answer ${i + 1}</span><input type="text" inputmode="decimal" autocomplete="off" data-answer="${i}" value="${esc(trace.answers[i] ?? "")}" ${trace.result ? "disabled" : ""} placeholder="Your answer"></label>
        ${res ? `<p class="verdict">${res.ok ? "Correct." : `Not quite. The answer is ${A.fmtNum(item.expected)}.`}</p>` : ""}
      </article>`;
    }).join("");
    const actions = trace.result
      ? `${bannerHTML("trace", trace.n, trace.result.passed, trace.info, `You got ${trace.result.correct} of 3. You need 2 to clear this level.`)}<button type="button" class="button secondary" data-trace="challenge">New challenge</button>`
      : `<button type="button" class="button" data-trace="check">Check my answers</button>`;
    return `${items}<div class="challenge-actions">${actions}</div>`;
  }

  function tracePage(n) {
    ensureTrace(n);
    const track = A.TRACKS.trace;
    return `<section class="container arena-shell fade-in" data-track="trace">
      ${levelHeader(track, track.levels[n - 1])}
      <section class="arena-panel" aria-labelledby="trace-explore"><h2 id="trace-explore"><span class="step-no">1</span>Explore</h2>
        <p class="panel-note">Press Step to run one line at a time and watch the variables change. A variable shows “—” until it receives a value.</p>
        <div id="trace-explorer">${explorerHTML()}</div></section>
      <section class="arena-panel" aria-labelledby="trace-challenge-title"><h2 id="trace-challenge-title"><span class="step-no">2</span>Challenge</h2>
        <div id="trace-challenge">${challengeHTML()}</div></section>
    </section>`;
  }

  function bindTrace(root, n) {
    const refreshExplorer = () => { root.querySelector("#trace-explorer").innerHTML = explorerHTML(); };
    const refreshChallenge = () => { root.querySelector("#trace-challenge").innerHTML = challengeHTML(); };
    root.addEventListener("click", async event => {
      const tab = event.target.closest("[data-trace-prog]");
      if (tab) {
        trace.progId = tab.dataset.traceProg;
        trace.inputs = randomInputs(A.TRACE_PROGRAMS[trace.progId]);
        recomputeTrace();
        refreshExplorer();
        return;
      }
      const button = event.target.closest("[data-trace]");
      if (!button || button.disabled) return;
      const action = button.dataset.trace;
      if (action === "step") {
        if (trace.frames[trace.step].next !== null && trace.step < trace.frames.length - 1) trace.step++;
        refreshExplorer();
      } else if (action === "run") {
        trace.step = trace.frames.length - 1;
        refreshExplorer();
      } else if (action === "reset") {
        trace.step = 0;
        refreshExplorer();
      } else if (action === "random") {
        trace.inputs = randomInputs(A.TRACE_PROGRAMS[trace.progId]);
        recomputeTrace();
        refreshExplorer();
      } else if (action === "challenge") {
        trace.challenge = A.makeTraceChallenge(n);
        trace.answers = [];
        trace.result = null;
        trace.info = null;
        refreshChallenge();
      } else if (action === "check") {
        button.disabled = true;
        const items = trace.challenge.map((item, i) => ({ ok: A.gradeNumber(trace.answers[i], item.expected) }));
        const correct = items.filter(item => item.ok).length;
        const passed = correct >= 2;
        trace.result = { items, correct, passed };
        trace.info = await finishLevel("trace", n, Math.round(correct / 3 * 100), passed);
        refreshChallenge();
      }
    });
    root.addEventListener("change", event => {
      const field = event.target.closest("[data-trace-input]");
      if (!field) return;
      const program = A.TRACE_PROGRAMS[trace.progId];
      const def = program.inputs.find(item => item.name === field.dataset.traceInput);
      const value = Math.round(Number(field.value));
      trace.inputs[def.name] = Number.isFinite(value) ? Math.min(def.max, Math.max(def.min, value)) : def.min;
      recomputeTrace();
      refreshExplorer();
    });
    root.addEventListener("input", event => {
      const field = event.target.closest("[data-answer]");
      if (field && trace) trace.answers[Number(field.dataset.answer)] = field.value;
    });
  }

  /* ------------------------------ Exam Bank ------------------------------ */
  let exam = null;

  function examBodyHTML() {
    const n = exam.n;
    if (!exam.questions) {
      return `<p>Each attempt has <strong>8 random questions</strong> from this level's bank. Score <strong>${A.EXAM_PASS_PERCENT}% or more</strong> to clear it. You can retry as often as you like; a new attempt mixes the questions and the answers.</p>
        ${levelRecord("exam", n) ? `<p class="panel-note">Your best score so far: <strong>${levelRecord("exam", n).best}%</strong>.</p>` : ""}
        <button type="button" class="button" data-exam="start">Start an attempt</button>`;
    }
    const letters = "ABCD";
    const questions = exam.questions.map((q, i) => {
      const options = q.options.map((text, j) => {
        const picked = exam.answers[i] === j;
        let cls = "";
        if (exam.result) cls = j === q.correct ? "right" : picked ? "wrong" : "";
        return `<label class="option ${cls}"><input type="radio" name="q${i}" value="${j}" ${picked ? "checked" : ""} ${exam.result ? "disabled" : ""}><span class="letter" aria-hidden="true">${letters[j]}</span><span>${esc(text)}</span></label>`;
      }).join("");
      const review = exam.result ? `<p class="verdict ${exam.answers[i] === q.correct ? "ok" : "bad"}">${exam.answers[i] === q.correct ? "Correct." : exam.answers[i] === undefined ? "Not answered." : "Not quite."} ${esc(q.why)}</p>` : "";
      return `<fieldset class="question"><legend><span class="q-no">${i + 1}</span>${esc(q.q)}</legend>${options}${review}</fieldset>`;
    }).join("");
    if (exam.result) {
      const { correct, total, percent } = exam.result.grade;
      return `${bannerHTML("exam", n, exam.result.passed, exam.info, `You scored ${percent}%. You need ${A.EXAM_PASS_PERCENT}% to clear this level.`)}
        <p class="score-line">Score: <strong>${correct} / ${total}</strong> (${percent}%)</p>${questions}
        <div class="challenge-actions"><button type="button" class="button secondary" data-exam="start">New attempt</button></div>`;
    }
    return `${questions}<div class="challenge-actions"><button type="button" class="button" data-exam="submit">Submit my answers</button><span class="panel-note">Unanswered questions count as wrong.</span></div>`;
  }

  function examPage(n) {
    if (!exam || exam.n !== n) exam = { n, questions: null, answers: [], result: null, info: null };
    const track = A.TRACKS.exam;
    return `<section class="container arena-shell fade-in" data-track="exam">
      ${levelHeader(track, track.levels[n - 1])}
      <section class="arena-panel" aria-label="Exam attempt"><div id="exam-body">${examBodyHTML()}</div></section>
    </section>`;
  }

  function bindExam(root, n) {
    const refresh = () => { root.querySelector("#exam-body").innerHTML = examBodyHTML(); };
    root.addEventListener("click", async event => {
      const button = event.target.closest("[data-exam]");
      if (!button || button.disabled) return;
      if (button.dataset.exam === "start") {
        exam = { n, questions: A.makeExamAttempt(n), answers: [], result: null, info: null };
        refresh();
        root.querySelector("#exam-body").scrollIntoView({ block: "start" });
      } else if (button.dataset.exam === "submit") {
        button.disabled = true;
        const grade = A.gradeExam(exam.questions, exam.answers);
        const passed = grade.percent >= A.EXAM_PASS_PERCENT;
        exam.result = { grade, passed };
        exam.info = await finishLevel("exam", n, grade.percent, passed);
        refresh();
        root.querySelector("#exam-body").scrollIntoView({ block: "start" });
      }
    });
    root.addEventListener("change", event => {
      const radio = event.target.closest("input[type=radio][name^=q]");
      if (radio && exam && !exam.result) exam.answers[Number(radio.name.slice(1))] = Number(radio.value);
    });
  }

  /* ------------------------------ C Lab ------------------------------ */
  const clab = { drafts: {} };

  function draftKey(n) { return `ads1.arena.draft.clab-${n}`; }
  function readDraft(n) {
    try { return localStorage.getItem(draftKey(n)); } catch { return null; }
  }
  function writeDraft(n, code) {
    try { localStorage.setItem(draftKey(n), code); } catch { /* ignore */ }
  }

  function editorHTML(prefix, code, input) {
    return `<div class="editor">
      <label for="${prefix}-code">C source code</label>
      <textarea id="${prefix}-code" class="code-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" rows="15">${esc(code)}</textarea>
      <p class="panel-note">Tab inserts spaces. To move focus away from the editor, press Esc and then Tab.</p>
      <label for="${prefix}-input">Program input (what a user would type for scanf)</label>
      <textarea id="${prefix}-input" class="code-input" spellcheck="false" autocapitalize="off" autocomplete="off" rows="3">${esc(input)}</textarea>
    </div>`;
  }

  function bindEditor(root, prefix, onEdit) {
    const code = root.querySelector(`#${prefix}-code`);
    let escaped = false;
    code.addEventListener("keydown", event => {
      if (event.key === "Escape") { escaped = true; return; }
      if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !escaped) {
        event.preventDefault();
        const { selectionStart: start, selectionEnd: end } = code;
        code.value = `${code.value.slice(0, start)}    ${code.value.slice(end)}`;
        code.selectionStart = code.selectionEnd = start + 4;
        if (onEdit) onEdit();
      }
      escaped = false;
    });
    if (onEdit) code.addEventListener("input", onEdit);
    return code;
  }

  function outputHTML(run) {
    const out = run.output ? `<pre class="run-output">${esc(run.output)}</pre>` : `<p class="panel-note">The program printed nothing.</p>`;
    const err = run.error ? `<p class="run-error"><strong>Error:</strong> ${esc(run.error)}</p>` : "";
    return `${out}${err}`;
  }

  function clabPage(n) {
    const track = A.TRACKS.clab;
    const level = A.CLAB_LEVELS[n];
    const code = clab.drafts[n] ?? readDraft(n) ?? level.starter;
    clab.drafts[n] = code;
    const first = level.tests[0];
    return `<section class="container arena-shell fade-in" data-track="clab">
      ${levelHeader(track, track.levels[n - 1])}
      <section class="arena-panel" aria-labelledby="clab-task"><h2 id="clab-task"><span class="step-no">1</span>Your task</h2>
        <p>${esc(level.statement)}</p>
        <p class="panel-note">Example: input <code>${esc(first.input || "(none)")}</code> should print <code>${esc(first.expected).replace(/\n/g, " ⏎ ")}</code>. Your program is checked on ${level.tests.length} test${level.tests.length > 1 ? "s" : ""}.</p>
        <details class="hint"><summary>Need a hint?</summary><p>${esc(level.hint)}</p></details></section>
      <section class="arena-panel" aria-labelledby="clab-edit"><h2 id="clab-edit"><span class="step-no">2</span>Write and test</h2>
        ${editorHTML("clab", code, first.input)}
        <div class="trace-controls"><button type="button" class="button secondary" data-clab="run">Run</button><button type="button" class="button" data-clab="check">Check my solution</button><button type="button" class="button secondary" data-clab="reset">Reset code</button></div>
        <div id="clab-output" aria-live="polite"></div>
        <div id="clab-results" aria-live="polite"></div>
      </section>
    </section>`;
  }

  function bindClab(root, n) {
    const level = A.CLAB_LEVELS[n];
    const codeBox = bindEditor(root, "clab", () => { clab.drafts[n] = codeBox.value; writeDraft(n, codeBox.value); });
    const inputBox = root.querySelector("#clab-input");
    const outputBox = root.querySelector("#clab-output");
    const resultsBox = root.querySelector("#clab-results");
    root.addEventListener("click", async event => {
      const button = event.target.closest("[data-clab]");
      if (!button || button.disabled) return;
      if (button.dataset.clab === "run") {
        resultsBox.innerHTML = "";
        outputBox.innerHTML = `<h3 class="out-title">Output</h3>${outputHTML(A.runC(codeBox.value, inputBox.value))}`;
      } else if (button.dataset.clab === "reset") {
        if (!window.confirm("Replace your code with the starting template?")) return;
        codeBox.value = level.starter;
        clab.drafts[n] = level.starter;
        writeDraft(n, level.starter);
        outputBox.innerHTML = "";
        resultsBox.innerHTML = "";
      } else if (button.dataset.clab === "check") {
        button.disabled = true;
        outputBox.innerHTML = "";
        const check = A.checkCLab(n, codeBox.value);
        const info = await finishLevel("clab", n, Math.round(check.passed / check.total * 100), check.allPassed);
        const rows = check.results.map((r, i) => `<li class="${r.ok ? "ok" : "bad"}"><strong>Test ${i + 1}: ${r.ok ? "passed" : "failed"}</strong>
          <span>Input: <code>${esc(r.input || "(none)")}</code></span>
          ${r.ok ? "" : `<span>Expected: <code>${esc(r.expected).replace(/\n/g, " ⏎ ")}</code></span><span>Your program printed: <code>${esc(r.actual || "(nothing)").replace(/\n/g, " ⏎ ")}</code></span>${r.error ? `<span class="run-error">${esc(r.error)}</span>` : ""}`}</li>`).join("");
        resultsBox.innerHTML = `${bannerHTML("clab", n, check.allPassed, info, `${check.passed} of ${check.total} tests passed.`)}<ul class="test-list">${rows}</ul>`;
        button.disabled = false;
      }
    });
  }

  function playgroundHTML() {
    const first = A.C_EXAMPLES[0];
    const options = A.C_EXAMPLES.map((e, i) => `<option value="${i}">${esc(e.name)}</option>`).join("");
    return `<section class="arena-panel playground" aria-labelledby="play-title"><h2 id="play-title">Free playground</h2>
      <p class="panel-note">Run any short C program. This editor supports the basics: int, float, char, arrays, if, while, for, do, printf, scanf and a few math functions. It does not score anything.</p>
      <label class="example-pick">Load an example <select id="play-example">${options}</select></label>
      ${editorHTML("play", first.code, first.input)}
      <div class="trace-controls"><button type="button" class="button" data-play="run">Run</button></div>
      <div id="play-output" aria-live="polite"></div></section>`;
  }

  function bindPlayground(root) {
    const codeBox = bindEditor(root, "play");
    const inputBox = root.querySelector("#play-input");
    const outputBox = root.querySelector("#play-output");
    root.querySelector("#play-example").addEventListener("change", event => {
      const example = A.C_EXAMPLES[Number(event.target.value)];
      codeBox.value = example.code;
      inputBox.value = example.input;
      outputBox.innerHTML = "";
    });
    root.querySelector("[data-play=run]").addEventListener("click", () => {
      outputBox.innerHTML = `<h3 class="out-title">Output</h3>${outputHTML(A.runC(codeBox.value, inputBox.value))}`;
    });
  }

  /* ------------------------------ home page extras ------------------------------ */
  function heroDemo() {
    const program = A.TRACE_PROGRAMS.max3;
    return `<aside class="hero-demo" id="hero-demo" aria-label="Animated example: tracing the maximum of three numbers">
      <div class="demo-bar"><span>Maximum of three numbers</span><span class="demo-chip">live trace</span></div>
      <ol class="demo-code">${program.lines.map(text => `<li><code>${esc(text)}</code></li>`).join("")}</ol>
      <div class="demo-vars">${program.vars.map(name => `<div class="var-box"><span>${esc(name)}</span><strong>—</strong></div>`).join("")}</div>
      <p class="demo-out">a = 12, b = 25, c = 7</p>
    </aside>`;
  }

  function startHeroDemo() {
    const host = document.getElementById("hero-demo");
    if (!host) return;
    const program = A.TRACE_PROGRAMS.max3;
    const { frames } = A.runTrace(program, { a: 12, b: 25, c: 7 });
    const lines = [...host.querySelectorAll(".demo-code li")];
    const boxes = [...host.querySelectorAll(".var-box")];
    const out = host.querySelector(".demo-out");
    const paint = k => {
      const frame = frames[k];
      const prev = frames[Math.max(0, k - 1)];
      lines.forEach((li, i) => { li.className = frame.next === i ? "current" : frame.executed === i ? "last" : ""; });
      boxes.forEach((box, i) => {
        const name = program.vars[i];
        box.querySelector("strong").textContent = A.fmtNum(frame.vars[name]);
        box.classList.toggle("changed", k > 0 && frame.vars[name] !== prev.vars[name]);
      });
      out.textContent = frame.next === null ? `Output: ${frame.out.join(" ")}` : "a = 12, b = 25, c = 7";
    };
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { paint(frames.length - 1); return; }
    let tick = 0;
    paint(0);
    const timer = window.setInterval(() => {
      if (!document.body.contains(host)) { window.clearInterval(timer); return; }
      tick++;
      paint(Math.min(tick % (frames.length + 3), frames.length - 1));
    }, 900);
  }

  const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  function readDaily() {
    try { return JSON.parse(localStorage.getItem(DAILY_KEY) || "{}") || {}; } catch { return {}; }
  }
  function writeDaily(data) {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  function dailyHTML() {
    const day = dayNumber();
    const q = A.dailyQuestion(day);
    const saved = readDaily();
    const answered = saved.day === day;
    const options = q.options.map((text, j) => {
      let cls = "";
      if (answered) cls = j === q.correct ? "right" : saved.picked === j ? "wrong" : "";
      return `<button type="button" class="daily-option ${cls}" data-daily="${j}" ${answered ? "disabled" : ""}>${esc(text)}</button>`;
    }).join("");
    const streak = Number(saved.streak) || 0;
    return `<span class="eyebrow">Challenge of the day</span>
      <h3>${esc(q.q)}</h3>
      <div class="daily-options">${options}</div>
      <p class="daily-feedback" aria-live="polite">${answered ? `${saved.picked === q.correct ? "Correct." : "Not this time."} ${esc(q.why)}` : "Pick an answer. A new question arrives every day."}</p>
      <small class="streak">${streak ? `Streak: ${streak} day${streak > 1 ? "s" : ""} in a row` : "Answer correctly to start a streak"}</small>`;
  }

  function homeStrip() {
    const rank = A.rankFor(totalXP());
    const cards = A.TRACK_ORDER.map(id => {
      const track = A.TRACKS[id];
      return `<a class="mini-track" data-track="${id}" href="#arena/${id}"><span class="track-icon" aria-hidden="true">${esc(track.icon)}</span><span><strong>${esc(track.name)}</strong><small>${esc(track.tagline)}</small></span>${pills(id)}</a>`;
    }).join("");
    return `<section class="container arena-strip" aria-label="Practice">
      <div class="strip-main">
        <div class="strip-head"><div><span class="eyebrow">Algo Arena</span><h2>Practise, level up, climb the ranks</h2></div>
          <a class="rank-chip" href="#arena" title="Open the Arena"><small>${signedIn() ? "Your rank" : "Rank (this browser)"}</small><strong>${esc(rank.name)}</strong><small>${totalXP()} XP</small></a></div>
        <div class="mini-tracks">${cards}</div>
        <a class="button" href="#arena">Enter the Arena <span class="arrow" aria-hidden="true">→</span></a>
      </div>
      <div class="daily-card" id="daily-card">${dailyHTML()}</div>
    </section>`;
  }

  function bindHome() {
    startHeroDemo();
    const card = document.getElementById("daily-card");
    if (!card) return;
    card.addEventListener("click", event => {
      const button = event.target.closest("[data-daily]");
      if (!button || button.disabled) return;
      const day = dayNumber();
      const q = A.dailyQuestion(day);
      const saved = readDaily();
      if (saved.day === day) return;
      const picked = Number(button.dataset.daily);
      const ok = picked === q.correct;
      const streak = ok ? (saved.lastOkDay === day - 1 ? (Number(saved.streak) || 0) + 1 : 1) : 0;
      writeDaily({ day, picked, streak, lastOkDay: ok ? day : saved.lastOkDay });
      card.innerHTML = dailyHTML();
    });
  }

  function summaryHTML() {
    const rank = A.rankFor(totalXP());
    return `<div class="arena-summary"><div><span class="eyebrow">Algo Arena</span><strong>${esc(rank.name)} · ${totalXP()} XP</strong><small>${completedCount()} of ${A.LEVEL_COUNT} levels cleared · counts for ${WEIGHT_PERCENT}% of your progress</small></div><a class="button secondary" href="#arena">Open the Arena <span class="arrow" aria-hidden="true">→</span></a></div>`;
  }

  window.ADS1ArenaUI = {
    WEIGHT_PERCENT, view, bind, load, completedCount, totalXP,
    levelCount: A.LEVEL_COUNT, rankName: xp => A.rankFor(xp).name,
    heroDemo, homeStrip, bindHome, summaryHTML
  };
})();
