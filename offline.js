/* Register offline reading support and report its state in the footer. */
(() => {
  "use strict";
  const status = document.querySelector("#offline-status");
  if (!status) return;
  const update = () => {
    status.textContent = navigator.onLine ? "Offline reading ready" : "Offline · saved lessons available";
    status.dataset.online = String(navigator.onLine);
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  if (!("serviceWorker" in navigator)) {
    status.textContent = "Offline reading is not supported in this browser";
    return;
  }
  status.textContent = "Preparing offline reading…";
  navigator.serviceWorker.register("./sw.js").then(() => navigator.serviceWorker.ready).then(update).catch(() => {
    status.textContent = "Offline reading could not be prepared";
  });
})();
