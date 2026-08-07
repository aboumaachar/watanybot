
(function () {
  "use strict";
  var MARK = "watany-v1-procedures-title-inline-size-closeout-v202";
  if (window[MARK]) return;
  window[MARK] = true;
  if (window.watanyPublicRuntimeScopeV1 && !window.watanyPublicRuntimeScopeV1.shouldRun(MARK)) return;

  function applyTitleSize() {
    var title = document.querySelector(".watany-procedures-polish-title");
    if (!title) return false;
    title.style.setProperty("font-size", "34px", "important");
    title.style.setProperty("line-height", ".96", "important");
    title.style.setProperty("font-weight", "1000", "important");
    title.setAttribute("data-watany-procedures-title-size-closeout", "v2.0.2");
    document.documentElement.setAttribute("data-watany-v1-procedures-title-size-closeout-ready", "true");
    document.documentElement.setAttribute("data-watany-v1-procedures-title-size-closeout-version", "v2.0.2");
    window.watanyV1ProceduresTitleSizeCloseoutReady = true;
    window.watanyV1ProceduresTitleSizeCloseoutVersion = "v2.0.2";
    return true;
  }

  function schedule() {
    [0, 60, 180, 420, 900, 1500].forEach(function (delay) {
      setTimeout(applyTitleSize, delay);
    });
  }

  function init() {
    schedule();
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
