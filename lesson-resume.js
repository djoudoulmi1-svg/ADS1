(() => {
  const scriptUrl = new URL(document.currentScript.src);
  const chapterId = scriptUrl.searchParams.get("chapter") || "";
  if (!chapterId || window.parent === window) return;

  const post = (type, position) => parent.postMessage({ type, chapterId, ...(position ? { position } : {}) }, "*");
  const readPosition = () => {
    const counter = document.querySelector("#counter");
    const buttons = document.querySelectorAll("#rail button");
    const match = counter?.textContent.match(/(\\d+)\\s*\\//);
    if (match && buttons.length) return { index: Math.max(0, Number(match[1]) - 1) };
    const scroller = document.scrollingElement || document.documentElement;
    return { y: Math.max(0, scroller.scrollTop || window.scrollY || 0) };
  };

  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => post("ADS1_RESUME_POSITION", readPosition()), 180);
  };

  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source !== parent || !message || message.type !== "ADS1_RESUME_RESTORE" || message.chapterId !== chapterId) return;
    const position = message.position;
    if (!position) return;
    const buttons = document.querySelectorAll("#rail button");
    if (Number.isInteger(position.index) && buttons[position.index]) buttons[position.index].click();
    else if (Number.isFinite(position.y)) window.scrollTo(0, position.y);
  });

  const initialize = () => {
    const counter = document.querySelector("#counter");
    if (counter) new MutationObserver(save).observe(counter, { childList: true, characterData: true, subtree: true });
    window.addEventListener("scroll", save, { passive: true });
    post("ADS1_RESUME_READY");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();