(function () {
  "use strict";
  if (window.watanyPublicRuntimeScopeV1) return;

  function normalizePath(path) {
    return String(path || "/").replace(/\/+$/, "") || "/";
  }

  function startsWithAny(pathname, prefixes) {
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = normalizePath(prefixes[i]);
      if (prefix === "/") {
        if (pathname === "/") return true;
        continue;
      }
      if (pathname === prefix || pathname.indexOf(prefix + "/") === 0) return true;
    }
    return false;
  }

  function routeTable() {
    return {
      "watany-v1-tools-schools-public-access-v144": ["/school-grants", "/forms", "/admin"],
      "watany-v1-jobs-market-public-access-v150": ["/jobs", "/market", "/marketplace", "/recruitment"],
      "watany-v1-going-now-feed-v160": ["/updates", "/news", "/alerts", "/announcements"],
      "watany-v1-world-cup-nine-icons-v170": ["/world-cup"],
      "watany-v1-school-forms-universal-viewer-bridge-v185": ["/school-grants", "/forms"],
      "watany-v1-clean-settings-single-template-v190": ["/settings"],
      "watany-v1-procedures-source-polish-v190": ["/procedures"],
      "watany-v1-procedures-title-source-grouping-polish-v200": ["/procedures"],
      "watany-v1-procedures-title-inline-size-closeout-v202": ["/procedures"]
    };
  }

  function shouldRun(runtimeName) {
    /* WATANY_WORLD_CUP_RUNTIME_SCOPE_ALLOW_V3_2_7 */
    if (String(runtimeName || "") === "watany-v1-world-cup-nine-icons-v170") {
      return true;
    }

    var pathname = normalizePath(window.location.pathname);
    var table = routeTable();
    var allowedPrefixes = table[runtimeName];
    if (!allowedPrefixes) return true;
    return startsWithAny(pathname, allowedPrefixes);
  }

  function markDecision(runtimeName, allowed) {
    try {
      document.documentElement.setAttribute("data-public-runtime-" + runtimeName, allowed ? "allowed" : "blocked");
    } catch (e) {}
  }

  window.watanyPublicRuntimeScopeV1 = {
    shouldRun: function (runtimeName) {
      var allowed = shouldRun(runtimeName);
      markDecision(runtimeName, allowed);
      return allowed;
    }
  };
})();